// readonly / 简单命令 smoke：audit / install-skills / search。
// corpus.test.mjs 已覆盖 init/doctor/stats/lint/index/snapshot/restore 生命周期；
// 这三个命令此前缺独立 smoke（CONVENTIONS §11 要求新命令配套 smoke），本文件回填。
//
// 通用约束：
// - audit / search 都要在 corpus 内跑，用 cwd=tmpdir + `init .` 绕过 init 绝对路径 bug
// - install-skills 走 HOME 覆盖（process.env.HOME 是 install-skills.ts 内唯一目标根），
//   避免污染用户真实 ~/.claude/skills/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

// ---------------------------------------------------------------------------
// audit：list / create / re-list 闭环
// ---------------------------------------------------------------------------

test('audit lifecycle: 空 list → create → 再 list 看到新条目', () => {
  const corpus = mkTmpDir('lorekit-smoke-audit-');
  try {
    {
      const args = ['init', '.'];
      const r = runLorekit(args, { cwd: corpus });
      assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
    }

    // 空 corpus：audit --list 应 exit 0 + 提示 "No audit entries found."
    {
      const args = ['audit', '--list'];
      const r = runLorekit(args, { cwd: corpus });
      assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 (空 corpus)'));
      // print() 走 stderr（logger.ts），不在 stdout
      assert.match(r.stderr, /No audit entries found/, fmtRun(r, args, '提示空列表'));
    }

    // 创建一条 audit
    {
      const args = [
        'audit',
        '--create',
        '--target',
        '知识库/概念/test.md',
        '--severity',
        'low',
        '--text',
        'smoke audit entry',
      ];
      const r = runLorekit(args, { cwd: corpus });
      assert.equal(r.status, 0, fmtRun(r, args, 'create exit 0'));
      // ok() 走 stderr
      assert.match(r.stderr, /created:.*反馈\/待处理\//, fmtRun(r, args, 'stderr 含 created 路径'));
      // 物理验证：反馈/待处理/ 下应有一个 .md
      const pendingDir = join(corpus, '反馈', '待处理');
      const entries = readdirSync(pendingDir).filter((n) => n.endsWith('.md'));
      assert.ok(entries.length >= 1, `expected at least one .md in ${pendingDir}, got ${entries.join(',')}`);
    }

    // 再 list 应看到这条
    {
      const args = ['audit', '--list'];
      const r = runLorekit(args, { cwd: corpus });
      assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 (有条目)'));
      assert.match(r.stderr, /smoke audit entry/, fmtRun(r, args, '列出 preview 含原 text'));
      assert.match(r.stderr, /\[low\]/, fmtRun(r, args, '列出 severity'));
      assert.match(r.stderr, /Total: 1 entries/, fmtRun(r, args, 'Total 计数 1'));
    }

    // 参数缺失路径
    {
      const args = ['audit', '--create', '--target', 'foo.md'];
      const r = runLorekit(args, { cwd: corpus });
      assert.equal(r.status, 2, fmtRun(r, args, 'exit 2 (缺 --severity / --text)'));
    }
  } finally {
    cleanupTmpDir(corpus);
  }
});

// ---------------------------------------------------------------------------
// install-skills：参数校验 + happy path（HOME 覆盖到 tmpdir，零污染）
// ---------------------------------------------------------------------------

test('install-skills 拒绝路径：unknown target → exit 2 提示 only claude-code', () => {
  const fakeHome = mkTmpDir('lorekit-smoke-home-');
  try {
    const args = ['install-skills', '--target', 'unknown-agent'];
    const r = runLorekit(args, { env: { HOME: fakeHome } });
    assert.equal(r.status, 2, fmtRun(r, args, 'exit 2 (unknown target)'));
    assert.match(r.stderr, /only 'claude-code'/, fmtRun(r, args, 'stderr 提示 only claude-code'));
  } finally {
    cleanupTmpDir(fakeHome);
  }
});

test('install-skills happy path：--target claude-code 在 fakeHome 下建 wiki-* 软链', () => {
  const fakeHome = mkTmpDir('lorekit-smoke-home-');
  try {
    const args = ['install-skills', '--target', 'claude-code'];
    const r = runLorekit(args, { env: { HOME: fakeHome } });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
    const skillsDir = join(fakeHome, '.claude', 'skills');
    assert.ok(existsSync(skillsDir), `expected ${skillsDir} to exist`);
    const installed = readdirSync(skillsDir).filter((n) => n.startsWith('wiki-'));
    assert.ok(installed.length > 0, fmtRun(r, args, `expected wiki-* skills in ${skillsDir}`));
    // 至少一个应该是软链
    const first = installed[0];
    assert.ok(
      lstatSync(join(skillsDir, first)).isSymbolicLink(),
      fmtRun(r, args, `${first} 应该是 symlink`),
    );

    // --list 子模式回放，应能看到刚才装的
    const listArgs = ['install-skills', '--list'];
    const r2 = runLorekit(listArgs, { env: { HOME: fakeHome } });
    assert.equal(r2.status, 0, fmtRun(r2, listArgs, '--list exit 0'));
    assert.match(r2.stdout, /wiki-/, fmtRun(r2, listArgs, 'stdout 含 wiki-* 项'));
  } finally {
    cleanupTmpDir(fakeHome);
  }
});

// ---------------------------------------------------------------------------
// search：本地 .md 写入关键字 → search 命中（JSON 输出含 file 路径）
// ---------------------------------------------------------------------------

test('search happy path：本地 .md 关键字命中', () => {
  const corpus = mkTmpDir('lorekit-smoke-search-');
  try {
    {
      const args = ['init', '.'];
      const r = runLorekit(args, { cwd: corpus });
      assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
    }

    // 在 知识库/概念/ 下写一个含 needle 的 .md
    // needle 用低概率字符串避免命中模板 / .obsidian 配置内的字面量
    const needle = 'lorekit-smoke-needle-9X7A';
    const conceptDir = join(corpus, '知识库', '概念');
    mkdirSync(conceptDir, { recursive: true });
    const filePath = join(conceptDir, 'searchme.md');
    writeFileSync(
      filePath,
      `---
type: concept
title: searchme
slug: searchme
created: 2026-05-14
updated: 2026-05-14
---

# searchme

测试页：${needle}
`,
      'utf-8',
    );

    const args = ['search', needle];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));
    // search 通过 out() 走 stdout，每行一个 JSON
    const lines = r.stdout.split('\n').filter(Boolean);
    assert.ok(lines.length >= 1, fmtRun(r, args, 'stdout 至少一行 JSON'));
    let parsed;
    assert.doesNotThrow(
      () => {
        parsed = JSON.parse(lines[0]);
      },
      fmtRun(r, args, 'stdout 第一行是合法 JSON'),
    );
    assert.ok('file' in parsed, fmtRun(r, args, 'JSON 含 file 字段'));
    assert.match(parsed.file, /searchme\.md$/, fmtRun(r, args, `file 指向 searchme.md, 实际 ${parsed.file}`));
    assert.ok('line' in parsed, fmtRun(r, args, 'JSON 含 line 字段'));
  } finally {
    cleanupTmpDir(corpus);
  }
});
