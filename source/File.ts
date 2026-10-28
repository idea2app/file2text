import { generateText, LanguageModel } from 'ai';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs-extra';
import { getTextExtractor } from 'office-text-extractor';
import { createWorker } from 'tesseract.js';
import { fileURLToPath, pathToFileURL } from 'url';

export type FileInput = string | URL | Buffer;

const { MEDIA_AI_MODEL } = process.env;

export const makeFileURL = (path: string) =>
    // A drive letter is a local path, not a URL scheme.
    /^[a-z][a-z\d+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)
        ? new URL(path)
        : pathToFileURL(path);

async function loadFile(file: FileInput) {
    if (Buffer.isBuffer(file)) return { input: file };

    const { href, protocol } = typeof file === 'string' ? makeFileURL(file) : file;

    if (protocol === 'file:') return { input: await fs.readFile(fileURLToPath(href)) };
    if (protocol !== 'http:' && protocol !== 'https:')
        throw new TypeError(`Unsupported file protocol: ${protocol}`);

    const response = await fetch(href);

    if (!response.ok) {
        await response.body?.cancel();
        throw new URIError(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    return {
        input: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    };
}

// Empty and short plain-text buffers are valid inputs but have no magic bytes.
const detectFile = async (input: Buffer) =>
    input.length >= 16 ? fileTypeFromBuffer(input) : undefined;

export async function getFileMIME(file: FileInput) {
    const { input, contentType } = await loadFile(file);

    return (await detectFile(input))?.mime || contentType || 'text/plain';
}

export async function image2text(input: Buffer) {
    const worker = await createWorker(['chi_tra', 'chi_sim', 'eng']);

    try {
        const { data } = await worker.recognize(input);

        return data.text.trim();
    } finally {
        await worker.terminate();
    }
}

const extractor = getTextExtractor();

export async function file2text(file: FileInput): Promise<string> {
    const { input, contentType } = await loadFile(file);
    const { ext, mime } = (await detectFile(input)) || {};

    if (ext && ['docx', 'xlsx', 'pptx', 'pdf'].includes(ext))
        return extractor.extractText({ type: 'file', input });

    return (mime || contentType)?.startsWith('image/')
        ? image2text(input)
        : input.toString('utf-8');
}

export const markdownPrompt = `请识别以下文件中的文字（可能包含在内置图片中），并以 Markdown 格式返回，并遵循以下规则：
1. 忽略背景水印中的文字
2. CJK 字符附近的标点符号，应用中文（全角）标点
3. 如有表格，则用 Markdown 表格语法表示
4. 如有流程图，则在 Markdown 中插入 Mermaid 代码块来表示流程图内容
5. 如有数学公式，则在 Markdown 中插入 LaTeX 代码块来表示数学公式内容
6. 其它文字则以其在上下文中的作用，多用语义类 Markdown 语法（标题、列表等），少用样式类语法（加粗、斜体等）来表示`;

export async function file2markdown(
    file: FileInput,
    model: LanguageModel | undefined = MEDIA_AI_MODEL
): Promise<string> {
    if (!model)
        throw new Error(
            'Markdown conversion requires MEDIA_AI_MODEL or an explicit model argument.'
        );
    const { input, contentType } = await loadFile(file);
    const mediaType = (await detectFile(input))?.mime || contentType || 'text/plain';

    const { text } = await generateText({
        model,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: markdownPrompt },
                    { type: 'file', mediaType, data: input }
                ]
            }
        ]
    });
    return text;
}
