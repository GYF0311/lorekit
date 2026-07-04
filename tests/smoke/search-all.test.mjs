// 两级召回：`search --all` 把过程区（工作台/归档等）纳入召回，
// 但仍排除噪音层（.wiki/.git/_工作台/转写）；与 --dir 互斥。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function writeMd(rel, body) {
  const abs = join(corpus, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body, 'utf-8');
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-search-all-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  writeMd('知识库/概念/canonical.md', 'MAGICWORD in canonical page');
  writeMd('_工作台/草稿/draft.md', 'MAGICWORD in workbench draft');
  writeMd('_归档/old-project.md', 'MAGICWORD in archive');
  writeMd('_工作台/转写/2026-07-01.md', 'MAGICWORD in raw transcript');
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

function hitFiles(r) {
  return r.stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l).file)
    .sort();
}

test('默认 search 只召回 durable 层', () => {
  const r = runLorekit(['search', 'MAGICWORD'], { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, ['search'], 'exit 0'));
  assert.deepEqual(hitFiles(r), ['知识库/概念/canonical.md']);
});

test('--all 纳入工作台与归档，仍排除转写', () => {
  const r = runLorekit(['search', 'MAGICWORD', '--all'], { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, ['search', '--all'], 'exit 0'));
  assert.deepEqual(hitFiles(r), [
    '_工作台/草稿/draft.md',
    '_归档/old-project.md',
    '知识库/概念/canonical.md',
  ]);
});

test('点名 --dir 可以进转写目录', () => {
  const r = runLorekit(['search', 'MAGICWORD', '--dir', '_工作台/转写'], { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, ['search', '--dir', '_工作台/转写'], 'exit 0'));
  assert.deepEqual(hitFiles(r), ['_工作台/转写/2026-07-01.md']);
});

test('--all 与 --dir 互斥，参数错退出码 2', () => {
  const r = runLorekit(['search', 'MAGICWORD', '--all', '--dir', '知识库'], { cwd: corpus });
  assert.equal(r.status, 2, fmtRun(r, ['search', '--all', '--dir'], 'exit 2'));
});
