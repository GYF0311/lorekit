/**
 * memory-index.ts — sync `corpus/MEMORY.md`（L0 全局索引）的机械统计区块。
 *
 * MEMORY.md 是 agent 启动注入的 L0 层仪表盘（Karpathy LLM Wiki 模式的扩展），
 * 此前只有模板没有喂数据的执行器，统计一直停在 0。本模块在 `lorekit sync`
 * 里机械刷新三个受控 section：
 *
 *   - ## 统计概览：总页数 / 最近更新（"当前活跃领域"是语义判断，保留原值）
 *   - ## 类型分布：按 type→目录 映射逐目录计数
 *   - ## 最近活跃：知识库 top 5（按 frontmatter updated 降序，缺省回退 mtime）
 *
 * 与 root-index.ts 同款 heading 边界策略：heading 不存在就不动；
 * `## 指针使用说明` 等其余内容一律保留。MEMORY.md 不存在时静默跳过
 * （老 corpus / 极简 corpus 兼容）。
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { collectMdFiles, extractFrontmatter } from './corpus.js';
import { debug } from '../utils/logger.js';

const TYPE_ROWS: { type: string; dir: string }[] = [
  { type: 'concept', dir: '知识库/概念' },
  { type: 'entity', dir: '知识库/实体' },
  { type: 'summary', dir: '知识库/摘要' },
  { type: 'topic', dir: '知识库/专题' },
  { type: 'source', dir: '原料' },
  { type: 'daily', dir: '每日' },
  { type: 'writing', dir: '写作' },
];

const RECENT_LIMIT = 5;

function fmDateString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const m = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  return null;
}

interface RecentEntry {
  slug: string;
  updated: string;
}

function collectStats(corpus: string): {
  rows: { type: string; dir: string; count: number }[];
  total: number;
  latest: string | null;
  recent: RecentEntry[];
} {
  const rows = TYPE_ROWS.filter((r) => existsSync(join(corpus, r.dir))).map((r) => ({
    ...r,
    count: collectMdFiles(join(corpus, r.dir)).length,
  }));
  const total = rows.reduce((acc, r) => acc + r.count, 0);

  // 最近更新 / 最近活跃只看 知识库/（L0 关心的是 canonical 层），模板除外
  const knowledgeDir = join(corpus, '知识库');
  const pages: RecentEntry[] = [];
  if (existsSync(knowledgeDir)) {
    for (const file of collectMdFiles(knowledgeDir)) {
      const rel = relative(corpus, file);
      if (rel.startsWith('知识库/模板/')) continue;
      let updated: string | null = null;
      try {
        updated = fmDateString(extractFrontmatter(file).updated);
      } catch (e) {
        debug(`memory-index: frontmatter parse failed for ${rel}: ${(e as Error).message}`);
      }
      if (!updated) {
        try {
          updated = statSync(file).mtime.toISOString().slice(0, 10);
        } catch {
          continue;
        }
      }
      pages.push({ slug: rel.replace(/\.md$/, ''), updated });
    }
  }
  pages.sort((a, b) => b.updated.localeCompare(a.updated) || a.slug.localeCompare(b.slug));

  return {
    rows,
    total,
    latest: pages[0]?.updated ?? null,
    recent: pages.slice(0, RECENT_LIMIT),
  };
}

/** 替换 heading 与下一个 `## ` 之间的正文；heading 不存在则原样返回 */
function replaceSection(content: string, heading: string, bodyLines: string[]): string {
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) return content;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      endIdx = i;
      break;
    }
  }
  return [...lines.slice(0, startIdx + 1), '', ...bodyLines, '', ...lines.slice(endIdx)].join('\n');
}

export interface MemoryIndexSyncResult {
  filePath: string;
  exists: boolean;
  changed: boolean;
  total: number;
}

export function refreshMemoryIndex(corpus: string): MemoryIndexSyncResult {
  const filePath = join(corpus, 'MEMORY.md');
  if (!existsSync(filePath)) {
    return { filePath, exists: false, changed: false, total: 0 };
  }

  const before = readFileSync(filePath, 'utf-8');
  const stats = collectStats(corpus);

  // "当前活跃领域"是语义字段，机械刷新时保留原值
  const activeDomain = before.match(/当前活跃领域[：:]\s*(.*)/)?.[1]?.trim() || '—';

  let content = before;
  content = replaceSection(content, '## 统计概览', [
    `- 总页数：${stats.total}`,
    `- 最近更新：${stats.latest ?? '—'}`,
    `- 当前活跃领域：${activeDomain}`,
  ]);
  content = replaceSection(content, '## 类型分布', [
    '| 类型 | 数量 | 入口 |',
    '|---|---|---|',
    ...stats.rows.map((r) => `| ${r.type} | ${r.count} | \`${r.dir}/_INDEX.md\` |`),
  ]);
  content = replaceSection(
    content,
    '## 最近活跃',
    stats.recent.length === 0
      ? ['- —']
      : stats.recent.map((e) => `- [[${e.slug}]] — ${e.updated}`),
  );

  const changed = content !== before;
  if (changed) writeFileSync(filePath, content, 'utf-8');

  return { filePath, exists: true, changed, total: stats.total };
}
