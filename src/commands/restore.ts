import type { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import * as tar from 'tar';
import chalk from 'chalk';
import { ok, bad, warn, print } from '../utils/logger.js';
import { requireCorpus } from '../lib/corpus.js';
import { isWithin } from '../lib/paths.js';
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

/**
 * 仅限 os.tmpdir() 子目录，不许扩展到任何用户数据路径。
 *
 * LEGACY P4-3 / 先生全局 CLAUDE.md 数据安全红线：lorekit 源码里的任何
 * `rm -rf` 等价操作都必须锁定在 tmpdir 下。本函数的唯一调用方 restore
 * action 中，`tmpDir` 由 `join(tmpdir(), 'lorekit-restore-' + Date.now())`
 * 构造——禁止把 user corpus 路径传进来。
 */
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
        // CONVENTIONS #4：用户提供的 --from 路径不存在 → 参数错 → exit 2
        process.exitCode = 2;
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

          // 边界守卫：恶意 manifest 的 entry.path 可能含 `..` 或绝对路径，
          // join(corpus, ...) 后 copyFileSync 能写出 corpus（CWE-22）。
          // 早判一次，dry-run 模式也安全。
          if (isAbsolute(entry.path) || entry.path.split(/[/\\]/).includes('..')) {
            bad(`refuse to restore outside corpus: ${entry.path}`);
            process.exitCode = 1;
            return;
          }

          const corpusPath = join(corpus, entry.path);
          if (!isWithin(corpus, corpusPath)) {
            bad(`refuse to restore outside corpus: ${entry.path}`);
            process.exitCode = 1;
            return;
          }

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
          print(chalk.yellow(`\n  MISSING (${missing.length}):`));
          for (const d of missing) {
            print(`    + ${d.path}`);
          }
        }
        if (changed.length > 0) {
          print(chalk.cyan(`\n  CHANGED (${changed.length}):`));
          for (const d of changed) {
            print(`    ~ ${d.path}`);
          }
        }
        print();

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
          // 双保险：早判已拒过 `..` / 绝对路径，这里 belt-and-suspenders 防御
          // 任何 join() 后才暴露的越界（例如 d.path 是 symlink 或编码诡计）。
          if (!isWithin(corpus, dest)) {
            bad(`refuse to restore outside corpus: ${d.path}`);
            process.exitCode = 1;
            return;
          }
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
