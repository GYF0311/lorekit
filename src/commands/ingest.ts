/**
 * `lorekit ingest` — subcommands for marking ingest pipeline progress.
 *
 * The agent running wiki-ingest calls these as it advances through the
 * Decision tree; each call mutates .wiki/ingest-state.json. This makes
 * interrupted ingests resumable and provides the source of truth for
 * `lorekit ingest-check`.
 */
import type { Command } from 'commander';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { requireCorpus, collectMdFiles, extractFrontmatter } from '../lib/corpus.js';
import {
  loadIngestState,
  saveIngestState,
  upsertIngestRecord,
  deleteIngestRecord,
  listPendingIngests,
  nextStepHint,
  type IngestStep,
} from '../lib/ingest-state.js';

const VALID_STEPS: IngestStep[] = ['fetch', 'archive', 'wiki', 'backlink', 'lint'];

export function ingestCommand(program: Command): void {
  const group = program
    .command('ingest')
    .description('Track ingest pipeline state (record step progress, list pending, reconcile)');

  // ---------- list ----------
  group
    .command('list')
    .description('List every ingest record (completed + in-progress)')
    .action(() => {
      const corpus = requireCorpus();
      const state = loadIngestState(corpus);
      const rows = Object.values(state.ingests);
      if (rows.length === 0) {
        console.error('[lorekit ingest list] no records');
        console.log(JSON.stringify({ ingests: [] }));
        return;
      }
      const summary = rows.map((r) => {
        const done = r.stepsDone.join(',') || '(none)';
        const dest = r.archivedTo ?? r.workbenchDir ?? '-';
        return `  [${r.status.padEnd(12)}] ${r.url}\n    steps: ${done}  →  ${dest}`;
      });
      console.error(`[lorekit ingest list] ${rows.length} record(s)\n${summary.join('\n')}`);
      console.log(JSON.stringify(state));
    });

  // ---------- pending ----------
  group
    .command('pending')
    .description('List only in-progress (non-completed) ingests — what you need to resume')
    .action(() => {
      const corpus = requireCorpus();
      const pending = listPendingIngests(corpus);
      if (pending.length === 0) {
        console.error('[lorekit ingest pending] all ingests are completed — nothing to resume');
        console.log(JSON.stringify({ pending: [] }));
        return;
      }
      const summary = pending.map((r) => {
        return `  [${r.status.padEnd(12)}] ${r.url}\n    next step → ${nextStepHint(r)}`;
      });
      console.error(`[lorekit ingest pending] ${pending.length} ingest(s) need attention\n${summary.join('\n')}`);
      console.log(JSON.stringify({ pending }));
      process.exitCode = 1;
    });

  // ---------- record ----------
  group
    .command('record <url>')
    .description('Record step progress for an ingest (call from wiki-ingest skill)')
    .option('--step <step>', `mark step as done (one of: ${VALID_STEPS.join(', ')})`)
    .option('--archived-to <path>', 'relative path where the source was moved (e.g. 原料/剪藏/xxx)')
    .option('--wiki-page <path...>', 'relative path of a wiki page created (can be repeated)')
    .option('--status <status>', 'explicit status (fetched|archived|wiki_created|completed|failed)')
    .option('--complete', 'shortcut: mark status=completed')
    .option('--fail <reason>', 'shortcut: mark status=failed with reason')
    .action((url: string, opts: {
      step?: string;
      archivedTo?: string;
      wikiPage?: string[];
      status?: string;
      complete?: boolean;
      fail?: string;
    }) => {
      const corpus = requireCorpus();
      const patch: Parameters<typeof upsertIngestRecord>[2] = {};

      if (opts.step) {
        if (!VALID_STEPS.includes(opts.step as IngestStep)) {
          console.error(`[lorekit ingest record] invalid --step: ${opts.step}. valid: ${VALID_STEPS.join(', ')}`);
          process.exitCode = 2;
          return;
        }
        const existing = loadIngestState(corpus).ingests[url];
        const prev = existing?.stepsDone ?? [];
        patch.stepsDone = [...prev, opts.step as IngestStep];

        // Top-level status is only three: started / completed / failed.
        // Only the lint step auto-promotes to completed; all other steps
        // stay as started (stepsDone tracks the sub-progress).
        if (!opts.status && !opts.complete && !opts.fail) {
          if (opts.step === 'lint') patch.status = 'completed';
          else patch.status = 'started';
        }
      }
      if (opts.archivedTo) patch.archivedTo = opts.archivedTo;
      if (opts.wikiPage && opts.wikiPage.length > 0) {
        const existing = loadIngestState(corpus).ingests[url];
        const prev = existing?.wikiPages ?? [];
        patch.wikiPages = [...prev, ...opts.wikiPage];
      }
      if (opts.status) patch.status = opts.status as any;
      if (opts.complete) patch.status = 'completed';
      if (opts.fail) {
        patch.status = 'failed';
        patch.error = opts.fail;
      }

      const updated = upsertIngestRecord(corpus, url, patch);
      console.error(
        `[lorekit ingest record] ${url}\n` +
        `  status: ${updated.status}  steps: ${updated.stepsDone.join(',') || '(none)'}`,
      );
      console.log(JSON.stringify(updated));
    });

  // ---------- forget ----------
  group
    .command('forget <url>')
    .description('Remove a record from the state (e.g. after manual cleanup)')
    .action((url: string) => {
      const corpus = requireCorpus();
      const removed = deleteIngestRecord(corpus, url);
      console.error(
        removed
          ? `[lorekit ingest forget] removed ${url}`
          : `[lorekit ingest forget] no record for ${url}`,
      );
      console.log(JSON.stringify({ removed, url }));
    });

  // ---------- reconcile ----------
  group
    .command('reconcile')
    .description('Back-fill state for pre-existing 原料/ pages missing a state record')
    .option('--dry-run', 'list what would be added without writing')
    .action((opts: { dryRun?: boolean }) => {
      const corpus = requireCorpus();
      const sourcesRoot = join(corpus, '原料');
      if (!existsSync(sourcesRoot)) {
        console.error('[lorekit ingest reconcile] no 原料/ directory');
        return;
      }
      const state = loadIngestState(corpus);
      const added: string[] = [];
      for (const mdPath of collectMdFiles(sourcesRoot)) {
        const fm = extractFrontmatter(mdPath);
        const url = (typeof fm.source_url === 'string' && fm.source_url)
          || (typeof fm.url === 'string' && fm.url)
          || '';
        if (!url) continue;
        if (state.ingests[url]) continue;

        const rel = relative(corpus, mdPath);
        const archivedTo = rel.replace(/\/article\.md$/, '');
        const sdRaw = fm.source_date;
        const sourceDate =
          typeof sdRaw === 'string'
            ? sdRaw
            : sdRaw instanceof Date
              ? sdRaw.toISOString().slice(0, 10)
              : undefined;
        const now = new Date().toISOString();
        state.ingests[url] = {
          url,
          title: typeof fm.title === 'string' ? fm.title : undefined,
          sourceDate,
          startedAt: now,
          updatedAt: now,
          status: 'completed',
          stepsDone: ['fetch', 'archive', 'wiki', 'lint'],
          archivedTo,
        };
        added.push(url);
      }
      if (!opts.dryRun && added.length > 0) saveIngestState(corpus, state);
      console.error(
        `[lorekit ingest reconcile] ${opts.dryRun ? 'would add' : 'added'} ${added.length} record(s)`,
      );
      for (const u of added) console.error(`  + ${u}`);
      console.log(JSON.stringify({ dryRun: !!opts.dryRun, added }));
    });
}
