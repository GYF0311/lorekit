#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import Database from 'better-sqlite3';
import { findCorpus, collectMdFiles } from './lib/corpus.js';
import { debug } from './utils/logger.js';
import { readVersion } from './utils/fs.js';

// commands
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { statsCommand } from './commands/stats.js';
import { lintCommand } from './commands/lint.js';
import { auditCommand } from './commands/audit.js';
import { indexCommand } from './commands/index.js';
import { installSkillsCommand } from './commands/install-skills.js';
import { snapshotCommand } from './commands/snapshot.js';
import { restoreCommand } from './commands/restore.js';
import { searchCommand } from './commands/search.js';
import { vectorCommand } from './commands/vector.js';
import { fetchCommand } from './commands/fetch.js';
import { ingestCommand } from './commands/ingest.js';
import { syncCommand } from './commands/sync.js';

const version = readVersion();

function showBanner() {
  const corpus = findCorpus();
  let pages = '—';
  let indexed = '0';
  let model = '—';

  if (corpus) {
    try {
      pages = String(collectMdFiles(corpus).length);
    } catch (e) {
      // banner 是 best-effort 装饰，corpus 扫失败时不阻塞用户操作 — 仅 debug 留痕
      debug(`banner: collectMdFiles failed: ${(e as Error).message}`);
    }

    try {
      const dbPath = `${corpus}/.wiki/vector.sqlite`;
      if (existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        const cntRow = db.prepare('SELECT COUNT(*) as c FROM documents').get() as
          | { c: number }
          | undefined;
        indexed = String(cntRow?.c ?? 0);
        const row = db.prepare("SELECT value FROM meta WHERE key='model'").get() as
          | { value: string }
          | undefined;
        model = row?.value ?? '—';
        db.close();
      }
    } catch (e) {
      // 向量库读失败（坏文件 / 锁 / native 加载错）不该阻断 banner 显示
      debug(`banner: vector.sqlite read failed: ${(e as Error).message}`);
    }
  }

  const short = corpus && corpus.length > 45 ? '...' + corpus.slice(-42) : (corpus ?? '—');
  const B = chalk.blue;
  const BB = chalk.blueBright.bold;
  const C = chalk.cyan;
  const D = chalk.dim;
  const W = chalk.white.bold;

  console.log();
  console.log(`  ${BB('██╗      ██████╗ ██████╗ ███████╗██╗  ██╗██╗████████╗')}`);
  console.log(`  ${BB('██║     ██╔═══██╗██╔══██╗██╔════╝██║ ██╔╝██║╚══██╔══╝')}`);
  console.log(`  ${BB('██║     ██║   ██║██████╔╝█████╗  █████╔╝ ██║   ██║   ')}`);
  console.log(`  ${B('██║     ██║   ██║██╔══██╗██╔══╝  ██╔═██╗ ██║   ██║   ')}`);
  console.log(`  ${B('███████╗╚██████╔╝██║  ██║███████╗██║  ██╗██║   ██║   ')}`);
  console.log(`  ${D('╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ')}`);
  console.log(`  ${D('Personal LLM Wiki Toolkit')}  ${C(`v${version}`)}`);
  console.log();
  console.log(`  ${C('corpus')}  ${short}`);
  console.log(`  ${C('pages')}   ${pages.padEnd(10)} ${C('indexed')} ${indexed}`);
  if (model !== '—') console.log(`  ${C('model')}   ${model}`);
  console.log();
  console.log(`  ${W('$ lorekit doctor')}    健康检查`);
  console.log(`  ${W('$ lorekit fetch')}     抓取网页`);
  console.log(`  ${W('$ lorekit search')}    搜索`);
  console.log(`  ${W('$ lorekit --help')}    所有命令`);
  console.log();
}

const program = new Command();

program.name('lorekit').version(version).description('Personal LLM Wiki Toolkit');

// register commands
initCommand(program);
doctorCommand(program);
statsCommand(program);
lintCommand(program);
auditCommand(program);
indexCommand(program);
installSkillsCommand(program);
snapshotCommand(program);
restoreCommand(program);
searchCommand(program);
vectorCommand(program);
fetchCommand(program);
ingestCommand(program);
syncCommand(program);

// no subcommand → show banner
if (process.argv.length <= 2) {
  showBanner();
} else {
  program.parse();
}
