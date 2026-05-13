import type { Command } from 'commander';
import { requireCorpus } from '../lib/corpus.js';
import {
  doctorGbrain,
  exportForGbrain,
  getGbrainStatus,
  queryGbrain,
  syncGbrain,
} from '../lib/integrations/gbrain.js';
import { bad, info, ok, out, print, warn } from '../utils/logger.js';

function printJson(result: unknown): void {
  out(JSON.stringify(result, null, 2));
}

export function gbrainCommand(program: Command): void {
  const cmd = program
    .command('gbrain')
    .description('optional GBrain read-only integration');

  cmd
    .command('status')
    .description('check whether GBrain is installed')
    .option('--json', 'output json', false)
    .action(async (opts: { json?: boolean }) => {
      const result = await getGbrainStatus();
      if (opts.json) {
        printJson(result);
        return;
      }
      if (result.installed) {
        ok(`GBrain installed: ${result.version ?? result.binary}`);
      } else {
        warn('GBrain is not installed');
        print(result.installHint);
      }
    });

  cmd
    .command('export')
    .description('export lorekit 知识库/ pages into a GBrain-safe staging directory')
    .option('--out <dir>', 'export directory relative to corpus; must stay under .wiki/integrations')
    .option('--allow-outside-corpus', 'allow --out outside the default safe export root', false)
    .option('--dry-run', 'preview only; do not write files', false)
    .option('--json', 'output json', false)
    .action(
      (opts: {
        out?: string;
        allowOutsideCorpus?: boolean;
        dryRun?: boolean;
        json?: boolean;
      }) => {
        const corpus = requireCorpus();
        let result: ReturnType<typeof exportForGbrain>;
        try {
          result = exportForGbrain(corpus, {
            out: opts.out,
            allowOutsideCorpus: opts.allowOutsideCorpus,
            dryRun: opts.dryRun,
          });
        } catch (e) {
          bad((e as Error).message);
          process.exitCode = 2;
          return;
        }
        if (opts.json) {
          printJson(result);
          return;
        }
        if (result.dryRun) {
          info(`would export ${result.pagesExported} page(s) to ${result.exportDir}`);
        } else {
          ok(`exported ${result.pagesExported} page(s) to ${result.exportDir}`);
        }
        if (result.pagesSkipped > 0) warn(`skipped ${result.pagesSkipped} index file(s)`);
        for (const w of result.warnings) warn(w);
      },
    );

  cmd
    .command('sync')
    .description('export lorekit pages and run gbrain import on the staging directory')
    .option('--dry-run', 'preview only; do not write export files or call gbrain import', false)
    .option('--json', 'output json', false)
    .option(
      '--export-even-if-missing',
      'refresh staging export even when the gbrain binary is missing',
      false,
    )
    .action(async (opts: { dryRun?: boolean; json?: boolean; exportEvenIfMissing?: boolean }) => {
      const corpus = requireCorpus();
      const result = await syncGbrain(corpus, opts);
      if (opts.json) {
        printJson(result);
      } else if (result.status === 'ok') {
        if (result.dryRun) {
          info(`would export ${result.export?.pagesExported ?? 0} page(s); gbrain import skipped`);
        } else {
          ok(`gbrain sync complete: ${result.export?.pagesExported ?? 0} page(s) exported`);
        }
      } else {
        bad(`gbrain sync failed: ${result.errors.join('; ')}`);
      }
      process.exitCode = result.status === 'ok' ? 0 : 1;
    });

  cmd
    .command('doctor')
    .description('check GBrain integration health')
    .option('--json', 'output json', false)
    .action(async (opts: { json?: boolean }) => {
      const corpus = requireCorpus();
      const result = await doctorGbrain(corpus);
      if (opts.json) {
        printJson(result);
      } else {
        if (result.status === 'ok') ok('GBrain integration healthy');
        for (const issue of result.issues) {
          const line = `${issue.message}. ${issue.recommendation}`;
          if (issue.severity === 'error') bad(line);
          else warn(line);
        }
      }
      process.exitCode = result.status === 'error' ? 1 : 0;
    });

  cmd
    .command('query')
    .argument('<text>', 'query text')
    .description('run gbrain query without writing back to lorekit')
    .option('--json', 'output json', false)
    .option('--no-stale-check', 'skip corpus export/sync freshness warning')
    .action(async (text: string, opts: { json?: boolean; staleCheck?: boolean }) => {
      const corpus = requireCorpus();
      const result = await queryGbrain(corpus, text, { staleCheck: opts.staleCheck !== false });
      if (opts.json) {
        printJson(result);
      } else {
        info(result.message);
        for (const w of result.warnings) warn(w);
        if (result.gbrain?.stdout) print(result.gbrain.stdout.trim());
        if (result.gbrain?.stderr) warn(result.gbrain.stderr.trim());
        if (result.status === 'error') bad(result.errors.join('; '));
      }
      process.exitCode = result.status === 'ok' ? 0 : 1;
    });
}
