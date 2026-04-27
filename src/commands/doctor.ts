import type { Command } from 'commander';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import chalk from 'chalk';
import { ok, bad, warn, print, out } from '../utils/logger.js';
import { requireCorpus, collectMdFiles, hasFrontmatter } from '../lib/corpus.js';
import {
  isIndexExcluded,
  isFolderPackage,
  lintRootOnlySkipBasenames,
  lintSkipFrontmatterBasenames,
  lintSkipFrontmatterPrefixes,
} from '../lib/paths.js';
import {
  getRecommendedFilter,
  readCorpusFilter,
  isFilterComplete,
} from '../lib/obsidian.js';

const EXPECTED_DIRS = [
  '每日',
  '知识库/实体',
  '知识库/概念',
  '知识库/专题',
  '原料',
  '原料/录音',
  '写作',
  '系统',
  '_工作台',
];

function isRootLevel(rel: string): boolean {
  return !rel.includes('/');
}

function shouldCountForFrontmatterCoverage(rel: string): boolean {
  const base = rel.split('/').pop() ?? rel;
  if (lintSkipFrontmatterBasenames.has(base)) return false;
  if (isRootLevel(rel) && lintRootOnlySkipBasenames.has(base)) return false;
  for (const prefix of lintSkipFrontmatterPrefixes) {
    if (rel.startsWith(prefix)) return false;
  }
  return true;
}

export interface DoctorFinding {
  id: string;
  severity: 'issue' | 'warning';
  message: string;
}

export interface DoctorReport {
  corpus: string;
  issues: DoctorFinding[];
  warnings: DoctorFinding[];
  summary: { issues: number; warnings: number; status: 'ok' | 'warning' | 'issue' };
}

function checkDirs(corpus: string, quiet = false): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  for (const dir of EXPECTED_DIRS) {
    const full = join(corpus, dir);
    if (existsSync(full)) {
      if (!quiet) ok(`${dir}/`);
    } else {
      const message = `${dir}/ missing`;
      if (!quiet) bad(`${dir}/ ${chalk.dim('missing')}`);
      findings.push({ id: 'missing-dir', severity: 'issue', message });
    }
  }
  return findings;
}

function checkWikiVersion(corpus: string, quiet = false): DoctorFinding[] {
  const versionFile = join(corpus, '.wiki', 'version');
  if (existsSync(versionFile)) {
    const ver = readFileSync(versionFile, 'utf-8').trim();
    if (!quiet) ok(`.wiki/version → ${ver}`);
    return [];
  }
  if (!quiet) bad('.wiki/version missing');
  return [{ id: 'missing-wiki-version', severity: 'issue', message: '.wiki/version missing' }];
}

function checkFrontmatterCoverage(corpus: string, quiet = false): DoctorFinding[] {
  const files = collectMdFiles(corpus).filter((f) =>
    shouldCountForFrontmatterCoverage(relative(corpus, f)),
  );
  const withFm = files.filter((f) => hasFrontmatter(f)).length;
  const total = files.length;
  const pct = total === 0 ? 100 : Math.round((withFm / total) * 100);

  const color = pct >= 90 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
  const icon = pct >= 90 ? '✓' : pct >= 60 ? '⚠' : '✗';
  if (!quiet) print(`${color(icon)} frontmatter coverage: ${withFm}/${total} (${pct}%)`);
  if (pct >= 90) return [];
  return [
    {
      id: 'frontmatter-coverage',
      severity: 'warning',
      message: `frontmatter coverage: ${withFm}/${total} (${pct}%)`,
    },
  ];
}

function checkIndexFiles(corpus: string, quiet = false): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (!entry.isDirectory()) continue;

      const full = join(dir, entry.name);
      const rel = relative(corpus, full);

      // 复用 index 命令的排除规则：不对这些目录要求 _INDEX.md
      if (isIndexExcluded(rel)) continue;
      // 目录包装式原料（xxx/article.md）是一个 entry，不是容器——不需要 _INDEX.md
      if (isFolderPackage(full)) continue;

      // 本目录是否应该有 _INDEX.md：
      //   有直接 .md 文件 或 有目录包装式原料子目录
      let shouldHaveIndex = false;
      for (const name of readdirSync(full)) {
        if (name.startsWith('.')) continue;
        if (name === '_INDEX.md' || name === '.gitkeep') continue;
        const childPath = join(full, name);
        let stat;
        try {
          stat = lstatSync(childPath);
        } catch {
          continue;
        }
        if (stat.isFile() && name.endsWith('.md')) {
          shouldHaveIndex = true;
          break;
        }
        if (stat.isDirectory() && isFolderPackage(childPath)) {
          shouldHaveIndex = true;
          break;
        }
      }

      if (shouldHaveIndex && !existsSync(join(full, '_INDEX.md'))) {
        if (!quiet) warn(`_INDEX.md missing in ${rel}/`);
        findings.push({
          id: 'missing-dir-index',
          severity: 'issue',
          message: `_INDEX.md missing in ${rel}/`,
        });
      }
      walk(full);
    }
  }

  walk(corpus);
  if (findings.length === 0) {
    if (!quiet) ok('all directories with .md files have _INDEX.md');
  }
  return findings;
}

/**
 * 检查 .obsidian/graph.json filter 是否含推荐项（批次 26 触达老用户）。
 * obsidian 是可选用途，不阻塞 doctor 整体绿 —— 故意不计入 issues 总数。
 */
function checkObsidianGraph(corpus: string, quiet = false): DoctorFinding[] {
  try {
    const recommended = getRecommendedFilter();
    const cur = readCorpusFilter(corpus);
    if (!cur.exists) {
      if (!quiet) warn('obsidian: graph filter 不完整，运行 lorekit obsidian-tune 查看详情');
      return [
        {
          id: 'obsidian-filter',
          severity: 'warning',
          message: 'obsidian graph filter missing or incomplete',
        },
      ];
    }
    if (isFilterComplete(cur.search, recommended)) {
      if (!quiet) ok('obsidian: graph filter 完整');
      return [];
    } else {
      if (!quiet) warn('obsidian: graph filter 不完整，运行 lorekit obsidian-tune 查看详情');
      return [
        {
          id: 'obsidian-filter',
          severity: 'warning',
          message: 'obsidian graph filter missing recommended excludes',
        },
      ];
    }
  } catch (e) {
    // 模板缺失或读失败：不阻塞 doctor 主流程，给个 warn
    if (!quiet) warn(`obsidian: 检查 graph filter 失败: ${(e as Error).message}`);
    return [
      {
        id: 'obsidian-filter-error',
        severity: 'warning',
        message: `obsidian graph check failed: ${(e as Error).message}`,
      },
    ];
  }
}

function checkArchive(corpus: string, quiet = false): DoctorFinding[] {
  const archiveDir = join(corpus, '_归档');
  if (existsSync(archiveDir)) {
    if (!quiet) ok('_归档/ exists');
    return [];
  }
  if (!quiet) warn('_归档/ not found (optional)');
  return [
    { id: 'archive-dir', severity: 'warning', message: '_归档/ not found (optional)' },
  ];
}

function summarize(corpus: string, findings: DoctorFinding[]): DoctorReport {
  const issues = findings.filter((f) => f.severity === 'issue');
  const warnings = findings.filter((f) => f.severity === 'warning');
  return {
    corpus,
    issues,
    warnings,
    summary: {
      issues: issues.length,
      warnings: warnings.length,
      status: issues.length > 0 ? 'issue' : warnings.length > 0 ? 'warning' : 'ok',
    },
  };
}

/**
 * 程序内复用入口：跑健康体检。
 * 返回 issue 总数。调用方自行决定要不要把退出码设成非零。
 */
export function runDoctor(corpus: string, opts: { quiet?: boolean } = {}): number {
  const quiet = opts.quiet ?? false;
  if (!quiet) print(chalk.bold(`\nlorekit doctor — ${corpus}\n`));

  const findings: DoctorFinding[] = [];

  if (!quiet) print(chalk.cyan('── directories ──'));
  findings.push(...checkDirs(corpus, quiet));
  if (!quiet) print();

  if (!quiet) print(chalk.cyan('── wiki metadata ──'));
  findings.push(...checkWikiVersion(corpus, quiet));
  if (!quiet) print();

  if (!quiet) print(chalk.cyan('── frontmatter ──'));
  findings.push(...checkFrontmatterCoverage(corpus, quiet));
  if (!quiet) print();

  if (!quiet) print(chalk.cyan('── index files ──'));
  findings.push(...checkIndexFiles(corpus, quiet));
  if (!quiet) print();

  if (!quiet) print(chalk.cyan('── archive ──'));
  findings.push(...checkArchive(corpus, quiet));
  if (!quiet) print();

  if (!quiet) print(chalk.cyan('── obsidian ──'));
  findings.push(...checkObsidianGraph(corpus, quiet));
  if (!quiet) print();

  const report = summarize(corpus, findings);
  if (!quiet) {
    if (report.summary.status === 'ok') {
      print(chalk.green.bold('all checks passed ✓'));
    } else if (report.summary.status === 'warning') {
      print(chalk.yellow(`${report.summary.warnings} warning(s) found`));
    } else {
      print(chalk.yellow(`${report.summary.issues} issue(s) found`));
    }
    print();
  }

  return report.summary.issues;
}

export function collectDoctorReport(corpus: string): DoctorReport {
  const findings = [
    ...checkDirs(corpus, true),
    ...checkWikiVersion(corpus, true),
    ...checkFrontmatterCoverage(corpus, true),
    ...checkIndexFiles(corpus, true),
    ...checkArchive(corpus, true),
    ...checkObsidianGraph(corpus, true),
  ];
  return summarize(corpus, findings);
}

export function doctorCommand(program: Command) {
  program
    .command('doctor')
    .description('run health checks on the corpus')
    .option('--json', 'print machine-readable report to stdout', false)
    .option('--strict', 'treat warnings as failures', false)
    .action((opts: { json?: boolean; strict?: boolean }) => {
      const corpus = requireCorpus();
      const report = opts.json ? collectDoctorReport(corpus) : null;
      if (opts.json && report) {
        out(JSON.stringify(report, null, 2));
        process.exitCode =
          report.summary.issues > 0 || (opts.strict && report.summary.warnings > 0) ? 1 : 0;
        return;
      }
      const issues = runDoctor(corpus);
      const warnings = collectDoctorReport(corpus).summary.warnings;
      process.exitCode = issues > 0 || (opts.strict && warnings > 0) ? 1 : 0;
    });
}
