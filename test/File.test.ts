import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, mock, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { MockLanguageModelV4 } from 'ai/test';
import { docx, pdf, png, pptx, xlsx } from './fixtures.js';

const recognize = mock.fn(async (_input: Buffer) => ({ data: { text: '  OCR 中文  \n' } }));
const terminate = mock.fn(async () => {});
const createWorker = mock.fn(async (..._args: unknown[]) => ({ recognize, terminate }));
mock.module('tesseract.js', { namedExports: { createWorker } });

const { file2text, file2markdown, getFileMIME, image2text, makeFileURL, markdownPrompt } =
    await import('../source/File.js');

let directory: string;
let origin: string;
let requests = 0;
const server = createServer((request, response) => {
    requests++;
    if (request.url === '/missing') {
        response.writeHead(404).end('not found');
    } else if (request.url === '/image') {
        response.setHeader('content-type', 'image/png; charset=binary');
        response.end(png());
    } else if (request.url === '/pdf') {
        response.setHeader('content-type', 'application/octet-stream');
        response.end(pdf());
    } else {
        response.setHeader('content-type', 'text/plain; charset=utf-8');
        response.end('remote 中文');
    }
});

before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'file2text-'));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
    );
    await rm(directory, { recursive: true, force: true });
});

test('local paths and URLs preserve spaces, Unicode, #, and percent signs', async () => {
    const path = join(directory, '中文 # 100%.txt');
    const text = '中文 text\n';
    await writeFile(path, text);
    assert.equal(makeFileURL(path).href, pathToFileURL(path).href);
    assert.equal(makeFileURL(origin).href, `${origin}/`);
    for (const input of [path, pathToFileURL(path), pathToFileURL(path).href, Buffer.from(text)])
        assert.equal(await file2text(input), text);
});

test('empty, short, and unrecognized UTF-8 input have a safe MIME fallback', async () => {
    for (const text of ['', 'a', '中文', 'text without a known binary signature']) {
        assert.equal(await file2text(Buffer.from(text)), text);
        assert.equal(await getFileMIME(Buffer.from(text)), 'text/plain');
    }
});

test('remote inputs are fetched once without HEAD and preserve UTF-8', async () => {
    const previous = requests;
    assert.equal(await file2text(`${origin}/text`), 'remote 中文');
    assert.equal(requests - previous, 1);
    assert.equal(await getFileMIME(`${origin}/text`), 'text/plain');
});

test('missing files, HTTP errors, and unsupported protocols reject explicitly', async () => {
    await assert.rejects(file2text(join(directory, 'missing.txt')), /ENOENT/);
    await assert.rejects(file2text(`${origin}/missing`), /404/);
    await assert.rejects(getFileMIME(`${origin}/missing`), /404/);
    await assert.rejects(file2text('ftp://example.com/file'), /Unsupported file protocol/);
});

for (const [extension, fixture, expected] of [
    ['docx', docx, 'Hello DOCX 中文'],
    ['xlsx', xlsx, 'Hello XLSX 中文'],
    ['pptx', pptx, 'Hello PPTX 中文'],
    ['pdf', pdf, 'Hello PDF']
] as const) {
    test(`extracts actual ${extension.toUpperCase()} bytes, regardless of filename`, async () => {
        const input = fixture();
        const path = join(directory, `${extension}.unknown`);
        await writeFile(path, input);
        assert.ok((await file2text(input)).includes(expected));
        assert.ok((await file2text(path)).includes(expected));
    });
}

test('remote PDF uses magic bytes instead of generic Content-Type', async () => {
    assert.equal(await getFileMIME(`${origin}/pdf`), 'application/pdf');
    assert.match(await file2text(`${origin}/pdf`), /Hello PDF/);
});

test('OCR uses all original languages, trims output, and terminates its worker', async () => {
    const input = png();
    const previous = terminate.mock.callCount();
    assert.equal(await file2text(input), 'OCR 中文');
    assert.deepEqual(createWorker.mock.calls.at(-1)?.arguments[0], ['chi_tra', 'chi_sim', 'eng']);
    assert.equal(recognize.mock.calls.at(-1)?.arguments[0], input);
    assert.equal(terminate.mock.callCount(), previous + 1);
    assert.equal(await file2text(`${origin}/image`), 'OCR 中文');
});

test('OCR errors propagate and still terminate the worker', async () => {
    const previous = terminate.mock.callCount();
    recognize.mock.mockImplementationOnce(async () => {
        throw new Error('recognition failed');
    });
    await assert.rejects(image2text(png()), /recognition failed/);
    assert.equal(terminate.mock.callCount(), previous + 1);
});

const Model = () =>
    new MockLanguageModelV4({
        doGenerate: {
            content: [{ type: 'text', text: '# Converted\n\n中文' }],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 }
            },
            warnings: []
        }
    });

test('Markdown passes original bytes, detected MIME, and all formatting rules to AI', async () => {
    const input = png();
    const ai = Model();
    assert.equal(await file2markdown(input, ai), '# Converted\n\n中文');
    const message = ai.doGenerateCalls[0].prompt.at(-1);
    assert.equal(message?.role, 'user');
    const instructions = message?.content[0];
    assert.equal(instructions?.type, 'text');
    if (instructions?.type === 'text') assert.equal(instructions.text, markdownPrompt);
    const attachment = message?.content[1];
    assert.equal(attachment?.type, 'file');
    if (attachment?.type === 'file') {
        assert.equal(attachment.mediaType, 'image/png');
        assert.equal(attachment.data.type, 'data');
        if (attachment.data.type === 'data') {
            assert.ok(attachment.data.data instanceof Uint8Array);
            assert.deepEqual(Buffer.from(attachment.data.data), input);
        }
    }
    for (const rule of ['水印', '全角', '表格', 'Mermaid', 'LaTeX', '语义'])
        assert.ok(markdownPrompt.includes(rule));
});

test('Markdown supports local paths, file URLs, remote files, and plain-text buffers', async () => {
    const path = join(directory, 'markdown.pdf');
    await writeFile(path, pdf());
    for (const input of [
        path,
        pathToFileURL(path),
        new URL(`${origin}/pdf`),
        Buffer.from('text')
    ]) {
        const ai = Model();
        const previous = requests;
        assert.equal(await file2markdown(input, ai), '# Converted\n\n中文');
        assert.equal(
            requests - previous,
            input instanceof URL && input.protocol === 'http:' ? 1 : 0
        );
    }
    assert.deepEqual(await readFile(path), pdf());
});

test('Markdown requires a model and propagates AI and download errors', async () => {
    const previous = process.env.MEDIA_AI_MODEL;
    delete process.env.MEDIA_AI_MODEL;
    try {
        await assert.rejects(file2markdown(Buffer.from('text')), /MEDIA_AI_MODEL/);
    } finally {
        if (previous !== undefined) process.env.MEDIA_AI_MODEL = previous;
    }
    const ai = Model();
    ai.doGenerate = async () => {
        throw new Error('AI conversion failed');
    };
    await assert.rejects(file2markdown(pdf(), ai), /AI conversion failed/);
    await assert.rejects(file2markdown(`${origin}/missing`, ai), /404/);
});
