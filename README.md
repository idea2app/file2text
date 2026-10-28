# file2text

An open-source CLI and TypeScript library for extracting text or converting local files and HTTP(S) URLs to Markdown.

The extraction API is based on [`file2text` and `file2markdown`](https://github.com/idea2app/work-counter/blob/48dfb1ca2132d057969740c9479cd4b5b304fcc5/source/utility/File.ts#L57-L115) from work-counter, including OCR, MIME detection, and the multimodal prompt. Licensed under [LGPL-2.1](LICENSE).

## Installation

Requires **Node.js >= 22.19**. Python, LibreOffice, and system Tesseract are not required.

```sh
npm install -g file2text
file2text --help
```

You can also run it with `npx file2text <file>`, or install from source:

```sh
pnpm install
pnpm run build
pnpm link --global
```

## CLI

```sh
file2text report.pdf
file2text ./document.docx -o document.txt
file2text 'https://example.com/report.pdf' -o report.txt
file2text 'file:///path/to/document.txt'
file2text scan.png --format markdown --model google/gemini-2.5-flash -o scan.md
```

Standard input is not currently supported.

When `MEDIA_AI_MODEL` or `--model` is configured, the CLI tries AI Markdown conversion by default and falls back to local text extraction if AI conversion fails. Without a configured model, it uses local text extraction. Use `--format text` to explicitly select local extraction or `--format markdown` to request AI conversion.

Local extraction supports DOCX, XLSX, PPTX, and PDF through `office-text-extractor`; images are recognized by Tesseract.js in Traditional Chinese, Simplified Chinese, and English. Other inputs are read as UTF-8. File contents, not extensions, determine the format, and empty files are supported. Legacy DOC/XLS/PPT, audio, video, and other binary formats are not supported for local extraction. Scanned PDF pages are not OCR-processed locally; use a multimodal model for those documents.

Markdown conversion sends the input file to the selected AI provider and may incur costs. Supported file types, file size limits, and results depend on the model.

Results are written unchanged to stdout (without an added newline) or to the file specified with `--output`; errors go to stderr and return exit code 1. Existing output files are overwritten. Quote paths containing spaces; prefix a path beginning with `-` with `./`.

## Configuration

The CLI loads `.env` from the current working directory. Existing environment variables take precedence. Copy `.env.example` and set:

| Variable             | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `MEDIA_AI_MODEL`     | Default Markdown model in AI Gateway `provider/model` format; `--model` overrides it |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key for Markdown conversion; not needed for local text extraction  |

OCR language data is downloaded and cached automatically on first use, so first-time OCR requires internet access and write permissions. The CLI honors standard HTTP(S) proxy environment settings. The library does not load `.env` or modify global proxy settings.

## Library API

```ts
import { file2text, file2markdown, image2text } from 'file2text';

const text = await file2text('./report.pdf');
const remote = await file2text(new URL('https://example.com/report.pdf'));
const ocr = await image2text(imageBuffer);
const markdown = await file2markdown(pdfBuffer, 'google/gemini-2.5-flash');
```

`file2text`, `file2markdown`, and `getFileMIME` accept local paths, `file:`/HTTP(S) URLs (strings or `URL` objects), or `Buffer` values. `image2text` accepts a `Buffer`. `makeFileURL`, `FileInput`, and the `office-text-extractor` API are also exported. The second `file2markdown` argument can be an AI SDK `LanguageModel`; omit it to use `MEDIA_AI_MODEL`. Remote files are fetched once and their content is reused for MIME detection and conversion.

## Development and publishing

```sh
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
pnpm run check-format
pnpm pack --dry-run
```

CI runs on Node.js 22, 24, and 26. Tests use a local HTTP server and mock AI/OCR, and do not require credentials or network access for OCR language data. `pnpm run build` creates bundled ESM, type declarations, and the executable CLI; `pnpm pack` builds automatically. `pnpm run test:ocr` separately runs a real OCR worker and needs cached language data or internet access to download it.

The Office extraction package is bundled into the output; third-party license details are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). SheetJS is installed from its official CDN package during development. Publishing has not been performed; configure npm Trusted Publishing for this repository before using the release workflow. The package can also be published manually with `npm publish --access public`. No API keys are stored in the repository.
