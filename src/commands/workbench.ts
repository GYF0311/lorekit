import type { Command } from 'commander';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { requireCorpus, collectMdFiles } from '../lib/corpus.js';
import { matchesDirPrefix, workbenchTriageExcludePrefixes, relPosix } from '../lib/paths.js';
import { out, print, warn } from '../utils/logger.js';

/**
 * `lorekit workbench report` — wiki-triage 清算账单的确定性候选生成（只读）。
 *
 * CLI 只负责机械事实：路径、mtime、大小、账龄、活跃目录判定、排除原因；
 * "废稿/入库/归档"的语义分类是 AI（wiki-triage skill）的职责，
 * 真正的 trash / mv 必须等用户逐组确认。本命令不写任何文件。
 */

const WORKBENCH_DIR = '_工作台';
const DAY_MS = 86_400_000;

// 标准过程桶（模板自带的暂存目录）：桶内文件彼此无关，按单文件判账龄。
// 只有"项目目录"（用户自建的调研/课件/项目文件夹）才适用整目录活跃跳过——
// 否则桶里一个新文件会把全部老文件藏进"活跃"，永远清不到。
const BUCKET_DIRS: ReadonlySet<string> = new Set(['收件', '草稿', '临时', '待整理', '下载']);

interface WorkbenchCandidate {
  path: string;
  topDir: string | null;
  mtime: string;
  ageDays: number;
  sizeBytes: number;
}

export interface WorkbenchReport {
  corpus: string;
  staleDays: number;
  activeDays: number;
  candidates: WorkbenchCandidate[];
  activeDirs: { dir: string; newestAgeDays: number; skippedFiles: number }[];
  excluded: { prefix: string; files: number }[];
  freshFiles: number;
}

function topDirOf(rel: string): string | null {
  const parts = rel.split('/');
  // `_工作台/<top>/...`：取 top；散落在工作台根的文件返回 null（逐个判断）
  return parts.length >= 3 ? parts[1] : null;
}

export function buildWorkbenchReport(
  corpus: string,
  opts: { staleDays: number; activeDays: number },
): WorkbenchReport {
  const now = Date.now();
  const files = collectMdFiles(join(corpus, WORKBENCH_DIR));

  const excludedCount = new Map<string, number>();
  const byTopDir = new Map<string | null, { rel: string; ageDays: number; sizeBytes: number; mtime: Date }[]>();

  for (const file of files) {
    const rel = relPosix(corpus, file);
    const noise = workbenchTriageExcludePrefixes.find((p) => matchesDirPrefix(rel, p));
    if (noise) {
      excludedCount.set(noise, (excludedCount.get(noise) ?? 0) + 1);
      continue;
    }
    let st;
    try {
      st = statSync(file);
    } catch {
      continue;
    }
    const ageDays = Math.floor((now - st.mtime.getTime()) / DAY_MS);
    const top = topDirOf(rel);
    const list = byTopDir.get(top) ?? [];
    list.push({ rel, ageDays, sizeBytes: st.size, mtime: st.mtime });
    byTopDir.set(top, list);
  }

  const candidates: WorkbenchCandidate[] = [];
  const activeDirs: WorkbenchReport['activeDirs'] = [];
  let freshFiles = 0;

  for (const [top, list] of byTopDir) {
    const newestAgeDays = Math.min(...list.map((f) => f.ageDays));
    // 活跃项目目录：目录内任一文件在 activeDays 内动过 → 整目录跳过（进行中，不打扰）。
    // 标准过程桶与工作台根散件不适用此规则，按单文件判账龄。
    if (top !== null && !BUCKET_DIRS.has(top) && newestAgeDays <= opts.activeDays) {
      activeDirs.push({ dir: `${WORKBENCH_DIR}/${top}`, newestAgeDays, skippedFiles: list.length });
      continue;
    }
    for (const f of list) {
      if (f.ageDays >= opts.staleDays) {
        candidates.push({
          path: f.rel,
          topDir: top ? `${WORKBENCH_DIR}/${top}` : null,
          mtime: f.mtime.toISOString().slice(0, 10),
          ageDays: f.ageDays,
          sizeBytes: f.sizeBytes,
        });
      } else {
        freshFiles++;
      }
    }
  }

  candidates.sort((a, b) => b.ageDays - a.ageDays || a.path.localeCompare(b.path));
  activeDirs.sort((a, b) => a.dir.localeCompare(b.dir));

  return {
    corpus,
    staleDays: opts.staleDays,
    activeDays: opts.activeDays,
    candidates,
    activeDirs,
    excluded: [...excludedCount.entries()].map(([prefix, count]) => ({ prefix, files: count })),
    freshFiles,
  };
}

function printHumanReport(report: WorkbenchReport): void {
  print(chalk.bold(`\nlorekit workbench report — ${report.corpus}\n`));
  print(
    chalk.dim(
      `阈值：账龄 ≥ ${report.staleDays} 天进候选；目录内 ${report.activeDays} 天内有改动视为活跃项目整体跳过\n`,
    ),
  );

  print(chalk.cyan(`── 清算候选（${report.candidates.length}）──`));
  for (const c of report.candidates) {
    print(`  ${c.mtime}  ${String(c.ageDays).padStart(4)}d  ${c.path}`);
  }
  if (report.candidates.length === 0) print(chalk.dim('  （无）'));
  print();

  print(chalk.cyan(`── 活跃项目目录（跳过，${report.activeDirs.length}）──`));
  for (const d of report.activeDirs) {
    print(chalk.dim(`  ${d.dir}（最近 ${d.newestAgeDays}d 内有改动，${d.skippedFiles} 文件）`));
  }
  print();

  for (const e of report.excluded) {
    print(chalk.dim(`固定排除 ${e.prefix}/**：${e.files} 文件`));
  }
  print(chalk.dim(`未到账龄阈值：${report.freshFiles} 文件`));
  print();
}

export function workbenchCommand(program: Command): void {
  const workbench = program.command('workbench').description('workbench (_工作台) inspection helpers');

  workbench
    .command('report')
    .description('read-only triage candidate report: stale files, active dirs, exclusions')
    .option('--stale-days <n>', 'age threshold in days for candidates', '45')
    .option('--active-days <n>', 'dirs touched within N days are skipped as active', '14')
    .option('--json', 'machine-readable output', false)
    .action((opts: { staleDays: string; activeDays: string; json?: boolean }) => {
      const corpus = requireCorpus();
      const staleDays = Number.parseInt(opts.staleDays, 10);
      const activeDays = Number.parseInt(opts.activeDays, 10);
      if (!Number.isFinite(staleDays) || staleDays < 0 || !Number.isFinite(activeDays) || activeDays < 0) {
        warn('invalid --stale-days / --active-days');
        process.exit(2);
      }
      const report = buildWorkbenchReport(corpus, { staleDays, activeDays });
      if (opts.json) out(JSON.stringify(report, null, 2));
      else printHumanReport(report);
    });
}
