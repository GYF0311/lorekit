import type { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import matter from 'gray-matter';
import trash from 'trash';
import { collectMdFiles, extractFrontmatter, findSourceByUrl, requireCorpus } from '../lib/corpus.js';
import { isWithin } from '../lib/paths.js';
import { loadIngestState, saveIngestState } from '../lib/ingest-state.js';
import { todayYMDShanghai, tsCompact } from '../lib/date.js';
import { createSnapshot } from './snapshot.js';
import { runSync } from './sync.js';
import { printLintReport, runLint } from './lint.js';
import { pruneVectorDbMissingFiles } from '../lib/vectordb/prune.js';
import { bad, err, ok, out, print } from '../utils/logger.js';

interface TrashTarget {
  rel: string;
  abs: string;
  reason: 'target' | 'source' | 'summary';
}

interface PageChange {
  file: string;
  removedLines: string[];
  removedSources: string[];
  sourceCountBefore?: number;
  sourceCountAfter?: number;
}

interface ReviewItem {
  file: string;
  section: 'Compiled Truth';
  text: string;
}

interface RemovalPlan {
  input: string;
  apply: boolean;
  trashTargets: TrashTarget[];
  pageChanges: PageChange[];
  reviewItems: ReviewItem[];
  ingestRecords: string[];
  aliases: string[];
  snapshot?: string;
  syncSkippedVector?: boolean;
  vectorPruned?: number;
  lintIssues?: number;
}

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function toSlash(p: string): string {
  return p.split(sep).join('/');
}

function stripMd(rel: string): string {
  return rel.replace(/\.md$/, '');
}

function normalizeRel(rel: string): string {
  return toSlash(rel).replace(/^\.\//, '').replace(/\/+/g, '/');
}

function resolveInputPath(corpus: string, input: string): string | null {
  const candidates = [];
  const rawAbs = isAbsolute(input) ? input : join(corpus, input);
  candidates.push(rawAbs);
  if (!input.endsWith('.md')) candidates.push(`${rawAbs}.md`);
  for (const candidate of candidates) {
    const abs = resolve(candidate);
    if (isWithin(corpus, abs) && existsSync(abs)) return abs;
  }
  return null;
}

function relFromAbs(corpus: string, abs: string): string {
  return normalizeRel(relative(corpus, abs));
}

function aliasesForRel(rel: string): string[] {
  const aliases = new Set<string>();
  const normalized = normalizeRel(rel);
  aliases.add(stripMd(normalized));
  if (normalized.endsWith('/article.md')) {
    aliases.add(stripMd(normalized).replace(/\/article$/, ''));
  }
  return [...aliases];
}

function readText(abs: string): string {
  return readFileSync(abs, 'utf-8');
}

function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(content)) !== null) links.push(m[1].trim());
  return links;
}

function addExistingTarget(
  corpus: string,
  targets: Map<string, TrashTarget>,
  relOrAbs: string,
  reason: TrashTarget['reason'],
): void {
  const abs = isAbsolute(relOrAbs) ? relOrAbs : join(corpus, relOrAbs);
  if (!existsSync(abs)) return;
  const rel = relFromAbs(corpus, abs);
  targets.set(rel, { rel, abs, reason });
}

function addSourceTarget(
  corpus: string,
  targets: Map<string, TrashTarget>,
  relOrAbs: string,
): void {
  const abs = isAbsolute(relOrAbs) ? relOrAbs : join(corpus, relOrAbs);
  if (!existsSync(abs)) return;

  const rel = relFromAbs(corpus, abs);
  if (rel.endsWith('/article.md')) {
    addExistingTarget(corpus, targets, dirname(abs), 'source');
    return;
  }

  addExistingTarget(corpus, targets, abs, 'source');

  if (rel.endsWith('.md')) {
    const assetsDir = abs.replace(/\.md$/, '.assets');
    addExistingTarget(corpus, targets, assetsDir, 'source');
  }
}

function sourceCandidatesForSlug(corpus: string, slug: string): string[] {
  return [
    join(corpus, slug),
    join(corpus, `${slug}.md`),
    join(corpus, slug, 'article.md'),
  ];
}

function collectSourceUrls(corpus: string, targets: Map<string, TrashTarget>): string[] {
  const urls = new Set<string>();
  for (const target of targets.values()) {
    const files = existsSync(target.abs) && target.rel.endsWith('.md')
      ? [target.abs]
      : collectMdFiles(target.abs);
    for (const file of files) {
      const fm = extractFrontmatter(file);
      if (typeof fm.source_url === 'string') urls.add(fm.source_url);
      if (typeof fm.url === 'string') urls.add(fm.url);
    }
  }
  return [...urls];
}

function addSourcesFromSummary(
  corpus: string,
  targets: Map<string, TrashTarget>,
  summaryAbs: string,
): void {
  const parsed = matter(readText(summaryAbs));
  const sources = Array.isArray(parsed.data.sources) ? parsed.data.sources : [];
  for (const source of sources) {
    if (typeof source !== 'string') continue;
    for (const candidate of sourceCandidatesForSlug(corpus, source)) {
      if (existsSync(candidate)) addSourceTarget(corpus, targets, candidate);
    }
  }

  for (const link of extractWikilinks(parsed.content)) {
    if (!link.startsWith('原料/')) continue;
    for (const candidate of sourceCandidatesForSlug(corpus, link)) {
      if (existsSync(candidate)) addSourceTarget(corpus, targets, candidate);
    }
  }
}

function addSummariesReferencingSources(
  corpus: string,
  targets: Map<string, TrashTarget>,
  aliases: Set<string>,
): void {
  for (const file of collectMdFiles(join(corpus, '知识库', '摘要'))) {
    const rel = relFromAbs(corpus, file);
    if (targets.has(rel)) continue;
    const content = readText(file);
    if ([...aliases].some((alias) => content.includes(`[[${alias}`))) {
      addExistingTarget(corpus, targets, file, 'summary');
      addSourcesFromSummary(corpus, targets, file);
    }
  }
}

function compiledTruthSnippets(content: string, aliases: Set<string>, input: string): string[] {
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  const match = body.match(/##\s*Compiled Truth\s*\n+([\s\S]*?)(?=\n##\s|$)/);
  if (!match) return [];
  return match[1]
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;
      if (isUrl(input) && p.includes(input)) return true;
      return [...aliases].some((alias) => p.includes(`[[${alias}`));
    });
}

function rewritePageForRemoval(
  corpus: string,
  file: string,
  aliases: Set<string>,
): { change: PageChange | null; nextContent: string } {
  const rel = relFromAbs(corpus, file);
  const parsed = matter(readText(file));
  const removedSources: string[] = [];
  let sourceCountBefore: number | undefined;
  let sourceCountAfter: number | undefined;

  if (Array.isArray(parsed.data.sources)) {
    const nextSources = parsed.data.sources.filter((source: unknown) => {
      if (typeof source !== 'string') return true;
      const remove = aliases.has(stripMd(normalizeRel(source)));
      if (remove) removedSources.push(source);
      return !remove;
    });
    if (removedSources.length > 0) {
      parsed.data.sources = nextSources;
      const rawCount = parsed.data.source_count;
      const numeric =
        typeof rawCount === 'number'
          ? rawCount
          : typeof rawCount === 'string'
            ? Number.parseInt(rawCount, 10)
            : Number.NaN;
      if (Number.isFinite(numeric)) {
        sourceCountBefore = numeric;
        sourceCountAfter = Math.max(0, numeric - new Set(removedSources).size);
        parsed.data.source_count = sourceCountAfter;
      }
      parsed.data.updated = todayYMDShanghai();
    }
  }

  const removedLines: string[] = [];
  const nextLines = parsed.content.split('\n').filter((line) => {
    const trimmed = line.trim();
    const hasTargetLink = [...aliases].some((alias) => line.includes(`[[${alias}`));
    const removable = hasTargetLink && /^[-*]\s+/.test(trimmed);
    if (removable) {
      removedLines.push(line);
      return false;
    }
    return true;
  });
  if (removedLines.length > 0) parsed.data.updated = todayYMDShanghai();

  const changed = removedLines.length > 0 || removedSources.length > 0;
  const nextContent = changed ? matter.stringify(nextLines.join('\n'), parsed.data) : readText(file);

  return {
    nextContent,
    change: changed
      ? {
          file: rel,
          removedLines,
          removedSources,
          sourceCountBefore,
          sourceCountAfter,
        }
      : null,
  };
}

function buildRemovalPlan(corpus: string, input: string, apply: boolean): RemovalPlan {
  const targets = new Map<string, TrashTarget>();
  const ingestRecords = new Set<string>();

  if (isUrl(input)) {
    const state = loadIngestState(corpus);
    const record = state.ingests[input];
    ingestRecords.add(input);
    if (record?.archivedTo) addSourceTarget(corpus, targets, record.archivedTo);
    for (const page of record?.wikiPages ?? []) {
      if (normalizeRel(page).startsWith('知识库/摘要/')) {
        const pageAbs = join(corpus, page);
        addExistingTarget(corpus, targets, pageAbs, 'summary');
        if (existsSync(pageAbs)) addSourcesFromSummary(corpus, targets, pageAbs);
      }
    }
    const source = findSourceByUrl(corpus, input);
    if (source) addSourceTarget(corpus, targets, source);
  } else {
    const abs = resolveInputPath(corpus, input);
    if (!abs) throw new Error(`target not found inside corpus: ${input}`);
    const rel = relFromAbs(corpus, abs);
    if (rel.startsWith('原料/')) {
      addSourceTarget(corpus, targets, abs);
    } else if (rel.startsWith('知识库/摘要/')) {
      addExistingTarget(corpus, targets, abs, 'summary');
      addSourcesFromSummary(corpus, targets, abs);
    } else {
      addExistingTarget(corpus, targets, abs, 'target');
    }
  }

  let aliases = new Set([...targets.keys()].flatMap((rel) => aliasesForRel(rel)));
  addSummariesReferencingSources(corpus, targets, aliases);
  aliases = new Set([...targets.keys()].flatMap((rel) => aliasesForRel(rel)));

  for (const url of collectSourceUrls(corpus, targets)) ingestRecords.add(url);

  const trashedRels = new Set(targets.keys());
  const pageChanges: PageChange[] = [];
  const reviewItems: ReviewItem[] = [];
  for (const file of collectMdFiles(corpus)) {
    const rel = relFromAbs(corpus, file);
    if (trashedRels.has(rel)) continue;
    if ([...trashedRels].some((targetRel) => rel.startsWith(`${targetRel}/`))) continue;

    const { change } = rewritePageForRemoval(corpus, file, aliases);
    if (change) pageChanges.push(change);
    for (const text of compiledTruthSnippets(readText(file), aliases, input)) {
      reviewItems.push({ file: rel, section: 'Compiled Truth', text });
    }
  }

  return {
    input,
    apply,
    trashTargets: [...targets.values()].sort((a, b) => a.rel.localeCompare(b.rel)),
    pageChanges,
    reviewItems,
    ingestRecords: [...ingestRecords],
    aliases: [...aliases].sort(),
  };
}

async function moveToTrash(paths: string[]): Promise<void> {
  const testTrashDir = process.env.LOREKIT_TEST_TRASH_DIR;
  if (testTrashDir) {
    mkdirSync(testTrashDir, { recursive: true });
    for (const p of paths) {
      if (!existsSync(p)) continue;
      const dest = join(testTrashDir, `${tsCompact()}-${basename(p)}`);
      renameSync(p, dest);
    }
    return;
  }
  await trash(paths, { glob: false });
}

function applyPageChanges(corpus: string, plan: RemovalPlan): void {
  const aliases = new Set(plan.aliases);
  for (const change of plan.pageChanges) {
    const file = join(corpus, change.file);
    const { nextContent } = rewritePageForRemoval(corpus, file, aliases);
    writeFileSync(file, nextContent, 'utf-8');
  }
}

function forgetIngestRecords(corpus: string, urls: string[]): void {
  if (urls.length === 0) return;
  const state = loadIngestState(corpus);
  let changed = false;
  for (const url of urls) {
    if (state.ingests[url]) {
      delete state.ingests[url];
      changed = true;
    }
  }
  if (changed) saveIngestState(corpus, state);
}

function printPlan(plan: RemovalPlan): void {
  print(`lorekit remove — ${plan.apply ? 'apply' : 'dry-run'}\n`);

  print(`将移动到系统回收站 (${plan.trashTargets.length})`);
  for (const target of plan.trashTargets) {
    print(`  - ${target.rel} (${target.reason})`);
  }
  if (plan.trashTargets.length === 0) print('  - （无）');
  print();

  print(`将修改页面 (${plan.pageChanges.length})`);
  for (const change of plan.pageChanges) {
    print(`  - ${change.file}`);
    if (change.removedSources.length > 0) {
      print(`    sources: -${change.removedSources.length}`);
    }
    if (change.sourceCountBefore !== undefined && change.sourceCountAfter !== undefined) {
      print(`    source_count: ${change.sourceCountBefore} -> ${change.sourceCountAfter}`);
    }
    if (change.removedLines.length > 0) {
      print(`    lines: -${change.removedLines.length}`);
    }
  }
  if (plan.pageChanges.length === 0) print('  - （无）');
  print();

  if (plan.reviewItems.length > 0) {
    print(`需人工复核 Compiled Truth (${plan.reviewItems.length})`);
    for (const item of plan.reviewItems) {
      print(`  - ${item.file}: ${item.text.slice(0, 120)}`);
    }
    print();
  }

  if (!plan.apply) {
    print('dry-run only. Run again with --apply to move files to OS Trash.');
  }
}

export function removeCommand(program: Command): void {
  program
    .command('remove')
    .argument('<target>', 'URL or corpus-relative path to remove')
    .option('--apply', 'execute the removal; default is dry-run', false)
    .option('--json', 'emit a machine-readable JSON report', false)
    .description('safely remove a source/wiki page and provenance-linked references')
    .action(async (target: string, opts: { apply?: boolean; json?: boolean }) => {
      const corpus = requireCorpus();
      let plan: RemovalPlan;
      try {
        plan = buildRemovalPlan(corpus, target, !!opts.apply);
      } catch (e) {
        err((e as Error).message);
        process.exitCode = 2;
        return;
      }

      if (!opts.json) printPlan(plan);
      if (opts.json && !opts.apply) out(JSON.stringify(plan));
      if (!opts.apply) return;

      if (plan.trashTargets.length === 0 && plan.pageChanges.length === 0) {
        bad('nothing to remove');
        process.exitCode = 1;
        if (opts.json) out(JSON.stringify(plan));
        return;
      }

      try {
        const snapshot = await createSnapshot(corpus, { tag: 'remove' });
        plan.snapshot = snapshot;
        ok(`snapshot saved: ${snapshot}`);

        applyPageChanges(corpus, plan);
        forgetIngestRecords(corpus, plan.ingestRecords);
        await moveToTrash(plan.trashTargets.map((t) => t.abs));
        ok(`moved ${plan.trashTargets.length} item(s) to OS Trash`);

        const hasVectorDb = existsSync(join(corpus, '.wiki', 'vector.sqlite'));
        if (hasVectorDb) {
          plan.vectorPruned = await pruneVectorDbMissingFiles(corpus);
          if (plan.vectorPruned > 0) ok(`vector pruned ${plan.vectorPruned} missing file(s)`);
        }

        const skipVector = !hasVectorDb || process.env.LOREKIT_TEST_SKIP_VECTOR_SYNC === '1';
        plan.syncSkippedVector = skipVector;
        await runSync(corpus, { skipVector });

        const issues = runLint(corpus);
        plan.lintIssues = issues.length;
        printLintReport(corpus, issues);
      } catch (e) {
        err((e as Error).message);
        process.exitCode = 1;
      }

      if (opts.json) out(JSON.stringify(plan));
    });
}
