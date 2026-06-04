import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

beforeEach(() => {
  corpus = mkTmpDir('lorekit-tooling-boundary-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  const skillDir = join(corpus, 'skills', 'wiki-lint');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    [
      '---',
      'name: wiki-lint',
      'description: Agent workflow pack, not a wiki page',
      '---',
      '',
      '# wiki-lint',
      '',
      'Example placeholder link [[Not A Wiki Page]].',
      '',
    ].join('\n'),
    'utf-8',
  );

  const packageDir = join(corpus, '知识库', 'vendor', 'node_modules', 'fast-glob');
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, 'README.md'), 'Package docs mention [[options]].\n', 'utf-8');
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('lint ignores project-local skills and node_modules markdown', () => {
  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'tooling markdown should not be linted'));
  assert.doesNotMatch(r.stdout + r.stderr, /skills\/wiki-lint/);
  assert.doesNotMatch(r.stdout + r.stderr, /node_modules/);
});

test('lint --quick is accepted as a documented compatibility alias', () => {
  const args = ['lint', '--quick'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, '--quick should not be an unknown option'));
});

test('lint flags knowledge pages that cite _工作台 as canonical source', () => {
  mkdirSync(join(corpus, '_工作台', 'research'), { recursive: true });
  writeFileSync(
    join(corpus, '_工作台', 'research', 'finished-package.md'),
    'draft package without durable source status\n',
    'utf-8',
  );

  mkdirSync(join(corpus, '知识库', '概念'), { recursive: true });
  writeFileSync(
    join(corpus, '知识库', '概念', 'Workbench-Source.md'),
    [
      '---',
      'type: concept',
      'title: Workbench Source',
      'slug: 知识库/概念/workbench-source',
      'created: 2026-06-04',
      'updated: 2026-06-04',
      'graph-excluded: true',
      '---',
      '',
      'This knowledge page cites [[_工作台/research/finished-package]] directly.',
      '',
    ].join('\n'),
    'utf-8',
  );

  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 1, fmtRun(r, args, 'direct workbench source link should fail lint'));
  assert.match(r.stderr, /workbench source links/);
  assert.match(r.stderr, /知识库\/概念\/Workbench-Source\.md/);
  assert.match(r.stderr, /_工作台\/research\/finished-package/);
});

test('lint flags knowledge frontmatter sources that point to _工作台', () => {
  mkdirSync(join(corpus, '知识库', '概念'), { recursive: true });
  writeFileSync(
    join(corpus, '知识库', '概念', 'Workbench-Frontmatter.md'),
    [
      '---',
      'type: concept',
      'title: Workbench Frontmatter',
      'slug: 知识库/概念/workbench-frontmatter',
      'created: 2026-06-04',
      'updated: 2026-06-04',
      'graph-excluded: true',
      'sources:',
      '  - _工作台/research/finished-package.md',
      '---',
      '',
      'No body wikilink here.',
      '',
    ].join('\n'),
    'utf-8',
  );

  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 1, fmtRun(r, args, 'workbench source frontmatter should fail lint'));
  assert.match(r.stderr, /frontmatter cites process workbench/);
  assert.match(r.stderr, /_工作台\/research\/finished-package\.md/);
});

test('lint allows raw MANIFEST origin_path pointing back to _工作台 provenance', () => {
  mkdirSync(join(corpus, '原料', '学习单元', 'U001'), { recursive: true });
  writeFileSync(
    join(corpus, '原料', '学习单元', 'U001', 'MANIFEST.md'),
    [
      '---',
      'type: source-manifest',
      'title: U001 manifest',
      'slug: 原料/学习单元/U001/MANIFEST',
      'created: 2026-06-04',
      'updated: 2026-06-04',
      'origin_path: _工作台/U单元学习资料/U001',
      'graph-excluded: true',
      '---',
      '',
      'Sealed raw package manifest.',
      '',
    ].join('\n'),
    'utf-8',
  );

  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'raw manifest origin_path should remain provenance'));
});

test('sync does not generate _INDEX.md under tooling directories', () => {
  const args = ['sync', '--skip-doctor'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'sync should ignore tooling directories'));
  assert.equal(existsSync(join(corpus, 'skills', 'wiki-lint', '_INDEX.md')), false);
  assert.equal(
    existsSync(join(corpus, '知识库', 'vendor', 'node_modules', 'fast-glob', '_INDEX.md')),
    false,
  );
});
