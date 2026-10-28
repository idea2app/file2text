#!/usr/bin/env node

import 'dotenv/config';

import fs from 'fs-extra';
import { Command } from 'commander-jsx';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

import metadata from '../package.json' with { type: 'json' };
import { file2text, file2markdown } from './index.js';

const { name, version } = metadata,
    { HTTP_PROXY, HTTPS_PROXY, http_proxy, https_proxy, MEDIA_AI_MODEL } = process.env;

if (HTTP_PROXY || HTTPS_PROXY || http_proxy || https_proxy)
    setGlobalDispatcher(new EnvHttpProxyAgent());

type CLIOptions = Record<'format' | 'model' | 'output', string>;

const command = (
    <Command<CLIOptions>
        {...{ name, version }}
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

            const model = typeof options.model === 'string' ? options.model : MEDIA_AI_MODEL;
            const format =
                typeof options.format === 'string' ? options.format : model ? 'markdown' : 'text';
            let text: string;

            if (format === 'markdown')
                try {
                    text = await file2markdown(file, model);
                } catch (error) {
                    console.error(
                        `file2markdown: AI conversion failed; falling back to local text: ${
                            error instanceof Error ? error.message : error
                        }`
                    );
                    text = await file2text(file);
                }
            else text = await file2text(file);

            if (typeof options.output === 'string')
                await fs.outputFile(options.output, text, 'utf-8');
            else console.info(text);
        }}
    />
);

await Command.execute(command, process.argv.slice(2));
