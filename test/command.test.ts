import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { docx } from './fixtures.js';

const command = fileURLToPath(new URL('../dist/command.js', import.meta.url));
let directory: string;

before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'file2text-cli-'));
});
after(async () => {
    await rm(directory, { recursive: true, force: true });
});

function run(args: string[], input?: string) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>(
        (resolve, reject) => {
            const child = spawn(process.execPath, [command, ...args], {
                cwd: directory,
                env: { ...process.env, MEDIA_AI_MODEL: '', DOTENV_CONFIG_QUIET: 'true' }
            });
            let stdout = '';
            let stderr = '';
            child.stdout.setEncoding('utf-8').on('data', chunk => (stdout += chunk));
            child.stderr.setEncoding('utf-8').on('data', chunk => (stderr += chunk));
            child.on('error', reject);
            child.on('close', code => resolve({ code, stdout, stderr }));
            child.stdin.end(input);
        }
    );
}

test('help and version are available from the built executable', async () => {
    const help = await run(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /--format/);
    const version = await run(['--version']);
    assert.equal(version.code, 0);
    const metadata = JSON.parse(
        await readFile(new URL('../package.json', import.meta.url), 'utf-8')
    );
    assert.equal(version.stdout.trim(), metadata.version);
});

test('CLI reads stdin and writes only the exact converted text', async () => {
    assert.deepEqual(await run(['-'], '中文 text\n'), {
        code: 0,
        stdout: '中文 text\n',
        stderr: ''
    });
    assert.equal((await run(['-'], '')).stdout, '');
});

test('CLI extracts real Office files and writes --output', async () => {
    const path = join(directory, 'input.docx');
    const output = join(directory, 'output.txt');
    await writeFile(path, docx());
    const result = await run([path, '-o', output]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(await readFile(output, 'utf-8'), /Hello DOCX 中文/);
});

test('CLI exits nonzero without success-shaped output on invalid input', async () => {
    for (const args of [
        [],
        ['missing.txt'],
        ['-', '--format', 'invalid'],
        ['-', '--format', 'markdown'],
        ['-', '--model', 'test/model'],
        ['-', '-o', join(directory, 'missing', 'out.txt')]
    ]) {
        const result = await run(args, 'text');
        assert.equal(result.code, 1);
        assert.equal(result.stdout, '');
        assert.notEqual(result.stderr, '');
    }
});
