import { Command } from 'commander';
import { existsSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, readlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { lorekitRoot } from '../utils/fs.js';
import { ok, err } from '../utils/logger.js';

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function installSkillsCommand(program: Command): void {
  const cmd = program
    .command('install-skills')
    .description('Install lorekit skills into a harness (e.g. Claude Code)')
    .option('--target <harness>', 'Target harness (currently only "claude-code")')
    .option('--list', 'List currently installed wiki-* skill symlinks')
    .option('--uninstall', 'Remove installed skill symlinks');

  cmd.action((opts) => {
    const skillsDest = join(process.env.HOME ?? '', '.claude', 'skills');

    // --list mode
    if (opts.list) {
      if (!existsSync(skillsDest)) return;
      const names = readdirSync(skillsDest, { encoding: 'utf-8' });
      for (const name of names) {
        if (!name.startsWith('wiki-')) continue;
        const full = join(skillsDest, name);
        if (!isSymlink(full)) continue;
        const target = readlinkSync(full);
        console.log(`${name} -> ${target}`);
      }
      return;
    }

    // Require --target
    if (!opts.target) {
      err('install-skills: --target required');
      process.exit(2);
    }
    if (opts.target !== 'claude-code') {
      err(`target '${opts.target}' not supported; only 'claude-code' is available`);
      process.exit(2);
    }

    mkdirSync(skillsDest, { recursive: true });

    const skillsSrc = join(lorekitRoot(), 'skills');
    if (!existsSync(skillsSrc)) {
      err(`skills directory not found: ${skillsSrc}`);
      process.exit(1);
    }

    // Find wiki-* skill directories
    const allNames = readdirSync(skillsSrc, { encoding: 'utf-8' });
    const skillNames = allNames.filter(name => {
      if (!name.startsWith('wiki-')) return false;
      try { return lstatSync(join(skillsSrc, name)).isDirectory(); } catch { return false; }
    });

    let count = 0;
    for (const name of skillNames) {
      const srcDir = join(skillsSrc, name);
      const skillFile = join(srcDir, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      const dest = join(skillsDest, name);

      if (opts.uninstall) {
        if (isSymlink(dest)) {
          unlinkSync(dest);
          ok(`removed ${name}`);
          count++;
        }
      } else {
        // Remove existing symlink if present
        if (isSymlink(dest)) unlinkSync(dest);

        symlinkSync(srcDir, dest);
        ok(`linked ${name}`);
        count++;
      }
    }

    if (count === 0) {
      console.log('No skills found to install.');
    } else if (!opts.uninstall) {
      console.log(`\nInstalled ${count} skill(s). Restart Claude Code to load them.`);
    }
  });
}
