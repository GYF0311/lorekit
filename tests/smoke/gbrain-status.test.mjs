import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

test('gbrain status --json reports missing binary without crashing', () => {
  const corpus = mkTmpDir('lorekit-smoke-gbrain-status-');
  try {
    const init = runLorekit(['init', '.'], { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

    const args = ['gbrain', 'status', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: '__missing_lorekit_gbrain_binary__' },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'status is informational'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.installed, false);
    assert.equal(parsed.binary, '__missing_lorekit_gbrain_binary__');
    assert.match(parsed.installHint, /git clone https:\/\/github\.com\/garrytan\/gbrain\.git/);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain status --json respects project-local GBRAIN_HOME', () => {
  const corpus = mkTmpDir('lorekit-smoke-gbrain-status-home-');
  const brainHome = mkTmpDir('lorekit-smoke-gbrain-home-');
  try {
    const init = runLorekit(['init', '.'], { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

    const bin = join(corpus, 'fake-gbrain');
    writeFileSync(
      bin,
      ['#!/bin/sh', 'if [ "$1" = "--version" ]; then echo "gbrain 0.35.4.0"; exit 0; fi', 'exit 0', ''].join(
        '\n',
      ),
    );
    chmodSync(bin, 0o755);
    mkdirSync(join(brainHome, '.gbrain'), { recursive: true });

    const args = ['gbrain', 'status', '--json'];
    const r = runLorekit(args, {
      cwd: corpus,
      env: { LOREKIT_GBRAIN_BIN: bin, GBRAIN_HOME: brainHome },
    });
    assert.equal(r.status, 0, fmtRun(r, args, 'status is informational'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.installed, true);
    assert.equal(parsed.brainInitialized, true);
  } finally {
    cleanupTmpDir(corpus);
    cleanupTmpDir(brainHome);
  }
});
