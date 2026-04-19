/**
 * vectordb/query-hybrid.ts — 向量 + BM25 双路 RRF 融合
 *
 * 批次 22d strangler fig 第四步：从 src/lib/vectordb.ts copy 出 rrfMerge + queryHybrid。
 * 原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 这是 4 路 query（flat / layered / bm25 / hybrid）里的"组合"端，自身不写 db query：
 * - 调 22c 的 `queryLayered` 拿向量三层结果
 * - 调本批的 `queryBM25Layered` 拿 BM25 三层结果
 * - 用 `rrfMerge` 把两路按 Reciprocal Rank Fusion 合并
 *
 * commands/vector.ts 的 `vector query --hybrid` 走这里；不带 flag 默认也是 hybrid
 * （根据当前 cli.ts 设定）。
 */

import { queryBM25Layered } from './query-bm25.js';
import { queryLayered } from './query-layered.js';
import type { Db, QueryResult } from './schema.js';

// ---------------------------------------------------------------------------
// rrfMerge — Reciprocal Rank Fusion
// ---------------------------------------------------------------------------

/**
 * Reciprocal Rank Fusion — 多路召回结果的排名合并。
 * 公式：score(item) = Σ 1 / (k + rank_i)  （rank 从 1 开始，k 默认 60）
 * 在两路都靠前的 item 最终 score 最高。
 */
export function rrfMerge(lists: QueryResult[][], topK: number, k: number = 60): QueryResult[] {
  // key = file + chunk 前 80 字（防 chunk 内容重复），value = { item, rrf }
  const merged = new Map<string, { item: QueryResult; rrf: number }>();
  for (const list of lists) {
    list.forEach((item, i) => {
      const key = `${item.file}::${item.chunk.slice(0, 80)}`;
      const rrf = 1 / (k + i + 1);
      const prev = merged.get(key);
      if (prev) {
        prev.rrf += rrf;
      } else {
        merged.set(key, { item, rrf });
      }
    });
  }
  return [...merged.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK)
    .map(({ item, rrf }) => ({
      ...item,
      score: Math.round(rrf * 10000) / 10000,
    }));
}

// ---------------------------------------------------------------------------
// queryHybrid — 4 路 dispatcher
// ---------------------------------------------------------------------------

/**
 * Hybrid 分层召回：向量三层 + BM25 三层 + RRF 融合。
 * 跟 queryLayered 同签名，可在上层命令里用 `--hybrid` flag 切换。
 * 不做 LLM re-rank（先生决定本轮不上，留给未来）。
 */
export function queryHybrid(
  db: Db,
  embedding: Float32Array,
  queryText: string,
  topK: number,
  threshold: number,
): QueryResult[] {
  // 两路各召回 topK * 2 作为候选，给 RRF 足够的排名信息
  const candN = topK * 2;
  const vecResults = queryLayered(db, embedding, candN, threshold);
  const bm25Results = queryBM25Layered(db, queryText, candN);
  return rrfMerge([vecResults, bm25Results], topK);
}
