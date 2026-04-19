/**
 * vectordb/query-bm25.ts — BM25（FTS5）三层召回
 *
 * 批次 22d strangler fig 第四步：从 src/lib/vectordb.ts copy 出 sanitizeFtsQuery
 * + queryBM25Layered。原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换；
 * 本文件目前未被任何调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 镜像 query-layered 的三层结构，但底层走 fts_dirs / fts_pages / fts_chunks（FTS5
 * BM25 排名）而非 vec_*（向量 ANN）。两路结果在 query-hybrid.ts 用 RRF 融合。
 *
 * 适用：精确实体名 / 日期 / 专有名词召回（"Harness" / "Anthropic" / "2026-04-15"）。
 * 中英混合复合短语建议走向量或 hybrid。
 */

import * as logger from '../../utils/logger.js';
import type { Db, QueryResult } from './schema.js';

// ---------------------------------------------------------------------------
// sanitizeFtsQuery — FTS5 查询字符串清洗
// ---------------------------------------------------------------------------

/**
 * FTS5 查询字符串清洗：
 *   - 去掉 FTS5 运算符字符（" * : ^ ( )）和保留关键字（OR/AND/NOT/NEAR）
 *   - trigram tokenizer 下短于 3 字符的 token 无法命中，过滤掉
 *   - 多 token 之间用空格连接（FTS5 默认 AND 语义）
 *
 * 为什么不用短语搜索（"..."）：短语要求整条 trigram 序列完全连续匹配，中英混合
 * 或带空格的 query 几乎永远命中不上。默认 AND 更宽松，跟 BM25 的"精确关键词"
 * 定位一致——先生查"Harness"/"Anthropic"这种精确实体名能命中；查"Harness 五版
 * 演化"这种复合短语 BM25 空是合理的（语义匹配应该走向量或 Hybrid）。
 */
function sanitizeFtsQuery(q: string): string {
  // FTS5 运算符：" * : ^ ( ) - +（`-` 前缀是 NOT，内部的 `-` 也会让日期类 query 失效）
  let s = q.replace(/["*:^()\-+]/g, ' ');
  s = s.replace(/\b(OR|AND|NOT|NEAR)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const tokens = s.split(' ').filter((t) => t.length >= 3);
  if (tokens.length === 0) return '';
  return tokens.join(' ');
}

// ---------------------------------------------------------------------------
// queryBM25Layered — BM25 三层
// ---------------------------------------------------------------------------

/**
 * BM25 三层分层召回，镜像 queryLayered 的过滤逻辑：
 *   L0 fts_dirs → 命中分区的 slug_list
 *   L1 fts_pages 限定 L0 覆盖的 doc_id
 *   L2 fts_chunks 限定 L1 命中页的 doc_id
 *
 * FTS5 的 rank 字段是 BM25 分数（负数，越小越相关）。返回里 score 字段归一为正数。
 *
 * **23a 改动**：原 3 处沉默 catch（L0/L1/L2 各一）改为 `logger.warn` + 注释。
 * FTS5 对 sanitizeFtsQuery 后仍可能因边界 token 抛错（如纯 trigram 不可分串），
 * catch 后返回 `[]` 让上层 hybrid 优雅降级到纯向量；现在失败原因会进 stderr
 * 便于 debug，不再静默吞错。
 */
export function queryBM25Layered(db: Db, queryText: string, topK: number): QueryResult[] {
  const ftsQ = sanitizeFtsQuery(queryText);
  if (!ftsQ) return [];

  // L0: top-3 分区
  let l0Rows: { id: number; rank: number }[] = [];
  try {
    l0Rows = db
      .prepare(
        `SELECT rowid as id, rank FROM fts_dirs WHERE fts_dirs MATCH ? ORDER BY rank LIMIT 3`,
      )
      .all(ftsQ) as { id: number; rank: number }[];
  } catch (e) {
    // FTS5 边界 token 失败 → BM25 整体降级为空，上层 hybrid 回退纯向量
    logger.warn(`queryBM25Layered L0 fts5: ${(e as Error).message}`);
    return [];
  }
  if (l0Rows.length === 0) return [];

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
      /* skip */
    }
  }
  if (candidateSlugs.size === 0) return [];

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

  // L1: top-5 pages，候选限定在 L0 覆盖的 doc_id
  let l1Rows: { id: number; rank: number; doc_id: number }[] = [];
  try {
    l1Rows = db
      .prepare(
        `SELECT fp.rowid as id, fp.rank as rank, ps.doc_id as doc_id
         FROM fts_pages fp
         JOIN page_summaries ps ON fp.rowid = ps.id
         WHERE fp.fts_pages MATCH ? AND ps.doc_id IN (${[...candidateDocIds].map(() => '?').join(',')})
         ORDER BY fp.rank LIMIT 5`,
      )
      .all(ftsQ, ...candidateDocIds) as { id: number; rank: number; doc_id: number }[];
  } catch (e) {
    // 同 L0：fts5 边界 token 失败 → 降级
    logger.warn(`queryBM25Layered L1 fts5: ${(e as Error).message}`);
    return [];
  }
  if (l1Rows.length === 0) return [];

  const l2DocIds = [...new Set(l1Rows.map((r) => r.doc_id))];

  // L2: chunks 限定在 L1 命中页的 doc_id
  let l2Rows: { id: number; rank: number; doc_id: number }[] = [];
  try {
    l2Rows = db
      .prepare(
        `SELECT fc.rowid as id, fc.rank as rank, c.doc_id as doc_id
         FROM fts_chunks fc
         JOIN chunks c ON fc.rowid = c.id
         WHERE fc.fts_chunks MATCH ? AND c.doc_id IN (${l2DocIds.map(() => '?').join(',')})
         ORDER BY fc.rank LIMIT ?`,
      )
      .all(ftsQ, ...l2DocIds, topK) as { id: number; rank: number; doc_id: number }[];
  } catch (e) {
    // 同 L0/L1：fts5 边界 token 失败 → 降级
    logger.warn(`queryBM25Layered L2 fts5: ${(e as Error).message}`);
    return [];
  }
  if (l2Rows.length === 0) return [];

  const results: QueryResult[] = [];
  const getChunk = db.prepare(
    `SELECT c.content, c.section, d.path FROM chunks c JOIN documents d ON c.doc_id = d.id WHERE c.id = ?`,
  );
  for (const row of l2Rows) {
    const cr = getChunk.get(row.id) as
      | { content: string; section: string; path: string }
      | undefined;
    if (cr) {
      results.push({
        file: cr.path,
        chunk: cr.content,
        // FTS5 rank 是负数（越小越相关），取绝对值作为正向分数；归一化留给 RRF
        score: Math.round(-row.rank * 10000) / 10000,
        section: cr.section,
      });
    }
  }
  return results;
}
