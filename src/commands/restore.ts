import type { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import chalk from 'chalk';
import { ok, bad, err, warn } from '../utils/logger.js';
import { requireCorpus } from '../lib/corpus.js';
import { sha256 } from '../utils/fs.js';

interface ManifestEntry {
  path: string;
  sha256: string;
  bytes: number;
  mtime: string;
}

type DiffKind = 'MISSING' | 'CHANGED';

interface DiffEntry {
  kind: DiffKind;
  path: string;
  snapshotSha: string;
  currentSha: string | null;
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function rmDirRecursive(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

export function restoreCommand(program: Command) {
  program
    .command('restore')
    .requiredOption('--from <snapshot>', 'path to snapshot .tar.gz')
    .option('--dry-run', 'only list differences, do not restore')
    .option('--file <path>', 'restore only this specific file')
    .description('restore files from a snapshot')
    .action(async (opts: { from: string; dryRun?: boolean; file?: string }) => {
      const corpus = requireCorpus();

      if (!existsSync(opts.from)) {
        bad(`snapshot not found: ${opts.from}`);
        process.exitCode = 1;
        return;
      }

      // Extract to temp dir
      const tmpDir = join(tmpdir(), `lorekit-restore-${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });

      try {
        await tar.extract({
          file: opts.from,
          cwd: tmpDir,
        });

        // Read manifest
        const manifestPath = join(tmpDir, '.wiki', 'snapshots', 'manifest.json');
        if (!existsSync(manifestPath)) {
          bad('manifest.json not found in snapshot');
          process.exitCode = 1;
          return;
        }

        const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, 'utf-8'));

        // Compute diffs
        const diffs: DiffEntry[] = [];

        for (const entry of manifest) {
          // Skip if --file is specified and doesn't match
          if (opts.file && entry.path !== opts.file) continue;

          const corpusPath = join(corpus, entry.path);
          if (!existsSync(corpusPath)) {
            diffs.push({
              kind: 'MISSING',
              path: entry.path,
              snapshotSha: entry.sha256,
              currentSha: null,
            });
          } else {
            const currentSha = sha256(corpusPath);
            if (currentSha !== entry.sha256) {
              diffs.push({
                kind: 'CHANGED',
                path: entry.path,
                snapshotSha: entry.sha256,
                currentSha,
              });
            }
          }
        }

        if (diffs.length === 0) {
          ok('corpus matches snapshot — nothing to restore');
          return;
        }

        // Display diffs
        const missing = diffs.filter((d) => d.kind === 'MISSING');
        const changed = diffs.filter((d) => d.kind === 'CHANGED');

        if (missing.length > 0) {
          console.log(chalk.yellow(`\n  MISSING (${missing.length}):`));
          for (const d of missing) {
            console.log(`    + ${d.path}`);
          }
        }
        if (changed.length > 0) {
          console.log(chalk.cyan(`\n  CHANGED (${changed.length}):`));
          for (const d of changed) {
            console.log(`    ~ ${d.path}`);
          }
        }
        console.log();

        if (opts.dryRun) {
          warn(`dry-run: ${diffs.length} file(s) would be restored`);
          return;
        }

        // Confirm
        const answer = await ask(`  restore ${diffs.length} file(s)? [y/N] `);
        if (answer.toLowerCase() !== 'y') {
          bad('cancelled');
          return;
        }

        // Copy files from tmpDir to corpus
        let restored = 0;
        for (const d of diffs) {
          const src = join(tmpDir, d.path);
          const dest = join(corpus, d.path);
          if (!existsSync(src)) {
            warn(`file not in snapshot archive: ${d.path}`);
            continue;
          }
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(src, dest);
          restored++;
        }

        ok(`restored ${restored} file(s) from snapshot`);
      } finally {
        // Clean up temp dir
        rmDirRecursive(tmpDir);
      }
    });
}
