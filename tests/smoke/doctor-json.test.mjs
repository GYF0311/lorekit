import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

function initCorpus(prefix = 'lorekit-smoke-doctor-json-') {
  const corpus = mkTmpDir(prefix);
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));
  return corpus;
}

function fakeGbrain(tmp) {
  const bin = join(tmp, 'fake-gbrain');
  writeFileSync(
    bin,
    ['#!/bin/sh', 'if [ "$1" = "--version" ]; then echo "gbrain 0.33.0"; exit 0; fi', 'exit 0', ''].join(
      '\n',
    ),
  );
  chmodSync(bin, 0o755);
  return bin;
}

function fakeGbrainWithGraph(tmp) {
  const bin = join(tmp, 'fake-gbrain-with-graph');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "gbrain 0.33.0"; exit 0; fi',
      'if [ "$1" = "graph-query" ]; then echo "[depth 0] concepts/anthropic-harness"; echo "  --mentions-> entities/anthropic (depth 1)"; exit 0; fi',
      'exit 0',
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  return bin;
}

test('doctor --json reports optional GBrain integration warnings without hard failing', () => {
  const corpus = initCorpus();
  try {
    const args = ['doctor', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'warn status exits 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'warn');
    assert.equal(parsed.hardIssues, 0);
    assert.equal(parsed.sections.integrations.gbrain.status, 'warn');
    assert.ok(
      parsed.issues.some((issue) => /GBrain binary is not installed/.test(issue.message)),
      'GBrain missing warning is surfaced',
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor human output distinguishes hard pass from optional warnings', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-human-warn-');
  try {
    const args = ['doctor'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'optional warnings still exit 0'));
    assert.match(
      r.stderr,
      /all hard checks passed/i,
      fmtRun(r, args, 'stderr says hard checks passed'),
    );
    assert.match(
      r.stderr,
      /optional warnings found/i,
      fmtRun(r, args, 'stderr says optional warnings found'),
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor --json hard-fails GBrain export manifest without reverse mapping', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-json-gbrain-manifest-');
  const bin = fakeGbrain(corpus);
  try {
    writeFileSync(
      join(corpus, '知识库', '概念', 'RAG.md'),
      ['---', 'title: RAG', 'type: concept', '---', '', 'RAG note.', ''].join('\n'),
    );
    const exportRun = runLorekit(['gbrain', 'export', '--json'], { cwd: corpus });
    assert.equal(exportRun.status, 0, fmtRun(exportRun, ['gbrain', 'export', '--json'], 'export exit 0'));

    const manifestPath = join(corpus, '.wiki', 'integrations', 'gbrain-export', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    delete manifest.reverseMap;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    const args = ['doctor', '--section', 'integrations', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: bin },
    });
    assert.equal(r.status, 1, fmtRun(r, args, 'missing reverse map exits 1'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'error');
    assert.ok(
      parsed.issues.some(
        (issue) =>
          issue.severity === 'error' && /manifest is missing reverse mapping/i.test(issue.message),
      ),
      'missing reverseMap is a hard integration issue',
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor --json warns when GBrain extracts 0 links from exported wikilinks', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-json-gbrain-zero-links-');
  const bin = fakeGbrain(corpus);
  try {
    mkdirSync(join(corpus, '知识库', '实体'), { recursive: true });
    writeFileSync(
      join(corpus, '知识库', '概念', 'Anthropic-Harness.md'),
      [
        '---',
        'title: Anthropic Harness',
        'type: concept',
        '---',
        '',
        'Harness links to [[知识库/实体/Anthropic|Anthropic]].',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(corpus, '知识库', '实体', 'Anthropic.md'),
      ['---', 'title: Anthropic', 'type: entity', '---', '', 'Anthropic note.', ''].join('\n'),
    );
    const exportRun = runLorekit(['gbrain', 'export', '--json'], { cwd: corpus });
    assert.equal(exportRun.status, 0, fmtRun(exportRun, ['gbrain', 'export', '--json'], 'export exit 0'));

    const reportDir = join(corpus, '.wiki', 'integrations', 'gbrain');
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
      join(reportDir, 'sync-report.json'),
      JSON.stringify({ status: 'ok', extract: { links_created: 0 } }, null, 2),
      'utf-8',
    );

    const args = ['doctor', '--section', 'integrations', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: bin },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'zero-link extraction exits 0 with warning'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'warn');
    assert.ok(
      parsed.issues.some(
        (issue) => issue.severity === 'warn' && /extract created 0 links/i.test(issue.message),
      ),
      'zero extracted links is surfaced as an integration warning',
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor --json does not warn on 0 newly-created links when graph already has edges', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-json-gbrain-existing-links-');
  const bin = fakeGbrainWithGraph(corpus);
  try {
    mkdirSync(join(corpus, '知识库', '实体'), { recursive: true });
    writeFileSync(
      join(corpus, '知识库', '概念', 'Anthropic-Harness.md'),
      [
        '---',
        'title: Anthropic Harness',
        'type: concept',
        '---',
        '',
        'Harness links to [[知识库/实体/Anthropic|Anthropic]].',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(corpus, '知识库', '实体', 'Anthropic.md'),
      ['---', 'title: Anthropic', 'type: entity', '---', '', 'Anthropic note.', ''].join('\n'),
    );
    const exportRun = runLorekit(['gbrain', 'export', '--json'], { cwd: corpus });
    assert.equal(exportRun.status, 0, fmtRun(exportRun, ['gbrain', 'export', '--json'], 'export exit 0'));

    const reportDir = join(corpus, '.wiki', 'integrations', 'gbrain');
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
      join(reportDir, 'sync-report.json'),
      JSON.stringify({ status: 'ok', extract: { links_created: 0 } }, null, 2),
      'utf-8',
    );

    const args = ['doctor', '--section', 'integrations', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: bin },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'existing graph edges exits 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.ok(
      parsed.issues.every((issue) => !/extract created 0 links/i.test(issue.message)),
      'idempotent extract does not warn when graph already has edges',
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor --section integrations --json can inspect only integration health', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-json-section-');
  try {
    const args = ['doctor', '--section', 'integrations', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'integration warn exits 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'warn');
    assert.deepEqual(Object.keys(parsed.sections), ['integrations']);
    assert.equal(parsed.sections.integrations.gbrain.status, 'warn');
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
    assert.match(
      r.stderr,
      /valid: structure, metadata, index, archive, obsidian, integrations/i,
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('doctor --json hard-fails unreadable GBrain sync report', () => {
  const corpus = initCorpus('lorekit-smoke-doctor-json-bad-report-');
  try {
    const reportDir = join(corpus, '.wiki', 'integrations', 'gbrain');
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(join(reportDir, 'sync-report.json'), '{not json', 'utf-8');

    const args = ['doctor', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 1, fmtRun(r, args, 'integration error exits 1'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'error');
    assert.ok(
      parsed.issues.some(
        (issue) => issue.severity === 'error' && /sync report is unreadable/.test(issue.message),
      ),
      'unreadable sync report is a hard integration issue',
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});
