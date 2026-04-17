import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import matter from 'gray-matter';

export function findCorpus(startDir?: string): string | null {
  let dir = startDir || process.cwd();
  while (dir !== '/' && dir) {
    if (
      existsSync(join(dir, '.wiki')) ||
      existsSync(join(dir, 'CLAUDE.md'))
    ) {
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
  updated?: string;
  [key: string]: unknown;
}

export function extractFrontmatter(filePath: string): Frontmatter {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    return data as Frontmatter;
  } catch {
    return {};
  }
}

export function hasFrontmatter(filePath: string): boolean {
  try {
    const first = readFileSync(filePath, 'utf-8').slice(0, 4);
    return first === '---\n' || first === '---\r';
  } catch {
    return false;
  }
}

export function extractFrontmatterField(filePath: string, key: string): string | undefined {
  const fm = extractFrontmatter(filePath);
  const val = fm[key];
  return typeof val === 'string' ? val : undefined;
}

const EXCLUDE_NAMES = new Set(['.gitkeep', '.DS_Store', '_INDEX.md']);

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

export function collectMdFiles(dir: string, opts?: { excludeIndex?: boolean }): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.name.endsWith('.md') &&
        !EXCLUDE_NAMES.has(entry.name)
      ) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results.sort();
}
