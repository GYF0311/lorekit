import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function sha256(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export function fileMtime(filePath: string): Date {
  return statSync(filePath).mtime;
}

export function lorekitRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // tsup bundles everything to dist/cli.js — dirname(thisFile) === dist/,
  // so the package root is one level up.
  return join(dirname(thisFile), '..');
}

export function readVersion(): string {
  try {
    return readFileSync(join(lorekitRoot(), 'VERSION'), 'utf-8').trim();
  } catch {
    return 'unknown';
  }
}
