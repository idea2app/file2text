#!/usr/bin/env node
import 'dotenv/config';

import { readFile, writeFile } from 'node:fs/promises';
import { Command, Option } from 'commander';
import { file2text, file2markdown } from './index.js';
import { configureProxy } from './Network.js';

const { version } = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf-8')
) as { version: string };

configureProxy();

const command = new Command()
    .name('file2text')
    .description('Extract text or AI-generated Markdown from a local file, URL, or stdin')
    .version(version)
    .argument('<file>', 'local path, file: URL, HTTP(S) URL, or - for stdin')
    .addOption(
        new Option('-f, --format <format>', 'output format')
            .choices(['text', 'markdown'])
            .default('text')
    )
    .option('-m, --model <model>', 'AI Gateway model ID for Markdown (defaults to MEDIA_AI_MODEL)')
    .option('-o, --output <path>', 'write to a UTF-8 file instead of stdout')
    .action(async (file: string, options: { format: string; model?: string; output?: string }) => {
        if (options.model && options.format !== 'markdown')
            throw new Error('--model requires --format markdown');

        let input: string | Buffer = file;
        if (file === '-') {
            const chunks: Buffer[] = [];
            for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
            input = Buffer.concat(chunks);
        }
        const text =
            options.format === 'markdown'
                ? await file2markdown(input, options.model)
                : await file2text(input);

        if (options.output) await writeFile(options.output, text, 'utf-8');
        else process.stdout.write(text);
    });

try {
    await command.parseAsync();
} catch (error) {
    console.error(`file2text: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
