import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
import chalk from 'chalk';
import { requireCorpus, collectMdFiles, extractFrontmatter } from '../lib/corpus.js';
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

// 去掉围栏代码块和行内代码，避免文档里 `[[Page]]` 这类占位符被当作真 wikilink
function stripCodeBlocks(content: string): string {
  content = content.replace(/```[\s\S]*?```/g, '');
  content = content.replace(/`[^`\n]+`/g, '');
  return content;
}

interface LintIssue {
  file: string;
  kind: 'missing-field' | 'broken-link' | 'orphan';
  detail: string;
}

export function runLint(corpus: string): LintIssue[] {
  const files = collectMdFiles(corpus);
  const issues: LintIssue[] = [];

  // Build lookup sets for wikilink resolution
  // Map: base name (no ext) → relative path, and full relative stem → relative path
  const stemSet = new Set<string>();
  const baseNameSet = new Set<string>();
  // Track inbound links per base name / stem for orphan detection
  const inboundLinks = new Set<string>();

  for (const file of files) {
    const rel = relative(corpus, file);
    const stem = rel.replace(/\.md$/, '');
    stemSet.add(stem);
    baseNameSet.add(stem.split('/').pop()!);

    // 文件夹包装式原料：`原料/文章/xxx/article.md` 的规范引用是 `[[原料/文章/xxx]]`
    // 把父目录路径也登记为有效链接目标
    if (stem.endsWith('/article')) {
      const folderStem = stem.replace(/\/article$/, '');
      stemSet.add(folderStem);
      baseNameSet.add(folderStem.split('/').pop()!);
    }
  }

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
    if (shouldSkipBrokenLink(rel)) continue; // 模板占位符不算死链
    for (const target of targets) {
      if (!stemSet.has(target) && !baseNameSet.has(target)) {
        issues.push({
          file: rel,
          kind: 'broken-link',
          detail: `broken link: [[${target}]]`,
        });
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
    orphan: 'orphan pages',
  };

  for (const [kind, items] of Object.entries(grouped)) {
    print(chalk.cyan(`── ${kindLabels[kind] ?? kind} (${items.length}) ──`));
    for (const item of items) {
      bad(`${item.file}: ${item.detail}`);
    }
    print();
  }

  print(chalk.yellow(`${issues.length} issue(s) total\n`));
}

export function lintCommand(program: Command) {
  program
    .command('lint')
    .description('check frontmatter, broken wikilinks, and orphan pages')
    .action(() => {
      const corpus = requireCorpus();
      const issues = runLint(corpus);
      printLintReport(corpus, issues);
      if (issues.length > 0) process.exitCode = 1;
    });
}
