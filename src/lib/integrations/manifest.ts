import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface GbrainExportManifestPage {
  sourcePath: string;
  exportPath: string;
  title: string | null;
  type: string | null;
  hash: string;
  bytes: number;
  status: 'exported';
}

export interface GbrainExportManifestSkipped {
  sourcePath: string;
  reason: string;
}

export interface GbrainExportManifest {
  version: 1;
  integration: 'gbrain';
  source: 'lorekit';
  corpus: string;
  exportedAt: string;
  pages: GbrainExportManifestPage[];
  skipped: GbrainExportManifestSkipped[];
  warnings: string[];
}

export function writeJsonFile(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}
