/**
 * root-index.ts — sync `corpus/index.md` against the actual filesystem.
 *
 * Unlike `_INDEX.md` (auto-overwritten by `lorekit index`), the root index.md
 * carries human-curated one-line summaries that we deliberately preserve.
 * The sync logic is therefore a *merge*, not an overwrite:
 *
 *   - File on disk + already in index   → keep the human-written line as-is
 *   - File on disk + missing from index → append a new line, summary auto-
 *     extracted from `## Compiled Truth` first sentence
 *   - In index + file deleted on disk    → drop the line
 *
 * Only the four wiki sections are managed: 概念 / 实体 / 摘要 / 专题.
 * Any other heading (e.g. "写作", "待研究问题", "空缺") stays untouched.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MANAGED_SECTIONS: { heading: string; subdir: string }[] = [
  { heading: '## 概念', subdir: '知识库/概念' },
  { heading: '## 实体', subdir: '知识库/实体' },
  { heading: '## 摘要', subdir: '知识库/摘要' },
  { heading: '## 专题', subdir: '知识库/专题' },
];

interface DiskEntry {
  slug: string;
  summary: string;
}

function listEntriesInDir(corpus: string, subdir: string): DiskEntry[] {
  const dirPath = join(corpus, subdir);
  if (!existsSync(dirPath)) return [];
  const out: DiskEntry[] = [];
  for (const name of readdirSync(dirPath)) {
    if (name.startsWith('.')) continue;
    if (name === '_INDEX.md') continue;
    if (!name.endsWith('.md')) continue;
    const file = join(dirPath, name);
    const slug = `${subdir}/${name.replace(/\.md$/, '')}`;
    out.push({ slug, summary: extractCompiledTruthSnippet(file) });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Extract a short summary from `## Compiled Truth` — first non-blank paragraph,
 * capped at the first sentence terminator or 80 chars. Falls back to "—".
 *
 * Strips a leading `**bold**` lead-in (common pattern: "**EntityName** is …")
 * so the summary reads like a definition rather than a label.
 */
function extractCompiledTruthSnippet(filePath: string): string {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return '—';
  }

  // Skip frontmatter
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Find ## Compiled Truth section
  const sectionMatch = body.match(/##\s*Compiled Truth\s*\n+([\s\S]*?)(?=\n---|\n##\s|$)/);
  if (!sectionMatch) return '—';

  // First non-blank line/paragraph
  const para = sectionMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!para) return '—';

  // Strip leading **bold** label
  const cleaned = para.replace(/^\*\*([^*]+)\*\*\s*/, '$1 ');

  // First sentence (Chinese 。 or English .) within 80 chars
  const sentenceMatch = cleaned.match(/^(.{1,80}?[。.！？!?])/);
  if (sentenceMatch) return sentenceMatch[1];

  return cleaned.slice(0, 80) + (cleaned.length > 80 ? '…' : '');
}

interface MergeResult {
  added: string[];
  removed: string[];
  kept: number;
}

/**
 * Merge one section in-place. Returns the new content + bookkeeping.
 */
function mergeSection(
  content: string,
  heading: string,
  onDisk: DiskEntry[],
): { newContent: string; result: MergeResult } {
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    // Section header missing — leave content untouched
    return { newContent: content, result: { added: [], removed: [], kept: 0 } };
  }

  // Find end of section: next "## " heading or EOF
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      endIdx = i;
      break;
    }
  }

  const sectionBody = lines.slice(startIdx + 1, endIdx);
  const linkRe = /^-\s+\[\[([^\]|#]+)[^\]]*\]\]/;

  const onDiskSlugs = new Set(onDisk.map((e) => e.slug));
  const seenInIndex = new Set<string>();
  const removed: string[] = [];
  const kept: string[] = [];

  for (const line of sectionBody) {
    const trimmed = line.trim();
    // Strip blank lines and the placeholder; we re-add canonical padding below.
    if (trimmed === '' || trimmed === '（暂无条目）') continue;

    const m = line.match(linkRe);
    if (m) {
      const slug = m[1].trim();
      if (onDiskSlugs.has(slug)) {
        seenInIndex.add(slug);
        kept.push(line);
      } else {
        removed.push(slug);
      }
    } else {
      // preserve any non-link manual annotation (e.g. "> note about this section")
      kept.push(line);
    }
  }

  // Append entries on disk that aren't in the index yet
  const added: string[] = [];
  for (const e of onDisk) {
    if (!seenInIndex.has(e.slug)) {
      kept.push(`- [[${e.slug}]] — ${e.summary}`);
      added.push(e.slug);
    }
  }

  const sectionContentLines = kept.length === 0 ? ['', '（暂无条目）', ''] : ['', ...kept, ''];

  const newLines = [
    ...lines.slice(0, startIdx + 1),
    ...sectionContentLines,
    ...lines.slice(endIdx),
  ];

  return {
    newContent: newLines.join('\n'),
    result: { added, removed, kept: seenInIndex.size },
  };
}

export interface RootIndexSyncResult {
  filePath: string;
  changed: boolean;
  perSection: { heading: string; added: string[]; removed: string[]; kept: number }[];
}

export function refreshRootIndex(corpus: string): RootIndexSyncResult {
  const indexPath = join(corpus, 'index.md');
  if (!existsSync(indexPath)) {
    return { filePath: indexPath, changed: false, perSection: [] };
  }

  const before = readFileSync(indexPath, 'utf-8');
  let content = before;
  const perSection: RootIndexSyncResult['perSection'] = [];

  for (const sec of MANAGED_SECTIONS) {
    const onDisk = listEntriesInDir(corpus, sec.subdir);
    const { newContent, result } = mergeSection(content, sec.heading, onDisk);
    content = newContent;
    perSection.push({ heading: sec.heading, ...result });
  }

  const changed = content !== before;
  if (changed) writeFileSync(indexPath, content, 'utf-8');

  return { filePath: indexPath, changed, perSection };
}
