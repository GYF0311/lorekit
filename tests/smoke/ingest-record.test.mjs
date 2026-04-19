// 批次 20 / LEGACY P4-1：`lorekit ingest record --wiki-page <path...>` variadic + 多次调用行为锁定。
//
// 复现场景（修复前）：
//   record --wiki-page A --wiki-page B   → wikiPages: [A, B]
//   record --wiki-page B --wiki-page C   → wikiPages: [A, B, B, C]   // B 重复
//
// 修复后：
//   record --wiki-page B --wiki-page C   → wikiPages: [A, B, C]      // 保持首次顺序去重
//
// 批次 20b 追加：`stepsDone` 同模式去重（同文件下另起一条 smoke 锁定）。
//   record --step archive,wiki     → stepsDone: [archive, wiki]
//   record --step wiki,backlink    → stepsDone: [archive, wiki, backlink]   // wiki 不重复

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;
const URL = 'https://example.com/batch-20-variadic';

before(() => {
  corpus = mkTmpDir('lorekit-smoke-ingest-');
  const args = ['init', '.'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
});

after(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('ingest record 多次 --wiki-page 调用对 wikiPages 去重 (P4-1)', () => {
  // 第一次：wikiPages = [A.md, B.md]
  const args1 = ['ingest', 'record', URL, '--wiki-page', 'A.md', '--wiki-page', 'B.md'];
  const r1 = runLorekit(args1, { cwd: corpus });
  assert.equal(r1.status, 0, fmtRun(r1, args1, 'first record exit 0'));

  // 第二次：B.md 重复，C.md 新加 → 期望 wikiPages = [A.md, B.md, C.md]
  const args2 = ['ingest', 'record', URL, '--wiki-page', 'B.md', '--wiki-page', 'C.md'];
  const r2 = runLorekit(args2, { cwd: corpus });
  assert.equal(r2.status, 0, fmtRun(r2, args2, 'second record exit 0'));

  // 直接读 ingest-state.json 验最终状态
  const statePath = join(corpus, '.wiki', 'ingest-state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf-8'));
  const record = state.ingests[URL];
  assert.ok(record, 'ingest record should exist for ' + URL);
  assert.deepEqual(
    record.wikiPages,
    ['A.md', 'B.md', 'C.md'],
    `expected wikiPages [A,B,C] (deduped, first-seen order), got ${JSON.stringify(record.wikiPages)}`,
  );
});

test('ingest record 多次 --step 链式调用对 stepsDone 去重 (批次 20b / P4-1 同模式)', () => {
  // 用独立 URL 隔离前一条 smoke 的状态
  const url = 'https://example.com/batch-20b-stepsdone';

  // 第一次：stepsDone = [archive, wiki]
  const args1 = ['ingest', 'record', url, '--step', 'archive,wiki'];
  const r1 = runLorekit(args1, { cwd: corpus });
  assert.equal(r1.status, 0, fmtRun(r1, args1, 'first record exit 0'));

  // 第二次：wiki 重复，backlink 新加 → 期望 stepsDone = [archive, wiki, backlink]
  const args2 = ['ingest', 'record', url, '--step', 'wiki,backlink'];
  const r2 = runLorekit(args2, { cwd: corpus });
  assert.equal(r2.status, 0, fmtRun(r2, args2, 'second record exit 0'));

  const statePath = join(corpus, '.wiki', 'ingest-state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf-8'));
  const record = state.ingests[url];
  assert.ok(record, 'ingest record should exist for ' + url);
  assert.deepEqual(
    record.stepsDone,
    ['archive', 'wiki', 'backlink'],
    `expected stepsDone [archive,wiki,backlink] (deduped, first-seen order), got ${JSON.stringify(record.stepsDone)}`,
  );
});
