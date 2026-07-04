// stale-review：domain_volatility + last_reviewed 复审窗口检查。
// 软性提示：到期页出现在报告里但不计入 hard fail（exit 0）。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function writePage(rel, extraFm, body) {
  const abs = join(corpus, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  const title = rel.split('/').pop().replace(/\.md$/, '');
  writeFileSync(
    abs,
    [
      '---',
      'type: concept',
      `title: ${title}`,
      `slug: ${rel.replace(/\.md$/, '')}`,
      `created: ${daysAgo(300)}`,
      `updated: ${daysAgo(300)}`,
      ...extraFm,
      '---',
      '',
      body,
      '',
    ].join('\n'),
    'utf-8',
  );
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-lint-stale-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  // 互链避免 orphan（本测试只关心 stale-review）
  writePage(
    '知识库/概念/stale-high.md',
    ['domain_volatility: high', `last_reviewed: ${daysAgo(200)}`],
    '链接 [[fresh-low]]。',
  );
  writePage(
    '知识库/概念/fresh-low.md',
    ['domain_volatility: low', `last_reviewed: ${daysAgo(30)}`],
    '链接 [[stale-high]] 和 [[fallback-updated]]。',
  );
  // 无 last_reviewed：回退 updated（300 天前）+ medium(180d) → 应报 stale
  writePage('知识库/概念/fallback-updated.md', ['domain_volatility: medium'], '链接 [[stale-high]]。');
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('复审到期页被报告为软性提示，exit 0', () => {
  const r = runLorekit(['lint'], { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, ['lint'], 'stale-review 是软性提示，不该 fail'));

  const text = r.stdout + r.stderr;
  assert.match(text, /stale reviews/, 'stale reviews 分组应出现');
  assert.match(text, /stale-high\.md: review overdue: volatility=high window=90d/);
  assert.match(text, /fallback-updated\.md: review overdue: volatility=medium window=180d/);
  assert.doesNotMatch(text, /fresh-low\.md: review overdue/, '窗口内的页不该被报');
});

test('模板占位符与无 volatility 页不参与 stale 检查', () => {
  // init 自带的 知识库/模板/*（含 {{YYYY-MM-DD}} 占位符）不应产生 stale-review
  const r = runLorekit(['lint'], { cwd: corpus });
  const text = r.stdout + r.stderr;
  assert.doesNotMatch(text, /模板.*review overdue/);
});
