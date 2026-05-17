import matter from 'gray-matter';

export interface GbrainProjection {
  sourcePath: string;
  exportPath: string;
  gbrainSlug: string;
  kind: string;
}

interface ProjectMarkdownOptions {
  raw: string;
  sourcePath: string;
  exportedAt: string;
  sourceHash: string;
  slugMap: Map<string, string>;
}

interface ProjectMarkdownResult {
  markdown: string;
  lowPrecisionTimeline: string[];
}

const DIRECTORY_KIND_MAP: Record<string, { dir: string; kind: string }> = {
  '概念': { dir: 'concepts', kind: 'concept' },
  '实体': { dir: 'entities', kind: 'entity' },
  '摘要': { dir: 'source', kind: 'source' },
  '专题': { dir: 'concepts', kind: 'topic' },
  '项目': { dir: 'projects', kind: 'project' },
  '人物': { dir: 'people', kind: 'person' },
  '组织': { dir: 'entities', kind: 'entity' },
};

const GBRAIN_DIRS = new Set([
  'people',
  'companies',
  'meetings',
  'concepts',
  'deal',
  'civic',
  'project',
  'projects',
  'source',
  'media',
  'yc',
  'tech',
  'finance',
  'personal',
  'openclaw',
  'entities',
]);

const KIND_DIR_MAP: Record<string, string> = {
  company: 'companies',
  organization: 'companies',
  person: 'people',
  people: 'people',
  meeting: 'meetings',
  concept: 'concepts',
  topic: 'concepts',
  entity: 'entities',
  source: 'source',
  media: 'media',
  project: 'projects',
  deal: 'deal',
  civic: 'civic',
  tech: 'tech',
  finance: 'finance',
  personal: 'personal',
  openclaw: 'openclaw',
  yc: 'yc',
};

const GBRAIN_PAGE_TYPES = new Set([
  'person',
  'company',
  'deal',
  'yc',
  'civic',
  'project',
  'concept',
  'source',
  'media',
  'writing',
  'analysis',
  'guide',
  'hardware',
  'architecture',
  'meeting',
  'note',
  'email',
  'slack',
  'calendar-event',
  'code',
  'image',
  'synthesis',
]);

const PAGE_TYPE_ALIASES: Record<string, string> = {
  entity: 'concept',
  topic: 'concept',
  organization: 'company',
  organisations: 'company',
  organizations: 'company',
  people: 'person',
  meeting: 'meeting',
  project: 'project',
  source: 'source',
  summary: 'source',
};

const RELATION_KEYS = new Set([
  'related',
  'links',
  'sources',
  'source',
  'entities',
  'concepts',
  'depends_on',
  'supports',
  'contradicts',
  'see_also',
]);

/*
 * Slug projection mirrors GBrain's MIT-licensed slugifyPath/slugifySegment
 * behavior from github.com/garrytan/gbrain commit
 * 0c6fcab555b1ca0de80f47dbc2bd692499a82590.
 */
function slugifySegment(segment: string): string {
  return segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9.\s_\-\u3040-\u309f\u30a0-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeCanonicalRef(ref: string): string {
  return ref.replace(/\\/g, '/').replace(/\.md$/i, '');
}

function withoutKnowledgePrefix(sourcePath: string): string[] {
  const normalized = normalizeCanonicalRef(sourcePath);
  return normalized.startsWith('知识库/') ? normalized.slice('知识库/'.length).split('/') : [];
}

function frontmatterGbrainKind(data: Record<string, unknown>): string | null {
  const gbrain = data.gbrain;
  if (!gbrain || typeof gbrain !== 'object' || Array.isArray(gbrain)) return null;
  const kind = (gbrain as Record<string, unknown>).kind;
  return typeof kind === 'string' && kind.trim() ? kind.trim() : null;
}

function frontmatterGbrainDir(data: Record<string, unknown>): string | null {
  const gbrain = data.gbrain;
  if (!gbrain || typeof gbrain !== 'object' || Array.isArray(gbrain)) return null;
  const dir = (gbrain as Record<string, unknown>).dir;
  return typeof dir === 'string' && dir.trim() ? dir.trim() : null;
}

function dirForGbrainConfig(data: Record<string, unknown>, kind: string | null): string | null {
  const explicitDir = frontmatterGbrainDir(data);
  if (explicitDir) {
    const normalized = slugifySegment(explicitDir);
    if (GBRAIN_DIRS.has(normalized)) return normalized;
  }
  if (!kind) return null;
  return KIND_DIR_MAP[slugifySegment(kind)] ?? null;
}

function pageTypeForGbrain(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = slugifySegment(value);
  if (GBRAIN_PAGE_TYPES.has(normalized)) return normalized;
  return PAGE_TYPE_ALIASES[normalized] ?? null;
}

function projectedPageType(sourcePath: string, data: Record<string, unknown>): string {
  const explicitKind = frontmatterGbrainKind(data);
  const fromKind = pageTypeForGbrain(explicitKind);
  if (fromKind) return fromKind;

  const fromType = pageTypeForGbrain(data.type);
  if (fromType) return fromType;

  const top = withoutKnowledgePrefix(sourcePath)[0] ?? '';
  return pageTypeForGbrain(DIRECTORY_KIND_MAP[top]?.kind) ?? 'concept';
}

export function projectCanonicalPage(sourcePath: string, raw: string): GbrainProjection {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const parts = withoutKnowledgePrefix(sourcePath);
  const top = parts[0] ?? '';
  const rest = parts.slice(1);
  const mapped = DIRECTORY_KIND_MAP[top] ?? null;
  const explicitKind = frontmatterGbrainKind(data);
  const kind = explicitKind ?? mapped?.kind ?? (typeof parsed.data.type === 'string' ? parsed.data.type : 'note');
  const dir = mapped?.dir ?? dirForGbrainConfig(data, explicitKind) ?? 'concepts';
  const tailSource = rest.length > 0 ? rest : [top || sourcePath];
  const tail = tailSource
    .map((segment, index) => {
      const rawSegment = index === tailSource.length - 1 ? segment.replace(/\.md$/i, '') : segment;
      return slugifySegment(rawSegment);
    })
    .filter(Boolean)
    .join('/') || 'untitled';
  const gbrainSlug = `${dir}/${tail}`;
  return {
    sourcePath,
    exportPath: `pages/${gbrainSlug}.md`,
    gbrainSlug,
    kind,
  };
}

export function canonicalAliases(sourcePath: string): string[] {
  const normalized = normalizeCanonicalRef(sourcePath);
  const aliases = new Set<string>([normalized]);
  if (!normalized.endsWith('.md')) aliases.add(`${normalized}.md`);
  if (normalized.startsWith('知识库/')) {
    const withoutPrefix = normalized.slice('知识库/'.length);
    aliases.add(withoutPrefix);
    aliases.add(`${withoutPrefix}.md`);
  }
  return [...aliases];
}

export function legacyGbrainSlugForSourcePath(sourcePath: string): string | null {
  const parts = withoutKnowledgePrefix(sourcePath);
  if (parts.length === 0) return null;
  const slug = parts
    .map((segment, index) => {
      const rawSegment = index === parts.length - 1 ? segment.replace(/\.md$/i, '') : segment;
      return slugifySegment(rawSegment);
    })
    .filter(Boolean)
    .join('/');
  return slug || null;
}

function rewriteCanonicalString(value: string, slugMap: Map<string, string>): string {
  return slugMap.get(normalizeCanonicalRef(value)) ?? value;
}

function rewriteRelationValue(value: unknown, slugMap: Map<string, string>): unknown {
  if (typeof value === 'string') return rewriteCanonicalString(value, slugMap);
  if (Array.isArray(value)) return value.map((item) => rewriteRelationValue(item, slugMap));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = rewriteRelationValue(child, slugMap);
    }
    return out;
  }
  return value;
}

function rewriteFrontmatterRelations(
  data: Record<string, unknown>,
  slugMap: Map<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const key of Object.keys(out)) {
    if (RELATION_KEYS.has(key) || key.endsWith('_path') || key.endsWith('_paths')) {
      out[key] = rewriteRelationValue(out[key], slugMap);
    }
  }
  return out;
}

function rewriteWikilinksOutsideCode(content: string, slugMap: Map<string, string>): string {
  const lines = content.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(/\[\[([^\]|#]+)((?:#[^\]|]+)?)(?:\|([^\]]+))?\]\]/g, (match, target, anchor, label) => {
        const mapped = slugMap.get(normalizeCanonicalRef(String(target)));
        if (!mapped) return match;
        const suffix = label === undefined ? '' : `|${label}`;
        return `[[${mapped}${anchor ?? ''}${suffix}]]`;
      });
    })
    .join('\n');
}

function normalizeTimeline(content: string): { content: string; lowPrecision: string[] } {
  const lowPrecision: string[] = [];
  const out = content.replace(
    /^(\s*[-*]\s+)(\d{4}-\d{2}(?:-\d{2})?)\s*(?:\||:)\s*(.+)$/gm,
    (match, prefix, date, text) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return `${prefix}**${date}** | ${text}`;
      }
      lowPrecision.push(`${date} | ${text}`);
      return match.includes(':') ? `${prefix}${date} | ${text}` : match;
    },
  );
  return { content: out, lowPrecision };
}

export function projectMarkdownForGbrain(opts: ProjectMarkdownOptions): ProjectMarkdownResult {
  const parsed = matter(opts.raw);
  const data = rewriteFrontmatterRelations({ ...parsed.data }, opts.slugMap);
  delete data.slug;
  data.type = projectedPageType(opts.sourcePath, data);
  data.lorekit_source_path = opts.sourcePath;
  data.lorekit_layer = 'artifact';
  data.lorekit_hash = opts.sourceHash;
  data.lorekit_exported_at = opts.exportedAt;

  const linkedContent = rewriteWikilinksOutsideCode(parsed.content, opts.slugMap);
  const timeline = normalizeTimeline(linkedContent);
  if (timeline.lowPrecision.length > 0) {
    data.gbrain_low_precision_timeline = timeline.lowPrecision;
  }

  return {
    markdown: matter.stringify(timeline.content, data),
    lowPrecisionTimeline: timeline.lowPrecision,
  };
}
