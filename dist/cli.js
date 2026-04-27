#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/paths.ts
import { lstatSync } from "fs";
import { join as pathJoin } from "path";
function isIndexExcluded(rel) {
  for (const prefix of indexExcludeDirPrefixes) {
    if (rel === prefix || rel.startsWith(prefix + "/")) return true;
  }
  return false;
}
function isFolderPackage(dir) {
  const articlePath = pathJoin(dir, "article.md");
  try {
    return lstatSync(articlePath).isFile();
  } catch {
    return false;
  }
}
var alwaysExcludeNames, vectorIncludeDirs, vectorExcludePrefixes, vectorExcludeNames, indexExcludeDirPrefixes, lintSkipFrontmatterBasenames, lintRootOnlySkipBasenames, lintSkipOrphanPrefixes, lintSkipFrontmatterPrefixes, lintSkipBrokenLinkPrefixes, snapshotExcludeNames;
var init_paths = __esm({
  "src/lib/paths.ts"() {
    "use strict";
    alwaysExcludeNames = /* @__PURE__ */ new Set([
      ".gitkeep",
      ".DS_Store",
      "_INDEX.md"
    ]);
    vectorIncludeDirs = [
      "\u77E5\u8BC6\u5E93",
      "\u6BCF\u65E5",
      "\u5199\u4F5C",
      "\u539F\u6599/\u6587\u7AE0",
      "\u539F\u6599/\u4E66\u7C4D",
      "\u539F\u6599/\u4F1A\u8BAE"
    ];
    vectorExcludePrefixes = [
      "_\u5DE5\u4F5C\u53F0",
      "_archive",
      "_\u5F52\u6863",
      "\u539F\u6599/\u5F55\u97F3",
      "\u539F\u6599/\u526A\u85CF",
      "\u53CD\u9988",
      "\u7CFB\u7EDF",
      "\u8F93\u51FA",
      ".wiki"
    ];
    vectorExcludeNames = /* @__PURE__ */ new Set([".gitkeep", ".DS_Store"]);
    indexExcludeDirPrefixes = [
      ".wiki",
      ".git",
      "_\u5F52\u6863",
      "_\u5DE5\u4F5C\u53F0",
      "\u7CFB\u7EDF",
      "\u53CD\u9988"
    ];
    lintSkipFrontmatterBasenames = /* @__PURE__ */ new Set([
      "README.md",
      "AGENTS.md",
      "CLAUDE.md",
      "MEMORY.md"
    ]);
    lintRootOnlySkipBasenames = /* @__PURE__ */ new Set(["index.md", "log.md"]);
    lintSkipOrphanPrefixes = [
      "_\u5DE5\u4F5C\u53F0/",
      "_\u5F52\u6863/",
      "\u7CFB\u7EDF/",
      "\u77E5\u8BC6\u5E93/\u6A21\u677F/"
    ];
    lintSkipFrontmatterPrefixes = ["_\u5DE5\u4F5C\u53F0/", "_\u5F52\u6863/"];
    lintSkipBrokenLinkPrefixes = ["\u77E5\u8BC6\u5E93/\u6A21\u677F/"];
    snapshotExcludeNames = /* @__PURE__ */ new Set([".wiki", ".git", ".DS_Store"]);
  }
});

// src/utils/logger.ts
import chalk from "chalk";
var DEBUG_ENABLED, ok, bad, warn, err, info, debug, print, out;
var init_logger = __esm({
  "src/utils/logger.ts"() {
    "use strict";
    DEBUG_ENABLED = process.env.LOREKIT_DEBUG === "1";
    ok = (msg) => console.error(`${chalk.green("\u2713")} ${msg}`);
    bad = (msg) => console.error(`${chalk.red("\u2717")} ${msg}`);
    warn = (msg) => console.error(`${chalk.yellow("lorekit:")} ${msg}`);
    err = (msg) => console.error(`${chalk.red("lorekit:")} ${msg}`);
    info = (msg) => console.error(`${chalk.cyan("\u2139")} ${msg}`);
    debug = (msg) => {
      if (DEBUG_ENABLED) console.error(`${chalk.dim("debug:")} ${msg}`);
    };
    print = (msg = "") => console.error(msg);
    out = (msg) => console.log(msg);
  }
});

// src/lib/vectordb/files.ts
import { createHash as createHash2 } from "crypto";
import { readFileSync as readFileSync13, readdirSync as readdirSync7 } from "fs";
import { basename as basename5, join as join14, relative as relative8 } from "path";
import matter3 from "gray-matter";
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
  if (vectorExcludeNames.has(parts[parts.length - 1])) return false;
  if (!rel.endsWith(".md")) return false;
  for (const prefix of vectorExcludePrefixes) {
    if (rel === prefix || rel.startsWith(prefix + "/")) return false;
  }
  for (const inc of vectorIncludeDirs) {
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
      const full = join14(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md")) {
        const rel = relative8(corpus, full);
        if (shouldIndex(rel)) {
          results.push(full);
        }
      }
    }
  }
  walk(corpus);
  return results.sort();
}
var init_files = __esm({
  "src/lib/vectordb/files.ts"() {
    "use strict";
    init_paths();
  }
});

// src/lib/vectordb/schema.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync6 } from "fs";
import { join as join15 } from "path";
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
async function loadSqlite() {
  let Database2;
  try {
    Database2 = (await import("better-sqlite3")).default;
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
  return { Database: Database2, sqliteVec };
}
async function openDb(corpus, dim = EMBEDDING_DIM) {
  const { Database: Database2, sqliteVec } = await loadSqlite();
  const wikiDir = join15(corpus, ".wiki");
  if (!existsSync11(wikiDir)) mkdirSync6(wikiDir, { recursive: true });
  const dbPath = join15(wikiDir, "vector.sqlite");
  const db = new Database2(dbPath);
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(DDL);
  db.exec(vecDdl(dim));
  db.exec(FTS_DDL);
  const dirCols = db.prepare("PRAGMA table_info(dir_summaries)").all();
  if (!dirCols.some((c) => c.name === "slug_list")) {
    db.exec(`ALTER TABLE dir_summaries ADD COLUMN slug_list TEXT NOT NULL DEFAULT '[]'`);
  }
  return db;
}
var EMBEDDING_DIM, MODE_THRESHOLD_FILES, DDL, FTS_DDL;
var init_schema = __esm({
  "src/lib/vectordb/schema.ts"() {
    "use strict";
    EMBEDDING_DIM = 1024;
    MODE_THRESHOLD_FILES = 100;
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
    FTS_DDL = `
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
import { readFileSync as readFileSync14 } from "fs";
import { basename as basename6 } from "path";
import matter4 from "gray-matter";
function chunkFile(filePath, _corpusRoot) {
  const raw = readFileSync14(filePath, "utf-8");
  const { data: fm, content: body } = matter4(raw);
  let title = fm.title || "";
  const type = fm.type || "";
  if (!title) {
    const m = body.match(/^#\s+(.+)/m);
    title = m ? m[1].trim() : basename6(filePath, ".md");
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

// src/lib/vectordb/sync.ts
import { relative as relative10 } from "path";
async function syncFile(db, filePath, corpus, embedFn) {
  const { chunkFile: chunkFile2 } = await Promise.resolve().then(() => (init_chunker(), chunker_exports));
  const rel = relative10(corpus, filePath);
  const sha = sha2562(filePath);
  const old = db.prepare("SELECT id FROM documents WHERE path = ?").get(rel);
  if (old) {
    const chunkIds = db.prepare("SELECT id FROM chunks WHERE doc_id = ?").all(old.id);
    const delVecChunk = db.prepare("DELETE FROM vec_chunks WHERE rowid = ?");
    const delFtsChunk = db.prepare("DELETE FROM fts_chunks WHERE rowid = ?");
    for (const { id } of chunkIds) {
      delVecChunk.run(id);
      delFtsChunk.run(id);
    }
    db.prepare("DELETE FROM chunks WHERE doc_id = ?").run(old.id);
    const pageIds = db.prepare("SELECT id FROM page_summaries WHERE doc_id = ?").all(old.id);
    const delVecPage = db.prepare("DELETE FROM vec_pages WHERE rowid = ?");
    const delFtsPage = db.prepare("DELETE FROM fts_pages WHERE rowid = ?");
    for (const { id } of pageIds) {
      delVecPage.run(id);
      delFtsPage.run(id);
    }
    db.prepare("DELETE FROM page_summaries WHERE doc_id = ?").run(old.id);
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
  const insertFts = db.prepare("INSERT INTO fts_chunks(rowid, content) VALUES (?, ?)");
  for (let i = 0; i < chunks.length; i++) {
    const blob = float32ToBuffer(embeddings[i]);
    insertChunk.run(docId, chunks[i].section, chunks[i].content, blob);
    const chunkId = Number(
      db.prepare("SELECT last_insert_rowid() as id").get().id
    );
    db.prepare(`INSERT INTO vec_chunks (rowid, embedding) VALUES (${chunkId}, ?)`).run(blob);
    insertFts.run(chunkId, chunks[i].content);
  }
  return { chunks: chunks.length };
}
var init_sync = __esm({
  "src/lib/vectordb/sync.ts"() {
    "use strict";
    init_files();
  }
});

// src/lib/vectordb/build-layered-index.ts
import { existsSync as existsSync12, readFileSync as readFileSync15, readdirSync as readdirSync8 } from "fs";
import { join as join16, relative as relative11 } from "path";
import matter5 from "gray-matter";
function parseIndexSections(content) {
  const lines = content.split("\n");
  const sections = [];
  let current = null;
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
  const entrySlugRe = /^\s*[-*]\s*\[\[([^\]|#]+?)\]\]/;
  return sections.filter((s) => /^\s*[-*]\s/m.test(s.lines.slice(1).join("\n"))).map((s) => {
    const slugs = [];
    for (const line of s.lines.slice(1)) {
      const m = line.match(entrySlugRe);
      if (m) slugs.push(m[1].trim());
    }
    return {
      name: s.name,
      text: s.lines.join("\n").trim(),
      slugs: [...new Set(slugs)]
    };
  });
}
function parseIndexEntries(content) {
  const lines = content.split("\n");
  const entries = [];
  for (const line of lines) {
    if (/^\|\s*条目\s*\|/.test(line)) continue;
    if (/^\|[\s\-|]+\|?\s*$/.test(line)) continue;
    const m = line.match(/^\|\s*\[\[([^\]|#]+?)\]\]\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/);
    if (!m) continue;
    const slug = m[1].trim();
    const summary = m[2].replace(/\\\|/g, "|").trim();
    entries.push({ slug, summary });
  }
  return entries;
}
function findAllIndexFiles(corpus) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync8(dir, { withFileTypes: true });
    } catch (e) {
      warn(`findAllIndexFiles: skip ${dir} (${e.message})`);
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join16(dir, entry.name);
      const rel = relative11(corpus, full);
      if (vectorExcludePrefixes.some((p) => rel === p || rel.startsWith(p + "/"))) continue;
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "_INDEX.md") {
        results.push(full);
      }
    }
  }
  walk(corpus);
  return results.sort();
}
async function buildLayeredIndex(db, corpus, embedFn) {
  db.prepare("DELETE FROM dir_summaries").run();
  db.prepare("DELETE FROM vec_dirs").run();
  db.prepare("DELETE FROM fts_dirs").run();
  const indexPath = join16(corpus, "index.md");
  if (!existsSync12(indexPath)) {
    info("  L0: corpus/index.md not found, skipped");
  } else {
    const raw = readFileSync15(indexPath, "utf-8");
    const { content } = matter5(raw);
    const sections = parseIndexSections(content);
    if (sections.length === 0) {
      info("  L0: no sections with entries in index.md, skipped");
    } else {
      const texts = sections.map((s) => s.text);
      const embeddings = await embedFn(texts);
      const insertDir = db.prepare(
        "INSERT INTO dir_summaries (dir_path, summary, embedding, slug_list) VALUES (?, ?, ?, ?)"
      );
      const insertFtsDir = db.prepare("INSERT INTO fts_dirs(rowid, summary) VALUES (?, ?)");
      for (let i = 0; i < sections.length; i++) {
        const blob = float32ToBuffer(embeddings[i]);
        const slugListJson = JSON.stringify(sections[i].slugs);
        insertDir.run(sections[i].name, sections[i].text, blob, slugListJson);
        const dirId = Number(
          db.prepare("SELECT last_insert_rowid() as id").get().id
        );
        db.prepare(`INSERT INTO vec_dirs (rowid, embedding) VALUES (${dirId}, ?)`).run(blob);
        insertFtsDir.run(dirId, sections[i].text);
      }
      const totalSlugs = sections.reduce((a, s) => a + s.slugs.length, 0);
      info(
        `  L0: indexed ${sections.length} sections from index.md (${totalSlugs} slugs tracked)`
      );
    }
  }
  db.prepare("DELETE FROM page_summaries").run();
  db.prepare("DELETE FROM vec_pages").run();
  db.prepare("DELETE FROM fts_pages").run();
  const indexFiles = findAllIndexFiles(corpus);
  if (indexFiles.length === 0) {
    info("  L1: no _INDEX.md found, skipped");
    return;
  }
  const allEntries = [];
  for (const f of indexFiles) {
    const raw = readFileSync15(f, "utf-8");
    allEntries.push(...parseIndexEntries(raw));
  }
  if (allEntries.length === 0) {
    info("  L1: no entries parsed from _INDEX.md, skipped");
    return;
  }
  const docRows = db.prepare("SELECT id, path FROM documents").all();
  const slugToDocId = /* @__PURE__ */ new Map();
  for (const { id, path } of docRows) {
    slugToDocId.set(path, id);
    slugToDocId.set(path.replace(/\.md$/, ""), id);
    if (path.endsWith("/article.md")) {
      slugToDocId.set(path.replace(/\/article\.md$/, ""), id);
    }
  }
  const matched = [];
  let unmatched = 0;
  for (const e of allEntries) {
    const docId = slugToDocId.get(e.slug);
    if (docId === void 0) {
      unmatched++;
      continue;
    }
    const text = e.summary && e.summary !== "\u2014" && e.summary !== "\uFF08\u7F3A\u5C11 frontmatter\uFF09" ? e.summary : e.slug;
    matched.push({ docId, text, slug: e.slug });
  }
  if (matched.length === 0) {
    info("  L1: no _INDEX.md entries matched documents, skipped");
    return;
  }
  const BATCH = 64;
  const insertPage = db.prepare(
    "INSERT INTO page_summaries (doc_id, summary, embedding) VALUES (?, ?, ?)"
  );
  const insertFtsPage = db.prepare("INSERT INTO fts_pages(rowid, summary) VALUES (?, ?)");
  for (let i = 0; i < matched.length; i += BATCH) {
    const batch = matched.slice(i, i + BATCH);
    const texts = batch.map((m) => m.text);
    const embeddings = await embedFn(texts);
    for (let j = 0; j < batch.length; j++) {
      const blob = float32ToBuffer(embeddings[j]);
      insertPage.run(batch[j].docId, batch[j].text, blob);
      const pageId = Number(
        db.prepare("SELECT last_insert_rowid() as id").get().id
      );
      db.prepare(`INSERT INTO vec_pages (rowid, embedding) VALUES (${pageId}, ?)`).run(blob);
      insertFtsPage.run(pageId, `${batch[j].slug} ${batch[j].text}`);
    }
  }
  let msg = `  L1: indexed ${matched.length} entries from ${indexFiles.length} _INDEX.md`;
  if (unmatched > 0) msg += ` (${unmatched} unmatched slug, skipped)`;
  info(msg);
}
var init_build_layered_index = __esm({
  "src/lib/vectordb/build-layered-index.ts"() {
    "use strict";
    init_paths();
    init_logger();
    init_files();
  }
});

// src/lib/vectordb/query-flat.ts
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
var init_query_flat = __esm({
  "src/lib/vectordb/query-flat.ts"() {
    "use strict";
    init_files();
  }
});

// src/lib/vectordb/query-layered.ts
function queryLayered(db, embedding, topK, threshold) {
  const blob = float32ToBuffer(embedding);
  const L0_K = Math.max(3, Math.ceil(topK / 10));
  const L1_CAP = Math.max(5, Math.ceil(topK / 5));
  const l0Rows = db.prepare(
    `SELECT v.rowid as id, v.distance
       FROM vec_dirs v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`
  ).all(blob, L0_K);
  if (l0Rows.length === 0) return [];
  const dirIds = l0Rows.map((r) => r.id);
  const dirRows = db.prepare(`SELECT slug_list FROM dir_summaries WHERE id IN (${dirIds.map(() => "?").join(",")})`).all(...dirIds);
  const candidateSlugs = /* @__PURE__ */ new Set();
  for (const row of dirRows) {
    try {
      const list = JSON.parse(row.slug_list);
      for (const s of list) candidateSlugs.add(s);
    } catch {
    }
  }
  if (candidateSlugs.size === 0) return [];
  const docRows = db.prepare("SELECT id, path FROM documents").all();
  const L0CandidateDocIds = /* @__PURE__ */ new Set();
  for (const { id, path } of docRows) {
    const stem = path.replace(/\.md$/, "");
    const folderSlug = path.endsWith("/article.md") ? path.replace(/\/article\.md$/, "") : null;
    if (candidateSlugs.has(path) || candidateSlugs.has(stem)) {
      L0CandidateDocIds.add(id);
    } else if (folderSlug && candidateSlugs.has(folderSlug)) {
      L0CandidateDocIds.add(id);
    }
  }
  if (L0CandidateDocIds.size === 0) return [];
  const L0CandidateDocIdArr = [...L0CandidateDocIds];
  const candidatePageIds = db.prepare(
    `SELECT id FROM page_summaries WHERE doc_id IN (${L0CandidateDocIdArr.map(() => "?").join(",")})`
  ).all(...L0CandidateDocIdArr);
  if (candidatePageIds.length === 0) return [];
  const searchK = Math.min(candidatePageIds.length, 50);
  const l1Rows = db.prepare(
    `SELECT v.rowid as id, v.distance
       FROM vec_pages v
       WHERE v.embedding MATCH ? AND k = ?
       ORDER BY v.distance`
  ).all(blob, searchK);
  const candidateSet = new Set(candidatePageIds.map((r) => r.id));
  const l1Filtered = l1Rows.filter((r) => candidateSet.has(r.id)).slice(0, L1_CAP);
  if (l1Filtered.length === 0) return [];
  const pageIds = l1Filtered.map((r) => r.id);
  const L1CandidateDocIds = db.prepare(
    `SELECT DISTINCT doc_id FROM page_summaries WHERE id IN (${pageIds.map(() => "?").join(",")})`
  ).all(...pageIds);
  if (L1CandidateDocIds.length === 0) return [];
  const L1CandidateDocIdList = L1CandidateDocIds.map((r) => r.doc_id);
  const candidateChunkIds = db.prepare(
    `SELECT id FROM chunks WHERE doc_id IN (${L1CandidateDocIdList.map(() => "?").join(",")})`
  ).all(...L1CandidateDocIdList);
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
var init_query_layered = __esm({
  "src/lib/vectordb/query-layered.ts"() {
    "use strict";
    init_files();
  }
});

// src/lib/vectordb/query-bm25.ts
function sanitizeFtsQuery(q) {
  const dates = [];
  const protectedQ = q.replace(/\d{4}-\d{2}-\d{2}/g, (m) => {
    const i = dates.length;
    dates.push(m);
    return ` __DATE${i}__ `;
  });
  let s = protectedQ.replace(/["*:^()\-+]/g, " ");
  s = s.replace(/\b(OR|AND|NOT|NEAR)\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  const tokens = s.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return "";
  const restored = tokens.map((t) => {
    const m = t.match(/^__DATE(\d+)__$/);
    return m ? `"${dates[Number(m[1])]}"` : t;
  });
  return restored.join(" ");
}
function queryBM25Layered(db, queryText, topK) {
  const ftsQ = sanitizeFtsQuery(queryText);
  if (!ftsQ) return [];
  let rows = [];
  try {
    rows = db.prepare(
      `SELECT fc.rank as rank, c.content as content, c.section as section, d.path as path
         FROM fts_chunks fc
         JOIN chunks c ON fc.rowid = c.id
         JOIN documents d ON c.doc_id = d.id
         WHERE fc.fts_chunks MATCH ?
         ORDER BY fc.rank
         LIMIT ?`
    ).all(ftsQ, topK);
  } catch (e) {
    warn(`queryBM25Layered fts5 match: ${e.message}`);
    return [];
  }
  return rows.map((r) => ({
    file: r.path,
    chunk: r.content,
    // FTS5 rank 是负数（越小越相关），取绝对值作为正向分数；归一化留给 RRF
    score: Math.round(-r.rank * 1e4) / 1e4,
    section: r.section ?? ""
  }));
}
var init_query_bm25 = __esm({
  "src/lib/vectordb/query-bm25.ts"() {
    "use strict";
    init_logger();
  }
});

// src/lib/vectordb/query-hybrid.ts
import { createHash as createHash3 } from "crypto";
function rrfMerge(lists, topK, k = 60) {
  const merged = /* @__PURE__ */ new Map();
  for (const list of lists) {
    list.forEach((item, i) => {
      const fingerprint = createHash3("sha256").update(item.chunk).digest("hex").slice(0, 16);
      const key = `${item.file}::${fingerprint}`;
      const rrf = 1 / (k + i + 1);
      const prev = merged.get(key);
      if (prev) {
        prev.rrf += rrf;
      } else {
        merged.set(key, { item, rrf });
      }
    });
  }
  return [...merged.values()].sort((a, b) => b.rrf - a.rrf).slice(0, topK).map(({ item, rrf }) => ({
    ...item,
    score: Math.round(rrf * 1e4) / 1e4
  }));
}
function queryHybrid(db, embedding, queryText, topK, threshold, k) {
  const candN = topK * 2;
  const vecResults = queryLayered(db, embedding, candN, threshold);
  const bm25Results = queryBM25Layered(db, queryText, candN);
  return rrfMerge([vecResults, bm25Results], topK, k);
}
var init_query_hybrid = __esm({
  "src/lib/vectordb/query-hybrid.ts"() {
    "use strict";
    init_query_bm25();
    init_query_layered();
  }
});

// src/lib/vectordb/status.ts
var status_exports = {};
__export(status_exports, {
  getStatus: () => getStatus
});
import { existsSync as existsSync13 } from "fs";
import { join as join17 } from "path";
function computeMode(indexed, indexedFiles) {
  if (!indexed) {
    return {
      mode: "text",
      reason: "vector index not built; text Read is the only option"
    };
  }
  if (indexedFiles < MODE_THRESHOLD_FILES) {
    return {
      mode: "text",
      reason: `indexed_files=${indexedFiles} < ${MODE_THRESHOLD_FILES}; Read three-tier is sharpest at small scale`
    };
  }
  return {
    mode: "vector",
    reason: `indexed_files=${indexedFiles} >= ${MODE_THRESHOLD_FILES}; flat Read too slow, switch to layered vector retrieval`
  };
}
async function getStatus(corpus) {
  const dbPath = join17(corpus, ".wiki", "vector.sqlite");
  if (!existsSync13(dbPath)) {
    const rec2 = computeMode(false, 0);
    return {
      indexed: false,
      message: "No vector index found. Run 'lorekit vector sync' first.",
      mode: rec2.mode,
      mode_threshold: MODE_THRESHOLD_FILES,
      mode_reason: rec2.reason
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
  } catch (e) {
    warn(`getStatus: layered tables missing, treat as 0 (${e.message})`);
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
    backend: "ollama",
    mode: rec.mode,
    mode_threshold: MODE_THRESHOLD_FILES,
    mode_reason: rec.reason
  };
}
var init_status = __esm({
  "src/lib/vectordb/status.ts"() {
    "use strict";
    init_logger();
    init_files();
    init_schema();
  }
});

// src/lib/vectordb/index.ts
var vectordb_exports = {};
__export(vectordb_exports, {
  EMBEDDING_DIM: () => EMBEDDING_DIM,
  MODE_THRESHOLD_FILES: () => MODE_THRESHOLD_FILES,
  buildLayeredIndex: () => buildLayeredIndex,
  collectFiles: () => collectFiles,
  getStatus: () => getStatus,
  openDb: () => openDb,
  queryBM25Layered: () => queryBM25Layered,
  queryFlat: () => queryFlat,
  queryHybrid: () => queryHybrid,
  queryLayered: () => queryLayered,
  rrfMerge: () => rrfMerge,
  syncFile: () => syncFile
});
var init_vectordb = __esm({
  "src/lib/vectordb/index.ts"() {
    "use strict";
    init_schema();
    init_sync();
    init_build_layered_index();
    init_query_flat();
    init_query_layered();
    init_query_bm25();
    init_query_hybrid();
    init_status();
    init_files();
    init_schema();
  }
});

// src/cli.ts
import { existsSync as existsSync23 } from "fs";
import { Command } from "commander";
import chalk7 from "chalk";
import Database from "better-sqlite3";

// src/lib/corpus.ts
init_paths();
init_logger();
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
  } catch (e) {
    debug(`extractFrontmatter(${filePath}) failed: ${e.message}`);
    return {};
  }
}
function hasFrontmatter(filePath) {
  try {
    const first = readFileSync(filePath, "utf-8").slice(0, 4);
    return first === "---\n" || first === "---\r";
  } catch (e) {
    debug(`hasFrontmatter(${filePath}) failed: ${e.message}`);
    return false;
  }
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
function collectMdFiles(dir, _opts) {
  const results = [];
  if (!existsSync(dir)) return results;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md") && !alwaysExcludeNames.has(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results.sort();
}

// src/cli.ts
init_logger();

// src/utils/fs.ts
init_logger();
import { createHash } from "crypto";
import { readFileSync as readFileSync2, statSync } from "fs";
import { join as join2, dirname as dirname2 } from "path";
import { fileURLToPath } from "url";
function sha256(filePath) {
  const content = readFileSync2(filePath);
  return createHash("sha256").update(content).digest("hex");
}
function lorekitRoot() {
  const thisFile = fileURLToPath(import.meta.url);
  return join2(dirname2(thisFile), "..");
}
function readVersion() {
  try {
    return readFileSync2(join2(lorekitRoot(), "VERSION"), "utf-8").trim();
  } catch (e) {
    warn(`VERSION file missing or unreadable: ${e.message}`);
    return "unknown";
  }
}

// src/commands/init.ts
init_logger();
import {
  existsSync as existsSync2,
  mkdirSync,
  readdirSync as readdirSync2,
  cpSync,
  writeFileSync
} from "fs";
import { join as join3, resolve } from "path";
import { createInterface } from "readline";
import chalk2 from "chalk";
var MINIMAL_DIRS = ["\u539F\u6599", "\u77E5\u8BC6\u5E93/\u6982\u5FF5", "\u77E5\u8BC6\u5E93/\u5B9E\u4F53", "\u77E5\u8BC6\u5E93/\u6458\u8981", "\u6BCF\u65E5", "\u7CFB\u7EDF", ".wiki"];
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve5) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve5(answer.trim());
    });
  });
}
function isDirEmpty(dir) {
  if (!existsSync2(dir)) return true;
  const entries = readdirSync2(dir).filter((n) => n !== ".DS_Store" && n !== ".git");
  return entries.length === 0;
}
function copyTemplateFiles(src, dest, isRoot = true) {
  if (!existsSync2(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync2(src, { withFileTypes: true })) {
    if (isRoot && entry.isDirectory() && entry.name === ".obsidian") continue;
    const srcPath = join3(src, entry.name);
    const destPath = join3(dest, entry.name);
    if (entry.isDirectory()) {
      copyTemplateFiles(srcPath, destPath, false);
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
function deployObsidianGraphConfig(corpusPath) {
  const src = join3(lorekitRoot(), "templates", "default-corpus", ".obsidian", "graph.json");
  if (!existsSync2(src)) {
    warn("templates/default-corpus/.obsidian/graph.json not found, skipping graph config");
    return;
  }
  const destDir = join3(corpusPath, ".obsidian");
  const dest = join3(destDir, "graph.json");
  if (existsSync2(dest)) {
    warn(".obsidian/graph.json \u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7\u5199\u5165\u3002\u63A8\u8350 filter \u89C1 docs/QUICKSTART.md");
    return;
  }
  if (!existsSync2(destDir)) mkdirSync(destDir, { recursive: true });
  cpSync(src, dest);
  ok("deployed Obsidian graph filter \u2192 .obsidian/graph.json");
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
    const resolved = resolve(targetPath);
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
      print(chalk2.yellow(`
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
    deployObsidianGraphConfig(resolved);
    deployObsidianPlugin(resolved);
    print();
    ok(chalk2.bold(`corpus initialized at ${resolved}`));
  });
}

// src/commands/doctor.ts
init_logger();
import { existsSync as existsSync4, lstatSync as lstatSync2, readFileSync as readFileSync4, readdirSync as readdirSync3 } from "fs";
import { join as join5, relative } from "path";
import chalk3 from "chalk";
init_paths();

// src/lib/obsidian.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "fs";
import { join as join4 } from "path";
function getRecommendedGraphConfig() {
  const tpl = join4(lorekitRoot(), "templates", "default-corpus", ".obsidian", "graph.json");
  const raw = readFileSync3(tpl, "utf-8");
  return JSON.parse(raw);
}
function getRecommendedFilter() {
  const cfg = getRecommendedGraphConfig();
  return cfg.search ?? "";
}
function readCorpusFilter(corpus) {
  const dest = join4(corpus, ".obsidian", "graph.json");
  if (!existsSync3(dest)) return { exists: false };
  try {
    const raw = readFileSync3(dest, "utf-8");
    const parsed = JSON.parse(raw);
    return { exists: true, search: parsed.search, raw: parsed };
  } catch {
    return { exists: true, search: void 0 };
  }
}
function tokenize(search) {
  return search.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}
function isFilterComplete(actual, recommended) {
  if (!actual) return false;
  const want = new Set(tokenize(recommended));
  const have = new Set(tokenize(actual));
  for (const t of want) {
    if (!have.has(t)) return false;
  }
  return true;
}
function missingTokens(actual, recommended) {
  const have = new Set(actual ? tokenize(actual) : []);
  return tokenize(recommended).filter((t) => !have.has(t));
}

// src/commands/doctor.ts
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
function isRootLevel(rel) {
  return !rel.includes("/");
}
function shouldCountForFrontmatterCoverage(rel) {
  const base = rel.split("/").pop() ?? rel;
  if (lintSkipFrontmatterBasenames.has(base)) return false;
  if (isRootLevel(rel) && lintRootOnlySkipBasenames.has(base)) return false;
  for (const prefix of lintSkipFrontmatterPrefixes) {
    if (rel.startsWith(prefix)) return false;
  }
  return true;
}
function checkDirs(corpus, quiet = false) {
  const findings = [];
  for (const dir of EXPECTED_DIRS) {
    const full = join5(corpus, dir);
    if (existsSync4(full)) {
      if (!quiet) ok(`${dir}/`);
    } else {
      const message = `${dir}/ missing`;
      if (!quiet) bad(`${dir}/ ${chalk3.dim("missing")}`);
      findings.push({ id: "missing-dir", severity: "issue", message });
    }
  }
  return findings;
}
function checkWikiVersion(corpus, quiet = false) {
  const versionFile = join5(corpus, ".wiki", "version");
  if (existsSync4(versionFile)) {
    const ver = readFileSync4(versionFile, "utf-8").trim();
    if (!quiet) ok(`.wiki/version \u2192 ${ver}`);
    return [];
  }
  if (!quiet) bad(".wiki/version missing");
  return [{ id: "missing-wiki-version", severity: "issue", message: ".wiki/version missing" }];
}
function checkFrontmatterCoverage(corpus, quiet = false) {
  const files = collectMdFiles(corpus).filter(
    (f) => shouldCountForFrontmatterCoverage(relative(corpus, f))
  );
  const withFm = files.filter((f) => hasFrontmatter(f)).length;
  const total = files.length;
  const pct = total === 0 ? 100 : Math.round(withFm / total * 100);
  const color = pct >= 90 ? chalk3.green : pct >= 60 ? chalk3.yellow : chalk3.red;
  const icon = pct >= 90 ? "\u2713" : pct >= 60 ? "\u26A0" : "\u2717";
  if (!quiet) print(`${color(icon)} frontmatter coverage: ${withFm}/${total} (${pct}%)`);
  if (pct >= 90) return [];
  return [
    {
      id: "frontmatter-coverage",
      severity: "warning",
      message: `frontmatter coverage: ${withFm}/${total} (${pct}%)`
    }
  ];
}
function checkIndexFiles(corpus, quiet = false) {
  const findings = [];
  function walk(dir) {
    if (!existsSync4(dir)) return;
    for (const entry of readdirSync3(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isDirectory()) continue;
      const full = join5(dir, entry.name);
      const rel = relative(corpus, full);
      if (isIndexExcluded(rel)) continue;
      if (isFolderPackage(full)) continue;
      let shouldHaveIndex = false;
      for (const name of readdirSync3(full)) {
        if (name.startsWith(".")) continue;
        if (name === "_INDEX.md" || name === ".gitkeep") continue;
        const childPath = join5(full, name);
        let stat;
        try {
          stat = lstatSync2(childPath);
        } catch {
          continue;
        }
        if (stat.isFile() && name.endsWith(".md")) {
          shouldHaveIndex = true;
          break;
        }
        if (stat.isDirectory() && isFolderPackage(childPath)) {
          shouldHaveIndex = true;
          break;
        }
      }
      if (shouldHaveIndex && !existsSync4(join5(full, "_INDEX.md"))) {
        if (!quiet) warn(`_INDEX.md missing in ${rel}/`);
        findings.push({
          id: "missing-dir-index",
          severity: "issue",
          message: `_INDEX.md missing in ${rel}/`
        });
      }
      walk(full);
    }
  }
  walk(corpus);
  if (findings.length === 0) {
    if (!quiet) ok("all directories with .md files have _INDEX.md");
  }
  return findings;
}
function checkObsidianGraph(corpus, quiet = false) {
  try {
    const recommended = getRecommendedFilter();
    const cur = readCorpusFilter(corpus);
    if (!cur.exists) {
      if (!quiet) warn("obsidian: graph filter \u4E0D\u5B8C\u6574\uFF0C\u8FD0\u884C lorekit obsidian-tune \u67E5\u770B\u8BE6\u60C5");
      return [
        {
          id: "obsidian-filter",
          severity: "warning",
          message: "obsidian graph filter missing or incomplete"
        }
      ];
    }
    if (isFilterComplete(cur.search, recommended)) {
      if (!quiet) ok("obsidian: graph filter \u5B8C\u6574");
      return [];
    } else {
      if (!quiet) warn("obsidian: graph filter \u4E0D\u5B8C\u6574\uFF0C\u8FD0\u884C lorekit obsidian-tune \u67E5\u770B\u8BE6\u60C5");
      return [
        {
          id: "obsidian-filter",
          severity: "warning",
          message: "obsidian graph filter missing recommended excludes"
        }
      ];
    }
  } catch (e) {
    if (!quiet) warn(`obsidian: \u68C0\u67E5 graph filter \u5931\u8D25: ${e.message}`);
    return [
      {
        id: "obsidian-filter-error",
        severity: "warning",
        message: `obsidian graph check failed: ${e.message}`
      }
    ];
  }
}
function checkArchive(corpus, quiet = false) {
  const archiveDir = join5(corpus, "_\u5F52\u6863");
  if (existsSync4(archiveDir)) {
    if (!quiet) ok("_\u5F52\u6863/ exists");
    return [];
  }
  if (!quiet) warn("_\u5F52\u6863/ not found (optional)");
  return [
    { id: "archive-dir", severity: "warning", message: "_\u5F52\u6863/ not found (optional)" }
  ];
}
function summarize(corpus, findings) {
  const issues = findings.filter((f) => f.severity === "issue");
  const warnings = findings.filter((f) => f.severity === "warning");
  return {
    corpus,
    issues,
    warnings,
    summary: {
      issues: issues.length,
      warnings: warnings.length,
      status: issues.length > 0 ? "issue" : warnings.length > 0 ? "warning" : "ok"
    }
  };
}
function runDoctor(corpus, opts = {}) {
  const quiet = opts.quiet ?? false;
  if (!quiet) print(chalk3.bold(`
lorekit doctor \u2014 ${corpus}
`));
  const findings = [];
  if (!quiet) print(chalk3.cyan("\u2500\u2500 directories \u2500\u2500"));
  findings.push(...checkDirs(corpus, quiet));
  if (!quiet) print();
  if (!quiet) print(chalk3.cyan("\u2500\u2500 wiki metadata \u2500\u2500"));
  findings.push(...checkWikiVersion(corpus, quiet));
  if (!quiet) print();
  if (!quiet) print(chalk3.cyan("\u2500\u2500 frontmatter \u2500\u2500"));
  findings.push(...checkFrontmatterCoverage(corpus, quiet));
  if (!quiet) print();
  if (!quiet) print(chalk3.cyan("\u2500\u2500 index files \u2500\u2500"));
  findings.push(...checkIndexFiles(corpus, quiet));
  if (!quiet) print();
  if (!quiet) print(chalk3.cyan("\u2500\u2500 archive \u2500\u2500"));
  findings.push(...checkArchive(corpus, quiet));
  if (!quiet) print();
  if (!quiet) print(chalk3.cyan("\u2500\u2500 obsidian \u2500\u2500"));
  findings.push(...checkObsidianGraph(corpus, quiet));
  if (!quiet) print();
  const report = summarize(corpus, findings);
  if (!quiet) {
    if (report.summary.status === "ok") {
      print(chalk3.green.bold("all checks passed \u2713"));
    } else if (report.summary.status === "warning") {
      print(chalk3.yellow(`${report.summary.warnings} warning(s) found`));
    } else {
      print(chalk3.yellow(`${report.summary.issues} issue(s) found`));
    }
    print();
  }
  return report.summary.issues;
}
function collectDoctorReport(corpus) {
  const findings = [
    ...checkDirs(corpus, true),
    ...checkWikiVersion(corpus, true),
    ...checkFrontmatterCoverage(corpus, true),
    ...checkIndexFiles(corpus, true),
    ...checkArchive(corpus, true),
    ...checkObsidianGraph(corpus, true)
  ];
  return summarize(corpus, findings);
}
function doctorCommand(program2) {
  program2.command("doctor").description("run health checks on the corpus").option("--json", "print machine-readable report to stdout", false).option("--strict", "treat warnings as failures", false).action((opts) => {
    const corpus = requireCorpus();
    const report = opts.json ? collectDoctorReport(corpus) : null;
    if (opts.json && report) {
      out(JSON.stringify(report, null, 2));
      process.exitCode = report.summary.issues > 0 || opts.strict && report.summary.warnings > 0 ? 1 : 0;
      return;
    }
    const issues = runDoctor(corpus);
    const warnings = collectDoctorReport(corpus).summary.warnings;
    process.exitCode = issues > 0 || opts.strict && warnings > 0 ? 1 : 0;
  });
}

// src/commands/stats.ts
import { readFileSync as readFileSync5, statSync as statSync2 } from "fs";
import { relative as relative2 } from "path";
init_logger();
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
      const rel = relative2(corpus, file);
      const topDir = rel.split("/")[0] || ".";
      byDir[topDir] = (byDir[topDir] || 0) + 1;
      try {
        const mtime = statSync2(file).mtime;
        if (now - mtime.getTime() < sevenDays) {
          recentActive7d++;
        }
        const iso = mtime.toISOString();
        if (iso > lastUpdated) lastUpdated = iso;
      } catch (e) {
        debug(`stats: stat(${file}) failed: ${e.message}`);
      }
      try {
        const content = readFileSync5(file, "utf-8");
        const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
        let m;
        while ((m = linkRe.exec(content)) !== null) {
          inboundLinks.add(m[1].trim());
        }
      } catch (e) {
        debug(`stats: readFileSync(${file}) failed: ${e.message}`);
      }
    }
    const orphans = [];
    for (const file of files) {
      const rel = relative2(corpus, file);
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
    out(JSON.stringify(result, null, 2));
  });
}

// src/commands/lint.ts
import { readFileSync as readFileSync8 } from "fs";
import { relative as relative5, basename as basename2, join as join8 } from "path";
import chalk4 from "chalk";

// src/lib/frontmatter-write.ts
import { readFileSync as readFileSync6, writeFileSync as writeFileSync2 } from "fs";
import matter2 from "gray-matter";

// src/lib/date.ts
var SHANGHAI_TZ_OFFSET_MS = 8 * 60 * 60 * 1e3;
function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayYMDShanghai() {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}
function dateToYMDUtc(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function dateToYMDLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function tsCompact(d = /* @__PURE__ */ new Date()) {
  return [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate()),
    "-",
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds())
  ].join("");
}
function tsMinute(d = /* @__PURE__ */ new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// src/lib/frontmatter-write.ts
var VERIFY_FIELDS = /* @__PURE__ */ new Set(["raw_sha256", "last_verified", "possibly_outdated"]);
var PATCH_FIELDS = /* @__PURE__ */ new Set(["slug", ...VERIFY_FIELDS]);
function readMarkdown(filePath) {
  const parsed = matter2(readFileSync6(filePath, "utf-8"));
  return { data: parsed.data, content: parsed.content };
}
function yamlScalar(value) {
  if (value instanceof Date) return dateToYMDUtc(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const s = String(value);
  if (/^[\w\u4e00-\u9fff./ -]+$/.test(s)) return s;
  return JSON.stringify(s);
}
function serializeYaml(data) {
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => yamlScalar(v)).join(", ")}]`);
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }
  return lines.join("\n") + "\n";
}
function writeMarkdown(filePath, data, content) {
  const raw = readFileSync6(filePath, "utf-8");
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const block = splitFrontmatter(raw);
  const body = content.startsWith("\n") ? content : `
${content}`;
  if (!block) {
    writeFileSync2(filePath, `---${newline}${serializeYaml(data)}---${body}`, "utf-8");
    return;
  }
  const lines = block.yaml.split(/\r?\n/);
  const toAppend = [];
  for (const [key, value] of Object.entries(data)) {
    if (!PATCH_FIELDS.has(key)) continue;
    if (!isWritableScalar(value)) continue;
    const nextLine = `${key}: ${serializeInline(value)}`;
    const existing = topLevelKeyLine(lines, key);
    if (existing >= 0) {
      if (lines[existing] === nextLine) continue;
      lines[existing] = nextLine;
    } else {
      toAppend.push(nextLine);
    }
  }
  const yaml = [...lines, ...toAppend].filter((line, i, arr) => i < arr.length - 1 || line !== "");
  writeFileSync2(filePath, `---${newline}${yaml.join(newline)}${newline}---${body}`, "utf-8");
}
function canonicalMarkdownForHash(data, content) {
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    if (VERIFY_FIELDS.has(key)) continue;
    normalized[key] = normalizeValue(value);
  }
  const body = content.startsWith("\n") ? content : `
${content}`;
  return `${stableStringify(normalized)}
${body}`;
}
function setFieldIfMissing(data, key, value) {
  if (data[key]) return false;
  data[key] = value;
  return true;
}
function splitFrontmatter(raw) {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) return null;
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}
function isWritableScalar(value) {
  if (value instanceof Date) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  return Array.isArray(value) && value.every(isWritableScalar);
}
function serializeInline(value) {
  if (Array.isArray(value)) return `[${value.map((v) => yamlScalar(v)).join(", ")}]`;
  return yamlScalar(value);
}
function topLevelKeyLine(lines, key) {
  const re = new RegExp(`^${escapeRegExp(key)}\\s*:`);
  return lines.findIndex((line) => re.test(line));
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeValue(value) {
  if (value instanceof Date) return dateToYMDUtc(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    const out2 = {};
    for (const key of Object.keys(value).sort()) {
      out2[key] = normalizeValue(value[key]);
    }
    return out2;
  }
  return value;
}
function stableStringify(value) {
  return JSON.stringify(normalizeValue(value));
}

// src/lib/wikilinks.ts
import { existsSync as existsSync5, readFileSync as readFileSync7 } from "fs";
import { basename, join as join6, relative as relative3 } from "path";
function stripCodeBlocks(content) {
  return content.replace(/(```|~~~)[\s\S]*?\1/g, "").replace(/`[^`\n]+`/g, "");
}
function transformNonCode(content, transform) {
  const codeRe = /((```|~~~)[\s\S]*?\2|`[^`\n]+`)/g;
  let out2 = "";
  let last = 0;
  let m;
  while ((m = codeRe.exec(content)) !== null) {
    out2 += transform(content.slice(last, m.index));
    out2 += m[0];
    last = m.index + m[0].length;
  }
  out2 += transform(content.slice(last));
  return out2;
}
function extractWikilinkLabels(content) {
  const labels = [];
  const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
  let m;
  while ((m = linkRe.exec(stripCodeBlocks(content))) !== null) {
    labels.push(m[1].trim());
  }
  return labels;
}
function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}
function collectLinkTargets(corpus) {
  return collectMdFiles(corpus).map((filePath) => {
    const rel = relative3(corpus, filePath);
    const stem = rel.replace(/\.md$/, "");
    const fm = extractFrontmatter(filePath);
    const slug = typeof fm.slug === "string" && fm.slug ? fm.slug : stem;
    const aliases = arrayOfStrings(fm.aliases);
    const title = typeof fm.title === "string" ? fm.title : void 0;
    if (title) aliases.push(title);
    if (stem.endsWith("/article")) {
      const folderStem = stem.replace(/\/article$/, "");
      aliases.push(folderStem.split("/").pop() ?? folderStem);
    }
    return {
      slug,
      file: rel,
      title,
      type: typeof fm.type === "string" ? fm.type : void 0,
      aliases: [...new Set(aliases.filter(Boolean))]
    };
  });
}
function resolveLabel(label, targets) {
  return targets.find((target) => {
    const stem = target.file.replace(/\.md$/, "");
    const base = stem.split("/").pop();
    const slugBase = target.slug.split("/").pop();
    return label === stem || label === target.slug || label === base || label === slugBase || target.aliases.includes(label);
  });
}
function collectWikilinkOccurrences(corpus) {
  const out2 = [];
  for (const filePath of collectMdFiles(corpus)) {
    const rel = relative3(corpus, filePath);
    let content = "";
    try {
      content = readFileSync7(filePath, "utf-8");
    } catch {
      continue;
    }
    for (const label of extractWikilinkLabels(content)) {
      out2.push({ file: rel, label });
    }
  }
  return out2;
}
function replaceWikilinkLabel(content, label, replacement, opts = {}) {
  let count = 0;
  const linkRe = /\[\[([^\]|#]+)([^\]]*)\]\]/g;
  const next = transformNonCode(
    content,
    (segment) => segment.replace(linkRe, (match, rawLabel, suffix) => {
      if (rawLabel.trim() !== label) return match;
      count++;
      const { anchor, alias } = parseWikilinkSuffix(suffix);
      const visibleAlias = opts.alias ?? alias;
      return `[[${replacement}${anchor}${visibleAlias ? `|${visibleAlias}` : ""}]]`;
    })
  );
  return { content: next, count };
}
function plainWikilinkLabel(content, label) {
  let count = 0;
  const linkRe = /\[\[([^\]|#]+)([^\]]*)\]\]/g;
  const next = transformNonCode(
    content,
    (segment) => segment.replace(linkRe, (match, rawLabel, suffix) => {
      if (rawLabel.trim() !== label) return match;
      count++;
      const { alias } = parseWikilinkSuffix(suffix);
      return alias ?? label;
    })
  );
  return { content: next, count };
}
function parseWikilinkSuffix(suffix) {
  const pipe = suffix.indexOf("|");
  if (pipe >= 0) {
    return {
      anchor: suffix.slice(0, pipe),
      alias: suffix.slice(pipe + 1) || void 0
    };
  }
  return { anchor: suffix };
}
function labelToSlug(label) {
  return label.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function relStem(rel) {
  return rel.replace(/\.md$/, "");
}

// src/commands/snapshot.ts
init_logger();
import {
  existsSync as existsSync6,
  mkdirSync as mkdirSync2,
  writeFileSync as writeFileSync3,
  unlinkSync,
  readdirSync as readdirSync4,
  statSync as statSync3
} from "fs";
import { join as join7, relative as relative4 } from "path";
import * as tar from "tar";
init_paths();
function collectAllFiles(dir, base) {
  const results = [];
  function walk(d) {
    for (const entry of readdirSync4(d, { withFileTypes: true })) {
      if (snapshotExcludeNames.has(entry.name)) continue;
      const full = join7(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(relative4(base, full));
      }
    }
  }
  walk(dir);
  return results.sort();
}
async function createSnapshot(corpus, opts = {}) {
  const snapshotsDir = join7(corpus, ".wiki", "snapshots");
  mkdirSync2(snapshotsDir, { recursive: true });
  const files = collectAllFiles(corpus, corpus);
  if (files.length === 0) {
    throw new Error("no files found in corpus");
  }
  const manifest = files.map((relPath) => {
    const full = join7(corpus, relPath);
    const st = statSync3(full);
    return {
      path: relPath,
      sha256: sha256(full),
      bytes: st.size,
      mtime: st.mtime.toISOString()
    };
  });
  const manifestPath = join7(snapshotsDir, "manifest.json");
  writeFileSync3(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  try {
    const tag = opts.tag ? `-${opts.tag}` : "";
    const tarName = `${tsCompact()}${tag}.tar.gz`;
    const tarPath = join7(snapshotsDir, tarName);
    const allEntries = [...files, relative4(corpus, manifestPath)];
    await tar.create(
      {
        gzip: true,
        file: tarPath,
        cwd: corpus,
        prefix: ""
      },
      allEntries
    );
    return tarPath;
  } finally {
    if (existsSync6(manifestPath)) unlinkSync(manifestPath);
  }
}
function snapshotCommand(program2) {
  program2.command("snapshot").option("--tag <name>", "optional tag appended to filename").description("create a tarball snapshot of the corpus").action(async (opts) => {
    const corpus = requireCorpus();
    try {
      const tarPath = await createSnapshot(corpus, opts);
      const tarStat = statSync3(tarPath);
      const sizeMB = (tarStat.size / 1024 / 1024).toFixed(1);
      const count = collectAllFiles(corpus, corpus).length;
      ok(`snapshot saved: ${tarPath} (${count} files, ${sizeMB} MB)`);
    } catch (e) {
      const message = e.message;
      if (message === "no files found in corpus") {
        bad(message);
      } else {
        err(message);
        process.exitCode = 1;
      }
      return;
    }
  });
}

// src/commands/lint.ts
init_paths();
init_logger();
var REQUIRED_FIELDS = ["type", "title", "slug", "created", "updated"];
function isRootLevel2(rel) {
  return !rel.includes("/");
}
function shouldSkipFrontmatter(rel) {
  const base = basename2(rel);
  if (lintSkipFrontmatterBasenames.has(base)) return true;
  if (isRootLevel2(rel) && lintRootOnlySkipBasenames.has(base)) return true;
  for (const prefix of lintSkipFrontmatterPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}
function shouldSkipOrphan(rel) {
  const base = basename2(rel);
  if (lintSkipFrontmatterBasenames.has(base)) return true;
  if (isRootLevel2(rel) && lintRootOnlySkipBasenames.has(base)) return true;
  for (const prefix of lintSkipOrphanPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}
function shouldSkipBrokenLink(rel) {
  for (const prefix of lintSkipBrokenLinkPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}
function isGraphExcluded(fm) {
  return fm["graph-excluded"] === true || fm["graph_excluded"] === true;
}
function isWorkbenchNodeModules(rel) {
  return rel.startsWith("_\u5DE5\u4F5C\u53F0/") && rel.includes("/node_modules/");
}
function runLint(corpus) {
  return runLintPlan(corpus).issues;
}
function runLintPlan(corpus) {
  const files = collectMdFiles(corpus);
  const issues = [];
  const ignored = [];
  const stemSet = /* @__PURE__ */ new Set();
  const baseNameSet = /* @__PURE__ */ new Set();
  const inboundLinks = /* @__PURE__ */ new Set();
  for (const file of files) {
    const rel = relative5(corpus, file);
    const stem = rel.replace(/\.md$/, "");
    stemSet.add(stem);
    baseNameSet.add(stem.split("/").pop());
    const fm = extractFrontmatter(file);
    if (typeof fm.title === "string" && fm.title) baseNameSet.add(fm.title);
    if (Array.isArray(fm.aliases)) {
      for (const alias of fm.aliases) {
        if (typeof alias === "string" && alias) baseNameSet.add(alias);
      }
    }
    if (stem.endsWith("/article")) {
      const folderStem = stem.replace(/\/article$/, "");
      stemSet.add(folderStem);
      baseNameSet.add(folderStem.split("/").pop());
    }
  }
  const fileLinks = /* @__PURE__ */ new Map();
  const fileFrontmatter = /* @__PURE__ */ new Map();
  for (const file of files) {
    const rel = relative5(corpus, file);
    let fm = {};
    try {
      fm = extractFrontmatter(file);
    } catch {
    }
    fileFrontmatter.set(rel, fm);
    if (!shouldSkipFrontmatter(rel)) {
      for (const field of REQUIRED_FIELDS) {
        if (!fm[field]) {
          issues.push({
            file: rel,
            kind: "missing-field",
            detail: `missing frontmatter field: ${field}`
          });
        }
      }
    }
    try {
      const content = readFileSync8(file, "utf-8");
      const targets = [];
      for (const target of extractWikilinkLabels(content)) {
        targets.push(target);
        inboundLinks.add(target);
      }
      fileLinks.set(rel, targets);
    } catch {
    }
  }
  for (const [rel, targets] of fileLinks) {
    if (shouldSkipBrokenLink(rel)) continue;
    for (const target of targets) {
      if (!stemSet.has(target) && !baseNameSet.has(target)) {
        if (isWorkbenchNodeModules(rel)) {
          ignored.push({
            file: rel,
            kind: "broken-link",
            detail: `broken link: [[${target}]]`,
            action: "ignore-by-policy"
          });
          continue;
        }
        issues.push({
          file: rel,
          kind: "broken-link",
          detail: `broken link: [[${target}]]`
        });
      }
    }
  }
  for (const file of files) {
    const rel = relative5(corpus, file);
    if (shouldSkipOrphan(rel)) continue;
    const fm = fileFrontmatter.get(rel) ?? {};
    if (isGraphExcluded(fm)) continue;
    const stem = rel.replace(/\.md$/, "");
    const baseName = stem.split("/").pop();
    let hasInbound = inboundLinks.has(stem) || inboundLinks.has(baseName);
    if (!hasInbound && stem.endsWith("/article")) {
      const folderStem = stem.replace(/\/article$/, "");
      const folderName = folderStem.split("/").pop();
      hasInbound = inboundLinks.has(folderStem) || inboundLinks.has(folderName);
    }
    if (!hasInbound) {
      issues.push({
        file: rel,
        kind: "orphan",
        detail: "orphan page (no inbound links)"
      });
    }
  }
  const safe = [];
  const needsDecision = [];
  const dangerous = [];
  for (const issue of issues) {
    if (issue.kind === "missing-field" && issue.detail === "missing frontmatter field: slug" && issue.file.startsWith("\u539F\u6599/")) {
      safe.push({ ...issue, action: "add-slug" });
    } else if (issue.kind === "broken-link") {
      needsDecision.push({ ...issue, action: "links-closure" });
    } else if (issue.kind === "missing-field") {
      dangerous.push({ ...issue, action: "manual-frontmatter" });
    } else {
      needsDecision.push({ ...issue, action: "review" });
    }
  }
  return { issues, safe, needsDecision, ignored, dangerous };
}
function printLintReport(corpus, issues) {
  print(chalk4.bold(`
lorekit lint \u2014 ${corpus}
`));
  if (issues.length === 0) {
    ok("no issues found");
    print();
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
    print(chalk4.cyan(`\u2500\u2500 ${kindLabels[kind] ?? kind} (${items.length}) \u2500\u2500`));
    for (const item of items) {
      bad(`${item.file}: ${item.detail}`);
    }
    print();
  }
  print(chalk4.yellow(`${issues.length} issue(s) total
`));
}
function printLintPlan(corpus, plan) {
  print(chalk4.bold(`
lorekit lint plan \u2014 ${corpus}
`));
  const groups = [
    ["Safe fixes", plan.safe],
    ["Needs decision", plan.needsDecision],
    ["Ignored", plan.ignored],
    ["Dangerous", plan.dangerous]
  ];
  for (const [label, items] of groups) {
    print(chalk4.cyan(`\u2500\u2500 ${label} (${items.length}) \u2500\u2500`));
    for (const item of items) {
      print(`- ${item.file}: ${item.detail} \u2192 ${item.action}`);
    }
    print();
  }
}
async function applySafeFixes(corpus, plan) {
  const fixes = plan.safe.filter((item) => item.action === "add-slug");
  if (fixes.length === 0) return 0;
  await createSnapshot(corpus, { tag: "lint-safe" });
  for (const fix of fixes) {
    const filePath = join8(corpus, fix.file);
    const parsed = readMarkdown(filePath);
    if (!parsed.data.slug) {
      parsed.data.slug = fix.file.replace(/\.md$/, "");
      writeMarkdown(filePath, parsed.data, parsed.content);
    }
  }
  return fixes.length;
}
function lintCommand(program2) {
  const lint = program2.command("lint").description("check frontmatter, broken wikilinks, and orphan pages").option("--json", "print issues as JSON to stdout", false).action((opts) => {
    const corpus = requireCorpus();
    const plan = runLintPlan(corpus);
    const issues = plan.issues;
    if (opts.json) {
      out(JSON.stringify({ issues, ignored: plan.ignored }, null, 2));
      if (issues.length > 0) process.exitCode = 1;
      return;
    }
    printLintReport(corpus, issues);
    if (issues.length > 0) process.exitCode = 1;
  });
  lint.command("plan").description("group lint issues by fix strategy").option("--json", "print plan as JSON to stdout", false).action((opts, command) => {
    const corpus = requireCorpus();
    const plan = runLintPlan(corpus);
    const json = opts.json || Boolean(command.parent?.opts().json);
    if (json) {
      out(JSON.stringify(plan, null, 2));
    } else {
      printLintPlan(corpus, plan);
    }
    if (plan.issues.length > 0) process.exitCode = 1;
  });
  lint.command("fix").description("apply lint fixes").option("--safe", "only apply deterministic safe fixes", false).action(async (opts) => {
    const corpus = requireCorpus();
    if (!opts.safe) {
      bad("only --safe is supported");
      process.exitCode = 2;
      return;
    }
    const plan = runLintPlan(corpus);
    const count = await applySafeFixes(corpus, plan);
    ok(`applied ${count} safe fix(es)`);
  });
}

// src/commands/audit.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync3, readFileSync as readFileSync9, writeFileSync as writeFileSync4 } from "fs";
import { join as join9, basename as basename3 } from "path";
init_logger();
var SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };
function extractPreview(filePath) {
  const content = readFileSync9(filePath, "utf-8");
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
  if (filter === "open" || filter === "all") dirs.push(join9(root, "\u53CD\u9988", "\u5F85\u5904\u7406"));
  if (filter === "resolved" || filter === "all") dirs.push(join9(root, "\u53CD\u9988", "\u5DF2\u5904\u7406"));
  const entries = [];
  for (const dir of dirs) {
    if (!existsSync7(dir)) continue;
    const files = collectMdFiles(dir);
    for (const f of files) {
      if (basename3(f) === ".gitkeep") continue;
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
    print("No audit entries found.");
    return;
  }
  entries.sort((a, b) => b.sevOrder - a.sevOrder);
  for (const e of entries) {
    print(`[${e.severity}] ${e.target} \u2014 ${e.preview} (${e.created}) [${e.status}]`);
  }
  print();
  print(`Total: ${entries.length} entries`);
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
  const slug = basename3(target, ".md").replace(/[\s/]/g, "-").toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const filename = `${tsCompact(now)}-${slug}.md`;
  const tsFm = tsMinute(now);
  const destDir = join9(root, "\u53CD\u9988", "\u5F85\u5904\u7406");
  mkdirSync3(destDir, { recursive: true });
  const dest = join9(destDir, filename);
  const content = `---
type: audit
target: ${target}
severity: ${severity}
status: open
created: ${tsFm}
---

${text}
`;
  writeFileSync4(dest, content, "utf-8");
  ok(`created: \u53CD\u9988/\u5F85\u5904\u7406/${filename}`);
  print(`  target:   ${target}`);
  print(`  severity: ${severity}`);
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

// src/commands/dir-index.ts
import { existsSync as existsSync8, readdirSync as readdirSync5, readFileSync as readFileSync10, statSync as statSync4, writeFileSync as writeFileSync5, lstatSync as lstatSync3 } from "fs";
import { join as join10, basename as basename4, relative as relative6, resolve as resolve2 } from "path";
init_paths();
init_logger();
function extractSummary(filePath) {
  const content = readFileSync10(filePath, "utf-8");
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
    const text = line.trim().replace(/^\*\*[^*]*\*\*\s*/, "");
    const periodMatch = text.match(/^([^。.]*[。.])/);
    if (periodMatch && periodMatch[1].length <= 50) return periodMatch[1];
    return text.slice(0, 50);
  }
  return "";
}
function readEntryFromFile(filePath, slug) {
  let title = "";
  let updated = "";
  let summary = "";
  if (hasFrontmatter(filePath)) {
    const fm = extractFrontmatter(filePath);
    title = typeof fm.title === "string" ? fm.title : fm.title != null ? String(fm.title) : "";
    if (fm.updated instanceof Date) {
      updated = dateToYMDUtc(fm.updated);
    } else {
      updated = fm.updated != null ? String(fm.updated) : "";
    }
    summary = extractSummary(filePath);
    if (!summary) summary = "\u2014";
  } else {
    summary = "\uFF08\u7F3A\u5C11 frontmatter\uFF09";
  }
  if (!title) title = basename4(filePath, ".md");
  if (!updated) {
    try {
      updated = dateToYMDLocal(statSync4(filePath).mtime);
    } catch {
      updated = "unknown";
    }
  }
  return { slug, title, summary, updated };
}
function escapeCell(s) {
  return s.replace(/\|/g, "\\|");
}
function buildIndex(dir, root) {
  const reldir = dir === root ? "" : relative6(root, dir);
  const dirName = reldir === "" ? basename4(root) : basename4(dir);
  const indexFile = join10(dir, "_INDEX.md");
  let names;
  try {
    names = readdirSync5(dir, { encoding: "utf-8" });
  } catch {
    return false;
  }
  const entries = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    if (name === "_INDEX.md" || name === ".gitkeep") continue;
    const full = join10(dir, name);
    let stat;
    try {
      stat = lstatSync3(full);
    } catch {
      continue;
    }
    if (stat.isFile() && name.endsWith(".md")) {
      const slug = relative6(root, full).replace(/\.md$/, "");
      entries.push(readEntryFromFile(full, slug));
    } else if (stat.isDirectory() && isFolderPackage(full)) {
      const articlePath = join10(full, "article.md");
      const slug = relative6(root, full);
      entries.push(readEntryFromFile(articlePath, slug));
    }
  }
  if (entries.length === 0) return false;
  entries.sort((a, b) => b.updated.localeCompare(a.updated));
  const lines = [];
  lines.push(`# ${dirName}`);
  lines.push("");
  lines.push(`> \u672C\u76EE\u5F55\u5171 ${entries.length} \u4E2A\u6761\u76EE\u3002\u7531 \`lorekit index\` \u81EA\u52A8\u751F\u6210\u3002`);
  lines.push("");
  lines.push("| \u6761\u76EE | \u6458\u8981 | \u66F4\u65B0 |");
  lines.push("|---|---|---|");
  for (const e of entries) {
    lines.push(`| [[${e.slug}]] | ${escapeCell(e.summary)} | ${e.updated} |`);
  }
  lines.push("");
  writeFileSync5(indexFile, lines.join("\n"), "utf-8");
  const display = reldir === "" ? "_INDEX.md" : `${reldir}/_INDEX.md`;
  ok(`${display} (${entries.length} entries)`);
  return true;
}
function findIndexableDirs(root) {
  const results = [];
  function walk(dir, isRoot) {
    const rel = dir === root ? "" : relative6(root, dir);
    if (rel && isIndexExcluded(rel)) return;
    let names;
    try {
      names = readdirSync5(dir, { encoding: "utf-8" });
    } catch {
      return;
    }
    if (!isRoot) {
      let hasIndexable = false;
      for (const name of names) {
        if (name.startsWith(".")) continue;
        if (name === "_INDEX.md" || name === ".gitkeep") continue;
        const full = join10(dir, name);
        let stat;
        try {
          stat = lstatSync3(full);
        } catch {
          continue;
        }
        if (stat.isFile() && name.endsWith(".md")) {
          hasIndexable = true;
          break;
        }
        if (stat.isDirectory() && isFolderPackage(full)) {
          hasIndexable = true;
          break;
        }
      }
      if (hasIndexable) results.push(dir);
    }
    for (const name of names) {
      if (name.startsWith(".")) continue;
      const full = join10(dir, name);
      let stat;
      try {
        stat = lstatSync3(full);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (isFolderPackage(full)) continue;
      walk(full, false);
    }
  }
  walk(root, true);
  return results.sort();
}
function runIndex(root, specificDir) {
  if (specificDir) {
    const full = join10(root, specificDir);
    if (!existsSync8(full)) {
      throw new Error(`directory not found: ${specificDir}`);
    }
    if (resolve2(full) === resolve2(root)) {
      throw new Error(
        `cannot index the corpus root itself \u2014 L0 corpus/index.md already serves this role`
      );
    }
    const rel = relative6(root, full);
    if (isIndexExcluded(rel)) {
      throw new Error(
        `directory "${rel}" is in the exclude list (${indexExcludeDirPrefixes.join(" / ")})`
      );
    }
    return buildIndex(full, root) ? 1 : 0;
  }
  const dirs = findIndexableDirs(root);
  if (dirs.length === 0) return 0;
  let generated = 0;
  for (const d of dirs) {
    if (buildIndex(d, root)) generated++;
  }
  return generated;
}
function indexCommand(program2) {
  const cmd = program2.command("index").description("Generate _INDEX.md recursively for corpus directories").option("--dir <subdir>", "Only update a specific subdirectory");
  cmd.action((opts) => {
    const root = requireCorpus();
    try {
      if (opts.dir) {
        runIndex(root, opts.dir);
      } else {
        const generated = runIndex(root);
        if (generated === 0) {
          warn("no indexable directories found");
        } else {
          ok(`generated ${generated} _INDEX.md file(s)`);
        }
      }
    } catch (e) {
      err(e.message);
      process.exit(1);
    }
  });
}

// src/commands/install-skills.ts
import {
  existsSync as existsSync9,
  mkdirSync as mkdirSync4,
  readdirSync as readdirSync6,
  symlinkSync,
  unlinkSync as unlinkSync2,
  readlinkSync,
  lstatSync as lstatSync4
} from "fs";
import { join as join11 } from "path";
init_logger();
function isSymlink(path) {
  try {
    return lstatSync4(path).isSymbolicLink();
  } catch {
    return false;
  }
}
function installSkillsCommand(program2) {
  const cmd = program2.command("install-skills").description("Install lorekit skills into a harness (e.g. Claude Code)").option("--target <harness>", 'Target harness (currently only "claude-code")').option("--list", "List currently installed wiki-* skill symlinks").option("--uninstall", "Remove installed skill symlinks");
  cmd.action((opts) => {
    const skillsDest = join11(process.env.HOME ?? "", ".claude", "skills");
    if (opts.list) {
      if (!existsSync9(skillsDest)) return;
      const names = readdirSync6(skillsDest, { encoding: "utf-8" });
      for (const name of names) {
        if (!name.startsWith("wiki-")) continue;
        const full = join11(skillsDest, name);
        if (!isSymlink(full)) continue;
        const target = readlinkSync(full);
        out(`${name} -> ${target}`);
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
    mkdirSync4(skillsDest, { recursive: true });
    const skillsSrc = join11(lorekitRoot(), "skills");
    if (!existsSync9(skillsSrc)) {
      err(`skills directory not found: ${skillsSrc}`);
      process.exit(1);
    }
    const allNames = readdirSync6(skillsSrc, { encoding: "utf-8" });
    const skillNames = allNames.filter((name) => {
      if (!name.startsWith("wiki-")) return false;
      try {
        return lstatSync4(join11(skillsSrc, name)).isDirectory();
      } catch {
        return false;
      }
    });
    let count = 0;
    for (const name of skillNames) {
      const srcDir = join11(skillsSrc, name);
      const skillFile = join11(srcDir, "SKILL.md");
      if (!existsSync9(skillFile)) continue;
      const dest = join11(skillsDest, name);
      if (opts.uninstall) {
        if (isSymlink(dest)) {
          unlinkSync2(dest);
          ok(`removed ${name}`);
          count++;
        }
      } else {
        if (isSymlink(dest)) unlinkSync2(dest);
        symlinkSync(srcDir, dest);
        ok(`linked ${name}`);
        count++;
      }
    }
    if (count === 0) {
      print("No skills found to install.");
    } else if (!opts.uninstall) {
      print(`
Installed ${count} skill(s). Restart Claude Code to load them.`);
    }
  });
}

// src/commands/restore.ts
init_logger();
import { existsSync as existsSync10, mkdirSync as mkdirSync5, readFileSync as readFileSync11, copyFileSync, rmSync } from "fs";
import { join as join12, dirname as dirname3 } from "path";
import { createInterface as createInterface2 } from "readline";
import { tmpdir } from "os";
import * as tar2 from "tar";
import chalk5 from "chalk";
function ask2(question) {
  const rl = createInterface2({ input: process.stdin, output: process.stdout });
  return new Promise((resolve5) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve5(answer.trim());
    });
  });
}
function rmDirRecursive(dir) {
  rmSync(dir, { recursive: true, force: true });
}
function restoreCommand(program2) {
  program2.command("restore").requiredOption("--from <snapshot>", "path to snapshot .tar.gz").option("--dry-run", "only list differences, do not restore").option("--file <path>", "restore only this specific file").description("restore files from a snapshot").action(async (opts) => {
    const corpus = requireCorpus();
    if (!existsSync10(opts.from)) {
      bad(`snapshot not found: ${opts.from}`);
      process.exitCode = 2;
      return;
    }
    const tmpDir = join12(tmpdir(), `lorekit-restore-${Date.now()}`);
    mkdirSync5(tmpDir, { recursive: true });
    try {
      await tar2.extract({
        file: opts.from,
        cwd: tmpDir
      });
      const manifestPath = join12(tmpDir, ".wiki", "snapshots", "manifest.json");
      if (!existsSync10(manifestPath)) {
        bad("manifest.json not found in snapshot");
        process.exitCode = 1;
        return;
      }
      const manifest = JSON.parse(readFileSync11(manifestPath, "utf-8"));
      const diffs = [];
      for (const entry of manifest) {
        if (opts.file && entry.path !== opts.file) continue;
        const corpusPath = join12(corpus, entry.path);
        if (!existsSync10(corpusPath)) {
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
        print(chalk5.yellow(`
  MISSING (${missing.length}):`));
        for (const d of missing) {
          print(`    + ${d.path}`);
        }
      }
      if (changed.length > 0) {
        print(chalk5.cyan(`
  CHANGED (${changed.length}):`));
        for (const d of changed) {
          print(`    ~ ${d.path}`);
        }
      }
      print();
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
        const src = join12(tmpDir, d.path);
        const dest = join12(corpus, d.path);
        if (!existsSync10(src)) {
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
init_logger();
import { readFileSync as readFileSync12 } from "fs";
import { join as join13, relative as relative7 } from "path";
import { spawnSync } from "child_process";
function searchWithRipgrep(query, corpus, opts) {
  const searchDir = opts.dir ? join13(corpus, opts.dir) : corpus;
  const args = ["--json", "--no-heading", "-i"];
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
  const searchDir = opts.dir ? join13(corpus, opts.dir) : corpus;
  const files = collectMdFiles(searchDir);
  const pattern = new RegExp(query, "i");
  const results = [];
  for (const filePath of files) {
    const content = readFileSync12(filePath, "utf-8");
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
      out(JSON.stringify(r));
    }
    if (results.length === 0) {
      warn("no results");
    }
  });
}

// src/commands/vector.ts
init_logger();
import { createHash as createHash4 } from "crypto";
import { existsSync as existsSync14, readFileSync as readFileSync16 } from "fs";
import { join as join18, relative as relative12 } from "path";

// src/lib/vectordb/prune.ts
init_files();
init_schema();
import { relative as relative9 } from "path";
function pruneMissingDocuments(db, existingRelPaths) {
  const rows = db.prepare("SELECT id, path FROM documents").all();
  const missing = rows.filter((row) => !existingRelPaths.has(row.path));
  if (missing.length === 0) return 0;
  const delVecChunk = db.prepare("DELETE FROM vec_chunks WHERE rowid = ?");
  const delFtsChunk = db.prepare("DELETE FROM fts_chunks WHERE rowid = ?");
  const delVecPage = db.prepare("DELETE FROM vec_pages WHERE rowid = ?");
  const delFtsPage = db.prepare("DELETE FROM fts_pages WHERE rowid = ?");
  const getChunkIds = db.prepare("SELECT id FROM chunks WHERE doc_id = ?");
  const getPageIds = db.prepare("SELECT id FROM page_summaries WHERE doc_id = ?");
  const deleteChunks = db.prepare("DELETE FROM chunks WHERE doc_id = ?");
  const deletePages = db.prepare("DELETE FROM page_summaries WHERE doc_id = ?");
  const deleteDoc = db.prepare("DELETE FROM documents WHERE id = ?");
  const tx = db.transaction((docs) => {
    for (const doc of docs) {
      const chunkIds = getChunkIds.all(doc.id);
      for (const { id } of chunkIds) {
        delVecChunk.run(id);
        delFtsChunk.run(id);
      }
      deleteChunks.run(doc.id);
      const pageIds = getPageIds.all(doc.id);
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
async function pruneVectorDbMissingFiles(corpus) {
  const db = await openDb(corpus);
  try {
    const files = collectFiles(corpus);
    const existingRelPaths = new Set(files.map((filePath) => relative9(corpus, filePath)));
    return pruneMissingDocuments(db, existingRelPaths);
  } finally {
    db.close();
  }
}

// src/commands/vector.ts
async function runVectorSync(corpus, opts = {}) {
  const force = opts.force ?? false;
  const layered = opts.layered ?? true;
  const model = opts.model ?? "bge-m3";
  const { embed: embed2, embedSingle: embedSingle2 } = await Promise.resolve().then(() => (init_ollama(), ollama_exports));
  const { openDb: openDb2, syncFile: syncFile2, buildLayeredIndex: buildLayeredIndex2, collectFiles: collectFiles2 } = await Promise.resolve().then(() => (init_vectordb(), vectordb_exports));
  const testEmb = await embedSingle2("test", model);
  const dim = testEmb.length;
  const db = await openDb2(corpus, dim);
  const files = collectFiles2(corpus);
  const existingRelPaths = new Set(files.map((filePath) => relative12(corpus, filePath)));
  const pruned = pruneMissingDocuments(db, existingRelPaths);
  if (pruned > 0) warn(`vector sync pruned ${pruned} missing file(s)`);
  let synced = 0;
  let skipped = 0;
  let totalChunks = 0;
  for (const filePath of files) {
    const rel = relative12(corpus, filePath);
    if (!force) {
      const row = db.prepare("SELECT sha256 FROM documents WHERE path = ?").get(rel);
      if (row) {
        const sha = createHash4("sha256").update(readFileSync16(filePath)).digest("hex");
        if (row.sha256 === sha) {
          skipped++;
          continue;
        }
      }
    }
    const embedFn = (texts) => embed2(texts, model);
    const result = await syncFile2(db, filePath, corpus, embedFn);
    totalChunks += result.chunks;
    synced++;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)").run(now);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?)").run(model);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('dim', ?)").run(String(dim));
  if (layered || force) {
    print("Building layered index (L0/L1)...");
    const embedBatch = (texts) => embed2(texts, model);
    await buildLayeredIndex2(db, corpus, embedBatch);
  }
  db.close();
  return { synced, skipped, totalChunks, layered: layered || force, pruned };
}
function vectorCommand(program2) {
  const vec = program2.command("vector").description("vector search engine \u2014 embed & search via ollama + sqlite-vec");
  vec.command("sync").option("--force", "full rebuild (re-embed all files)", false).option("--layered", "build L0/L1 layered index", false).option("--model <name>", "ollama model name", "bge-m3").description("index corpus into vector DB").action(async (opts) => {
    const corpus = requireCorpus();
    const r = await runVectorSync(corpus, opts);
    ok(`synced ${r.synced} files (${r.totalChunks} chunks), skipped ${r.skipped} unchanged`);
  });
  vec.command("query").requiredOption("--text <text>", "search query text").option("--top-k <n>", "number of results", "5").option("--threshold <n>", "minimum similarity score", "0.5").option("--layered", "use L0\u2192L1\u2192L2 layered vector retrieval", false).option("--hybrid", "BM25 + vector layered + RRF fusion (\u9636\u6BB5 2 \u63A8\u8350\uFF0C\u65E0 re-rank)", false).option("--bm25", "BM25 layered only (FTS5, \u7528\u4E8E debug BM25 \u5355\u8DEF)", false).option("--model <name>", "ollama model name", "bge-m3").description("search the vector/FTS index").action(
    async (opts) => {
      const corpus = requireCorpus();
      const topK = parseInt(opts.topK, 10);
      const threshold = parseFloat(opts.threshold);
      if (!Number.isFinite(topK) || topK <= 0) {
        err(`--top-k must be a positive integer, got: "${opts.topK}"`);
        process.exit(2);
      }
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        err(`--threshold must be a number in [0, 1], got: "${opts.threshold}"`);
        process.exit(2);
      }
      const { embedSingle: embedSingle2 } = await Promise.resolve().then(() => (init_ollama(), ollama_exports));
      const { openDb: openDb2, queryFlat: queryFlat2, queryLayered: queryLayered2, queryBM25Layered: queryBM25Layered2, queryHybrid: queryHybrid2 } = await Promise.resolve().then(() => (init_vectordb(), vectordb_exports));
      let dim = 1024;
      const dbPath = join18(corpus, ".wiki", "vector.sqlite");
      if (existsSync14(dbPath)) {
        const tmpDb = await openDb2(corpus);
        const row = tmpDb.prepare("SELECT value FROM meta WHERE key = 'dim'").get();
        if (row) dim = parseInt(row.value, 10);
        tmpDb.close();
      }
      const db = await openDb2(corpus, dim);
      let results;
      if (opts.bm25) {
        results = queryBM25Layered2(db, opts.text, topK);
      } else if (opts.hybrid) {
        const embedding = await embedSingle2(opts.text, opts.model);
        results = queryHybrid2(db, embedding, opts.text, topK, threshold);
      } else {
        const embedding = await embedSingle2(opts.text, opts.model);
        results = opts.layered ? queryLayered2(db, embedding, topK, threshold) : queryFlat2(db, embedding, topK, threshold);
      }
      db.close();
      out(JSON.stringify(results, null, 2));
    }
  );
  vec.command("status").description("show vector index status").action(async () => {
    const corpus = requireCorpus();
    const { getStatus: getStatus2 } = await Promise.resolve().then(() => (init_vectordb(), vectordb_exports));
    const info2 = await getStatus2(corpus);
    out(JSON.stringify(info2, null, 2));
  });
}

// src/commands/fetch.ts
import { existsSync as existsSync16, mkdirSync as mkdirSync8 } from "fs";
import { join as join24, relative as relative13 } from "path";

// src/lib/fetcher/index.ts
import { mkdir as mkdir4, writeFile as writeFile4 } from "fs/promises";
import { join as join22 } from "path";

// src/lib/fetcher/frontmatter.ts
function escapeDoubleQuote(s) {
  return s.replace(/"/g, '\\"');
}
function buildFrontmatter(opts) {
  const { routeKind, title, today: today2, url, author, publishDate } = opts;
  const omitPublishDate = routeKind === "github";
  const lines = ["---"];
  lines.push("type: source");
  if (title) {
    lines.push(`title: "${escapeDoubleQuote(title)}"`);
  }
  lines.push(`created: ${today2}`);
  lines.push(`updated: ${today2}`);
  lines.push(`source_url: ${url}`);
  if (author) {
    lines.push(`source_author: "${escapeDoubleQuote(author)}"`);
  }
  if (!omitPublishDate && publishDate) {
    lines.push(`source_date: ${publishDate}`);
  }
  lines.push(`source_kind: ${routeKind}`);
  lines.push("---");
  return lines;
}

// src/lib/fetcher/helpers.ts
import TurndownService from "turndown";
function slugify(s) {
  const slug = s.replace(/[^\w\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 50) || "untitled";
}
function resolveUrl(src, base) {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}
function htmlToMarkdown(html) {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced"
  });
  return td.turndown(html).trim();
}
var SHANGHAI_TZ_OFFSET_MS2 = 8 * 60 * 60 * 1e3;
function tsToYMD(seconds) {
  const d = new Date(seconds * 1e3 + SHANGHAI_TZ_OFFSET_MS2);
  return d.toISOString().slice(0, 10);
}
function todayYMD() {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS2);
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

// src/lib/fetcher/http.ts
var UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
var UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
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
      Referer: "https://mp.weixin.qq.com/",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
  }
  return {
    "User-Agent": UA_DESKTOP,
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
}
function detectAntibot(html, site) {
  if (ANTIBOT_TRIGGERS.some((t) => html.includes(t))) return true;
  if (site === "weixin" && !html.includes("js_content")) return true;
  return false;
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

// src/lib/fetcher/images.ts
import { mkdir, writeFile } from "fs/promises";
import { join as join19 } from "path";
var MAX_IMG_BYTES = 5 * 1024 * 1024;
var IMG_CONCURRENCY = 5;
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
async function downloadOneImage(url, idx, imagesDir, headers, assetsRelPath) {
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
      await writeFile(join19(imagesDir, fname), data);
      return { originalUrl: url, localRel: `${assetsRelPath}${fname}`, status: "ok" };
    } catch {
    }
  }
  return { originalUrl: url, localRel: null, status: "failed" };
}
async function downloadImages(imgSrcs, imagesDir, headers, assetsRelPath) {
  if (imgSrcs.length === 0) return [];
  await mkdir(imagesDir, { recursive: true });
  const results = [];
  for (let i = 0; i < imgSrcs.length; i += IMG_CONCURRENCY) {
    const batch = imgSrcs.slice(i, i + IMG_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((src, j) => downloadOneImage(src, i + j + 1, imagesDir, headers, assetsRelPath))
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
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const local = urlToLocal.get(url);
    return local ? `![${alt}](${local})` : match;
  });
}

// src/lib/fetcher/routes/web.ts
import * as cheerio from "cheerio";
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

// src/lib/fetcher/routes/weixin.ts
import * as cheerio2 from "cheerio";
function firstSrcsetUrl(srcset) {
  const s = srcset.trim();
  if (!s) return "";
  const firstCandidate = s.split(",")[0].trim();
  if (!firstCandidate) return "";
  const url = firstCandidate.split(/\s+/)[0].trim();
  return url;
}
function parseWeixin(html, baseUrl) {
  const $ = cheerio2.load(html);
  const title = $("h1#activity-name").text().trim() || $("h1.rich_media_title").text().trim() || $('meta[property="og:title"]').attr("content")?.trim() || "";
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
  body.find("picture").each((_i, el) => {
    const $picture = $(el);
    const $firstSource = $picture.find("source[srcset]").first();
    const srcsetRaw = $firstSource.attr("srcset") || "";
    const pickedUrl = firstSrcsetUrl(srcsetRaw);
    let $img = $picture.find("img").first();
    if ($img.length) {
      const existing = ($img.attr("data-src") || $img.attr("data-original") || $img.attr("data-url") || $img.attr("src") || "").trim();
      if (!existing && pickedUrl) {
        $img.attr("data-src", pickedUrl);
      }
    } else if (pickedUrl) {
      $picture.append(`<img data-src="${pickedUrl}">`);
      $img = $picture.find("img").first();
    }
    if ($img.length) {
      $picture.replaceWith($img);
    } else {
      $picture.remove();
    }
  });
  body.find("source").remove();
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

// src/lib/fetcher/routes/gist.ts
import { mkdir as mkdir2, writeFile as writeFile2 } from "fs/promises";
import { join as join20 } from "path";
import * as cheerio3 from "cheerio";
function parseGistUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("gist.github.com") && !u.hostname.endsWith("gist.githubusercontent.com")) {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { user: parts[0], id: parts[1] };
  } catch {
    return null;
  }
}
async function fetchGist(url, outRoot) {
  const parsed = parseGistUrl(url);
  if (!parsed) {
    return { status: "error", route: "gist", url, reason: "invalid_gist_url" };
  }
  const headers = buildHeaders("generic");
  let html;
  try {
    html = await fetchHtmlL1(url, headers);
  } catch (e) {
    return {
      status: "error",
      route: "gist",
      url,
      reason: `fetch_failed: ${e.message}`
    };
  }
  const $ = cheerio3.load(html);
  const description = $('[itemprop="about"]').first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const title = description || ogTitle || parsed.id;
  const author = parsed.user;
  let publishDate;
  const dateRaw = $("relative-time").first().attr("datetime") || $("time-ago").first().attr("datetime") || $('meta[property="article:published_time"]').attr("content") || "";
  if (dateRaw) publishDate = normalizeDateText(dateRaw);
  const rawRe = /^\/([^/]+)\/([a-f0-9]{20,})\/raw\/([a-f0-9]{20,})\/(.+)$/i;
  const rawLinks = [];
  $("a").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(rawRe);
    if (m) {
      rawLinks.push({
        name: m[4],
        rawUrl: "https://gist.githubusercontent.com" + href
      });
    }
  });
  if (rawLinks.length === 0) {
    return { status: "error", route: "gist", url, reason: "no_raw_files_found" };
  }
  const mdLink = rawLinks.find((l) => /\.(md|markdown)$/i.test(l.name)) || rawLinks[0];
  let content;
  try {
    const res = await fetch(mdLink.rawUrl, { headers, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${mdLink.rawUrl}`);
    content = await res.text();
  } catch (e) {
    const err2 = e;
    const cause = err2.cause?.message ? ` (${err2.cause.message})` : "";
    return {
      status: "error",
      route: "gist",
      url,
      reason: `raw_fetch_failed: ${err2.message}${cause} [raw_url=${mdLink.rawUrl}]`
    };
  }
  const slug = slugify(title);
  await mkdir2(outRoot, { recursive: true });
  const today2 = todayYMD();
  const hasH1 = /^#\s+/m.test(content);
  const fmLines = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: "gist",
      title,
      today: today2,
      url,
      author,
      publishDate
    })
  );
  fmLines.push("");
  if (!hasH1) fmLines.push(`# ${title}`, "");
  fmLines.push(content.trim(), "");
  const articlePath = join20(outRoot, `${slug}.md`);
  await writeFile2(articlePath, fmLines.join("\n"), "utf-8");
  return {
    status: "ok",
    route: "gist",
    url,
    title,
    author,
    publishDate,
    sourceKind: "gist",
    sourceLayer: "L1",
    slug,
    markdown: articlePath,
    imagesOk: 0,
    imagesFailed: 0
  };
}

// src/lib/fetcher/routes/github.ts
import { mkdir as mkdir3, writeFile as writeFile3 } from "fs/promises";
import { join as join21 } from "path";
function parseGithubRepoUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, rawRepo, ...rest] = parts;
    const repo = rawRepo.replace(/\.git$/, "");
    if (rest.length === 0) {
      return { owner, repo, ref: "HEAD" };
    }
    if (rest[0] === "blob" && rest.length >= 3) {
      return { owner, repo, ref: rest[1], subpath: rest.slice(2).join("/") };
    }
    if (rest[0] === "tree" && rest.length >= 2) {
      return { owner, repo, ref: rest[1] };
    }
    return { owner, repo, ref: "HEAD" };
  } catch {
    return null;
  }
}
async function fetchGithubDoc(url, outRoot) {
  const parsed = parseGithubRepoUrl(url);
  if (!parsed) {
    return { status: "error", route: "github", url, reason: "invalid_github_url" };
  }
  const { owner, repo, ref, subpath } = parsed;
  const headers = buildHeaders("generic");
  const candidates = [];
  if (subpath) {
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${subpath}`);
  } else {
    for (const name of ["README.md", "README.MD", "Readme.md", "readme.md", "README"]) {
      candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${name}`);
    }
  }
  let content = "";
  let chosenUrl = "";
  for (const candUrl of candidates) {
    try {
      const res = await fetch(candUrl, { headers });
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.trim().length > 20) {
        content = text;
        chosenUrl = candUrl;
        break;
      }
    } catch {
    }
  }
  if (!content) {
    return { status: "error", route: "github", url, reason: "no_readable_content_found" };
  }
  const fileName = subpath ? subpath.split("/").pop() : "README.md";
  const title = subpath ? fileName.replace(/\.(md|markdown)$/i, "") : `${owner}/${repo}`;
  const slug = slugify(subpath ? `${owner}-${repo}-${fileName}` : `${owner}-${repo}`);
  await mkdir3(outRoot, { recursive: true });
  const today2 = todayYMD();
  const hasH1 = /^#\s+/m.test(content);
  const fmLines = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: "github",
      title,
      today: today2,
      url,
      author: owner
    })
  );
  fmLines.push("");
  if (!hasH1) fmLines.push(`# ${title}`, "");
  fmLines.push(`> Fetched from: ${chosenUrl}`, "");
  fmLines.push(content.trim(), "");
  const articlePath = join21(outRoot, `${slug}.md`);
  await writeFile3(articlePath, fmLines.join("\n"), "utf-8");
  return {
    status: "ok",
    route: "github",
    url,
    title,
    author: owner,
    sourceKind: "github",
    sourceLayer: "L1",
    slug,
    markdown: articlePath,
    imagesOk: 0,
    imagesFailed: 0
  };
}

// src/lib/fetcher/index.ts
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
  const assetsDir = join22(opts.outRoot, `${slug}.assets`);
  await mkdir4(opts.outRoot, { recursive: true });
  let imagesOk = 0;
  let imagesFailed = 0;
  if (!opts.noImages && doc.imgSrcs.length > 0) {
    const imgResults = await downloadImages(doc.imgSrcs, assetsDir, headers, `./${slug}.assets/`);
    md = rewriteMarkdownImages(md, imgResults);
    for (const r of imgResults) {
      if (r.status === "ok") imagesOk++;
      else imagesFailed++;
    }
  }
  const sourceKind = site === "weixin" ? "clipping" : "article";
  const today2 = todayYMD();
  const fmLines = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: sourceKind,
      title: doc.title,
      today: today2,
      url,
      author: doc.author,
      publishDate: doc.publishDate
    })
  );
  fmLines.push("");
  if (doc.title) fmLines.push(`# ${doc.title}`, "");
  fmLines.push(md, "");
  const articlePath = join22(opts.outRoot, `${slug}.md`);
  await writeFile4(articlePath, fmLines.join("\n"), "utf-8");
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
    markdown: articlePath,
    assetsDir,
    imagesOk,
    imagesFailed
  };
}

// src/lib/ingest-state.ts
import { existsSync as existsSync15, mkdirSync as mkdirSync7, readFileSync as readFileSync17, writeFileSync as writeFileSync6 } from "fs";
import { join as join23, dirname as dirname4 } from "path";
function stateFilePath(corpus) {
  return join23(corpus, ".wiki", "ingest-state.json");
}
function loadIngestState(corpus) {
  const p = stateFilePath(corpus);
  if (!existsSync15(p)) {
    return { version: 1, ingests: {} };
  }
  try {
    const raw = readFileSync17(p, "utf-8");
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
  writeFileSync6(p, serialized + "\n", "utf-8");
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
  return Object.values(state.ingests).filter((r) => r.status !== "completed");
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
init_logger();
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
  program2.command("fetch").argument("<url>", "URL to fetch").option("--out <dir>", "output directory").option("--force-rich", "skip host routing, always use rich fetcher").option("--no-images", "skip image downloads").option("--force", "ignore duplicate-URL check and re-fetch anyway").description("Fetch a URL into local markdown + images").action(
    async (url, opts) => {
      const corpus = findCorpus();
      let outRoot;
      if (opts.out) {
        outRoot = opts.out;
      } else {
        outRoot = corpus ? join24(corpus, "_\u5DE5\u4F5C\u53F0", "\u6536\u4EF6", "fetch") : "/tmp/lorekit-fetch";
      }
      if (!existsSync16(outRoot)) {
        mkdirSync8(outRoot, { recursive: true });
      }
      let duplicate;
      if (corpus && !opts.force) {
        const state = getIngestRecord(corpus, url);
        if (state && state.status !== "completed") {
          const hint = nextStepHint(state);
          err(
            `[lorekit fetch] in-progress ingest detected for ${url}
  status: ${state.status}  steps done: ${state.stepsDone.join(", ") || "(none)"}
  started: ${state.startedAt}
  next step \u2192 ${hint}
  use --force to restart from scratch`
          );
          out(
            JSON.stringify({
              status: "in_progress",
              route: "rich",
              url,
              ingestState: state,
              nextStep: hint
            })
          );
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
              path: relative13(corpus, existing),
              sourceDate,
              title: typeof fm.title === "string" ? fm.title : void 0
            };
          }
        }
        if (duplicate) {
          err(
            `[lorekit fetch] duplicate url: ${url} already ingested at ${duplicate.path}` + (duplicate.sourceDate ? ` (source_date: ${duplicate.sourceDate})` : "") + `. Use --force to re-fetch anyway.`
          );
          out(JSON.stringify({ status: "duplicate", route: "rich", url, duplicate }));
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
        } else if (host === "gist.github.com" || host === "gist.githubusercontent.com") {
          result = await fetchGist(url, outRoot);
        } else if (host === "github.com" || host === "www.github.com") {
          result = await fetchGithubDoc(url, outRoot);
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
          workbenchMd: result.markdown
        });
      }
      out(JSON.stringify(result));
      if (result.status === "error") {
        process.exitCode = 1;
      }
    }
  );
}

// src/commands/ingest.ts
import { existsSync as existsSync17, lstatSync as lstatSync5, readFileSync as readFileSync18, writeFileSync as writeFileSync7 } from "fs";
import { join as join25, relative as relative14 } from "path";
init_logger();
var VALID_STEPS = ["fetch", "archive", "wiki", "backlink", "lint"];
function today() {
  return dateToYMDLocal(/* @__PURE__ */ new Date());
}
function appendLogEntry(corpus, record, body) {
  const logPath = join25(corpus, "log.md");
  const title = record.title ?? "(untitled)";
  const wikiList = (record.wikiPages ?? []).map((p) => `  - ${p}`).join("\n");
  const archived = record.archivedTo ?? "(unrecorded)";
  const entry = [
    `## [${today()}] ingest | ${title}`,
    "",
    body.trim(),
    "",
    `- **URL**\uFF1A${record.url}`,
    `- **\u5F52\u6863**\uFF1A${archived}`,
    record.wikiPages && record.wikiPages.length > 0 ? `- **\u65B0\u5EFA/\u66F4\u65B0\u9875**\uFF1A
${wikiList}` : "- **\u65B0\u5EFA/\u66F4\u65B0\u9875**\uFF1A\uFF08\u65E0\uFF09",
    "",
    ""
  ].join("\n");
  let existing = "";
  if (existsSync17(logPath)) existing = readFileSync18(logPath, "utf-8");
  if (!existing) {
    const header = '# Log\n\n> \u64CD\u4F5C\u65F6\u95F4\u7EBF\uFF0Cappend-only\u3002\u6BCF\u6761\u683C\u5F0F\uFF1A`## [YYYY-MM-DD] \u64CD\u4F5C\u7C7B\u578B | \u6807\u9898`\n> \u53EF\u7528 `grep "^## \\[" log.md | tail -10` \u5FEB\u901F\u67E5\u6700\u8FD1\u64CD\u4F5C\u3002\n\n';
    writeFileSync7(logPath, header + entry, "utf-8");
    return;
  }
  const firstSection = existing.search(/^## \[/m);
  if (firstSection === -1) {
    const sep3 = existing.endsWith("\n") ? "" : "\n";
    writeFileSync7(logPath, existing + sep3 + entry, "utf-8");
  } else {
    const before = existing.slice(0, firstSection);
    const after = existing.slice(firstSection);
    writeFileSync7(logPath, before + entry + after, "utf-8");
  }
}
function ymdValue(value) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return void 0;
}
function archivedSourceMetadata(corpus, archivedTo) {
  if (!archivedTo) return {};
  const candidate = join25(corpus, archivedTo);
  let filePath = candidate;
  if (existsSync17(candidate)) {
    try {
      if (lstatSync5(candidate).isDirectory()) filePath = join25(candidate, "article.md");
    } catch {
      return {};
    }
  }
  if (!existsSync17(filePath)) return {};
  const fm = extractFrontmatter(filePath);
  return {
    title: typeof fm.title === "string" ? fm.title : void 0,
    sourceDate: ymdValue(fm.source_date),
    sourceKind: typeof fm.source_kind === "string" ? fm.source_kind : void 0
  };
}
function ingestCommand(program2) {
  const group = program2.command("ingest").description("Track ingest pipeline state (record step progress, list pending, reconcile)");
  group.command("list").description("List every ingest record (completed + in-progress)").action(() => {
    const corpus = requireCorpus();
    const state = loadIngestState(corpus);
    const rows = Object.values(state.ingests);
    if (rows.length === 0) {
      print("[lorekit ingest list] no records");
      out(JSON.stringify({ ingests: [] }));
      return;
    }
    const summary = rows.map((r) => {
      const done = r.stepsDone.join(",") || "(none)";
      const dest = r.archivedTo ?? r.workbenchMd ?? r.workbenchDir ?? "-";
      return `  [${r.status.padEnd(12)}] ${r.url}
    steps: ${done}  \u2192  ${dest}`;
    });
    print(`[lorekit ingest list] ${rows.length} record(s)
${summary.join("\n")}`);
    out(JSON.stringify(state));
  });
  group.command("pending").description("List only in-progress (non-completed) ingests \u2014 what you need to resume").action(() => {
    const corpus = requireCorpus();
    const pending = listPendingIngests(corpus);
    if (pending.length === 0) {
      print("[lorekit ingest pending] all ingests are completed \u2014 nothing to resume");
      out(JSON.stringify({ pending: [] }));
      return;
    }
    const summary = pending.map((r) => {
      return `  [${r.status.padEnd(12)}] ${r.url}
    next step \u2192 ${nextStepHint(r)}`;
    });
    print(
      `[lorekit ingest pending] ${pending.length} ingest(s) need attention
${summary.join("\n")}`
    );
    out(JSON.stringify({ pending }));
    process.exitCode = 1;
  });
  group.command("record <url>").description("Record step progress for an ingest (call from wiki-ingest skill)").option(
    "--step <steps>",
    `mark step(s) as done. single: archive | multi: archive,wiki,backlink,lint. valid: ${VALID_STEPS.join(", ")}`
  ).option("--archived-to <path>", "relative path where the source was moved (e.g. \u539F\u6599/\u526A\u85CF/xxx)").option("--wiki-page <path...>", "relative path of a wiki page created (can be repeated)").option("--title <title>", "human-readable source title for state/log").option("--source-date <date>", "source date (YYYY-MM-DD)").option("--source-kind <kind>", "source kind (article|recording|...)").option(
    "--log <body>",
    "append a one-paragraph summary to corpus/log.md (CLI auto-fills url/archive/pages)"
  ).option("--status <status>", "explicit status (started|completed|failed)").option("--complete", "shortcut: mark status=completed").option("--fail <reason>", "shortcut: mark status=failed with reason").action(
    (url, opts) => {
      const corpus = requireCorpus();
      const patch = {};
      let parsedSteps = [];
      if (opts.step) {
        parsedSteps = opts.step.split(",").map((s) => s.trim()).filter(Boolean);
        for (const s of parsedSteps) {
          if (!VALID_STEPS.includes(s)) {
            print(
              `[lorekit ingest record] invalid step: ${s}. valid: ${VALID_STEPS.join(", ")}`
            );
            process.exitCode = 2;
            return;
          }
        }
        const existing = loadIngestState(corpus).ingests[url];
        const prev = existing?.stepsDone ?? [];
        patch.stepsDone = [.../* @__PURE__ */ new Set([...prev, ...parsedSteps])];
        if (!opts.status && !opts.complete && !opts.fail) {
          if (parsedSteps.includes("lint")) patch.status = "completed";
          else patch.status = "started";
        }
      }
      if (opts.archivedTo) patch.archivedTo = opts.archivedTo;
      const existingRecord = loadIngestState(corpus).ingests[url];
      const meta = archivedSourceMetadata(corpus, opts.archivedTo);
      const title = opts.title ?? existingRecord?.title ?? meta.title;
      const sourceDate = opts.sourceDate ?? existingRecord?.sourceDate ?? meta.sourceDate;
      const sourceKind = opts.sourceKind ?? existingRecord?.sourceKind ?? meta.sourceKind;
      if (title) patch.title = title;
      if (sourceDate) patch.sourceDate = sourceDate;
      if (sourceKind) patch.sourceKind = sourceKind;
      if (opts.wikiPage && opts.wikiPage.length > 0) {
        const existing = loadIngestState(corpus).ingests[url];
        const prev = existing?.wikiPages ?? [];
        patch.wikiPages = [.../* @__PURE__ */ new Set([...prev, ...opts.wikiPage])];
      }
      if (opts.status) {
        const validStatuses = ["started", "completed", "failed"];
        if (!validStatuses.includes(opts.status)) {
          print(
            `[lorekit ingest record] invalid --status: ${opts.status}. valid: ${validStatuses.join(", ")}`
          );
          process.exitCode = 2;
          return;
        }
        patch.status = opts.status;
      }
      if (opts.complete) patch.status = "completed";
      if (opts.fail) {
        patch.status = "failed";
        patch.error = opts.fail;
      }
      const updated = upsertIngestRecord(corpus, url, patch);
      let logAppended = false;
      if (opts.log) {
        try {
          appendLogEntry(corpus, updated, opts.log);
          logAppended = true;
        } catch (e) {
          print(`[lorekit ingest record] log append failed: ${e.message}`);
        }
      }
      print(
        `[lorekit ingest record] ${url}
  status: ${updated.status}  steps: ${updated.stepsDone.join(",") || "(none)"}` + (logAppended ? "  +log" : "")
      );
      out(JSON.stringify({ ...updated, logAppended }));
    }
  );
  group.command("check <files...>").description("Scan given wiki pages for broken [[wikilinks]] (pre-commit check)").action((files) => {
    const corpus = requireCorpus();
    const allMd = collectMdFiles(corpus);
    const stemSet = /* @__PURE__ */ new Set();
    const baseNameSet = /* @__PURE__ */ new Set();
    for (const file of allMd) {
      const rel = relative14(corpus, file);
      const stem = rel.replace(/\.md$/, "");
      stemSet.add(stem);
      baseNameSet.add(stem.split("/").pop());
      if (stem.endsWith("/article")) {
        const folder = stem.replace(/\/article$/, "");
        stemSet.add(folder);
        baseNameSet.add(folder.split("/").pop());
      }
    }
    const stripCode = (s) => s.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
    const broken = [];
    const okLinks = [];
    const checked = [];
    for (const f of files) {
      const abs = f.startsWith("/") ? f : join25(process.cwd(), f);
      if (!existsSync17(abs)) {
        print(`[lorekit ingest check] file not found: ${f}`);
        process.exitCode = 2;
        continue;
      }
      const rel = relative14(corpus, abs);
      checked.push(rel);
      let content;
      try {
        content = stripCode(readFileSync18(abs, "utf-8"));
      } catch {
        continue;
      }
      const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
      let m;
      const seen = /* @__PURE__ */ new Set();
      while ((m = linkRe.exec(content)) !== null) {
        const target = m[1].trim();
        if (seen.has(target)) continue;
        seen.add(target);
        if (stemSet.has(target) || baseNameSet.has(target)) {
          okLinks.push({ file: rel, link: target });
        } else {
          broken.push({ file: rel, link: target });
        }
      }
    }
    const result = { checked, ok: okLinks, broken };
    if (broken.length === 0) {
      print(
        `[lorekit ingest check] ${checked.length} file(s), ${okLinks.length} link(s) ok, no broken links`
      );
    } else {
      print(`[lorekit ingest check] ${broken.length} broken link(s) found:`);
      for (const b of broken) {
        print(`  \u2717 ${b.file}: [[${b.link}]]`);
      }
      process.exitCode = 1;
    }
    out(JSON.stringify(result));
  });
  group.command("forget <url>").description("Remove a record from the state (e.g. after manual cleanup)").action((url) => {
    const corpus = requireCorpus();
    const removed = deleteIngestRecord(corpus, url);
    print(
      removed ? `[lorekit ingest forget] removed ${url}` : `[lorekit ingest forget] no record for ${url}`
    );
    out(JSON.stringify({ removed, url }));
  });
  group.command("reconcile").description("Back-fill state for pre-existing \u539F\u6599/ pages missing a state record").option("--dry-run", "list what would be added without writing").action((opts) => {
    const corpus = requireCorpus();
    const sourcesRoot = join25(corpus, "\u539F\u6599");
    if (!existsSync17(sourcesRoot)) {
      print("[lorekit ingest reconcile] no \u539F\u6599/ directory");
      return;
    }
    const state = loadIngestState(corpus);
    const added = [];
    for (const mdPath of collectMdFiles(sourcesRoot)) {
      const fm = extractFrontmatter(mdPath);
      const url = typeof fm.source_url === "string" && fm.source_url || typeof fm.url === "string" && fm.url || "";
      if (!url) continue;
      if (state.ingests[url]) continue;
      const rel = relative14(corpus, mdPath);
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
    print(
      `[lorekit ingest reconcile] ${opts.dryRun ? "would add" : "added"} ${added.length} record(s)`
    );
    for (const u of added) print(`  + ${u}`);
    out(JSON.stringify({ dryRun: !!opts.dryRun, added }));
  });
}

// src/commands/sync.ts
import chalk6 from "chalk";
init_logger();

// src/lib/root-index.ts
init_logger();
import { existsSync as existsSync18, readFileSync as readFileSync19, readdirSync as readdirSync9, writeFileSync as writeFileSync8 } from "fs";
import { join as join26 } from "path";
var MANAGED_SECTIONS = [
  { heading: "## \u6982\u5FF5", subdir: "\u77E5\u8BC6\u5E93/\u6982\u5FF5" },
  { heading: "## \u5B9E\u4F53", subdir: "\u77E5\u8BC6\u5E93/\u5B9E\u4F53" },
  { heading: "## \u6458\u8981", subdir: "\u77E5\u8BC6\u5E93/\u6458\u8981" },
  { heading: "## \u4E13\u9898", subdir: "\u77E5\u8BC6\u5E93/\u4E13\u9898" }
];
function listEntriesInDir(corpus, subdir) {
  const dirPath = join26(corpus, subdir);
  if (!existsSync18(dirPath)) return [];
  const out2 = [];
  for (const name of readdirSync9(dirPath)) {
    if (name.startsWith(".")) continue;
    if (name === "_INDEX.md") continue;
    if (!name.endsWith(".md")) continue;
    const file = join26(dirPath, name);
    const slug = `${subdir}/${name.replace(/\.md$/, "")}`;
    out2.push({ slug, summary: extractCompiledTruthSnippet(file) });
  }
  return out2.sort((a, b) => a.slug.localeCompare(b.slug));
}
function extractCompiledTruthSnippet(filePath) {
  let content;
  try {
    content = readFileSync19(filePath, "utf-8");
  } catch (e) {
    debug(`extractCompiledTruthSnippet(${filePath}) failed: ${e.message}`);
    return "\u2014";
  }
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const sectionMatch = body.match(/##\s*Compiled Truth\s*\n+([\s\S]*?)(?=\n---|\n##\s|$)/);
  if (!sectionMatch) return "\u2014";
  const para = sectionMatch[1].split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!para) return "\u2014";
  const cleaned = para.replace(/^\*\*([^*]+)\*\*\s*/, "$1 ");
  const sentenceMatch = cleaned.match(/^(.{1,80}?[。.！？!?])/);
  if (sentenceMatch) return sentenceMatch[1];
  return cleaned.slice(0, 80) + (cleaned.length > 80 ? "\u2026" : "");
}
function mergeSection(content, heading, onDisk) {
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    return { newContent: content, result: { added: [], removed: [], kept: 0 } };
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      endIdx = i;
      break;
    }
  }
  const sectionBody = lines.slice(startIdx + 1, endIdx);
  const linkRe = /^-\s+\[\[([^\]|#]+)[^\]]*\]\]/;
  const onDiskSlugs = new Set(onDisk.map((e) => e.slug));
  const seenInIndex = /* @__PURE__ */ new Set();
  const removed = [];
  const kept = [];
  for (const line of sectionBody) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "\uFF08\u6682\u65E0\u6761\u76EE\uFF09") continue;
    const m = line.match(linkRe);
    if (m) {
      const slug = m[1].trim();
      if (onDiskSlugs.has(slug)) {
        seenInIndex.add(slug);
        kept.push(line);
      } else {
        removed.push(slug);
      }
    } else {
      kept.push(line);
    }
  }
  const added = [];
  for (const e of onDisk) {
    if (!seenInIndex.has(e.slug)) {
      kept.push(`- [[${e.slug}]] \u2014 ${e.summary}`);
      added.push(e.slug);
    }
  }
  const sectionContentLines = kept.length === 0 ? ["", "\uFF08\u6682\u65E0\u6761\u76EE\uFF09", ""] : ["", ...kept, ""];
  const newLines = [
    ...lines.slice(0, startIdx + 1),
    ...sectionContentLines,
    ...lines.slice(endIdx)
  ];
  return {
    newContent: newLines.join("\n"),
    result: { added, removed, kept: seenInIndex.size }
  };
}
function refreshRootIndex(corpus) {
  const indexPath = join26(corpus, "index.md");
  if (!existsSync18(indexPath)) {
    return { filePath: indexPath, changed: false, perSection: [] };
  }
  const before = readFileSync19(indexPath, "utf-8");
  let content = before;
  const perSection = [];
  for (const sec of MANAGED_SECTIONS) {
    const onDisk = listEntriesInDir(corpus, sec.subdir);
    const { newContent, result } = mergeSection(content, sec.heading, onDisk);
    content = newContent;
    perSection.push({ heading: sec.heading, ...result });
  }
  const changed = content !== before;
  if (changed) writeFileSync8(indexPath, content, "utf-8");
  return { filePath: indexPath, changed, perSection };
}

// src/commands/sync.ts
async function runSync(corpus, opts = {}) {
  const force = opts.force ?? false;
  const model = opts.model ?? "bge-m3";
  print(chalk6.cyan("\u2500\u2500 [1/3] index: refresh _INDEX.md \u2500\u2500"));
  try {
    const generated = runIndex(corpus);
    if (generated === 0) {
      warn("no indexable directories found");
    } else {
      ok(`refreshed ${generated} _INDEX.md file(s)`);
    }
  } catch (e) {
    err(`index failed: ${e.message}`);
    throw e;
  }
  if (!opts.skipRootIndex) {
    try {
      const r = refreshRootIndex(corpus);
      const totals = r.perSection.reduce(
        (acc, s) => ({
          added: acc.added + s.added.length,
          removed: acc.removed + s.removed.length,
          kept: acc.kept + s.kept
        }),
        { added: 0, removed: 0, kept: 0 }
      );
      if (!r.changed) {
        ok(`index.md unchanged (${totals.kept} entries across managed sections)`);
      } else {
        ok(
          `index.md merged: +${totals.added} added, -${totals.removed} removed, ${totals.kept} kept`
        );
        for (const s of r.perSection) {
          if (s.added.length === 0 && s.removed.length === 0) continue;
          for (const slug of s.added) print(`    + ${slug}`);
          for (const slug of s.removed) print(`    - ${slug} (file gone)`);
        }
      }
    } catch (e) {
      err(`root index sync failed: ${e.message}`);
      throw e;
    }
  }
  print();
  let shouldRunVector = opts.withVector === true && !opts.skipVector;
  if (!opts.skipVector && !opts.withVector) {
    try {
      const { getStatus: getStatus2 } = await Promise.resolve().then(() => (init_status(), status_exports));
      const status = await getStatus2(corpus);
      shouldRunVector = status.mode === "vector";
      if (!shouldRunVector) {
        warn(`vector skipped: ${status.mode_reason}`);
      }
    } catch (e) {
      warn(`vector skipped: status unavailable (${e.message})`);
      shouldRunVector = false;
    }
  } else if (opts.skipVector) {
    warn("vector skipped: --skip-vector");
  }
  if (shouldRunVector) {
    print(chalk6.cyan("\u2500\u2500 [2/3] vector: sync chunks + L0/L1 \u2500\u2500"));
    try {
      const r = await runVectorSync(corpus, { force, model, layered: true });
      ok(`synced ${r.synced} files (${r.totalChunks} chunks), skipped ${r.skipped} unchanged`);
    } catch (e) {
      err(`vector sync failed: ${e.message}`);
      throw e;
    }
    print();
  }
  if (!opts.skipDoctor) {
    print(chalk6.cyan("\u2500\u2500 [3/3] doctor: sanity check \u2500\u2500"));
    runDoctor(corpus);
  }
}
function syncCommand(program2) {
  program2.command("sync").description("one-shot: refresh _INDEX.md \u2192 vector sync (layered) \u2192 doctor").option("--force", "full rebuild of vector index", false).option("--model <name>", "ollama model name", "bge-m3").option("--skip-doctor", "skip the final doctor sanity check", false).option("--skip-vector", "only refresh _INDEX.md, skip vector sync", false).option("--with-vector", "force vector sync even when text mode is recommended", false).option("--skip-root-index", "skip merging corpus/index.md against disk", false).action(async (opts) => {
    const corpus = requireCorpus();
    try {
      await runSync(corpus, opts);
    } catch {
      process.exit(1);
    }
  });
}

// src/commands/obsidian-tune.ts
init_logger();
import { cpSync as cpSync2, existsSync as existsSync19, mkdirSync as mkdirSync9, writeFileSync as writeFileSync9 } from "fs";
import { join as join27 } from "path";
function runPrint() {
  const cfg = getRecommendedGraphConfig();
  out(JSON.stringify(cfg, null, 2));
}
function runCheck(corpus) {
  const recommended = getRecommendedFilter();
  const cur = readCorpusFilter(corpus);
  if (!cur.exists) {
    warn(".obsidian/graph.json \u7F3A\u5931");
    print("");
    print("\u63A8\u8350 filter\uFF08\u542B _\u5F52\u6863 / \u53CD\u9988 + \u5B8C\u6574\u6839\u5143\u6570\u636E\uFF09:");
    print(`  ${recommended}`);
    print("");
    print("\u5E94\u7528\uFF1Alorekit obsidian-tune --write");
    return 1;
  }
  if (isFilterComplete(cur.search, recommended)) {
    ok(".obsidian/graph.json filter \u5B8C\u6574");
    return 0;
  }
  warn(".obsidian/graph.json filter \u4E0D\u5B8C\u6574");
  print("");
  print("\u5F53\u524D filter\uFF08\u5982\u6709\uFF09:");
  print(`  ${cur.search ?? "(\u7A7A)"}`);
  print("");
  print("\u63A8\u8350 filter\uFF08\u542B _\u5F52\u6863 / \u53CD\u9988 + \u5B8C\u6574\u6839\u5143\u6570\u636E\uFF09:");
  print(`  ${recommended}`);
  print("");
  print("\u7F3A\u5C11\u7684 token:");
  for (const t of missingTokens(cur.search, recommended)) {
    print(`  - ${t}`);
  }
  print("");
  print("\u5E94\u7528\uFF1Alorekit obsidian-tune --write");
  return 1;
}
function runWrite(corpus) {
  const dest = join27(corpus, ".obsidian", "graph.json");
  const destDir = join27(corpus, ".obsidian");
  if (!existsSync19(destDir)) mkdirSync9(destDir, { recursive: true });
  if (existsSync19(dest)) {
    const backup = `${dest}.bak.${tsCompact()}`;
    cpSync2(dest, backup);
    ok(`\u5907\u4EFD .obsidian/graph.json \u2192 ${backup}`);
  }
  const cfg = getRecommendedGraphConfig();
  writeFileSync9(dest, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  ok("\u5199\u5165\u63A8\u8350 filter");
  info("\u8BF7\u5173\u6389 Obsidian\u300C\u5173\u7CFB\u56FE\u8C31\u300D\u6807\u7B7E\u9875\u518D\u91CD\u5F00\u751F\u6548");
  return 0;
}
function obsidianTuneCommand(program2) {
  program2.command("obsidian-tune").description("check / apply recommended Obsidian graph filter for the corpus").option("--write", "apply recommended filter (backs up existing graph.json first)").option("--print", "print recommended graph.json to stdout (pipe-friendly)").action((opts) => {
    if (opts.print) {
      runPrint();
      process.exitCode = 0;
      return;
    }
    const corpus = findCorpus();
    if (!corpus) {
      err("not inside a corpus (no .wiki/ or CLAUDE.md found)");
      process.exitCode = 2;
      return;
    }
    if (opts.write) {
      process.exitCode = runWrite(corpus);
    } else {
      process.exitCode = runCheck(corpus);
    }
  });
}

// src/commands/remove.ts
import { existsSync as existsSync20, mkdirSync as mkdirSync10, readFileSync as readFileSync20, renameSync, writeFileSync as writeFileSync10 } from "fs";
import { basename as basename7, dirname as dirname5, isAbsolute, join as join28, relative as relative15, resolve as resolve3, sep } from "path";
import matter6 from "gray-matter";
import trash from "trash";
init_logger();
function isUrl(input) {
  return /^https?:\/\//i.test(input);
}
function toSlash(p) {
  return p.split(sep).join("/");
}
function stripMd(rel) {
  return rel.replace(/\.md$/, "");
}
function normalizeRel(rel) {
  return toSlash(rel).replace(/^\.\//, "").replace(/\/+/g, "/");
}
function withinCorpus(corpus, abs) {
  const rel = relative15(corpus, abs);
  return rel === "" || !rel.startsWith("..") && !isAbsolute(rel);
}
function resolveInputPath(corpus, input) {
  const candidates = [];
  const rawAbs = isAbsolute(input) ? input : join28(corpus, input);
  candidates.push(rawAbs);
  if (!input.endsWith(".md")) candidates.push(`${rawAbs}.md`);
  for (const candidate of candidates) {
    const abs = resolve3(candidate);
    if (withinCorpus(corpus, abs) && existsSync20(abs)) return abs;
  }
  return null;
}
function relFromAbs(corpus, abs) {
  return normalizeRel(relative15(corpus, abs));
}
function aliasesForRel(rel) {
  const aliases = /* @__PURE__ */ new Set();
  const normalized = normalizeRel(rel);
  aliases.add(stripMd(normalized));
  if (normalized.endsWith("/article.md")) {
    aliases.add(stripMd(normalized).replace(/\/article$/, ""));
  }
  return [...aliases];
}
function readText(abs) {
  return readFileSync20(abs, "utf-8");
}
function extractWikilinks(content) {
  const links = [];
  const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
  let m;
  while ((m = linkRe.exec(content)) !== null) links.push(m[1].trim());
  return links;
}
function addExistingTarget(corpus, targets, relOrAbs, reason) {
  const abs = isAbsolute(relOrAbs) ? relOrAbs : join28(corpus, relOrAbs);
  if (!existsSync20(abs)) return;
  const rel = relFromAbs(corpus, abs);
  targets.set(rel, { rel, abs, reason });
}
function addSourceTarget(corpus, targets, relOrAbs) {
  const abs = isAbsolute(relOrAbs) ? relOrAbs : join28(corpus, relOrAbs);
  if (!existsSync20(abs)) return;
  const rel = relFromAbs(corpus, abs);
  if (rel.endsWith("/article.md")) {
    addExistingTarget(corpus, targets, dirname5(abs), "source");
    return;
  }
  addExistingTarget(corpus, targets, abs, "source");
  if (rel.endsWith(".md")) {
    const assetsDir = abs.replace(/\.md$/, ".assets");
    addExistingTarget(corpus, targets, assetsDir, "source");
  }
}
function sourceCandidatesForSlug(corpus, slug) {
  return [
    join28(corpus, slug),
    join28(corpus, `${slug}.md`),
    join28(corpus, slug, "article.md")
  ];
}
function collectSourceUrls(corpus, targets) {
  const urls = /* @__PURE__ */ new Set();
  for (const target of targets.values()) {
    const files = existsSync20(target.abs) && target.rel.endsWith(".md") ? [target.abs] : collectMdFiles(target.abs);
    for (const file of files) {
      const fm = extractFrontmatter(file);
      if (typeof fm.source_url === "string") urls.add(fm.source_url);
      if (typeof fm.url === "string") urls.add(fm.url);
    }
  }
  return [...urls];
}
function addSourcesFromSummary(corpus, targets, summaryAbs) {
  const parsed = matter6(readText(summaryAbs));
  const sources = Array.isArray(parsed.data.sources) ? parsed.data.sources : [];
  for (const source of sources) {
    if (typeof source !== "string") continue;
    for (const candidate of sourceCandidatesForSlug(corpus, source)) {
      if (existsSync20(candidate)) addSourceTarget(corpus, targets, candidate);
    }
  }
  for (const link of extractWikilinks(parsed.content)) {
    if (!link.startsWith("\u539F\u6599/")) continue;
    for (const candidate of sourceCandidatesForSlug(corpus, link)) {
      if (existsSync20(candidate)) addSourceTarget(corpus, targets, candidate);
    }
  }
}
function addSummariesReferencingSources(corpus, targets, aliases) {
  for (const file of collectMdFiles(join28(corpus, "\u77E5\u8BC6\u5E93", "\u6458\u8981"))) {
    const rel = relFromAbs(corpus, file);
    if (targets.has(rel)) continue;
    const content = readText(file);
    if ([...aliases].some((alias) => content.includes(`[[${alias}`))) {
      addExistingTarget(corpus, targets, file, "summary");
      addSourcesFromSummary(corpus, targets, file);
    }
  }
}
function compiledTruthSnippets(content, aliases, input) {
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const match = body.match(/##\s*Compiled Truth\s*\n+([\s\S]*?)(?=\n##\s|$)/);
  if (!match) return [];
  return match[1].split(/\n{2,}/).map((p) => p.trim()).filter((p) => {
    if (!p) return false;
    if (isUrl(input) && p.includes(input)) return true;
    return [...aliases].some((alias) => p.includes(`[[${alias}`));
  });
}
function rewritePageForRemoval(corpus, file, aliases) {
  const rel = relFromAbs(corpus, file);
  const parsed = matter6(readText(file));
  const removedSources = [];
  let sourceCountBefore;
  let sourceCountAfter;
  if (Array.isArray(parsed.data.sources)) {
    const nextSources = parsed.data.sources.filter((source) => {
      if (typeof source !== "string") return true;
      const remove = aliases.has(stripMd(normalizeRel(source)));
      if (remove) removedSources.push(source);
      return !remove;
    });
    if (removedSources.length > 0) {
      parsed.data.sources = nextSources;
      const rawCount = parsed.data.source_count;
      const numeric = typeof rawCount === "number" ? rawCount : typeof rawCount === "string" ? Number.parseInt(rawCount, 10) : Number.NaN;
      if (Number.isFinite(numeric)) {
        sourceCountBefore = numeric;
        sourceCountAfter = Math.max(0, numeric - new Set(removedSources).size);
        parsed.data.source_count = sourceCountAfter;
      }
      parsed.data.updated = todayYMDShanghai();
    }
  }
  const removedLines = [];
  const nextLines = parsed.content.split("\n").filter((line) => {
    const trimmed = line.trim();
    const hasTargetLink = [...aliases].some((alias) => line.includes(`[[${alias}`));
    const removable = hasTargetLink && /^[-*]\s+/.test(trimmed);
    if (removable) {
      removedLines.push(line);
      return false;
    }
    return true;
  });
  if (removedLines.length > 0) parsed.data.updated = todayYMDShanghai();
  const changed = removedLines.length > 0 || removedSources.length > 0;
  const nextContent = changed ? matter6.stringify(nextLines.join("\n"), parsed.data) : readText(file);
  return {
    nextContent,
    change: changed ? {
      file: rel,
      removedLines,
      removedSources,
      sourceCountBefore,
      sourceCountAfter
    } : null
  };
}
function buildRemovalPlan(corpus, input, apply) {
  const targets = /* @__PURE__ */ new Map();
  const ingestRecords = /* @__PURE__ */ new Set();
  if (isUrl(input)) {
    const state = loadIngestState(corpus);
    const record = state.ingests[input];
    ingestRecords.add(input);
    if (record?.archivedTo) addSourceTarget(corpus, targets, record.archivedTo);
    for (const page of record?.wikiPages ?? []) {
      if (normalizeRel(page).startsWith("\u77E5\u8BC6\u5E93/\u6458\u8981/")) {
        const pageAbs = join28(corpus, page);
        addExistingTarget(corpus, targets, pageAbs, "summary");
        if (existsSync20(pageAbs)) addSourcesFromSummary(corpus, targets, pageAbs);
      }
    }
    const source = findSourceByUrl(corpus, input);
    if (source) addSourceTarget(corpus, targets, source);
  } else {
    const abs = resolveInputPath(corpus, input);
    if (!abs) throw new Error(`target not found inside corpus: ${input}`);
    const rel = relFromAbs(corpus, abs);
    if (rel.startsWith("\u539F\u6599/")) {
      addSourceTarget(corpus, targets, abs);
    } else if (rel.startsWith("\u77E5\u8BC6\u5E93/\u6458\u8981/")) {
      addExistingTarget(corpus, targets, abs, "summary");
      addSourcesFromSummary(corpus, targets, abs);
    } else {
      addExistingTarget(corpus, targets, abs, "target");
    }
  }
  let aliases = new Set([...targets.keys()].flatMap((rel) => aliasesForRel(rel)));
  addSummariesReferencingSources(corpus, targets, aliases);
  aliases = new Set([...targets.keys()].flatMap((rel) => aliasesForRel(rel)));
  for (const url of collectSourceUrls(corpus, targets)) ingestRecords.add(url);
  const trashedRels = new Set(targets.keys());
  const pageChanges = [];
  const reviewItems = [];
  for (const file of collectMdFiles(corpus)) {
    const rel = relFromAbs(corpus, file);
    if (trashedRels.has(rel)) continue;
    if ([...trashedRels].some((targetRel) => rel.startsWith(`${targetRel}/`))) continue;
    const { change } = rewritePageForRemoval(corpus, file, aliases);
    if (change) pageChanges.push(change);
    for (const text of compiledTruthSnippets(readText(file), aliases, input)) {
      reviewItems.push({ file: rel, section: "Compiled Truth", text });
    }
  }
  return {
    input,
    apply,
    trashTargets: [...targets.values()].sort((a, b) => a.rel.localeCompare(b.rel)),
    pageChanges,
    reviewItems,
    ingestRecords: [...ingestRecords],
    aliases: [...aliases].sort()
  };
}
async function moveToTrash(paths) {
  const testTrashDir = process.env.LOREKIT_TEST_TRASH_DIR;
  if (testTrashDir) {
    mkdirSync10(testTrashDir, { recursive: true });
    for (const p of paths) {
      if (!existsSync20(p)) continue;
      const dest = join28(testTrashDir, `${tsCompact()}-${basename7(p)}`);
      renameSync(p, dest);
    }
    return;
  }
  await trash(paths, { glob: false });
}
function applyPageChanges(corpus, plan) {
  const aliases = new Set(plan.aliases);
  for (const change of plan.pageChanges) {
    const file = join28(corpus, change.file);
    const { nextContent } = rewritePageForRemoval(corpus, file, aliases);
    writeFileSync10(file, nextContent, "utf-8");
  }
}
function forgetIngestRecords(corpus, urls) {
  if (urls.length === 0) return;
  const state = loadIngestState(corpus);
  let changed = false;
  for (const url of urls) {
    if (state.ingests[url]) {
      delete state.ingests[url];
      changed = true;
    }
  }
  if (changed) saveIngestState(corpus, state);
}
function printPlan(plan) {
  print(`lorekit remove \u2014 ${plan.apply ? "apply" : "dry-run"}
`);
  print(`\u5C06\u79FB\u52A8\u5230\u7CFB\u7EDF\u56DE\u6536\u7AD9 (${plan.trashTargets.length})`);
  for (const target of plan.trashTargets) {
    print(`  - ${target.rel} (${target.reason})`);
  }
  if (plan.trashTargets.length === 0) print("  - \uFF08\u65E0\uFF09");
  print();
  print(`\u5C06\u4FEE\u6539\u9875\u9762 (${plan.pageChanges.length})`);
  for (const change of plan.pageChanges) {
    print(`  - ${change.file}`);
    if (change.removedSources.length > 0) {
      print(`    sources: -${change.removedSources.length}`);
    }
    if (change.sourceCountBefore !== void 0 && change.sourceCountAfter !== void 0) {
      print(`    source_count: ${change.sourceCountBefore} -> ${change.sourceCountAfter}`);
    }
    if (change.removedLines.length > 0) {
      print(`    lines: -${change.removedLines.length}`);
    }
  }
  if (plan.pageChanges.length === 0) print("  - \uFF08\u65E0\uFF09");
  print();
  if (plan.reviewItems.length > 0) {
    print(`\u9700\u4EBA\u5DE5\u590D\u6838 Compiled Truth (${plan.reviewItems.length})`);
    for (const item of plan.reviewItems) {
      print(`  - ${item.file}: ${item.text.slice(0, 120)}`);
    }
    print();
  }
  if (!plan.apply) {
    print("dry-run only. Run again with --apply to move files to OS Trash.");
  }
}
function removeCommand(program2) {
  program2.command("remove").argument("<target>", "URL or corpus-relative path to remove").option("--apply", "execute the removal; default is dry-run", false).option("--json", "emit a machine-readable JSON report", false).description("safely remove a source/wiki page and provenance-linked references").action(async (target, opts) => {
    const corpus = requireCorpus();
    let plan;
    try {
      plan = buildRemovalPlan(corpus, target, !!opts.apply);
    } catch (e) {
      err(e.message);
      process.exitCode = 2;
      return;
    }
    if (!opts.json) printPlan(plan);
    if (opts.json && !opts.apply) out(JSON.stringify(plan));
    if (!opts.apply) return;
    if (plan.trashTargets.length === 0 && plan.pageChanges.length === 0) {
      bad("nothing to remove");
      process.exitCode = 1;
      if (opts.json) out(JSON.stringify(plan));
      return;
    }
    try {
      const snapshot = await createSnapshot(corpus, { tag: "remove" });
      plan.snapshot = snapshot;
      ok(`snapshot saved: ${snapshot}`);
      applyPageChanges(corpus, plan);
      forgetIngestRecords(corpus, plan.ingestRecords);
      await moveToTrash(plan.trashTargets.map((t) => t.abs));
      ok(`moved ${plan.trashTargets.length} item(s) to OS Trash`);
      const hasVectorDb = existsSync20(join28(corpus, ".wiki", "vector.sqlite"));
      if (hasVectorDb) {
        plan.vectorPruned = await pruneVectorDbMissingFiles(corpus);
        if (plan.vectorPruned > 0) ok(`vector pruned ${plan.vectorPruned} missing file(s)`);
      }
      const skipVector = !hasVectorDb || process.env.LOREKIT_TEST_SKIP_VECTOR_SYNC === "1";
      plan.syncSkippedVector = skipVector;
      await runSync(corpus, { skipVector });
      const issues = runLint(corpus);
      plan.lintIssues = issues.length;
      printLintReport(corpus, issues);
    } catch (e) {
      err(e.message);
      process.exitCode = 1;
    }
    if (opts.json) out(JSON.stringify(plan));
  });
}

// src/commands/source.ts
import { createHash as createHash5 } from "crypto";
import { existsSync as existsSync21 } from "fs";
import { join as join29, relative as relative16 } from "path";
init_logger();
function sha256Text(content) {
  return createHash5("sha256").update(content).digest("hex");
}
function isOlderThanTwoYears(sourceDate) {
  const parsed = sourceDate instanceof Date ? sourceDate : typeof sourceDate === "string" ? /* @__PURE__ */ new Date(`${sourceDate}T00:00:00Z`) : null;
  if (!parsed) return false;
  if (Number.isNaN(parsed.getTime())) return false;
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1e3;
  return Date.now() - parsed.getTime() > twoYearsMs;
}
async function finalizeSource(corpus, inputPath, opts = {}) {
  const abs = inputPath.startsWith("/") ? inputPath : join29(corpus, inputPath);
  if (!existsSync21(abs)) throw new Error(`source file not found: ${inputPath}`);
  const rel = relative16(corpus, abs);
  if (!rel.startsWith("\u539F\u6599/")) {
    throw new Error(`source finalize only accepts files under \u539F\u6599/: ${rel}`);
  }
  const parsed = readMarkdown(abs);
  let changed = false;
  changed = setFieldIfMissing(parsed.data, "slug", rel.replace(/\.md$/, "")) || changed;
  const computed = sha256Text(canonicalMarkdownForHash(parsed.data, parsed.content));
  const current = typeof parsed.data.raw_sha256 === "string" ? parsed.data.raw_sha256 : void 0;
  if (opts.check) {
    return { file: rel, changed: false, raw_sha256: computed, current, ok: current === computed };
  }
  await createSnapshot(corpus, { tag: "source-finalize" });
  if (parsed.data.raw_sha256 !== computed) {
    parsed.data.raw_sha256 = computed;
    changed = true;
  }
  const today2 = dateToYMDLocal(/* @__PURE__ */ new Date());
  if (parsed.data.last_verified !== today2) {
    parsed.data.last_verified = today2;
    changed = true;
  }
  const outdated = isOlderThanTwoYears(parsed.data.source_date);
  if (parsed.data.possibly_outdated !== outdated) {
    parsed.data.possibly_outdated = outdated;
    changed = true;
  }
  if (changed) writeMarkdown(abs, parsed.data, parsed.content);
  return { file: rel, changed, raw_sha256: computed, ok: true };
}
function sourceCommand(program2) {
  const source = program2.command("source").description("manage source files under \u539F\u6599/");
  source.command("finalize <path>").description("write/check source slug + integrity metadata").option("--check", "check raw_sha256 without writing", false).action(async (pathArg, opts) => {
    const corpus = requireCorpus();
    try {
      const result = await finalizeSource(corpus, pathArg, opts);
      if (opts.check) {
        if (result.ok) {
          ok(`source hash ok: ${result.file}`);
        } else {
          bad(`source hash mismatch: ${result.file}`);
          print(`  current: ${result.current ?? "(missing)"}`);
          print(`  computed: ${result.raw_sha256}`);
          process.exitCode = 1;
        }
        return;
      }
      ok(
        `source finalized: ${result.file} ${result.changed ? result.raw_sha256 : "(unchanged)"}`
      );
    } catch (e) {
      bad(e.message);
      process.exitCode = 1;
    }
  });
}

// src/commands/links.ts
import { existsSync as existsSync22, mkdirSync as mkdirSync11, readFileSync as readFileSync21, writeFileSync as writeFileSync11 } from "fs";
import { dirname as dirname6, join as join30, relative as relative17, resolve as resolve4, sep as sep2 } from "path";
init_paths();
init_logger();
function typeDir(type) {
  if (type === "entity") return "\u77E5\u8BC6\u5E93/\u5B9E\u4F53";
  return "\u77E5\u8BC6\u5E93/\u6982\u5FF5";
}
function suggestedPath(label, type = "concept") {
  return `${typeDir(type)}/${labelToSlug(label)}.md`;
}
function targetIsCanonical(label, target) {
  return label === target.slug || label === relStem(target.file);
}
function collectFileOccurrences(corpus, rel) {
  const abs = resolveCorpusFile(corpus, rel);
  if (!existsSync22(abs)) throw new Error(`file not found: ${rel}`);
  const content = readFileSync21(abs, "utf-8");
  return extractWikilinkLabels(content).map((label) => ({ file: rel, label }));
}
function normalizeRelPath(rel) {
  return rel.split(sep2).join("/");
}
function shouldIgnoreFullCorpusOccurrence(occ) {
  const rel = normalizeRelPath(occ.file);
  if (rel.startsWith("_\u5DE5\u4F5C\u53F0/") && rel.includes("/node_modules/")) return true;
  return lintSkipBrokenLinkPrefixes.some((prefix) => rel.startsWith(prefix));
}
function buildLinkSuggestions(corpus, opts = {}) {
  const targets = collectLinkTargets(corpus);
  const grouped = /* @__PURE__ */ new Map();
  const rawOccurrences = opts.file ? collectFileOccurrences(corpus, opts.file) : collectWikilinkOccurrences(corpus);
  const occurrences = opts.file ? rawOccurrences : rawOccurrences.filter((occ) => !shouldIgnoreFullCorpusOccurrence(occ));
  for (const occ of occurrences) {
    (grouped.get(occ.label) ?? grouped.set(occ.label, []).get(occ.label)).push(occ);
  }
  const suggestions = [];
  for (const [label, occurrences2] of grouped) {
    const target = resolveLabel(label, targets);
    if (target && targetIsCanonical(label, target)) continue;
    if (target) {
      suggestions.push({
        label,
        occurrences: occurrences2,
        seenCount: occurrences2.length,
        similarPages: [
          { slug: target.slug, file: target.file, title: target.title, type: target.type }
        ],
        suggestedAction: "fix",
        suggestedPath: `${target.slug}.md`
      });
      continue;
    }
    suggestions.push({
      label,
      occurrences: occurrences2,
      seenCount: occurrences2.length,
      similarPages: [],
      suggestedAction: "stub",
      suggestedPath: suggestedPath(label)
    });
  }
  return suggestions.sort((a, b) => a.label.localeCompare(b.label));
}
function printSuggest(corpus, suggestions) {
  print(`
lorekit links suggest \u2014 ${corpus}
`);
  if (suggestions.length === 0) {
    ok("no link closure suggestions");
    return;
  }
  for (const s of suggestions) {
    print(`- ${s.label}: ${s.suggestedAction} (${s.seenCount} occurrence(s))`);
    if (s.similarPages[0]) print(`  \u2192 ${s.similarPages[0].slug}`);
    else print(`  \u2192 ${s.suggestedPath}`);
  }
}
async function withSnapshot(corpus, tag) {
  await createSnapshot(corpus, { tag });
}
function writeCandidateState(corpus, suggestions) {
  const file = join30(corpus, ".wiki", "link-candidates.json");
  mkdirSync11(dirname6(file), { recursive: true });
  writeFileSync11(
    file,
    JSON.stringify({ version: 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), suggestions }, null, 2) + "\n",
    "utf-8"
  );
}
function resolveCorpusFile(corpus, rel) {
  const abs = resolve4(corpus, rel);
  const fromCorpus = relative17(corpus, abs);
  if (fromCorpus === "" || fromCorpus === ".." || fromCorpus.startsWith(`..${sep2}`)) {
    throw new Error(`file is outside corpus: ${rel}`);
  }
  return abs;
}
async function fixLink(corpus, label, opts) {
  const files = opts.file ? [resolveCorpusFile(corpus, opts.file)] : collectMdFiles(corpus);
  if (opts.file && !existsSync22(files[0])) throw new Error(`file not found: ${opts.file}`);
  const target = resolveLabel(relStem(opts.to), collectLinkTargets(corpus));
  if (!target) throw new Error(`canonical target not found: ${opts.to}`);
  await withSnapshot(corpus, "links-fix");
  let changed = 0;
  for (const filePath of files) {
    const before = readFileSync21(filePath, "utf-8");
    const result = replaceWikilinkLabel(before, label, target.slug, { alias: opts.alias });
    if (result.count === 0) continue;
    writeFileSync11(filePath, result.content, "utf-8");
    changed += result.count;
  }
  return changed;
}
async function stubLink(corpus, label, opts) {
  await withSnapshot(corpus, "links-stub");
  const dir = typeDir(opts.type);
  const rel = suggestedPath(label, opts.type);
  const abs = join30(corpus, rel);
  if (!existsSync22(abs)) {
    mkdirSync11(dirname6(abs), { recursive: true });
    const today2 = dateToYMDLocal(/* @__PURE__ */ new Date());
    const type = opts.type === "entity" ? "entity" : "concept";
    const sourceStem = opts.source ? opts.source.replace(/\.md$/, "") : void 0;
    const timeline = sourceStem ? `- ${today2} | \u5728 [[${sourceStem}]] \u4E2D\u4F5C\u4E3A\u76F8\u5173\u8282\u70B9\u51FA\u73B0\uFF0C\u5F53\u524D\u6765\u6E90\u4E0D\u8DB3\uFF0C\u5F85\u8865\u72EC\u7ACB\u6765\u6E90\u3002` : `- ${today2} | \u7531 links closure \u521B\u5EFA stub\uFF0C\u5F85\u8865\u72EC\u7ACB\u6765\u6E90\u3002`;
    writeFileSync11(
      abs,
      `---
type: ${type}
title: ${label}
slug: ${dir}/${labelToSlug(label)}
created: ${today2}
updated: ${today2}
confidence: low
status: stub
---

# ${label}

## Compiled Truth

${label} \u662F\u5F53\u524D corpus \u4E2D\u51FA\u73B0\u7684\u5F85\u8865\u5145\u8282\u70B9\u3002\u5F53\u524D\u6765\u6E90\u4E0D\u8DB3\uFF0C\u6682\u4E0D\u5199\u6210\u6B63\u5F0F\u7ED3\u8BBA\uFF0C\u7B49\u5F85\u540E\u7EED\u72EC\u7ACB\u6765\u6E90\u8865\u5F3A\u3002

## Timeline

${timeline}
`,
      "utf-8"
    );
  }
  return rel;
}
async function backlogLink(corpus, label, opts) {
  await withSnapshot(corpus, "links-backlog");
  const rel = "\u7CFB\u7EDF/missing-nodes.md";
  const abs = join30(corpus, rel);
  mkdirSync11(dirname6(abs), { recursive: true });
  const today2 = dateToYMDLocal(/* @__PURE__ */ new Date());
  const sourceStem = opts.source ? opts.source.replace(/\.md$/, "") : "(unrecorded)";
  let content = "";
  if (!existsSync22(abs)) {
    content = `---
type: system
title: Missing Nodes
slug: \u7CFB\u7EDF/missing-nodes
created: ${today2}
updated: ${today2}
graph-excluded: true
---

# Missing Nodes

`;
  } else {
    content = readFileSync21(abs, "utf-8");
  }
  if (!content.includes(`- [ ] ${label}
`)) {
    content += `- [ ] ${label}
  - type: ${opts.type}
  - first_seen: ${today2}
  - seen_in: [[${sourceStem}]]
  - suggested_path: ${suggestedPath(label, opts.type)}

`;
    content = content.replace(/^updated: .+$/m, `updated: ${today2}`);
    writeFileSync11(abs, content, "utf-8");
  }
  return rel;
}
async function plainLink(corpus, label, opts) {
  const abs = resolveCorpusFile(corpus, opts.file);
  if (!existsSync22(abs)) throw new Error(`file not found: ${opts.file}`);
  await withSnapshot(corpus, "links-plain");
  const before = readFileSync21(abs, "utf-8");
  const result = plainWikilinkLabel(before, label);
  if (result.count > 0) writeFileSync11(abs, result.content, "utf-8");
  return result.count;
}
function linksCommand(program2) {
  const links = program2.command("links").description("inspect and close wikilink candidates");
  links.command("suggest").description("suggest fixes for non-canonical or unresolved wikilinks").option("--json", "print suggestions as JSON to stdout", false).option("--write-state", "update .wiki/link-candidates.json machine state", false).option("--file <file>", "limit suggestions to one markdown file").action((opts) => {
    const corpus = requireCorpus();
    try {
      const suggestions = buildLinkSuggestions(corpus, opts);
      if (opts.writeState) writeCandidateState(corpus, suggestions);
      if (opts.json) out(JSON.stringify({ suggestions }, null, 2));
      else printSuggest(corpus, suggestions);
      if (suggestions.length > 0) process.exitCode = 1;
    } catch (e) {
      bad(e.message);
      process.exitCode = 1;
    }
  });
  links.command("fix <label>").requiredOption("--to <slug>", "canonical target slug").option("--alias <text>", "visible alias").option("--file <file>", "limit rewrite to one markdown file").description("rewrite wikilinks to an existing canonical page").action(async (label, opts) => {
    const corpus = requireCorpus();
    try {
      const count = await fixLink(corpus, label, opts);
      ok(`rewrote ${count} link(s) for ${label}`);
    } catch (e) {
      bad(e.message);
      process.exitCode = 1;
    }
  });
  links.command("stub <label>").requiredOption("--type <type>", "concept|entity").option("--source <file>", "source file where the node was seen").description("create a low-confidence stub page").action(async (label, opts) => {
    const corpus = requireCorpus();
    const rel = await stubLink(corpus, label, opts);
    ok(`stub ready: ${rel}`);
  });
  links.command("backlog <label>").requiredOption("--type <type>", "concept|entity").option("--source <file>", "source file where the node was seen").description("record a missing node without creating a page").action(async (label, opts) => {
    const corpus = requireCorpus();
    const rel = await backlogLink(corpus, label, opts);
    ok(`backlog updated: ${rel}`);
  });
  links.command("plain <label>").requiredOption("--file <file>", "file to edit").description("downgrade a wikilink label to plain text in one file").action(async (label, opts) => {
    const corpus = requireCorpus();
    try {
      const count = await plainLink(corpus, label, opts);
      ok(`downgraded ${count} link(s) for ${label}`);
    } catch (e) {
      bad(e.message);
      process.exitCode = 1;
    }
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
    try {
      pages = String(collectMdFiles(corpus).length);
    } catch (e) {
      debug(`banner: collectMdFiles failed: ${e.message}`);
    }
    try {
      const dbPath = `${corpus}/.wiki/vector.sqlite`;
      if (existsSync23(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        const cntRow = db.prepare("SELECT COUNT(*) as c FROM documents").get();
        indexed = String(cntRow?.c ?? 0);
        const row = db.prepare("SELECT value FROM meta WHERE key='model'").get();
        model = row?.value ?? "\u2014";
        db.close();
      }
    } catch (e) {
      debug(`banner: vector.sqlite read failed: ${e.message}`);
    }
  }
  const short = corpus && corpus.length > 45 ? "..." + corpus.slice(-42) : corpus ?? "\u2014";
  const B = chalk7.blue;
  const BB = chalk7.blueBright.bold;
  const C = chalk7.cyan;
  const D = chalk7.dim;
  const W = chalk7.white.bold;
  print();
  print(`  ${BB("\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}`);
  print(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551 \u2588\u2588\u2554\u255D\u2588\u2588\u2551\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D")}`);
  print(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  print(`  ${B("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  print(`  ${B("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  print(`  ${D("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D   \u255A\u2550\u255D   ")}`);
  print(`  ${D("Personal LLM Wiki Toolkit")}  ${C(`v${version}`)}`);
  print();
  print(`  ${C("corpus")}  ${short}`);
  print(`  ${C("pages")}   ${pages.padEnd(10)} ${C("indexed")} ${indexed}`);
  if (model !== "\u2014") print(`  ${C("model")}   ${model}`);
  print();
  print(`  ${W("$ lorekit doctor")}    \u5065\u5EB7\u68C0\u67E5`);
  print(`  ${W("$ lorekit fetch")}     \u6293\u53D6\u7F51\u9875`);
  print(`  ${W("$ lorekit search")}    \u641C\u7D22`);
  print(`  ${W("$ lorekit --help")}    \u6240\u6709\u547D\u4EE4`);
  print();
}
var program = new Command();
var ARG_ERROR_CODES = /* @__PURE__ */ new Set([
  "commander.missingArgument",
  "commander.missingMandatoryOptionValue",
  "commander.invalidArgument",
  "commander.invalidOptionArgument",
  "commander.unknownCommand",
  "commander.unknownOption",
  "commander.excessArguments"
]);
program.exitOverride((cmdErr) => {
  if (cmdErr.code === "commander.help" || cmdErr.code === "commander.version" || cmdErr.code === "commander.helpDisplayed") {
    process.exit(0);
  }
  if (ARG_ERROR_CODES.has(cmdErr.code)) {
    process.exit(2);
  }
  process.exit(cmdErr.exitCode || 1);
});
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
syncCommand(program);
obsidianTuneCommand(program);
removeCommand(program);
sourceCommand(program);
linksCommand(program);
if (process.argv.length <= 2) {
  showBanner();
} else {
  program.parse();
}
//# sourceMappingURL=cli.js.map