/**
 * vectordb/query-bm25.ts — BM25（FTS5）chunk 层直查
 *
 * **批次 24-fix（2026-04-19）重写**：原 layered 三层 (fts_dirs → fts_pages →
 * fts_chunks) 在 21 引入时设计错误——L0 的 dir 摘要只含目录标题 + wikilink 列表，
 * **不含正文**，用户关键词几乎永不命中 L0；一旦 L0 空集整条链路 `return []`，
 * 导致 `lorekit vector query --bm25 --text "browser-use"` 这种最朴素的调用
 * 返回空。这个缺陷隐藏在 hybrid 融合后（向量路补救），22 系列 byte-level 拆分
 * 验证没抓到，22f 真实 ingest 验收时先生发现真实 corpus 里 BM25 永远空才暴露。
 *
 * 方案 X（规划方批准）：BM25 不分层，直接 fts_chunks MATCH + rank 排 topK。
 * 依据：
 * - BM25 本身就用 rank 排精度，不需要 L0/L1 预先缩候选集
 * - dir / page 摘要不含正文是架构事实（buildLayeredIndex 写入语义），不是 bug
 * - 向量路的 queryLayered 保留 L0 gate（向量相似度下 L0 能做语义 gate）
 *
 * 函数名 / 签名 / 返回类型全部保留，commands / query-hybrid 无需改 import。
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
 *
 * **23b 修**：`\d{4}-\d{2}-\d{2}` 完整 ISO 日期 protect-and-restore，避免被
 * `-` 拆 token 退化为 `2026`。流程：
 *   1. 提取所有 ISO 日期，用 `__DATE0__` / `__DATE1__` 占位符替换（前后空格保证分词）
 *   2. 跑现有 sanitize（占位符 `_` 不在 FTS5 运算符 set 里，整串 9 字符 > 3 通过过滤）
 *   3. 把占位符还原为 `"YYYY-MM-DD"`（双引号包裹让 FTS5 当 phrase token，
 *      避免 `-` 被解析成 NOT 前缀）
 *
 * 不识别 `2026/04/15`（`/` 不在原 sanitize 拆分字符里，本来就 OK 不需要保护）。
 * 不识别 `2026-4-15`（年月日不补 0 的非标准格式，避免误识别行内 hyphenated 词如
 * `self-hosted`）。
 */
function sanitizeFtsQuery(q: string): string {
  // 1. protect ISO dates
  const dates: string[] = [];
  const protectedQ = q.replace(/\d{4}-\d{2}-\d{2}/g, (m) => {
    const i = dates.length;
    dates.push(m);
    return ` __DATE${i}__ `;
  });

  // 2. 现有 sanitize 流程
  // FTS5 运算符：" * : ^ ( ) - +（`-` 前缀是 NOT，内部的 `-` 也会让日期类 query 失效）
  let s = protectedQ.replace(/["*:^()\-+]/g, ' ');
  s = s.replace(/\b(OR|AND|NOT|NEAR)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const tokens = s.split(' ').filter((t) => t.length >= 3);
  if (tokens.length === 0) return '';

  // 3. 还原占位符为 quoted 完整日期（FTS5 phrase syntax）
  const restored = tokens.map((t) => {
    const m = t.match(/^__DATE(\d+)__$/);
    return m ? `"${dates[Number(m[1])]}"` : t;
  });
  return restored.join(' ');
}

// ---------------------------------------------------------------------------
// queryBM25Layered — BM25 chunk 层直查（名字保留，语义改为单层）
// ---------------------------------------------------------------------------

/**
 * BM25 召回：fts_chunks MATCH + rank 排序，topK 截断。
 *
 * **不再走 layered 三层**——L0/L1 的 dir/page 摘要不含正文，永不命中用户关键词
 * （详见文件头注释）。改为对 fts_chunks 直接 MATCH，rank 列就是 BM25 负数，
 * 越小越相关；返回时归一为正数。
 *
 * 命名保留 `queryBM25Layered` 是为了兼容现有 import（query-hybrid / commands/vector /
 * lib/vectordb/index）。后续批次若要改名，整个 import 图一起改。
 *
 * 失败路径：FTS5 对 sanitizeFtsQuery 后的 query 仍可能因边界 token 抛错（纯 trigram
 * 不可分串），catch 后返回 `[]` 让上层 hybrid 优雅降级到纯向量；失败原因走 stderr
 * 便于 debug。
 */
export function queryBM25Layered(db: Db, queryText: string, topK: number): QueryResult[] {
  const ftsQ = sanitizeFtsQuery(queryText);
  if (!ftsQ) return [];

  let rows: {
    rank: number;
    content: string;
    section: string | null;
    path: string;
  }[] = [];
  try {
    rows = db
      .prepare(
        `SELECT fc.rank as rank, c.content as content, c.section as section, d.path as path
         FROM fts_chunks fc
         JOIN chunks c ON fc.rowid = c.id
         JOIN documents d ON c.doc_id = d.id
         WHERE fc.fts_chunks MATCH ?
         ORDER BY fc.rank
         LIMIT ?`,
      )
      .all(ftsQ, topK) as {
      rank: number;
      content: string;
      section: string | null;
      path: string;
    }[];
  } catch (e) {
    // FTS5 边界 token 失败 → BM25 整体降级为空，上层 hybrid 回退纯向量
    logger.warn(`queryBM25Layered fts5 match: ${(e as Error).message}`);
    return [];
  }

  return rows.map((r) => ({
    file: r.path,
    chunk: r.content,
    // FTS5 rank 是负数（越小越相关），取绝对值作为正向分数；归一化留给 RRF
    score: Math.round(-r.rank * 10000) / 10000,
    section: r.section ?? '',
  }));
}
