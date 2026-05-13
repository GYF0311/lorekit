import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../../utils/fs.js';
import { getGbrainStatus, type GbrainStatusResult } from './gbrain-status.js';
import { exportForGbrain, type GbrainExportResult } from './gbrain-export.js';
import { readJsonFile, writeJsonFile, type GbrainExportManifest } from './manifest.js';
import { runExternalCommand, type ExternalCommandResult } from './process.js';

export { getGbrainStatus, exportForGbrain };

export interface GbrainSyncOptions {
  dryRun?: boolean;
  json?: boolean;
  forceExport?: boolean;
}

export interface GbrainSyncResult {
  status: 'ok' | 'error';
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  corpus: string;
  export: GbrainExportResult;
  gbrain: {
    binary: string;
    version: string | null;
    command: string[];
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
  } | null;
  gbrainImport?: { skipped: true; reason: string };
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
  gbrain: ExternalCommandResult | null;
  errors: string[];
}

function syncReportPath(corpus: string): string {
  return join(corpus, '.wiki', 'integrations', 'gbrain', 'sync-report.json');
}

function writeSyncReport(corpus: string, result: GbrainSyncResult): void {
  const path = syncReportPath(corpus);
  mkdirSync(join(corpus, '.wiki', 'integrations', 'gbrain'), { recursive: true });
  writeJsonFile(path, result);
}

function commandSummary(binary: string, pagesDir: string): string[] {
  return [binary, 'import', pagesDir];
}

export async function syncGbrain(
  corpus: string,
  opts: GbrainSyncOptions = {},
): Promise<GbrainSyncResult> {
  const dryRun = opts.dryRun ?? false;
  const startedAt = new Date().toISOString();
  const exportResult = exportForGbrain(corpus, { dryRun });

  if (dryRun) {
    return {
      status: 'ok',
      dryRun: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      corpus,
      export: exportResult,
      gbrain: null,
      gbrainImport: { skipped: true, reason: 'dry-run' },
      warnings: exportResult.warnings,
      errors: [],
    };
  }

  const gbrainStatus = await getGbrainStatus();
  if (!gbrainStatus.installed) {
    const result: GbrainSyncResult = {
      status: 'error',
      dryRun: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      corpus,
      export: exportResult,
      gbrain: null,
      warnings: exportResult.warnings,
      errors: ['gbrain is not installed', ...gbrainStatus.errors],
    };
    writeSyncReport(corpus, result);
    return result;
  }

  const importCommand = commandSummary(gbrainStatus.binary, exportResult.pagesDir);
  const external = await runExternalCommand({
    command: gbrainStatus.binary,
    args: ['import', exportResult.pagesDir],
    cwd: corpus,
    timeoutMs: 120_000,
  });

  const result: GbrainSyncResult = {
    status: external.exitCode === 0 ? 'ok' : 'error',
    dryRun: false,
    startedAt,
    finishedAt: new Date().toISOString(),
    corpus,
    export: exportResult,
    gbrain: {
      binary: gbrainStatus.binary,
      version: gbrainStatus.version,
      command: importCommand,
      exitCode: external.exitCode,
      stdout: external.stdout,
      stderr: external.stderr,
      durationMs: external.durationMs,
    },
    warnings: exportResult.warnings,
    errors: external.exitCode === 0 ? [] : [external.error || external.stderr || 'gbrain import failed'],
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
  if (!manifest) {
    issues.push({
      section: 'gbrain',
      severity: 'warn',
      message: 'GBrain export manifest is missing',
      recommendation: 'Run lorekit gbrain export',
    });
  } else {
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

export async function queryGbrain(text: string): Promise<GbrainQueryResult> {
  const status = await getGbrainStatus();
  const message =
    'This answer comes from GBrain index generated from lorekit export. To persist new knowledge, use wiki-fileback / lorekit audit.';
  if (!status.installed) {
    return {
      status: 'error',
      source: 'gbrain',
      message,
      gbrain: null,
      errors: ['gbrain is not installed', ...status.errors],
    };
  }

  const r = await runExternalCommand({
    command: status.binary,
    args: ['query', text],
    timeoutMs: 120_000,
  });
  return {
    status: r.exitCode === 0 ? 'ok' : 'error',
    source: 'gbrain',
    message,
    gbrain: r,
    errors: r.exitCode === 0 ? [] : [r.error || r.stderr || 'gbrain query failed'],
  };
}
