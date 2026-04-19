import type { Command } from 'commander';
import { existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findCorpus, findSourceByUrl, extractFrontmatter } from '../lib/corpus.js';
import { fetchUrl, fetchGist, fetchGithubDoc } from '../lib/fetcher/index.js';
import type { FetchResult } from '../lib/fetcher/index.js';
import { getIngestRecord, upsertIngestRecord, nextStepHint } from '../lib/ingest-state.js';

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
    .action(
      async (
        url: string,
        opts: { out?: string; forceRich?: boolean; images?: boolean; force?: boolean },
      ) => {
        // Resolve output root
        const corpus = findCorpus();
        let outRoot: string;
        if (opts.out) {
          outRoot = opts.out;
        } else {
          outRoot = corpus ? join(corpus, '_工作台', '收件', 'fetch') : '/tmp/lorekit-fetch';
        }
        if (!existsSync(outRoot)) {
          mkdirSync(outRoot, { recursive: true });
        }

        // Duplicate / resume detection: consult ingest-state.json first,
        // fall back to scanning 原料/*/*/article.md frontmatter for legacy ingests
        // without a state record.
        let duplicate: FetchResult['duplicate'] | undefined;
        if (corpus && !opts.force) {
          const state = getIngestRecord(corpus, url);

          if (state && state.status !== 'completed') {
            // Interrupted ingest — surface resume hint, do not re-fetch
            const hint = nextStepHint(state);
            console.error(
              `[lorekit fetch] in-progress ingest detected for ${url}\n` +
                `  status: ${state.status}  steps done: ${state.stepsDone.join(', ') || '(none)'}\n` +
                `  started: ${state.startedAt}\n` +
                `  next step → ${hint}\n` +
                `  use --force to restart from scratch`,
            );
            console.log(
              JSON.stringify({
                status: 'in_progress',
                route: 'rich',
                url,
                ingestState: state,
                nextStep: hint,
              }),
            );
            return;
          }

          if (state && state.status === 'completed') {
            duplicate = {
              path: state.archivedTo ?? '(unknown)',
              sourceDate: state.sourceDate,
              title: state.title,
            };
          } else {
            // No state record — fall back to frontmatter scan
            const existing = findSourceByUrl(corpus, url);
            if (existing) {
              const fm = extractFrontmatter(existing);
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
            }
          }

          if (duplicate) {
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
          } else if (
            host === 'x.com' ||
            host === 'twitter.com' ||
            host.endsWith('.x.com') ||
            host.endsWith('.twitter.com')
          ) {
            result = suggestResult('x', url, 'paste screenshot or text (antibot too strong)');
          } else if (host === 'gist.github.com' || host === 'gist.githubusercontent.com') {
            result = await fetchGist(url, outRoot);
          } else if (host === 'github.com' || host === 'www.github.com') {
            result = await fetchGithubDoc(url, outRoot);
          } else if (isPdfUrl(url)) {
            result = suggestResult('pdf', url, 'pdf skill');
          } else {
            // Generic site
            result = await fetchUrl(url, { outRoot, noImages });
          }
        }

        // On successful fetch into a corpus, record state so subsequent runs
        // see this as an in-progress ingest until the agent marks it completed.
        if (corpus && result.status === 'ok' && result.markdown) {
          upsertIngestRecord(corpus, url, {
            title: result.title,
            sourceDate: result.publishDate,
            status: 'started',
            stepsDone: ['fetch'],
            workbenchMd: result.markdown,
          });
        }

        // Output single-line JSON
        console.log(JSON.stringify(result));

        // Exit with non-zero on error
        if (result.status === 'error') {
          process.exitCode = 1;
        }
      },
    );
}
