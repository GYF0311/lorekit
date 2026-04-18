/**
 * ingest-state.ts — Persistent ingest pipeline state.
 *
 * Lives at `<corpus>/.wiki/ingest-state.json`. The authoritative record of
 * "what URL was ingested, at what step, and did we finish it." Used by:
 *   - `lorekit fetch`        : dedupe + resume detection
 *   - `lorekit ingest *`     : step tracking from the skill/agent
 *   - `lorekit ingest-check` : surface in-flight / failed ingests
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Three coarse states the user actually cares about:
 *   started    — URL has entered the pipeline, not finished yet.
 *                (which sub-step it's at is recorded in `stepsDone` below.)
 *   completed  — archived + wiki + lint all done.
 *   failed     — explicit abort with a reason.
 *
 * Finer sub-steps live in `stepsDone[]` so resuming an interrupted ingest
 * can skip already-done work, but the top-level symbol stays one of three.
 */
export type IngestStatus = 'started' | 'completed' | 'failed';

export type IngestStep = 'fetch' | 'archive' | 'wiki' | 'backlink' | 'lint';

export interface IngestRecord {
  url: string;
  title?: string;
  sourceDate?: string; // YYYY-MM-DD
  startedAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  status: IngestStatus;
  stepsDone: IngestStep[];
  workbenchMd?: string; // absolute path to <slug>.md while status=fetched
  // 老字段，兼容 0.3.x 之前的 state.json（产物是 <slug>/article.md 嵌套结构）
  workbenchDir?: string;
  archivedTo?: string; // relative-to-corpus path (e.g. 原料/剪藏/xxx)
  wikiPages?: string[]; // relative-to-corpus paths
  error?: string;
}

export interface IngestStateFile {
  version: 1;
  ingests: Record<string, IngestRecord>;
}

function stateFilePath(corpus: string): string {
  return join(corpus, '.wiki', 'ingest-state.json');
}

export function loadIngestState(corpus: string): IngestStateFile {
  const p = stateFilePath(corpus);
  if (!existsSync(p)) {
    return { version: 1, ingests: {} };
  }
  try {
    const raw = readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, ingests: {} };
    }
    if (!parsed.ingests || typeof parsed.ingests !== 'object') {
      parsed.ingests = {};
    }
    parsed.version = 1;
    return parsed as IngestStateFile;
  } catch {
    return { version: 1, ingests: {} };
  }
}

export function saveIngestState(corpus: string, state: IngestStateFile): void {
  const p = stateFilePath(corpus);
  mkdirSync(dirname(p), { recursive: true });
  const serialized = JSON.stringify(state, null, 2);
  writeFileSync(p, serialized + '\n', 'utf-8');
}

export function getIngestRecord(corpus: string, url: string): IngestRecord | undefined {
  return loadIngestState(corpus).ingests[url];
}

export function upsertIngestRecord(
  corpus: string,
  url: string,
  patch: Partial<IngestRecord>,
): IngestRecord {
  const state = loadIngestState(corpus);
  const now = new Date().toISOString();
  const existing = state.ingests[url];
  const merged: IngestRecord = existing
    ? { ...existing, ...patch, url, updatedAt: now }
    : {
        url,
        startedAt: now,
        updatedAt: now,
        status: (patch.status as IngestStatus) ?? 'started',
        stepsDone: patch.stepsDone ?? [],
        ...patch,
      };
  // Dedup stepsDone
  if (merged.stepsDone) {
    merged.stepsDone = Array.from(new Set(merged.stepsDone));
  }
  state.ingests[url] = merged;
  saveIngestState(corpus, state);
  return merged;
}

export function deleteIngestRecord(corpus: string, url: string): boolean {
  const state = loadIngestState(corpus);
  if (!(url in state.ingests)) return false;
  delete state.ingests[url];
  saveIngestState(corpus, state);
  return true;
}

export function listPendingIngests(corpus: string): IngestRecord[] {
  const state = loadIngestState(corpus);
  return Object.values(state.ingests).filter((r) => r.status !== 'completed');
}

/**
 * Suggest the next step for a resumed ingest.
 * Derived from stepsDone so the caller doesn't have to know the step order.
 */
export function nextStepHint(record: IngestRecord): string {
  if (record.status === 'completed') return 'nothing to do';
  if (record.status === 'failed') {
    return `failed: ${record.error ?? 'unknown error'} — inspect and re-run with --force if you want to retry`;
  }
  const done = new Set(record.stepsDone);
  if (!done.has('fetch')) {
    return 'fetch: nothing recorded yet — run `lorekit fetch <url>`';
  }
  if (!done.has('archive')) {
    return 'archive: mv the workbench dir into 原料/（剪藏|文章|书籍|...）';
  }
  if (!done.has('wiki')) {
    return 'wiki: compile wiki pages in 知识库/（概念|实体|摘要|专题）';
  }
  if (!done.has('lint')) {
    return 'lint: run `lorekit ingest-check`, fix any issues, then `lorekit ingest record <url> --complete`';
  }
  return 'all steps done but status not yet completed — run `lorekit ingest record <url> --complete`';
}
