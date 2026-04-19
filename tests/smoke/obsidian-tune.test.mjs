// obsidian-tune 命令 smoke（批次 26）
//
// 4 case：
//   1. 无 .obsidian/ → 检查模式 exit 1，stderr 含"缺失"
//   2. 有 graph.json 但 filter 缺 _归档 → exit 1，stderr 含 diff
//   3. 有 graph.json 且 filter 完整 → exit 0，stderr 含"完整"
//   4. --write → 备份原文件 + 写入新版 + exit 0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

// 触发 corpus 识别（findCorpus 走 .wiki/ 或 CLAUDE.md）
function makeCorpus(prefix) {
  const dir = mkTmpDir(prefix);
  mkdirSync(join(dir, '.wiki'), { recursive: true });
  return dir;
}

test('case 1: 无 .obsidian/ → exit 1 提示缺失', () => {
  const corpus = makeCorpus('lorekit-smoke-tune-missing-');
  try {
    const args = ['obsidian-tune'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 1, fmtRun(r, args, 'exit 1（filter 缺失）'));
    assert.match(r.stderr, /缺失|不完整/, fmtRun(r, args, 'stderr 应提示缺失'));
    assert.match(r.stderr, /lorekit obsidian-tune --write/, fmtRun(r, args, 'stderr 应给出修复命令'));
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('case 2: filter 不完整（缺 _归档）→ exit 1 + diff', () => {
  const corpus = makeCorpus('lorekit-smoke-tune-partial-');
  try {
    mkdirSync(join(corpus, '.obsidian'), { recursive: true });
    // 故意去掉 -path:"_归档"，模拟批次 25 之前老用户的 filter
    const partial = {
      search:
        '-path:"_工作台" -path:"反馈" -path:"系统" -file:"_INDEX" -file:"index" -file:"log" -file:"MEMORY" -file:"README" -file:"AGENTS" -file:"CLAUDE"',
      showOrphans: true,
    };
    writeFileSync(
      join(corpus, '.obsidian', 'graph.json'),
      JSON.stringify(partial, null, 2),
      'utf-8',
    );

    const args = ['obsidian-tune'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 1, fmtRun(r, args, 'exit 1（filter 不完整）'));
    assert.match(r.stderr, /不完整/, fmtRun(r, args, 'stderr 应提示不完整'));
    assert.match(r.stderr, /_归档/, fmtRun(r, args, 'stderr 应在 diff 中点出 _归档'));
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('case 3: filter 完整 → exit 0', () => {
  const corpus = makeCorpus('lorekit-smoke-tune-complete-');
  try {
    mkdirSync(join(corpus, '.obsidian'), { recursive: true });
    // 直接拿模板的 search 字符串当完整 filter
    const tplSearch =
      '-path:"_工作台" -path:"_归档" -path:"反馈" -path:"系统" -file:"_INDEX" -file:"index" -file:"log" -file:"MEMORY" -file:"README" -file:"AGENTS" -file:"CLAUDE"';
    const complete = {
      search: tplSearch + ' -file:"my-extra"', // 用户额外 filter 不该影响判断
      showOrphans: true,
      colorGroups: [{ query: 'tag:#todo', color: { r: 255, g: 0, b: 0 } }],
    };
    writeFileSync(
      join(corpus, '.obsidian', 'graph.json'),
      JSON.stringify(complete, null, 2),
      'utf-8',
    );

    const args = ['obsidian-tune'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0（filter 完整）'));
    assert.match(r.stderr, /完整/, fmtRun(r, args, 'stderr 应提示完整'));
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('case 4: --write 备份原文件 + 写入新版', () => {
  const corpus = makeCorpus('lorekit-smoke-tune-write-');
  try {
    mkdirSync(join(corpus, '.obsidian'), { recursive: true });
    const original = JSON.stringify({ search: '-file:"old"', showOrphans: false }, null, 2);
    writeFileSync(join(corpus, '.obsidian', 'graph.json'), original, 'utf-8');

    const args = ['obsidian-tune', '--write'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, '--write exit 0'));

    // 备份文件应存在（命名格式 graph.json.bak.<ts>）
    const obsidianDir = join(corpus, '.obsidian');
    const entries = readdirSync(obsidianDir);
    const backups = entries.filter((n) => n.startsWith('graph.json.bak.'));
    assert.equal(backups.length, 1, fmtRun(r, args, '应生成 1 个 graph.json.bak.<ts>'));
    const backupContent = readFileSync(join(obsidianDir, backups[0]), 'utf-8');
    assert.equal(backupContent, original, fmtRun(r, args, '备份内容应与原文件一致'));

    // 新 graph.json 应含完整推荐 token
    const newContent = JSON.parse(readFileSync(join(obsidianDir, 'graph.json'), 'utf-8'));
    for (const needle of ['_工作台', '_归档', '反馈', '系统', '_INDEX', 'CLAUDE']) {
      assert.ok(
        newContent.search.includes(needle),
        fmtRun(r, args, `写入的 search 应含 "${needle}"`),
      );
    }
  } finally {
    cleanupTmpDir(corpus);
  }
});
