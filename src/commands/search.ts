import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, bad, warn, out } from '../utils/logger.js';
import { requireCorpus, collectMdFiles } from '../lib/corpus.js';

interface SearchResult {
  file: string;
  line: number;
  text: string;
}

function searchWithRipgrep(
  query: string,
  corpus: string,
  opts: { type?: string; dir?: string },
): SearchResult[] {
  const searchDir = opts.dir ? join(corpus, opts.dir) : corpus;
  const args: string[] = ['--json', '--no-heading', '-i'];

  if (opts.type) {
    args.push('--type', opts.type);
  }

  // Exclude internal dirs
  args.push('--glob', '!.wiki/**', '--glob', '!.git/**');
  args.push(query, searchDir);

  const result = spawnSync('rg', args, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    // rg not found
    return [];
  }

  const results: SearchResult[] = [];
  for (const line of (result.stdout || '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'match') {
        results.push({
          file: relative(corpus, obj.data.path.text),
          line: obj.data.line_number,
          text: obj.data.lines.text.trimEnd(),
        });
      }
    } catch {
      // skip malformed lines
    }
  }
  return results;
}

function searchFallback(query: string, corpus: string, opts: { dir?: string }): SearchResult[] {
  const searchDir = opts.dir ? join(corpus, opts.dir) : corpus;
  const files = collectMdFiles(searchDir);
  const pattern = new RegExp(query, 'i');
  const results: SearchResult[] = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        results.push({
          file: relative(corpus, filePath),
          line: i + 1,
          text: lines[i].trimEnd(),
        });
      }
    }
  }
  return results;
}

function hasRipgrep(): boolean {
  const result = spawnSync('rg', ['--version'], { encoding: 'utf-8' });
  return !result.error && result.status === 0;
}

export function searchCommand(program: Command) {
  program
    .command('search')
    .argument('<query>', 'search query (regex supported)')
    .option('--type <t>', 'file type filter (passed to rg --type)')
    .option('--dir <d>', 'subdirectory within corpus to search')
    .description('search the corpus with ripgrep (fallback: built-in)')
    .action((query: string, opts: { type?: string; dir?: string }) => {
      const corpus = requireCorpus();

      let results: SearchResult[];

      if (hasRipgrep()) {
        results = searchWithRipgrep(query, corpus, opts);
      } else {
        warn('rg (ripgrep) not found, using built-in fallback');
        results = searchFallback(query, corpus, { dir: opts.dir });
      }

      // TODO Phase 3: if .wiki/vector.sqlite exists, also run vector similarity
      // search and merge results with text search hits.

      // Output JSON lines
      for (const r of results) {
        out(JSON.stringify(r));
      }

      if (results.length === 0) {
        warn('no results');
      }
    });
}
