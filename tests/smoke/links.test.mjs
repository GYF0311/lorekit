import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function seedLinksCorpus() {
  write('知识库/实体/Claude-Code.md', `---
type: entity
title: Claude Code
slug: 知识库/实体/Claude-Code
created: 2026-04-27
updated: 2026-04-27
aliases: [Claude Code]
---

# Claude Code

## Compiled Truth

Claude Code exists.
`);
  write('知识库/概念/Anthropic-Harness.md', `---
type: concept
title: Anthropic Harness
slug: 知识库/概念/Anthropic-Harness
created: 2026-04-27
updated: 2026-04-27
---

# Anthropic Harness

## Compiled Truth

Related to [[Claude Code]], [[Claude Code|CC]], [[Claude Code#usage|Old Alias]], [[MCP]], and [[普通词#note|普通词别名]].

Examples should stay literal:

\`\`\`md
[[Claude Code]]
[[普通词]]
\`\`\`

~~~md
[[Claude Code|CC]]
~~~
`);
  write('知识库/概念/Other.md', `---
type: concept
title: Other
slug: 知识库/概念/Other
created: 2026-04-27
updated: 2026-04-27
graph-excluded: true
---

# Other

## Compiled Truth

Scoped fix should not rewrite [[Claude Code]] here.
`);
  write('_工作台/Coding/demo/node_modules/pkg/README.md', `# Package

This package README references [[options]] as local documentation.
`);
  write('知识库/模板/entity-template.md', `---
type: template
title: Entity Template
slug: 知识库/模板/entity-template
created: 2026-04-27
updated: 2026-04-27
---

# Entity Template

Replace placeholder with [[知识库/摘要/xxx]] when creating a page.
`);
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-smoke-links-');
  const args = ['init', '.'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 0, fmtRun(r, args, 'init exit 0'));
  seedLinksCorpus();
});

afterEach(() => {
  if (corpus) cleanupTmpDir(corpus);
});

test('links suggest reports broken labels and existing canonical candidates', () => {
  const args = ['links', 'suggest', '--json'];
  const r = runLorekit(args, { cwd: corpus });
  assert.equal(r.status, 1, fmtRun(r, args, 'suggest exits 1 when unresolved links exist'));
  const parsed = JSON.parse(r.stdout);
  const claude = parsed.suggestions.find((s) => s.label === 'Claude Code');
  assert.ok(claude, 'Claude Code suggestion should exist');
  assert.equal(claude.suggestedAction, 'fix');
  assert.equal(claude.similarPages[0].slug, '知识库/实体/Claude-Code');
  const mcp = parsed.suggestions.find((s) => s.label === 'MCP');
  assert.ok(mcp, 'MCP suggestion should exist');
  assert.equal(mcp.suggestedPath, '知识库/概念/MCP.md');
  assert.equal(
    parsed.suggestions.some((s) => s.label === 'options'),
    false,
    'full-corpus suggest should ignore workbench node_modules wikilinks',
  );
  assert.equal(
    parsed.suggestions.some((s) => s.label === '知识库/摘要/xxx'),
    false,
    'full-corpus suggest should ignore template placeholder wikilinks',
  );

  const stateArgs = ['links', 'suggest', '--json', '--write-state'];
  const state = runLorekit(stateArgs, { cwd: corpus });
  assert.equal(state.status, 1, fmtRun(state, stateArgs, 'suggest state exits 1'));
  assert.ok(existsSync(join(corpus, '.wiki/link-candidates.json')));

  const scopedArgs = [
    'links',
    'suggest',
    '--file',
    '知识库/概念/Anthropic-Harness.md',
    '--json',
  ];
  const scoped = runLorekit(scopedArgs, { cwd: corpus });
  assert.equal(scoped.status, 1, fmtRun(scoped, scopedArgs, 'scoped suggest exits 1'));
  const scopedJson = JSON.parse(scoped.stdout);
  assert.equal(
    scopedJson.suggestions.every((s) =>
      s.occurrences.every((occ) => occ.file === '知识库/概念/Anthropic-Harness.md'),
    ),
    true,
    'scoped suggest should only report occurrences from the requested file',
  );
});

test('links fix, stub, backlog, and plain close broken links deterministically', () => {
  const trashDir = join(corpus, '.test-trash');

  const badFixArgs = [
    'links',
    'fix',
    'Claude Code',
    '--to',
    '知识库/实体/Missing',
    '--file',
    '知识库/概念/Anthropic-Harness.md',
  ];
  const badFix = runLorekit(badFixArgs, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(badFix.status, 1, fmtRun(badFix, badFixArgs, 'links fix rejects missing target'));
  assert.match(read('知识库/概念/Anthropic-Harness.md'), /\[\[Claude Code\]\]/);

  const fixArgs = [
    'links',
    'fix',
    'Claude Code',
    '--to',
    '知识库/实体/Claude-Code',
    '--alias',
    'Claude Code',
    '--file',
    '知识库/概念/Anthropic-Harness.md',
  ];
  const fixed = runLorekit(fixArgs, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(fixed.status, 0, fmtRun(fixed, fixArgs, 'links fix exit 0'));
  assert.match(
    read('知识库/概念/Anthropic-Harness.md'),
    /\[\[知识库\/实体\/Claude-Code\|Claude Code\]\]/,
  );
  assert.match(
    read('知识库/概念/Anthropic-Harness.md'),
    /\[\[知识库\/实体\/Claude-Code#usage\|Claude Code\]\]/,
  );
  assert.doesNotMatch(read('知识库/概念/Anthropic-Harness.md'), /\|Claude Code\|/);
  assert.match(read('知识库/概念/Other.md'), /\[\[Claude Code\]\]/);
  assert.match(read('知识库/概念/Anthropic-Harness.md'), /```md\n\[\[Claude Code\]\]/);
  assert.match(read('知识库/概念/Anthropic-Harness.md'), /~~~md\n\[\[Claude Code\|CC\]\]/);

  const stubArgs = [
    'links',
    'stub',
    'MCP',
    '--type',
    'concept',
    '--source',
    '知识库/概念/Anthropic-Harness.md',
  ];
  const stub = runLorekit(stubArgs, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(stub.status, 0, fmtRun(stub, stubArgs, 'links stub exit 0'));
  assert.ok(existsSync(join(corpus, '知识库/概念/MCP.md')));
  assert.match(read('知识库/概念/MCP.md'), /^status: stub$/m);
  assert.match(read('知识库/概念/MCP.md'), /^confidence: low$/m);

  const backlogArgs = [
    'links',
    'backlog',
    'Future Node',
    '--type',
    'concept',
    '--source',
    '知识库/概念/Anthropic-Harness.md',
  ];
  const backlog = runLorekit(backlogArgs, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(backlog.status, 0, fmtRun(backlog, backlogArgs, 'links backlog exit 0'));
  assert.match(read('系统/missing-nodes.md'), /Future Node/);

  const plainArgs = ['links', 'plain', '普通词', '--file', '知识库/概念/Anthropic-Harness.md'];
  const plain = runLorekit(plainArgs, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(plain.status, 0, fmtRun(plain, plainArgs, 'links plain exit 0'));
  assert.match(
    read('知识库/概念/Anthropic-Harness.md'),
    /Related to \[\[知识库\/实体\/Claude-Code\|Claude Code\]\], \[\[知识库\/实体\/Claude-Code\|Claude Code\]\], \[\[知识库\/实体\/Claude-Code#usage\|Claude Code\]\], \[\[MCP\]\], and 普通词别名\./,
  );
  assert.match(read('知识库/概念/Anthropic-Harness.md'), /```md\n\[\[Claude Code\]\]\n\[\[普通词\]\]/);

  const outsideArgs = ['links', 'plain', 'MCP', '--file', '../outside.md'];
  const outside = runLorekit(outsideArgs, {
    cwd: corpus,
    env: { LOREKIT_TEST_TRASH_DIR: trashDir },
    timeout: 60_000,
  });
  assert.equal(outside.status, 1, fmtRun(outside, outsideArgs, 'outside file rejected'));

  const lintArgs = ['lint'];
  const lint = runLorekit(lintArgs, { cwd: corpus });
  assert.equal(lint.status, 0, fmtRun(lint, lintArgs, 'lint clean after link closure'));
});
