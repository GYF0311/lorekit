import type { Command } from 'commander';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import chalk from 'chalk';
import { ok, bad, warn, print } from '../utils/logger.js';
import { requireCorpus, collectMdFiles, hasFrontmatter } from '../lib/corpus.js';
import { isIndexExcluded, isFolderPackage } from '../lib/paths.js';
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

function checkDirs(corpus: string): number {
  let issues = 0;
  for (const dir of EXPECTED_DIRS) {
    const full = join(corpus, dir);
    if (existsSync(full)) {
      ok(`${dir}/`);
    } else {
      bad(`${dir}/ ${chalk.dim('missing')}`);
      issues++;
    }
  }
  return issues;
}

function checkWikiVersion(corpus: string): number {
  const versionFile = join(corpus, '.wiki', 'version');
  if (existsSync(versionFile)) {
    const ver = readFileSync(versionFile, 'utf-8').trim();
    ok(`.wiki/version → ${ver}`);
    return 0;
  }
  bad('.wiki/version missing');
  return 1;
}

function checkFrontmatterCoverage(corpus: string) {
  const files = collectMdFiles(corpus);
  const withFm = files.filter((f) => hasFrontmatter(f)).length;
  const total = files.length;
  const pct = total === 0 ? 100 : Math.round((withFm / total) * 100);

  const color = pct >= 90 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
  const icon = pct >= 90 ? '✓' : pct >= 60 ? '⚠' : '✗';
  print(`${color(icon)} frontmatter coverage: ${withFm}/${total} (${pct}%)`);
}

function checkIndexFiles(corpus: string): number {
  let missing = 0;

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
        warn(`_INDEX.md missing in ${rel}/`);
        missing++;
      }
      walk(full);
    }
  }

  walk(corpus);
  if (missing === 0) {
    ok('all directories with .md files have _INDEX.md');
  }
  return missing;
}

/**
 * 检查 .obsidian/graph.json filter 是否含推荐项（批次 26 触达老用户）。
 * obsidian 是可选用途，不阻塞 doctor 整体绿 —— 故意不计入 issues 总数。
 */
function checkObsidianGraph(corpus: string): void {
  try {
    const recommended = getRecommendedFilter();
    const cur = readCorpusFilter(corpus);
    if (!cur.exists) {
      warn('obsidian: graph filter 不完整，运行 lorekit obsidian-tune 查看详情');
      return;
    }
    if (isFilterComplete(cur.search, recommended)) {
      ok('obsidian: graph filter 完整');
    } else {
      warn('obsidian: graph filter 不完整，运行 lorekit obsidian-tune 查看详情');
    }
  } catch (e) {
    // 模板缺失或读失败：不阻塞 doctor 主流程，给个 warn
    warn(`obsidian: 检查 graph filter 失败: ${(e as Error).message}`);
  }
}

function checkArchive(corpus: string): number {
  const archiveDir = join(corpus, '_归档');
  if (existsSync(archiveDir)) {
    ok('_归档/ exists');
    return 0;
  }
  warn('_归档/ not found (optional)');
  return 0; // not a hard failure
}

/**
 * 程序内复用入口：跑健康体检。
 * 返回 issue 总数。调用方自行决定要不要把退出码设成非零。
 */
export function runDoctor(corpus: string): number {
  print(chalk.bold(`\nlorekit doctor — ${corpus}\n`));

  let issues = 0;

  print(chalk.cyan('── directories ──'));
  issues += checkDirs(corpus);
  print();

  print(chalk.cyan('── wiki metadata ──'));
  issues += checkWikiVersion(corpus);
  print();

  print(chalk.cyan('── frontmatter ──'));
  checkFrontmatterCoverage(corpus);
  print();

  print(chalk.cyan('── index files ──'));
  issues += checkIndexFiles(corpus);
  print();

  print(chalk.cyan('── archive ──'));
  checkArchive(corpus);
  print();

  print(chalk.cyan('── obsidian ──'));
  checkObsidianGraph(corpus);
  print();

  if (issues === 0) {
    print(chalk.green.bold('all checks passed ✓'));
  } else {
    print(chalk.yellow(`${issues} issue(s) found`));
  }
  print();

  return issues;
}

export function doctorCommand(program: Command) {
  program
    .command('doctor')
    .description('run health checks on the corpus')
    .action(() => {
      const corpus = requireCorpus();
      const issues = runDoctor(corpus);
      process.exitCode = issues > 0 ? 1 : 0;
    });
}
