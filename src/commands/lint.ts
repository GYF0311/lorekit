import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { relative, basename, join } from 'node:path';
import chalk from 'chalk';
import { requireCorpus, collectMdFiles, extractFrontmatter } from '../lib/corpus.js';
import { readMarkdown, writeMarkdown } from '../lib/frontmatter-write.js';
import { extractWikilinkLabels } from '../lib/wikilinks.js';
import { createSnapshot } from './snapshot.js';
import {
  lintSkipFrontmatterBasenames,
  lintRootOnlySkipBasenames,
  lintSkipOrphanPrefixes,
  lintSkipFrontmatterPrefixes,
  lintSkipBrokenLinkPrefixes,
} from '../lib/paths.js';
import { bad, ok, print, out } from '../utils/logger.js';

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

interface LintIssue {
  file: string;
  kind: 'missing-field' | 'broken-link' | 'orphan';
  detail: string;
}

interface LintPlanItem extends LintIssue {
  action: string;
}

interface LintPlan {
  issues: LintIssue[];
  safe: LintPlanItem[];
  needsDecision: LintPlanItem[];
  ignored: LintPlanItem[];
  dangerous: LintPlanItem[];
}

function isWorkbenchNodeModules(rel: string): boolean {
  return rel.startsWith('_工作台/') && rel.includes('/node_modules/');
}

export function runLint(corpus: string): LintIssue[] {
  return runLintPlan(corpus).issues;
}

export function runLintPlan(corpus: string): LintPlan {
  const files = collectMdFiles(corpus);
  const issues: LintIssue[] = [];
  const ignored: LintPlanItem[] = [];

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
    const fm = extractFrontmatter(file);
    if (typeof fm.title === 'string' && fm.title) baseNameSet.add(fm.title);
    if (Array.isArray(fm.aliases)) {
      for (const alias of fm.aliases) {
        if (typeof alias === 'string' && alias) baseNameSet.add(alias);
      }
    }

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
      const content = readFileSync(file, 'utf-8');
      const targets: string[] = [];
      for (const target of extractWikilinkLabels(content)) {
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
        if (isWorkbenchNodeModules(rel)) {
          ignored.push({
            file: rel,
            kind: 'broken-link',
            detail: `broken link: [[${target}]]`,
            action: 'ignore-by-policy',
          });
          continue;
        }
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

  const safe: LintPlanItem[] = [];
  const needsDecision: LintPlanItem[] = [];
  const dangerous: LintPlanItem[] = [];

  for (const issue of issues) {
    if (
      issue.kind === 'missing-field' &&
      issue.detail === 'missing frontmatter field: slug' &&
      issue.file.startsWith('原料/')
    ) {
      safe.push({ ...issue, action: 'add-slug' });
    } else if (issue.kind === 'broken-link') {
      needsDecision.push({ ...issue, action: 'links-closure' });
    } else if (issue.kind === 'missing-field') {
      dangerous.push({ ...issue, action: 'manual-frontmatter' });
    } else {
      needsDecision.push({ ...issue, action: 'review' });
    }
  }

  return { issues, safe, needsDecision, ignored, dangerous };
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

function printLintPlan(corpus: string, plan: LintPlan): void {
  print(chalk.bold(`\nlorekit lint plan — ${corpus}\n`));
  const groups: [string, LintPlanItem[]][] = [
    ['Safe fixes', plan.safe],
    ['Needs decision', plan.needsDecision],
    ['Ignored', plan.ignored],
    ['Dangerous', plan.dangerous],
  ];
  for (const [label, items] of groups) {
    print(chalk.cyan(`── ${label} (${items.length}) ──`));
    for (const item of items) {
      print(`- ${item.file}: ${item.detail} → ${item.action}`);
    }
    print();
  }
}

async function applySafeFixes(corpus: string, plan: LintPlan): Promise<number> {
  const fixes = plan.safe.filter((item) => item.action === 'add-slug');
  if (fixes.length === 0) return 0;
  await createSnapshot(corpus, { tag: 'lint-safe' });
  for (const fix of fixes) {
    const filePath = join(corpus, fix.file);
    const parsed = readMarkdown(filePath);
    if (!parsed.data.slug) {
      parsed.data.slug = fix.file.replace(/\.md$/, '');
      writeMarkdown(filePath, parsed.data, parsed.content);
    }
  }
  return fixes.length;
}

export function lintCommand(program: Command) {
  const lint = program
    .command('lint')
    .description('check frontmatter, broken wikilinks, and orphan pages')
    .option('--json', 'print issues as JSON to stdout', false)
    .action((opts: { json?: boolean }) => {
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

  lint
    .command('plan')
    .description('group lint issues by fix strategy')
    .option('--json', 'print plan as JSON to stdout', false)
    .action((opts: { json?: boolean }, command: Command) => {
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

  lint
    .command('fix')
    .description('apply lint fixes')
    .option('--safe', 'only apply deterministic safe fixes', false)
    .action(async (opts: { safe?: boolean }) => {
      const corpus = requireCorpus();
      if (!opts.safe) {
        bad('only --safe is supported');
        process.exitCode = 2;
        return;
      }
      const plan = runLintPlan(corpus);
      const count = await applySafeFixes(corpus, plan);
      ok(`applied ${count} safe fix(es)`);
    });
}
