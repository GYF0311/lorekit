import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { warn } from './logger.js';

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
  } catch (e) {
    // VERSION 文件应当随 lorekit 包发布，缺了说明安装环境异常 — 用 warn 不静默
    warn(`VERSION file missing or unreadable: ${(e as Error).message}`);
    return 'unknown';
  }
}
