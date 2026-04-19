/**
 * Smoke: BM25 端到端命中锁定（批次 24-fix）
 *
 * **背景（21 老 bug）**：原 queryBM25Layered 走 fts_dirs → fts_pages → fts_chunks
 * 三层 gate。L0 的 dir 摘要只含标题 + wikilink 列表（无正文），用户关键词永不命中
 * L0，导致 `vector query --bm25` 对任何真实 corpus 都返回 []。24-fix 改成
 * fts_chunks 单层 MATCH + rank，本 smoke 锁端到端"有 fts 数据 → query 能命中"。
 *
 * **为什么不跑 `lorekit sync`**：真 sync 要 ollama+bge-m3 在线 + 下载模型，
 * CI 拿不到。我们手工建 `.wiki/vector.sqlite` + 插 documents/chunks/fts_chunks，
 * embedding 列用全零 dummy blob（24-fix 的 BM25 路径根本不读 embedding）。
 * openDb 应用 DDL 时若 sqlite-vec 不可用会抛错，用 hasSqliteVec() gate 跳过。
 *
 * **锁定的三条行为**：
 * 1. MATCH 'browser' → 命中含 "browser-use" 的 chunk（trigram 子串召回）
 * 2. MATCH '"2026-04-19"'（sanitize 后）→ 命中含 ISO 日期 phrase 的 chunk
 * 3. MATCH 不存在词 → []（负例）
 *
 * 实现方式：spawn `node dist/cli.js vector query --bm25` 走真实 CLI 入口，
 * 不绕过任何层——直接验证先生实际会打的命令返回 non-empty 结果。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLI,
  runLorekit,
  mkTmpDir,
  cleanupTmpDir,
  fmtRun,
  hasSqliteVec,
} from './_util.mjs';

// 不在顶层 await 里跳过（node:test 不支持），改在每个 test 里判断
const SQLITE_VEC = await hasSqliteVec();

// DDL 跟 src/lib/vectordb/schema.ts 保持一致（但不 load sqlite-vec，手工 DDL 时
// 跳过 vec0 虚表——openDb 在 CLI 进程里会补齐）。我们这里只需要 fts_chunks +
// chunks + documents 三张表有数据，其他表可空。
const DIM = 1024;

/**
 * 建一个最小可查的 vector.sqlite：
 * - documents 表：1 条记录（id=1, path=知识库/概念/test.md）
 * - chunks 表：2 条记录，内容含 "browser-use" 和 "2026-04-19"
 *   embedding 列是必填 BLOB NOT NULL，填 DIM 个零 float（4 * 1024 = 4096 byte）
 * - fts_chunks 虚表：插入对应的 content（rowid 对齐 chunks.id）
 * - meta 表：写 dim=1024 让 CLI probe 到
 *
 * 不写 page_summaries / dir_summaries / vec_*：BM25 chunk 层直查不读这些表。
 */
async function buildMockDb(dbPath) {
  const Database = (await import('better-sqlite3')).default;
  const sqliteVec = await import('sqlite-vec');
  const db = new Database(dbPath);
  // 必须 load sqlite-vec 才能在同一个 db 里建 vec0 虚表（openDb 里会做）；但本
  // smoke 的写入不涉及 vec_ 表，所以允许不 load——留给 CLI 进程自己的 openDb
  // 在首次查询时补 DDL（已是 IF NOT EXISTS）。
  void sqliteVec;

  db.exec(`
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
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
      content,
      tokenize='trigram'
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
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_dirs USING fts5(
      summary,
      tokenize='trigram'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_pages USING fts5(
      summary,
      tokenize='trigram'
    );
  `);

  // dummy embedding：DIM 个 float32 零，后续 BM25 路径完全不读
  const dummyBlob = Buffer.alloc(4 * DIM);

  db.prepare(
    "INSERT INTO documents (id, path, sha256, updated_at) VALUES (?, ?, ?, ?)",
  ).run(1, '知识库/概念/test.md', 'deadbeef', '2026-04-19T00:00:00Z');

  const chunks = [
    { id: 1, content: '[test] [concept] # test\nOn 2026-04-19 we shipped browser-use v8.8.' },
    { id: 2, content: '[test] [concept] ## details\nThe release notes mention Harness 五版演化.' },
  ];
  const insChunk = db.prepare(
    'INSERT INTO chunks (id, doc_id, section, content, embedding) VALUES (?, 1, ?, ?, ?)',
  );
  const insFts = db.prepare('INSERT INTO fts_chunks (rowid, content) VALUES (?, ?)');
  for (const c of chunks) {
    insChunk.run(c.id, 'body', c.content, dummyBlob);
    insFts.run(c.id, c.content);
  }

  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('dim', ?)").run(String(DIM));

  db.close();
}

/**
 * 建一个最小 corpus 骨架让 requireCorpus 通过。只需要 .wiki/ 目录 + CLAUDE.md 其中之一，
 * 但我们直接跑 `lorekit init .` 更简单：它会建全套骨架（不依赖 ollama）。
 */
function seedCorpus(tmpDir) {
  const r = runLorekit(['init', tmpDir], { cwd: tmpDir });
  if (r.status !== 0) {
    throw new Error(`lorekit init failed:\n${fmtRun(r, ['init', tmpDir])}`);
  }
}

test('BM25 e2e: "browser" 命中 trigram 子串', async (t) => {
  if (!SQLITE_VEC) {
    t.skip('sqlite-vec not installed (optional dep)');
    return;
  }
  const tmp = mkTmpDir('lorekit-smoke-bm25-');
  try {
    seedCorpus(tmp);
    await buildMockDb(join(tmp, '.wiki', 'vector.sqlite'));

    const r = runLorekit(
      ['vector', 'query', '--bm25', '--text', 'browser', '--top-k', '5'],
      { cwd: tmp },
    );
    assert.equal(r.status, 0, fmtRun(r, ['vector', 'query', '--bm25', '--text', 'browser']));
    const results = JSON.parse(r.stdout);
    assert.ok(Array.isArray(results), 'stdout 应是 JSON 数组');
    assert.ok(results.length >= 1, `期望至少 1 条命中, 实际: ${JSON.stringify(results)}`);
    // 命中的 chunk 里应含 "browser-use"
    assert.ok(
      results.some((x) => x.chunk && x.chunk.includes('browser-use')),
      `结果应含 "browser-use" 字样, 实际: ${JSON.stringify(results)}`,
    );
  } finally {
    cleanupTmpDir(tmp);
  }
});

test('BM25 e2e: ISO 日期 "2026-04-19" 命中（sanitize 包装 phrase）', async (t) => {
  if (!SQLITE_VEC) {
    t.skip('sqlite-vec not installed (optional dep)');
    return;
  }
  const tmp = mkTmpDir('lorekit-smoke-bm25-');
  try {
    seedCorpus(tmp);
    await buildMockDb(join(tmp, '.wiki', 'vector.sqlite'));

    const r = runLorekit(
      ['vector', 'query', '--bm25', '--text', '2026-04-19', '--top-k', '5'],
      { cwd: tmp },
    );
    assert.equal(r.status, 0, fmtRun(r, ['vector', 'query', '--bm25', '--text', '2026-04-19']));
    const results = JSON.parse(r.stdout);
    assert.ok(Array.isArray(results), 'stdout 应是 JSON 数组');
    assert.ok(results.length >= 1, `期望至少 1 条命中, 实际: ${JSON.stringify(results)}`);
    assert.ok(
      results.some((x) => x.chunk && x.chunk.includes('2026-04-19')),
      `结果应含 "2026-04-19" 字样, 实际: ${JSON.stringify(results)}`,
    );
  } finally {
    cleanupTmpDir(tmp);
  }
});

test('BM25 e2e: 不存在词返回空数组', async (t) => {
  if (!SQLITE_VEC) {
    t.skip('sqlite-vec not installed (optional dep)');
    return;
  }
  const tmp = mkTmpDir('lorekit-smoke-bm25-');
  try {
    seedCorpus(tmp);
    await buildMockDb(join(tmp, '.wiki', 'vector.sqlite'));

    const r = runLorekit(
      ['vector', 'query', '--bm25', '--text', 'nonexistent-xyzzy-token', '--top-k', '5'],
      { cwd: tmp },
    );
    assert.equal(r.status, 0, fmtRun(r, ['vector', 'query', '--bm25', '--text', 'nonexistent']));
    const results = JSON.parse(r.stdout);
    assert.ok(Array.isArray(results), 'stdout 应是 JSON 数组');
    assert.equal(results.length, 0, `期望 0 条命中, 实际: ${JSON.stringify(results)}`);
  } finally {
    cleanupTmpDir(tmp);
  }
});

// 防止未使用警告
void writeFileSync;
void CLI;
