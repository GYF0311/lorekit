import type { Command } from 'commander';
import chalk from 'chalk';
import { requireCorpus } from '../lib/corpus.js';
import { ok, warn, err, print } from '../utils/logger.js';
import { runIndex } from './index.js';
import { runVectorSync } from './vector.js';
import { runDoctor } from './doctor.js';
import { refreshRootIndex } from '../lib/root-index.js';

export interface SyncOptions {
  force?: boolean;
  model?: string;
  skipDoctor?: boolean;
  skipVector?: boolean;
  skipRootIndex?: boolean;
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
export async function runSync(corpus: string, opts: SyncOptions = {}): Promise<void> {
  const force = opts.force ?? false;
  const model = opts.model ?? 'bge-m3';

  // Step 1a: 各子目录的 _INDEX.md
  print(chalk.cyan('── [1/3] index: refresh _INDEX.md ──'));
  try {
    const generated = runIndex(corpus);
    if (generated === 0) {
      warn('no indexable directories found');
    } else {
      ok(`refreshed ${generated} _INDEX.md file(s)`);
    }
  } catch (e) {
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
      err(`root index sync failed: ${(e as Error).message}`);
      throw e;
    }
  }
  print();

  // Step 2: 向量库（除非显式 --skip-vector）
  if (!opts.skipVector) {
    print(chalk.cyan('── [2/3] vector: sync chunks + L0/L1 ──'));
    try {
      const r = await runVectorSync(corpus, { force, model, layered: true });
      ok(`synced ${r.synced} files (${r.totalChunks} chunks), skipped ${r.skipped} unchanged`);
    } catch (e) {
      err(`vector sync failed: ${(e as Error).message}`);
      throw e;
    }
    print();
  }

  // Step 3: 健康体检（只报告不阻塞）
  if (!opts.skipDoctor) {
    print(chalk.cyan('── [3/3] doctor: sanity check ──'));
    runDoctor(corpus);
  }
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
    .action(async (opts: SyncOptions) => {
      const corpus = requireCorpus();
      try {
        await runSync(corpus, opts);
      } catch {
        process.exit(1);
      }
    });
}
