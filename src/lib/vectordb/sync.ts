/**
 * vectordb/sync.ts — 单文件增量同步（写路径）
 *
 * 批次 22b strangler fig 第二步：从 src/lib/vectordb.ts copy 出 syncFile。
 * 原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 职责：
 * - 拿到一个 corpus 内的 markdown 路径 + db 句柄 + embed 回调，把该文件的 chunks
 *   全量重建（先级联清旧 doc → 重新切块 → embed → 写 documents/chunks/vec_chunks/fts_chunks）
 * - **不**重建 page_summaries / vec_pages / fts_pages（那是 buildLayeredIndex 的活）
 *
 * 调用流程上由 commands/vector.ts 的 sync 子命令在 collectFiles 列表上 batch 调用。
 */

import { relative } from 'node:path';

import { sha256, float32ToBuffer } from './files.js';
import type { Db } from './schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * embedding 回调签名。inline 定义保持 22b 不依赖未上提的共享类型；22e/22f 收尾时
 * 若 query 系列子批也用到再考虑上提到 schema.ts（当前 grep 仅 sync/build-layered 用到）。
 */
type EmbedFn = (texts: string[]) => Promise<Float32Array[]>;

// ---------------------------------------------------------------------------
// syncFile
// ---------------------------------------------------------------------------

/**
 * 单文件全量重建：
 * 1. 查 documents.path == rel 的旧 doc，存在则先级联清 chunks/vec_chunks/fts_chunks
 *    + page_summaries/vec_pages/fts_pages，再删 documents
 *    - **顺序敏感**：page_summaries 有 FK ON documents(id)，必须先于 documents 删
 *    - vec_* / fts_* 是 sqlite-vec / FTS5 的虚表，rowid 跟对应 SQL 表 id 对齐，
 *      手动 DELETE WHERE rowid = ?；不能依赖外键级联
 * 2. INSERT documents（path / sha256 / updated_at）
 * 3. chunkFile() 切块；空 chunks 直接返回
 * 4. embedFn(texts) 批量 embed
 * 5. 逐 chunk INSERT chunks → 拿 last_insert_rowid → INSERT vec_chunks(rowid) 同 id
 *    → INSERT fts_chunks(rowid) 同 id
 *
 * 副作用：仅写入；返回 `{ chunks: number }` 让调用方汇总。
 */
export async function syncFile(
  db: Db,
  filePath: string,
  corpus: string,
  embedFn: EmbedFn,
): Promise<{ chunks: number }> {
  const { chunkFile } = await import('../chunker.js');

  const rel = relative(corpus, filePath);
  const sha = sha256(filePath);

  // Remove old data — chunks / page_summaries 都引用 documents.id，要级联清；
  // 每张 virtual table（vec_*, fts_*）的 rowid 跟对应 SQL 表的 id 一一对应。
  const old = db.prepare('SELECT id FROM documents WHERE path = ?').get(rel) as
    | { id: number }
    | undefined;
  if (old) {
    // 1. chunks + vec_chunks + fts_chunks
    const chunkIds = db.prepare('SELECT id FROM chunks WHERE doc_id = ?').all(old.id) as {
      id: number;
    }[];
    const delVecChunk = db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
    const delFtsChunk = db.prepare('DELETE FROM fts_chunks WHERE rowid = ?');
    for (const { id } of chunkIds) {
      delVecChunk.run(id);
      delFtsChunk.run(id);
    }
    db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(old.id);

    // 2. page_summaries + vec_pages + fts_pages（外键拦 documents 删除，必须先清）
    const pageIds = db.prepare('SELECT id FROM page_summaries WHERE doc_id = ?').all(old.id) as {
      id: number;
    }[];
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
