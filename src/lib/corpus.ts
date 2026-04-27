import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import matter from 'gray-matter';
import { alwaysExcludeNames } from './paths.js';
import { debug } from '../utils/logger.js';

export function findCorpus(startDir?: string): string | null {
  let dir = startDir || process.cwd();
  while (dir !== '/' && dir) {
    if (existsSync(join(dir, '.wiki')) || existsSync(join(dir, 'CLAUDE.md'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

export function requireCorpus(startDir?: string): string {
  const corpus = findCorpus(startDir);
  if (!corpus) {
    throw new Error('not inside a corpus (no .wiki/ or CLAUDE.md found)');
  }
  return corpus;
}

export interface Frontmatter {
  type?: string;
  title?: string;
  slug?: string;
  created?: string;
  updated?: string | Date;
  [key: string]: unknown;
}

export function extractFrontmatter(filePath: string): Frontmatter {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    return data as Frontmatter;
  } catch (e) {
    // 文件读不到 / YAML 损坏时返回空对象。在 lint / index 等命令里被大量
    // 调用，warn 会刷屏，所以走 debug；真有异常先生开 LOREKIT_DEBUG=1 复现
    debug(`extractFrontmatter(${filePath}) failed: ${(e as Error).message}`);
    return {};
  }
}

export function hasFrontmatter(filePath: string): boolean {
  try {
    const first = readFileSync(filePath, 'utf-8').slice(0, 4);
    return first === '---\n' || first === '---\r';
  } catch (e) {
    // 同 extractFrontmatter：批量调用，走 debug
    debug(`hasFrontmatter(${filePath}) failed: ${(e as Error).message}`);
    return false;
  }
}

export function extractFrontmatterField(filePath: string, key: string): string | undefined {
  const fm = extractFrontmatter(filePath);
  const val = fm[key];
  return typeof val === 'string' ? val : undefined;
}

/**
 * Find an existing source page in 原料/ that has the given source_url.
 * Returns the absolute path or null.
 */
export function findSourceByUrl(corpus: string, url: string): string | null {
  const sourcesRoot = join(corpus, '原料');
  if (!existsSync(sourcesRoot)) return null;
  for (const mdPath of collectMdFiles(sourcesRoot)) {
    const fm = extractFrontmatter(mdPath);
    if (fm.source_url === url || fm.url === url) return mdPath;
  }
  return null;
}

export function collectMdFiles(dir: string, _opts?: { excludeIndex?: boolean }): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md') && !alwaysExcludeNames.has(entry.name)) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results.sort();
}
