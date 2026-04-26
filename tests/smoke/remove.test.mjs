import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun, hasSqliteVec } from './_util.mjs';

const SQLITE_VEC = await hasSqliteVec();

let corpus;

function write(rel, content) {
  const full = join(corpus, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content.trimStart(), 'utf-8');
}

function read(rel) {
  return readFileSync(join(corpus, rel), 'utf-8');
}

function seedHarnessCorpus() {
  mkdirSync(join(corpus, '原料/文章/harness-a'), { recursive: true });
  mkdirSync(join(corpus, '原料/文章/harness-b'), { recursive: true });
  mkdirSync(join(corpus, '原料/文章/harness-c'), { recursive: true });
  write('原料/文章/harness-a/article.md', `---
type: source
title: Harness A
slug: 原料/文章/harness-a/article
created: 2026-04-20
updated: 2026-04-20
source_url: https://example.com/harness-a
---

# Harness A
`);
  write('原料/文章/harness-b/article.md', `---
type: source
title: Harness B
slug: 原料/文章/harness-b/article
created: 2026-04-20
updated: 2026-04-20
source_url: https://example.com/harness-b
---

# Harness B
`);
  write('原料/文章/harness-c/article.md', `---
type: source
title: Harness C
slug: 原料/文章/harness-c/article
created: 2026-04-20
updated: 2026-04-20
source_url: https://example.com/harness-c
---

# Harness C
`);
  write('知识库/摘要/harness-a.md', `---
type: summary
title: Harness A
slug: 知识库/摘要/harness-a
created: 2026-04-20
updated: 2026-04-20
sources: [原料/文章/harness-a]
---

# Harness A

## Compiled Truth

Summary from [[原料/文章/harness-a]].
`);
  write('知识库/摘要/harness-b.md', `---
type: summary
title: Harness B
slug: 知识库/摘要/harness-b
created: 2026-04-20
updated: 2026-04-20
sources: [原料/文章/harness-b]
---

# Harness B
`);
  write('知识库/摘要/harness-c.md', `---
type: summary
title: Harness C
slug: 知识库/摘要/harness-c
created: 2026-04-20
updated: 2026-04-20
sources: [原料/文章/harness-c]
---

# Harness C
`);
  write('知识库/概念/harness.md', `---
type: concept
title: harness
slug: 知识库/概念/harness
created: 2026-04-20
updated: 2026-04-20
source_count: 3
sources: [原料/文章/harness-a, 原料/文章/harness-b, 原料/文章/harness-c]
---

# harness

## Compiled Truth

Harness is a shared concept supported by multiple sources.

## Timeline

- 2026-04-20 [[知识库/摘要/harness-a]] introduced harness.
- 2026-04-21 [[知识库/摘要/harness-b]] expanded harness.
- 2026-04-22 [[知识库/摘要/harness-c]] compared harness.
`);
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-smoke-remove-');
  const args = ['init', '.'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
  seedHarnessCorpus();
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('remove dry-run reports impact without modifying files', () => {
  const before = read('知识库/概念/harness.md');
  const args = ['remove', '知识库/摘要/harness-a.md', '--json'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'dry-run exit 0'));

  const report = JSON.parse(r.stdout);
  assert.equal(report.apply, false);
  assert.ok(report.trashTargets.some((t) => t.rel === '知识库/摘要/harness-a.md'));
  assert.ok(report.trashTargets.some((t) => t.rel === '原料/文章/harness-a'));
  assert.ok(report.pageChanges.some((c) => c.file === '知识库/概念/harness.md'));
  assert.equal(read('知识库/概念/harness.md'), before);
  assert.ok(existsSync(join(corpus, '知识库/摘要/harness-a.md')));
  assert.ok(existsSync(join(corpus, '原料/文章/harness-a')));
});

test('remove --apply only removes the selected source contribution', () => {
  const trashDir = join(corpus, '.test-trash');
  const args = ['remove', '知识库/摘要/harness-a.md', '--apply', '--json'];
  const r = runLorekit(args, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(r.status, 0, fmtRun(r, args, 'apply exit 0'));

  assert.equal(existsSync(join(corpus, '知识库/摘要/harness-a.md')), false);
  assert.equal(existsSync(join(corpus, '原料/文章/harness-a')), false);
  assert.ok(existsSync(join(corpus, '知识库/摘要/harness-b.md')));
  assert.ok(existsSync(join(corpus, '原料/文章/harness-b')));

  const concept = read('知识库/概念/harness.md');
  assert.match(concept, /source_count: 2/);
  assert.doesNotMatch(concept, /harness-a/);
  assert.match(concept, /harness-b/);
  assert.match(concept, /harness-c/);

  const report = JSON.parse(r.stdout);
  assert.ok(report.snapshot, 'apply should create a snapshot before removal');
  assert.equal(report.syncSkippedVector, true);
});

test('remove URL resolves ingest-state archivedTo and wikiPages', () => {
  const url = 'https://example.com/harness-a';
  const recordArgs = [
    'ingest',
    'record',
    url,
    '--archived-to',
    '原料/文章/harness-a',
    '--wiki-page',
    '知识库/摘要/harness-a.md',
    '--step',
    'archive,wiki,lint',
  ];
  const record = runLorekit(recordArgs, { cwd: corpus });
  assert.equal(record.status, 0, fmtRun(record, recordArgs, 'record exit 0'));

  const trashDir = join(corpus, '.test-trash');
  const args = ['remove', url, '--apply', '--json'];
  const r = runLorekit(args, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(r.status, 0, fmtRun(r, args, 'URL apply exit 0'));
  assert.equal(existsSync(join(corpus, '知识库/摘要/harness-a.md')), false);
  assert.equal(existsSync(join(corpus, '原料/文章/harness-a')), false);

  const state = JSON.parse(readFileSync(join(corpus, '.wiki/ingest-state.json'), 'utf-8'));
  assert.equal(state.ingests[url], undefined);
});

test('remove --apply prunes deleted files from vector.sqlite', async (t) => {
  if (!SQLITE_VEC) {
    t.skip('sqlite-vec not installed (optional dep)');
    return;
  }

  const Database = (await import('better-sqlite3')).default;
  const db = new Database(join(corpus, '.wiki/vector.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      sha256 TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO documents (id, path, sha256, updated_at) VALUES (?, ?, ?, ?)').run(
    1,
    '原料/文章/harness-a/article.md',
    'deadbeef',
    '2026-04-20T00:00:00Z',
  );
  db.close();

  const trashDir = join(corpus, '.test-trash');
  const args = ['remove', '知识库/摘要/harness-a.md', '--apply', '--json'];
  const r = runLorekit(args, {
    cwd: corpus,
    env: {
      LOREKIT_TEST_TRASH_DIR: trashDir,
      LOREKIT_TEST_SKIP_VECTOR_SYNC: '1',
    },
    timeout: 60_000,
  });
  assert.equal(r.status, 0, fmtRun(r, args, 'apply with vector prune exit 0'));

  const after = new Database(join(corpus, '.wiki/vector.sqlite'), { readonly: true });
  const row = after
    .prepare('SELECT COUNT(*) as n FROM documents WHERE path = ?')
    .get('原料/文章/harness-a/article.md');
  after.close();
  assert.equal(row.n, 0);

  const report = JSON.parse(r.stdout);
  assert.equal(report.vectorPruned, 1);
});
