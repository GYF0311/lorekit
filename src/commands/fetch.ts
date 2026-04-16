import type { Command } from 'commander';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findCorpus } from '../lib/corpus.js';
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
    .description('Fetch a URL into local markdown + images')
    .action(async (url: string, opts: { out?: string; forceRich?: boolean; images?: boolean }) => {
      // Resolve output root
      let outRoot: string;
      if (opts.out) {
        outRoot = opts.out;
      } else {
        const corpus = findCorpus();
        outRoot = corpus
          ? join(corpus, '_工作台', '收件', 'fetch')
          : '/tmp/lorekit-fetch';
      }
      if (!existsSync(outRoot)) {
        mkdirSync(outRoot, { recursive: true });
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
