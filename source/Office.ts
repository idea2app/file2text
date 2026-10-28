import { getTextExtractor } from 'office-text-extractor';

const extractor = getTextExtractor();

export function extractDocument(input: Buffer): Promise<string> {
    return extractor.extractText({ input, type: 'buffer' });
}
