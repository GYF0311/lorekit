import type { Command } from 'commander';
import { ok, warn, err } from '../utils/logger.js';
import { requireCorpus } from '../lib/corpus.js';

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

      // Dynamic imports to avoid breaking other commands when deps are missing
      const { embed, embedSingle } = await import('../lib/ollama.js');
      const { openDb, syncFile, buildLayeredIndex, collectFiles } = await import(
        '../lib/vectordb.js'
      );

      // Probe model dimension
      const testEmb = await embedSingle('test', opts.model);
      const dim = testEmb.length;

      const db = await openDb(corpus, dim);
      const files = collectFiles(corpus);

      let synced = 0;
      let skipped = 0;
      let totalChunks = 0;

      for (const filePath of files) {
        const rel = filePath.replace(corpus + '/', '');

        if (!opts.force) {
          const row = db
            .prepare('SELECT sha256 FROM documents WHERE path = ?')
            .get(rel) as { sha256: string } | undefined;
          if (row) {
            const { createHash } = await import('node:crypto');
            const { readFileSync } = await import('node:fs');
            const sha = createHash('sha256')
              .update(readFileSync(filePath))
              .digest('hex');
            if (row.sha256 === sha) {
              skipped++;
              continue;
            }
          }
        }

        const embedFn = (texts: string[]) => embed(texts, opts.model);
        const result = await syncFile(db, filePath, corpus, embedFn);
        totalChunks += result.chunks;
        synced++;
      }

      const now = new Date().toISOString();
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)").run(
        now,
      );
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?)").run(
        opts.model,
      );
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('dim', ?)").run(
        String(dim),
      );

      if (opts.layered || opts.force) {
        console.log('Building layered index (L0/L1)...');
        const embedBatch = (texts: string[]) => embed(texts, opts.model);
        await buildLayeredIndex(db, corpus, embedBatch);
      }

      db.close();
      ok(`synced ${synced} files (${totalChunks} chunks), skipped ${skipped} unchanged`);
    });

  // --- query ---
  vec
    .command('query')
    .requiredOption('--text <text>', 'search query text')
    .option('--top-k <n>', 'number of results', '5')
    .option('--threshold <n>', 'minimum similarity score', '0.5')
    .option('--layered', 'use L0→L1→L2 layered retrieval', false)
    .option('--model <name>', 'ollama model name', 'bge-m3')
    .description('semantic search in the vector index')
    .action(
      async (opts: {
        text: string;
        topK: string;
        threshold: string;
        layered: boolean;
        model: string;
      }) => {
        const corpus = requireCorpus();
        const topK = parseInt(opts.topK, 10);
        const threshold = parseFloat(opts.threshold);

        const { embedSingle } = await import('../lib/ollama.js');
        const { openDb, queryFlat, queryLayered } = await import(
          '../lib/vectordb.js'
        );

        // Probe dim from existing db or model
        const { existsSync } = await import('node:fs');
        const { join } = await import('node:path');
        let dim = 1024;
        const dbPath = join(corpus, '.wiki', 'vector.sqlite');
        if (existsSync(dbPath)) {
          // Open a temporary connection to read dim
          const tmpDb = await openDb(corpus);
          const row = tmpDb
            .prepare("SELECT value FROM meta WHERE key = 'dim'")
            .get() as { value: string } | undefined;
          if (row) dim = parseInt(row.value, 10);
          tmpDb.close();
        }

        const db = await openDb(corpus, dim);
        const embedding = await embedSingle(opts.text, opts.model);

        const results = opts.layered
          ? queryLayered(db, embedding, topK, threshold)
          : queryFlat(db, embedding, topK, threshold);

        db.close();
        console.log(JSON.stringify(results, null, 2));
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
      console.log(JSON.stringify(info, null, 2));
    });
}
