import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

function seedCorpus() {
  const corpus = mkTmpDir('lorekit-smoke-gbrain-export-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  const pageDir = join(corpus, '知识库', '概念');
  const page = join(pageDir, 'RAG.md');
  writeFileSync(
    page,
    [
      '---',
      'title: RAG',
      'type: concept',
      'slug: wrong/rag',
      'tags:',
      '  - retrieval',
      '---',
      '',
      'RAG is a retrieval pattern.',
      '',
      '<!-- timeline -->',
      '',
      '- 2026-05-12: Added note.',
      '',
    ].join('\n'),
  );
  writeFileSync(join(pageDir, '_INDEX.md'), '# Index\n');
  writeFileSync(join(pageDir, 'index.md'), '# Local index\n');
  mkdirSync(join(corpus, '知识库', '模板'), { recursive: true });
  writeFileSync(join(corpus, '知识库', '模板', 'concept.md'), '# Template\n');

  return { corpus, page };
}

function seedProjectionCorpus() {
  const corpus = mkTmpDir('lorekit-smoke-gbrain-projection-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

  const conceptDir = join(corpus, '知识库', '概念');
  const entityDir = join(corpus, '知识库', '实体');
  const otherDir = join(corpus, '知识库', '其他');
  mkdirSync(conceptDir, { recursive: true });
  mkdirSync(entityDir, { recursive: true });
  mkdirSync(otherDir, { recursive: true });

  const concept = join(conceptDir, 'Anthropic-Harness.md');
  writeFileSync(
    concept,
    [
      '---',
      'title: Anthropic Harness',
      'type: concept',
      'related:',
      '  - 知识库/实体/Anthropic',
      '---',
      '',
      'Anthropic Harness depends on [[知识库/实体/Anthropic|Anthropic]].',
      'Short aliases also point at [[实体/Anthropic|Anthropic]].',
      '',
      '```md',
      '[[知识库/实体/Anthropic|do not rewrite inside code]]',
      '```',
      '',
      '## Timeline',
      '',
      '- 2026-04-13 | Full date event.',
      '- 2026-04 | Month precision event.',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(entityDir, 'Anthropic.md'),
    [
      '---',
      'title: Anthropic',
      'type: entity',
      'gbrain:',
      '  kind: company',
      '---',
      '',
      'Anthropic is an AI lab.',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(otherDir, 'Acme Labs.md'),
    [
      '---',
      'title: Acme Labs',
      'gbrain:',
      '  kind: company',
      '---',
      '',
      'A company from an unmapped Lorekit directory.',
      '',
    ].join('\n'),
  );

  return { corpus, concept };
}

test('gbrain export --dry-run reports pages without writing export files', () => {
  const { corpus } = seedCorpus();
  try {
    const args = ['gbrain', 'export', '--dry-run', '--json'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.pagesExported, 1);
    assert.equal(parsed.pages[0].sourcePath, '知识库/概念/RAG.md');
    assert.ok(parsed.skipped.some((s) => s.sourcePath === '知识库/概念/_INDEX.md'));
    assert.ok(parsed.skipped.some((s) => s.sourcePath === '知识库/概念/index.md'));
    assert.ok(parsed.skipped.some((s) => s.sourcePath === '知识库/模板/concept.md'));
    assert.equal(existsSync(join(corpus, '.wiki', 'integrations', 'gbrain-export')), false);
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain export writes GBrain-safe markdown and manifest under .wiki only', () => {
  const { corpus, page } = seedCorpus();
  const before = readFileSync(page, 'utf-8');
  try {
    const args = ['gbrain', 'export', '--json'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.dryRun, false);
    assert.equal(parsed.pagesExported, 1);

    const exportRoot = join(corpus, '.wiki', 'integrations', 'gbrain-export');
    const manifestPath = join(exportRoot, 'manifest.json');
    const exportedPagePath = join(exportRoot, 'pages', 'concepts', 'rag.md');
    assert.equal(existsSync(manifestPath), true, 'manifest.json exists');
    assert.equal(existsSync(exportedPagePath), true, 'exported markdown exists');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.equal(manifest.integration, 'gbrain');
    assert.equal(manifest.pages[0].sourcePath, '知识库/概念/RAG.md');
    assert.equal(manifest.pages[0].exportPath, 'pages/concepts/rag.md');
    assert.equal(manifest.pages[0].gbrainSlug, 'concepts/rag');
    assert.equal(manifest.reverseMap['concepts/rag'], '知识库/概念/RAG.md');
    assert.match(manifest.pages[0].hash, /^sha256:/);

    const exported = readFileSync(exportedPagePath, 'utf-8');
    assert.doesNotMatch(exported, /^slug:/m, 'frontmatter slug is removed');
    assert.match(exported, /^lorekit_source_path: 知识库\/概念\/RAG\.md$/m);
    assert.match(exported, /^lorekit_layer: artifact$/m);
    assert.match(exported, /^lorekit_hash: '?sha256:/m);
    assert.match(exported, /^lorekit_exported_at: '?/m);
    assert.match(exported, /RAG is a retrieval pattern/);

    assert.equal(readFileSync(page, 'utf-8'), before, 'source wiki page is unchanged');
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain export projects canonical pages to GBrain-native slugs, links, and timeline', () => {
  const { corpus, concept } = seedProjectionCorpus();
  const before = readFileSync(concept, 'utf-8');
  try {
    const args = ['gbrain', 'export', '--json'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    const parsed = JSON.parse(r.stdout);
    const conceptPage = parsed.pages.find(
      (p) => p.sourcePath === '知识库/概念/Anthropic-Harness.md',
    );
    assert.ok(conceptPage, 'concept page is present in export result');
    assert.equal(conceptPage.gbrainSlug, 'concepts/anthropic-harness');
    assert.equal(conceptPage.exportPath, 'pages/concepts/anthropic-harness.md');
    assert.equal(conceptPage.kind, 'concept');
    assert.equal(parsed.reverseMap['concepts/anthropic-harness'], '知识库/概念/Anthropic-Harness.md');
    assert.equal(parsed.reverseMap['entities/anthropic'], '知识库/实体/Anthropic.md');
    assert.equal(parsed.reverseMap['companies/acme-labs'], '知识库/其他/Acme Labs.md');

    const exportRoot = join(corpus, '.wiki', 'integrations', 'gbrain-export');
    const exportedConceptPath = join(exportRoot, 'pages', 'concepts', 'anthropic-harness.md');
    const exportedEntityPath = join(exportRoot, 'pages', 'entities', 'anthropic.md');
    const exportedCompanyPath = join(exportRoot, 'pages', 'companies', 'acme-labs.md');
    assert.equal(existsSync(exportedConceptPath), true, 'projected concept markdown exists');
    assert.equal(existsSync(exportedEntityPath), true, 'projected entity markdown exists');
    assert.equal(existsSync(exportedCompanyPath), true, 'projected company markdown exists');

    const manifest = JSON.parse(readFileSync(join(exportRoot, 'manifest.json'), 'utf-8'));
    assert.equal(manifest.reverseMap['concepts/anthropic-harness'], '知识库/概念/Anthropic-Harness.md');

    const exported = readFileSync(exportedConceptPath, 'utf-8');
    assert.match(exported, /\[\[entities\/anthropic\|Anthropic\]\]/);
    assert.doesNotMatch(exported, /\[\[实体\/Anthropic/);
    assert.match(exported, /related:\n\s+- entities\/anthropic/);
    assert.match(exported, /- \*\*2026-04-13\*\* \| Full date event\./);
    assert.match(exported, /- 2026-04 \| Month precision event\./);
    assert.match(exported, /gbrain_low_precision_timeline:/);
    assert.match(exported, /\[\[知识库\/实体\/Anthropic\|do not rewrite inside code\]\]/);
    assert.match(readFileSync(exportedEntityPath, 'utf-8'), /^type: company$/m);
    assert.match(readFileSync(exportedCompanyPath, 'utf-8'), /^type: company$/m);

    assert.equal(readFileSync(concept, 'utf-8'), before, 'source wiki page is unchanged');
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain export rejects --out outside .wiki/integrations by default', () => {
  const { corpus } = seedCorpus();
  try {
    const args = ['gbrain', 'export', '--out', '../../outside', '--json'];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 2, fmtRun(r, args, 'exit 2 for unsafe --out'));
    assert.match(
      r.stderr,
      /invalid --out.*\.wiki\/integrations.*--allow-outside-corpus/is,
      fmtRun(r, args, 'stderr explains safe export root and override flag'),
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain export --allow-outside-corpus makes unsafe --out explicit', () => {
  const { corpus } = seedCorpus();
  try {
    const args = [
      'gbrain',
      'export',
      '--out',
      '../../outside',
      '--allow-outside-corpus',
      '--dry-run',
      '--json',
    ];
    const r = runLorekit(args, { cwd: corpus });
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0 with explicit unsafe override'));

    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.dryRun, true);
    assert.match(parsed.exportDir, /outside$/);
  } finally {
    cleanupTmpDir(corpus);
  }
});
