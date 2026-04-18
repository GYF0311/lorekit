/**
 * Vector database layer — SQLite + sqlite-vec backed vector store.
 *
 * Dependencies (better-sqlite3, sqlite-vec) are dynamically imported so that
 * missing optional deps don't break other lorekit commands.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryResult {
  file: string;
  chunk: string;
  score: number;
  section: string;
}

export interface StatusInfo {
  indexed: boolean;
  total_indexable_files?: number;
  indexed_files?: number;
  chunks?: number;
  layered?: { dirs: number; pages: number };
  embedding_dim?: number;
  last_sync?: string | null;
  model?: string | null;
  backend?: string;
  message?: string;
  /**
   * 检索模式推荐（wiki-query skill 直接读这个字段决定路径，不做数值判断）
   *   - "text"   → 走 Read 三层（corpus/index.md → {dir}/_INDEX.md → 具体文件）
   *   - "vector" → 走向量 layered 召回
   */
  mode?: 'text' | 'vector';
  mode_threshold?: number;
  mode_reason?: string;
}

type EmbedFn = (texts: string[]) => Promise<Float32Array[]>;

// We use `any` for the Database type to avoid top-level import of better-sqlite3.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBEDDING_DIM = 1024;

/**
 * 文本模式 ↔ 向量模式的切换阈值（按 indexed_files 计数，不按 chunks）。
 *
 * 为什么按文档数不按 chunks：chunks 会被单文档长度扭曲（一篇 2 万字可能切出 30+ chunks，
 * 但它仍然只是"一份材料"）。Karpathy 原文也是按 pages/sources 计数：
 *   "works surprisingly well at moderate scale (~100 sources, ~hundreds of pages)
 *    and avoids the need for embedding-based RAG infrastructure."
 *
 * 100 = 按 Karpathy 原文的 moderate scale 上界。到这规模之前，Read 三层精度最高；
 * 超过后扁平 Read 太慢，切向量 layered 召回。
 *
 * 先生要调：改这里的数字即可，所有 skill 通过 `lorekit vector status` 读 `mode` 字段
 * 自动跟随。
 */
export const MODE_THRESHOLD_FILES = 100;

const INCLUDE_DIRS = [
  '知识库',
  '每日',
  '写作',
  '原料/文章',
  '原料/书籍',
  '原料/会议',
];

const EXCLUDE_PREFIXES = [
  '_工作台',
  '_archive',
  '_归档',
  '原料/录音',
  '原料/剪藏',
  '反馈',
  '系统',
  '.wiki',
];

const EXCLUDE_NAMES = new Set(['.gitkeep', '.DS_Store']);

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const DDL = `
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    sha256 TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY,
    doc_id INTEGER NOT NULL,
    section TEXT,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS dir_summaries (
    id INTEGER PRIMARY KEY,
    dir_path TEXT UNIQUE NOT NULL,
    summary TEXT NOT NULL,
    embedding BLOB NOT NULL,
    slug_list TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS page_summaries (
    id INTEGER PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES documents(id),
    summary TEXT NOT NULL,
    embedding BLOB NOT NULL
);
`;

function vecDdl(dim: number): string {
  return `
CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
    embedding float[${dim}] distance_metric=cosine
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_dirs USING vec0(
    embedding float[${dim}] distance_metric=cosine
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_pages USING vec0(
    embedding float[${dim}] distance_metric=cosine
);
`;
}

/**
 * FTS5 虚表 DDL：跟 vec_* 平行存在于同一份 vector.sqlite 里。
 * tokenize='trigram'：对中文友好（每 3 字符滑动窗口），专有名词和日期精确命中。
 * rowid 跟对应 SQL 表的 id 对齐（chunks.id / dir_summaries.id / page_summaries.id）。
 */
const FTS_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
    content,
    tokenize='trigram'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_dirs USING fts5(
    summary,
    tokenize='trigram'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_pages USING fts5(
    summary,
    tokenize='trigram'
);
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(filePath: string): string {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

function float32ToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/** Convert sqlite-vec cosine distance to similarity score.
 *  sqlite-vec returns sqrt(2*(1 - cos_sim)), so:
 *    score = 1 - distance^2 / 2  */
function distanceToScore(distance: number): number {
  return 1.0 - (distance * distance) / 2.0;
}

function shouldIndex(rel: string): boolean {
  const parts = rel.split('/');
  if (EXCLUDE_NAMES.has(parts[parts.length - 1])) return false;
  if (!rel.endsWith('.md')) return false;
  for (const prefix of EXCLUDE_PREFIXES) {
    if (rel === prefix || rel.startsWith(prefix + '/')) return false;
  }
  for (const inc of INCLUDE_DIRS) {
    if (rel === inc || rel.startsWith(inc + '/')) return true;
  }
  return false;
}

export function collectFiles(corpus: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md')) {
        const rel = relative(corpus, full);
        if (shouldIndex(rel)) {
          results.push(full);
        }
      }
    }
  }

  walk(corpus);
  return results.sort();
}

function extractPageSummary(filePath: string): string {
  const raw = readFileSync(filePath, 'utf-8');
  const { data: fm, content: body } = matter(raw);

  let title = (fm.title as string) || '';
  if (!title) {
    const m = body.match(/^#\s+(.+)/m);
    title = m ? m[1].trim() : basename(filePath, '.md');
  }

  // Try "## Compiled Truth" section
  const ctMatch = body.match(/(?:^|\n)## Compiled Truth\s*\n([\s\S]*?)(?=\n## |\n*$)/);
  const intro = ctMatch ? ctMatch[1].trim().slice(0, 200) : body.trim().slice(0, 200);

  return `${title}: ${intro}`;
}

// ---------------------------------------------------------------------------
// Dynamic import helper
// ---------------------------------------------------------------------------

async function loadSqlite(): Promise<{
  Database: typeof import('better-sqlite3');
  sqliteVec: { load: (db: Db) => void };
}> {
  let Database: typeof import('better-sqlite3');
  try {
    Database = (await import('better-sqlite3')).default as unknown as typeof import('better-sqlite3');
  } catch {
    throw new Error(
      'better-sqlite3 is required for the vector engine.\n' +
        '  Install it: npm install better-sqlite3',
    );
  }

  let sqliteVec: { load: (db: Db) => void };
  try {
    const vecMod = await import('sqlite-vec');
    sqliteVec = vecMod as unknown as { load: (db: Db) => void };
  } catch {
    throw new Error(
      'sqlite-vec is required for the vector engine.\n' +
        '  Install it: npm install sqlite-vec',
    );
  }

  return { Database, sqliteVec };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function openDb(corpus: string, dim = EMBEDDING_DIM): Promise<Db> {
  const { Database, sqliteVec } = await loadSqlite();

  const wikiDir = join(corpus, '.wiki');
  if (!existsSync(wikiDir)) mkdirSync(wikiDir, { recursive: true });

  const dbPath = join(wikiDir, 'vector.sqlite');
  const db = new (Database as any)(dbPath);
  sqliteVec.load(db);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(DDL);
  db.exec(vecDdl(dim));
  db.exec(FTS_DDL);

  // Migration: dir_summaries.slug_list 字段是后加的，老库要补。
  // 数据每次 buildLayeredIndex 都会全量重建，ALTER 完留空数组即可。
  const dirCols = db.prepare('PRAGMA table_info(dir_summaries)').all() as {
    name: string;
  }[];
  if (!dirCols.some((c) => c.name === 'slug_list')) {
    db.exec(`ALTER TABLE dir_summaries ADD COLUMN slug_list TEXT NOT NULL DEFAULT '[]'`);
  }

  return db;
}

export async function syncFile(
  db: Db,
  filePath: string,
  corpus: string,
  embedFn: EmbedFn,
): Promise<{ chunks: number }> {
  const { chunkFile } = await import('./chunker.js');

  const rel = relative(corpus, filePath);
  const sha = sha256(filePath);

  // Remove old data — chunks / page_summaries 都引用 documents.id，要级联清；
  // 每张 virtual table（vec_*, fts_*）的 rowid 跟对应 SQL 表的 id 一一对应。
  const old = db.prepare('SELECT id FROM documents WHERE path = ?').get(rel) as
    | { id: number }
    | undefined;
  if (old) {
    // 1. chunks + vec_chunks + fts_chunks
    const chunkIds = db
      .prepare('SELECT id FROM chunks WHERE doc_id = ?')
      .all(old.id) as { id: number }[];
    const delVecChunk = db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
    const delFtsChunk = db.prepare('DELETE FROM fts_chunks WHERE rowid = ?');
    for (const { id } of chunkIds) {
      delVecChunk.run(id);
      delFtsChunk.run(id);
    }
    db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(old.id);

    // 2. page_summaries + vec_pages + fts_pages（外键拦 documents 删除，必须先清）
    const pageIds = db
      .prepare('SELECT id FROM page_summaries WHERE doc_id = ?')
      .all(old.id) as { id: number }[];
    const delVecPage = db.prepare('DELETE FROM vec_pages WHERE rowid = ?');
    const delFtsPage = db.prepare('DELETE FROM fts_pages WHERE rowid = ?');
    for (const { id } of pageIds) {
      delVecPage.run(id);
      delFtsPage.run(id);
    }
    db.prepare('DELETE FROM page_summaries WHERE doc_id = ?').run(old.id);

    // 3. 最后删 documents
    db.prepare('DELETE FROM documents WHERE id = ?').run(old.id);
  }

  const now = new Date().toISOString();
  db.prepare('INSERT INTO documents (path, sha256, updated_at) VALUES (?, ?, ?)').run(
    rel,
    sha,
    now,
  );
  const docRow = db.prepare('SELECT id FROM documents WHERE path = ?').get(rel) as {
    id: number;
  };
  const docId = docRow.id;

  const chunks = chunkFile(filePath, corpus);
  if (chunks.length === 0) return { chunks: 0 };

  const texts = chunks.map((c) => c.content);
  const embeddings = await embedFn(texts);

  const insertChunk = db.prepare(
    'INSERT INTO chunks (doc_id, section, content, embedding) VALUES (?, ?, ?, ?)',
  );
  const insertFts = db.prepare('INSERT INTO fts_chunks(rowid, content) VALUES (?, ?)');
  for (let i = 0; i < chunks.length; i++) {
    const blob = float32ToBuffer(embeddings[i]);
    insertChunk.run(docId, chunks[i].section, chunks[i].content, blob);
    const chunkId = Number(
      (db.prepare('SELECT last_insert_rowid() as id').get() as { id: bigint }).id,
    );
    // vec0 doesn't support bound params for rowid — must inline
    db.prepare(`INSERT INTO vec_chunks (rowid, embedding) VALUES (${chunkId}, ?)`).run(blob);
    insertFts.run(chunkId, chunks[i].content);
  }

  return { chunks: chunks.length };
}

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
    .prepare(
      `SELECT slug_list FROM dir_summaries WHERE id IN (${dirIds.map(() => '?').join(',')})`,
    )
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
    const folderSlug = path.endsWith('/article.md')
      ? path.replace(/\/article\.md$/, '')
      : null;
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
    .prepare(
      `SELECT id FROM page_summaries WHERE doc_id IN (${docIdArr.map(() => '?').join(',')})`,
    )
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
    .prepare(
      `SELECT id FROM chunks WHERE doc_id IN (${docIdList.map(() => '?').join(',')})`,
    )
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

// ---------------------------------------------------------------------------
// 阶段 2: BM25 分层召回 + RRF 融合（无 LLM re-rank，先生待定）
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

/**
 * BM25 三层分层召回，镜像 queryLayered 的过滤逻辑：
 *   L0 fts_dirs → 命中分区的 slug_list
 *   L1 fts_pages 限定 L0 覆盖的 doc_id
 *   L2 fts_chunks 限定 L1 命中页的 doc_id
 *
 * FTS5 的 rank 字段是 BM25 分数（负数，越小越相关）。返回里 score 字段归一为正数。
 */
export function queryBM25Layered(
  db: Db,
  queryText: string,
  topK: number,
): QueryResult[] {
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
  } catch {
    return [];
  }
  if (l0Rows.length === 0) return [];

  const dirIds = l0Rows.map((r) => r.id);
  const dirRows = db
    .prepare(
      `SELECT slug_list FROM dir_summaries WHERE id IN (${dirIds.map(() => '?').join(',')})`,
    )
    .all(...dirIds) as { slug_list: string }[];

  const candidateSlugs = new Set<string>();
  for (const row of dirRows) {
    try {
      const list = JSON.parse(row.slug_list) as string[];
      for (const s of list) candidateSlugs.add(s);
    } catch { /* skip */ }
  }
  if (candidateSlugs.size === 0) return [];

  const docRows = db.prepare('SELECT id, path FROM documents').all() as {
    id: number;
    path: string;
  }[];
  const candidateDocIds = new Set<number>();
  for (const { id, path } of docRows) {
    const stem = path.replace(/\.md$/, '');
    const folderSlug = path.endsWith('/article.md')
      ? path.replace(/\/article\.md$/, '')
      : null;
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
  } catch {
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
  } catch {
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

/**
 * Reciprocal Rank Fusion — 多路召回结果的排名合并。
 * 公式：score(item) = Σ 1 / (k + rank_i)  （rank 从 1 开始，k 默认 60）
 * 在两路都靠前的 item 最终 score 最高。
 */
export function rrfMerge(
  lists: QueryResult[][],
  topK: number,
  k: number = 60,
): QueryResult[] {
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

// ---------------------------------------------------------------------------
// Layered index: L0 / L1 helpers — 从 corpus/index.md 和 {dir}/_INDEX.md 读档案
// ---------------------------------------------------------------------------

/**
 * 解析 corpus/index.md，按 `## 分区` 切分。
 * 每个分区 = {
 *   name:  分区标题（如 "概念"）
 *   text:  完整分区文本（含标题和所有条目行，用于向量化）
 *   slugs: 该分区下所有条目的主 slug（每行 `- [[slug]]` 的 slug 部分，去重）
 * }
 * 过滤：没有任何 `- ` 列表条目的分区跳过（比如"（暂无条目）"）。
 *
 * slugs 用于 queryLayered 的 L0 → L1 候选过滤：L0 命中分区后，用 slugs
 * 反查 doc_id 列表，把 L1 候选限定在这些 doc_id 内。
 */
function parseIndexSections(
  content: string,
): Array<{ name: string; text: string; slugs: string[] }> {
  const lines = content.split('\n');
  const sections: Array<{ name: string; lines: string[] }> = [];
  let current: { name: string; lines: string[] } | null = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { name: m[1].trim(), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  // 每条目主 slug：行首 `- [[slug]]`（或 `* [[slug]]`），只取第一个 wikilink
  const entrySlugRe = /^\s*[-*]\s*\[\[([^\]|#]+?)\]\]/;

  return sections
    .filter((s) => /^\s*[-*]\s/m.test(s.lines.slice(1).join('\n')))
    .map((s) => {
      const slugs: string[] = [];
      for (const line of s.lines.slice(1)) {
        const m = line.match(entrySlugRe);
        if (m) slugs.push(m[1].trim());
      }
      return {
        name: s.name,
        text: s.lines.join('\n').trim(),
        slugs: [...new Set(slugs)],
      };
    });
}

/**
 * 解析 `{dir}/_INDEX.md` 表格行：`| [[slug]] | summary | updated |`
 * 跳过表头（含"条目"二字）和分隔行（全是 - 和 |）
 */
function parseIndexEntries(
  content: string,
): Array<{ slug: string; summary: string }> {
  const lines = content.split('\n');
  const entries: Array<{ slug: string; summary: string }> = [];

  for (const line of lines) {
    if (/^\|\s*条目\s*\|/.test(line)) continue;
    if (/^\|[\s\-|]+\|?\s*$/.test(line)) continue;

    const m = line.match(
      /^\|\s*\[\[([^\]|#]+?)\]\]\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/,
    );
    if (!m) continue;
    const slug = m[1].trim();
    const summary = m[2].replace(/\\\|/g, '|').trim();
    entries.push({ slug, summary });
  }

  return entries;
}

/**
 * 递归扫 corpus 找所有 `_INDEX.md`，复用 vectordb 的 EXCLUDE_PREFIXES 排除规则。
 */
function findAllIndexFiles(corpus: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      const rel = relative(corpus, full);
      if (EXCLUDE_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'))) continue;

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === '_INDEX.md') {
        results.push(full);
      }
    }
  }
  walk(corpus);
  return results.sort();
}

export async function buildLayeredIndex(
  db: Db,
  corpus: string,
  embedFn: EmbedFn,
): Promise<void> {
  // --- L0: 从 corpus/index.md 按 ## 分区切，每区一条向量 + 一条 FTS ---
  db.prepare('DELETE FROM dir_summaries').run();
  db.prepare('DELETE FROM vec_dirs').run();
  db.prepare('DELETE FROM fts_dirs').run();

  const indexPath = join(corpus, 'index.md');
  if (!existsSync(indexPath)) {
    console.log('  L0: corpus/index.md not found, skipped');
  } else {
    const raw = readFileSync(indexPath, 'utf-8');
    const { content } = matter(raw);
    const sections = parseIndexSections(content);

    if (sections.length === 0) {
      console.log('  L0: no sections with entries in index.md, skipped');
    } else {
      const texts = sections.map((s) => s.text);
      const embeddings = await embedFn(texts);

      const insertDir = db.prepare(
        'INSERT INTO dir_summaries (dir_path, summary, embedding, slug_list) VALUES (?, ?, ?, ?)',
      );
      const insertFtsDir = db.prepare(
        'INSERT INTO fts_dirs(rowid, summary) VALUES (?, ?)',
      );
      for (let i = 0; i < sections.length; i++) {
        const blob = float32ToBuffer(embeddings[i]);
        const slugListJson = JSON.stringify(sections[i].slugs);
        insertDir.run(sections[i].name, sections[i].text, blob, slugListJson);
        const dirId = Number(
          (db.prepare('SELECT last_insert_rowid() as id').get() as { id: bigint }).id,
        );
        db.prepare(`INSERT INTO vec_dirs (rowid, embedding) VALUES (${dirId}, ?)`).run(blob);
        insertFtsDir.run(dirId, sections[i].text);
      }
      const totalSlugs = sections.reduce((a, s) => a + s.slugs.length, 0);
      console.log(
        `  L0: indexed ${sections.length} sections from index.md (${totalSlugs} slugs tracked)`,
      );
    }
  }

  // --- L1: 从各 _INDEX.md 的每行条目，每条一条向量 + 一条 FTS ---
  db.prepare('DELETE FROM page_summaries').run();
  db.prepare('DELETE FROM vec_pages').run();
  db.prepare('DELETE FROM fts_pages').run();

  const indexFiles = findAllIndexFiles(corpus);
  if (indexFiles.length === 0) {
    console.log('  L1: no _INDEX.md found, skipped');
    return;
  }

  const allEntries: Array<{ slug: string; summary: string }> = [];
  for (const f of indexFiles) {
    const raw = readFileSync(f, 'utf-8');
    allEntries.push(...parseIndexEntries(raw));
  }

  if (allEntries.length === 0) {
    console.log('  L1: no entries parsed from _INDEX.md, skipped');
    return;
  }

  // 建 slug → doc_id 映射（兼容目录包装式和去/不去 .md 后缀）
  const docRows = db.prepare('SELECT id, path FROM documents').all() as {
    id: number;
    path: string;
  }[];
  const slugToDocId = new Map<string, number>();
  for (const { id, path } of docRows) {
    slugToDocId.set(path, id);
    slugToDocId.set(path.replace(/\.md$/, ''), id);
    if (path.endsWith('/article.md')) {
      slugToDocId.set(path.replace(/\/article\.md$/, ''), id);
    }
  }

  const matched: Array<{ docId: number; text: string; slug: string }> = [];
  let unmatched = 0;
  for (const e of allEntries) {
    const docId = slugToDocId.get(e.slug);
    if (docId === undefined) {
      unmatched++;
      continue;
    }
    // 向量输入用 summary；summary 缺失时退回 slug（至少有语义路径）
    const text =
      e.summary && e.summary !== '—' && e.summary !== '（缺少 frontmatter）'
        ? e.summary
        : e.slug;
    matched.push({ docId, text, slug: e.slug });
  }

  if (matched.length === 0) {
    console.log('  L1: no _INDEX.md entries matched documents, skipped');
    return;
  }

  const BATCH = 64;
  const insertPage = db.prepare(
    'INSERT INTO page_summaries (doc_id, summary, embedding) VALUES (?, ?, ?)',
  );
  const insertFtsPage = db.prepare(
    'INSERT INTO fts_pages(rowid, summary) VALUES (?, ?)',
  );
  for (let i = 0; i < matched.length; i += BATCH) {
    const batch = matched.slice(i, i + BATCH);
    const texts = batch.map((m) => m.text);
    const embeddings = await embedFn(texts);
    for (let j = 0; j < batch.length; j++) {
      const blob = float32ToBuffer(embeddings[j]);
      insertPage.run(batch[j].docId, batch[j].text, blob);
      const pageId = Number(
        (db.prepare('SELECT last_insert_rowid() as id').get() as { id: bigint }).id,
      );
      db.prepare(`INSERT INTO vec_pages (rowid, embedding) VALUES (${pageId}, ?)`).run(blob);
      // FTS 索引内容 = slug + summary，让 BM25 也能通过路径（含实体名）命中；
      // 向量只索引 summary，保持语义纯净不被路径噪声污染。
      insertFtsPage.run(pageId, `${batch[j].slug} ${batch[j].text}`);
    }
  }

  let msg = `  L1: indexed ${matched.length} entries from ${indexFiles.length} _INDEX.md`;
  if (unmatched > 0) msg += ` (${unmatched} unmatched slug, skipped)`;
  console.log(msg);
}

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

  const docCount = (
    db.prepare('SELECT COUNT(*) as n FROM documents').get() as { n: number }
  ).n;
  const chunkCount = (
    db.prepare('SELECT COUNT(*) as n FROM chunks').get() as { n: number }
  ).n;
  const lastSync = db
    .prepare("SELECT value FROM meta WHERE key = 'last_sync'")
    .get() as { value: string } | undefined;
  const model = db
    .prepare("SELECT value FROM meta WHERE key = 'model'")
    .get() as { value: string } | undefined;
  const dim = db.prepare("SELECT value FROM meta WHERE key = 'dim'").get() as
    | { value: string }
    | undefined;

  const totalFiles = collectFiles(corpus).length;

  let dirCount = 0;
  let pageCount = 0;
  try {
    dirCount = (
      db.prepare('SELECT COUNT(*) as n FROM dir_summaries').get() as { n: number }
    ).n;
    pageCount = (
      db.prepare('SELECT COUNT(*) as n FROM page_summaries').get() as { n: number }
    ).n;
  } catch {
    // tables may not exist in older DBs
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
