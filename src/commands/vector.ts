import type { Command } from 'commander';
import { warn } from '../utils/logger.js';

export function vectorCommand(program: Command) {
  program
    .command('vector')
    .argument('<action>', 'sync | query | status')
    .description('vector search engine (Phase 3 stub)')
    .action((action: string) => {
      warn(
        `vector engine not yet migrated to TypeScript, use: wiki vector ${action}`,
      );
    });
}
