/**
 * vectordb/build-layered-index.ts — L0/L1 分层索引重建（写路径）
 *
 * 批次 22b strangler fig 第二步：从 src/lib/vectordb.ts copy 出 buildLayeredIndex
 * + 3 个内部 helper（parseIndexSections / parseIndexEntries / findAllIndexFiles）。
 * 原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 职责：
 * - L0: 从 `corpus/index.md` 按 `## section` 切，每段一条 vec_dirs / fts_dirs 行
 * - L1: 从所有 `{dir}/_INDEX.md` 表格行解析，每条目一条 vec_pages / fts_pages 行
 *       （summary 入向量；slug + summary 入 FTS）
 * - 重建是"全量替换"：先 DELETE FROM dir_summaries / vec_dirs / fts_dirs / page_*
 *
 * 依赖 syncFile 已先跑过：因为 L1 用 `slug → doc_id` 映射，doc_id 来自 documents 表
 * （sync 阶段建立）。typical commands/vector.ts sync 流程：collectFiles → syncFile loop
 * → buildLayeredIndex。
 *
 * **23a 改动**：7 处进度提示 `console.log` → `logger.info`（stderr，不污染
 * `lorekit sync | jq` 管道）。findAllIndexFiles 的沉默 catch → `logger.warn` +
 * 注释说明为何可以继续。对应 LEGACY P2-2 / P2-4 vectordb 残留清零。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import matter from 'gray-matter';

import {
  hasAlwaysExcludedDirSegment,
  matchesDirPrefix,
  vectorExcludePrefixes,
} from '../paths.js';
import * as logger from '../../utils/logger.js';
import { float32ToBuffer } from './files.js';
import type { Db } from './schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * embedding 回调签名。inline 同 sync.ts；22e/22f 收尾决定是否上提到 schema.ts。
 */
type EmbedFn = (texts: string[]) => Promise<Float32Array[]>;

// ---------------------------------------------------------------------------
// parseIndexSections — 解析 corpus/index.md 的 ## 分区
// ---------------------------------------------------------------------------

/**
 * 把 `corpus/index.md` 按 `## section name` 切成多段。
 *
 * 仅返回"含至少一行 `- [[xxx]]` 或 `* [[xxx]]` 条目"的分区——纯说明性段（如
 * "## How to use this wiki" 不含 wikilink 列表）会被滤掉，不进 L0 向量。
 *
 * 每段返回：
 * - `name`：section 标题（去 ## 与首尾空白）
 * - `text`：完整段文本（含 `## name` 行 + 后续所有行 join('\n').trim()）
 * - `slugs`：去重后的主 slug 列表（每行 `- [[slug]]` 或 `* [[slug]]` 取 wikilink 第一个）
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

// ---------------------------------------------------------------------------
// parseIndexEntries — 解析 {dir}/_INDEX.md 的表格行
// ---------------------------------------------------------------------------

/**
 * 解析 `{dir}/_INDEX.md` 表格行：`| [[slug]] | summary | updated |`
 * 跳过表头（含"条目"二字）和分隔行（全是 - 和 |）
 */
function parseIndexEntries(content: string): Array<{ slug: string; summary: string }> {
  const lines = content.split('\n');
  const entries: Array<{ slug: string; summary: string }> = [];

  for (const line of lines) {
    if (/^\|\s*条目\s*\|/.test(line)) continue;
    if (/^\|[\s\-|]+\|?\s*$/.test(line)) continue;

    const m = line.match(/^\|\s*\[\[([^\]|#]+?)\]\]\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/);
    if (!m) continue;
    const slug = m[1].trim();
    const summary = m[2].replace(/\\\|/g, '|').trim();
    entries.push({ slug, summary });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// findAllIndexFiles — 递归找所有 _INDEX.md
// ---------------------------------------------------------------------------

/**
 * 递归扫 corpus 找所有 `_INDEX.md`，复用 paths.ts 的 vectorExcludePrefixes 排除规则。
 * 同时跳过 `.` 起头的目录（.git / .wiki / .obsidian 等约定隐藏目录）。
 */
function findAllIndexFiles(corpus: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      // 目录读不到（权限 / 临时被删 / 扫到 symlink 循环）就跳，整体扫描继续。
      logger.warn(`findAllIndexFiles: skip ${dir} (${(e as Error).message})`);
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      const rel = relative(corpus, full);
      if (hasAlwaysExcludedDirSegment(rel)) continue;
      if (vectorExcludePrefixes.some((p) => matchesDirPrefix(rel, p))) continue;

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

// ---------------------------------------------------------------------------
// buildLayeredIndex — L0 + L1 全量重建
// ---------------------------------------------------------------------------

export async function buildLayeredIndex(db: Db, corpus: string, embedFn: EmbedFn): Promise<void> {
  // --- L0: 从 corpus/index.md 按 ## 分区切，每区一条向量 + 一条 FTS ---
  db.prepare('DELETE FROM dir_summaries').run();
  db.prepare('DELETE FROM vec_dirs').run();
  db.prepare('DELETE FROM fts_dirs').run();

  const indexPath = join(corpus, 'index.md');
  if (!existsSync(indexPath)) {
    logger.info('  L0: corpus/index.md not found, skipped');
  } else {
    const raw = readFileSync(indexPath, 'utf-8');
    const { content } = matter(raw);
    const sections = parseIndexSections(content);

    if (sections.length === 0) {
      logger.info('  L0: no sections with entries in index.md, skipped');
    } else {
      const texts = sections.map((s) => s.text);
      const embeddings = await embedFn(texts);

      const insertDir = db.prepare(
        'INSERT INTO dir_summaries (dir_path, summary, embedding, slug_list) VALUES (?, ?, ?, ?)',
      );
      const insertFtsDir = db.prepare('INSERT INTO fts_dirs(rowid, summary) VALUES (?, ?)');
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
      logger.info(
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
    logger.info('  L1: no _INDEX.md found, skipped');
    return;
  }

  const allEntries: Array<{ slug: string; summary: string }> = [];
  for (const f of indexFiles) {
    const raw = readFileSync(f, 'utf-8');
    allEntries.push(...parseIndexEntries(raw));
  }

  if (allEntries.length === 0) {
    logger.info('  L1: no entries parsed from _INDEX.md, skipped');
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
      e.summary && e.summary !== '—' && e.summary !== '（缺少 frontmatter）' ? e.summary : e.slug;
    matched.push({ docId, text, slug: e.slug });
  }

  if (matched.length === 0) {
    logger.info('  L1: no _INDEX.md entries matched documents, skipped');
    return;
  }

  const BATCH = 64;
  const insertPage = db.prepare(
    'INSERT INTO page_summaries (doc_id, summary, embedding) VALUES (?, ?, ?)',
  );
  const insertFtsPage = db.prepare('INSERT INTO fts_pages(rowid, summary) VALUES (?, ?)');
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
  logger.info(msg);
}
