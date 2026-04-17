import type { Command } from 'commander';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  requireCorpus,
  collectMdFiles,
  extractFrontmatter,
} from '../lib/corpus.js';
import { listPendingIngests, nextStepHint } from '../lib/ingest-state.js';

interface OrphanWorkbench {
  dir: string;
  ageDays: number;
}

interface UnreferencedSource {
  path: string;
  title?: string;
  sourceDate?: string;
}

interface DanglingWikilink {
  from: string;
  target: string;
}

const ONE_DAY = 24 * 60 * 60 * 1000;

function collectWikilinkTargets(mdPath: string): string[] {
  const txt = readFileSync(mdPath, 'utf-8');
  const targets: string[] = [];
  const re = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt)) !== null) {
    targets.push(m[1].trim());
  }
  return targets;
}

function slugOfSourcePath(rel: string): string {
  // 原料/剪藏/harness-engineering-kazike/article.md
  // → 原料/剪藏/harness-engineering-kazike
  return rel.replace(/\/article\.md$/, '').replace(/\.md$/, '');
}

export function ingestCheckCommand(program: Command) {
  program
    .command('ingest-check')
    .description('Audit ingest pipeline health: orphan workbench, unreferenced sources, dangling wikilinks')
    .option('--workbench-ttl <days>', 'workbench orphan threshold in days', '7')
    .action(async (opts: { workbenchTtl?: string }) => {
      const corpus = requireCorpus();
      const ttl = Number(opts.workbenchTtl ?? 7);
      const now = Date.now();

      // ---------- 1. Orphan workbench dirs ----------
      const orphans: OrphanWorkbench[] = [];
      const workbench = join(corpus, '_工作台', '收件', 'fetch');
      if (existsSync(workbench)) {
        for (const entry of readdirSync(workbench, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith('.')) continue;
          const full = join(workbench, entry.name);
          const st = statSync(full);
          const ageDays = Math.floor((now - st.mtimeMs) / ONE_DAY);
          if (ageDays >= ttl) {
            orphans.push({ dir: relative(corpus, full), ageDays });
          }
        }
      }

      // ---------- 2. Source pages + wiki wikilinks ----------
      const sourcesRoot = join(corpus, '原料');
      const wikiRoot = join(corpus, '知识库');

      // Build reverse index: which sources are referenced from 知识库/
      const sourceSlugsReferenced = new Set<string>();
      const allWikiTargets: Array<{ from: string; target: string }> = [];
      if (existsSync(wikiRoot)) {
        for (const wikiMd of collectMdFiles(wikiRoot)) {
          for (const t of collectWikilinkTargets(wikiMd)) {
            allWikiTargets.push({ from: relative(corpus, wikiMd), target: t });
            if (t.startsWith('原料/')) sourceSlugsReferenced.add(t);
          }
        }
      }

      // 3. Unreferenced source pages
      const unreferenced: UnreferencedSource[] = [];
      const sourceDirSlugs = new Set<string>();
      if (existsSync(sourcesRoot)) {
        for (const mdPath of collectMdFiles(sourcesRoot)) {
          const rel = relative(corpus, mdPath);
          const slug = slugOfSourcePath(rel);
          sourceDirSlugs.add(slug);
          // also accept dir-style [[原料/剪藏/xxx]] referencing article.md
          const dirSlug = slug;
          const fileSlug = rel.replace(/\.md$/, '');
          const referenced =
            sourceSlugsReferenced.has(dirSlug) ||
            sourceSlugsReferenced.has(fileSlug);
          if (!referenced) {
            const fm = extractFrontmatter(mdPath);
            unreferenced.push({
              path: rel,
              title: typeof fm.title === 'string' ? fm.title : undefined,
              sourceDate: typeof fm.source_date === 'string' ? fm.source_date : undefined,
            });
          }
        }
      }

      // 4. Dangling wikilinks pointing to 原料/ that don't resolve
      const dangling: DanglingWikilink[] = [];
      for (const { from, target } of allWikiTargets) {
        if (!target.startsWith('原料/')) continue;
        // resolve target as directory (原料/xxx/yyy) or file (原料/xxx/yyy[.md])
        const asDirSlug = target;
        const asFileSlug = target;
        const dirExists = sourceDirSlugs.has(asDirSlug);
        const fileExists = existsSync(join(corpus, asFileSlug + '.md'));
        if (!dirExists && !fileExists) {
          dangling.push({ from, target });
        }
      }

      // ---------- 5. Pending ingests from state store ----------
      const pending = listPendingIngests(corpus).map((r) => ({
        url: r.url,
        status: r.status,
        stepsDone: r.stepsDone,
        nextStep: nextStepHint(r),
        startedAt: r.startedAt,
      }));

      // ---------- Output ----------
      const report = {
        corpus: relative(process.cwd(), corpus) || '.',
        workbenchTtlDays: ttl,
        pendingIngests: pending,
        orphanWorkbench: orphans,
        unreferencedSources: unreferenced,
        danglingSourceWikilinks: dangling,
      };

      // Pretty summary to stderr, JSON to stdout
      const issueCount =
        pending.length + orphans.length + unreferenced.length + dangling.length;
      const summary = [
        `[lorekit ingest-check] corpus: ${report.corpus}`,
        `  pending ingests (state.json): ${pending.length}`,
        ...pending.slice(0, 5).map((p) => `    - [${p.status}] ${p.url}\n      next → ${p.nextStep}`),
        `  orphan workbench (>${ttl}d): ${orphans.length}`,
        ...orphans.slice(0, 5).map((o) => `    - ${o.dir} (${o.ageDays}d)`),
        `  unreferenced 原料/ pages: ${unreferenced.length}`,
        ...unreferenced.slice(0, 5).map((u) => `    - ${u.path}${u.title ? '  — ' + u.title : ''}`),
        `  dangling [[原料/...]] wikilinks: ${dangling.length}`,
        ...dangling.slice(0, 5).map((d) => `    - ${d.from} → [[${d.target}]]`),
        `  total issues: ${issueCount}`,
      ];
      console.error(summary.join('\n'));
      console.log(JSON.stringify(report));
      if (issueCount > 0) process.exitCode = 1;
    });
}
