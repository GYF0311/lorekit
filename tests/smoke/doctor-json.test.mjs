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
