// CLI 元命令 + 错误路径 smoke。
// 不创建 corpus，只测 --version / --help 与几条参数 / 上下文错误。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun, VERSION, hasSqliteVec } from './_util.mjs';

test('lorekit --version 输出 VERSION 文件内容', () => {
  const args = ['--version'];
  const r = runLorekit(args);
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
  assert.equal(r.stdout.trim(), VERSION, fmtRun(r, args, `stdout == ${VERSION}`));
});

test('lorekit --help 退出码 0', () => {
  const args = ['--help'];
  const r = runLorekit(args);
  assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
  assert.match(r.stdout, /lorekit/i, fmtRun(r, args, 'stdout 含 "lorekit"'));
});

test('参数错误：lorekit install-skills 不传 --target → exit 2', () => {
  // install-skills.ts 显式 process.exit(2) when --target 缺失，符合 CONVENTIONS #4
  const args = ['install-skills'];
  const r = runLorekit(args);
  assert.equal(r.status, 2, fmtRun(r, args, 'exit 2 (参数错)'));
});

test('上下文错误：在非 corpus 目录跑 doctor → exit 1', () => {
  const tmp = mkTmpDir('lorekit-smoke-non-corpus-');
  try {
    const args = ['doctor'];
    const r = runLorekit(args, { cwd: tmp });
    // requireCorpus throws，commander 不 catch → Node uncaught → exit 1
    assert.equal(r.status, 1, fmtRun(r, args, 'exit 1 (非 corpus)'));
    assert.match(
      r.stderr,
      /not inside a corpus/,
      fmtRun(r, args, 'stderr 含 "not inside a corpus"'),
    );
  } finally {
    cleanupTmpDir(tmp);
  }
});

test('vector query 无 sqlite-vec 时报错（当前装了就跳过）', async (t) => {
  if (await hasSqliteVec()) {
    t.skip('sqlite-vec 已安装，无法在本机复现"缺依赖"路径');
    return;
  }
  // 走到这里说明 sqlite-vec 真的不可加载——补充一个 corpus 然后跑 vector query
  const tmp = mkTmpDir('lorekit-smoke-no-vec-');
  try {
    runLorekit(['init', '.'], { cwd: tmp });
    const args = ['vector', 'query', '--text', 'foo'];
    const r = runLorekit(args, { cwd: tmp });
    assert.notEqual(r.status, 0, fmtRun(r, args, 'exit != 0 (缺 sqlite-vec)'));
    assert.match(r.stderr, /sqlite-vec/i, fmtRun(r, args, 'stderr 提示 sqlite-vec'));
  } finally {
    cleanupTmpDir(tmp);
  }
});
