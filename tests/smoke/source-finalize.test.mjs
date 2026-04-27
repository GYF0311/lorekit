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

beforeEach(() => {
  corpus = mkTmpDir('lorekit-smoke-source-');
  const args = ['init', '.'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('source finalize writes slug and stable verification fields', () => {
  write('原料/录音/local.md', `---
type: source
title: Local Recording
# keep rich yaml intact
created: 2026-04-27
updated: 2026-04-27
source_date: 2000-01-01
source_kind: recording
metadata:
  nested: true
---

# Local Recording

Body that should be hashed.
`);

  const args = ['source', 'finalize', '原料/录音/local.md'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'finalize exit 0'));
  const first = read('原料/录音/local.md');
  const raw1 = first.match(/^raw_sha256:\s*([0-9a-f]{64})$/m)?.[1];
  assert.ok(raw1, first);
  assert.match(first, /^slug: 原料\/录音\/local$/m);
  assert.match(first, /^last_verified: \d{4}-\d{2}-\d{2}$/m);
  assert.match(first, /^possibly_outdated: true$/m);
  assert.match(first, /# keep rich yaml intact/);
  assert.match(first, /metadata:\n {2}nested: true/);

  const r2 = runLorekit(args, { cwd: corpus });
  assert.equal(r2.status, 0, fmtRun(r2, args, 'second finalize exit 0'));
  const second = read('原料/录音/local.md');
  const raw2 = second.match(/^raw_sha256:\s*([0-9a-f]{64})$/m)?.[1];
  assert.equal(raw2, raw1, 'raw_sha256 should not drift on repeated finalize');

  const checkArgs = ['source', 'finalize', '原料/录音/local.md', '--check'];
  const check = runLorekit(checkArgs, { cwd: corpus });
  assert.equal(check.status, 0, fmtRun(check, checkArgs, '--check exit 0 when current'));

  writeFileSync(join(corpus, '原料/录音/local.md'), second + '\nNew external edit.\n', 'utf-8');
  const stale = runLorekit(checkArgs, { cwd: corpus });
  assert.equal(stale.status, 1, fmtRun(stale, checkArgs, '--check exits 1 when hash stale'));
});
