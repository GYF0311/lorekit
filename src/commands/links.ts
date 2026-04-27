import type { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { requireCorpus, collectMdFiles } from '../lib/corpus.js';
import {
  collectLinkTargets,
  extractWikilinkLabels,
  collectWikilinkOccurrences,
  labelToSlug,
  plainWikilinkLabel,
  relStem,
  replaceWikilinkLabel,
  resolveLabel,
  type LinkTarget,
  type WikilinkOccurrence,
} from '../lib/wikilinks.js';
import { dateToYMDLocal } from '../lib/date.js';
import { lintSkipBrokenLinkPrefixes } from '../lib/paths.js';
import { createSnapshot } from './snapshot.js';
import { ok, bad, print, out } from '../utils/logger.js';

interface LinkSuggestion {
  label: string;
  occurrences: WikilinkOccurrence[];
  seenCount: number;
  similarPages: { slug: string; file: string; title?: string; type?: string }[];
  suggestedAction: 'fix' | 'stub';
  suggestedPath: string;
}

function typeDir(type: string): string {
  if (type === 'entity') return '知识库/实体';
  return '知识库/概念';
}

function suggestedPath(label: string, type = 'concept'): string {
  return `${typeDir(type)}/${labelToSlug(label)}.md`;
}

function targetIsCanonical(label: string, target: LinkTarget): boolean {
  return label === target.slug || label === relStem(target.file);
}

function collectFileOccurrences(corpus: string, rel: string): WikilinkOccurrence[] {
  const abs = resolveCorpusFile(corpus, rel);
  if (!existsSync(abs)) throw new Error(`file not found: ${rel}`);
  const content = readFileSync(abs, 'utf-8');
  return extractWikilinkLabels(content).map((label) => ({ file: rel, label }));
}

function normalizeRelPath(rel: string): string {
  return rel.split(sep).join('/');
}

function shouldIgnoreFullCorpusOccurrence(occ: WikilinkOccurrence): boolean {
  const rel = normalizeRelPath(occ.file);
  if (rel.startsWith('_工作台/') && rel.includes('/node_modules/')) return true;
  return lintSkipBrokenLinkPrefixes.some((prefix) => rel.startsWith(prefix));
}

export function buildLinkSuggestions(corpus: string, opts: { file?: string } = {}): LinkSuggestion[] {
  const targets = collectLinkTargets(corpus);
  const grouped = new Map<string, WikilinkOccurrence[]>();
  const rawOccurrences = opts.file
    ? collectFileOccurrences(corpus, opts.file)
    : collectWikilinkOccurrences(corpus);
  const occurrences = opts.file
    ? rawOccurrences
    : rawOccurrences.filter((occ) => !shouldIgnoreFullCorpusOccurrence(occ));
  for (const occ of occurrences) {
    (grouped.get(occ.label) ?? grouped.set(occ.label, []).get(occ.label)!).push(occ);
  }

  const suggestions: LinkSuggestion[] = [];
  for (const [label, occurrences] of grouped) {
    const target = resolveLabel(label, targets);
    if (target && targetIsCanonical(label, target)) continue;
    if (target) {
      suggestions.push({
        label,
        occurrences,
        seenCount: occurrences.length,
        similarPages: [
          { slug: target.slug, file: target.file, title: target.title, type: target.type },
        ],
        suggestedAction: 'fix',
        suggestedPath: `${target.slug}.md`,
      });
      continue;
    }
    suggestions.push({
      label,
      occurrences,
      seenCount: occurrences.length,
      similarPages: [],
      suggestedAction: 'stub',
      suggestedPath: suggestedPath(label),
    });
  }
  return suggestions.sort((a, b) => a.label.localeCompare(b.label));
}

function printSuggest(corpus: string, suggestions: LinkSuggestion[]): void {
  print(`\nlorekit links suggest — ${corpus}\n`);
  if (suggestions.length === 0) {
    ok('no link closure suggestions');
    return;
  }
  for (const s of suggestions) {
    print(`- ${s.label}: ${s.suggestedAction} (${s.seenCount} occurrence(s))`);
    if (s.similarPages[0]) print(`  → ${s.similarPages[0].slug}`);
    else print(`  → ${s.suggestedPath}`);
  }
}

async function withSnapshot(corpus: string, tag: string): Promise<void> {
  await createSnapshot(corpus, { tag });
}

function writeCandidateState(corpus: string, suggestions: LinkSuggestion[]): void {
  const file = join(corpus, '.wiki', 'link-candidates.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), suggestions }, null, 2) +
      '\n',
    'utf-8',
  );
}

function resolveCorpusFile(corpus: string, rel: string): string {
  const abs = resolve(corpus, rel);
  const fromCorpus = relative(corpus, abs);
  if (fromCorpus === '' || fromCorpus === '..' || fromCorpus.startsWith(`..${sep}`)) {
    throw new Error(`file is outside corpus: ${rel}`);
  }
  return abs;
}

async function fixLink(
  corpus: string,
  label: string,
  opts: { to: string; alias?: string; file?: string },
): Promise<number> {
  const files = opts.file ? [resolveCorpusFile(corpus, opts.file)] : collectMdFiles(corpus);
  if (opts.file && !existsSync(files[0])) throw new Error(`file not found: ${opts.file}`);
  const target = resolveLabel(relStem(opts.to), collectLinkTargets(corpus));
  if (!target) throw new Error(`canonical target not found: ${opts.to}`);
  await withSnapshot(corpus, 'links-fix');
  let changed = 0;
  for (const filePath of files) {
    const before = readFileSync(filePath, 'utf-8');
    const result = replaceWikilinkLabel(before, label, target.slug, { alias: opts.alias });
    if (result.count === 0) continue;
    writeFileSync(filePath, result.content, 'utf-8');
    changed += result.count;
  }
  return changed;
}

async function stubLink(
  corpus: string,
  label: string,
  opts: { type: string; source?: string },
): Promise<string> {
  await withSnapshot(corpus, 'links-stub');
  const dir = typeDir(opts.type);
  const rel = suggestedPath(label, opts.type);
  const abs = join(corpus, rel);
  if (!existsSync(abs)) {
    mkdirSync(dirname(abs), { recursive: true });
    const today = dateToYMDLocal(new Date());
    const type = opts.type === 'entity' ? 'entity' : 'concept';
    const sourceStem = opts.source ? opts.source.replace(/\.md$/, '') : undefined;
    const timeline = sourceStem
      ? `- ${today} | 在 [[${sourceStem}]] 中作为相关节点出现，当前来源不足，待补独立来源。`
      : `- ${today} | 由 links closure 创建 stub，待补独立来源。`;
    writeFileSync(
      abs,
      `---\n` +
        `type: ${type}\n` +
        `title: ${label}\n` +
        `slug: ${dir}/${labelToSlug(label)}\n` +
        `created: ${today}\n` +
        `updated: ${today}\n` +
        `confidence: low\n` +
        `status: stub\n` +
        `---\n\n` +
        `# ${label}\n\n` +
        `## Compiled Truth\n\n` +
        `${label} 是当前 corpus 中出现的待补充节点。当前来源不足，暂不写成正式结论，等待后续独立来源补强。\n\n` +
        `## Timeline\n\n${timeline}\n`,
      'utf-8',
    );
  }
  return rel;
}

async function backlogLink(
  corpus: string,
  label: string,
  opts: { type: string; source?: string },
): Promise<string> {
  await withSnapshot(corpus, 'links-backlog');
  const rel = '系统/missing-nodes.md';
  const abs = join(corpus, rel);
  mkdirSync(dirname(abs), { recursive: true });
  const today = dateToYMDLocal(new Date());
  const sourceStem = opts.source ? opts.source.replace(/\.md$/, '') : '(unrecorded)';
  let content = '';
  if (!existsSync(abs)) {
    content =
      `---\n` +
      `type: system\n` +
      `title: Missing Nodes\n` +
      `slug: 系统/missing-nodes\n` +
      `created: ${today}\n` +
      `updated: ${today}\n` +
      `graph-excluded: true\n` +
      `---\n\n` +
      `# Missing Nodes\n\n`;
  } else {
    content = readFileSync(abs, 'utf-8');
  }
  if (!content.includes(`- [ ] ${label}\n`)) {
    content +=
      `- [ ] ${label}\n` +
      `  - type: ${opts.type}\n` +
      `  - first_seen: ${today}\n` +
      `  - seen_in: [[${sourceStem}]]\n` +
      `  - suggested_path: ${suggestedPath(label, opts.type)}\n` +
      `\n`;
    content = content.replace(/^updated: .+$/m, `updated: ${today}`);
    writeFileSync(abs, content, 'utf-8');
  }
  return rel;
}

async function plainLink(corpus: string, label: string, opts: { file: string }): Promise<number> {
  const abs = resolveCorpusFile(corpus, opts.file);
  if (!existsSync(abs)) throw new Error(`file not found: ${opts.file}`);
  await withSnapshot(corpus, 'links-plain');
  const before = readFileSync(abs, 'utf-8');
  const result = plainWikilinkLabel(before, label);
  if (result.count > 0) writeFileSync(abs, result.content, 'utf-8');
  return result.count;
}

export function linksCommand(program: Command): void {
  const links = program.command('links').description('inspect and close wikilink candidates');

  links
    .command('suggest')
    .description('suggest fixes for non-canonical or unresolved wikilinks')
    .option('--json', 'print suggestions as JSON to stdout', false)
    .option('--write-state', 'update .wiki/link-candidates.json machine state', false)
    .option('--file <file>', 'limit suggestions to one markdown file')
    .action((opts: { json?: boolean; writeState?: boolean; file?: string }) => {
      const corpus = requireCorpus();
      try {
        const suggestions = buildLinkSuggestions(corpus, opts);
        if (opts.writeState) writeCandidateState(corpus, suggestions);
        if (opts.json) out(JSON.stringify({ suggestions }, null, 2));
        else printSuggest(corpus, suggestions);
        if (suggestions.length > 0) process.exitCode = 1;
      } catch (e) {
        bad((e as Error).message);
        process.exitCode = 1;
      }
    });

  links
    .command('fix <label>')
    .requiredOption('--to <slug>', 'canonical target slug')
    .option('--alias <text>', 'visible alias')
    .option('--file <file>', 'limit rewrite to one markdown file')
    .description('rewrite wikilinks to an existing canonical page')
    .action(async (label: string, opts: { to: string; alias?: string; file?: string }) => {
      const corpus = requireCorpus();
      try {
        const count = await fixLink(corpus, label, opts);
        ok(`rewrote ${count} link(s) for ${label}`);
      } catch (e) {
        bad((e as Error).message);
        process.exitCode = 1;
      }
    });

  links
    .command('stub <label>')
    .requiredOption('--type <type>', 'concept|entity')
    .option('--source <file>', 'source file where the node was seen')
    .description('create a low-confidence stub page')
    .action(async (label: string, opts: { type: string; source?: string }) => {
      const corpus = requireCorpus();
      const rel = await stubLink(corpus, label, opts);
      ok(`stub ready: ${rel}`);
    });

  links
    .command('backlog <label>')
    .requiredOption('--type <type>', 'concept|entity')
    .option('--source <file>', 'source file where the node was seen')
    .description('record a missing node without creating a page')
    .action(async (label: string, opts: { type: string; source?: string }) => {
      const corpus = requireCorpus();
      const rel = await backlogLink(corpus, label, opts);
      ok(`backlog updated: ${rel}`);
    });

  links
    .command('plain <label>')
    .requiredOption('--file <file>', 'file to edit')
    .description('downgrade a wikilink label to plain text in one file')
    .action(async (label: string, opts: { file: string }) => {
      const corpus = requireCorpus();
      try {
        const count = await plainLink(corpus, label, opts);
        ok(`downgraded ${count} link(s) for ${label}`);
      } catch (e) {
        bad((e as Error).message);
        process.exitCode = 1;
      }
    });
}
