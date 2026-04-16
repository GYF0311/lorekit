import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { relative, join } from 'node:path';
import chalk from 'chalk';
import { requireCorpus, collectMdFiles, extractFrontmatter } from '../lib/corpus.js';
import { bad, ok, warn } from '../utils/logger.js';

const REQUIRED_FIELDS = ['type', 'title', 'slug', 'created', 'updated'] as const;

interface LintIssue {
  file: string;
  kind: 'missing-field' | 'broken-link' | 'orphan';
  detail: string;
}

export function lintCommand(program: Command) {
  program
    .command('lint')
    .description('check frontmatter, broken wikilinks, and orphan pages')
    .action(() => {
      const corpus = requireCorpus();
      const files = collectMdFiles(corpus);
      const issues: LintIssue[] = [];

      // Build lookup sets for wikilink resolution
      // Map: base name (no ext) → relative path, and full relative stem → relative path
      const stemSet = new Set<string>();
      const baseNameSet = new Set<string>();
      // Track inbound links per base name / stem for orphan detection
      const inboundLinks = new Set<string>();

      for (const file of files) {
        const rel = relative(corpus, file);
        const stem = rel.replace(/\.md$/, '');
        stemSet.add(stem);
        baseNameSet.add(stem.split('/').pop()!);
      }

      // Pass 1: frontmatter + collect wikilinks
      const fileLinks = new Map<string, string[]>();

      for (const file of files) {
        const rel = relative(corpus, file);
        const fm = extractFrontmatter(file);

        // Check required frontmatter fields
        for (const field of REQUIRED_FIELDS) {
          if (!fm[field]) {
            issues.push({
              file: rel,
              kind: 'missing-field',
              detail: `missing frontmatter field: ${field}`,
            });
          }
        }

        // Extract wikilinks
        try {
          const content = readFileSync(file, 'utf-8');
          const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
          const targets: string[] = [];
          let m: RegExpExecArray | null;
          while ((m = linkRe.exec(content)) !== null) {
            const target = m[1].trim();
            targets.push(target);
            inboundLinks.add(target);
          }
          fileLinks.set(rel, targets);
        } catch {
          /* skip unreadable files */
        }
      }

      // Pass 2: broken links
      for (const [rel, targets] of fileLinks) {
        for (const target of targets) {
          if (!stemSet.has(target) && !baseNameSet.has(target)) {
            issues.push({
              file: rel,
              kind: 'broken-link',
              detail: `broken link: [[${target}]]`,
            });
          }
        }
      }

      // Pass 3: orphan pages (no inbound links)
      for (const file of files) {
        const rel = relative(corpus, file);
        const stem = rel.replace(/\.md$/, '');
        const baseName = stem.split('/').pop()!;
        if (!inboundLinks.has(stem) && !inboundLinks.has(baseName)) {
          issues.push({
            file: rel,
            kind: 'orphan',
            detail: 'orphan page (no inbound links)',
          });
        }
      }

      // Output report
      console.log(chalk.bold(`\nlorekit lint — ${corpus}\n`));

      if (issues.length === 0) {
        ok('no issues found');
        console.log();
        return;
      }

      // Group by kind
      const grouped: Record<string, LintIssue[]> = {};
      for (const issue of issues) {
        (grouped[issue.kind] ??= []).push(issue);
      }

      const kindLabels: Record<string, string> = {
        'missing-field': 'frontmatter',
        'broken-link': 'broken links',
        orphan: 'orphan pages',
      };

      for (const [kind, items] of Object.entries(grouped)) {
        console.log(chalk.cyan(`── ${kindLabels[kind] ?? kind} (${items.length}) ──`));
        for (const item of items) {
          bad(`${item.file}: ${item.detail}`);
        }
        console.log();
      }

      console.log(chalk.yellow(`${issues.length} issue(s) total\n`));
      process.exitCode = 1;
    });
}
