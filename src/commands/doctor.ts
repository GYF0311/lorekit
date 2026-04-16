import type { Command } from 'commander';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import chalk from 'chalk';
import { ok, bad, warn } from '../utils/logger.js';
import { requireCorpus, collectMdFiles, hasFrontmatter } from '../lib/corpus.js';

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
  console.log(`${color(icon)} frontmatter coverage: ${withFm}/${total} (${pct}%)`);
}

function checkIndexFiles(corpus: string): number {
  let missing = 0;

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Check if this directory has .md files but no _INDEX.md
        const hasMd = readdirSync(full).some(
          (f) => f.endsWith('.md') && f !== '_INDEX.md',
        );
        if (hasMd && !existsSync(join(full, '_INDEX.md'))) {
          const rel = relative(corpus, full);
          warn(`_INDEX.md missing in ${rel}/`);
          missing++;
        }
        walk(full);
      }
    }
  }

  walk(corpus);
  if (missing === 0) {
    ok('all directories with .md files have _INDEX.md');
  }
  return missing;
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

export function doctorCommand(program: Command) {
  program
    .command('doctor')
    .description('run health checks on the corpus')
    .action(() => {
      const corpus = requireCorpus();
      console.log(chalk.bold(`\nlorekit doctor — ${corpus}\n`));

      let issues = 0;

      console.log(chalk.cyan('── directories ──'));
      issues += checkDirs(corpus);
      console.log();

      console.log(chalk.cyan('── wiki metadata ──'));
      issues += checkWikiVersion(corpus);
      console.log();

      console.log(chalk.cyan('── frontmatter ──'));
      checkFrontmatterCoverage(corpus);
      console.log();

      console.log(chalk.cyan('── index files ──'));
      issues += checkIndexFiles(corpus);
      console.log();

      console.log(chalk.cyan('── archive ──'));
      checkArchive(corpus);
      console.log();

      if (issues === 0) {
        console.log(chalk.green.bold('all checks passed ✓'));
      } else {
        console.log(chalk.yellow(`${issues} issue(s) found`));
      }
      console.log();

      process.exitCode = issues > 0 ? 1 : 0;
    });
}
