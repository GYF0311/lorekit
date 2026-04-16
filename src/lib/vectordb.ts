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
}

type EmbedFn = (texts: string[]) => Promise<Float32Array[]>;

// We use `any` for the Database type to avoid top-level import of better-sqlite3.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBEDDING_DIM = 1024;

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
    embedding BLOB NOT NULL
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

  // Remove old data
  const old = db.prepare('SELECT id FROM documents WHERE path = ?').get(rel) as
    | { id: number }
    | undefined;
  if (old) {
    const chunkIds = db
      .prepare('SELECT id FROM chunks WHERE doc_id = ?')
      .all(old.id) as { id: number }[];
    const delVec = db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
    for (const { id } of chunkIds) delVec.run(id);
    db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(old.id);
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
  for (let i = 0; i < chunks.length; i++) {
    const blob = float32ToBuffer(embeddings[i]);
    insertChunk.run(docId, chunks[i].section, chunks[i].content, blob);
    const chunkId = Number(
      (db.prepare('SELECT last_insert_rowid() as id').get() as { id: bigint }).id
    );
    // vec0 doesn't support bound params for rowid — must inline
    db.prepare(`INSERT INTO vec_chunks (rowid, embedding) VALUES (${chunkId}, ?)`).run(blob);
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

  // L0: top-3 directories
  const l0Rows = db
    .prepare(
      `SELECT v.rowid as id, v.distance
       FROM vec_dirs v
       WHERE v.embedding MATCH ? AND k = 3
       ORDER BY v.distance`,
    )
    .all(blob) as { id: number; distance: number }[];

  if (l0Rows.length === 0) return [];

  const dirIds = l0Rows.map((r) => r.id);
  const dirPaths = db
    .prepare(
      `SELECT dir_path FROM dir_summaries WHERE id IN (${dirIds.map(() => '?').join(',')})`,
    )
    .all(...dirIds) as { dir_path: string }[];

  if (dirPaths.length === 0) return [];

  // L1: top-5 pages within those directories
  const likeClauses = dirPaths.map(() => 'd.path LIKE ?').join(' OR ');
  const likeParams = dirPaths.map((d) => d.dir_path + '/%');

  const candidatePageIds = db
    .prepare(
      `SELECT ps.id FROM page_summaries ps
       JOIN documents d ON ps.doc_id = d.id
       WHERE ${likeClauses}`,
    )
    .all(...likeParams) as { id: number }[];

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

export async function buildLayeredIndex(
  db: Db,
  corpus: string,
  embedFn: EmbedFn,
): Promise<void> {
  // --- L0: directory-level summaries ---
  db.prepare('DELETE FROM dir_summaries').run();
  db.prepare('DELETE FROM vec_dirs').run();

  const rows = db.prepare('SELECT id, path FROM documents').all() as {
    id: number;
    path: string;
  }[];

  const dirDocs: Map<string, string[]> = new Map();
  for (const { path: docPath } of rows) {
    const full = join(corpus, docPath);
    const parts = docPath.split('/');
    if (parts.length < 2) continue;
    const dirPath = parts.slice(0, -1).join('/');

    let title = '';
    if (existsSync(full)) {
      try {
        const raw = readFileSync(full, 'utf-8');
        const { data: fm } = matter(raw);
        title = (fm.title as string) || '';
      } catch {
        // ignore
      }
    }
    if (!title) title = basename(docPath, '.md');

    if (!dirDocs.has(dirPath)) dirDocs.set(dirPath, []);
    dirDocs.get(dirPath)!.push(title);
  }

  if (dirDocs.size > 0) {
    const dirPaths = [...dirDocs.keys()].sort();
    const dirTexts = dirPaths.map((dp) => {
      const label = dp.includes('/') ? dp.split('/').pop()! : dp;
      const titles = dirDocs.get(dp)!.slice(0, 50).join(', ');
      return `${label}目录：${titles}`;
    });

    const dirEmbeddings = await embedFn(dirTexts);
    const insertDir = db.prepare(
      'INSERT INTO dir_summaries (dir_path, summary, embedding) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < dirPaths.length; i++) {
      const blob = float32ToBuffer(dirEmbeddings[i]);
      insertDir.run(dirPaths[i], dirTexts[i], blob);
      const dirId = Number(
        (db.prepare('SELECT last_insert_rowid() as id').get() as { id: bigint }).id
      );
      db.prepare(`INSERT INTO vec_dirs (rowid, embedding) VALUES (${dirId}, ?)`).run(blob);
    }

    console.log(`  L0: indexed ${dirPaths.length} directories`);
  }

  // --- L1: page-level summaries ---
  db.prepare('DELETE FROM page_summaries').run();
  db.prepare('DELETE FROM vec_pages').run();

  const pageData: Array<{ docId: number; summary: string }> = [];
  for (const { id: docId, path: docPath } of rows) {
    const full = join(corpus, docPath);
    if (!existsSync(full)) continue;
    const summary = extractPageSummary(full);
    pageData.push({ docId, summary });
  }

  if (pageData.length > 0) {
    const BATCH = 64;
    let totalPages = 0;
    const insertPage = db.prepare(
      'INSERT INTO page_summaries (doc_id, summary, embedding) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < pageData.length; i += BATCH) {
      const batch = pageData.slice(i, i + BATCH);
      const texts = batch.map((p) => p.summary);
      const embeddings = await embedFn(texts);

      for (let j = 0; j < batch.length; j++) {
        const blob = float32ToBuffer(embeddings[j]);
        insertPage.run(batch[j].docId, batch[j].summary, blob);
        const pageId = Number(
          (db.prepare('SELECT last_insert_rowid() as id').get() as { id: bigint }).id
        );
        db.prepare(`INSERT INTO vec_pages (rowid, embedding) VALUES (${pageId}, ?)`).run(blob);
        totalPages++;
      }
    }

    console.log(`  L1: indexed ${totalPages} pages`);
  }
}

export async function getStatus(corpus: string): Promise<StatusInfo> {
  const dbPath = join(corpus, '.wiki', 'vector.sqlite');
  if (!existsSync(dbPath)) {
    return {
      indexed: false,
      message: "No vector index found. Run 'lorekit vector sync' first.",
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
  };
}
