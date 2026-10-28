import { deflateSync } from 'node:zlib';
import { strToU8, zipSync } from 'fflate';

function office(files: Record<string, string>) {
    return Buffer.from(
        zipSync(
            Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)]))
        )
    );
}

const relationships = (type: string, target: string) =>
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/></Relationships>`;

const contentTypes = (part: string, type: string) =>
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}"/></Types>`;

export function docx() {
    return office({
        '[Content_Types].xml': contentTypes(
            'word/document.xml',
            'wordprocessingml.document.main+xml'
        ),
        '_rels/.rels': relationships('officeDocument', 'word/document.xml'),
        'word/document.xml':
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX 中文</w:t></w:r></w:p></w:body></w:document>'
    });
}

export function xlsx() {
    return office({
        '[Content_Types].xml': contentTypes('xl/workbook.xml', 'spreadsheetml.sheet.main+xml'),
        '_rels/.rels': relationships('officeDocument', 'xl/workbook.xml'),
        'xl/_rels/workbook.xml.rels': relationships('worksheet', 'worksheets/sheet1.xml'),
        'xl/workbook.xml':
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/worksheets/sheet1.xml':
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Hello XLSX 中文</t></is></c></row></sheetData></worksheet>'
    });
}

export function pptx() {
    return office({
        '[Content_Types].xml': contentTypes(
            'ppt/presentation.xml',
            'presentationml.presentation.main+xml'
        ),
        '_rels/.rels': relationships('officeDocument', 'ppt/presentation.xml'),
        'ppt/presentation.xml':
            '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
        'ppt/slides/slide1.xml':
            '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Hello PPTX 中文</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
    });
}

export function pdf() {
    const stream = 'BT /F1 24 Tf 50 100 Td (Hello PDF) Tj ET';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    ];
    let data = '%PDF-1.4\n';
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
        offsets.push(data.length);
        data += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = data.length;
    data += `xref\n0 6\n0000000000 65535 f \n`;
    data += offsets
        .slice(1)
        .map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join('');
    data += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(data);
}

export function png() {
    const glyphs: Record<string, string[]> = {
        H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
        E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
        O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
        R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
        D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
        ' ': Array<string>(7).fill('00000')
    };
    const text = 'HELLO WORLD';
    const scale = 6;
    const margin = 30;
    const width = text.length * 6 * scale + margin * 2;
    const height = 7 * scale + margin * 2;
    const pixels = Buffer.alloc((width + 1) * height, 255);
    for (let y = 0; y < height; y++) pixels[y * (width + 1)] = 0;
    for (const [index, letter] of [...text].entries()) {
        for (const [row, line] of glyphs[letter].entries()) {
            for (const [column, bit] of [...line].entries()) {
                if (bit !== '1') continue;
                for (let y = 0; y < scale; y++) {
                    for (let x = 0; x < scale; x++) {
                        pixels[
                            (margin + row * scale + y) * (width + 1) +
                                1 +
                                margin +
                                index * 6 * scale +
                                column * scale +
                                x
                        ] = 0;
                    }
                }
            }
        }
    }
    const chunk = (type: string, data: Buffer) => {
        const content = Buffer.concat([Buffer.from(type), data]);
        let crc = 0xffffffff;
        for (const byte of content) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
        const size = Buffer.alloc(4);
        size.writeUInt32BE(data.length);
        const checksum = Buffer.alloc(4);
        checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
        return Buffer.concat([size, content, checksum]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    return Buffer.concat([
        Buffer.from('89504e470d0a1a0a', 'hex'),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(pixels)),
        chunk('IEND', Buffer.alloc(0))
    ]);
}
