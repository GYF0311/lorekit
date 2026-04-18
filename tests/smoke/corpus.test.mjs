// Corpus 完整生命周期 smoke：init → doctor → stats → lint → index → vector status → snapshot → restore。
// 一个 corpus 跑全套，子测试共享同一个 tmpdir，after() 清理。
//
// 注意：lorekit init 当前接收绝对路径有 bug（LEGACY P4-6），
// 所以全程用 cwd=tmpdir + `init .` 的方式绕过。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

before(() => {
  corpus = mkTmpDir('lorekit-smoke-corpus-');
  const args = ['init', '.'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
});

after(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('init 创建期望的 schema 文件与子目录', () => {
  const expected = ['CLAUDE.md', 'AGENTS.md', '原料', '知识库', '.wiki', 'index.md', 'log.md'];
  for (const sub of expected) {
    assert.ok(existsSync(join(corpus, sub)), `expected ${sub} in ${corpus}`);
  }
});

test('doctor 在新 init 的 corpus 下退出码 0', () => {
  const args = ['doctor'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
});

test('stats 退出码 0 且 stdout 是合法 JSON', () => {
  const args = ['stats'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
  let parsed;
  assert.doesNotThrow(() => { parsed = JSON.parse(r.stdout); }, fmtRun(r, args, 'stdout 是合法 JSON'));
  assert.ok('total_pages' in parsed, fmtRun(r, args, 'JSON 含 total_pages'));
  assert.ok('by_type' in parsed, fmtRun(r, args, 'JSON 含 by_type'));
});

test('lint 在新 init 的 corpus 下退出码 0', () => {
  // 如果此项 fail：模板 (templates/default-corpus) 自身有 lint 问题（broken link / 缺 frontmatter），
  // 应该修模板而不是放宽 smoke 断言。
  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 (空 corpus 无问题)'));
});

test('index 退出码 0', () => {
  const args = ['index'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
});

test('vector status 退出码 0，stdout JSON 含 mode + indexed', () => {
  const args = ['vector', 'status'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
  let parsed;
  assert.doesNotThrow(() => { parsed = JSON.parse(r.stdout); }, fmtRun(r, args, 'stdout 是合法 JSON'));
  assert.ok('mode' in parsed, fmtRun(r, args, 'JSON 含 mode'));
  assert.ok(['text', 'vector'].includes(parsed.mode), fmtRun(r, args, `mode ∈ {text,vector}, 实际 ${parsed.mode}`));
  assert.ok('indexed' in parsed, fmtRun(r, args, 'JSON 含 indexed'));
  // indexed_files 仅在 indexed=true 时填，新 init 的 corpus 还没建向量库 → 不强求
  if (parsed.indexed === true) {
    assert.ok('indexed_files' in parsed, fmtRun(r, args, 'indexed=true 时应有 indexed_files'));
  }
});

test('snapshot 产出 .tar.gz', () => {
  const args = ['snapshot'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
  const snapDir = join(corpus, '.wiki', 'snapshots');
  const tarballs = readdirSync(snapDir).filter((n) => n.endsWith('.tar.gz'));
  assert.ok(tarballs.length > 0, fmtRun(r, args, `${snapDir} 应有 .tar.gz`));
});

test('restore --from <tarball> 在无变更时退出码 0', () => {
  const snapDir = join(corpus, '.wiki', 'snapshots');
  const tarballs = readdirSync(snapDir).filter((n) => n.endsWith('.tar.gz')).sort();
  const tarball = join(snapDir, tarballs[tarballs.length - 1]);
  const args = ['restore', '--from', tarball];
  const r = runLorekit(args, { cwd: corpus });
  // restore 在 "corpus matches snapshot" 时立即返回，无 prompt → 不会卡
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 (无变更)'));
});
