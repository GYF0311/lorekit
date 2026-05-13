import type { Command } from 'commander';
import chalk from 'chalk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireCorpus } from '../lib/corpus.js';
import { ok, warn, err, print, out } from '../utils/logger.js';
import { runIndex } from './dir-index.js';
import { runVectorSync } from './vector.js';
import { runDoctor } from './doctor.js';
import { refreshRootIndex } from '../lib/root-index.js';

export interface SyncOptions {
  force?: boolean;
  model?: string;
  skipDoctor?: boolean;
  skipVector?: boolean;
  skipRootIndex?: boolean;
  json?: boolean;
  report?: boolean;
}

type SyncStepStatus = 'ok' | 'skipped' | 'error';

interface SyncStepReport {
  status: SyncStepStatus;
  detail?: string;
  [key: string]: unknown;
}

export interface SyncRunReport {
  status: 'ok' | 'error';
  startedAt: string;
  finishedAt: string;
  corpus: string;
  steps: {
    index: SyncStepReport;
    rootIndex: SyncStepReport;
    vector: SyncStepReport;
    doctor: SyncStepReport;
  };
  reportPath: string | null;
  errors: string[];
}

function createReport(corpus: string): SyncRunReport {
  return {
    status: 'ok',
    startedAt: new Date().toISOString(),
    finishedAt: '',
    corpus,
    steps: {
      index: { status: 'skipped' },
      rootIndex: { status: 'skipped' },
      vector: { status: 'skipped' },
      doctor: { status: 'skipped' },
    },
    reportPath: null,
    errors: [],
  };
}

function writeSyncReport(corpus: string, report: SyncRunReport): string {
  const dir = join(corpus, '.wiki', 'reports', 'sync');
  mkdirSync(dir, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const path = join(dir, `${stamp}.json`);
  report.reportPath = path;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return path;
}

/**
 * lorekit sync — 一条命令把「文本档案 + 向量库」对齐。
 *
 * 执行顺序（必须是这个顺序）：
 *   1a. runIndex：扫目录生成/刷新所有 _INDEX.md
 *        → 向量 L1 的输入源必须先存在，才能被下一步读
 *   1b. refreshRootIndex：合并刷新 corpus/index.md 的四个受控区
 *        → L0 向量的输入源；保留人类手写摘要，只追加新页 / 删失踪页
 *   2.  runVectorSync（layered=true）：增量嵌入 chunk + 刷 L0/L1 向量
 *        → L0 读 corpus/index.md 的 ## 分区
 *        → L1 读每个 {dir}/_INDEX.md 的条目行
 *   3.  runDoctor：sanity check，只报告不阻塞
 */
export async function runSync(corpus: string, opts: SyncOptions = {}): Promise<SyncRunReport> {
  const force = opts.force ?? false;
  const model = opts.model ?? 'bge-m3';
  const report = createReport(corpus);

  // Step 1a: 各子目录的 _INDEX.md
  print(chalk.cyan('── [1/3] index: refresh _INDEX.md ──'));
  try {
    const generated = runIndex(corpus);
    report.steps.index = { status: 'ok', generated };
    if (generated === 0) {
      warn('no indexable directories found');
    } else {
      ok(`refreshed ${generated} _INDEX.md file(s)`);
    }
  } catch (e) {
    report.status = 'error';
    report.steps.index = { status: 'error', error: (e as Error).message };
    report.errors.push(`index failed: ${(e as Error).message}`);
    err(`index failed: ${(e as Error).message}`);
    throw e;
  }

  // Step 1b: corpus 根的 index.md（受控区合并刷新）
  if (!opts.skipRootIndex) {
    try {
      const r = refreshRootIndex(corpus);
      const totals = r.perSection.reduce(
        (acc, s) => ({
          added: acc.added + s.added.length,
          removed: acc.removed + s.removed.length,
          kept: acc.kept + s.kept,
        }),
        { added: 0, removed: 0, kept: 0 },
      );
      report.steps.rootIndex = {
        status: 'ok',
        changed: r.changed,
        added: totals.added,
        removed: totals.removed,
        kept: totals.kept,
      };
      if (!r.changed) {
        ok(`index.md unchanged (${totals.kept} entries across managed sections)`);
      } else {
        ok(
          `index.md merged: +${totals.added} added, -${totals.removed} removed, ${totals.kept} kept`,
        );
        for (const s of r.perSection) {
          if (s.added.length === 0 && s.removed.length === 0) continue;
          for (const slug of s.added) print(`    + ${slug}`);
          for (const slug of s.removed) print(`    - ${slug} (file gone)`);
        }
      }
    } catch (e) {
      report.status = 'error';
      report.steps.rootIndex = { status: 'error', error: (e as Error).message };
      report.errors.push(`root index sync failed: ${(e as Error).message}`);
      err(`root index sync failed: ${(e as Error).message}`);
      throw e;
    }
  } else {
    report.steps.rootIndex = { status: 'skipped', reason: 'skip-root-index' };
  }
  print();

  // Step 2: 向量库（除非显式 --skip-vector）
  if (!opts.skipVector) {
    print(chalk.cyan('── [2/3] vector: sync chunks + L0/L1 ──'));
    try {
      const r = await runVectorSync(corpus, { force, model, layered: true });
      report.steps.vector = { status: 'ok', ...r, model };
      ok(`synced ${r.synced} files (${r.totalChunks} chunks), skipped ${r.skipped} unchanged`);
    } catch (e) {
      report.status = 'error';
      report.steps.vector = { status: 'error', error: (e as Error).message, model };
      report.errors.push(`vector sync failed: ${(e as Error).message}`);
      err(`vector sync failed: ${(e as Error).message}`);
      throw e;
    }
    print();
  } else {
    report.steps.vector = { status: 'skipped', reason: 'skip-vector' };
  }

  // Step 3: 健康体检（只报告不阻塞）
  if (!opts.skipDoctor) {
    print(chalk.cyan('── [3/3] doctor: sanity check ──'));
    const issues = await runDoctor(corpus);
    report.steps.doctor = { status: 'ok', issues };
  } else {
    report.steps.doctor = { status: 'skipped', reason: 'skip-doctor' };
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

export function syncCommand(program: Command): void {
  program
    .command('sync')
    .description('one-shot: refresh _INDEX.md → vector sync (layered) → doctor')
    .option('--force', 'full rebuild of vector index', false)
    .option('--model <name>', 'ollama model name', 'bge-m3')
    .option('--skip-doctor', 'skip the final doctor sanity check', false)
    .option('--skip-vector', 'only refresh _INDEX.md, skip vector sync', false)
    .option('--skip-root-index', 'skip merging corpus/index.md against disk', false)
    .option('--json', 'output machine-readable sync report', false)
    .option('--report', 'write .wiki/reports/sync/<timestamp>.json', false)
    .action(async (opts: SyncOptions) => {
      const corpus = requireCorpus();
      try {
        const report = await runSync(corpus, opts);
        if (opts.report) writeSyncReport(corpus, report);
        if (opts.json) out(JSON.stringify(report, null, 2));
      } catch {
        process.exit(1);
      }
    });
}
