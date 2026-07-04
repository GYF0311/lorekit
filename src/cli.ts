#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { findCorpus, collectMdFiles } from './lib/corpus.js';
import { debug, print } from './utils/logger.js';
import { readVersion } from './utils/fs.js';

// commands
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { statsCommand } from './commands/stats.js';
import { lintCommand } from './commands/lint.js';
import { auditCommand } from './commands/audit.js';
import { indexCommand } from './commands/dir-index.js';
import { installSkillsCommand } from './commands/install-skills.js';
import { snapshotCommand } from './commands/snapshot.js';
import { restoreCommand } from './commands/restore.js';
import { searchCommand } from './commands/search.js';
import { fetchCommand } from './commands/fetch.js';
import { ingestCommand } from './commands/ingest.js';
import { syncCommand } from './commands/sync.js';
import { obsidianTuneCommand } from './commands/obsidian-tune.js';
import { removeCommand } from './commands/remove.js';
import { linksCommand } from './commands/links.js';
import { workbenchCommand } from './commands/workbench.js';

const version = readVersion();

function showBanner() {
  const corpus = findCorpus();
  let pages = '—';

  if (corpus) {
    try {
      pages = String(collectMdFiles(corpus).length);
    } catch (e) {
      // banner 是 best-effort 装饰，corpus 扫失败时不阻塞用户操作 — 仅 debug 留痕
      debug(`banner: collectMdFiles failed: ${(e as Error).message}`);
    }
  }

  const short = corpus && corpus.length > 45 ? '...' + corpus.slice(-42) : (corpus ?? '—');
  const B = chalk.blue;
  const BB = chalk.blueBright.bold;
  const C = chalk.cyan;
  const D = chalk.dim;
  const W = chalk.white.bold;

  print();
  print(`  ${BB('██╗      ██████╗ ██████╗ ███████╗██╗  ██╗██╗████████╗')}`);
  print(`  ${BB('██║     ██╔═══██╗██╔══██╗██╔════╝██║ ██╔╝██║╚══██╔══╝')}`);
  print(`  ${BB('██║     ██║   ██║██████╔╝█████╗  █████╔╝ ██║   ██║   ')}`);
  print(`  ${B('██║     ██║   ██║██╔══██╗██╔══╝  ██╔═██╗ ██║   ██║   ')}`);
  print(`  ${B('███████╗╚██████╔╝██║  ██║███████╗██║  ██╗██║   ██║   ')}`);
  print(`  ${D('╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ')}`);
  print(`  ${D('Personal LLM Wiki Toolkit')}  ${C(`v${version}`)}`);
  print();
  print(`  ${C('corpus')}  ${short}`);
  print(`  ${C('pages')}   ${pages}`);
  print();
  print(`  ${W('$ lorekit doctor')}    健康检查`);
  print(`  ${W('$ lorekit fetch')}     抓取网页`);
  print(`  ${W('$ lorekit search')}    搜索`);
  print(`  ${W('$ lorekit --help')}    所有命令`);
  print();
}

const program = new Command();

// CONVENTIONS #4：commander 默认对 missing arg / unknown command 都退出 1，
// 跟我们"参数错→2"的语义不匹配。改用 exitOverride 拦截后按错误码分类。
const ARG_ERROR_CODES = new Set([
  'commander.missingArgument',
  'commander.missingMandatoryOptionValue',
  'commander.invalidArgument',
  'commander.invalidOptionArgument',
  'commander.unknownCommand',
  'commander.unknownOption',
  'commander.excessArguments',
]);
program.exitOverride((cmdErr) => {
  // help / version 是正常退出
  if (
    cmdErr.code === 'commander.help' ||
    cmdErr.code === 'commander.version' ||
    cmdErr.code === 'commander.helpDisplayed'
  ) {
    process.exit(0);
  }
  if (ARG_ERROR_CODES.has(cmdErr.code)) {
    process.exit(2);
  }
  process.exit(cmdErr.exitCode || 1);
});

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
fetchCommand(program);
ingestCommand(program);
syncCommand(program);
obsidianTuneCommand(program);
removeCommand(program);
linksCommand(program);
workbenchCommand(program);

// no subcommand → show banner
if (process.argv.length <= 2) {
  showBanner();
} else {
  program.parse();
}
