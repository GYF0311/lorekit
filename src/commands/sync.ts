import type { Command } from 'commander';
import chalk from 'chalk';
import { requireCorpus } from '../lib/corpus.js';
import { ok, warn, err } from '../utils/logger.js';
import { runIndex } from './index.js';
import { runVectorSync } from './vector.js';
import { runDoctor } from './doctor.js';

export interface SyncOptions {
  force?: boolean;
  model?: string;
  skipDoctor?: boolean;
  skipVector?: boolean;
}

/**
 * lorekit sync — 一条命令把「文本档案 + 向量库」对齐。
 *
 * 执行顺序（必须是这个顺序）：
 *   1. runIndex：扫目录生成/刷新所有 _INDEX.md
 *        → 向量 L1 的输入源必须先存在，才能被下一步读
 *   2. runVectorSync（layered=true）：增量嵌入 chunk + 刷 L0/L1 向量
 *        → L0 读 corpus/index.md 的 ## 分区
 *        → L1 读每个 {dir}/_INDEX.md 的条目行
 *   3. runDoctor：sanity check，只报告不阻塞
 */
export async function runSync(corpus: string, opts: SyncOptions = {}): Promise<void> {
  const force = opts.force ?? false;
  const model = opts.model ?? 'bge-m3';

  // Step 1: 文本档案
  console.log(chalk.cyan('── [1/3] index: refresh _INDEX.md ──'));
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
  console.log();

  // Step 2: 向量库（除非显式 --skip-vector）
  if (!opts.skipVector) {
    console.log(chalk.cyan('── [2/3] vector: sync chunks + L0/L1 ──'));
    try {
      const r = await runVectorSync(corpus, { force, model, layered: true });
      ok(
        `synced ${r.synced} files (${r.totalChunks} chunks), skipped ${r.skipped} unchanged`,
      );
    } catch (e) {
      err(`vector sync failed: ${(e as Error).message}`);
      throw e;
    }
    console.log();
  }

  // Step 3: 健康体检（只报告不阻塞）
  if (!opts.skipDoctor) {
    console.log(chalk.cyan('── [3/3] doctor: sanity check ──'));
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
    .action(async (opts: SyncOptions) => {
      const corpus = requireCorpus();
      try {
        await runSync(corpus, opts);
      } catch {
        process.exit(1);
      }
    });
}
