import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

function initCorpus(prefix = 'lorekit-smoke-doctor-json-') {
  const corpus = mkTmpDir(prefix);
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));
  return corpus;
}

test('doctor --json reports ok on a fresh corpus', () => {
  const corpus = initCorpus();
  try {
    const args = ['doctor', '--json'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'fresh corpus exits 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.hardIssues, 0);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor human output passes hard checks on a fresh corpus', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-human-');
  try {
    const args = ['doctor'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'fresh corpus exits 0'));
    assert.match(
      r.stderr,
      /all hard checks passed/i,
      fmtRun(r, args, 'stderr says hard checks passed'),
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor metadata frontmatter coverage ignores process workbench by default', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-frontmatter-layers-');
  try {
    mkdirSync(join(corpus, '原料', '文章'), { recursive: true });
    mkdirSync(join(corpus, '知识库', '概念'), { recursive: true });
    mkdirSync(join(corpus, '_工作台', 'research'), { recursive: true });

    writeFileSync(
      join(corpus, '原料', '文章', 'article.md'),
      [
        '---',
        'type: source',
        'title: Article',
        'slug: 原料/文章/article',
        'created: 2026-06-04',
        'updated: 2026-06-04',
        '---',
        '',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(
      join(corpus, '知识库', '概念', 'Article.md'),
      [
        '---',
        'type: concept',
        'title: Article',
        'slug: 知识库/概念/article',
        'created: 2026-06-04',
        'updated: 2026-06-04',
        '---',
        '',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(join(corpus, '_工作台', 'research', 'draft.md'), 'draft without frontmatter\n', 'utf-8');

    const args = ['doctor', '--section', 'metadata', '--json'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'durable coverage remains healthy'));

    const parsed = JSON.parse(r.stdout);
    const fm = parsed.sections.frontmatter;
    assert.equal(fm.scope, 'durable');
    assert.equal(fm.withFrontmatter, 2);
    assert.equal(fm.total, 2);
    assert.equal(fm.pct, 100);
    assert.equal(fm.layers['_工作台'].durable, false);
    assert.ok(fm.layers['_工作台'].total >= 1);
    assert.ok(fm.layers['_工作台'].pct < 100);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor --section rejects unknown section with exit 2', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-invalid-section-');
  try {
    const args = ['doctor', '--section', 'abc'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 2, fmtRun(r, args, 'invalid section exits 2'));
    assert.match(r.stderr, /invalid section: abc/i);
    assert.match(r.stderr, /valid: structure, metadata, index, archive, obsidian/i);
  } finally {
    cleanupTmpDir(corpus);
  }
});
