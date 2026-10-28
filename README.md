# file2text

将本地文件、HTTP(S) URL 或标准输入转换为纯文本或 Markdown 的开源 CLI 和 TypeScript 库。

提取能力移植自 [work-counter 的 File.ts](https://github.com/idea2app/work-counter/blob/48dfb1ca2132d057969740c9479cd4b5b304fcc5/source/utility/File.ts#L57-L115)，保留 `file2text`、`file2markdown` 及其依赖的 OCR、MIME 检测和多模态提示词。许可证为 [LGPL-2.1](LICENSE)。

## 安装

需要 **Node.js >= 22.19**，无需 Python、LibreOffice 或系统 Tesseract。

```sh
npm install -g @idea2app/file2text
file2text --help
```

也可使用 `npx @idea2app/file2text <file>`，或从源码安装：

```sh
npm ci
npm run build
npm link
```

## CLI

```sh
file2text report.pdf
file2text ./document.docx -o document.txt
file2text 'https://example.com/report.pdf' -o report.txt
file2text 'file:///path/to/document.txt'
cat document.txt | file2text -
file2text scan.png --format markdown --model google/gemini-2.5-flash -o scan.md
```

默认 `--format text`，不需要 AI 密钥：DOCX、XLSX、PPTX、PDF 使用从 `office-text-extractor` 移植的适配层，分别接入 Mammoth、SheetJS、XML 解析及 pdf-parse；图片使用 Tesseract.js 识别繁体中文、简体中文和英文；其他输入按 UTF-8 读取。使用文件内容而非扩展名识别格式，空文件也可处理。旧版 DOC/XLS/PPT、音视频及其他二进制格式不在本地提取支持范围内。扫描版 PDF 的图片不会由本地 PDF 提取器执行 OCR，请使用支持该文件类型的多模态模型转 Markdown。

`--format markdown` 使用 AI SDK 的多模态文件输入，保留忽略水印、中文标点、Markdown 表格、Mermaid 流程图、LaTeX 公式及语义化排版规则。支持的格式、文件大小和效果取决于所选模型；AI 转换会将文件内容发送给服务商并可能产生费用。失败时明确报错，**不会悄悄退回纯文本**。

结果原样写到 stdout（不追加换行）或 `--output` 指定文件；错误写到 stderr，退出码为 1。输出文件已存在时会覆盖。路径含空格时请加引号，以 `-` 开头的文件名可写成 `./-name`。

## 配置

CLI 自动读取当前工作目录的 `.env`，已存在的环境变量优先。可复制 `.env.example`：

| 变量                 | 用途                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `MEDIA_AI_MODEL`     | Markdown 默认模型，AI Gateway 的 `provider/model` 格式；也可用 `--model` 覆盖 |
| `AI_GATEWAY_API_KEY` | Markdown 使用的 Vercel AI Gateway 密钥；纯文本模式无需此项                    |
| `HTTPS_PROXY`        | HTTPS 下载和 AI 请求代理                                                      |
| `HTTP_PROXY`         | HTTP 下载代理                                                                 |
| `NO_PROXY`           | 不走代理的主机，例如 `localhost,127.0.0.1`                                    |
| `TESSDATA_PREFIX`    | 可选的 OCR 语言数据目录或 URL，包含 `chi_tra/chi_sim/eng.traineddata.gz`      |

OCR 首次运行会下载语言模型并在当前目录缓存，需要网络及目录写入权限。离线运行请提前缓存这三个语言包，或设置 `TESSDATA_PREFIX` 指向本地语言包目录。HTTP(S) 和 AI 请求使用环境代理；OCR 语言包由 Tesseract.js 自行下载，受限网络下建议预置本地语言包。

## 库 API

```ts
import { file2text, file2markdown, image2text } from '@idea2app/file2text';

const text = await file2text('./report.pdf');
const remote = await file2text(new URL('https://example.com/report.pdf'));
const ocr = await image2text(imageBuffer);
const markdown = await file2markdown(pdfBuffer, 'google/gemini-2.5-flash');
```

`file2text`、`file2markdown`、`getFileMIME` 接受本地路径、`file:`/HTTP(S) URL（字符串或 `URL`）或 `Buffer`；`image2text` 接受 `Buffer`。同时导出 `makeFileURL` 和 `FileInput` 类型。`file2markdown` 第二个参数也可传 AI SDK 的 `LanguageModel` 实例，使用自行安装的模型 provider；省略时读取 `MEDIA_AI_MODEL`。库不自动加载 `.env` 或修改全局代理，可由调用方配置。远程文件下载后复用内容做 MIME 检测和转换，避免重复请求及依赖远端 HEAD 支持。

## 开发与发布

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run check-format
npm pack --dry-run
```

CI 在 Node.js 22、24、26 上运行。测试使用本地 HTTP 服务和模拟 AI/OCR，不需要密钥或联网下载语言模型。`npm run build` 生成 ESM、类型声明和带 shebang 的 CLI，`npm pack` 自动构建。

`npm run test:ocr` 另行启动真实 OCR worker，识别测试生成的 PNG；需要已缓存的语言模型或允许首次下载的网络。Office 适配层直接依赖安全修复版的底层库，避免上游封装固定的旧版依赖；归属及许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。SheetJS 沿用上游的官方 CDN 发布包，安装时需要能访问 `cdn.sheetjs.com`。

发布前更新 `package.json` 版本并提交锁文件，然后推送匹配的 `v<version>` 标签。发布工作流使用 npm Trusted Publishing/OIDC 和 provenance；维护者需先在 npm 为 `@idea2app/file2text` 配置此仓库的 `publish.yml` 为 trusted publisher（首次发布可手动执行 `npm publish --access public`）。仓库中不存储 API 密钥。
