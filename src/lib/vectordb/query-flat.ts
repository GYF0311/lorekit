/**
 * vectordb/query-flat.ts — 单层向量召回（最简实现，对照 layered 的 baseline）
 *
 * 批次 22c strangler fig 第三步：从 src/lib/vectordb.ts copy 出 queryFlat。
 * 原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 职责：
 * - 单一 vec_chunks 表 ANN top-K 召回
 * - threshold 过滤后 JOIN documents 拿 file path 与 section 元数据
 * - 不做分层、不做 parent boost、不做 BM25 融合（那些在 query-layered / query-bm25 /
 *   query-hybrid 各自负责）
 *
 * 适用：调试 / 小语料 / 不想要 layered 复杂逻辑时；commands/vector.ts 的
 * `vector query` 默认走 queryHybrid，flat 通过显式 flag 触发。
 */

import { distanceToScore, float32ToBuffer } from './files.js';
import type { Db, QueryResult } from './schema.js';

// ---------------------------------------------------------------------------
// queryFlat
// ---------------------------------------------------------------------------

/**
 * 单层向量 query：
 * - vec_chunks MATCH ? ORDER BY distance LIMIT topK
 * - 距离 → 相似度（distanceToScore：1 - d²/2）
 * - 低于 threshold 的 chunk 丢弃
 * - 用 chunks.id JOIN documents 拿 path / section
 *
 * 返回的 QueryResult.score 保留 4 位小数（`Math.round(score * 10000) / 10000`），
 * 跟 layered / bm25 / hybrid 的输出保持一致便于下游对比。
 */
export function queryFlat(
  db: Db,
  embedding: Float32Array,
  topK: number,
  threshold: number,
): QueryResult[] {
  const blob = float32ToBuffer(embedding);

  const rows = db
    .prepare(
      `SELECT v.rowid as id, v.distance
       FROM vec_chunks v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`,
    )
    .all(blob, topK) as { id: number; distance: number }[];

  const results: QueryResult[] = [];
  const getChunk = db.prepare(
    `SELECT c.content, c.section, d.path
     FROM chunks c JOIN documents d ON c.doc_id = d.id
     WHERE c.id = ?`,
  );

  for (const row of rows) {
    const score = distanceToScore(row.distance);
    if (score < threshold) continue;
    const cr = getChunk.get(row.id) as
      | { content: string; section: string; path: string }
      | undefined;
    if (cr) {
      results.push({
        file: cr.path,
        chunk: cr.content,
        score: Math.round(score * 10000) / 10000,
        section: cr.section,
      });
    }
  }

  return results;
}
