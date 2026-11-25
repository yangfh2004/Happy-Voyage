import assert from 'node:assert/strict';
import test from 'node:test';
import { renderGuide } from './gameplay-guide.mjs';

test('renders Chinese Markdown and GFM tables in a printable document', () => {
  const html = renderGuide('# 玩法规则\n\n**航海**\n\n| 船型 | 火力 |\n| --- | ---: |\n| 战舰 | 25 |\n\n<script>ignored()</script>');
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /Noto Sans CJK SC/);
  assert.match(html, /<h1>玩法规则<\/h1>/);
  assert.match(html, /<strong>航海<\/strong>/);
  assert.match(html, /<table>[\s\S]*<td>战舰<\/td>[\s\S]*<\/table>/);
  assert.doesNotMatch(html, /<script>|ignored\(\)/);
});

test('uses the guide heading in PDF metadata and the page footer', () => {
  const html = renderGuide('# 欢乐大航海｜配置说明');
  assert.match(html, /<title>欢乐大航海｜配置说明<\/title>/);
  assert.match(html, /content: "欢乐大航海 · 配置说明"/);
});
