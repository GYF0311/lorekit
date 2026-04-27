/**
 * Markdown file chunker — splits .md files into embeddable chunks.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import matter from 'gray-matter';

const MAX_CHUNK_CHARS = 800;
const MIN_CHUNK_CHARS = 20;

export interface Chunk {
  section: string;
  content: string;
}

export function chunkFile(filePath: string, _corpusRoot: string): Chunk[] {
  const raw = readFileSync(filePath, 'utf-8');
  const { data: fm, content: body } = matter(raw);

  let title = (fm.title as string) || '';
  const type = (fm.type as string) || '';

  if (!title) {
    const m = body.match(/^#\s+(.+)/m);
    title = m ? m[1].trim() : basename(filePath, '.md');
  }

  // Split body by ## headings
  const parts = body.split(/^(## .+)$/m);

  const sections: Array<[string, string]> = [];
  if (parts[0].trim()) {
    sections.push(['_intro', parts[0]]);
  }
  for (let i = 1; i < parts.length - 1; i += 2) {
    const heading = parts[i].replace(/^#+\s*/, '').trim();
    const secBody = i + 1 < parts.length ? parts[i + 1] : '';
    sections.push([heading, secBody]);
  }

  let prefix = '';
  if (title) prefix += `[${title}] `;
  if (type) prefix += `[${type}] `;

  const chunks: Chunk[] = [];

  for (const [heading, secBody] of sections) {
    const trimmed = secBody.trim();
    if (!trimmed || trimmed.length < MIN_CHUNK_CHARS) continue;

    if (trimmed.length > MAX_CHUNK_CHARS) {
      const paragraphs = trimmed.split('\n\n');
      let current = '';
      for (const p of paragraphs) {
        if (current.length + p.length > MAX_CHUNK_CHARS && current) {
          chunks.push({ section: heading, content: prefix + current.trim() });
          current = p;
        } else {
          current = current ? current + '\n\n' + p : p;
        }
      }
      if (current.trim()) {
        chunks.push({ section: heading, content: prefix + current.trim() });
      }
    } else {
      chunks.push({ section: heading, content: prefix + trimmed });
    }
  }

  return chunks;
}
