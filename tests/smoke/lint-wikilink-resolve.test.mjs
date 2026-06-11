// issue #18 — lint / ingest check 必须按 Obsidian 语义解析相对 / 嵌入 / 素材 wikilink，
// 不能把「相对源文件目录的图片嵌入」误报为 broken link，同时真断链仍要报。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

beforeEach(() => {
  corpus = mkTmpDir('lorekit-wikilink-resolve-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  // 一页同时含：相对目录的存在素材嵌入（应解析）+ 不存在素材嵌入（应报 broken）。
  const pageDir = join(corpus, '知识库', '概念');
  mkdirSync(join(pageDir, 'assets'), { recursive: true });
  // 相对源文件目录真实存在的图片素材
  writeFileSync(join(pageDir, 'assets', 'ok.png'), 'fake-png-bytes', 'utf-8');
  writeFileSync(
    join(pageDir, 'Embed-Page.md'),
    [
      '---',
      'type: concept',
      'title: Embed Page',
      'slug: 知识库/概念/embed-page',
      'created: 2026-06-11',
      'updated: 2026-06-11',
      'graph-excluded: true',
      '---',
      '',
      '相对目录嵌入（图片存在，Obsidian 正常解析）：![[assets/ok.png]]',
      '不存在的素材嵌入（应报 broken）：![[assets/missing.png]]',
      '',
    ].join('\n'),
    'utf-8',
  );
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('lint does not flag a relative embed whose asset exists', () => {
  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  // 存在的相对素材不应出现在 broken link 报告里
  assert.doesNotMatch(
    r.stderr,
    /broken link: \[\[assets\/ok\.png\]\]/,
    fmtRun(r, args, 'existing relative asset embed must not be broken'),
  );
});

test('lint still flags a relative embed whose asset is missing', () => {
  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  assert.match(
    r.stderr,
    /broken link: \[\[assets\/missing\.png\]\]/,
    fmtRun(r, args, 'missing relative asset embed must still be broken'),
  );
});

test('ingest check resolves relative asset embeds the same way lint does', () => {
  const args = ['ingest', 'check', '知识库/概念/Embed-Page.md'];
  const r = runLorekit(args, { cwd: corpus });
  // ingest check 的机器结果走 stdout JSON：{checked, ok, broken}
  const result = JSON.parse(r.stdout.trim());
  const brokenLinks = result.broken.map((b) => b.link);
  const okLinks = result.ok.map((b) => b.link);
  assert.ok(
    okLinks.includes('assets/ok.png'),
    fmtRun(r, args, 'existing relative asset embed must be ok in ingest check'),
  );
  assert.ok(
    brokenLinks.includes('assets/missing.png'),
    fmtRun(r, args, 'missing relative asset embed must be broken in ingest check'),
  );
});
