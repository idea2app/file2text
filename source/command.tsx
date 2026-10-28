#!/usr/bin/env node
import 'dotenv/config';

import { writeFile } from 'node:fs/promises';
import { Command } from 'commander-jsx';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import metadata from '../package.json' with { type: 'json' };
import { file2text, file2markdown } from './index.js';

const { version } = metadata;

if (
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.https_proxy
)
    setGlobalDispatcher(new EnvHttpProxyAgent());

interface CLIOptions {
    format: string;
    model: string;
    output: string;
}

const command = (
    <Command<CLIOptions>
        name="file2text"
        version={version}
        parameters="<file>"
        description="Extract text or AI-generated Markdown from a local file or URL"
        options={{
            format: {
                shortcut: 'f',
                parameters: '<format>',
                pattern: /^(text|markdown)$/,
                description: 'Output format'
            },
            model: {
                shortcut: 'm',
                parameters: '<model>',
                description: 'AI Gateway model ID (defaults to MEDIA_AI_MODEL)'
            },
            output: {
                shortcut: 'o',
                parameters: '<path>',
                description: 'Write to a UTF-8 file instead of stdout'
            }
        }}
        executor={async (options, file) => {
            if (typeof file !== 'string') throw new TypeError('Expected a file path or URL.');

            const model = typeof options.model === 'string' ? options.model : undefined;
            const format =
                typeof options.format === 'string'
                    ? options.format
                    : model || process.env.MEDIA_AI_MODEL
                      ? 'markdown'
                      : 'text';

            let text: string;
            if (format === 'markdown') {
                try {
                    text = await file2markdown(file, model);
                } catch (error) {
                    if (!model && !process.env.MEDIA_AI_MODEL) throw error;
                    text = await file2text(file);
                }
            } else text = await file2text(file);

            if (typeof options.output === 'string') await writeFile(options.output, text, 'utf-8');
            else process.stdout.write(text);
        }}
    />
);

try {
    await Command.execute(command, process.argv.slice(2));
} catch (error) {
    console.error(`file2text: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
