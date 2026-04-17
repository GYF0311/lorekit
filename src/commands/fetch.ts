import type { Command } from 'commander';
import { existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findCorpus, findSourceByUrl, extractFrontmatter } from '../lib/corpus.js';
import { fetchUrl } from '../lib/fetcher.js';
import type { FetchResult } from '../lib/fetcher.js';

// ---------------------------------------------------------------------------
// URL routing helpers
// ---------------------------------------------------------------------------

function suggestResult(route: string, url: string, suggest: string): FetchResult {
  return { status: 'unsupported', route, url, suggest };
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith('.pdf');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export function fetchCommand(program: Command) {
  program
    .command('fetch')
    .argument('<url>', 'URL to fetch')
    .option('--out <dir>', 'output directory')
    .option('--force-rich', 'skip host routing, always use rich fetcher')
    .option('--no-images', 'skip image downloads')
    .option('--force', 'ignore duplicate-URL check and re-fetch anyway')
    .description('Fetch a URL into local markdown + images')
    .action(async (url: string, opts: { out?: string; forceRich?: boolean; images?: boolean; force?: boolean }) => {
      // Resolve output root
      const corpus = findCorpus();
      let outRoot: string;
      if (opts.out) {
        outRoot = opts.out;
      } else {
        outRoot = corpus
          ? join(corpus, '_工作台', '收件', 'fetch')
          : '/tmp/lorekit-fetch';
      }
      if (!existsSync(outRoot)) {
        mkdirSync(outRoot, { recursive: true });
      }

      // Duplicate-URL detection: scan 原料/ for existing article.md with same source_url
      let duplicate: FetchResult['duplicate'] | undefined;
      if (corpus && !opts.force) {
        const existing = findSourceByUrl(corpus, url);
        if (existing) {
          const fm = extractFrontmatter(existing);
          // gray-matter parses bare YAML dates as Date objects; normalize to ISO yyyy-mm-dd
          const sdRaw = fm.source_date;
          const sourceDate =
            typeof sdRaw === 'string'
              ? sdRaw
              : sdRaw instanceof Date
                ? sdRaw.toISOString().slice(0, 10)
                : undefined;
          duplicate = {
            path: relative(corpus, existing),
            sourceDate,
            title: typeof fm.title === 'string' ? fm.title : undefined,
          };
          console.error(
            `[lorekit fetch] duplicate url: ${url} already ingested at ${duplicate.path}` +
            (duplicate.sourceDate ? ` (source_date: ${duplicate.sourceDate})` : '') +
            `. Use --force to re-fetch anyway.`,
          );
          console.log(JSON.stringify({ status: 'duplicate', route: 'rich', url, duplicate }));
          return;
        }
      }

      // Route by host (unless --force-rich)
      const noImages = opts.images === false;
      let result: FetchResult;

      if (opts.forceRich) {
        result = await fetchUrl(url, { outRoot, noImages });
      } else {
        const host = getHost(url);

        if (host.includes('mp.weixin.qq.com')) {
          result = await fetchUrl(url, { outRoot, noImages });
        } else if (host.includes('feishu.cn') || host.includes('larkoffice.com')) {
          result = suggestResult('lark', url, 'lark-cli docs +read --as user --doc <url>');
        } else if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) {
          result = suggestResult('x', url, 'paste screenshot or text (antibot too strong)');
        } else if (host === 'github.com' || host === 'gist.github.com') {
          result = suggestResult('github', url, 'WebFetch or github-content-fetch skill');
        } else if (isPdfUrl(url)) {
          result = suggestResult('pdf', url, 'pdf skill');
        } else {
          // Generic site
          result = await fetchUrl(url, { outRoot, noImages });
        }
      }

      // Output single-line JSON
      console.log(JSON.stringify(result));

      // Exit with non-zero on error
      if (result.status === 'error') {
        process.exitCode = 1;
      }
    });
}
