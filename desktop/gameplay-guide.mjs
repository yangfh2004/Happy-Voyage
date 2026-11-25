import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { Marked } from 'marked';

const markdownRenderer = new Marked({ gfm: true, renderer: { html: () => '' } });

export function renderGuide(markdown) {
  const title = /^# (.+)$/m.exec(markdown)?.[1].trim() ?? '欢乐大航海';
  const htmlTitle = title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const footer = JSON.stringify(`欢乐大航海 · ${title.split('｜').at(-1)}`).replaceAll('<', '\\3c ');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri https://github.com">
  <base href="https://github.com/yangfh2004/Happy-Voyage/blob/main/">
  <title>${htmlTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 16mm 19mm;
      @bottom-left { content: ${footer}; color: #436277; font-size: 8.5pt; }
      @bottom-right { content: counter(page) ' / ' counter(pages); color: #436277; font-size: 8.5pt; }
    }
    html {
      color: #152d3e;
      font: 10.5pt/1.65 "Noto Sans CJK SC", "Noto Sans SC", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { margin: 0; }
    h1, h2, h3, h4 { line-height: 1.35; break-after: avoid; }
    h1 { padding: 9mm 6mm; margin: 0 0 6mm; background: #102d44; color: #fff1d0; border-bottom: 2mm solid #c4924f; font-size: 21pt; }
    h2 { margin: 7mm 0 3mm; padding: 2mm 3mm; background: #ecf4f4; border-left: 1.2mm solid #217e83; font-size: 14pt; }
    h3 { margin: 5mm 0 2mm; font-size: 12pt; color: #165e62; }
    p, ul, ol { margin: 0 0 3mm; orphans: 3; widows: 3; }
    ul, ol { padding-inline-start: 6mm; }
    li { margin-bottom: 1.7mm; }
    li > p { margin-bottom: 0; }
    strong { color: #102d44; }
    a { color: #16656e; }
    table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 3mm 0 5mm; }
    thead { display: table-header-group; background: #214862; color: white; }
    tr { break-inside: avoid; }
    tbody tr:nth-child(even) { background: #f0f5f5; }
    td, th { border: 0.2mm solid #bacbd0; padding: 1.2mm 1.6mm; text-align: start; overflow-wrap: anywhere; }
  </style>
</head>
<body><main>
${markdownRenderer.parse(markdown)}
</main></body>
</html>`;
}

async function printGuide(input, output) {
  const html = renderGuide(await readFile(input, 'utf8'));
  const directory = await mkdtemp(join(tmpdir(), 'happy-voyage-guide-'));
  try {
    const page = join(directory, 'guide.html');
    const pdf = join(directory, 'guide.pdf');
    await writeFile(page, html, 'utf8');
    await promisify(execFile)(process.env.CHROME_BIN || 'google-chrome', [
      '--headless', '--disable-background-networking', '--no-first-run', '--no-pdf-header-footer',
      `--user-data-dir=${join(directory, 'chrome')}`, `--print-to-pdf=${pdf}`, pathToFileURL(page).href,
    ], { timeout: 60_000 });
    if (!(await readFile(pdf)).subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new Error('Chrome did not produce a PDF');
    }
    await copyFile(pdf, output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node gameplay-guide.mjs <GAMEPLAY.md> <output.pdf>');
  await printGuide(input, output);
}
