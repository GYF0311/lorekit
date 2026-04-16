import type { Command } from 'commander';
import { warn } from '../utils/logger.js';

export function fetchCommand(program: Command) {
  program
    .command('fetch')
    .argument('<url>', 'URL to fetch')
    .option('--out <dir>', 'output directory')
    .option('--force-rich', 'force rich mode (images + full content)')
    .option('--no-images', 'skip image downloads')
    .description('fetch a URL into the corpus (Phase 4 stub)')
    .action((url: string, opts: { out?: string; forceRich?: boolean; images?: boolean }) => {
      warn(
        `fetch engine not yet migrated to TypeScript, use: wiki fetch ${url}`,
      );
    });
}
