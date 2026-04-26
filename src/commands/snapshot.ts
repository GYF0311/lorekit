import type { Command } from 'commander';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import * as tar from 'tar';
import { ok, bad, err } from '../utils/logger.js';
import { requireCorpus } from '../lib/corpus.js';
import { snapshotExcludeNames } from '../lib/paths.js';
import { tsCompact } from '../lib/date.js';
import { sha256 } from '../utils/fs.js';

interface ManifestEntry {
  path: string;
  sha256: string;
  bytes: number;
  mtime: string;
}

function collectAllFiles(dir: string, base: string): string[] {
  const results: string[] = [];

  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (snapshotExcludeNames.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(relative(base, full));
      }
    }
  }

  walk(dir);
  return results.sort();
}

export async function createSnapshot(corpus: string, opts: { tag?: string } = {}): Promise<string> {
  const snapshotsDir = join(corpus, '.wiki', 'snapshots');
  mkdirSync(snapshotsDir, { recursive: true });

  // Collect files
  const files = collectAllFiles(corpus, corpus);
  if (files.length === 0) {
    throw new Error('no files found in corpus');
  }

  // Build manifest
  const manifest: ManifestEntry[] = files.map((relPath) => {
    const full = join(corpus, relPath);
    const st = statSync(full);
    return {
      path: relPath,
      sha256: sha256(full),
      bytes: st.size,
      mtime: st.mtime.toISOString(),
    };
  });

  // Write temporary manifest into snapshots dir
  const manifestPath = join(snapshotsDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  try {
    // Build filename: YYYYMMDD-HHMMSS[-tag].tar.gz
    const tag = opts.tag ? `-${opts.tag}` : '';
    const tarName = `${tsCompact()}${tag}.tar.gz`;
    const tarPath = join(snapshotsDir, tarName);

    // Create tarball
    // Include all corpus files + the manifest
    const allEntries = [...files, relative(corpus, manifestPath)];

    await tar.create(
      {
        gzip: true,
        file: tarPath,
        cwd: corpus,
        prefix: '',
      },
      allEntries,
    );

    return tarPath;
  } finally {
    // LEGACY P4-2：tar.create 若抛错，manifest 原先会残留在 .wiki/snapshots/；
    // 放 finally 保证无论成功 / 失败都清掉。
    if (existsSync(manifestPath)) unlinkSync(manifestPath);
  }
}

export function snapshotCommand(program: Command) {
  program
    .command('snapshot')
    .option('--tag <name>', 'optional tag appended to filename')
    .description('create a tarball snapshot of the corpus')
    .action(async (opts: { tag?: string }) => {
      const corpus = requireCorpus();
      try {
        const tarPath = await createSnapshot(corpus, opts);
        const tarStat = statSync(tarPath);
        const sizeMB = (tarStat.size / 1024 / 1024).toFixed(1);
        const count = collectAllFiles(corpus, corpus).length;
        ok(`snapshot saved: ${tarPath} (${count} files, ${sizeMB} MB)`);
      } catch (e) {
        const message = (e as Error).message;
        if (message === 'no files found in corpus') {
          bad(message);
        } else {
          err(message);
          process.exitCode = 1;
        }
        return;
      }
    });
}
