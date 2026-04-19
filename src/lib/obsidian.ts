/**
 * obsidian.ts — Obsidian graph filter SSOT helper（批次 26）
 *
 * 推荐 filter 的单一事实源是 `templates/default-corpus/.obsidian/graph.json`。
 * obsidian-tune 命令与 doctor 集成都从这里读，避免和模板漂移。
 *
 * filter 完整性判断采用"包含所有推荐 token"——用户可能加了自己的
 * colorGroups / 额外 filter，只要把推荐项都覆盖到就算 OK，不要求完全相等。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lorekitRoot } from '../utils/fs.js';

export interface GraphConfig {
  search?: string;
  showTags?: boolean;
  showAttachments?: boolean;
  hideUnresolved?: boolean;
  showOrphans?: boolean;
  [key: string]: unknown;
}

export interface CorpusFilterReadResult {
  exists: boolean;
  search?: string;
  raw?: GraphConfig;
}

/** 模板里的推荐 graph.json（完整对象）。读不到会 throw —— 模板属于包发布产物 */
export function getRecommendedGraphConfig(): GraphConfig {
  const tpl = join(lorekitRoot(), 'templates', 'default-corpus', '.obsidian', 'graph.json');
  const raw = readFileSync(tpl, 'utf-8');
  return JSON.parse(raw) as GraphConfig;
}

/** 推荐 filter 的 search 字符串（SSOT） */
export function getRecommendedFilter(): string {
  const cfg = getRecommendedGraphConfig();
  return cfg.search ?? '';
}

/** 读 corpus 内的 .obsidian/graph.json。不存在不抛错，返回 exists=false */
export function readCorpusFilter(corpus: string): CorpusFilterReadResult {
  const dest = join(corpus, '.obsidian', 'graph.json');
  if (!existsSync(dest)) return { exists: false };
  try {
    const raw = readFileSync(dest, 'utf-8');
    const parsed = JSON.parse(raw) as GraphConfig;
    return { exists: true, search: parsed.search, raw: parsed };
  } catch {
    // JSON 损坏视为存在但 filter 不可读 —— 当作 search 缺失处理
    return { exists: true, search: undefined };
  }
}

/**
 * 把 search 字符串拆 token（按空白）。
 * Obsidian search 语法 token 形如 `-path:"_工作台"` / `-file:"_INDEX"`，
 * 引号内含中文也安全：split 走简单空白，引号内不会含空白。
 */
function tokenize(search: string): string[] {
  return search
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 完整性判断：actual 必须包含 recommended 拆出的全部 token（顺序无关、可有额外项）。
 * actual 缺失 / 空字符串都视为不完整。
 */
export function isFilterComplete(actual: string | undefined, recommended: string): boolean {
  if (!actual) return false;
  const want = new Set(tokenize(recommended));
  const have = new Set(tokenize(actual));
  for (const t of want) {
    if (!have.has(t)) return false;
  }
  return true;
}

/** 列出 actual 缺少哪些推荐 token（用于 diff 输出） */
export function missingTokens(actual: string | undefined, recommended: string): string[] {
  const have = new Set(actual ? tokenize(actual) : []);
  return tokenize(recommended).filter((t) => !have.has(t));
}
