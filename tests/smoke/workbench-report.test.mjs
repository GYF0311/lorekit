// `lorekit workbench report`：triage 候选账单的确定性生成（只读）。
// 活跃目录整体跳过、噪音层固定排除、账龄阈值过滤。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function writeAged(rel, ageDays) {
  const abs = join(corpus, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, `内容 ${rel}`, 'utf-8');
  const t = new Date(Date.now() - ageDays * 86_400_000);
  utimesSync(abs, t, t);
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-workbench-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  writeAged('_工作台/草稿/旧手册.md', 90); // 候选
  writeAged('_工作台/收件/旧逐字稿.md', 60); // 候选
  writeAged('_工作台/课件准备/旧素材.md', 100); // 目录活跃 → 跳过
  writeAged('_工作台/课件准备/今天的稿.md', 1); //   ↑ 让目录活跃
  writeAged('_工作台/转写/老转写.md', 200); // 噪音层固定排除
  writeAged('_工作台/草稿/上周的稿.md', 7); // 未到账龄
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('report --json：候选/活跃目录/排除层各归其位，命令只读', () => {
  const r = runLorekit(['workbench', 'report', '--json'], { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, ['workbench', 'report'], 'exit 0'));
  const report = JSON.parse(r.stdout);

  assert.deepEqual(
    report.candidates.map((c) => c.path),
    ['_工作台/草稿/旧手册.md', '_工作台/收件/旧逐字稿.md'],
    '按账龄降序，仅含到期且非活跃目录的文件',
  );
  assert.equal(report.candidates[0].ageDays >= 89, true);

  assert.deepEqual(
    report.activeDirs.map((d) => d.dir),
    ['_工作台/课件准备'],
    '14 天内动过的目录整体跳过',
  );
  assert.equal(report.activeDirs[0].skippedFiles, 2, '活跃目录里的老文件也一并跳过');

  assert.equal(
    report.excluded.some((e) => e.prefix === '_工作台/转写' && e.files === 1),
    true,
    '转写层固定排除并报数',
  );
  // 上周的稿.md + init 模板自带的 _工作台/README.md
  assert.equal(report.freshFiles, 2, '未到账龄的文件计数');
});

test('阈值可调：--stale-days 5 把上周的稿也纳入候选', () => {
  const r = runLorekit(['workbench', 'report', '--json', '--stale-days', '5'], { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, ['workbench', 'report', '--stale-days', '5'], 'exit 0'));
  const report = JSON.parse(r.stdout);
  assert.equal(
    report.candidates.some((c) => c.path === '_工作台/草稿/上周的稿.md'),
    true,
  );
});

test('非法阈值参数 exit 2', () => {
  const r = runLorekit(['workbench', 'report', '--stale-days', 'abc'], { cwd: corpus });
  assert.equal(r.status, 2, fmtRun(r, ['workbench', 'report', '--stale-days', 'abc'], 'exit 2'));
});
