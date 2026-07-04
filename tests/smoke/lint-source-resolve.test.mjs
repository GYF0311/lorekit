// 原料链路加固：知识库页 frontmatter 来源引用（原料/知识库 路径）必须可解析。
// 典型断因：入库时文件从工作台搬进 原料/ 改了路径，页面引用停在旧路径。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function writeMd(rel, fmLines, body) {
  const abs = join(corpus, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  const title = rel.split('/').pop().replace(/\.md$/, '');
  writeFileSync(
    abs,
    [
      '---',
      'type: concept',
      `title: ${title}`,
      `slug: ${rel.replace(/\.md$/, '')}`,
      'created: 2026-07-01',
      'updated: 2026-07-01',
      ...fmLines,
      '---',
      '',
      body,
      '',
    ].join('\n'),
    'utf-8',
  );
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-lint-source-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  writeMd('原料/剪藏/真实来源.md', [], '原料正文。链接 [[好页]] 避免孤岛。');
  writeMd(
    '知识库/概念/好页.md',
    ['source: 原料/剪藏/真实来源'],
    '来源可解析。链接 [[坏页]]。',
  );
  writeMd(
    '知识库/概念/坏页.md',
    ['sources:', '  - 原料/剪藏/被改名的旧路径.md', '  - https://example.com/外部链接'],
    '来源已断。链接 [[好页]]。',
  );
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('frontmatter 来源断链被报 unresolved-source，可解析与外部 URL 不报', () => {
  const r = runLorekit(['lint'], { cwd: corpus });
  assert.equal(r.status, 1, fmtRun(r, ['lint'], 'unresolved-source 是硬性问题，应 exit 1'));

  const text = r.stdout + r.stderr;
  assert.match(text, /坏页\.md: frontmatter source not found: 原料\/剪藏\/被改名的旧路径\.md/);
  assert.doesNotMatch(text, /好页\.md: frontmatter source not found/);
  assert.doesNotMatch(text, /example\.com/, '外部 URL 不参与本检查');
});
