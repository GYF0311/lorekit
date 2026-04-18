/**
 * `lorekit ingest` — subcommands for marking ingest pipeline progress.
 *
 * The agent running wiki-ingest calls these as it advances through the
 * Decision tree; each call mutates .wiki/ingest-state.json. This makes
 * interrupted ingests resumable and provides the source of truth for
 * `lorekit ingest-check`.
 */
import type { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { requireCorpus, collectMdFiles, extractFrontmatter } from '../lib/corpus.js';
import {
  loadIngestState,
  saveIngestState,
  upsertIngestRecord,
  deleteIngestRecord,
  listPendingIngests,
  nextStepHint,
  type IngestRecord,
  type IngestStep,
} from '../lib/ingest-state.js';

const VALID_STEPS: IngestStep[] = ['fetch', 'archive', 'wiki', 'backlink', 'lint'];

// Today as YYYY-MM-DD in local time (Asia/Shanghai assumed by user setup).
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Append a structured ingest entry to corpus/log.md.
 *
 * The log.md format (see existing entries) uses `## [YYYY-MM-DD] ingest | 标题`
 * as a section header followed by structured bullet lines. We prepend the new
 * entry just below the file's intro block (after the first `>` blockquote line)
 * so the most recent ingest sits on top — matching the convention of existing
 * entries.
 *
 * `body` is the LLM-supplied one-paragraph summary describing what was done.
 * The CLI auto-fills url / archive / wiki pages from the state record so the
 * skill doesn't have to repeat them.
 */
function appendLogEntry(corpus: string, record: IngestRecord, body: string): void {
  const logPath = join(corpus, 'log.md');
  const title = record.title ?? '(untitled)';
  const wikiList = (record.wikiPages ?? []).map((p) => `  - ${p}`).join('\n');
  const archived = record.archivedTo ?? '(unrecorded)';

  const entry = [
    `## [${today()}] ingest | ${title}`,
    '',
    body.trim(),
    '',
    `- **URL**：${record.url}`,
    `- **归档**：${archived}`,
    record.wikiPages && record.wikiPages.length > 0
      ? `- **新建/更新页**：\n${wikiList}`
      : '- **新建/更新页**：（无）',
    '',
    '',
  ].join('\n');

  let existing = '';
  if (existsSync(logPath)) existing = readFileSync(logPath, 'utf-8');

  if (!existing) {
    // Bootstrap a minimal log.md with header + first entry.
    const header = '# Log\n\n> 操作时间线，append-only。每条格式：`## [YYYY-MM-DD] 操作类型 | 标题`\n> 可用 `grep "^## \\[" log.md | tail -10` 快速查最近操作。\n\n';
    writeFileSync(logPath, header + entry, 'utf-8');
    return;
  }

  // Insert new entry between intro block and first existing `## [` section.
  const firstSection = existing.search(/^## \[/m);
  if (firstSection === -1) {
    // No existing sections — append at end.
    const sep = existing.endsWith('\n') ? '' : '\n';
    writeFileSync(logPath, existing + sep + entry, 'utf-8');
  } else {
    const before = existing.slice(0, firstSection);
    const after = existing.slice(firstSection);
    writeFileSync(logPath, before + entry + after, 'utf-8');
  }
}

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
        const dest = r.archivedTo ?? r.workbenchMd ?? r.workbenchDir ?? '-';
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
    .option(
      '--step <steps>',
      `mark step(s) as done. single: archive | multi: archive,wiki,backlink,lint. valid: ${VALID_STEPS.join(', ')}`,
    )
    .option('--archived-to <path>', 'relative path where the source was moved (e.g. 原料/剪藏/xxx)')
    .option('--wiki-page <path...>', 'relative path of a wiki page created (can be repeated)')
    .option('--log <body>', 'append a one-paragraph summary to corpus/log.md (CLI auto-fills url/archive/pages)')
    .option('--status <status>', 'explicit status (started|completed|failed)')
    .option('--complete', 'shortcut: mark status=completed')
    .option('--fail <reason>', 'shortcut: mark status=failed with reason')
    .action((url: string, opts: {
      step?: string;
      archivedTo?: string;
      wikiPage?: string[];
      log?: string;
      status?: string;
      complete?: boolean;
      fail?: string;
    }) => {
      const corpus = requireCorpus();
      const patch: Parameters<typeof upsertIngestRecord>[2] = {};

      // --step accepts either a single step ("archive") or a comma-separated
      // chain ("archive,wiki,backlink,lint") so the skill can close the books
      // in one call instead of four CLI invocations.
      let parsedSteps: IngestStep[] = [];
      if (opts.step) {
        parsedSteps = opts.step
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean) as IngestStep[];

        for (const s of parsedSteps) {
          if (!VALID_STEPS.includes(s)) {
            console.error(
              `[lorekit ingest record] invalid step: ${s}. valid: ${VALID_STEPS.join(', ')}`,
            );
            process.exitCode = 2;
            return;
          }
        }

        const existing = loadIngestState(corpus).ingests[url];
        const prev = existing?.stepsDone ?? [];
        patch.stepsDone = [...prev, ...parsedSteps];

        // status precedence: explicit flags win; otherwise, if the chain
        // includes 'lint' it implies completion.
        if (!opts.status && !opts.complete && !opts.fail) {
          if (parsedSteps.includes('lint')) patch.status = 'completed';
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

      // --log: append entry to corpus/log.md AFTER state is updated so the
      // entry can include the freshly-recorded archive path / wiki pages.
      let logAppended = false;
      if (opts.log) {
        try {
          appendLogEntry(corpus, updated, opts.log);
          logAppended = true;
        } catch (e) {
          console.error(`[lorekit ingest record] log append failed: ${(e as Error).message}`);
        }
      }

      console.error(
        `[lorekit ingest record] ${url}\n` +
        `  status: ${updated.status}  steps: ${updated.stepsDone.join(',') || '(none)'}` +
        (logAppended ? '  +log' : ''),
      );
      console.log(JSON.stringify({ ...updated, logAppended }));
    });

  // ---------- check ----------
  // Pre-flight broken-link check for one or more wiki pages. Used by the
  // wiki-ingest skill RIGHT AFTER writing new pages, before recording the
  // backlink step. Catches `[[xxx]]` whose target page doesn't exist so the
  // skill can either create the target stub or downgrade `[[xxx]]` to plain
  // text — instead of leaving the corpus in a state lint will flag later.
  group
    .command('check <files...>')
    .description('Scan given wiki pages for broken [[wikilinks]] (pre-commit check)')
    .action((files: string[]) => {
      const corpus = requireCorpus();

      // Build the same lookup sets lint.ts uses (stems + bare names + folder
      // packages like 原料/剪藏/xxx/article.md → 原料/剪藏/xxx).
      const allMd = collectMdFiles(corpus);
      const stemSet = new Set<string>();
      const baseNameSet = new Set<string>();
      for (const file of allMd) {
        const rel = relative(corpus, file);
        const stem = rel.replace(/\.md$/, '');
        stemSet.add(stem);
        baseNameSet.add(stem.split('/').pop()!);
        if (stem.endsWith('/article')) {
          const folder = stem.replace(/\/article$/, '');
          stemSet.add(folder);
          baseNameSet.add(folder.split('/').pop()!);
        }
      }

      const stripCode = (s: string) =>
        s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');

      const broken: { file: string; link: string }[] = [];
      const okLinks: { file: string; link: string }[] = [];
      const checked: string[] = [];

      for (const f of files) {
        const abs = f.startsWith('/') ? f : join(process.cwd(), f);
        if (!existsSync(abs)) {
          console.error(`[lorekit ingest check] file not found: ${f}`);
          process.exitCode = 2;
          continue;
        }
        const rel = relative(corpus, abs);
        checked.push(rel);

        let content: string;
        try {
          content = stripCode(readFileSync(abs, 'utf-8'));
        } catch {
          continue;
        }

        const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
        let m: RegExpExecArray | null;
        const seen = new Set<string>();
        while ((m = linkRe.exec(content)) !== null) {
          const target = m[1].trim();
          if (seen.has(target)) continue;
          seen.add(target);
          if (stemSet.has(target) || baseNameSet.has(target)) {
            okLinks.push({ file: rel, link: target });
          } else {
            broken.push({ file: rel, link: target });
          }
        }
      }

      const result = { checked, ok: okLinks, broken };

      if (broken.length === 0) {
        console.error(
          `[lorekit ingest check] ${checked.length} file(s), ${okLinks.length} link(s) ok, no broken links`,
        );
      } else {
        console.error(
          `[lorekit ingest check] ${broken.length} broken link(s) found:`,
        );
        for (const b of broken) {
          console.error(`  ✗ ${b.file}: [[${b.link}]]`);
        }
        process.exitCode = 1;
      }
      console.log(JSON.stringify(result));
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
