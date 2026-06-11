// issue #18 problem 2 — `lorekit links` closure 子命令：suggest/fix/stub/backlog/plain。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function writePage(rel, fmTitle, slug, body) {
  const abs = join(corpus, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(
    abs,
    [
      '---',
      'type: concept',
      `title: ${fmTitle}`,
      `slug: ${slug}`,
      'created: 2026-06-11',
      'updated: 2026-06-11',
      '---',
      '',
      body,
      '',
    ].join('\n'),
    'utf-8',
  );
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-links-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  writePage(
    '知识库/概念/Source.md',
    'Source',
    '知识库/概念/source',
    [
      '未建节点：[[未建节点]]',
      '一次性提及：[[一次性概念]]',
      '路径漂移：[[旧名]]',
    ].join('\n'),
  );
  writePage('知识库/概念/RealPage.md', 'RealPage', '知识库/概念/RealPage', '真实存在的 canonical 页。');
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('links suggest reports broken links as JSON and exits 1', () => {
  const args = ['links', 'suggest', '--file', '知识库/概念/Source.md', '--json'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 1, fmtRun(r, args, 'broken links present → exit 1'));
  const result = JSON.parse(r.stdout.trim());
  const links = result.pages[0].broken.map((b) => b.link);
  assert.ok(links.includes('未建节点'), fmtRun(r, args, '未建节点 should be broken'));
});

test('links suggest --write-state writes .wiki/links-state.json', () => {
  const args = ['links', 'suggest', '--file', '知识库/概念/Source.md', '--write-state'];
  runLorekit(args, { cwd: corpus });
  const statePath = join(corpus, '.wiki', 'links-state.json');
  assert.ok(existsSync(statePath), fmtRun({ stdout: '', stderr: '' }, args, 'state file written'));
  const state = JSON.parse(readFileSync(statePath, 'utf-8'));
  assert.ok(state.pages['知识库/概念/Source.md'], 'state keyed by page rel');
});

test('links stub creates a placeholder page so the link resolves', () => {
  const args = ['links', 'stub', '未建节点', '--type', 'concept', '--source', '知识库/概念/Source.md'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'stub exit 0'));
  const pagePath = join(corpus, '知识库/概念/未建节点.md');
  assert.ok(existsSync(pagePath), 'stub page created');
  const content = readFileSync(pagePath, 'utf-8');
  assert.match(content, /type: concept/, 'stub has type');
  assert.match(content, /stub: true/, 'stub marked');
  assert.match(content, /\[\[知识库\/概念\/Source\]\]/, 'stub has backref to source');

  // 建 stub 后，suggest 不再把 [[未建节点]] 报 broken
  const s = runLorekit(['links', 'suggest', '--file', '知识库/概念/Source.md', '--json'], { cwd: corpus });
  const links = JSON.parse(s.stdout.trim()).pages[0].broken.map((b) => b.link);
  assert.ok(!links.includes('未建节点'), 'resolved after stub');
});

test('links stub is idempotent (second call does not overwrite)', () => {
  const a = ['links', 'stub', '未建节点', '--type', 'concept', '--source', '知识库/概念/Source.md'];
  runLorekit(a, { cwd: corpus });
  const r = runLorekit(a, { cwd: corpus });
  const result = JSON.parse(r.stdout.trim());
  assert.equal(result.created, false, fmtRun(r, a, 'second stub call → created:false'));
});

test('links backlog records to 系统/missing-nodes.md, idempotent', () => {
  const args = ['links', 'backlog', '待建概念', '--type', 'concept', '--source', '知识库/概念/Source.md', '--reason', '本次不值得建页'];
  const r1 = runLorekit(args, { cwd: corpus });
  assert.equal(r1.status, 0, fmtRun(r1, args, 'backlog exit 0'));
  const mn = join(corpus, '系统/missing-nodes.md');
  assert.ok(existsSync(mn), 'missing-nodes.md created');
  const content = readFileSync(mn, 'utf-8');
  assert.match(content, /graph-excluded: true/, 'missing-nodes is graph-excluded');
  assert.match(content, /\| 待建概念 \| concept \|/, 'row recorded');

  const r2 = runLorekit(args, { cwd: corpus });
  assert.equal(JSON.parse(r2.stdout.trim()).added, false, 'idempotent: second backlog added:false');
});

test('links plain downgrades [[label]] to plain text', () => {
  const args = ['links', 'plain', '一次性概念', '--file', '知识库/概念/Source.md'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'plain exit 0'));
  const content = readFileSync(join(corpus, '知识库/概念/Source.md'), 'utf-8');
  assert.doesNotMatch(content, /\[\[一次性概念\]\]/, 'wikilink removed');
  assert.match(content, /一次性提及：一次性概念/, 'plain text retained');
});

test('links fix repoints [[label]] and registers an alias', () => {
  const args = [
    'links', 'fix', '旧名',
    '--to', '知识库/概念/RealPage',
    '--file', '知识库/概念/Source.md',
    '--alias', '旧名',
  ];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'fix exit 0'));
  const src = readFileSync(join(corpus, '知识库/概念/Source.md'), 'utf-8');
  assert.match(src, /\[\[知识库\/概念\/RealPage\]\]/, 'link repointed');
  assert.doesNotMatch(src, /\[\[旧名\]\]/, 'old label gone');
  const canon = readFileSync(join(corpus, '知识库/概念/RealPage.md'), 'utf-8');
  assert.match(canon, /aliases: \[旧名\]/, 'alias registered in canonical frontmatter');
});

test('links refuses to edit read-only 原料/ files', () => {
  mkdirSync(join(corpus, '原料'), { recursive: true });
  writeFileSync(join(corpus, '原料/raw.md'), 'raw [[旧名]] mention\n', 'utf-8');
  const args = ['links', 'plain', '旧名', '--file', '原料/raw.md'];
  const r = runLorekit(args, { cwd: corpus });
  assert.notEqual(r.status, 0, fmtRun(r, args, 'editing 原料 must be refused'));
  assert.match(r.stderr, /read-only raw source/, 'refusal message');
});

// 缺陷 1 修复：plain 降级必须可恢复 —— 台账记录降级，目标页建好后提醒重连，重连后自动了结。
// 没有这个闭环，`[[label]]`→纯文本就是永久信息丢失。
test('links plain is recoverable: ledger → revivable after node creation → pruned after re-link', () => {
  runLorekit(['links', 'plain', '一次性概念', '--file', '知识库/概念/Source.md'], { cwd: corpus });

  // 1) 台账有记录，目标页还不存在 → pending
  let r = runLorekit(['links', 'plained', '--json'], { cwd: corpus });
  let entries = JSON.parse(r.stdout.trim()).plained;
  assert.equal(entries.length, 1, fmtRun(r, ['links', 'plained'], 'one ledger entry'));
  assert.equal(entries[0].status, 'pending', 'target missing → pending');

  // 2) 建出目标页 → revivable（提醒 AI 重连）
  writePage('知识库/概念/一次性概念.md', '一次性概念', '知识库/概念/一次性概念', '后来还是建了。');
  r = runLorekit(['links', 'plained', '--json'], { cwd: corpus });
  entries = JSON.parse(r.stdout.trim()).plained;
  assert.equal(entries[0].status, 'revivable', 'target exists → revivable');

  // 3) AI 重连（文本重新包回 [[label]]）→ 条目自动清出台账
  const srcPath = join(corpus, '知识库/概念/Source.md');
  const src = readFileSync(srcPath, 'utf-8').replace('一次性提及：一次性概念', '一次性提及：[[一次性概念]]');
  writeFileSync(srcPath, src, 'utf-8');
  r = runLorekit(['links', 'plained', '--json'], { cwd: corpus });
  entries = JSON.parse(r.stdout.trim()).plained;
  assert.equal(entries.length, 0, fmtRun(r, ['links', 'plained'], 're-linked entry pruned'));
});

// 缺陷 2 修复：backlog 必须真闭环 —— 登记后 lint 不再把该断链计入失败（否则 backlog 只是把噪音搬了个家）。
test('lint downgrades backlogged labels and excludes them from the failure count', () => {
  const countOf = (stderr) => {
    const m = stderr.match(/(\d+) issue\(s\) total/);
    assert.ok(m, `lint output should contain issue count, got: ${stderr}`);
    return Number(m[1]);
  };

  const before = runLorekit(['lint'], { cwd: corpus });
  assert.match(before.stderr, /broken link: \[\[未建节点\]\]/, 'initially reported broken');
  const beforeCount = countOf(before.stderr);

  runLorekit(['links', 'backlog', '未建节点', '--type', 'concept', '--source', '知识库/概念/Source.md'], {
    cwd: corpus,
  });

  const after = runLorekit(['lint'], { cwd: corpus });
  assert.doesNotMatch(after.stderr, /broken link: \[\[未建节点\]\]/, 'no longer counted as broken');
  assert.match(after.stderr, /backlogged link: \[\[未建节点\]\]/, 'surfaced as backlogged instead');
  assert.equal(countOf(after.stderr), beforeCount - 1, 'failure count drops by exactly the backlogged link');
});
