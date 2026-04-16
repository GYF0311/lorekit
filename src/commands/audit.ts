import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { requireCorpus, collectMdFiles, hasFrontmatter, extractFrontmatter } from '../lib/corpus.js';
import { ok, err } from '../utils/logger.js';

const SEVERITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

interface AuditEntry {
  severity: string;
  sevOrder: number;
  target: string;
  status: string;
  created: string;
  preview: string;
}

function extractPreview(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let inFm = false;
  for (const line of lines) {
    if (line.trimEnd() === '---') {
      if (!inFm) { inFm = true; continue; }
      else { inFm = false; continue; }
    }
    if (inFm) continue;
    if (line.trim() === '') continue;
    return line.trim();
  }
  return '';
}

function listAudit(root: string, filter: 'all' | 'open' | 'resolved'): void {
  const dirs: string[] = [];
  if (filter === 'open' || filter === 'all') dirs.push(join(root, '反馈', '待处理'));
  if (filter === 'resolved' || filter === 'all') dirs.push(join(root, '反馈', '已处理'));

  const entries: AuditEntry[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = collectMdFiles(dir);
    for (const f of files) {
      if (basename(f) === '.gitkeep') continue;
      if (!hasFrontmatter(f)) continue;

      const fm = extractFrontmatter(f);
      const severity = (fm.severity as string) ?? '';
      const target = (fm.target as string) ?? '';
      const created = (fm.created as string) ?? '';
      const status = (fm.status as string) ?? '';
      const preview = extractPreview(f);

      entries.push({
        severity,
        sevOrder: SEVERITY_ORDER[severity] ?? 0,
        target,
        status,
        created,
        preview,
      });
    }
  }

  if (entries.length === 0) {
    console.log('No audit entries found.');
    return;
  }

  // Sort by severity descending
  entries.sort((a, b) => b.sevOrder - a.sevOrder);

  for (const e of entries) {
    console.log(`[${e.severity}] ${e.target} — ${e.preview} (${e.created}) [${e.status}]`);
  }
  console.log();
  console.log(`Total: ${entries.length} entries`);
}

function createAudit(root: string, target: string, severity: string, text: string): void {
  if (!target) { err('audit --create requires --target'); process.exit(2); }
  if (!severity) { err('audit --create requires --severity'); process.exit(2); }
  if (!text) { err('audit --create requires --text'); process.exit(2); }

  if (!['low', 'medium', 'high'].includes(severity)) {
    err(`severity must be low|medium|high, got: ${severity}`);
    process.exit(2);
  }

  const slug = basename(target, '.md')
    .replace(/[\s/]/g, '-')
    .toLowerCase();

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const tsFile = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const tsFm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const filename = `${tsFile}-${slug}.md`;
  const destDir = join(root, '反馈', '待处理');
  mkdirSync(destDir, { recursive: true });

  const dest = join(destDir, filename);
  const content = `---
type: audit
target: ${target}
severity: ${severity}
status: open
created: ${tsFm}
---

${text}
`;

  writeFileSync(dest, content, 'utf-8');
  ok(`created: 反馈/待处理/${filename}`);
  console.log(`  target:   ${target}`);
  console.log(`  severity: ${severity}`);
}

export function auditCommand(program: Command): void {
  const cmd = program
    .command('audit')
    .description('Human feedback loop for corpus content')
    .option('--list', 'List entries (default)')
    .option('--open', 'Only show open (待处理) entries')
    .option('--resolved', 'Only show resolved (已处理) entries')
    .option('--create', 'Create a new audit entry')
    .option('--target <file>', 'Target file path (relative to corpus root)')
    .option('--severity <level>', 'Severity: low | medium | high')
    .option('--text <text>', 'Feedback text');

  cmd.action((opts) => {
    const root = requireCorpus();

    if (opts.create) {
      createAudit(root, opts.target ?? '', opts.severity ?? '', opts.text ?? '');
    } else {
      let filter: 'all' | 'open' | 'resolved' = 'all';
      if (opts.open) filter = 'open';
      else if (opts.resolved) filter = 'resolved';
      listAudit(root, filter);
    }
  });
}
