#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { findCorpus } from './lib/corpus.js';
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
    const { collectMdFiles } = require('./lib/corpus.js');
    try {
      pages = String(collectMdFiles(corpus).length);
    } catch { /* ignore */ }

    try {
      const dbPath = `${corpus}/.wiki/vector.sqlite`;
      const { existsSync } = require('node:fs');
      if (existsSync(dbPath)) {
        const Database = require('better-sqlite3');
        const db = new Database(dbPath, { readonly: true });
        indexed = String(db.prepare('SELECT COUNT(*) as c FROM documents').get()?.c ?? 0);
        const row = db.prepare("SELECT value FROM meta WHERE key='model'").get() as { value: string } | undefined;
        model = row?.value ?? '—';
        db.close();
      }
    } catch { /* ignore */ }
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

program
  .name('lorekit')
  .version(version)
  .description('Personal LLM Wiki Toolkit');

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
