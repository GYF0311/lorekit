import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

function initCorpus() {
  const corpus = mkTmpDir('lorekit-smoke-sync-report-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));
  return corpus;
}

test('sync --json emits machine-readable step report', () => {
  const corpus = initCorpus();
  try {
    const args = ['sync', '--skip-doctor', '--json'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.steps.index.status, 'ok');
    assert.equal(parsed.steps.rootIndex.status, 'ok');
    const removedStep = ['vec', 'tor'].join('');
    assert.equal(removedStep in parsed.steps, false);
    assert.equal(parsed.steps.doctor.status, 'skipped');
    assert.equal(parsed.reportPath, null);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('sync --json awaits doctor and reports numeric issue count', () => {
  const corpus = initCorpus();
  try {
    const args = ['sync', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.status, 'ok');
    assert.equal(parsed.steps.doctor.status, 'ok');
    assert.equal(typeof parsed.steps.doctor.issues, 'number');
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('sync obsolete skip flag is no longer accepted', () => {
  const corpus = initCorpus();
  try {
    const obsoleteFlag = ['--skip', 'vec', 'tor'].join('-');
    const args = ['sync', obsoleteFlag];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 2, fmtRun(r, args, 'exit 2 (obsolete flag)'));
    assert.match(r.stderr, /unknown option/i, fmtRun(r, args, 'stderr 说明未知选项'));
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('sync --report writes report json under .wiki/reports/sync', () => {
  const corpus = initCorpus();
  try {
    const args = ['sync', '--skip-doctor', '--report'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const reportDir = join(corpus, '.wiki', 'reports', 'sync');
    const reports = readdirSync(reportDir).filter((name) => name.endsWith('.json'));
    assert.equal(reports.length, 1, 'one sync report is written');
    assert.equal(existsSync(join(reportDir, reports[0])), true);
  } finally {
    cleanupTmpDir(corpus);
  }
});
