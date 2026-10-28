import fs from 'fs-extra';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { $, usePowerShell } from 'zx';

import { docx } from './fixtures.js';

const command = fileURLToPath(new URL('../dist/command.js', import.meta.url));
let directory: string;

before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'file2text-cli-'));

    if (process.platform === 'win32') {
        usePowerShell();
        $.prefix = '& ';
    }
    $.cwd = directory;
    $.env = { ...process.env, MEDIA_AI_MODEL: '', DOTENV_CONFIG_QUIET: 'true' };
    $.quiet = true;
    $.nothrow = true;
    $.input = '';
});
after(() => rm(directory, { recursive: true, force: true }));

test('help and version are available from the built executable', async () => {
    const help = await $`${process.execPath} ${command} --help`;
    assert.equal(help.exitCode, 0);
    assert.match(help.stdout, /--format/);

    const version = await $`${process.execPath} ${command} --version`;
    assert.equal(version.exitCode, 0);

    const metadata = await fs.readJSON(new URL('../package.json', import.meta.url));
    assert.equal(version.stdout.trim(), metadata.version);
});

test('CLI does not read standard input', async () => {
    const result = await $({ input: '中文 text\n' })`${process.execPath} ${command} -`;

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.notEqual(result.stderr, '');
});

test('CLI extracts real Office files and writes -o output', async () => {
    const path = join(directory, 'input.docx');
    const output = join(directory, 'nested', 'output.txt');
    await writeFile(path, docx());

    const result = await $`${process.execPath} ${command} ${path} -o ${output}`;
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(await readFile(output, 'utf-8'), /Hello DOCX 中文/);
});

test('CLI tries AI by default when configured and falls back to local text', async () => {
    const path = join(directory, 'input.txt');
    await writeFile(path, 'plain text fallback');

    const result = await $({
        env: { ...$.env, MEDIA_AI_MODEL: 'invalid model' }
    })`${process.execPath} ${command} ${path}`;

    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stdout, 'plain text fallback\n');
    assert.match(result.stderr, /AI conversion failed; falling back to local text/);
});

test('CLI explicitly selects text or falls back when Markdown has no model', async () => {
    const path = join(directory, 'format.txt');
    await writeFile(path, 'plain text');

    const text = await $({
        env: { ...$.env, MEDIA_AI_MODEL: 'invalid model' }
    })`${process.execPath} ${command} ${path} --format text`;

    assert.equal(text.exitCode, 0, text.stderr);
    assert.equal(text.stdout, 'plain text\n');
    assert.equal(text.stderr, '');

    const markdown = await $`${process.execPath} ${command} ${path} --format markdown`;
    assert.equal(markdown.exitCode, 0, markdown.stderr);
    assert.equal(markdown.stdout, 'plain text\n');
    assert.match(markdown.stderr, /AI conversion failed; falling back to local text/);
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
        const result = await $({ input: 'text' })`${process.execPath} ${command} ${args}`;

        assert.equal(result.exitCode, 1);
        assert.equal(result.stdout, '');
        assert.notEqual(result.stderr, '');
    }
});
