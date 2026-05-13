import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import {
  type GbrainExportManifest,
  type GbrainExportManifestPage,
  type GbrainExportManifestSkipped,
  writeJsonFile,
} from './manifest.js';

export interface GbrainExportOptions {
  out?: string;
  dryRun?: boolean;
}

export interface GbrainExportResult {
  status: 'ok' | 'warn';
  dryRun: boolean;
  corpus: string;
  exportDir: string;
  pagesDir: string;
  manifestPath: string;
  exportedAt: string;
  pagesExported: number;
  pagesSkipped: number;
  pages: GbrainExportManifestPage[];
  skipped: GbrainExportManifestSkipped[];
  warnings: string[];
}

interface Candidate {
  absPath: string;
  sourcePath: string;
}

function toPosixPath(path: string): string {
  return path.split('\\').join('/');
}

function sha256Content(content: Buffer | string): string {
  return 'sha256:' + createHash('sha256').update(content).digest('hex');
}

function exportRoot(corpus: string, out?: string): string {
  if (!out) return join(corpus, '.wiki', 'integrations', 'gbrain-export');
  return resolve(corpus, out);
}

function collectKnowledgeMarkdown(corpus: string): {
  candidates: Candidate[];
  skipped: GbrainExportManifestSkipped[];
  warnings: string[];
} {
  const root = join(corpus, '知识库');
  const candidates: Candidate[] = [];
  const skipped: GbrainExportManifestSkipped[] = [];
  const warnings: string[] = [];

  if (!existsSync(root)) {
    warnings.push('知识库/ not found; no pages exported');
    return { candidates, skipped, warnings };
  }

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const absPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const sourcePath = toPosixPath(relative(corpus, absPath));
      if (sourcePath === '知识库/模板' || sourcePath.startsWith('知识库/模板/')) {
        skipped.push({ sourcePath, reason: 'template file skipped by default' });
        continue;
      }
      if (entry.name === '_INDEX.md') {
        skipped.push({ sourcePath, reason: 'index file skipped by default' });
        continue;
      }
      if (entry.name === 'index.md') {
        skipped.push({ sourcePath, reason: 'local index file skipped by default' });
        continue;
      }
      candidates.push({ absPath, sourcePath });
    }
  }

  walk(root);
  candidates.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  skipped.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return { candidates, skipped, warnings };
}

function ensureFreshExportDir(root: string, exportedAt: string): void {
  mkdirSync(root, { recursive: true });
  const backupRoot = join(root, 'backups', exportedAt.replace(/[:.]/g, '-'));
  let moved = false;

  for (const name of ['pages', 'manifest.json', 'README.md']) {
    const current = join(root, name);
    if (!existsSync(current)) continue;
    if (!moved) {
      mkdirSync(backupRoot, { recursive: true });
      moved = true;
    }
    renameSync(current, join(backupRoot, name));
  }
}

function normalizeForGbrain(raw: string, sourcePath: string, exportedAt: string): string {
  const parsed = matter(raw);
  const data: Record<string, unknown> = { ...parsed.data };
  delete data.slug;
  data.lorekit_source_path = sourcePath;
  data.lorekit_layer = 'artifact';
  data.lorekit_hash = sha256Content(raw);
  data.lorekit_exported_at = exportedAt;
  return matter.stringify(parsed.content, data);
}

function pageMeta(raw: string): { title: string | null; type: string | null } {
  const parsed = matter(raw);
  return {
    title: typeof parsed.data.title === 'string' ? parsed.data.title : null,
    type: typeof parsed.data.type === 'string' ? parsed.data.type : null,
  };
}

export function exportForGbrain(corpus: string, opts: GbrainExportOptions = {}): GbrainExportResult {
  const dryRun = opts.dryRun ?? false;
  const exportedAt = new Date().toISOString();
  const root = exportRoot(corpus, opts.out);
  const pagesDir = join(root, 'pages');
  const manifestPath = join(root, 'manifest.json');
  const { candidates, skipped, warnings } = collectKnowledgeMarkdown(corpus);

  const pages: GbrainExportManifestPage[] = [];
  for (const candidate of candidates) {
    const rawBuffer = readFileSync(candidate.absPath);
    const raw = rawBuffer.toString('utf-8');
    const relUnderKnowledge = toPosixPath(relative(join(corpus, '知识库'), candidate.absPath));
    const exportPath = toPosixPath(join('pages', relUnderKnowledge));
    const meta = pageMeta(raw);
    pages.push({
      sourcePath: candidate.sourcePath,
      exportPath,
      title: meta.title,
      type: meta.type,
      hash: sha256Content(rawBuffer),
      bytes: statSync(candidate.absPath).size,
      status: 'exported',
    });
  }

  if (!dryRun) {
    ensureFreshExportDir(root, exportedAt);
    for (const candidate of candidates) {
      const raw = readFileSync(candidate.absPath, 'utf-8');
      const relUnderKnowledge = relative(join(corpus, '知识库'), candidate.absPath);
      const target = join(pagesDir, relUnderKnowledge);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, normalizeForGbrain(raw, candidate.sourcePath, exportedAt), 'utf-8');
    }
    const manifest: GbrainExportManifest = {
      version: 1,
      integration: 'gbrain',
      source: 'lorekit',
      corpus,
      exportedAt,
      pages,
      skipped,
      warnings,
    };
    writeJsonFile(manifestPath, manifest);
    writeFileSync(
      join(root, 'README.md'),
      [
        '# GBrain export',
        '',
        'Generated by `lorekit gbrain export`.',
        'This directory is a staging copy for GBrain import; lorekit 知识库/ remains the source of truth.',
        '',
      ].join('\n'),
      'utf-8',
    );
  }

  return {
    status: warnings.length > 0 ? 'warn' : 'ok',
    dryRun,
    corpus,
    exportDir: root,
    pagesDir,
    manifestPath,
    exportedAt,
    pagesExported: pages.length,
    pagesSkipped: skipped.length,
    pages,
    skipped,
    warnings,
  };
}
