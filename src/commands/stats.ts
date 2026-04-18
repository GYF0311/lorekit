import type { Command } from 'commander';
import { readFileSync, statSync } from 'node:fs';
import { relative } from 'node:path';
import { requireCorpus, collectMdFiles, extractFrontmatter } from '../lib/corpus.js';
import { debug, out } from '../utils/logger.js';

export function statsCommand(program: Command) {
  program
    .command('stats')
    .description('output corpus statistics as JSON')
    .action(() => {
      const corpus = requireCorpus();
      const files = collectMdFiles(corpus);
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      const byType: Record<string, number> = {};
      const byDir: Record<string, number> = {};
      const inboundLinks = new Set<string>();
      let recentActive7d = 0;
      let lastUpdated = '';

      for (const file of files) {
        // by_type
        const fm = extractFrontmatter(file);
        const type = fm.type || 'unknown';
        byType[type] = (byType[type] || 0) + 1;

        // by_dir (top-level directory relative to corpus)
        const rel = relative(corpus, file);
        const topDir = rel.split('/')[0] || '.';
        byDir[topDir] = (byDir[topDir] || 0) + 1;

        // recent_active_7d
        try {
          const mtime = statSync(file).mtime;
          if (now - mtime.getTime() < sevenDays) {
            recentActive7d++;
          }
          const iso = mtime.toISOString();
          if (iso > lastUpdated) lastUpdated = iso;
        } catch (e) {
          // 单文件 stat 失败不应中断整体统计；走 debug
          debug(`stats: stat(${file}) failed: ${(e as Error).message}`);
        }

        // Collect wikilink targets to identify orphans later
        try {
          const content = readFileSync(file, 'utf-8');
          const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
          let m: RegExpExecArray | null;
          while ((m = linkRe.exec(content)) !== null) {
            inboundLinks.add(m[1].trim());
          }
        } catch (e) {
          // 单文件读失败时该文件的 wikilinks 漏掉，但不影响全局统计；走 debug
          debug(`stats: readFileSync(${file}) failed: ${(e as Error).message}`);
        }
      }

      // Compute orphans: pages that receive zero inbound links
      const orphans: string[] = [];
      for (const file of files) {
        const rel = relative(corpus, file);
        const stem = rel.replace(/\.md$/, '');
        const baseName = stem.split('/').pop()!;
        // A page is an orphan if neither its full relative stem nor its base name
        // appears as a wikilink target
        if (!inboundLinks.has(stem) && !inboundLinks.has(baseName)) {
          orphans.push(rel);
        }
      }

      const result = {
        total_pages: files.length,
        by_type: byType,
        by_dir: byDir,
        recent_active_7d: recentActive7d,
        orphans: orphans.length,
        last_updated: lastUpdated || null,
      };

      out(JSON.stringify(result, null, 2));
    });
}
