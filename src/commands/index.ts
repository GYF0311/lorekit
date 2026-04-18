import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, lstatSync } from 'node:fs';
import { join, basename } from 'node:path';
import { requireCorpus, hasFrontmatter, extractFrontmatter } from '../lib/corpus.js';
import { ok, warn, err } from '../utils/logger.js';

const INDEX_DIRS = [
  '知识库/概念',
  '知识库/实体',
  '知识库/摘要',
  '知识库/专题',
  '每日',
  '写作',
  '原料/文章',
  '原料/书籍',
  '原料/会议',
  '原料/录音',
  '原料/剪藏',
];

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

    // Strip leading bold markup
    let text = line.trim().replace(/^\*\*[^*]*\*\*\s*/, '');

    // Take up to first period or 50 chars
    const periodMatch = text.match(/^([^。.]*[。.])/);
    if (periodMatch && periodMatch[1].length <= 50) {
      return periodMatch[1];
    }
    return text.slice(0, 50);
  }
  return '';
}

interface IndexEntry {
  title: string;
  summary: string;
  updated: string;
}

function buildIndex(dir: string, root: string): void {
  const reldir = dir.slice(root.length + 1);
  const dirName = basename(dir);
  const indexFile = join(dir, '_INDEX.md');

  // Collect .md files in this directory (non-recursive, exclude special files)
  const mdFiles: string[] = [];
  let names: string[];
  try {
    names = readdirSync(dir, { encoding: 'utf-8' });
  } catch {
    return;
  }

  for (const name of names) {
    if (name.startsWith('.')) continue;
    if (!name.endsWith('.md')) continue;
    if (name === '_INDEX.md' || name === '.gitkeep') continue;
    const full = join(dir, name);
    try { if (lstatSync(full).isDirectory()) continue; } catch { continue; }
    mdFiles.push(full);
  }

  if (mdFiles.length === 0) return;

  const entries: IndexEntry[] = [];
  for (const f of mdFiles) {
    let title = '';
    let updated = '';
    let summary = '';

    if (hasFrontmatter(f)) {
      const fm = extractFrontmatter(f);
      title = typeof fm.title === 'string' ? fm.title : fm.title != null ? String(fm.title) : '';
      // YAML 会把 ISO 日期字面量解析成 Date；统一归一为 YYYY-MM-DD 字符串
      if (fm.updated instanceof Date) {
        const d = fm.updated;
        const pad = (n: number) => String(n).padStart(2, '0');
        updated = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      } else {
        updated = fm.updated != null ? String(fm.updated) : '';
      }
      summary = extractSummary(f);
      if (!summary) summary = '—';
    } else {
      summary = '（缺少 frontmatter）';
    }

    if (!title) title = basename(f, '.md');
    if (!updated) {
      try {
        const mtime = statSync(f).mtime;
        const pad = (n: number) => String(n).padStart(2, '0');
        updated = `${mtime.getFullYear()}-${pad(mtime.getMonth() + 1)}-${pad(mtime.getDate())}`;
      } catch {
        updated = 'unknown';
      }
    }

    entries.push({ title, summary, updated });
  }

  // Sort by updated descending
  entries.sort((a, b) => b.updated.localeCompare(a.updated));

  const lines: string[] = [];
  lines.push(`# ${dirName}`);
  lines.push('');
  lines.push(`> 本目录共 ${entries.length} 个条目。由 \`lorekit index\` 自动生成。`);
  lines.push('');
  lines.push('| 条目 | 摘要 | 更新 |');
  lines.push('|---|---|---|');
  for (const e of entries) {
    lines.push(`| [[${e.title}]] | ${e.summary} | ${e.updated} |`);
  }
  lines.push('');

  writeFileSync(indexFile, lines.join('\n'), 'utf-8');
  ok(`${reldir}/_INDEX.md (${entries.length} entries)`);
}

export function indexCommand(program: Command): void {
  const cmd = program
    .command('index')
    .description('Generate _INDEX.md for corpus directories')
    .option('--dir <subdir>', 'Only update a specific subdirectory');

  cmd.action((opts) => {
    const root = requireCorpus();

    if (opts.dir) {
      const full = join(root, opts.dir);
      if (!existsSync(full)) {
        err(`directory not found: ${opts.dir}`);
        process.exit(1);
      }
      buildIndex(full, root);
    } else {
      let generated = 0;
      for (const d of INDEX_DIRS) {
        const full = join(root, d);
        if (!existsSync(full)) continue;
        buildIndex(full, root);
        generated++;
      }
      if (generated === 0) {
        warn('no indexable directories found');
      }
    }
  });
}
