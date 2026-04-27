import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { dateToYMDUtc } from './date.js';

export type FrontmatterData = Record<string, unknown>;

export interface ParsedMarkdown {
  data: FrontmatterData;
  content: string;
}

const VERIFY_FIELDS = new Set(['raw_sha256', 'last_verified', 'possibly_outdated']);
const PATCH_FIELDS = new Set(['slug', ...VERIFY_FIELDS]);

export function readMarkdown(filePath: string): ParsedMarkdown {
  const parsed = matter(readFileSync(filePath, 'utf-8'));
  return { data: parsed.data as FrontmatterData, content: parsed.content };
}

function yamlScalar(value: unknown): string {
  if (value instanceof Date) return dateToYMDUtc(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  const s = String(value);
  if (/^[\w\u4e00-\u9fff./ -]+$/.test(s)) return s;
  return JSON.stringify(s);
}

function serializeYaml(data: FrontmatterData): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => yamlScalar(v)).join(', ')}]`);
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }
  return lines.join('\n') + '\n';
}

export function writeMarkdown(filePath: string, data: FrontmatterData, content: string): void {
  const raw = readFileSync(filePath, 'utf-8');
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const block = splitFrontmatter(raw);
  const body = content.startsWith('\n') ? content : `\n${content}`;

  if (!block) {
    writeFileSync(filePath, `---${newline}${serializeYaml(data)}---${body}`, 'utf-8');
    return;
  }

  const lines = block.yaml.split(/\r?\n/);
  const toAppend: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (!PATCH_FIELDS.has(key)) continue;
    if (!isWritableScalar(value)) continue;
    const nextLine = `${key}: ${serializeInline(value)}`;
    const existing = topLevelKeyLine(lines, key);
    if (existing >= 0) {
      if (lines[existing] === nextLine) continue;
      lines[existing] = nextLine;
    } else {
      toAppend.push(nextLine);
    }
  }

  const yaml = [...lines, ...toAppend].filter((line, i, arr) => i < arr.length - 1 || line !== '');
  writeFileSync(filePath, `---${newline}${yaml.join(newline)}${newline}---${body}`, 'utf-8');
}

/**
 * 计算 source 完整性 hash 时排除校验字段本身，避免 raw_sha256 写入后改变自身。
 */
export function canonicalMarkdownForHash(data: FrontmatterData, content: string): string {
  const normalized: FrontmatterData = {};
  for (const [key, value] of Object.entries(data)) {
    if (VERIFY_FIELDS.has(key)) continue;
    normalized[key] = normalizeValue(value);
  }
  const body = content.startsWith('\n') ? content : `\n${content}`;
  return `${stableStringify(normalized)}\n${body}`;
}

export function setFieldIfMissing(data: FrontmatterData, key: string, value: unknown): boolean {
  if (data[key]) return false;
  data[key] = value;
  return true;
}

function splitFrontmatter(raw: string): { yaml: string; body: string } | null {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) return null;
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

function isWritableScalar(value: unknown): boolean {
  if (value instanceof Date) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  return Array.isArray(value) && value.every(isWritableScalar);
}

function serializeInline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => yamlScalar(v)).join(', ')}]`;
  return yamlScalar(value);
}

function topLevelKeyLine(lines: string[], key: string): number {
  const re = new RegExp(`^${escapeRegExp(key)}\\s*:`);
  return lines.findIndex((line) => re.test(line));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return dateToYMDUtc(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = normalizeValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}
