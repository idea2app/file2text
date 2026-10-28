import { unzipSync } from 'fflate';
import { dump } from 'js-yaml';
import { extractRawText } from 'mammoth';
import { PDFParse } from 'pdf-parse';
import XLSX from 'xlsx';
import { parseStringPromise } from 'xml2js';

function textValue(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(textValue);
    if (value && typeof value === 'object' && '_' in value) return textValue(value._);
    return [];
}

function slideText(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(slideText);
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) =>
        key === 'a:t' ? textValue(child) : slideText(child)
    );
}

export async function extractDocument(input: Buffer, extension: string): Promise<string> {
    switch (extension) {
        case 'docx':
            return (await extractRawText({ buffer: input })).value;
        case 'xlsx': {
            const workbook = XLSX.read(input, { type: 'buffer' });
            return workbook.SheetNames.map(name => {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
                return (
                    '===\n' +
                    rows
                        .map(
                            row =>
                                '---\n' +
                                dump(row)
                                    .replaceAll(/__EMPTY*:/g, ':')
                                    .replaceAll(/__EMPTY_\d?:/g, ':')
                        )
                        .join('')
                );
            }).join('');
        }
        case 'pptx': {
            const slides: string[] = [];
            for (const [name, content] of Object.entries(unzipSync(input))) {
                if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
                const slide: unknown = await parseStringPromise(
                    Buffer.from(content).toString('utf-8')
                );
                slides.push(slideText(slide).join('\n'));
            }
            return slides.join('\n---\n') + '\n';
        }
        case 'pdf': {
            const parser = new PDFParse({ data: input });
            try {
                return (await parser.getText({ parseHyperlinks: true })).text;
            } finally {
                await parser.destroy();
            }
        }
        default:
            throw new TypeError(`Unsupported document format: ${extension}`);
    }
}
