import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../../utils/fs.js';
import { getGbrainStatus, type GbrainStatusResult } from './gbrain-status.js';
import { exportForGbrain, type GbrainExportResult } from './gbrain-export.js';
import { legacyGbrainSlugForSourcePath } from './gbrain/projection.js';
import { readJsonFile, writeJsonFile, type GbrainExportManifest } from './manifest.js';
import { runExternalCommand, type ExternalCommandResult } from './process.js';

export { getGbrainStatus, exportForGbrain };

export interface GbrainSyncOptions {
  dryRun?: boolean;
  json?: boolean;
  exportEvenIfMissing?: boolean;
}

export interface GbrainExternalSummary {
  binary: string;
  version: string | null;
  command: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface GbrainSkippedStep {
  skipped: true;
  reason: string;
}

export interface GbrainSyncResult {
  status: 'ok' | 'error';
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  corpus: string;
  export: GbrainExportResult | null;
  gbrain: GbrainExternalSummary | null;
  gbrainImport?: GbrainExternalSummary | GbrainSkippedStep | null;
  gbrainExtract?: GbrainExternalSummary | GbrainSkippedStep | null;
  extract?: Record<string, unknown> | null;
  warnings: string[];
  errors: string[];
}

export interface GbrainDoctorIssue {
  section: 'gbrain';
  severity: 'warn' | 'error';
  message: string;
  recommendation: string;
}

export interface GbrainDoctorResult {
  status: 'ok' | 'warn' | 'error';
  corpus: string;
  gbrain: GbrainStatusResult;
  manifestPath: string;
  syncReportPath: string;
  issues: GbrainDoctorIssue[];
}

export interface GbrainQueryResult {
  status: 'ok' | 'error';
  source: 'gbrain';
  message: string;
  staleCheck: {
    skipped: boolean;
    status: GbrainDoctorResult['status'] | null;
    issues: GbrainDoctorIssue[];
  };
  gbrain: ExternalCommandResult | null;
  candidates: GbrainCanonicalCandidate[];
  warnings: string[];
  errors: string[];
}

export interface GbrainCanonicalCandidate {
  gbrainSlug: string;
  canonicalPath: string | null;
  canonicalExists: boolean;
  score: number | null;
  snippet: string;
}

function syncReportPath(corpus: string): string {
  return join(corpus, '.wiki', 'integrations', 'gbrain', 'sync-report.json');
}

function writeSyncReport(corpus: string, result: GbrainSyncResult): void {
  const path = syncReportPath(corpus);
  mkdirSync(join(corpus, '.wiki', 'integrations', 'gbrain'), { recursive: true });
  writeJsonFile(path, result);
}

function importArgs(pagesDir: string): string[] {
  return ['import', pagesDir, '--fresh'];
}

function commandSummary(binary: string, pagesDir: string): string[] {
  return [binary, ...importArgs(pagesDir)];
}

function externalSummary(
  binary: string,
  version: string | null,
  command: string[],
  result: ExternalCommandResult,
): NonNullable<GbrainSyncResult['gbrain']> {
  return {
    binary,
    version,
    command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function extractLinksCreated(report: unknown): number | null {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const direct = (report as Record<string, unknown>).links_created;
  if (typeof direct === 'number') return direct;
  const nested = (report as Record<string, unknown>).extract;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return null;
  const value = (nested as Record<string, unknown>).links_created;
  return typeof value === 'number' ? value : null;
}

function countWikilinksOutsideCode(content: string): number {
  let count = 0;
  let inFence = false;
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    count += line.match(/\[\[[^\]]+\]\]/g)?.length ?? 0;
  }
  return count;
}

function exportManifestPath(corpus: string): string {
  return join(corpus, '.wiki', 'integrations', 'gbrain-export', 'manifest.json');
}

function slugFromExportPath(exportPath: string): string | null {
  if (!exportPath.startsWith('pages/')) return null;
  const withoutRoot = exportPath.slice('pages/'.length);
  return withoutRoot.replace(/\.md$/i, '');
}

function loadReverseMap(corpus: string): Map<string, string> {
  const manifest = readJsonFile<
    GbrainExportManifest & {
      reverseMap?: Record<string, string>;
      pages?: Array<GbrainExportManifest['pages'][number] & { gbrainSlug?: string }>;
    }
  >(exportManifestPath(corpus));
  const map = new Map<string, string>();
  if (!manifest) return map;

  for (const [slug, sourcePath] of Object.entries(manifest.reverseMap ?? {})) {
    if (typeof sourcePath === 'string') map.set(slug, sourcePath);
  }
  for (const page of manifest.pages ?? []) {
    if (page.gbrainSlug) map.set(page.gbrainSlug, page.sourcePath);
    const slug = slugFromExportPath(page.exportPath);
    if (slug && !map.has(slug)) map.set(slug, page.sourcePath);
    const legacySlug = legacyGbrainSlugForSourcePath(page.sourcePath);
    if (legacySlug && !map.has(legacySlug)) map.set(legacySlug, page.sourcePath);
  }
  return map;
}

function parseGbrainQueryCandidates(corpus: string, stdoutText: string): GbrainCanonicalCandidate[] {
  const reverseMap = loadReverseMap(corpus);
  const candidates: GbrainCanonicalCandidate[] = [];
  for (const line of stdoutText.split('\n')) {
    const m = /^\[(\d+(?:\.\d+)?)\]\s+(\S+)\s+--\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const gbrainSlug = m[2];
    const canonicalPath = reverseMap.get(gbrainSlug) ?? null;
    candidates.push({
      gbrainSlug,
      canonicalPath,
      canonicalExists: canonicalPath ? existsSync(join(corpus, canonicalPath)) : false,
      score: Number.parseFloat(m[1]),
      snippet: m[3] ?? '',
    });
  }
  return candidates;
}

export async function syncGbrain(
  corpus: string,
  opts: GbrainSyncOptions = {},
): Promise<GbrainSyncResult> {
  const dryRun = opts.dryRun ?? false;
  const startedAt = new Date().toISOString();

  if (dryRun) {
    const exportResult = exportForGbrain(corpus, { dryRun: true });
    return {
      status: 'ok',
      dryRun: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      corpus,
      export: exportResult,
      gbrain: null,
      gbrainImport: { skipped: true, reason: 'dry-run' },
      gbrainExtract: null,
      extract: null,
      warnings: exportResult.warnings,
      errors: [],
    };
  }

  const gbrainStatus = await getGbrainStatus();
  if (!gbrainStatus.installed) {
    const exportResult = opts.exportEvenIfMissing
      ? exportForGbrain(corpus, { dryRun: false })
      : null;
    const result: GbrainSyncResult = {
      status: 'error',
      dryRun: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      corpus,
      export: exportResult,
      gbrain: null,
      gbrainImport: { skipped: true, reason: 'gbrain-missing' },
      gbrainExtract: null,
      extract: null,
      warnings: exportResult?.warnings ?? [],
      errors: ['gbrain is not installed', ...gbrainStatus.errors],
    };
    writeSyncReport(corpus, result);
    return result;
  }

  const exportResult = exportForGbrain(corpus, { dryRun: false });
  const importCommand = commandSummary(gbrainStatus.binary, exportResult.pagesDir);
  const importExternal = await runExternalCommand({
    command: gbrainStatus.binary,
    args: importArgs(exportResult.pagesDir),
    cwd: corpus,
    timeoutMs: 120_000,
  });
  const importSummary = externalSummary(
    gbrainStatus.binary,
    gbrainStatus.version,
    importCommand,
    importExternal,
  );

  let extractSummary: NonNullable<GbrainSyncResult['gbrainExtract']> | null = null;
  let extractResult: Record<string, unknown> | null = null;
  const warnings = [...exportResult.warnings];
  const errors: string[] = [];

  if (importExternal.exitCode !== 0) {
    errors.push(importExternal.error || importExternal.stderr || 'gbrain import failed');
  } else {
    const extractArgs = ['extract', 'all', '--source', 'db', '--include-frontmatter', '--json'];
    const extractCommand = [gbrainStatus.binary, ...extractArgs];
    const extractExternal = await runExternalCommand({
      command: gbrainStatus.binary,
      args: extractArgs,
      cwd: corpus,
      timeoutMs: 120_000,
    });
    extractSummary = externalSummary(
      gbrainStatus.binary,
      gbrainStatus.version,
      extractCommand,
      extractExternal,
    );
    extractResult = parseJsonObject(extractExternal.stdout);
    if (extractExternal.exitCode !== 0) {
      errors.push(extractExternal.error || extractExternal.stderr || 'gbrain extract failed');
    } else if (!extractResult) {
      warnings.push('gbrain extract completed but did not return parseable JSON');
    }
  }

  const result: GbrainSyncResult = {
    status: errors.length === 0 ? 'ok' : 'error',
    dryRun: false,
    startedAt,
    finishedAt: new Date().toISOString(),
    corpus,
    export: exportResult,
    gbrain: importSummary,
    gbrainImport: importSummary,
    gbrainExtract: extractSummary,
    extract: extractResult,
    warnings,
    errors,
  };
  writeSyncReport(corpus, result);
  return result;
}

export async function doctorGbrain(corpus: string): Promise<GbrainDoctorResult> {
  const issues: GbrainDoctorIssue[] = [];
  const gbrain = await getGbrainStatus();
  if (!gbrain.installed) {
    issues.push({
      section: 'gbrain',
      severity: 'warn',
      message: 'GBrain binary is not installed',
      recommendation: 'Install GBrain only if you want graph retrieval: git clone + bun install + bun link',
    });
  }

  const manifestPath = join(corpus, '.wiki', 'integrations', 'gbrain-export', 'manifest.json');
  const syncPath = syncReportPath(corpus);
  const manifest = readJsonFile<GbrainExportManifest>(manifestPath);
  let exportedWikilinkCount = 0;
  if (!manifest) {
    issues.push({
      section: 'gbrain',
      severity: 'warn',
      message: 'GBrain export manifest is missing',
      recommendation: 'Run lorekit gbrain export',
    });
  } else {
    const reverseMap = manifest.reverseMap ?? {};
    const missingReverseMapping = manifest.pages.filter((page) => {
      const slug = page.gbrainSlug ?? slugFromExportPath(page.exportPath);
      return !slug || reverseMap[slug] !== page.sourcePath;
    });
    if (missingReverseMapping.length > 0) {
      issues.push({
        section: 'gbrain',
        severity: 'error',
        message: 'GBrain export manifest is missing reverse mapping',
        recommendation: 'Run lorekit gbrain export to regenerate manifest.reverseMap',
      });
    }

    for (const page of manifest.pages) {
      const sourcePath = join(corpus, page.sourcePath);
      if (!existsSync(sourcePath)) {
        issues.push({
          section: 'gbrain',
          severity: 'warn',
          message: `Exported page source is missing: ${page.sourcePath}`,
          recommendation: 'Run lorekit gbrain export to refresh the staging directory',
        });
        continue;
      }
      const currentHash = 'sha256:' + sha256(sourcePath);
      if (currentHash !== page.hash) {
        issues.push({
          section: 'gbrain',
          severity: 'warn',
          message: `GBrain export is stale: ${page.sourcePath}`,
          recommendation: 'Run lorekit gbrain export or lorekit gbrain sync',
        });
      }

      const exportPath = join(corpus, '.wiki', 'integrations', 'gbrain-export', page.exportPath);
      if (existsSync(exportPath)) {
        const staged = readFileSync(exportPath, 'utf-8');
        exportedWikilinkCount += countWikilinksOutsideCode(staged);
      }
    }
  }

  if (!existsSync(syncPath)) {
    issues.push({
      section: 'gbrain',
      severity: 'warn',
      message: 'GBrain sync report is missing',
      recommendation: 'Run lorekit gbrain sync after export when GBrain is installed',
    });
  } else {
    try {
      const report = JSON.parse(readFileSync(syncPath, 'utf-8')) as { status?: string };
      if (report.status !== 'ok') {
        issues.push({
          section: 'gbrain',
          severity: 'warn',
          message: 'Last GBrain sync did not finish successfully',
          recommendation: 'Inspect .wiki/integrations/gbrain/sync-report.json and rerun sync',
        });
      }
      const linksCreated = extractLinksCreated(report);
      if (exportedWikilinkCount > 0 && linksCreated === 0) {
        issues.push({
          section: 'gbrain',
          severity: 'warn',
          message: 'GBrain extract created 0 links despite exported wikilinks',
          recommendation: 'Run lorekit gbrain sync and inspect GBrain extract output',
        });
      }
    } catch (e) {
      issues.push({
        section: 'gbrain',
        severity: 'error',
        message: `GBrain sync report is unreadable: ${(e as Error).message}`,
        recommendation: 'Regenerate it with lorekit gbrain sync',
      });
    }
  }

  const hasError = issues.some((i) => i.severity === 'error');
  return {
    status: hasError ? 'error' : issues.length > 0 ? 'warn' : 'ok',
    corpus,
    gbrain,
    manifestPath,
    syncReportPath: syncPath,
    issues,
  };
}

export interface GbrainQueryOptions {
  staleCheck?: boolean;
}

export async function queryGbrain(
  corpus: string,
  text: string,
  opts: GbrainQueryOptions = {},
): Promise<GbrainQueryResult> {
  const message =
    'This answer comes from GBrain index generated from lorekit export. To persist new knowledge, use wiki-fileback / lorekit audit.';
  const shouldCheck = opts.staleCheck !== false;
  let status: GbrainStatusResult;
  let staleStatus: GbrainDoctorResult['status'] | null = null;
  let staleIssues: GbrainDoctorIssue[] = [];

  if (shouldCheck) {
    const check = await doctorGbrain(corpus);
    if (!check.gbrain.installed) {
      return {
        status: 'error',
        source: 'gbrain',
        message,
        staleCheck: { skipped: false, status: check.status, issues: check.issues },
        gbrain: null,
        candidates: [],
        warnings: check.issues.map((i) => i.message),
        errors: ['gbrain is not installed', ...check.gbrain.errors],
      };
    }
    status = check.gbrain;
    staleStatus = check.status;
    staleIssues = check.issues;
  } else {
    status = await getGbrainStatus();
  }

  if (!status.installed) {
    return {
      status: 'error',
      source: 'gbrain',
      message,
      staleCheck: { skipped: !shouldCheck, status: null, issues: [] },
      gbrain: null,
      candidates: [],
      warnings: [],
      errors: ['gbrain is not installed', ...status.errors],
    };
  }

  const staleWarnings =
    shouldCheck && staleIssues.length > 0
      ? [
          'GBrain index may be stale. Run lorekit gbrain sync.',
          ...staleIssues.map((i) => i.message),
        ]
      : [];

  const r = await runExternalCommand({
    command: status.binary,
    args: ['query', text],
    cwd: corpus,
    timeoutMs: 120_000,
  });
  const candidates = parseGbrainQueryCandidates(corpus, r.stdout);
  const mappingWarnings = candidates
    .filter((candidate) => !candidate.canonicalPath)
    .map((candidate) => `could not map GBrain candidate to canonical page: ${candidate.gbrainSlug}`);
  return {
    status: r.exitCode === 0 ? 'ok' : 'error',
    source: 'gbrain',
    message,
    staleCheck: { skipped: !shouldCheck, status: staleStatus, issues: staleIssues },
    gbrain: r,
    candidates,
    warnings: [...staleWarnings, ...mappingWarnings],
    errors: r.exitCode === 0 ? [] : [r.error || r.stderr || 'gbrain query failed'],
  };
}
