import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
import chalk from 'chalk';
import { requireCorpus, collectMdFiles, extractFrontmatter } from '../lib/corpus.js';
import { buildWikiLinkIndex, resolveWikiLink } from '../lib/wikilinks.js';
import { MISSING_NODES_REL, readBacklogLabels } from '../lib/missing-nodes.js';
import {
  lintSkipFrontmatterBasenames,
  lintRootOnlySkipBasenames,
  lintSkipOrphanPrefixes,
  lintSkipFrontmatterPrefixes,
  lintSkipBrokenLinkPrefixes,
} from '../lib/paths.js';
import { bad, ok, print } from '../utils/logger.js';

const REQUIRED_FIELDS = ['type', 'title', 'slug', 'created', 'updated'] as const;

function isRootLevel(rel: string): boolean {
  return !rel.includes('/');
}

function shouldSkipFrontmatter(rel: string): boolean {
  const base = basename(rel);
  if (lintSkipFrontmatterBasenames.has(base)) return true;
  if (isRootLevel(rel) && lintRootOnlySkipBasenames.has(base)) return true;
  for (const prefix of lintSkipFrontmatterPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}

function shouldSkipOrphan(rel: string): boolean {
  const base = basename(rel);
  if (lintSkipFrontmatterBasenames.has(base)) return true;
  if (isRootLevel(rel) && lintRootOnlySkipBasenames.has(base)) return true;
  for (const prefix of lintSkipOrphanPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}

function shouldSkipBrokenLink(rel: string): boolean {
  for (const prefix of lintSkipBrokenLinkPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}

// 系统隔离：frontmatter `graph-excluded: true` 的页面不入 Obsidian 图谱，
// 所以也不应被 orphan 检查报"无入链"。典型：QUESTIONS.md / overview.md / 输出/*
function isGraphExcluded(fm: Record<string, unknown>): boolean {
  return fm['graph-excluded'] === true || fm['graph_excluded'] === true;
}

const FRONTMATTER_SOURCE_KEYS = new Set([
  'source',
  'sources',
  'source_path',
  'source_paths',
  'source_file',
  'source_files',
  'source_page',
  'source_pages',
  'source_ref',
  'source_refs',
]);

function collectStringValues(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, acc);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStringValues(item, acc);
    }
  }
  return acc;
}

function normalizeSourceRef(ref: string): string {
  const trimmed = ref.trim();
  const wikilink = trimmed.match(/^\[\[([^\]|#]+)[^\]]*\]\]$/);
  return (wikilink ? wikilink[1] : trimmed).replace(/^\.?\//, '');
}

function frontmatterWorkbenchRefs(fm: Record<string, unknown>): string[] {
  const refs: string[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (!FRONTMATTER_SOURCE_KEYS.has(key)) continue;
    for (const raw of collectStringValues(value)) {
      const ref = normalizeSourceRef(raw);
      if (ref === '_工作台' || ref.startsWith('_工作台/')) refs.push(ref);
    }
  }
  return refs;
}

// 去掉围栏代码块和行内代码，避免文档里 `[[Page]]` 这类占位符被当作真 wikilink
function stripCodeBlocks(content: string): string {
  content = content.replace(/```[\s\S]*?```/g, '');
  content = content.replace(/`[^`\n]+`/g, '');
  return content;
}

interface LintIssue {
  file: string;
  kind:
    | 'missing-field'
    | 'broken-link'
    | 'backlogged-link'
    | 'orphan'
    | 'workbench-source-link'
    | 'stale-review';
  detail: string;
}

// 软性提示，不计入失败：
//   - backlogged-link：已登记 missing-nodes 的已知待建节点
//   - stale-review：复审窗口到期，是"该复核了"的提醒，不是结构错误
const SOFT_ISSUE_KINDS: ReadonlySet<string> = new Set(['backlogged-link', 'stale-review']);

export function countHardLintIssues(issues: LintIssue[]): number {
  return issues.filter((i) => !SOFT_ISSUE_KINDS.has(i.kind)).length;
}

// ---------------------------------------------------------------------------
// stale-review：domain_volatility + last_reviewed 复审窗口检查
// （schema 见 templates/default-corpus 与 wiki-lint skill；此前只有蓝图无执行器）
// ---------------------------------------------------------------------------

const REVIEW_WINDOW_DAYS: Record<string, number> = { high: 90, medium: 180, low: 365 };

function parseFmDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const m = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
    if (m) {
      const d = new Date(m[0]);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function checkStaleReview(rel: string, fm: Record<string, unknown>, now: Date): LintIssue | null {
  const volatility = typeof fm.domain_volatility === 'string' ? fm.domain_volatility.trim() : '';
  const windowDays = REVIEW_WINDOW_DAYS[volatility];
  if (!windowDays) return null; // 无字段或占位符（如模板的 {{...}}）都不检查

  // last_reviewed 缺失时回退 updated：页面被实质更新也算一次"看过"
  const reviewed = parseFmDate(fm.last_reviewed) ?? parseFmDate(fm.updated);
  if (!reviewed) return null;

  const elapsedDays = Math.floor((now.getTime() - reviewed.getTime()) / 86_400_000);
  if (elapsedDays <= windowDays) return null;

  return {
    file: rel,
    kind: 'stale-review',
    detail: `review overdue: volatility=${volatility} window=${windowDays}d last check ${elapsedDays}d ago`,
  };
}

export function runLint(corpus: string): LintIssue[] {
  const files = collectMdFiles(corpus);
  const issues: LintIssue[] = [];
  const now = new Date();

  // 共享的 wikilink 解析索引（与 ingest check / links suggest 同源，见 src/lib/wikilinks.ts）。
  const linkIndex = buildWikiLinkIndex(corpus, files);
  // `links backlog` 登记过的待建节点（见 src/lib/missing-nodes.ts）。
  const backlogLabels = readBacklogLabels(corpus);
  // Track inbound links per base name / stem for orphan detection
  const inboundLinks = new Set<string>();

  // Pass 1: frontmatter + collect wikilinks
  const fileLinks = new Map<string, string[]>();
  const fileFrontmatter = new Map<string, Record<string, unknown>>();

  for (const file of files) {
    const rel = relative(corpus, file);

    // 总是提取 fm 存起来（Pass 3 orphan 检查用 graph-excluded 判断）
    let fm: Record<string, unknown> = {};
    try {
      fm = extractFrontmatter(file);
    } catch {
      /* 无 frontmatter / 读不到都按空对象处理 */
    }
    fileFrontmatter.set(rel, fm);

    // Check required frontmatter fields (skip top-level config/index files)
    if (!shouldSkipFrontmatter(rel)) {
      for (const field of REQUIRED_FIELDS) {
        if (!fm[field]) {
          issues.push({
            file: rel,
            kind: 'missing-field',
            detail: `missing frontmatter field: ${field}`,
          });
        }
      }
    }

    // stale-review：复审窗口到期提醒（软性，不计入失败）
    const stale = checkStaleReview(rel, fm, now);
    if (stale) issues.push(stale);

    // Extract wikilinks (ignore matches inside code blocks)
    try {
      const content = stripCodeBlocks(readFileSync(file, 'utf-8'));
      const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
      const targets: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(content)) !== null) {
        const target = m[1].trim();
        targets.push(target);
        inboundLinks.add(target);
      }
      fileLinks.set(rel, targets);
    } catch {
      /* skip unreadable files */
    }
  }

  // Pass 2: broken links
  for (const [rel, targets] of fileLinks) {
    if (rel.startsWith('知识库/')) {
      const fm = fileFrontmatter.get(rel) ?? {};
      for (const ref of frontmatterWorkbenchRefs(fm)) {
        issues.push({
          file: rel,
          kind: 'workbench-source-link',
          detail: `knowledge page frontmatter cites process workbench as source: ${ref}`,
        });
      }

      for (const target of targets) {
        if (target === '_工作台' || target.startsWith('_工作台/')) {
          issues.push({
            file: rel,
            kind: 'workbench-source-link',
            detail: `knowledge page links process workbench as source: [[${target}]]`,
          });
        }
      }
    }

    if (shouldSkipBrokenLink(rel)) continue; // 模板占位符不算死链
    for (const target of targets) {
      if (!resolveWikiLink(rel, target, linkIndex)) {
        // backlog 闭环：已登记 missing-nodes 的待建节点降级为提示，建页删行后恢复正常检测
        if (backlogLabels.has(target)) {
          issues.push({
            file: rel,
            kind: 'backlogged-link',
            detail: `backlogged link: [[${target}]] (recorded in ${MISSING_NODES_REL})`,
          });
        } else {
          issues.push({
            file: rel,
            kind: 'broken-link',
            detail: `broken link: [[${target}]]`,
          });
        }
      }
    }
  }

  // Pass 3: orphan pages (no inbound links)
  for (const file of files) {
    const rel = relative(corpus, file);
    if (shouldSkipOrphan(rel)) continue;

    // graph-excluded 系统文件（QUESTIONS.md / overview.md / 输出/* 等）不入 Obsidian 图谱，
    // 天然"无入链"合理，不应报 orphan
    const fm = fileFrontmatter.get(rel) ?? {};
    if (isGraphExcluded(fm)) continue;

    const stem = rel.replace(/\.md$/, '');
    const baseName = stem.split('/').pop()!;

    let hasInbound = inboundLinks.has(stem) || inboundLinks.has(baseName);

    // 文件夹包装式原料：父目录形式的引用也算入链
    if (!hasInbound && stem.endsWith('/article')) {
      const folderStem = stem.replace(/\/article$/, '');
      const folderName = folderStem.split('/').pop()!;
      hasInbound = inboundLinks.has(folderStem) || inboundLinks.has(folderName);
    }

    if (!hasInbound) {
      issues.push({
        file: rel,
        kind: 'orphan',
        detail: 'orphan page (no inbound links)',
      });
    }
  }

  return issues;
}

export function printLintReport(corpus: string, issues: LintIssue[]): void {
  print(chalk.bold(`\nlorekit lint — ${corpus}\n`));

  if (issues.length === 0) {
    ok('no issues found');
    print();
    return;
  }

  // Group by kind
  const grouped: Record<string, LintIssue[]> = {};
  for (const issue of issues) {
    (grouped[issue.kind] ??= []).push(issue);
  }

  const kindLabels: Record<string, string> = {
    'missing-field': 'frontmatter',
    'broken-link': 'broken links',
    'backlogged-link': 'backlogged links (known missing, not counted)',
    'workbench-source-link': 'workbench source links',
    'stale-review': 'stale reviews (review window exceeded, not counted)',
    orphan: 'orphan pages',
  };

  for (const [kind, items] of Object.entries(grouped)) {
    print(chalk.cyan(`── ${kindLabels[kind] ?? kind} (${items.length}) ──`));
    for (const item of items) {
      if (SOFT_ISSUE_KINDS.has(kind)) print(chalk.dim(`  ${item.file}: ${item.detail}`));
      else bad(`${item.file}: ${item.detail}`);
    }
    print();
  }

  const hard = countHardLintIssues(issues);
  const soft = issues.length - hard;
  if (hard === 0) {
    ok(`no hard issues (${soft} soft notice(s): backlogged links / stale reviews)`);
    print();
  } else {
    const suffix = soft > 0 ? ` (+${soft} soft notice(s), not counted)` : '';
    print(chalk.yellow(`${hard} issue(s) total${suffix}\n`));
  }
}

export function lintCommand(program: Command) {
  program
    .command('lint')
    .description('check frontmatter, broken wikilinks, orphan pages, and stale reviews')
    .option('--quick', 'compatibility alias for the default lint scan', false)
    .action(() => {
      const corpus = requireCorpus();
      const issues = runLint(corpus);
      printLintReport(corpus, issues);
      if (countHardLintIssues(issues) > 0) process.exitCode = 1;
    });
}
