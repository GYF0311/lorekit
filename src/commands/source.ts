import type { Command } from 'commander';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { requireCorpus } from '../lib/corpus.js';
import {
  canonicalMarkdownForHash,
  readMarkdown,
  setFieldIfMissing,
  writeMarkdown,
} from '../lib/frontmatter-write.js';
import { dateToYMDLocal } from '../lib/date.js';
import { createSnapshot } from './snapshot.js';
import { bad, ok, print } from '../utils/logger.js';

function sha256Text(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function isOlderThanTwoYears(sourceDate: unknown): boolean {
  const parsed =
    sourceDate instanceof Date
      ? sourceDate
      : typeof sourceDate === 'string'
        ? new Date(`${sourceDate}T00:00:00Z`)
        : null;
  if (!parsed) return false;
  if (Number.isNaN(parsed.getTime())) return false;
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  return Date.now() - parsed.getTime() > twoYearsMs;
}

export interface SourceFinalizeResult {
  file: string;
  changed: boolean;
  raw_sha256: string;
  current?: string;
  ok: boolean;
}

export async function finalizeSource(
  corpus: string,
  inputPath: string,
  opts: { check?: boolean } = {},
): Promise<SourceFinalizeResult> {
  const abs = inputPath.startsWith('/') ? inputPath : join(corpus, inputPath);
  if (!existsSync(abs)) throw new Error(`source file not found: ${inputPath}`);

  const rel = relative(corpus, abs);
  if (!rel.startsWith('原料/')) {
    throw new Error(`source finalize only accepts files under 原料/: ${rel}`);
  }

  const parsed = readMarkdown(abs);
  let changed = false;
  changed = setFieldIfMissing(parsed.data, 'slug', rel.replace(/\.md$/, '')) || changed;
  const computed = sha256Text(canonicalMarkdownForHash(parsed.data, parsed.content));
  const current = typeof parsed.data.raw_sha256 === 'string' ? parsed.data.raw_sha256 : undefined;

  if (opts.check) {
    return { file: rel, changed: false, raw_sha256: computed, current, ok: current === computed };
  }

  await createSnapshot(corpus, { tag: 'source-finalize' });

  if (parsed.data.raw_sha256 !== computed) {
    parsed.data.raw_sha256 = computed;
    changed = true;
  }
  const today = dateToYMDLocal(new Date());
  if (parsed.data.last_verified !== today) {
    parsed.data.last_verified = today;
    changed = true;
  }
  const outdated = isOlderThanTwoYears(parsed.data.source_date);
  if (parsed.data.possibly_outdated !== outdated) {
    parsed.data.possibly_outdated = outdated;
    changed = true;
  }

  if (changed) writeMarkdown(abs, parsed.data, parsed.content);
  return { file: rel, changed, raw_sha256: computed, ok: true };
}

export function sourceCommand(program: Command): void {
  const source = program.command('source').description('manage source files under 原料/');

  source
    .command('finalize <path>')
    .description('write/check source slug + integrity metadata')
    .option('--check', 'check raw_sha256 without writing', false)
    .action(async (pathArg: string, opts: { check?: boolean }) => {
      const corpus = requireCorpus();
      try {
        const result = await finalizeSource(corpus, pathArg, opts);
        if (opts.check) {
          if (result.ok) {
            ok(`source hash ok: ${result.file}`);
          } else {
            bad(`source hash mismatch: ${result.file}`);
            print(`  current: ${result.current ?? '(missing)'}`);
            print(`  computed: ${result.raw_sha256}`);
            process.exitCode = 1;
          }
          return;
        }
        ok(
          `source finalized: ${result.file} ${result.changed ? result.raw_sha256 : '(unchanged)'}`,
        );
      } catch (e) {
        bad((e as Error).message);
        process.exitCode = 1;
      }
    });
}
