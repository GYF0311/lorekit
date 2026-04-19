/**
 * vectordb/schema.ts — sqlite schema (DDL) + 数据库打开 + 动态加载 sqlite-vec
 *
 * 批次 22a strangler fig 第一步：从 src/lib/vectordb.ts copy 出 schema 层。
 * 原 vectordb.ts 同名定义仍保留，commands/*.ts 暂未切换，本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 职责：
 * - 常量：EMBEDDING_DIM / MODE_THRESHOLD_FILES
 * - 类型：Db / StatusInfo / QueryResult
 * - DDL：4 个 SQL 表 + 3 个 vec0 虚表 + 3 个 fts5 虚表
 * - 入口：loadSqlite() 动态加载 better-sqlite3 + sqlite-vec；openDb() 一站建库
 *
 * 不含 sync / query / build-layered（后续子批负责）。
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type DatabaseNS from 'better-sqlite3';

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

// **23c 改**：原 `Db = any` → `DatabaseNS.Database` 精确类型（来自 @types/better-sqlite3
// 的 namespace 别名 `BetterSqlite3.Database`）。`import type DatabaseNS` 是类型 only，
// 不引入 runtime 依赖（runtime 仍走 schema.ts 内的 dynamic import 兜可选 dep 缺失）。
// **重命名 NS 后缀**：避开 loadSqlite() 内部 `let Database = ...` 局部变量 shadowing。
// 编辑器对 db.prepare/get/run/exec/pragma/close 的智能补全和参数校验恢复正常。
export type Db = DatabaseNS.Database;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMBEDDING_DIM = 1024;

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

// 排除 / 包含规则集中在 lib/paths.ts，本文件不再硬编码（CONVENTIONS Do Not #11）。

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

export const DDL = `
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

/**
 * 生成 vec0 虚表 DDL。dim 是 embedding 维度（默认 EMBEDDING_DIM=1024 / bge-m3 模型）。
 *
 * 三个虚表平行存在：
 * - vec_chunks：文档切块向量（rowid 对齐 chunks.id）
 * - vec_dirs：目录摘要向量（rowid 对齐 dir_summaries.id）
 * - vec_pages：页摘要向量（rowid 对齐 page_summaries.id）
 *
 * cosine 距离用于召回时按相似度排序。
 */
export function vecDdl(dim: number): string {
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
export const FTS_DDL = `
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
// Dynamic import helper
// ---------------------------------------------------------------------------

/**
 * 动态加载 better-sqlite3 + sqlite-vec。两者都是 optionalDependencies，
 * 缺失时抛带安装提示的 Error，由调用方决定怎么报给用户。
 *
 * 单独抽出来是为了让其他模块（query / sync / build-layered）也能复用同一份动态加载，
 * 不重复 try/catch。
 */
export async function loadSqlite(): Promise<{
  Database: typeof import('better-sqlite3');
  sqliteVec: { load: (db: Db) => void };
}> {
  let Database: typeof import('better-sqlite3');
  try {
    Database = (await import('better-sqlite3'))
      .default as unknown as typeof import('better-sqlite3');
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
      'sqlite-vec is required for the vector engine.\n' + '  Install it: npm install sqlite-vec',
    );
  }

  return { Database, sqliteVec };
}

// ---------------------------------------------------------------------------
// openDb — 一站建库 + DDL 应用 + migration
// ---------------------------------------------------------------------------

/**
 * 打开（必要时创建）`<corpus>/.wiki/vector.sqlite`，应用所有 DDL，加载 sqlite-vec。
 *
 * 副作用：
 * - 创建 `<corpus>/.wiki/` 目录（若不存在）
 * - WAL 模式 + 外键开启
 * - migration：dir_summaries.slug_list 字段（21 之前老库可能缺）补 ALTER TABLE
 *
 * 调用方拿到 Db 之后是同步 better-sqlite3 句柄，可直接 prepare/exec/transaction。
 */
export async function openDb(corpus: string, dim = EMBEDDING_DIM): Promise<Db> {
  const { Database, sqliteVec } = await loadSqlite();

  const wikiDir = join(corpus, '.wiki');
  if (!existsSync(wikiDir)) mkdirSync(wikiDir, { recursive: true });

  const dbPath = join(wikiDir, 'vector.sqlite');
  // `Database` 的实际 runtime 值是 `BetterSqlite3.DatabaseConstructor`（可 new 的
  // class）；dynamic import 拿回的 `default` 已是构造器本体，直接 new 即可。
  const db = new Database(dbPath);
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
