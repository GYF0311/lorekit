import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

function seedCorpus(prefix = 'lorekit-smoke-gbrain-query-') {
  const corpus = mkTmpDir(prefix);
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));
  writeFileSync(
    join(corpus, '知识库', '概念', 'RAG.md'),
    ['---', 'title: RAG', 'type: concept', '---', '', 'RAG note.', ''].join('\n'),
  );
  return corpus;
}

function fakeGbrain(tmp, body) {
  const bin = join(tmp, 'fake-gbrain');
  writeFileSync(bin, body);
  chmodSync(bin, 0o755);
  return bin;
}

function fakeQueryGbrain(tmp) {
  return fakeGbrain(
    tmp,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "gbrain 0.33.0"; exit 0; fi',
      'echo "$@" > "$LOREKIT_FAKE_GBRAIN_MARKER"',
      'echo "query ok: $*"',
      'exit 0',
      '',
    ].join('\n'),
  );
}

test('gbrain query requires a lorekit corpus by default', () => {
  const tmp = mkTmpDir('lorekit-smoke-gbrain-query-outside-');
  const marker = join(tmp, 'called.txt');
  const bin = fakeQueryGbrain(tmp);
  try {
    const args = ['gbrain', 'query', 'RAG', '--json'];
    const r = runLorekit(args, {
      cwd: tmpdir(),
      env: {
        LOREKIT_GBRAIN_BIN: bin,
        LOREKIT_FAKE_GBRAIN_MARKER: marker,
      },
    });
    assert.equal(r.status, 1, fmtRun(r, args, 'exit 1 outside corpus'));
    assert.equal(existsSync(marker), false, 'fake gbrain was not called');
  } finally {
    cleanupTmpDir(tmp);
  }
});

test('gbrain query warns on stale or unsynced export but still queries by default', () => {
  const corpus = seedCorpus();
  const marker = join(corpus, 'called.txt');
  const bin = fakeQueryGbrain(corpus);
  try {
    const args = ['gbrain', 'query', 'RAG', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: {
        LOREKIT_GBRAIN_BIN: bin,
        LOREKIT_FAKE_GBRAIN_MARKER: marker,
      },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 with stale warning'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.staleCheck?.skipped, false);
    assert.equal(parsed.staleCheck?.status, 'warn');
    assert.match(parsed.warnings.join('\n'), /GBrain index may be stale/i);
    assert.match(parsed.gbrain.stdout, /query ok: query RAG/);
    assert.match(readFileSync(marker, 'utf-8'), /^query RAG/);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain query --no-stale-check allows explicit force query', () => {
  const corpus = seedCorpus('lorekit-smoke-gbrain-query-force-');
  const marker = join(corpus, 'called.txt');
  const bin = fakeQueryGbrain(corpus);
  try {
    const args = ['gbrain', 'query', 'RAG', '--no-stale-check', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: {
        LOREKIT_GBRAIN_BIN: bin,
        LOREKIT_FAKE_GBRAIN_MARKER: marker,
      },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 with explicit stale-check bypass'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.staleCheck?.skipped, true);
    assert.match(parsed.gbrain.stdout, /query ok: query RAG/);
    assert.match(readFileSync(marker, 'utf-8'), /^query RAG/);
  } finally {
    cleanupTmpDir(corpus);
  }
});
