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

export type IngestStatus =
  | 'fetched'       // fetcher finished, workbench dir exists, nothing archived yet
  | 'archived'      // workbench mv'd into 原料/
  | 'wiki_created'  // 知识库/ pages written
  | 'completed'     // everything done, lint passed
  | 'failed';       // explicit abort

export type IngestStep = 'fetch' | 'archive' | 'wiki' | 'backlink' | 'lint';

export interface IngestRecord {
  url: string;
  title?: string;
  sourceDate?: string;        // YYYY-MM-DD
  startedAt: string;          // ISO timestamp
  updatedAt: string;          // ISO timestamp
  status: IngestStatus;
  stepsDone: IngestStep[];
  workbenchDir?: string;      // absolute path while status=fetched
  archivedTo?: string;        // relative-to-corpus path (e.g. 原料/剪藏/xxx)
  wikiPages?: string[];       // relative-to-corpus paths
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

export function getIngestRecord(
  corpus: string,
  url: string,
): IngestRecord | undefined {
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
      status: (patch.status as IngestStatus) ?? 'fetched',
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
  return Object.values(state.ingests).filter(
    (r) => r.status !== 'completed',
  );
}

/**
 * Suggest the next step for a resumed ingest based on its recorded status.
 * Used to tell the agent where to pick up.
 */
export function nextStepHint(record: IngestRecord): string {
  switch (record.status) {
    case 'fetched':
      return 'archive: mv the workbench dir into 原料/（剪藏|文章|书籍|...）';
    case 'archived':
      return 'wiki: compile wiki pages in 知识库/（概念|实体|摘要|专题）';
    case 'wiki_created':
      return 'backlink + lint: make sure every [[page]] resolves, then run `lorekit ingest-check`';
    case 'completed':
      return 'nothing to do';
    case 'failed':
      return `failed: ${record.error ?? 'unknown error'} — inspect and re-run with --force if you want to retry`;
  }
}
