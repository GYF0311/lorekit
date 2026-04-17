#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/corpus.ts
var corpus_exports = {};
__export(corpus_exports, {
  collectMdFiles: () => collectMdFiles,
  extractFrontmatter: () => extractFrontmatter,
  extractFrontmatterField: () => extractFrontmatterField,
  findCorpus: () => findCorpus,
  findSourceByUrl: () => findSourceByUrl,
  hasFrontmatter: () => hasFrontmatter,
  requireCorpus: () => requireCorpus
});
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import matter from "gray-matter";
function findCorpus(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== "/" && dir) {
    if (existsSync(join(dir, ".wiki")) || existsSync(join(dir, "CLAUDE.md"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}
function requireCorpus(startDir) {
  const corpus = findCorpus(startDir);
  if (!corpus) {
    throw new Error("not inside a corpus (no .wiki/ or CLAUDE.md found)");
  }
  return corpus;
}
function extractFrontmatter(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    return data;
  } catch {
    return {};
  }
}
function hasFrontmatter(filePath) {
  try {
    const first = readFileSync(filePath, "utf-8").slice(0, 4);
    return first === "---\n" || first === "---\r";
  } catch {
    return false;
  }
}
function extractFrontmatterField(filePath, key) {
  const fm = extractFrontmatter(filePath);
  const val = fm[key];
  return typeof val === "string" ? val : void 0;
}
function findSourceByUrl(corpus, url) {
  const sourcesRoot = join(corpus, "\u539F\u6599");
  if (!existsSync(sourcesRoot)) return null;
  for (const mdPath of collectMdFiles(sourcesRoot)) {
    const fm = extractFrontmatter(mdPath);
    if (fm.source_url === url || fm.url === url) return mdPath;
  }
  return null;
}
function collectMdFiles(dir, opts) {
  const results = [];
  if (!existsSync(dir)) return results;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md") && !EXCLUDE_NAMES.has(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results.sort();
}
var EXCLUDE_NAMES;
var init_corpus = __esm({
  "src/lib/corpus.ts"() {
    "use strict";
    EXCLUDE_NAMES = /* @__PURE__ */ new Set([".gitkeep", ".DS_Store", "_INDEX.md"]);
  }
});

// src/lib/ollama.ts
var ollama_exports = {};
__export(ollama_exports, {
  embed: () => embed,
  embedSingle: () => embedSingle
});
async function embed(texts, model = DEFAULT_MODEL) {
  const payload = JSON.stringify({ model, input: texts });
  let resp;
  try {
    resp = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(12e4)
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Cannot connect to ollama at ${OLLAMA_URL}: ${msg}
  Make sure ollama is running: ollama serve
  And the model is pulled: ollama pull ${model}`
    );
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`ollama returned ${resp.status}: ${body}`);
  }
  const data = await resp.json();
  const embeddings = data.embeddings ?? [];
  return embeddings.map((e) => new Float32Array(e));
}
async function embedSingle(text, model = DEFAULT_MODEL) {
  const results = await embed([text], model);
  return results[0];
}
var OLLAMA_URL, DEFAULT_MODEL;
var init_ollama = __esm({
  "src/lib/ollama.ts"() {
    "use strict";
    OLLAMA_URL = "http://localhost:11434/api/embed";
    DEFAULT_MODEL = "bge-m3";
  }
});

// src/lib/chunker.ts
var chunker_exports = {};
__export(chunker_exports, {
  chunkFile: () => chunkFile
});
import { readFileSync as readFileSync12 } from "fs";
import { basename as basename4 } from "path";
import matter2 from "gray-matter";
function chunkFile(filePath, corpusRoot) {
  const raw = readFileSync12(filePath, "utf-8");
  const { data: fm, content: body } = matter2(raw);
  let title = fm.title || "";
  const type = fm.type || "";
  if (!title) {
    const m = body.match(/^#\s+(.+)/m);
    title = m ? m[1].trim() : basename4(filePath, ".md");
  }
  const parts = body.split(/^(## .+)$/m);
  const sections = [];
  if (parts[0].trim()) {
    sections.push(["_intro", parts[0]]);
  }
  for (let i = 1; i < parts.length - 1; i += 2) {
    const heading = parts[i].replace(/^#+\s*/, "").trim();
    const secBody = i + 1 < parts.length ? parts[i + 1] : "";
    sections.push([heading, secBody]);
  }
  let prefix = "";
  if (title) prefix += `[${title}] `;
  if (type) prefix += `[${type}] `;
  const chunks = [];
  for (const [heading, secBody] of sections) {
    const trimmed = secBody.trim();
    if (!trimmed || trimmed.length < MIN_CHUNK_CHARS) continue;
    if (trimmed.length > MAX_CHUNK_CHARS) {
      const paragraphs = trimmed.split("\n\n");
      let current = "";
      for (const p of paragraphs) {
        if (current.length + p.length > MAX_CHUNK_CHARS && current) {
          chunks.push({ section: heading, content: prefix + current.trim() });
          current = p;
        } else {
          current = current ? current + "\n\n" + p : p;
        }
      }
      if (current.trim()) {
        chunks.push({ section: heading, content: prefix + current.trim() });
      }
    } else {
      chunks.push({ section: heading, content: prefix + trimmed });
    }
  }
  return chunks;
}
var MAX_CHUNK_CHARS, MIN_CHUNK_CHARS;
var init_chunker = __esm({
  "src/lib/chunker.ts"() {
    "use strict";
    MAX_CHUNK_CHARS = 800;
    MIN_CHUNK_CHARS = 20;
  }
});

// src/lib/vectordb.ts
var vectordb_exports = {};
__export(vectordb_exports, {
  buildLayeredIndex: () => buildLayeredIndex,
  collectFiles: () => collectFiles,
  getStatus: () => getStatus,
  openDb: () => openDb,
  queryFlat: () => queryFlat,
  queryLayered: () => queryLayered,
  syncFile: () => syncFile
});
import { createHash as createHash2 } from "crypto";
import { existsSync as existsSync9, mkdirSync as mkdirSync6, readFileSync as readFileSync13, readdirSync as readdirSync7 } from "fs";
import { basename as basename5, join as join12, relative as relative9 } from "path";
import matter3 from "gray-matter";
function vecDdl(dim) {
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
function sha2562(filePath) {
  const data = readFileSync13(filePath);
  return createHash2("sha256").update(data).digest("hex");
}
function float32ToBuffer(arr) {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}
function distanceToScore(distance) {
  return 1 - distance * distance / 2;
}
function shouldIndex(rel) {
  const parts = rel.split("/");
  if (EXCLUDE_NAMES2.has(parts[parts.length - 1])) return false;
  if (!rel.endsWith(".md")) return false;
  for (const prefix of EXCLUDE_PREFIXES) {
    if (rel === prefix || rel.startsWith(prefix + "/")) return false;
  }
  for (const inc of INCLUDE_DIRS) {
    if (rel === inc || rel.startsWith(inc + "/")) return true;
  }
  return false;
}
function collectFiles(corpus) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync7(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join12(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md")) {
        const rel = relative9(corpus, full);
        if (shouldIndex(rel)) {
          results.push(full);
        }
      }
    }
  }
  walk(corpus);
  return results.sort();
}
function extractPageSummary(filePath) {
  const raw = readFileSync13(filePath, "utf-8");
  const { data: fm, content: body } = matter3(raw);
  let title = fm.title || "";
  if (!title) {
    const m = body.match(/^#\s+(.+)/m);
    title = m ? m[1].trim() : basename5(filePath, ".md");
  }
  const ctMatch = body.match(/(?:^|\n)## Compiled Truth\s*\n([\s\S]*?)(?=\n## |\n*$)/);
  const intro = ctMatch ? ctMatch[1].trim().slice(0, 200) : body.trim().slice(0, 200);
  return `${title}: ${intro}`;
}
async function loadSqlite() {
  let Database;
  try {
    Database = (await import("better-sqlite3")).default;
  } catch {
    throw new Error(
      "better-sqlite3 is required for the vector engine.\n  Install it: npm install better-sqlite3"
    );
  }
  let sqliteVec;
  try {
    const vecMod = await import("sqlite-vec");
    sqliteVec = vecMod;
  } catch {
    throw new Error(
      "sqlite-vec is required for the vector engine.\n  Install it: npm install sqlite-vec"
    );
  }
  return { Database, sqliteVec };
}
async function openDb(corpus, dim = EMBEDDING_DIM) {
  const { Database, sqliteVec } = await loadSqlite();
  const wikiDir = join12(corpus, ".wiki");
  if (!existsSync9(wikiDir)) mkdirSync6(wikiDir, { recursive: true });
  const dbPath = join12(wikiDir, "vector.sqlite");
  const db = new Database(dbPath);
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(DDL);
  db.exec(vecDdl(dim));
  return db;
}
async function syncFile(db, filePath, corpus, embedFn) {
  const { chunkFile: chunkFile2 } = await Promise.resolve().then(() => (init_chunker(), chunker_exports));
  const rel = relative9(corpus, filePath);
  const sha = sha2562(filePath);
  const old = db.prepare("SELECT id FROM documents WHERE path = ?").get(rel);
  if (old) {
    const chunkIds = db.prepare("SELECT id FROM chunks WHERE doc_id = ?").all(old.id);
    const delVec = db.prepare("DELETE FROM vec_chunks WHERE rowid = ?");
    for (const { id } of chunkIds) delVec.run(id);
    db.prepare("DELETE FROM chunks WHERE doc_id = ?").run(old.id);
    db.prepare("DELETE FROM documents WHERE id = ?").run(old.id);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare("INSERT INTO documents (path, sha256, updated_at) VALUES (?, ?, ?)").run(
    rel,
    sha,
    now
  );
  const docRow = db.prepare("SELECT id FROM documents WHERE path = ?").get(rel);
  const docId = docRow.id;
  const chunks = chunkFile2(filePath, corpus);
  if (chunks.length === 0) return { chunks: 0 };
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedFn(texts);
  const insertChunk = db.prepare(
    "INSERT INTO chunks (doc_id, section, content, embedding) VALUES (?, ?, ?, ?)"
  );
  for (let i = 0; i < chunks.length; i++) {
    const blob = float32ToBuffer(embeddings[i]);
    insertChunk.run(docId, chunks[i].section, chunks[i].content, blob);
    const chunkId = Number(
      db.prepare("SELECT last_insert_rowid() as id").get().id
    );
    db.prepare(`INSERT INTO vec_chunks (rowid, embedding) VALUES (${chunkId}, ?)`).run(blob);
  }
  return { chunks: chunks.length };
}
function queryFlat(db, embedding, topK, threshold) {
  const blob = float32ToBuffer(embedding);
  const rows = db.prepare(
    `SELECT v.rowid as id, v.distance
       FROM vec_chunks v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`
  ).all(blob, topK);
  const results = [];
  const getChunk = db.prepare(
    `SELECT c.content, c.section, d.path
     FROM chunks c JOIN documents d ON c.doc_id = d.id
     WHERE c.id = ?`
  );
  for (const row of rows) {
    const score = distanceToScore(row.distance);
    if (score < threshold) continue;
    const cr = getChunk.get(row.id);
    if (cr) {
      results.push({
        file: cr.path,
        chunk: cr.content,
        score: Math.round(score * 1e4) / 1e4,
        section: cr.section
      });
    }
  }
  return results;
}
function queryLayered(db, embedding, topK, threshold) {
  const blob = float32ToBuffer(embedding);
  const l0Rows = db.prepare(
    `SELECT v.rowid as id, v.distance
       FROM vec_dirs v
       WHERE v.embedding MATCH ? AND k = 3
       ORDER BY v.distance`
  ).all(blob);
  if (l0Rows.length === 0) return [];
  const dirIds = l0Rows.map((r) => r.id);
  const dirPaths = db.prepare(
    `SELECT dir_path FROM dir_summaries WHERE id IN (${dirIds.map(() => "?").join(",")})`
  ).all(...dirIds);
  if (dirPaths.length === 0) return [];
  const likeClauses = dirPaths.map(() => "d.path LIKE ?").join(" OR ");
  const likeParams = dirPaths.map((d) => d.dir_path + "/%");
  const candidatePageIds = db.prepare(
    `SELECT ps.id FROM page_summaries ps
       JOIN documents d ON ps.doc_id = d.id
       WHERE ${likeClauses}`
  ).all(...likeParams);
  if (candidatePageIds.length === 0) return [];
  const searchK = Math.min(candidatePageIds.length, 50);
  const l1Rows = db.prepare(
    `SELECT v.rowid as id, v.distance
       FROM vec_pages v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`
  ).all(blob, searchK);
  const candidateSet = new Set(candidatePageIds.map((r) => r.id));
  const l1Filtered = l1Rows.filter((r) => candidateSet.has(r.id)).slice(0, 5);
  if (l1Filtered.length === 0) return [];
  const pageIds = l1Filtered.map((r) => r.id);
  const docIds = db.prepare(
    `SELECT DISTINCT doc_id FROM page_summaries WHERE id IN (${pageIds.map(() => "?").join(",")})`
  ).all(...pageIds);
  if (docIds.length === 0) return [];
  const docIdList = docIds.map((r) => r.doc_id);
  const candidateChunkIds = db.prepare(
    `SELECT id FROM chunks WHERE doc_id IN (${docIdList.map(() => "?").join(",")})`
  ).all(...docIdList);
  if (candidateChunkIds.length === 0) return [];
  const searchK2 = Math.min(candidateChunkIds.length, topK * 5);
  const l2Rows = db.prepare(
    `SELECT v.rowid as id, v.distance
       FROM vec_chunks v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`
  ).all(blob, searchK2);
  const chunkSet = new Set(candidateChunkIds.map((r) => r.id));
  const l2Filtered = l2Rows.filter((r) => chunkSet.has(r.id)).slice(0, topK);
  const results = [];
  const getChunk = db.prepare(
    `SELECT c.content, c.section, d.path
     FROM chunks c JOIN documents d ON c.doc_id = d.id
     WHERE c.id = ?`
  );
  for (const row of l2Filtered) {
    const score = distanceToScore(row.distance);
    if (score < threshold) continue;
    const cr = getChunk.get(row.id);
    if (cr) {
      results.push({
        file: cr.path,
        chunk: cr.content,
        score: Math.round(score * 1e4) / 1e4,
        section: cr.section
      });
    }
  }
  return results;
}
async function buildLayeredIndex(db, corpus, embedFn) {
  db.prepare("DELETE FROM dir_summaries").run();
  db.prepare("DELETE FROM vec_dirs").run();
  const rows = db.prepare("SELECT id, path FROM documents").all();
  const dirDocs = /* @__PURE__ */ new Map();
  for (const { path: docPath } of rows) {
    const full = join12(corpus, docPath);
    const parts = docPath.split("/");
    if (parts.length < 2) continue;
    const dirPath = parts.slice(0, -1).join("/");
    let title = "";
    if (existsSync9(full)) {
      try {
        const raw = readFileSync13(full, "utf-8");
        const { data: fm } = matter3(raw);
        title = fm.title || "";
      } catch {
      }
    }
    if (!title) title = basename5(docPath, ".md");
    if (!dirDocs.has(dirPath)) dirDocs.set(dirPath, []);
    dirDocs.get(dirPath).push(title);
  }
  if (dirDocs.size > 0) {
    const dirPaths = [...dirDocs.keys()].sort();
    const dirTexts = dirPaths.map((dp) => {
      const label = dp.includes("/") ? dp.split("/").pop() : dp;
      const titles = dirDocs.get(dp).slice(0, 50).join(", ");
      return `${label}\u76EE\u5F55\uFF1A${titles}`;
    });
    const dirEmbeddings = await embedFn(dirTexts);
    const insertDir = db.prepare(
      "INSERT INTO dir_summaries (dir_path, summary, embedding) VALUES (?, ?, ?)"
    );
    for (let i = 0; i < dirPaths.length; i++) {
      const blob = float32ToBuffer(dirEmbeddings[i]);
      insertDir.run(dirPaths[i], dirTexts[i], blob);
      const dirId = Number(
        db.prepare("SELECT last_insert_rowid() as id").get().id
      );
      db.prepare(`INSERT INTO vec_dirs (rowid, embedding) VALUES (${dirId}, ?)`).run(blob);
    }
    console.log(`  L0: indexed ${dirPaths.length} directories`);
  }
  db.prepare("DELETE FROM page_summaries").run();
  db.prepare("DELETE FROM vec_pages").run();
  const pageData = [];
  for (const { id: docId, path: docPath } of rows) {
    const full = join12(corpus, docPath);
    if (!existsSync9(full)) continue;
    const summary = extractPageSummary(full);
    pageData.push({ docId, summary });
  }
  if (pageData.length > 0) {
    const BATCH = 64;
    let totalPages = 0;
    const insertPage = db.prepare(
      "INSERT INTO page_summaries (doc_id, summary, embedding) VALUES (?, ?, ?)"
    );
    for (let i = 0; i < pageData.length; i += BATCH) {
      const batch = pageData.slice(i, i + BATCH);
      const texts = batch.map((p) => p.summary);
      const embeddings = await embedFn(texts);
      for (let j = 0; j < batch.length; j++) {
        const blob = float32ToBuffer(embeddings[j]);
        insertPage.run(batch[j].docId, batch[j].summary, blob);
        const pageId = Number(
          db.prepare("SELECT last_insert_rowid() as id").get().id
        );
        db.prepare(`INSERT INTO vec_pages (rowid, embedding) VALUES (${pageId}, ?)`).run(blob);
        totalPages++;
      }
    }
    console.log(`  L1: indexed ${totalPages} pages`);
  }
}
async function getStatus(corpus) {
  const dbPath = join12(corpus, ".wiki", "vector.sqlite");
  if (!existsSync9(dbPath)) {
    return {
      indexed: false,
      message: "No vector index found. Run 'lorekit vector sync' first."
    };
  }
  const db = await openDb(corpus);
  const docCount = db.prepare("SELECT COUNT(*) as n FROM documents").get().n;
  const chunkCount = db.prepare("SELECT COUNT(*) as n FROM chunks").get().n;
  const lastSync = db.prepare("SELECT value FROM meta WHERE key = 'last_sync'").get();
  const model = db.prepare("SELECT value FROM meta WHERE key = 'model'").get();
  const dim = db.prepare("SELECT value FROM meta WHERE key = 'dim'").get();
  const totalFiles = collectFiles(corpus).length;
  let dirCount = 0;
  let pageCount = 0;
  try {
    dirCount = db.prepare("SELECT COUNT(*) as n FROM dir_summaries").get().n;
    pageCount = db.prepare("SELECT COUNT(*) as n FROM page_summaries").get().n;
  } catch {
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
    backend: "ollama"
  };
}
var EMBEDDING_DIM, INCLUDE_DIRS, EXCLUDE_PREFIXES, EXCLUDE_NAMES2, DDL;
var init_vectordb = __esm({
  "src/lib/vectordb.ts"() {
    "use strict";
    EMBEDDING_DIM = 1024;
    INCLUDE_DIRS = [
      "\u77E5\u8BC6\u5E93",
      "\u6BCF\u65E5",
      "\u5199\u4F5C",
      "\u539F\u6599/\u6587\u7AE0",
      "\u539F\u6599/\u4E66\u7C4D",
      "\u539F\u6599/\u4F1A\u8BAE"
    ];
    EXCLUDE_PREFIXES = [
      "_\u5DE5\u4F5C\u53F0",
      "_archive",
      "_\u5F52\u6863",
      "\u539F\u6599/\u5F55\u97F3",
      "\u539F\u6599/\u526A\u85CF",
      "\u53CD\u9988",
      "\u7CFB\u7EDF",
      ".wiki"
    ];
    EXCLUDE_NAMES2 = /* @__PURE__ */ new Set([".gitkeep", ".DS_Store"]);
    DDL = `
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
  }
});

// src/cli.ts
init_corpus();
import { Command } from "commander";
import chalk6 from "chalk";

// src/utils/fs.ts
import { createHash } from "crypto";
import { readFileSync as readFileSync2, statSync as statSync2 } from "fs";
import { join as join2, dirname as dirname2 } from "path";
import { fileURLToPath } from "url";
function sha256(filePath) {
  const content = readFileSync2(filePath);
  return createHash("sha256").update(content).digest("hex");
}
function lorekitRoot() {
  const thisFile = fileURLToPath(import.meta.url);
  return join2(dirname2(thisFile), "..", "..");
}
function readVersion() {
  try {
    return readFileSync2(join2(lorekitRoot(), "VERSION"), "utf-8").trim();
  } catch {
    return "0.2.0";
  }
}

// src/commands/init.ts
import { existsSync as existsSync2, mkdirSync, readdirSync as readdirSync2, cpSync, writeFileSync } from "fs";
import { join as join3 } from "path";
import { createInterface } from "readline";
import chalk2 from "chalk";

// src/utils/logger.ts
import chalk from "chalk";
var ok = (msg) => console.log(`${chalk.green("\u2713")} ${msg}`);
var bad = (msg) => console.log(`${chalk.red("\u2717")} ${msg}`);
var warn = (msg) => console.error(`${chalk.yellow("lorekit:")} ${msg}`);
var err = (msg) => console.error(`${chalk.red("lorekit:")} ${msg}`);

// src/commands/init.ts
var MINIMAL_DIRS = [
  "\u539F\u6599",
  "\u77E5\u8BC6\u5E93/\u6982\u5FF5",
  "\u77E5\u8BC6\u5E93/\u5B9E\u4F53",
  "\u77E5\u8BC6\u5E93/\u6458\u8981",
  "\u6BCF\u65E5",
  "\u7CFB\u7EDF",
  ".wiki"
];
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
function isDirEmpty(dir) {
  if (!existsSync2(dir)) return true;
  const entries = readdirSync2(dir).filter((n) => n !== ".DS_Store" && n !== ".git");
  return entries.length === 0;
}
function copyTemplateFiles(src, dest) {
  if (!existsSync2(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync2(src, { withFileTypes: true })) {
    const srcPath = join3(src, entry.name);
    const destPath = join3(dest, entry.name);
    if (entry.isDirectory()) {
      copyTemplateFiles(srcPath, destPath);
    } else {
      if (!existsSync2(destPath)) {
        mkdirSync(join3(destPath, ".."), { recursive: true });
        cpSync(srcPath, destPath);
      }
    }
  }
}
function deployObsidianPlugin(corpusPath) {
  const pluginSrc = join3(lorekitRoot(), "plugins", "obsidian-audit");
  const pluginDest = join3(corpusPath, ".obsidian", "plugins", "lorekit-audit");
  if (!existsSync2(pluginSrc)) {
    warn("obsidian-audit plugin not found in lorekit install, skipping");
    return;
  }
  mkdirSync(pluginDest, { recursive: true });
  for (const file of readdirSync2(pluginSrc)) {
    cpSync(join3(pluginSrc, file), join3(pluginDest, file));
  }
  ok("deployed obsidian-audit plugin \u2192 .obsidian/plugins/lorekit-audit/");
}
function createWikiMeta(corpusPath) {
  const wikiDir = join3(corpusPath, ".wiki");
  mkdirSync(wikiDir, { recursive: true });
  const version2 = readVersion();
  writeFileSync(join3(wikiDir, "version"), version2 + "\n");
  const configPath = join3(wikiDir, "config.yaml");
  if (!existsSync2(configPath)) {
    writeFileSync(
      configPath,
      [
        "# lorekit corpus config",
        `version: "${version2}"`,
        "lang: zh-CN",
        "frontmatter_required: true",
        ""
      ].join("\n")
    );
  }
  ok(`created .wiki/version (${version2}) + config.yaml`);
}
function initCommand(program2) {
  program2.command("init").argument("[path]", "target directory", ".").option("--in-place", "initialize in-place even if directory is non-empty").option("--minimal", "only create core directories (no template files)").description("initialize a new lorekit corpus").action(async (targetPath, opts) => {
    const resolved = join3(process.cwd(), targetPath);
    const templateDir = join3(lorekitRoot(), "templates", "default-corpus");
    if (opts.minimal) {
      for (const dir of MINIMAL_DIRS) {
        mkdirSync(join3(resolved, dir), { recursive: true });
      }
      createWikiMeta(resolved);
      ok(`minimal corpus initialized at ${resolved}`);
      return;
    }
    if (!isDirEmpty(resolved) && !opts.inPlace) {
      console.log(chalk2.yellow(`
  target directory is not empty: ${resolved}
`));
      const answer = await ask(
        "  [b] backup & init  [i] in-place (skip existing)  [c] cancel\n  > "
      );
      if (answer === "c" || answer === "C" || answer === "") {
        bad("cancelled");
        return;
      }
      if (answer === "b" || answer === "B") {
        const backupDir = resolved + ".bak." + Date.now();
        cpSync(resolved, backupDir, { recursive: true });
        ok(`backed up to ${backupDir}`);
      }
    }
    if (existsSync2(templateDir)) {
      copyTemplateFiles(templateDir, resolved);
      ok("template files copied (skipped existing)");
    } else {
      warn("template directory not found, creating minimal structure");
      for (const dir of MINIMAL_DIRS) {
        mkdirSync(join3(resolved, dir), { recursive: true });
      }
    }
    createWikiMeta(resolved);
    deployObsidianPlugin(resolved);
    console.log();
    ok(chalk2.bold(`corpus initialized at ${resolved}`));
  });
}

// src/commands/doctor.ts
import { existsSync as existsSync3, readFileSync as readFileSync4, readdirSync as readdirSync3 } from "fs";
import { join as join4, relative as relative2 } from "path";
import chalk3 from "chalk";
init_corpus();
var EXPECTED_DIRS = [
  "\u6BCF\u65E5",
  "\u77E5\u8BC6\u5E93/\u5B9E\u4F53",
  "\u77E5\u8BC6\u5E93/\u6982\u5FF5",
  "\u77E5\u8BC6\u5E93/\u4E13\u9898",
  "\u539F\u6599",
  "\u539F\u6599/\u5F55\u97F3",
  "\u5199\u4F5C",
  "\u7CFB\u7EDF",
  "_\u5DE5\u4F5C\u53F0"
];
function checkDirs(corpus) {
  let issues = 0;
  for (const dir of EXPECTED_DIRS) {
    const full = join4(corpus, dir);
    if (existsSync3(full)) {
      ok(`${dir}/`);
    } else {
      bad(`${dir}/ ${chalk3.dim("missing")}`);
      issues++;
    }
  }
  return issues;
}
function checkWikiVersion(corpus) {
  const versionFile = join4(corpus, ".wiki", "version");
  if (existsSync3(versionFile)) {
    const ver = readFileSync4(versionFile, "utf-8").trim();
    ok(`.wiki/version \u2192 ${ver}`);
    return 0;
  }
  bad(".wiki/version missing");
  return 1;
}
function checkFrontmatterCoverage(corpus) {
  const files = collectMdFiles(corpus);
  const withFm = files.filter((f) => hasFrontmatter(f)).length;
  const total = files.length;
  const pct = total === 0 ? 100 : Math.round(withFm / total * 100);
  const color = pct >= 90 ? chalk3.green : pct >= 60 ? chalk3.yellow : chalk3.red;
  const icon = pct >= 90 ? "\u2713" : pct >= 60 ? "\u26A0" : "\u2717";
  console.log(`${color(icon)} frontmatter coverage: ${withFm}/${total} (${pct}%)`);
}
function checkIndexFiles(corpus) {
  let missing = 0;
  function walk(dir) {
    if (!existsSync3(dir)) return;
    for (const entry of readdirSync3(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join4(dir, entry.name);
      if (entry.isDirectory()) {
        const hasMd = readdirSync3(full).some(
          (f) => f.endsWith(".md") && f !== "_INDEX.md"
        );
        if (hasMd && !existsSync3(join4(full, "_INDEX.md"))) {
          const rel = relative2(corpus, full);
          warn(`_INDEX.md missing in ${rel}/`);
          missing++;
        }
        walk(full);
      }
    }
  }
  walk(corpus);
  if (missing === 0) {
    ok("all directories with .md files have _INDEX.md");
  }
  return missing;
}
function checkArchive(corpus) {
  const archiveDir = join4(corpus, "_\u5F52\u6863");
  if (existsSync3(archiveDir)) {
    ok("_\u5F52\u6863/ exists");
    return 0;
  }
  warn("_\u5F52\u6863/ not found (optional)");
  return 0;
}
function doctorCommand(program2) {
  program2.command("doctor").description("run health checks on the corpus").action(() => {
    const corpus = requireCorpus();
    console.log(chalk3.bold(`
lorekit doctor \u2014 ${corpus}
`));
    let issues = 0;
    console.log(chalk3.cyan("\u2500\u2500 directories \u2500\u2500"));
    issues += checkDirs(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 wiki metadata \u2500\u2500"));
    issues += checkWikiVersion(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 frontmatter \u2500\u2500"));
    checkFrontmatterCoverage(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 index files \u2500\u2500"));
    issues += checkIndexFiles(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 archive \u2500\u2500"));
    checkArchive(corpus);
    console.log();
    if (issues === 0) {
      console.log(chalk3.green.bold("all checks passed \u2713"));
    } else {
      console.log(chalk3.yellow(`${issues} issue(s) found`));
    }
    console.log();
    process.exitCode = issues > 0 ? 1 : 0;
  });
}

// src/commands/stats.ts
init_corpus();
import { readFileSync as readFileSync5, statSync as statSync4 } from "fs";
import { relative as relative3 } from "path";
function statsCommand(program2) {
  program2.command("stats").description("output corpus statistics as JSON").action(() => {
    const corpus = requireCorpus();
    const files = collectMdFiles(corpus);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1e3;
    const byType = {};
    const byDir = {};
    const inboundLinks = /* @__PURE__ */ new Set();
    let recentActive7d = 0;
    let lastUpdated = "";
    for (const file of files) {
      const fm = extractFrontmatter(file);
      const type = fm.type || "unknown";
      byType[type] = (byType[type] || 0) + 1;
      const rel = relative3(corpus, file);
      const topDir = rel.split("/")[0] || ".";
      byDir[topDir] = (byDir[topDir] || 0) + 1;
      try {
        const mtime = statSync4(file).mtime;
        if (now - mtime.getTime() < sevenDays) {
          recentActive7d++;
        }
        const iso = mtime.toISOString();
        if (iso > lastUpdated) lastUpdated = iso;
      } catch {
      }
      try {
        const content = readFileSync5(file, "utf-8");
        const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
        let m;
        while ((m = linkRe.exec(content)) !== null) {
          inboundLinks.add(m[1].trim());
        }
      } catch {
      }
    }
    const orphans = [];
    for (const file of files) {
      const rel = relative3(corpus, file);
      const stem = rel.replace(/\.md$/, "");
      const baseName = stem.split("/").pop();
      if (!inboundLinks.has(stem) && !inboundLinks.has(baseName)) {
        orphans.push(rel);
      }
    }
    const result = {
      total_pages: files.length,
      by_type: byType,
      by_dir: byDir,
      recent_active_7d: recentActive7d,
      orphans: orphans.length,
      last_updated: lastUpdated || null
    };
    console.log(JSON.stringify(result, null, 2));
  });
}

// src/commands/lint.ts
init_corpus();
import { readFileSync as readFileSync6 } from "fs";
import { relative as relative4 } from "path";
import chalk4 from "chalk";
var REQUIRED_FIELDS = ["type", "title", "slug", "created", "updated"];
function lintCommand(program2) {
  program2.command("lint").description("check frontmatter, broken wikilinks, and orphan pages").action(() => {
    const corpus = requireCorpus();
    const files = collectMdFiles(corpus);
    const issues = [];
    const stemSet = /* @__PURE__ */ new Set();
    const baseNameSet = /* @__PURE__ */ new Set();
    const inboundLinks = /* @__PURE__ */ new Set();
    for (const file of files) {
      const rel = relative4(corpus, file);
      const stem = rel.replace(/\.md$/, "");
      stemSet.add(stem);
      baseNameSet.add(stem.split("/").pop());
    }
    const fileLinks = /* @__PURE__ */ new Map();
    for (const file of files) {
      const rel = relative4(corpus, file);
      const fm = extractFrontmatter(file);
      for (const field of REQUIRED_FIELDS) {
        if (!fm[field]) {
          issues.push({
            file: rel,
            kind: "missing-field",
            detail: `missing frontmatter field: ${field}`
          });
        }
      }
      try {
        const content = readFileSync6(file, "utf-8");
        const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
        const targets = [];
        let m;
        while ((m = linkRe.exec(content)) !== null) {
          const target = m[1].trim();
          targets.push(target);
          inboundLinks.add(target);
        }
        fileLinks.set(rel, targets);
      } catch {
      }
    }
    for (const [rel, targets] of fileLinks) {
      for (const target of targets) {
        if (!stemSet.has(target) && !baseNameSet.has(target)) {
          issues.push({
            file: rel,
            kind: "broken-link",
            detail: `broken link: [[${target}]]`
          });
        }
      }
    }
    for (const file of files) {
      const rel = relative4(corpus, file);
      const stem = rel.replace(/\.md$/, "");
      const baseName = stem.split("/").pop();
      if (!inboundLinks.has(stem) && !inboundLinks.has(baseName)) {
        issues.push({
          file: rel,
          kind: "orphan",
          detail: "orphan page (no inbound links)"
        });
      }
    }
    console.log(chalk4.bold(`
lorekit lint \u2014 ${corpus}
`));
    if (issues.length === 0) {
      ok("no issues found");
      console.log();
      return;
    }
    const grouped = {};
    for (const issue of issues) {
      (grouped[issue.kind] ??= []).push(issue);
    }
    const kindLabels = {
      "missing-field": "frontmatter",
      "broken-link": "broken links",
      orphan: "orphan pages"
    };
    for (const [kind, items] of Object.entries(grouped)) {
      console.log(chalk4.cyan(`\u2500\u2500 ${kindLabels[kind] ?? kind} (${items.length}) \u2500\u2500`));
      for (const item of items) {
        bad(`${item.file}: ${item.detail}`);
      }
      console.log();
    }
    console.log(chalk4.yellow(`${issues.length} issue(s) total
`));
    process.exitCode = 1;
  });
}

// src/commands/audit.ts
init_corpus();
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readFileSync as readFileSync7, writeFileSync as writeFileSync2 } from "fs";
import { join as join6, basename as basename2 } from "path";
var SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };
function extractPreview(filePath) {
  const content = readFileSync7(filePath, "utf-8");
  const lines = content.split("\n");
  let inFm = false;
  for (const line of lines) {
    if (line.trimEnd() === "---") {
      if (!inFm) {
        inFm = true;
        continue;
      } else {
        inFm = false;
        continue;
      }
    }
    if (inFm) continue;
    if (line.trim() === "") continue;
    return line.trim();
  }
  return "";
}
function listAudit(root, filter) {
  const dirs = [];
  if (filter === "open" || filter === "all") dirs.push(join6(root, "\u53CD\u9988", "\u5F85\u5904\u7406"));
  if (filter === "resolved" || filter === "all") dirs.push(join6(root, "\u53CD\u9988", "\u5DF2\u5904\u7406"));
  const entries = [];
  for (const dir of dirs) {
    if (!existsSync4(dir)) continue;
    const files = collectMdFiles(dir);
    for (const f of files) {
      if (basename2(f) === ".gitkeep") continue;
      if (!hasFrontmatter(f)) continue;
      const fm = extractFrontmatter(f);
      const severity = fm.severity ?? "";
      const target = fm.target ?? "";
      const created = fm.created ?? "";
      const status = fm.status ?? "";
      const preview = extractPreview(f);
      entries.push({
        severity,
        sevOrder: SEVERITY_ORDER[severity] ?? 0,
        target,
        status,
        created,
        preview
      });
    }
  }
  if (entries.length === 0) {
    console.log("No audit entries found.");
    return;
  }
  entries.sort((a, b) => b.sevOrder - a.sevOrder);
  for (const e of entries) {
    console.log(`[${e.severity}] ${e.target} \u2014 ${e.preview} (${e.created}) [${e.status}]`);
  }
  console.log();
  console.log(`Total: ${entries.length} entries`);
}
function createAudit(root, target, severity, text) {
  if (!target) {
    err("audit --create requires --target");
    process.exit(2);
  }
  if (!severity) {
    err("audit --create requires --severity");
    process.exit(2);
  }
  if (!text) {
    err("audit --create requires --text");
    process.exit(2);
  }
  if (!["low", "medium", "high"].includes(severity)) {
    err(`severity must be low|medium|high, got: ${severity}`);
    process.exit(2);
  }
  const slug = basename2(target, ".md").replace(/[\s/]/g, "-").toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tsFile = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const tsFm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const filename = `${tsFile}-${slug}.md`;
  const destDir = join6(root, "\u53CD\u9988", "\u5F85\u5904\u7406");
  mkdirSync2(destDir, { recursive: true });
  const dest = join6(destDir, filename);
  const content = `---
type: audit
target: ${target}
severity: ${severity}
status: open
created: ${tsFm}
---

${text}
`;
  writeFileSync2(dest, content, "utf-8");
  ok(`created: \u53CD\u9988/\u5F85\u5904\u7406/${filename}`);
  console.log(`  target:   ${target}`);
  console.log(`  severity: ${severity}`);
}
function auditCommand(program2) {
  const cmd = program2.command("audit").description("Human feedback loop for corpus content").option("--list", "List entries (default)").option("--open", "Only show open (\u5F85\u5904\u7406) entries").option("--resolved", "Only show resolved (\u5DF2\u5904\u7406) entries").option("--create", "Create a new audit entry").option("--target <file>", "Target file path (relative to corpus root)").option("--severity <level>", "Severity: low | medium | high").option("--text <text>", "Feedback text");
  cmd.action((opts) => {
    const root = requireCorpus();
    if (opts.create) {
      createAudit(root, opts.target ?? "", opts.severity ?? "", opts.text ?? "");
    } else {
      let filter = "all";
      if (opts.open) filter = "open";
      else if (opts.resolved) filter = "resolved";
      listAudit(root, filter);
    }
  });
}

// src/commands/index.ts
init_corpus();
import { existsSync as existsSync5, readdirSync as readdirSync4, readFileSync as readFileSync8, statSync as statSync5, writeFileSync as writeFileSync3, lstatSync } from "fs";
import { join as join7, basename as basename3 } from "path";
var INDEX_DIRS = [
  "\u77E5\u8BC6\u5E93/\u6982\u5FF5",
  "\u77E5\u8BC6\u5E93/\u5B9E\u4F53",
  "\u77E5\u8BC6\u5E93/\u6458\u8981",
  "\u77E5\u8BC6\u5E93/\u4E13\u9898",
  "\u6BCF\u65E5",
  "\u5199\u4F5C",
  "\u539F\u6599/\u6587\u7AE0",
  "\u539F\u6599/\u4E66\u7C4D",
  "\u539F\u6599/\u4F1A\u8BAE",
  "\u539F\u6599/\u5F55\u97F3",
  "\u539F\u6599/\u526A\u85CF"
];
function extractSummary(filePath) {
  const content = readFileSync8(filePath, "utf-8");
  const lines = content.split("\n");
  let found = false;
  for (const line of lines) {
    if (/^## Compiled Truth/.test(line)) {
      found = true;
      continue;
    }
    if (!found) continue;
    if (/^---\s*$/.test(line)) break;
    if (/^## /.test(line)) break;
    if (line.trim() === "") continue;
    let text = line.trim().replace(/^\*\*[^*]*\*\*\s*/, "");
    const periodMatch = text.match(/^([^。.]*[。.])/);
    if (periodMatch && periodMatch[1].length <= 50) {
      return periodMatch[1];
    }
    return text.slice(0, 50);
  }
  return "";
}
function buildIndex(dir, root) {
  const reldir = dir.slice(root.length + 1);
  const dirName = basename3(dir);
  const indexFile = join7(dir, "_INDEX.md");
  const mdFiles = [];
  let names;
  try {
    names = readdirSync4(dir, { encoding: "utf-8" });
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith(".")) continue;
    if (!name.endsWith(".md")) continue;
    if (name === "_INDEX.md" || name === ".gitkeep") continue;
    const full = join7(dir, name);
    try {
      if (lstatSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    mdFiles.push(full);
  }
  if (mdFiles.length === 0) return;
  const entries = [];
  for (const f of mdFiles) {
    let title = "";
    let updated = "";
    let summary = "";
    if (hasFrontmatter(f)) {
      const fm = extractFrontmatter(f);
      title = fm.title ?? "";
      updated = fm.updated ?? "";
      summary = extractSummary(f);
      if (!summary) summary = "\u2014";
    } else {
      summary = "\uFF08\u7F3A\u5C11 frontmatter\uFF09";
    }
    if (!title) title = basename3(f, ".md");
    if (!updated) {
      try {
        const mtime = statSync5(f).mtime;
        const pad = (n) => String(n).padStart(2, "0");
        updated = `${mtime.getFullYear()}-${pad(mtime.getMonth() + 1)}-${pad(mtime.getDate())}`;
      } catch {
        updated = "unknown";
      }
    }
    entries.push({ title, summary, updated });
  }
  entries.sort((a, b) => b.updated.localeCompare(a.updated));
  const lines = [];
  lines.push(`# ${dirName}`);
  lines.push("");
  lines.push(`> \u672C\u76EE\u5F55\u5171 ${entries.length} \u4E2A\u6761\u76EE\u3002\u7531 \`lorekit index\` \u81EA\u52A8\u751F\u6210\u3002`);
  lines.push("");
  lines.push("| \u6761\u76EE | \u6458\u8981 | \u66F4\u65B0 |");
  lines.push("|---|---|---|");
  for (const e of entries) {
    lines.push(`| [[${e.title}]] | ${e.summary} | ${e.updated} |`);
  }
  lines.push("");
  writeFileSync3(indexFile, lines.join("\n"), "utf-8");
  ok(`${reldir}/_INDEX.md (${entries.length} entries)`);
}
function indexCommand(program2) {
  const cmd = program2.command("index").description("Generate _INDEX.md for corpus directories").option("--dir <subdir>", "Only update a specific subdirectory");
  cmd.action((opts) => {
    const root = requireCorpus();
    if (opts.dir) {
      const full = join7(root, opts.dir);
      if (!existsSync5(full)) {
        err(`directory not found: ${opts.dir}`);
        process.exit(1);
      }
      buildIndex(full, root);
    } else {
      let generated = 0;
      for (const d of INDEX_DIRS) {
        const full = join7(root, d);
        if (!existsSync5(full)) continue;
        buildIndex(full, root);
        generated++;
      }
      if (generated === 0) {
        warn("no indexable directories found");
      }
    }
  });
}

// src/commands/install-skills.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync3, readdirSync as readdirSync5, symlinkSync, unlinkSync, readlinkSync, lstatSync as lstatSync2 } from "fs";
import { join as join8 } from "path";
function isSymlink(path) {
  try {
    return lstatSync2(path).isSymbolicLink();
  } catch {
    return false;
  }
}
function installSkillsCommand(program2) {
  const cmd = program2.command("install-skills").description("Install lorekit skills into a harness (e.g. Claude Code)").option("--target <harness>", 'Target harness (currently only "claude-code")').option("--list", "List currently installed wiki-* skill symlinks").option("--uninstall", "Remove installed skill symlinks");
  cmd.action((opts) => {
    const skillsDest = join8(process.env.HOME ?? "", ".claude", "skills");
    if (opts.list) {
      if (!existsSync6(skillsDest)) return;
      const names = readdirSync5(skillsDest, { encoding: "utf-8" });
      for (const name of names) {
        if (!name.startsWith("wiki-")) continue;
        const full = join8(skillsDest, name);
        if (!isSymlink(full)) continue;
        const target = readlinkSync(full);
        console.log(`${name} -> ${target}`);
      }
      return;
    }
    if (!opts.target) {
      err("install-skills: --target required");
      process.exit(2);
    }
    if (opts.target !== "claude-code") {
      err(`target '${opts.target}' not supported; only 'claude-code' is available`);
      process.exit(2);
    }
    mkdirSync3(skillsDest, { recursive: true });
    const skillsSrc = join8(lorekitRoot(), "skills");
    if (!existsSync6(skillsSrc)) {
      err(`skills directory not found: ${skillsSrc}`);
      process.exit(1);
    }
    const allNames = readdirSync5(skillsSrc, { encoding: "utf-8" });
    const skillNames = allNames.filter((name) => {
      if (!name.startsWith("wiki-")) return false;
      try {
        return lstatSync2(join8(skillsSrc, name)).isDirectory();
      } catch {
        return false;
      }
    });
    let count = 0;
    for (const name of skillNames) {
      const srcDir = join8(skillsSrc, name);
      const skillFile = join8(srcDir, "SKILL.md");
      if (!existsSync6(skillFile)) continue;
      const dest = join8(skillsDest, name);
      if (opts.uninstall) {
        if (isSymlink(dest)) {
          unlinkSync(dest);
          ok(`removed ${name}`);
          count++;
        }
      } else {
        if (isSymlink(dest)) unlinkSync(dest);
        symlinkSync(srcDir, dest);
        ok(`linked ${name}`);
        count++;
      }
    }
    if (count === 0) {
      console.log("No skills found to install.");
    } else if (!opts.uninstall) {
      console.log(`
Installed ${count} skill(s). Restart Claude Code to load them.`);
    }
  });
}

// src/commands/snapshot.ts
import { mkdirSync as mkdirSync4, writeFileSync as writeFileSync4, unlinkSync as unlinkSync2, readdirSync as readdirSync6, statSync as statSync6 } from "fs";
import { join as join9, relative as relative5 } from "path";
import * as tar from "tar";
init_corpus();
function collectAllFiles(dir, base) {
  const results = [];
  const EXCLUDE = /* @__PURE__ */ new Set([".wiki", ".git", ".DS_Store"]);
  function walk(d) {
    for (const entry of readdirSync6(d, { withFileTypes: true })) {
      if (EXCLUDE.has(entry.name)) continue;
      const full = join9(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(relative5(base, full));
      }
    }
  }
  walk(dir);
  return results.sort();
}
function snapshotCommand(program2) {
  program2.command("snapshot").option("--tag <name>", "optional tag appended to filename").description("create a tarball snapshot of the corpus").action(async (opts) => {
    const corpus = requireCorpus();
    const snapshotsDir = join9(corpus, ".wiki", "snapshots");
    mkdirSync4(snapshotsDir, { recursive: true });
    const files = collectAllFiles(corpus, corpus);
    if (files.length === 0) {
      bad("no files found in corpus");
      return;
    }
    const manifest = files.map((relPath) => {
      const full = join9(corpus, relPath);
      const st = statSync6(full);
      return {
        path: relPath,
        sha256: sha256(full),
        bytes: st.size,
        mtime: st.mtime.toISOString()
      };
    });
    const manifestPath = join9(snapshotsDir, "manifest.json");
    writeFileSync4(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join("");
    const tag = opts.tag ? `-${opts.tag}` : "";
    const tarName = `${stamp}${tag}.tar.gz`;
    const tarPath = join9(snapshotsDir, tarName);
    const allEntries = [
      ...files,
      relative5(corpus, manifestPath)
    ];
    await tar.create(
      {
        gzip: true,
        file: tarPath,
        cwd: corpus,
        prefix: ""
      },
      allEntries
    );
    unlinkSync2(manifestPath);
    const tarStat = statSync6(tarPath);
    const sizeMB = (tarStat.size / 1024 / 1024).toFixed(1);
    ok(`snapshot saved: ${tarPath} (${files.length} files, ${sizeMB} MB)`);
  });
}

// src/commands/restore.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync5, readFileSync as readFileSync10, copyFileSync, rmSync } from "fs";
import { join as join10, dirname as dirname3 } from "path";
import { createInterface as createInterface2 } from "readline";
import { tmpdir } from "os";
import * as tar2 from "tar";
import chalk5 from "chalk";
init_corpus();
function ask2(question) {
  const rl = createInterface2({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
function rmDirRecursive(dir) {
  rmSync(dir, { recursive: true, force: true });
}
function restoreCommand(program2) {
  program2.command("restore").requiredOption("--from <snapshot>", "path to snapshot .tar.gz").option("--dry-run", "only list differences, do not restore").option("--file <path>", "restore only this specific file").description("restore files from a snapshot").action(async (opts) => {
    const corpus = requireCorpus();
    if (!existsSync8(opts.from)) {
      bad(`snapshot not found: ${opts.from}`);
      process.exitCode = 1;
      return;
    }
    const tmpDir = join10(tmpdir(), `lorekit-restore-${Date.now()}`);
    mkdirSync5(tmpDir, { recursive: true });
    try {
      await tar2.extract({
        file: opts.from,
        cwd: tmpDir
      });
      const manifestPath = join10(tmpDir, ".wiki", "snapshots", "manifest.json");
      if (!existsSync8(manifestPath)) {
        bad("manifest.json not found in snapshot");
        process.exitCode = 1;
        return;
      }
      const manifest = JSON.parse(readFileSync10(manifestPath, "utf-8"));
      const diffs = [];
      for (const entry of manifest) {
        if (opts.file && entry.path !== opts.file) continue;
        const corpusPath = join10(corpus, entry.path);
        if (!existsSync8(corpusPath)) {
          diffs.push({
            kind: "MISSING",
            path: entry.path,
            snapshotSha: entry.sha256,
            currentSha: null
          });
        } else {
          const currentSha = sha256(corpusPath);
          if (currentSha !== entry.sha256) {
            diffs.push({
              kind: "CHANGED",
              path: entry.path,
              snapshotSha: entry.sha256,
              currentSha
            });
          }
        }
      }
      if (diffs.length === 0) {
        ok("corpus matches snapshot \u2014 nothing to restore");
        return;
      }
      const missing = diffs.filter((d) => d.kind === "MISSING");
      const changed = diffs.filter((d) => d.kind === "CHANGED");
      if (missing.length > 0) {
        console.log(chalk5.yellow(`
  MISSING (${missing.length}):`));
        for (const d of missing) {
          console.log(`    + ${d.path}`);
        }
      }
      if (changed.length > 0) {
        console.log(chalk5.cyan(`
  CHANGED (${changed.length}):`));
        for (const d of changed) {
          console.log(`    ~ ${d.path}`);
        }
      }
      console.log();
      if (opts.dryRun) {
        warn(`dry-run: ${diffs.length} file(s) would be restored`);
        return;
      }
      const answer = await ask2(`  restore ${diffs.length} file(s)? [y/N] `);
      if (answer.toLowerCase() !== "y") {
        bad("cancelled");
        return;
      }
      let restored = 0;
      for (const d of diffs) {
        const src = join10(tmpDir, d.path);
        const dest = join10(corpus, d.path);
        if (!existsSync8(src)) {
          warn(`file not in snapshot archive: ${d.path}`);
          continue;
        }
        mkdirSync5(dirname3(dest), { recursive: true });
        copyFileSync(src, dest);
        restored++;
      }
      ok(`restored ${restored} file(s) from snapshot`);
    } finally {
      rmDirRecursive(tmpDir);
    }
  });
}

// src/commands/search.ts
import { readFileSync as readFileSync11 } from "fs";
import { join as join11, relative as relative7 } from "path";
import { spawnSync } from "child_process";
init_corpus();
function searchWithRipgrep(query, corpus, opts) {
  const searchDir = opts.dir ? join11(corpus, opts.dir) : corpus;
  const args = [
    "--json",
    "--no-heading",
    "-i"
  ];
  if (opts.type) {
    args.push("--type", opts.type);
  }
  args.push("--glob", "!.wiki/**", "--glob", "!.git/**");
  args.push(query, searchDir);
  const result = spawnSync("rg", args, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) {
    return [];
  }
  const results = [];
  for (const line of (result.stdout || "").split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "match") {
        results.push({
          file: relative7(corpus, obj.data.path.text),
          line: obj.data.line_number,
          text: obj.data.lines.text.trimEnd()
        });
      }
    } catch {
    }
  }
  return results;
}
function searchFallback(query, corpus, opts) {
  const searchDir = opts.dir ? join11(corpus, opts.dir) : corpus;
  const files = collectMdFiles(searchDir);
  const pattern = new RegExp(query, "i");
  const results = [];
  for (const filePath of files) {
    const content = readFileSync11(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        results.push({
          file: relative7(corpus, filePath),
          line: i + 1,
          text: lines[i].trimEnd()
        });
      }
    }
  }
  return results;
}
function hasRipgrep() {
  const result = spawnSync("rg", ["--version"], { encoding: "utf-8" });
  return !result.error && result.status === 0;
}
function searchCommand(program2) {
  program2.command("search").argument("<query>", "search query (regex supported)").option("--type <t>", "file type filter (passed to rg --type)").option("--dir <d>", "subdirectory within corpus to search").description("search the corpus with ripgrep (fallback: built-in)").action((query, opts) => {
    const corpus = requireCorpus();
    let results;
    if (hasRipgrep()) {
      results = searchWithRipgrep(query, corpus, opts);
    } else {
      warn("rg (ripgrep) not found, using built-in fallback");
      results = searchFallback(query, corpus, { dir: opts.dir });
    }
    for (const r of results) {
      console.log(JSON.stringify(r));
    }
    if (results.length === 0) {
      warn("no results");
    }
  });
}

// src/commands/vector.ts
init_corpus();
function vectorCommand(program2) {
  const vec = program2.command("vector").description("vector search engine \u2014 embed & search via ollama + sqlite-vec");
  vec.command("sync").option("--force", "full rebuild (re-embed all files)", false).option("--layered", "build L0/L1 layered index", false).option("--model <name>", "ollama model name", "bge-m3").description("index corpus into vector DB").action(async (opts) => {
    const corpus = requireCorpus();
    const { embed: embed2, embedSingle: embedSingle2 } = await Promise.resolve().then(() => (init_ollama(), ollama_exports));
    const { openDb: openDb2, syncFile: syncFile2, buildLayeredIndex: buildLayeredIndex2, collectFiles: collectFiles2 } = await Promise.resolve().then(() => (init_vectordb(), vectordb_exports));
    const testEmb = await embedSingle2("test", opts.model);
    const dim = testEmb.length;
    const db = await openDb2(corpus, dim);
    const files = collectFiles2(corpus);
    let synced = 0;
    let skipped = 0;
    let totalChunks = 0;
    for (const filePath of files) {
      const rel = filePath.replace(corpus + "/", "");
      if (!opts.force) {
        const row = db.prepare("SELECT sha256 FROM documents WHERE path = ?").get(rel);
        if (row) {
          const { createHash: createHash3 } = await import("crypto");
          const { readFileSync: readFileSync15 } = await import("fs");
          const sha = createHash3("sha256").update(readFileSync15(filePath)).digest("hex");
          if (row.sha256 === sha) {
            skipped++;
            continue;
          }
        }
      }
      const embedFn = (texts) => embed2(texts, opts.model);
      const result = await syncFile2(db, filePath, corpus, embedFn);
      totalChunks += result.chunks;
      synced++;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)").run(
      now
    );
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?)").run(
      opts.model
    );
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('dim', ?)").run(
      String(dim)
    );
    if (opts.layered || opts.force) {
      console.log("Building layered index (L0/L1)...");
      const embedBatch = (texts) => embed2(texts, opts.model);
      await buildLayeredIndex2(db, corpus, embedBatch);
    }
    db.close();
    ok(`synced ${synced} files (${totalChunks} chunks), skipped ${skipped} unchanged`);
  });
  vec.command("query").requiredOption("--text <text>", "search query text").option("--top-k <n>", "number of results", "5").option("--threshold <n>", "minimum similarity score", "0.5").option("--layered", "use L0\u2192L1\u2192L2 layered retrieval", false).option("--model <name>", "ollama model name", "bge-m3").description("semantic search in the vector index").action(
    async (opts) => {
      const corpus = requireCorpus();
      const topK = parseInt(opts.topK, 10);
      const threshold = parseFloat(opts.threshold);
      const { embedSingle: embedSingle2 } = await Promise.resolve().then(() => (init_ollama(), ollama_exports));
      const { openDb: openDb2, queryFlat: queryFlat2, queryLayered: queryLayered2 } = await Promise.resolve().then(() => (init_vectordb(), vectordb_exports));
      const { existsSync: existsSync13 } = await import("fs");
      const { join: join17 } = await import("path");
      let dim = 1024;
      const dbPath = join17(corpus, ".wiki", "vector.sqlite");
      if (existsSync13(dbPath)) {
        const tmpDb = await openDb2(corpus);
        const row = tmpDb.prepare("SELECT value FROM meta WHERE key = 'dim'").get();
        if (row) dim = parseInt(row.value, 10);
        tmpDb.close();
      }
      const db = await openDb2(corpus, dim);
      const embedding = await embedSingle2(opts.text, opts.model);
      const results = opts.layered ? queryLayered2(db, embedding, topK, threshold) : queryFlat2(db, embedding, topK, threshold);
      db.close();
      console.log(JSON.stringify(results, null, 2));
    }
  );
  vec.command("status").description("show vector index status").action(async () => {
    const corpus = requireCorpus();
    const { getStatus: getStatus2 } = await Promise.resolve().then(() => (init_vectordb(), vectordb_exports));
    const info = await getStatus2(corpus);
    console.log(JSON.stringify(info, null, 2));
  });
}

// src/commands/fetch.ts
init_corpus();
import { existsSync as existsSync11, mkdirSync as mkdirSync8 } from "fs";
import { join as join15, relative as relative10 } from "path";

// src/lib/fetcher.ts
import { mkdir, writeFile } from "fs/promises";
import { join as join13 } from "path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
var UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
var UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var MAX_IMG_BYTES = 5 * 1024 * 1024;
var IMG_CONCURRENCY = 5;
var HTTP_TIMEOUT_MS = 2e4;
var ANTIBOT_TRIGGERS = [
  "\u73AF\u5883\u5F02\u5E38",
  "\u8BF7\u5728\u5FAE\u4FE1\u5BA2\u6237\u7AEF\u6253\u5F00",
  "\u5B8C\u6210\u9A8C\u8BC1\u540E\u5373\u53EF\u7EE7\u7EED",
  "Just a moment",
  "cf-browser-verification"
];
function detectSite(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("mp.weixin.qq.com")) return "weixin";
  } catch {
  }
  return "generic";
}
function buildHeaders(site) {
  if (site === "weixin") {
    return {
      "User-Agent": UA_IPHONE,
      "Referer": "https://mp.weixin.qq.com/",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
  }
  return {
    "User-Agent": UA_DESKTOP,
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
}
function detectAntibot(html, site) {
  if (ANTIBOT_TRIGGERS.some((t) => html.includes(t))) return true;
  if (site === "weixin" && !html.includes("js_content")) return true;
  return false;
}
function slugify(s) {
  let slug = s.replace(/[^\w\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 50) || "untitled";
}
function resolveUrl(src, base) {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}
async function fetchHtmlL1(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
async function fetchHtmlL2(url) {
  try {
    const pw = await import("playwright-core");
    const browser = await pw.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 6e4 });
      return await page.content();
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}
var SHANGHAI_TZ_OFFSET_MS = 8 * 60 * 60 * 1e3;
function tsToYMD(seconds) {
  const d = new Date(seconds * 1e3 + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}
function todayYMD() {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}
function normalizeDateText(raw) {
  const s = raw.trim();
  if (!s) return void 0;
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const zh = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (zh) {
    const [, y, m, d] = zh;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return void 0;
}
function parseWeixin(html, baseUrl) {
  const $ = cheerio.load(html);
  let title = $("h1#activity-name").text().trim() || $("h1.rich_media_title").text().trim() || $('meta[property="og:title"]').attr("content")?.trim() || "";
  const author = $("a#js_name").text().trim() || $("#js_author_name").text().trim() || "";
  let publishDate;
  const ctMatch = html.match(/var\s+ct\s*=\s*"(\d+)"/);
  if (ctMatch) {
    const ts = Number(ctMatch[1]);
    if (Number.isFinite(ts) && ts > 0) publishDate = tsToYMD(ts);
  }
  if (!publishDate) {
    const ptText = $("em#publish_time").text().trim();
    if (ptText) publishDate = normalizeDateText(ptText);
  }
  const body = $("#js_content");
  if (!body.length) {
    return { title, author, publishDate, bodyHtml: "", imgSrcs: [] };
  }
  body.find("script, style").remove();
  const imgSrcs = [];
  body.find("img").each((_i, el) => {
    const $el = $(el);
    const real = ($el.attr("data-src") || $el.attr("data-original") || $el.attr("data-url") || $el.attr("src") || "").trim();
    if (!real || real.startsWith("data:")) {
      $el.remove();
      return;
    }
    const abs = resolveUrl(real, baseUrl);
    $el.attr("src", abs);
    for (const a of [
      "data-src",
      "data-original",
      "data-url",
      "data-w",
      "data-ratio",
      "data-type",
      "data-s",
      "srcset"
    ]) {
      $el.removeAttr(a);
    }
    imgSrcs.push(abs);
  });
  return { title, author, publishDate, bodyHtml: body.html() || "", imgSrcs };
}
function parseGeneric(html, baseUrl) {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const titleTag = $("title").text().trim();
  const title = ogTitle || titleTag || "";
  const author = $('meta[name="author"]').attr("content")?.trim() || "";
  let publishDate;
  const dateCandidates = [
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[property="og:article:published_time"]').attr("content"),
    $('meta[name="article:published_time"]').attr("content"),
    $('meta[itemprop="datePublished"]').attr("content"),
    $('meta[name="date"]').attr("content"),
    $('meta[name="pubdate"]').attr("content"),
    $('meta[name="publishdate"]').attr("content"),
    $("time[datetime]").first().attr("datetime"),
    $("time").first().text()
  ];
  for (const cand of dateCandidates) {
    if (!cand) continue;
    const norm = normalizeDateText(cand);
    if (norm) {
      publishDate = norm;
      break;
    }
  }
  let body = $("article");
  if (!body.length) body = $("main");
  if (!body.length) body = $("body");
  if (!body.length) {
    return { title, author, publishDate, bodyHtml: "", imgSrcs: [] };
  }
  body.find("script, style, nav, footer, header, aside").remove();
  const imgSrcs = [];
  body.find("img").each((_i, el) => {
    const $el = $(el);
    const real = ($el.attr("data-src") || $el.attr("data-original") || $el.attr("src") || "").trim();
    if (!real || real.startsWith("data:")) {
      $el.remove();
      return;
    }
    const abs = resolveUrl(real, baseUrl);
    $el.attr("src", abs);
    imgSrcs.push(abs);
  });
  return { title, author, publishDate, bodyHtml: body.html() || "", imgSrcs };
}
function htmlToMarkdown(html) {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced"
  });
  return td.turndown(html).trim();
}
var MAGIC = [
  [[255, 216, 255], ".jpg"],
  [[137, 80, 78, 71, 13, 10, 26, 10], ".png"],
  // \x89PNG\r\n\x1a\n
  [[71, 73, 70, 56, 55, 97], ".gif"],
  // GIF87a
  [[71, 73, 70, 56, 57, 97], ".gif"]
  // GIF89a
];
function sniffExt(head, contentType) {
  for (const [sig, ext] of MAGIC) {
    if (sig.every((b, i) => head[i] === b)) return ext;
  }
  if (head[0] === 82 && head[1] === 73 && head[2] === 70 && head[3] === 70 && head[8] === 87 && head[9] === 69 && head[10] === 66 && head[11] === 80) {
    return ".webp";
  }
  const ct = contentType.toLowerCase();
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return ".jpg";
  if (ct.includes("image/png")) return ".png";
  if (ct.includes("image/gif")) return ".gif";
  if (ct.includes("image/webp")) return ".webp";
  if (ct.includes("image/svg")) return ".svg";
  return null;
}
async function downloadOneImage(url, idx, imagesDir, headers) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const cl = Number(res.headers.get("content-length") || 0);
      if (cl && cl > MAX_IMG_BYTES) {
        return { originalUrl: url, localRel: null, status: "too_large" };
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_IMG_BYTES) {
        return { originalUrl: url, localRel: null, status: "too_large" };
      }
      const data = new Uint8Array(buf);
      const ext = sniffExt(data.slice(0, 16), res.headers.get("content-type") || "");
      if (!ext) continue;
      const fname = `img_${String(idx).padStart(2, "0")}${ext}`;
      await writeFile(join13(imagesDir, fname), data);
      return { originalUrl: url, localRel: `./images/${fname}`, status: "ok" };
    } catch {
    }
  }
  return { originalUrl: url, localRel: null, status: "failed" };
}
async function downloadImages(imgSrcs, imagesDir, headers) {
  if (imgSrcs.length === 0) return [];
  await mkdir(imagesDir, { recursive: true });
  const results = [];
  for (let i = 0; i < imgSrcs.length; i += IMG_CONCURRENCY) {
    const batch = imgSrcs.slice(i, i + IMG_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((src, j) => downloadOneImage(src, i + j + 1, imagesDir, headers))
    );
    results.push(...batchResults);
  }
  return results;
}
function rewriteMarkdownImages(md, imgResults) {
  const urlToLocal = /* @__PURE__ */ new Map();
  for (const r of imgResults) {
    if (r.status === "ok" && r.localRel) {
      urlToLocal.set(r.originalUrl, r.localRel);
    }
  }
  return md.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      const local = urlToLocal.get(url);
      return local ? `![${alt}](${local})` : match;
    }
  );
}
async function fetchUrl(url, opts) {
  const site = detectSite(url);
  const headers = buildHeaders(site);
  let sourceLayer = "L1";
  let html = "";
  try {
    html = await fetchHtmlL1(url, headers);
    if (detectAntibot(html, site)) {
      html = "";
    }
  } catch {
    html = "";
  }
  if (!html) {
    sourceLayer = "L2";
    const l2html = await fetchHtmlL2(url);
    if (!l2html) {
      return {
        status: "error",
        route: "rich",
        url,
        reason: "ANTIBOT_BLOCKED",
        suggest: "Install playwright-core + chromium, or paste content manually"
      };
    }
    html = l2html;
    if (detectAntibot(html, site)) {
      return {
        status: "error",
        route: "rich",
        url,
        reason: "ANTIBOT_BLOCKED",
        suggest: "Site requires login or manual intervention"
      };
    }
  }
  const doc = site === "weixin" ? parseWeixin(html, url) : parseGeneric(html, url);
  if (!doc.bodyHtml || doc.bodyHtml.replace(/<[^>]*>/g, "").trim().length < 50) {
    return {
      status: "error",
      route: "rich",
      url,
      reason: "empty_body"
    };
  }
  let md = htmlToMarkdown(doc.bodyHtml);
  const slug = slugify(doc.title || "untitled");
  const dir = join13(opts.outRoot, slug);
  const imagesDir = join13(dir, "images");
  await mkdir(dir, { recursive: true });
  let imagesOk = 0;
  let imagesFailed = 0;
  if (!opts.noImages && doc.imgSrcs.length > 0) {
    const imgResults = await downloadImages(doc.imgSrcs, imagesDir, headers);
    md = rewriteMarkdownImages(md, imgResults);
    for (const r of imgResults) {
      if (r.status === "ok") imagesOk++;
      else imagesFailed++;
    }
  }
  const sourceKind = site === "weixin" ? "clipping" : "article";
  const today = todayYMD();
  const fmLines = ["---"];
  fmLines.push("type: source");
  if (doc.title) fmLines.push(`title: "${doc.title.replace(/"/g, '\\"')}"`);
  fmLines.push(`created: ${today}`);
  fmLines.push(`updated: ${today}`);
  fmLines.push(`source_url: ${url}`);
  if (doc.author) fmLines.push(`source_author: "${doc.author.replace(/"/g, '\\"')}"`);
  if (doc.publishDate) fmLines.push(`source_date: ${doc.publishDate}`);
  fmLines.push(`source_kind: ${sourceKind}`);
  fmLines.push("---");
  fmLines.push("");
  if (doc.title) fmLines.push(`# ${doc.title}`, "");
  fmLines.push(md, "");
  const articlePath = join13(dir, "article.md");
  await writeFile(articlePath, fmLines.join("\n"), "utf-8");
  return {
    status: "ok",
    route: "rich",
    url,
    title: doc.title || void 0,
    author: doc.author || void 0,
    publishDate: doc.publishDate,
    sourceKind,
    sourceLayer,
    slug,
    dir,
    markdown: articlePath,
    imagesDir,
    imagesOk,
    imagesFailed
  };
}

// src/lib/ingest-state.ts
import { existsSync as existsSync10, mkdirSync as mkdirSync7, readFileSync as readFileSync14, writeFileSync as writeFileSync5 } from "fs";
import { join as join14, dirname as dirname4 } from "path";
function stateFilePath(corpus) {
  return join14(corpus, ".wiki", "ingest-state.json");
}
function loadIngestState(corpus) {
  const p = stateFilePath(corpus);
  if (!existsSync10(p)) {
    return { version: 1, ingests: {} };
  }
  try {
    const raw = readFileSync14(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { version: 1, ingests: {} };
    }
    if (!parsed.ingests || typeof parsed.ingests !== "object") {
      parsed.ingests = {};
    }
    parsed.version = 1;
    return parsed;
  } catch {
    return { version: 1, ingests: {} };
  }
}
function saveIngestState(corpus, state) {
  const p = stateFilePath(corpus);
  mkdirSync7(dirname4(p), { recursive: true });
  const serialized = JSON.stringify(state, null, 2);
  writeFileSync5(p, serialized + "\n", "utf-8");
}
function getIngestRecord(corpus, url) {
  return loadIngestState(corpus).ingests[url];
}
function upsertIngestRecord(corpus, url, patch) {
  const state = loadIngestState(corpus);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = state.ingests[url];
  const merged = existing ? { ...existing, ...patch, url, updatedAt: now } : {
    url,
    startedAt: now,
    updatedAt: now,
    status: patch.status ?? "started",
    stepsDone: patch.stepsDone ?? [],
    ...patch
  };
  if (merged.stepsDone) {
    merged.stepsDone = Array.from(new Set(merged.stepsDone));
  }
  state.ingests[url] = merged;
  saveIngestState(corpus, state);
  return merged;
}
function deleteIngestRecord(corpus, url) {
  const state = loadIngestState(corpus);
  if (!(url in state.ingests)) return false;
  delete state.ingests[url];
  saveIngestState(corpus, state);
  return true;
}
function listPendingIngests(corpus) {
  const state = loadIngestState(corpus);
  return Object.values(state.ingests).filter(
    (r) => r.status !== "completed"
  );
}
function nextStepHint(record) {
  if (record.status === "completed") return "nothing to do";
  if (record.status === "failed") {
    return `failed: ${record.error ?? "unknown error"} \u2014 inspect and re-run with --force if you want to retry`;
  }
  const done = new Set(record.stepsDone);
  if (!done.has("fetch")) {
    return "fetch: nothing recorded yet \u2014 run `lorekit fetch <url>`";
  }
  if (!done.has("archive")) {
    return "archive: mv the workbench dir into \u539F\u6599/\uFF08\u526A\u85CF|\u6587\u7AE0|\u4E66\u7C4D|...\uFF09";
  }
  if (!done.has("wiki")) {
    return "wiki: compile wiki pages in \u77E5\u8BC6\u5E93/\uFF08\u6982\u5FF5|\u5B9E\u4F53|\u6458\u8981|\u4E13\u9898\uFF09";
  }
  if (!done.has("lint")) {
    return "lint: run `lorekit ingest-check`, fix any issues, then `lorekit ingest record <url> --complete`";
  }
  return "all steps done but status not yet completed \u2014 run `lorekit ingest record <url> --complete`";
}

// src/commands/fetch.ts
function suggestResult(route, url, suggest) {
  return { status: "unsupported", route, url, suggest };
}
function getHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
function isPdfUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return false;
  }
}
function fetchCommand(program2) {
  program2.command("fetch").argument("<url>", "URL to fetch").option("--out <dir>", "output directory").option("--force-rich", "skip host routing, always use rich fetcher").option("--no-images", "skip image downloads").option("--force", "ignore duplicate-URL check and re-fetch anyway").description("Fetch a URL into local markdown + images").action(async (url, opts) => {
    const corpus = findCorpus();
    let outRoot;
    if (opts.out) {
      outRoot = opts.out;
    } else {
      outRoot = corpus ? join15(corpus, "_\u5DE5\u4F5C\u53F0", "\u6536\u4EF6", "fetch") : "/tmp/lorekit-fetch";
    }
    if (!existsSync11(outRoot)) {
      mkdirSync8(outRoot, { recursive: true });
    }
    let duplicate;
    if (corpus && !opts.force) {
      const state = getIngestRecord(corpus, url);
      if (state && state.status !== "completed") {
        const hint = nextStepHint(state);
        console.error(
          `[lorekit fetch] in-progress ingest detected for ${url}
  status: ${state.status}  steps done: ${state.stepsDone.join(", ") || "(none)"}
  started: ${state.startedAt}
  next step \u2192 ${hint}
  use --force to restart from scratch`
        );
        console.log(JSON.stringify({
          status: "in_progress",
          route: "rich",
          url,
          ingestState: state,
          nextStep: hint
        }));
        return;
      }
      if (state && state.status === "completed") {
        duplicate = {
          path: state.archivedTo ?? "(unknown)",
          sourceDate: state.sourceDate,
          title: state.title
        };
      } else {
        const existing = findSourceByUrl(corpus, url);
        if (existing) {
          const fm = extractFrontmatter(existing);
          const sdRaw = fm.source_date;
          const sourceDate = typeof sdRaw === "string" ? sdRaw : sdRaw instanceof Date ? sdRaw.toISOString().slice(0, 10) : void 0;
          duplicate = {
            path: relative10(corpus, existing),
            sourceDate,
            title: typeof fm.title === "string" ? fm.title : void 0
          };
        }
      }
      if (duplicate) {
        console.error(
          `[lorekit fetch] duplicate url: ${url} already ingested at ${duplicate.path}` + (duplicate.sourceDate ? ` (source_date: ${duplicate.sourceDate})` : "") + `. Use --force to re-fetch anyway.`
        );
        console.log(JSON.stringify({ status: "duplicate", route: "rich", url, duplicate }));
        return;
      }
    }
    const noImages = opts.images === false;
    let result;
    if (opts.forceRich) {
      result = await fetchUrl(url, { outRoot, noImages });
    } else {
      const host = getHost(url);
      if (host.includes("mp.weixin.qq.com")) {
        result = await fetchUrl(url, { outRoot, noImages });
      } else if (host.includes("feishu.cn") || host.includes("larkoffice.com")) {
        result = suggestResult("lark", url, "lark-cli docs +read --as user --doc <url>");
      } else if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com")) {
        result = suggestResult("x", url, "paste screenshot or text (antibot too strong)");
      } else if (host === "github.com" || host === "gist.github.com") {
        result = suggestResult("github", url, "WebFetch or github-content-fetch skill");
      } else if (isPdfUrl(url)) {
        result = suggestResult("pdf", url, "pdf skill");
      } else {
        result = await fetchUrl(url, { outRoot, noImages });
      }
    }
    if (corpus && result.status === "ok" && result.markdown) {
      upsertIngestRecord(corpus, url, {
        title: result.title,
        sourceDate: result.publishDate,
        status: "started",
        stepsDone: ["fetch"],
        workbenchDir: result.dir
      });
    }
    console.log(JSON.stringify(result));
    if (result.status === "error") {
      process.exitCode = 1;
    }
  });
}

// src/commands/ingest.ts
init_corpus();
import { existsSync as existsSync12 } from "fs";
import { join as join16, relative as relative11 } from "path";
var VALID_STEPS = ["fetch", "archive", "wiki", "backlink", "lint"];
function ingestCommand(program2) {
  const group = program2.command("ingest").description("Track ingest pipeline state (record step progress, list pending, reconcile)");
  group.command("list").description("List every ingest record (completed + in-progress)").action(() => {
    const corpus = requireCorpus();
    const state = loadIngestState(corpus);
    const rows = Object.values(state.ingests);
    if (rows.length === 0) {
      console.error("[lorekit ingest list] no records");
      console.log(JSON.stringify({ ingests: [] }));
      return;
    }
    const summary = rows.map((r) => {
      const done = r.stepsDone.join(",") || "(none)";
      const dest = r.archivedTo ?? r.workbenchDir ?? "-";
      return `  [${r.status.padEnd(12)}] ${r.url}
    steps: ${done}  \u2192  ${dest}`;
    });
    console.error(`[lorekit ingest list] ${rows.length} record(s)
${summary.join("\n")}`);
    console.log(JSON.stringify(state));
  });
  group.command("pending").description("List only in-progress (non-completed) ingests \u2014 what you need to resume").action(() => {
    const corpus = requireCorpus();
    const pending = listPendingIngests(corpus);
    if (pending.length === 0) {
      console.error("[lorekit ingest pending] all ingests are completed \u2014 nothing to resume");
      console.log(JSON.stringify({ pending: [] }));
      return;
    }
    const summary = pending.map((r) => {
      return `  [${r.status.padEnd(12)}] ${r.url}
    next step \u2192 ${nextStepHint(r)}`;
    });
    console.error(`[lorekit ingest pending] ${pending.length} ingest(s) need attention
${summary.join("\n")}`);
    console.log(JSON.stringify({ pending }));
    process.exitCode = 1;
  });
  group.command("record <url>").description("Record step progress for an ingest (call from wiki-ingest skill)").option("--step <step>", `mark step as done (one of: ${VALID_STEPS.join(", ")})`).option("--archived-to <path>", "relative path where the source was moved (e.g. \u539F\u6599/\u526A\u85CF/xxx)").option("--wiki-page <path...>", "relative path of a wiki page created (can be repeated)").option("--status <status>", "explicit status (fetched|archived|wiki_created|completed|failed)").option("--complete", "shortcut: mark status=completed").option("--fail <reason>", "shortcut: mark status=failed with reason").action((url, opts) => {
    const corpus = requireCorpus();
    const patch = {};
    if (opts.step) {
      if (!VALID_STEPS.includes(opts.step)) {
        console.error(`[lorekit ingest record] invalid --step: ${opts.step}. valid: ${VALID_STEPS.join(", ")}`);
        process.exitCode = 2;
        return;
      }
      const existing = loadIngestState(corpus).ingests[url];
      const prev = existing?.stepsDone ?? [];
      patch.stepsDone = [...prev, opts.step];
      if (!opts.status && !opts.complete && !opts.fail) {
        if (opts.step === "lint") patch.status = "completed";
        else patch.status = "started";
      }
    }
    if (opts.archivedTo) patch.archivedTo = opts.archivedTo;
    if (opts.wikiPage && opts.wikiPage.length > 0) {
      const existing = loadIngestState(corpus).ingests[url];
      const prev = existing?.wikiPages ?? [];
      patch.wikiPages = [...prev, ...opts.wikiPage];
    }
    if (opts.status) patch.status = opts.status;
    if (opts.complete) patch.status = "completed";
    if (opts.fail) {
      patch.status = "failed";
      patch.error = opts.fail;
    }
    const updated = upsertIngestRecord(corpus, url, patch);
    console.error(
      `[lorekit ingest record] ${url}
  status: ${updated.status}  steps: ${updated.stepsDone.join(",") || "(none)"}`
    );
    console.log(JSON.stringify(updated));
  });
  group.command("forget <url>").description("Remove a record from the state (e.g. after manual cleanup)").action((url) => {
    const corpus = requireCorpus();
    const removed = deleteIngestRecord(corpus, url);
    console.error(
      removed ? `[lorekit ingest forget] removed ${url}` : `[lorekit ingest forget] no record for ${url}`
    );
    console.log(JSON.stringify({ removed, url }));
  });
  group.command("reconcile").description("Back-fill state for pre-existing \u539F\u6599/ pages missing a state record").option("--dry-run", "list what would be added without writing").action((opts) => {
    const corpus = requireCorpus();
    const sourcesRoot = join16(corpus, "\u539F\u6599");
    if (!existsSync12(sourcesRoot)) {
      console.error("[lorekit ingest reconcile] no \u539F\u6599/ directory");
      return;
    }
    const state = loadIngestState(corpus);
    const added = [];
    for (const mdPath of collectMdFiles(sourcesRoot)) {
      const fm = extractFrontmatter(mdPath);
      const url = typeof fm.source_url === "string" && fm.source_url || typeof fm.url === "string" && fm.url || "";
      if (!url) continue;
      if (state.ingests[url]) continue;
      const rel = relative11(corpus, mdPath);
      const archivedTo = rel.replace(/\/article\.md$/, "");
      const sdRaw = fm.source_date;
      const sourceDate = typeof sdRaw === "string" ? sdRaw : sdRaw instanceof Date ? sdRaw.toISOString().slice(0, 10) : void 0;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      state.ingests[url] = {
        url,
        title: typeof fm.title === "string" ? fm.title : void 0,
        sourceDate,
        startedAt: now,
        updatedAt: now,
        status: "completed",
        stepsDone: ["fetch", "archive", "wiki", "lint"],
        archivedTo
      };
      added.push(url);
    }
    if (!opts.dryRun && added.length > 0) saveIngestState(corpus, state);
    console.error(
      `[lorekit ingest reconcile] ${opts.dryRun ? "would add" : "added"} ${added.length} record(s)`
    );
    for (const u of added) console.error(`  + ${u}`);
    console.log(JSON.stringify({ dryRun: !!opts.dryRun, added }));
  });
}

// src/cli.ts
var version = readVersion();
function showBanner() {
  const corpus = findCorpus();
  let pages = "\u2014";
  let indexed = "0";
  let model = "\u2014";
  if (corpus) {
    const { collectMdFiles: collectMdFiles2 } = (init_corpus(), __toCommonJS(corpus_exports));
    try {
      pages = String(collectMdFiles2(corpus).length);
    } catch {
    }
    try {
      const dbPath = `${corpus}/.wiki/vector.sqlite`;
      const { existsSync: existsSync13 } = __require("fs");
      if (existsSync13(dbPath)) {
        const Database = __require("better-sqlite3");
        const db = new Database(dbPath, { readonly: true });
        indexed = String(db.prepare("SELECT COUNT(*) as c FROM documents").get()?.c ?? 0);
        const row = db.prepare("SELECT value FROM meta WHERE key='model'").get();
        model = row?.value ?? "\u2014";
        db.close();
      }
    } catch {
    }
  }
  const short = corpus && corpus.length > 45 ? "..." + corpus.slice(-42) : corpus ?? "\u2014";
  const B = chalk6.blue;
  const BB = chalk6.blueBright.bold;
  const C = chalk6.cyan;
  const D = chalk6.dim;
  const W = chalk6.white.bold;
  console.log();
  console.log(`  ${BB("\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}`);
  console.log(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551 \u2588\u2588\u2554\u255D\u2588\u2588\u2551\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D")}`);
  console.log(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  console.log(`  ${B("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  console.log(`  ${B("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  console.log(`  ${D("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D   \u255A\u2550\u255D   ")}`);
  console.log(`  ${D("Personal LLM Wiki Toolkit")}  ${C(`v${version}`)}`);
  console.log();
  console.log(`  ${C("corpus")}  ${short}`);
  console.log(`  ${C("pages")}   ${pages.padEnd(10)} ${C("indexed")} ${indexed}`);
  if (model !== "\u2014") console.log(`  ${C("model")}   ${model}`);
  console.log();
  console.log(`  ${W("$ lorekit doctor")}    \u5065\u5EB7\u68C0\u67E5`);
  console.log(`  ${W("$ lorekit fetch")}     \u6293\u53D6\u7F51\u9875`);
  console.log(`  ${W("$ lorekit search")}    \u641C\u7D22`);
  console.log(`  ${W("$ lorekit --help")}    \u6240\u6709\u547D\u4EE4`);
  console.log();
}
var program = new Command();
program.name("lorekit").version(version).description("Personal LLM Wiki Toolkit");
initCommand(program);
doctorCommand(program);
statsCommand(program);
lintCommand(program);
auditCommand(program);
indexCommand(program);
installSkillsCommand(program);
snapshotCommand(program);
restoreCommand(program);
searchCommand(program);
vectorCommand(program);
fetchCommand(program);
ingestCommand(program);
if (process.argv.length <= 2) {
  showBanner();
} else {
  program.parse();
}
//# sourceMappingURL=cli.js.map