# file2text

An open-source CLI and TypeScript library for extracting text or converting local files and HTTP(S) URLs to Markdown.

[![NPM Dependency](https://img.shields.io/librariesio/github/idea2app/file2text.svg)][1]
[![Publish](https://github.com/idea2app/file2text/actions/workflows/publish.yml/badge.svg)][2]

[![NPM](https://nodei.co/npm/file2text.png?downloads=true&downloadRank=true&stars=true)][3]

## Installation

```sh
npm install -g file2text
file2text --help
```

You can also run it with `npx file2text <file>`.

## CLI

```sh
file2text report.pdf
file2text ./document.docx -o document.txt
file2text 'https://example.com/report.pdf' -o report.txt
file2text 'file:///path/to/document.txt'
file2text scan.png --format markdown --model google/gemini-2.5-flash -o scan.md
```

### Features

1. 📄 **Documents:** Extract DOCX, XLSX, PPTX, and PDF locally; formats are detected from contents. Other inputs are read as UTF-8, including empty files.
2. 🖼️ **OCR:** Recognize images locally in Traditional Chinese, Simplified Chinese, and English; required language data is managed automatically. Scanned PDFs require a multimodal model.
3. 🤖 **AI Markdown:** A configured `MEDIA_AI_MODEL` or `--model` enables AI conversion by default. Failures are reported on stderr and fall back to local text. Use `--format text` for local extraction or `--format markdown` to try AI even without a configured model.
4. 📤 **Output:** Print to stdout with a newline, or use `--output` to write unchanged text. Missing directories are created and existing files overwritten. Unrecoverable errors exit nonzero; successful fallbacks exit successfully.
5. ⚠️ **Limits:** No stdin or local extraction of legacy DOC/XLS/PPT, audio, video, or other binary formats. AI sends files to the provider, may incur costs, and depends on model limits.

Quote paths containing spaces; prefix a path beginning with `-` with `./`.

## Configuration

The CLI loads `.env` from the current working directory. Existing environment variables take precedence. Set these variables in the environment or in `.env`:

| Variable             | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `MEDIA_AI_MODEL`     | Default Markdown model in AI Gateway `provider/model` format; `--model` overrides it |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key for Markdown conversion; not needed for local text extraction  |

🌐 **Proxy:** The CLI honors standard HTTP(S) proxy environment variables.

## Library API

```ts
import { file2text, file2markdown, image2text, textualizeFile } from 'file2text';

const text = await file2text('./report.pdf');
const remote = await file2text(new URL('https://example.com/report.pdf'));
const ocr = await image2text(imageBuffer);
const markdown = await file2markdown(pdfBuffer, 'google/gemini-2.5-flash');
const automatic = await textualizeFile('./report.pdf');
```

| API                           | Behavior                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 📄 `file2text`, `getFileMIME` | Accept paths, `file:`/HTTP(S) URLs or `Buffer` values.                                                         |
| 🤖 `file2markdown`            | Accepts the same inputs and an optional AI SDK `LanguageModel`; remote content is fetched once per conversion. |
| 🖼️ `image2text`               | Recognizes an image `Buffer`.                                                                                  |
| 🔄 `textualizeFile`           | Reads local text files directly; otherwise tries Markdown, logs failures and falls back to local extraction.   |
| 🧰 Other exports              | `makeFileURL`, `FileInput` and `markdownPrompt`.                                                               |

Set `MEDIA_AI_MODEL` before importing the library to use the default model; its value is captured when the module loads.

## Development and publishing

```sh
pnpm install
pnpm build
pnpm test
pnpm pack --dry-run
```

1. 🧪 **Tests:** `pnpm test` covers local extraction, real OCR, and CLI behavior. Cloud AI calls are mocked; HTTP tests use a local server. The publish workflow tests Node.js 22, 24, and 26.
2. 📦 **Build:** Creates ESM, declarations, and the CLI; `pnpm pack` builds automatically. Runtime dependencies are installed with the package.
3. 🚀 **Publish:** The release workflow publishes version tags when `NPM_TOKEN` is configured. Alternatively, run `pnpm publish --access public`. No API keys are stored in the repository.

[1]: https://github.com/idea2app/file2text
[2]: https://github.com/idea2app/file2text/actions/workflows/publish.yml
[3]: https://npm.im/file2text
