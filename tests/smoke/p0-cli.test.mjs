import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function write(rel, content) {
  const full = join(corpus, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content.trimStart(), 'utf-8');
}

function read(rel) {
  return readFileSync(join(corpus, rel), 'utf-8');
}

function seedSourceWithoutSlug() {
  write('原料/剪藏/no-slug.md', `---
type: source
title: No Slug
# keep yaml comment
created: 2026-04-27
updated: 2026-04-27
source_url: https://example.com/no-slug
source_date: 2026-04-27
source_kind: clipping
metadata:
  nested: true
---

# No Slug
`);
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-smoke-p0-');
  const args = ['init', '.'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('sync skips vector by default when vector status recommends text mode', () => {
  const args = ['sync', '--skip-doctor'];
  const r = runLorekit(args, { cwd: corpus, timeout: 60_000 });
  assert.equal(r.status, 0, fmtRun(r, args, 'sync exit 0 without ollama'));
  assert.match(r.stderr, /vector skipped/i, fmtRun(r, args, 'stderr mentions vector skipped'));
});

test('doctor --json reports warnings and --strict exits non-zero for warnings', () => {
  write('scratch.md', `# Scratch
`);

  const jsonArgs = ['doctor', '--json'];
  const json = runLorekit(jsonArgs, { cwd: corpus });
  assert.equal(json.status, 0, fmtRun(json, jsonArgs, 'doctor --json exit 0'));
  const parsed = JSON.parse(json.stdout);
  assert.ok(Array.isArray(parsed.warnings), 'doctor --json should include warnings array');
  assert.ok(
    parsed.warnings.some((w) => w.id === 'frontmatter-coverage'),
    'low frontmatter coverage should be a warning',
  );
  assert.equal(parsed.summary.status, 'warning');

  const strictArgs = ['doctor', '--strict'];
  const strict = runLorekit(strictArgs, { cwd: corpus });
  assert.equal(strict.status, 1, fmtRun(strict, strictArgs, 'doctor --strict exits 1'));
  assert.doesNotMatch(strict.stderr, /all checks passed/i);
});

test('lint plan/fix --safe repairs source slug and ignores workbench node_modules', () => {
  seedSourceWithoutSlug();
  write('_工作台/Coding/demo/node_modules/pkg/README.md', `# Package

This package references [[options]] in its README.
`);

  const planArgs = ['lint', 'plan', '--json'];
  const plan = runLorekit(planArgs, { cwd: corpus });
  assert.equal(plan.status, 1, fmtRun(plan, planArgs, 'lint plan exits 1 with issues'));
  const parsed = JSON.parse(plan.stdout);
  assert.ok(
    parsed.safe.some((i) => i.file === '原料/剪藏/no-slug.md' && i.action === 'add-slug'),
    'missing source slug should be safe-fixable',
  );
  assert.ok(
    parsed.ignored.some((i) => i.file.includes('node_modules/pkg/README.md')),
    'node_modules broken link should be ignored by policy',
  );

  const fixArgs = ['lint', 'fix', '--safe'];
  const fix = runLorekit(fixArgs, { cwd: corpus });
  assert.equal(fix.status, 0, fmtRun(fix, fixArgs, 'lint fix --safe exit 0'));
  assert.match(read('原料/剪藏/no-slug.md'), /^slug: 原料\/剪藏\/no-slug$/m);
  assert.match(read('原料/剪藏/no-slug.md'), /# keep yaml comment/);
  assert.match(read('原料/剪藏/no-slug.md'), /metadata:\n {2}nested: true/);

  const lintArgs = ['lint', '--json'];
  const lint = runLorekit(lintArgs, { cwd: corpus });
  const lintJson = JSON.parse(lint.stdout);
  assert.equal(
    lintJson.issues.some((i) => i.file.includes('node_modules/pkg/README.md')),
    false,
    'ignored node_modules file should not be reported as active lint issue',
  );
});

test('ingest record reads title metadata from archived source frontmatter', () => {
  write('原料/录音/local.md', `---
type: source
title: Local Source Title
slug: 原料/录音/local
created: 2026-04-27
updated: 2026-04-27
source_date: 2026-04-06
source_kind: recording
---

# Local
`);

  const args = [
    'ingest',
    'record',
    'file:原料/录音/local.md',
    '--step',
    'archive,lint',
    '--archived-to',
    '原料/录音/local.md',
    '--log',
    '记录本地来源。',
  ];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'ingest record exit 0'));
  assert.match(read('log.md'), /ingest \| Local Source Title/);
  const state = JSON.parse(read('.wiki/ingest-state.json'));
  const rec = state.ingests['file:原料/录音/local.md'];
  assert.equal(rec.title, 'Local Source Title');
  assert.equal(rec.sourceDate, '2026-04-06');
  assert.equal(rec.sourceKind, 'recording');
});
