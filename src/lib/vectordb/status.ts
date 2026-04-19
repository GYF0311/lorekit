/**
 * vectordb/status.ts — 检索模式推荐 + 全库 status 元数据
 *
 * 批次 22e strangler fig 第五步：从 src/lib/vectordb.ts copy 出 computeMode + getStatus。
 * 原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 职责：
 * - `computeMode`：纯函数，按 indexed_files 对比 MODE_THRESHOLD_FILES 决定推荐 text / vector
 * - `getStatus`：读路径，打开 db → COUNT 各表 → 读 meta(last_sync/model/dim) → 调
 *   collectFiles 拿 total_indexable_files → 调 computeMode 拼 StatusInfo 返回
 *
 * commands/vector.ts 的 `vector status` 子命令直接调 getStatus 拿 JSON 给 wiki-query
 * skill 读 mode 字段决定 text/vector 检索路径。
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import * as logger from '../../utils/logger.js';
import { collectFiles } from './files.js';
import { EMBEDDING_DIM, MODE_THRESHOLD_FILES, openDb } from './schema.js';
import type { StatusInfo } from './schema.js';

// ---------------------------------------------------------------------------
// computeMode — 纯函数：indexed + indexedFiles → mode + reason
// ---------------------------------------------------------------------------

/**
 * 根据 indexed_files 决定检索模式推荐。
 *   - 向量库未建 → text（没得选）
 *   - indexed_files < 阈值 → text（Read 三层精度最高）
 *   - indexed_files >= 阈值 → vector（扁平 Read 太慢）
 */
function computeMode(
  indexed: boolean,
  indexedFiles: number,
): { mode: 'text' | 'vector'; reason: string } {
  if (!indexed) {
    return {
      mode: 'text',
      reason: 'vector index not built; text Read is the only option',
    };
  }
  if (indexedFiles < MODE_THRESHOLD_FILES) {
    return {
      mode: 'text',
      reason: `indexed_files=${indexedFiles} < ${MODE_THRESHOLD_FILES}; Read three-tier is sharpest at small scale`,
    };
  }
  return {
    mode: 'vector',
    reason: `indexed_files=${indexedFiles} >= ${MODE_THRESHOLD_FILES}; flat Read too slow, switch to layered vector retrieval`,
  };
}

// ---------------------------------------------------------------------------
// getStatus — 读全库元数据，拼 StatusInfo
// ---------------------------------------------------------------------------

/**
 * 读 `<corpus>/.wiki/vector.sqlite` 元数据：
 * - 不存在 → 返回 `{indexed: false, message, mode: 'text'}`（mode_threshold + mode_reason 仍填）
 * - 存在 → openDb → COUNT documents/chunks/dir_summaries/page_summaries
 *   + 读 meta(last_sync/model/dim) + collectFiles 算 total_indexable_files
 *   + computeMode 决定 mode / mode_reason
 *
 * **23a 改动**：原沉默 catch（老 db 缺 dir_summaries / page_summaries 表的兼容兜底）
 * 改为 `logger.warn(...)` + 明确注释。dirCount / pageCount 留 0 不阻塞 status 输出。
 */
export async function getStatus(corpus: string): Promise<StatusInfo> {
  const dbPath = join(corpus, '.wiki', 'vector.sqlite');
  if (!existsSync(dbPath)) {
    const rec = computeMode(false, 0);
    return {
      indexed: false,
      message: "No vector index found. Run 'lorekit vector sync' first.",
      mode: rec.mode,
      mode_threshold: MODE_THRESHOLD_FILES,
      mode_reason: rec.reason,
    };
  }

  const db = await openDb(corpus);

  const docCount = (db.prepare('SELECT COUNT(*) as n FROM documents').get() as { n: number }).n;
  const chunkCount = (db.prepare('SELECT COUNT(*) as n FROM chunks').get() as { n: number }).n;
  const lastSync = db.prepare("SELECT value FROM meta WHERE key = 'last_sync'").get() as
    | { value: string }
    | undefined;
  const model = db.prepare("SELECT value FROM meta WHERE key = 'model'").get() as
    | { value: string }
    | undefined;
  const dim = db.prepare("SELECT value FROM meta WHERE key = 'dim'").get() as
    | { value: string }
    | undefined;

  const totalFiles = collectFiles(corpus).length;

  let dirCount = 0;
  let pageCount = 0;
  try {
    dirCount = (db.prepare('SELECT COUNT(*) as n FROM dir_summaries').get() as { n: number }).n;
    pageCount = (db.prepare('SELECT COUNT(*) as n FROM page_summaries').get() as { n: number }).n;
  } catch (e) {
    // 老 db（批次 22 之前的版本）可能缺 dir_summaries / page_summaries 表，
    // 留 dirCount/pageCount=0 不阻塞 status 输出；下次 lorekit sync 会通过 openDb
    // 的 DDL CREATE IF NOT EXISTS 自动建表。
    logger.warn(`getStatus: layered tables missing, treat as 0 (${(e as Error).message})`);
  }

  db.close();

  const rec = computeMode(true, docCount);

  return {
    indexed: true,
    total_indexable_files: totalFiles,
    indexed_files: docCount,
    chunks: chunkCount,
    layered: { dirs: dirCount, pages: pageCount },
    embedding_dim: dim ? parseInt(dim.value, 10) : EMBEDDING_DIM,
    last_sync: lastSync?.value ?? null,
    model: model?.value ?? null,
    backend: 'ollama',
    mode: rec.mode,
    mode_threshold: MODE_THRESHOLD_FILES,
    mode_reason: rec.reason,
  };
}
