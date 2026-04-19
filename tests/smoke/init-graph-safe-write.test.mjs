// init safe-write for `.obsidian/graph.json`（批次 25）
//
// 场景：用户原 corpus 已有 .obsidian/graph.json（带自定义 colorGroups / forceGravity 等），
// lorekit init 不允许覆盖——必须保留原内容并给 stderr 打警告。
// 参照 corpus.test.mjs 用 cwd=tmpdir + `init .` 的方式绕开 LEGACY P4-6 绝对路径 bug。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;
const FAKE_USER_GRAPH = JSON.stringify(
  {
    search: '-file:"custom-user-setting"',
    colorGroups: [{ query: 'tag:#todo', color: { r: 255, g: 0, b: 0 } }],
    showOrphans: false,
  },
  null,
  2,
);

before(() => {
  corpus = mkTmpDir('lorekit-smoke-graph-safe-');
  // 预先伪造一个用户自定义的 .obsidian/graph.json
  mkdirSync(join(corpus, '.obsidian'), { recursive: true });
  writeFileSync(join(corpus, '.obsidian', 'graph.json'), FAKE_USER_GRAPH, 'utf-8');
});

after(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('init 不覆盖用户既有 .obsidian/graph.json 并给 stderr 提示', () => {
  const args = ['init', '.', '--in-place'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));

  // graph.json 必须完全没变（safe-write 生效）
  const after = readFileSync(join(corpus, '.obsidian', 'graph.json'), 'utf-8');
  assert.equal(
    after,
    FAKE_USER_GRAPH,
    fmtRun(r, args, '用户 graph.json 内容必须保持不变（safe-write）'),
  );

  // stderr 必须有跳过提示（关键词：graph.json 已存在 / 跳过）
  assert.match(
    r.stderr,
    /graph\.json.*已存在|已存在.*graph\.json/,
    fmtRun(r, args, 'stderr 应提示 graph.json 已存在跳过'),
  );

  // obsidian-audit 插件仍然会部署（它在子目录，不受 graph.json 影响）
  assert.ok(
    existsSync(join(corpus, '.obsidian', 'plugins', 'lorekit-audit')),
    fmtRun(r, args, 'obsidian-audit 插件仍然正常部署'),
  );
});

test('init 在无 .obsidian 的新 corpus 下会创建推荐 graph.json', () => {
  const fresh = mkTmpDir('lorekit-smoke-graph-fresh-');
  try {
    const args = ['init', '.'];
    const r = runLorekit(args, { cwd: fresh });
    assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));

    const graphPath = join(fresh, '.obsidian', 'graph.json');
    assert.ok(existsSync(graphPath), fmtRun(r, args, '新 corpus 应有 .obsidian/graph.json'));

    const content = JSON.parse(readFileSync(graphPath, 'utf-8'));
    // 批次 25 约定的 11 项排除都要出现（_工作台 / _归档 / 反馈 / 系统 + 根元数据文件）
    const s = content.search;
    for (const needle of [
      '_工作台',
      '_归档',
      '反馈',
      '系统',
      '_INDEX',
      'index',
      'log',
      'MEMORY',
      'README',
      'AGENTS',
      'CLAUDE',
    ]) {
      assert.ok(s.includes(needle), fmtRun(r, args, `graph.json search 应含 "${needle}"`));
    }
  } finally {
    cleanupTmpDir(fresh);
  }
});
