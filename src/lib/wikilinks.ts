import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { collectMdFiles, extractFrontmatter } from './corpus.js';

export interface WikilinkOccurrence {
  file: string;
  label: string;
}

export interface LinkTarget {
  slug: string;
  file: string;
  title?: string;
  type?: string;
  aliases: string[];
}

export function stripCodeBlocks(content: string): string {
  return content.replace(/(```|~~~)[\s\S]*?\1/g, '').replace(/`[^`\n]+`/g, '');
}

function transformNonCode(content: string, transform: (segment: string) => string): string {
  const codeRe = /((```|~~~)[\s\S]*?\2|`[^`\n]+`)/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeRe.exec(content)) !== null) {
    out += transform(content.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  out += transform(content.slice(last));
  return out;
}

export function extractWikilinkLabels(content: string): string[] {
  const labels: string[] = [];
  const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(stripCodeBlocks(content))) !== null) {
    labels.push(m[1].trim());
  }
  return labels;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function collectLinkTargets(corpus: string): LinkTarget[] {
  return collectMdFiles(corpus).map((filePath) => {
    const rel = relative(corpus, filePath);
    const stem = rel.replace(/\.md$/, '');
    const fm = extractFrontmatter(filePath);
    const slug = typeof fm.slug === 'string' && fm.slug ? fm.slug : stem;
    const aliases = arrayOfStrings(fm.aliases);
    const title = typeof fm.title === 'string' ? fm.title : undefined;
    if (title) aliases.push(title);

    if (stem.endsWith('/article')) {
      const folderStem = stem.replace(/\/article$/, '');
      aliases.push(folderStem.split('/').pop() ?? folderStem);
    }

    return {
      slug,
      file: rel,
      title,
      type: typeof fm.type === 'string' ? fm.type : undefined,
      aliases: [...new Set(aliases.filter(Boolean))],
    };
  });
}

export function buildTargetSets(targets: LinkTarget[]): {
  stemSet: Set<string>;
  baseNameSet: Set<string>;
} {
  const stemSet = new Set<string>();
  const baseNameSet = new Set<string>();
  for (const target of targets) {
    const stem = target.file.replace(/\.md$/, '');
    stemSet.add(stem);
    stemSet.add(target.slug);
    baseNameSet.add(stem.split('/').pop()!);
    baseNameSet.add(target.slug.split('/').pop()!);
    for (const alias of target.aliases) baseNameSet.add(alias);
  }
  return { stemSet, baseNameSet };
}

export function resolveLabel(label: string, targets: LinkTarget[]): LinkTarget | undefined {
  return targets.find((target) => {
    const stem = target.file.replace(/\.md$/, '');
    const base = stem.split('/').pop();
    const slugBase = target.slug.split('/').pop();
    return (
      label === stem ||
      label === target.slug ||
      label === base ||
      label === slugBase ||
      target.aliases.includes(label)
    );
  });
}

export function collectWikilinkOccurrences(corpus: string): WikilinkOccurrence[] {
  const out: WikilinkOccurrence[] = [];
  for (const filePath of collectMdFiles(corpus)) {
    const rel = relative(corpus, filePath);
    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    for (const label of extractWikilinkLabels(content)) {
      out.push({ file: rel, label });
    }
  }
  return out;
}

export function replaceWikilinkLabel(
  content: string,
  label: string,
  replacement: string,
  opts: { alias?: string } = {},
): { content: string; count: number } {
  let count = 0;
  const linkRe = /\[\[([^\]|#]+)([^\]]*)\]\]/g;
  const next = transformNonCode(content, (segment) =>
    segment.replace(linkRe, (match, rawLabel: string, suffix: string) => {
      if (rawLabel.trim() !== label) return match;
      count++;
      const { anchor, alias } = parseWikilinkSuffix(suffix);
      const visibleAlias = opts.alias ?? alias;
      return `[[${replacement}${anchor}${visibleAlias ? `|${visibleAlias}` : ''}]]`;
    }),
  );
  return { content: next, count };
}

export function plainWikilinkLabel(
  content: string,
  label: string,
): { content: string; count: number } {
  let count = 0;
  const linkRe = /\[\[([^\]|#]+)([^\]]*)\]\]/g;
  const next = transformNonCode(content, (segment) =>
    segment.replace(linkRe, (match, rawLabel: string, suffix: string) => {
      if (rawLabel.trim() !== label) return match;
      count++;
      const { alias } = parseWikilinkSuffix(suffix);
      return alias ?? label;
    }),
  );
  return { content: next, count };
}

function parseWikilinkSuffix(suffix: string): { anchor: string; alias?: string } {
  const pipe = suffix.indexOf('|');
  if (pipe >= 0) {
    return {
      anchor: suffix.slice(0, pipe),
      alias: suffix.slice(pipe + 1) || undefined,
    };
  }
  return { anchor: suffix };
}

export function linkFileExists(corpus: string, rel: string): boolean {
  return existsSync(join(corpus, rel));
}

export function labelToSlug(label: string): string {
  return label
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function relStem(rel: string): string {
  return rel.replace(/\.md$/, '');
}

export function baseNameWithoutMd(rel: string): string {
  return basename(rel, '.md');
}
