import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, lstatSync } from 'node:fs';
import { join, basename, relative, resolve } from 'node:path';
import { requireCorpus, hasFrontmatter, extractFrontmatter } from '../lib/corpus.js';
import {
  indexExcludeDirPrefixes,
  isIndexExcluded,
  isFolderPackage,
} from '../lib/paths.js';
import { dateToYMDUtc, dateToYMDLocal } from '../lib/date.js';
import { ok, warn, err } from '../utils/logger.js';

function extractSummary(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let found = false;
  for (const line of lines) {
    if (/^## Compiled Truth/.test(line)) {
      found = true;
      continue;
    }
    if (!found) continue;
    if (/^---\s*$/.test(line)) break;
    if (/^## /.test(line)) break;
    if (line.trim() === '') continue;

    let text = line.trim().replace(/^\*\*[^*]*\*\*\s*/, '');
    const periodMatch = text.match(/^([^。.]*[。.])/);
    if (periodMatch && periodMatch[1].length <= 50) return periodMatch[1];
    return text.slice(0, 50);
  }
  return '';
}

interface IndexEntry {
  slug: string; // corpus 根相对路径，不含 .md；对目录包装式原料用父目录路径
  title: string; // frontmatter.title 或 basename
  summary: string; // Compiled Truth 首句或 "—"
  updated: string; // YYYY-MM-DD
}

function readEntryFromFile(filePath: string, slug: string): IndexEntry {
  let title = '';
  let updated = '';
  let summary = '';

  if (hasFrontmatter(filePath)) {
    const fm = extractFrontmatter(filePath);
    title = typeof fm.title === 'string' ? fm.title : fm.title != null ? String(fm.title) : '';

    if (fm.updated instanceof Date) {
      updated = dateToYMDUtc(fm.updated);
    } else {
      updated = fm.updated != null ? String(fm.updated) : '';
    }

    summary = extractSummary(filePath);
    if (!summary) summary = '—';
  } else {
    summary = '（缺少 frontmatter）';
  }

  if (!title) title = basename(filePath, '.md');

  if (!updated) {
    try {
      updated = dateToYMDLocal(statSync(filePath).mtime);
    } catch {
      updated = 'unknown';
    }
  }

  return { slug, title, summary, updated };
}

// 转义表格单元格里的 | 字符（防止撑散 markdown 表格）
function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function buildIndex(dir: string, root: string): boolean {
  const reldir = dir === root ? '' : relative(root, dir);
  const dirName = reldir === '' ? basename(root) : basename(dir);
  const indexFile = join(dir, '_INDEX.md');

  let names: string[];
  try {
    names = readdirSync(dir, { encoding: 'utf-8' });
  } catch {
    return false;
  }

  const entries: IndexEntry[] = [];

  for (const name of names) {
    if (name.startsWith('.')) continue;
    if (name === '_INDEX.md' || name === '.gitkeep') continue;

    const full = join(dir, name);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      continue;
    }

    if (stat.isFile() && name.endsWith('.md')) {
      // 普通 .md 文件：slug = 完整相对路径去 .md
      const slug = relative(root, full).replace(/\.md$/, '');
      entries.push(readEntryFromFile(full, slug));
    } else if (stat.isDirectory() && isFolderPackage(full)) {
      // 目录包装式原料：xxx/article.md → slug = xxx 父目录路径
      const articlePath = join(full, 'article.md');
      const slug = relative(root, full);
      entries.push(readEntryFromFile(articlePath, slug));
    }
  }

  if (entries.length === 0) return false;

  entries.sort((a, b) => b.updated.localeCompare(a.updated));

  const lines: string[] = [];
  lines.push(`# ${dirName}`);
  lines.push('');
  lines.push(`> 本目录共 ${entries.length} 个条目。由 \`lorekit index\` 自动生成。`);
  lines.push('');
  lines.push('| 条目 | 摘要 | 更新 |');
  lines.push('|---|---|---|');
  for (const e of entries) {
    lines.push(`| [[${e.slug}]] | ${escapeCell(e.summary)} | ${e.updated} |`);
  }
  lines.push('');

  writeFileSync(indexFile, lines.join('\n'), 'utf-8');
  const display = reldir === '' ? '_INDEX.md' : `${reldir}/_INDEX.md`;
  ok(`${display} (${entries.length} entries)`);
  return true;
}

/**
 * 递归发现"可索引目录"：
 *   - 目录下有直接 .md 文件（非 _INDEX.md / 隐藏）
 *   - 或目录下有"目录包装式原料"子目录（xxx/article.md 形式）
 *
 * 排除规则：
 *   - indexExcludeDirPrefixes 开头的目录整枝跳过
 *   - corpus 根本身不索引（L0 = index.md 已承担其职能）
 *   - 目录包装式原料的内部目录不递归（它们是条目，不是容器）
 */
function findIndexableDirs(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string, isRoot: boolean) {
    const rel = dir === root ? '' : relative(root, dir);
    if (rel && isIndexExcluded(rel)) return;

    let names: string[];
    try {
      names = readdirSync(dir, { encoding: 'utf-8' });
    } catch {
      return;
    }

    if (!isRoot) {
      let hasIndexable = false;
      for (const name of names) {
        if (name.startsWith('.')) continue;
        if (name === '_INDEX.md' || name === '.gitkeep') continue;

        const full = join(dir, name);
        let stat;
        try {
          stat = lstatSync(full);
        } catch {
          continue;
        }

        if (stat.isFile() && name.endsWith('.md')) {
          hasIndexable = true;
          break;
        }
        if (stat.isDirectory() && isFolderPackage(full)) {
          hasIndexable = true;
          break;
        }
      }
      if (hasIndexable) results.push(dir);
    }

    // 递归子目录（跳过目录包装式原料的内部）
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const full = join(dir, name);
      let stat;
      try {
        stat = lstatSync(full);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (isFolderPackage(full)) continue;
      walk(full, false);
    }
  }

  walk(root, true);
  return results.sort();
}

/**
 * 程序内复用入口：扫 corpus 生成所有 _INDEX.md。
 * 返回生成的文件数。specificDir 限定在单个子目录（相对 root 的路径）。
 *
 * 铁律：corpus 根不建 _INDEX.md —— L0 `corpus/index.md` 已经承担根级索引职能。
 * `--dir .` / `--dir ""` / `--dir ./` 这类 bypass 会被拒绝。
 */
export function runIndex(root: string, specificDir?: string): number {
  if (specificDir) {
    const full = join(root, specificDir);
    if (!existsSync(full)) {
      throw new Error(`directory not found: ${specificDir}`);
    }
    // 防止 --dir . / --dir "" / --dir ./ 等写法绕过根排除，在 corpus 根生成 _INDEX.md
    if (resolve(full) === resolve(root)) {
      throw new Error(
        `cannot index the corpus root itself — L0 corpus/index.md already serves this role`,
      );
    }
    // 子目录也要守住排除规则（避免 --dir _工作台 / --dir 系统 等强行生成）
    const rel = relative(root, full);
    if (isIndexExcluded(rel)) {
      throw new Error(
        `directory "${rel}" is in the exclude list (${indexExcludeDirPrefixes.join(' / ')})`,
      );
    }
    return buildIndex(full, root) ? 1 : 0;
  }
  const dirs = findIndexableDirs(root);
  if (dirs.length === 0) return 0;
  let generated = 0;
  for (const d of dirs) {
    if (buildIndex(d, root)) generated++;
  }
  return generated;
}

export function indexCommand(program: Command): void {
  const cmd = program
    .command('index')
    .description('Generate _INDEX.md recursively for corpus directories')
    .option('--dir <subdir>', 'Only update a specific subdirectory');

  cmd.action((opts) => {
    const root = requireCorpus();

    try {
      if (opts.dir) {
        runIndex(root, opts.dir);
      } else {
        const generated = runIndex(root);
        if (generated === 0) {
          warn('no indexable directories found');
        } else {
          ok(`generated ${generated} _INDEX.md file(s)`);
        }
      }
    } catch (e) {
      err((e as Error).message);
      process.exit(1);
    }
  });
}
