import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { configGuide, configJSON } from './generate-config.mjs';

test('the shipped JSON template and Chinese guide match the gameplay schema', async () => {
  assert.equal(await readFile(new URL('config.json', import.meta.url), 'utf8'), configJSON());
  assert.equal(await readFile(new URL('../配置说明.md', import.meta.url), 'utf8'), configGuide());
});
