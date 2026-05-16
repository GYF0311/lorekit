/**
 * vectordb/files.ts — 文件发现 + 字节工具 + 页摘要抽取
 *
 * 批次 22a strangler fig 第一步：从 src/lib/vectordb.ts copy 出文件层小工具。
 * 原 vectordb.ts 同名函数仍保留，commands/*.ts 暂未切换，本文件目前未被任何
 * 调用方 import。22f 才切换 dispatcher 并删旧。
 *
 * 职责：
 * - sha256 / float32ToBuffer / distanceToScore：字节层小工具
 * - shouldIndex / collectFiles：基于 paths.ts 规则的 corpus 文件发现
 * - extractPageSummary：从 markdown 文件抽 "title: intro" 形式的页摘要
 *
 * 不依赖 schema.ts（无 db 状态），self-contained 除 paths.ts 与 gray-matter。
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import matter from 'gray-matter';

import {
  hasAlwaysExcludedDirSegment,
  matchesDirPrefix,
  vectorIncludeDirs,
  vectorExcludePrefixes,
  vectorExcludeNames,
} from '../paths.js';

// ---------------------------------------------------------------------------
// 字节层小工具
// ---------------------------------------------------------------------------

/**
 * 文件 SHA-256 hex digest。用于 sync 时判断 `<doc>.path → updated_at` 是否需要
 * 重新计算 embedding（`sha256` 没变就直接复用旧 chunks）。
 */
export function sha256(filePath: string): string {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Float32Array → Buffer 零拷贝转换（共享底层 ArrayBuffer），用于把 embedding
 * 写进 sqlite BLOB 列。
 */
export function float32ToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/**
 * Convert sqlite-vec cosine distance to similarity score.
 * sqlite-vec returns sqrt(2*(1 - cos_sim)), so:
 *   score = 1 - distance^2 / 2
 */
export function distanceToScore(distance: number): number {
  return 1.0 - (distance * distance) / 2.0;
}

// ---------------------------------------------------------------------------
// 文件发现
// ---------------------------------------------------------------------------

/**
 * 判断给定 corpus 相对路径是否应进向量索引。
 *
 * 规则（来自 paths.ts，CONVENTIONS Do Not #11 集中维护）：
 * 1. 文件名命中 `vectorExcludeNames`（如 `_INDEX.md` / `.gitkeep`）→ 跳
 * 2. 非 `.md` → 跳
 * 3. 路径前缀命中 `vectorExcludePrefixes`（如 `_工作台/` / `_归档/`）→ 跳
 * 4. 路径前缀命中 `vectorIncludeDirs`（如 `知识库/` / `原料/`）→ 收
 * 5. 都不命中 → 跳（保守策略：未明确包含的目录不索引）
 */
export function shouldIndex(rel: string): boolean {
  const parts = rel.split('/');
  if (vectorExcludeNames.has(parts[parts.length - 1])) return false;
  if (!rel.endsWith('.md')) return false;
  if (hasAlwaysExcludedDirSegment(rel)) return false;
  for (const prefix of vectorExcludePrefixes) {
    if (matchesDirPrefix(rel, prefix)) return false;
  }
  for (const inc of vectorIncludeDirs) {
    if (matchesDirPrefix(rel, inc)) return true;
  }
  return false;
}

/**
 * 递归收集 corpus 下所有应进索引的 .md 文件，返回排序后的绝对路径列表。
 * 排序保证多次运行得到稳定的 doc_id 顺序，便于 diff debug。
 */
export function collectFiles(corpus: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // 目录读不到（权限 / 临时被删）就跳，整体扫描继续。
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

// ---------------------------------------------------------------------------
// 页摘要
// ---------------------------------------------------------------------------

/**
 * 给一个 markdown 文件抽 "title: intro" 形式的页摘要，用于 page_summaries 向量。
 *
 * title 优先级：frontmatter.title > 第一个 `# heading` > basename(file, '.md')
 *
 * intro 优先级：`## Compiled Truth` 段（lorekit 知识库页约定的核心摘要节）前 200 字
 *               > body 起始前 200 字
 */
export function extractPageSummary(filePath: string): string {
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
