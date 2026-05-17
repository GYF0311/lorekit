import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

function seedCorpus(prefix = 'lorekit-smoke-gbrain-sync-') {
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

test('gbrain sync --dry-run does not call gbrain import or write report', () => {
  const corpus = seedCorpus();
  const marker = join(corpus, 'called.txt');
  const bin = fakeGbrain(
    corpus,
    ['#!/bin/sh', 'echo "$@" > "$LOREKIT_FAKE_GBRAIN_MARKER"', 'exit 0', ''].join('\n'),
  );
  try {
    const args = ['gbrain', 'sync', '--dry-run', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: {
        LOREKIT_GBRAIN_BIN: bin,
        LOREKIT_FAKE_GBRAIN_MARKER: marker,
      },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.gbrainImport?.skipped, true);
    assert.equal(existsSync(marker), false, 'fake gbrain was not called');
    assert.equal(
      existsSync(join(corpus, '.wiki', 'integrations', 'gbrain', 'sync-report.json')),
      false,
      'dry-run does not write sync report',
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain sync writes success report after invoking gbrain import', () => {
  const corpus = seedCorpus();
  const marker = join(corpus, 'called.txt');
  const bin = fakeGbrain(
    corpus,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "gbrain 0.33.0"; exit 0; fi',
      'echo "$@" >> "$LOREKIT_FAKE_GBRAIN_MARKER"',
      'if [ "$1" = "import" ]; then echo "import ok"; exit 0; fi',
      'if [ "$1" = "extract" ]; then echo "{\\"links_created\\":1,\\"timeline_entries_created\\":1,\\"pages_processed\\":1}"; exit 0; fi',
      'exit 0',
      '',
    ].join('\n'),
  );
  try {
    const args = ['gbrain', 'sync', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: {
        LOREKIT_GBRAIN_BIN: bin,
        LOREKIT_FAKE_GBRAIN_MARKER: marker,
      },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const calls = readFileSync(marker, 'utf-8').trim().split('\n');
    assert.match(calls[0], /^import .*gbrain-export\/pages --fresh$/);
    assert.equal(calls[1], 'extract all --source db --include-frontmatter --json');

    const reportPath = join(corpus, '.wiki', 'integrations', 'gbrain', 'sync-report.json');
    assert.equal(existsSync(reportPath), true, 'sync report exists');
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    assert.equal(report.status, 'ok');
    assert.equal(report.gbrainImport.exitCode, 0);
    assert.match(report.gbrainImport.stdout, /import ok/);
    assert.equal(report.gbrainExtract.exitCode, 0);
    assert.equal(report.extract.links_created, 1);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain sync writes failure report when gbrain is missing', () => {
  const corpus = seedCorpus('lorekit-smoke-gbrain-sync-fail-');
  try {
    const args = ['gbrain', 'sync', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 1, fmtRun(r, args, 'exit 1'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'error');
    assert.equal(parsed.export, null);
    assert.match(parsed.errors.join('\n'), /not installed|ENOENT|spawn/);
    assert.equal(
      existsSync(join(corpus, '.wiki', 'integrations', 'gbrain-export')),
      false,
      'missing gbrain does not refresh staging export by default',
    );

    const reportPath = join(corpus, '.wiki', 'integrations', 'gbrain', 'sync-report.json');
    assert.equal(existsSync(reportPath), true, 'failure report exists');
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    assert.equal(report.status, 'error');
    assert.equal(report.export, null);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain sync --export-even-if-missing keeps old staging-refresh behavior explicit', () => {
  const corpus = seedCorpus('lorekit-smoke-gbrain-sync-export-missing-');
  try {
    const args = ['gbrain', 'sync', '--export-even-if-missing', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 1, fmtRun(r, args, 'exit 1'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'error');
    assert.equal(parsed.export.pagesExported, 1);
    assert.equal(
      existsSync(join(corpus, '.wiki', 'integrations', 'gbrain-export')),
      true,
      'explicit flag refreshes staging export even when gbrain is missing',
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});
