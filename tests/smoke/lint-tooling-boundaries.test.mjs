import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

beforeEach(() => {
  corpus = mkTmpDir('lorekit-tooling-boundary-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  const skillDir = join(corpus, 'skills', 'wiki-lint');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    [
      '---',
      'name: wiki-lint',
      'description: Agent workflow pack, not a wiki page',
      '---',
      '',
      '# wiki-lint',
      '',
      'Example placeholder link [[Not A Wiki Page]].',
      '',
    ].join('\n'),
    'utf-8',
  );

  const packageDir = join(corpus, '知识库', 'vendor', 'node_modules', 'fast-glob');
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, 'README.md'), 'Package docs mention [[options]].\n', 'utf-8');
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('lint ignores project-local skills and node_modules markdown', () => {
  const args = ['lint'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'tooling markdown should not be linted'));
  assert.doesNotMatch(r.stdout + r.stderr, /skills\/wiki-lint/);
  assert.doesNotMatch(r.stdout + r.stderr, /node_modules/);
});

test('lint --quick is accepted as a documented compatibility alias', () => {
  const args = ['lint', '--quick'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, '--quick should not be an unknown option'));
});

test('sync --skip-vector does not generate _INDEX.md under tooling directories', () => {
  const args = ['sync', '--skip-vector', '--skip-doctor'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'sync should ignore tooling directories'));
  assert.equal(existsSync(join(corpus, 'skills', 'wiki-lint', '_INDEX.md')), false);
  assert.equal(
    existsSync(join(corpus, '知识库', 'vendor', 'node_modules', 'fast-glob', '_INDEX.md')),
    false,
  );
});
