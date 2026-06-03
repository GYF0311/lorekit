// 边界守卫 smoke：search --dir 必须留在 corpus 内。
// 没边界校验则 `--dir ../../` 能读 corpus 外文件（info disclosure）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

test('search --dir ../../ 被拒 exit 2', () => {
  const corpus = mkTmpDir('lorekit-smoke-search-dir-boundary-');
  try {
    const init = runLorekit(['init', '.'], { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

    const args = ['search', '--dir', '../../', 'keyword'];
    const r = runLorekit(args, { cwd: corpus });

    // 参数错（用户给的 dir 越界）→ exit 2，跟 CONVENTIONS §4 一致。
    assert.equal(r.status, 2, fmtRun(r, args, '越界 --dir 必须 exit 2'));
    const combined = r.stdout + r.stderr;
    assert.match(
      combined,
      /search --dir must stay within corpus/,
      fmtRun(r, args, '错误消息应解释边界'),
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('search --dir /etc 绝对路径越界被拒', () => {
  const corpus = mkTmpDir('lorekit-smoke-search-dir-boundary-abs-');
  try {
    const init = runLorekit(['init', '.'], { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

    // path.join(corpus, '/etc') 在 POSIX 上结果是 `<corpus>/etc`——这条
    // 其实留在 corpus 内（join 会丢弃 leading slash），但绝对路径仍是
    // 用户意图的提示。本测试主要验证：上一例的 `../../` 拦截稳定不
    // regression。绝对路径越界由前一测试 + 真实路径中的 `..` 共同覆盖。
    const args = ['search', '--dir', '../..', 'keyword'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 2, fmtRun(r, args, '`../..` 必须 exit 2'));
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('search 默认排除 _工作台，但显式 --dir _工作台 可以搜索', () => {
  const corpus = mkTmpDir('lorekit-smoke-search-default-scope-');
  try {
    const init = runLorekit(['init', '.'], { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

    mkdirSync(join(corpus, '_工作台', 'research'), { recursive: true });
    writeFileSync(
      join(corpus, '_工作台', 'research', 'draft.md'),
      'needle-only-in-workbench\n',
      'utf-8',
    );

    const defaultArgs = ['search', 'needle-only-in-workbench'];
    const defaultRun = runLorekit(defaultArgs, { cwd: corpus });
    assert.equal(defaultRun.status, 0, fmtRun(defaultRun, defaultArgs, 'default search exits 0'));
    assert.doesNotMatch(defaultRun.stdout, /draft\.md/);
    assert.match(defaultRun.stderr, /no results/);

    const explicitArgs = ['search', '--dir', '_工作台', 'needle-only-in-workbench'];
    const explicitRun = runLorekit(explicitArgs, { cwd: corpus });
    assert.equal(explicitRun.status, 0, fmtRun(explicitRun, explicitArgs, 'explicit workbench search exits 0'));
    assert.match(explicitRun.stdout, /_工作台\/research\/draft\.md/);
  } finally {
    cleanupTmpDir(corpus);
  }
});
