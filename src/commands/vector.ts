import type { Command } from 'commander';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ok, warn, err, out, print } from '../utils/logger.js';
import { requireCorpus } from '../lib/corpus.js';

export interface VectorSyncOptions {
  force?: boolean;
  layered?: boolean;
  model?: string;
}

export interface VectorSyncResult {
  synced: number;
  skipped: number;
  totalChunks: number;
  layered: boolean;
}

/**
 * 程序内复用入口：增量同步向量库。
 *   - 每个 .md 文件用 sha256 对比跳过未变更
 *   - --force 全量重嵌入
 *   - --layered 额外刷 L0/L1（默认 true——lorekit sync 需要）
 */
export async function runVectorSync(
  corpus: string,
  opts: VectorSyncOptions = {},
): Promise<VectorSyncResult> {
  const force = opts.force ?? false;
  const layered = opts.layered ?? true;
  const model = opts.model ?? 'bge-m3';

  const { embed, embedSingle } = await import('../lib/ollama.js');
  const { openDb, syncFile, buildLayeredIndex, collectFiles } = await import('../lib/vectordb.js');

  const testEmb = await embedSingle('test', model);
  const dim = testEmb.length;

  const db = await openDb(corpus, dim);
  const files = collectFiles(corpus);

  let synced = 0;
  let skipped = 0;
  let totalChunks = 0;

  for (const filePath of files) {
    const rel = filePath.replace(corpus + '/', '');

    if (!force) {
      const row = db.prepare('SELECT sha256 FROM documents WHERE path = ?').get(rel) as
        | { sha256: string }
        | undefined;
      if (row) {
        const sha = createHash('sha256').update(readFileSync(filePath)).digest('hex');
        if (row.sha256 === sha) {
          skipped++;
          continue;
        }
      }
    }

    const embedFn = (texts: string[]) => embed(texts, model);
    const result = await syncFile(db, filePath, corpus, embedFn);
    totalChunks += result.chunks;
    synced++;
  }

  const now = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)").run(now);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?)").run(model);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('dim', ?)").run(String(dim));

  if (layered || force) {
    print('Building layered index (L0/L1)...');
    const embedBatch = (texts: string[]) => embed(texts, model);
    await buildLayeredIndex(db, corpus, embedBatch);
  }

  db.close();

  return { synced, skipped, totalChunks, layered: layered || force };
}

export function vectorCommand(program: Command) {
  const vec = program
    .command('vector')
    .description('vector search engine — embed & search via ollama + sqlite-vec');

  // --- sync ---
  vec
    .command('sync')
    .option('--force', 'full rebuild (re-embed all files)', false)
    .option('--layered', 'build L0/L1 layered index', false)
    .option('--model <name>', 'ollama model name', 'bge-m3')
    .description('index corpus into vector DB')
    .action(async (opts: { force: boolean; layered: boolean; model: string }) => {
      const corpus = requireCorpus();
      const r = await runVectorSync(corpus, opts);
      ok(`synced ${r.synced} files (${r.totalChunks} chunks), skipped ${r.skipped} unchanged`);
    });

  // --- query ---
  vec
    .command('query')
    .requiredOption('--text <text>', 'search query text')
    .option('--top-k <n>', 'number of results', '5')
    .option('--threshold <n>', 'minimum similarity score', '0.5')
    .option('--layered', 'use L0→L1→L2 layered vector retrieval', false)
    .option('--hybrid', 'BM25 + vector layered + RRF fusion (阶段 2 推荐，无 re-rank)', false)
    .option('--bm25', 'BM25 layered only (FTS5, 用于 debug BM25 单路)', false)
    .option('--model <name>', 'ollama model name', 'bge-m3')
    .description('search the vector/FTS index')
    .action(
      async (opts: {
        text: string;
        topK: string;
        threshold: string;
        layered: boolean;
        hybrid: boolean;
        bm25: boolean;
        model: string;
      }) => {
        const corpus = requireCorpus();
        const topK = parseInt(opts.topK, 10);
        const threshold = parseFloat(opts.threshold);

        const { embedSingle } = await import('../lib/ollama.js');
        const { openDb, queryFlat, queryLayered, queryBM25Layered, queryHybrid } =
          await import('../lib/vectordb.js');

        // Probe dim from existing db or model
        let dim = 1024;
        const dbPath = join(corpus, '.wiki', 'vector.sqlite');
        if (existsSync(dbPath)) {
          const tmpDb = await openDb(corpus);
          const row = tmpDb.prepare("SELECT value FROM meta WHERE key = 'dim'").get() as
            | { value: string }
            | undefined;
          if (row) dim = parseInt(row.value, 10);
          tmpDb.close();
        }

        const db = await openDb(corpus, dim);

        let results;
        if (opts.bm25) {
          // BM25 单路（不需要 embedding，快）
          results = queryBM25Layered(db, opts.text, topK);
        } else if (opts.hybrid) {
          const embedding = await embedSingle(opts.text, opts.model);
          results = queryHybrid(db, embedding, opts.text, topK, threshold);
        } else {
          const embedding = await embedSingle(opts.text, opts.model);
          results = opts.layered
            ? queryLayered(db, embedding, topK, threshold)
            : queryFlat(db, embedding, topK, threshold);
        }

        db.close();
        out(JSON.stringify(results, null, 2));
      },
    );

  // --- status ---
  vec
    .command('status')
    .description('show vector index status')
    .action(async () => {
      const corpus = requireCorpus();
      const { getStatus } = await import('../lib/vectordb.js');
      const info = await getStatus(corpus);
      out(JSON.stringify(info, null, 2));
    });
}
