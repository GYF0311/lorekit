// MEMORY.md L0 统计区块的机械刷新：sync 后统计概览/类型分布/最近活跃有真实数字，
// "当前活跃领域"与"指针使用说明"等人工内容保留。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function writePage(rel, type, updated, body) {
  const abs = join(corpus, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  const title = rel.split('/').pop().replace(/\.md$/, '');
  writeFileSync(
    abs,
    [
      '---',
      `type: ${type}`,
      `title: ${title}`,
      `slug: ${rel.replace(/\.md$/, '')}`,
      'created: 2026-01-01',
      `updated: ${updated}`,
      '---',
      '',
      body,
      '',
    ].join('\n'),
    'utf-8',
  );
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-sync-memory-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  writePage('知识库/概念/甲.md', 'concept', '2026-07-01', '链接 [[乙]]。');
  writePage('知识库/概念/乙.md', 'concept', '2026-06-15', '链接 [[甲]]。');
  writePage('知识库/实体/某人.md', 'entity', '2026-05-01', '链接 [[甲]]。');
  // 标记"当前活跃领域"的人工值，验证刷新后保留
  const memPath = join(corpus, 'MEMORY.md');
  const before = readFileSync(memPath, 'utf-8');
  writeFileSync(memPath, before.replace(/当前活跃领域：—/, '当前活跃领域：AI 工具链'), 'utf-8');
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('sync 后 MEMORY.md 统计区块被机械刷新', () => {
  const r = runLorekit(['sync', '--skip-doctor'], { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, ['sync'], 'sync exit 0'));
  assert.match(r.stdout + r.stderr, /MEMORY\.md stats refreshed/);

  const mem = readFileSync(join(corpus, 'MEMORY.md'), 'utf-8');
  assert.match(mem, /- 总页数：3/, '类型目录合计 3 页');
  assert.match(mem, /- 最近更新：2026-07-01/);
  assert.match(mem, /- 当前活跃领域：AI 工具链/, '语义字段应保留人工值');
  assert.match(mem, /\| concept \| 2 \|/);
  assert.match(mem, /\| entity \| 1 \|/);
  assert.match(mem, /- \[\[知识库\/概念\/甲\]\] — 2026-07-01/, '最近活跃按 updated 降序');
  assert.match(mem, /## 指针使用说明/, '非受控 section 保留');
});

test('二次 sync 无变化时不重写（unchanged）', () => {
  const r1 = runLorekit(['sync', '--skip-doctor'], { cwd: corpus });
  assert.equal(r1.status, 0, fmtRun(r1, ['sync'], 'first sync exit 0'));
  const r2 = runLorekit(['sync', '--skip-doctor'], { cwd: corpus });
  assert.equal(r2.status, 0, fmtRun(r2, ['sync'], 'second sync exit 0'));
  assert.match(r2.stdout + r2.stderr, /MEMORY\.md unchanged/);
});
