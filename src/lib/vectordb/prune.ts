import { relative } from 'node:path';
import { collectFiles } from './files.js';
import { openDb, type Db } from './schema.js';

export function pruneMissingDocuments(db: Db, existingRelPaths: Set<string>): number {
  const rows = db.prepare('SELECT id, path FROM documents').all() as { id: number; path: string }[];
  const missing = rows.filter((row) => !existingRelPaths.has(row.path));
  if (missing.length === 0) return 0;

  const delVecChunk = db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
  const delFtsChunk = db.prepare('DELETE FROM fts_chunks WHERE rowid = ?');
  const delVecPage = db.prepare('DELETE FROM vec_pages WHERE rowid = ?');
  const delFtsPage = db.prepare('DELETE FROM fts_pages WHERE rowid = ?');
  const getChunkIds = db.prepare('SELECT id FROM chunks WHERE doc_id = ?');
  const getPageIds = db.prepare('SELECT id FROM page_summaries WHERE doc_id = ?');
  const deleteChunks = db.prepare('DELETE FROM chunks WHERE doc_id = ?');
  const deletePages = db.prepare('DELETE FROM page_summaries WHERE doc_id = ?');
  const deleteDoc = db.prepare('DELETE FROM documents WHERE id = ?');

  const tx = db.transaction((docs: typeof missing) => {
    for (const doc of docs) {
      const chunkIds = getChunkIds.all(doc.id) as { id: number }[];
      for (const { id } of chunkIds) {
        delVecChunk.run(id);
        delFtsChunk.run(id);
      }
      deleteChunks.run(doc.id);

      const pageIds = getPageIds.all(doc.id) as { id: number }[];
      for (const { id } of pageIds) {
        delVecPage.run(id);
        delFtsPage.run(id);
      }
      deletePages.run(doc.id);
      deleteDoc.run(doc.id);
    }
  });
  tx(missing);
  return missing.length;
}

export async function pruneVectorDbMissingFiles(corpus: string): Promise<number> {
  const db = await openDb(corpus);
  try {
    const files = collectFiles(corpus);
    const existingRelPaths = new Set(files.map((filePath) => relative(corpus, filePath)));
    return pruneMissingDocuments(db, existingRelPaths);
  } finally {
    db.close();
  }
}
