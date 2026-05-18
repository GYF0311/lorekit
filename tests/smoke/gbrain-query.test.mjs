import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function seedProjectionCorpus() {
  const corpus = mkTmpDir('lorekit-smoke-gbrain-query-map-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));
  mkdirSync(join(corpus, '知识库', '概念'), { recursive: true });
  mkdirSync(join(corpus, '知识库', '实体'), { recursive: true });
  writeFileSync(
    join(corpus, '知识库', '概念', 'Anthropic-Harness.md'),
    [
      '---',
      'title: Anthropic Harness',
      'type: concept',
      '---',
      '',
      'Anthropic Harness mentions [[知识库/实体/Anthropic|Anthropic]].',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(corpus, '知识库', '实体', 'Anthropic.md'),
    ['---', 'title: Anthropic', 'type: entity', '---', '', 'Anthropic note.', ''].join('\n'),
  );
  const exportRun = runLorekit(['gbrain', 'export', '--json'], { cwd: corpus });
  assert.equal(exportRun.status, 0, fmtRun(exportRun, ['gbrain', 'export', '--json'], 'export exit 0'));
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
    assert.match(parsed.gbrain.stdout, /query ok: query RAG --no-expand/);
    assert.match(readFileSync(marker, 'utf-8'), /^query RAG --no-expand/);
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
    assert.match(parsed.gbrain.stdout, /query ok: query RAG --no-expand/);
    assert.match(readFileSync(marker, 'utf-8'), /^query RAG --no-expand/);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain query maps GBrain slugs back to canonical 知识库 pages', () => {
  const corpus = seedProjectionCorpus();
  const marker = join(corpus, 'called.txt');
  const bin = fakeGbrain(
    corpus,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "gbrain 0.33.0"; exit 0; fi',
      'echo "$@" > "$LOREKIT_FAKE_GBRAIN_MARKER"',
      'echo "[0.9000] concepts/anthropic-harness -- Harness context"',
      'echo "[0.5000] 概念/anthropic-harness -- Legacy slug context"',
      'echo "[0.1000] unknown/missing -- Missing context"',
      'exit 0',
      '',
    ].join('\n'),
  );
  try {
    const args = ['gbrain', 'query', 'Anthropic Harness', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: {
        LOREKIT_GBRAIN_BIN: bin,
        LOREKIT_FAKE_GBRAIN_MARKER: marker,
      },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.candidates[0].gbrainSlug, 'concepts/anthropic-harness');
    assert.equal(parsed.candidates[0].canonicalPath, '知识库/概念/Anthropic-Harness.md');
    assert.equal(parsed.candidates[0].canonicalExists, true);
    assert.equal(parsed.candidates[1].gbrainSlug, '概念/anthropic-harness');
    assert.equal(parsed.candidates[1].canonicalPath, '知识库/概念/Anthropic-Harness.md');
    assert.equal(parsed.candidates[1].canonicalExists, true);
    assert.match(parsed.warnings.join('\n'), /could not map GBrain candidate.*unknown\/missing/);
    assert.match(readFileSync(marker, 'utf-8'), /^query Anthropic Harness --no-expand/);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain query keeps mapped candidates from a timed out external process', () => {
  const corpus = seedProjectionCorpus();
  const marker = join(corpus, 'called.txt');
  const bin = fakeGbrain(
    corpus,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "gbrain 0.33.0"; exit 0; fi',
      'echo "$@" > "$LOREKIT_FAKE_GBRAIN_MARKER"',
      'echo "[0.9000] concepts/anthropic-harness -- Harness context"',
      'sleep 2',
      'exit 0',
      '',
    ].join('\n'),
  );
  try {
    const args = ['gbrain', 'query', 'Anthropic Harness', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: {
        LOREKIT_GBRAIN_BIN: bin,
        LOREKIT_FAKE_GBRAIN_MARKER: marker,
        LOREKIT_GBRAIN_QUERY_TIMEOUT_MS: '50',
      },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 with timed out but parsed candidates'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.gbrain.timedOut, true);
    assert.equal(parsed.candidates[0].canonicalPath, '知识库/概念/Anthropic-Harness.md');
    assert.match(parsed.warnings.join('\n'), /timed out after returning candidates/i);
    assert.match(readFileSync(marker, 'utf-8'), /^query Anthropic Harness --no-expand/);
  } finally {
    cleanupTmpDir(corpus);
  }
});
