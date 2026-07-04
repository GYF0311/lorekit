import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import trash from 'trash';
import { requireCorpus } from '../lib/corpus.js';
import { isWithin, relPosix } from '../lib/paths.js';
import { ok, err, print } from '../utils/logger.js';

/**
 * `lorekit trash` — 跨平台的可恢复删除（macOS 废纸篓 / Windows 回收站 / Linux trash）。
 *
 * 定位：skill 层清理 `_工作台/` 过渡副本、废稿时的统一入口，取代平台相关的
 * `/usr/bin/trash`。硬边界：
 *   - 只允许 corpus 内路径；
 *   - `原料/` 只读，拒绝；
 *   - `知识库/` 走 `lorekit remove`（provenance-aware），拒绝；
 *   - `.wiki/` 元数据拒绝。
 */
export function trashCommand(program: Command): void {
  program
    .command('trash')
    .description('Move corpus files/dirs to OS Trash / Recycle Bin (recoverable; never rm)')
    .argument('<paths...>', 'corpus-relative or absolute paths inside the corpus')
    .action(async (paths: string[]) => {
      const corpus = requireCorpus();
      const targets: string[] = [];
      for (const input of paths) {
        const abs = resolve(isAbsolute(input) ? input : join(corpus, input));
        if (!isWithin(corpus, abs)) {
          err(`refusing to trash outside the corpus: ${input}`);
          process.exit(2);
        }
        const rel = relPosix(corpus, abs);
        if (rel === '') {
          err('refusing to trash the corpus root');
          process.exit(2);
        }
        if (rel === '原料' || rel.startsWith('原料/')) {
          err(`原料/ is read-only; refusing: ${rel}`);
          process.exit(2);
        }
        if (rel === '知识库' || rel.startsWith('知识库/')) {
          err(`use \`lorekit remove\` for 知识库/ pages (provenance-aware cleanup): ${rel}`);
          process.exit(2);
        }
        if (rel === '.wiki' || rel.startsWith('.wiki/')) {
          err(`refusing to trash lorekit metadata: ${rel}`);
          process.exit(2);
        }
        if (!existsSync(abs)) {
          err(`not found: ${rel}`);
          process.exit(2);
        }
        targets.push(abs);
      }

      await trash(targets, { glob: false });
      for (const t of targets) print(`  🗑 ${relPosix(corpus, t)}`);
      ok(`moved ${targets.length} item(s) to OS Trash`);
    });
}
