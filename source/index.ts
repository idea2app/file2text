import fs from 'fs-extra';
import MIME from 'mime';

import { file2text, file2markdown, makeFileURL } from './File.js';

export * from './File.js';

export async function textualizeFile(path: string) {
    const file = makeFileURL(path);

    if (MIME.getType(path)?.startsWith('text')) return fs.readFile(path, { encoding: 'utf-8' });

    try {
        return await file2markdown(file);
    } catch (error) {
        console.error(error);

        return file2text(file);
    }
}
