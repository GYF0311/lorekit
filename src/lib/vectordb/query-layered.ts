/**
 * vectordb/query-layered.ts — L0/L1/L2 三层向量召回
 *
 * 批次 22c strangler fig 第三步：从 src/lib/vectordb.ts copy 出 queryLayered。
 * 原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 三层结构（基于 buildLayeredIndex 建立的索引）：
 *
 * - **L0** vec_dirs：top-3 sections（index.md 的 ## 分区向量）
 *   → 用 dir_summaries.slug_list 收集"覆盖到的所有候选 slug"
 *
 * - **L1** vec_pages：在 L0 候选 doc_id 范围内召回 top-5 pages
 *   → searchK = min(候选页数, 50)；vec0 只能限 K 不能限范围，先全召回再 filter
 *
 * - **L2** vec_chunks：在 L1 命中页的 chunks 范围内召回 topK
 *   → searchK2 = min(候选 chunks 数, topK*5)；同样先召回再 filter
 *
 * 每层任意阶段命中为空 → 短路返回 `[]`（不退化到全库 flat 召回）。
 *
 * 设计取舍：分层把"语义召回"分阶段约束在"结构相关"的子集，避免大库 ANN
 * 误命中冷门文档。代价是命中阈值越低 / 库规模越小时，可能比 flat 漏召。
 */

import { distanceToScore, float32ToBuffer } from './files.js';
import type { Db, QueryResult } from './schema.js';

// ---------------------------------------------------------------------------
// queryLayered
// ---------------------------------------------------------------------------

export function queryLayered(
  db: Db,
  embedding: Float32Array,
  topK: number,
  threshold: number,
): QueryResult[] {
  const blob = float32ToBuffer(embedding);

  // L0: top-3 sections（分区向量，每个分区 = index.md 里一个 ## 区块）
  const l0Rows = db
    .prepare(
      `SELECT v.rowid as id, v.distance
       FROM vec_dirs v
       WHERE v.embedding MATCH ? AND k = 3
       ORDER BY v.distance`,
    )
    .all(blob) as { id: number; distance: number }[];

  if (l0Rows.length === 0) return [];

  // 从 dir_summaries.slug_list 拿 L0 命中分区覆盖的所有 slug
  const dirIds = l0Rows.map((r) => r.id);
  const dirRows = db
    .prepare(`SELECT slug_list FROM dir_summaries WHERE id IN (${dirIds.map(() => '?').join(',')})`)
    .all(...dirIds) as { slug_list: string }[];

  const candidateSlugs = new Set<string>();
  for (const row of dirRows) {
    try {
      const list = JSON.parse(row.slug_list) as string[];
      for (const s of list) candidateSlugs.add(s);
    } catch {
      // slug_list 异常（老库未迁移时可能是空串）→ 跳过
    }
  }

  if (candidateSlugs.size === 0) return [];

  // 把 slug 映射成 doc_id（兼容目录包装式 slug、去/不去 .md 后缀）
  const docRows = db.prepare('SELECT id, path FROM documents').all() as {
    id: number;
    path: string;
  }[];
  const candidateDocIds = new Set<number>();
  for (const { id, path } of docRows) {
    const stem = path.replace(/\.md$/, '');
    const folderSlug = path.endsWith('/article.md') ? path.replace(/\/article\.md$/, '') : null;
    if (candidateSlugs.has(path) || candidateSlugs.has(stem)) {
      candidateDocIds.add(id);
    } else if (folderSlug && candidateSlugs.has(folderSlug)) {
      candidateDocIds.add(id);
    }
  }

  if (candidateDocIds.size === 0) return [];

  // L1: top-5 pages，候选限定在 L0 命中分区覆盖的 doc_id
  const docIdArr = [...candidateDocIds];
  const candidatePageIds = db
    .prepare(`SELECT id FROM page_summaries WHERE doc_id IN (${docIdArr.map(() => '?').join(',')})`)
    .all(...docIdArr) as { id: number }[];

  if (candidatePageIds.length === 0) return [];

  const searchK = Math.min(candidatePageIds.length, 50);
  const l1Rows = db
    .prepare(
      `SELECT v.rowid as id, v.distance
       FROM vec_pages v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`,
    )
    .all(blob, searchK) as { id: number; distance: number }[];

  const candidateSet = new Set(candidatePageIds.map((r) => r.id));
  const l1Filtered = l1Rows.filter((r) => candidateSet.has(r.id)).slice(0, 5);

  if (l1Filtered.length === 0) return [];

  // Get doc_ids from matched page summaries
  const pageIds = l1Filtered.map((r) => r.id);
  const docIds = db
    .prepare(
      `SELECT DISTINCT doc_id FROM page_summaries WHERE id IN (${pageIds.map(() => '?').join(',')})`,
    )
    .all(...pageIds) as { doc_id: number }[];

  if (docIds.length === 0) return [];

  // L2: chunks within matched docs
  const docIdList = docIds.map((r) => r.doc_id);
  const candidateChunkIds = db
    .prepare(`SELECT id FROM chunks WHERE doc_id IN (${docIdList.map(() => '?').join(',')})`)
    .all(...docIdList) as { id: number }[];

  if (candidateChunkIds.length === 0) return [];

  const searchK2 = Math.min(candidateChunkIds.length, topK * 5);
  const l2Rows = db
    .prepare(
      `SELECT v.rowid as id, v.distance
       FROM vec_chunks v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`,
    )
    .all(blob, searchK2) as { id: number; distance: number }[];

  const chunkSet = new Set(candidateChunkIds.map((r) => r.id));
  const l2Filtered = l2Rows.filter((r) => chunkSet.has(r.id)).slice(0, topK);

  const results: QueryResult[] = [];
  const getChunk = db.prepare(
    `SELECT c.content, c.section, d.path
     FROM chunks c JOIN documents d ON c.doc_id = d.id
     WHERE c.id = ?`,
  );

  for (const row of l2Filtered) {
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
