import { Command } from 'commander';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  readlinkSync,
  lstatSync,
  cpSync,
} from 'node:fs';
import { join } from 'node:path';
import { lorekitRoot } from '../utils/fs.js';
import { ok, err, out, print } from '../utils/logger.js';

const SUPPORTED_TARGETS = ['claude-code', 'codex'] as const;
const SUPPORTED_MODES = ['copy', 'symlink'] as const;
const SKILL_PREFIXES = ['wiki-', 'corpus-'] as const;

type InstallTarget = (typeof SUPPORTED_TARGETS)[number];
type InstallMode = (typeof SUPPORTED_MODES)[number];

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function targetSkillsDir(target: InstallTarget): string {
  const home = process.env.HOME ?? '';
  if (target === 'codex') return join(home, '.agents', 'skills');
  return join(home, '.claude', 'skills');
}

function parseTarget(target: string | undefined): InstallTarget | null {
  if (!target) return null;
  return SUPPORTED_TARGETS.includes(target as InstallTarget) ? (target as InstallTarget) : null;
}

function parseMode(mode: string | undefined): InstallMode | null {
  const resolved = mode ?? 'symlink';
  return SUPPORTED_MODES.includes(resolved as InstallMode) ? (resolved as InstallMode) : null;
}

function parseOnlyNames(only: string | undefined): Set<string> | null {
  if (!only) return null;
  return new Set(
    only
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

function isLorekitSkillName(name: string): boolean {
  return SKILL_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function isDefaultSkillForTarget(name: string, target: InstallTarget): boolean {
  if (target === 'codex') return name.startsWith('corpus-') || name === 'wiki-daily';
  return name.startsWith('wiki-');
}

export function installSkillsCommand(program: Command): void {
  const cmd = program
    .command('install-skills')
    .description('Install lorekit-managed skills into a harness (e.g. Claude Code or Codex)')
    .option('--target <harness>', 'Target harness ("claude-code" or "codex")')
    .option('--only <names>', 'Install only selected skill directory names, comma-separated')
    .option('--mode <mode>', 'Install mode: "symlink" or "copy" (default: symlink)')
    .option('--list', 'List currently installed lorekit-managed skill symlinks')
    .option('--uninstall', 'Remove installed skill symlinks');

  cmd.action((opts) => {
    const target = parseTarget(opts.target);
    if (opts.target && !target) {
      err(`target '${opts.target}' not supported; supported targets: claude-code, codex`);
      process.exit(2);
    }
    const listTarget = target ?? 'claude-code';
    const skillsDest = targetSkillsDir(listTarget);

    // --list mode
    if (opts.list) {
      if (!existsSync(skillsDest)) return;
      const names = readdirSync(skillsDest, { encoding: 'utf-8' });
      for (const name of names) {
        if (!isLorekitSkillName(name)) continue;
        const full = join(skillsDest, name);
        if (!isSymlink(full)) continue;
        const target = readlinkSync(full);
        out(`${name} -> ${target}`);
      }
      return;
    }

    // Require --target
    if (!target) {
      if (!opts.target) {
        err('install-skills: --target required');
        process.exit(2);
      }
      err(`target '${opts.target}' not supported; supported targets: claude-code, codex`);
      process.exit(2);
    }

    const mode = parseMode(opts.mode);
    if (!mode) {
      err(`mode '${opts.mode}' not supported; supported modes: copy, symlink`);
      process.exit(2);
    }
    if (opts.uninstall && mode === 'copy') {
      err('install-skills: --uninstall only removes symlink installs');
      process.exit(2);
    }

    mkdirSync(skillsDest, { recursive: true });

    const skillsSrc = join(lorekitRoot(), 'skills');
    if (!existsSync(skillsSrc)) {
      err(`skills directory not found: ${skillsSrc}`);
      process.exit(1);
    }

    const onlyNames = parseOnlyNames(opts.only);

    // Find target defaults or explicitly selected lorekit-managed skill directories.
    const allNames = readdirSync(skillsSrc, { encoding: 'utf-8' });
    const skillNames = allNames.filter((name) => {
      if (!isLorekitSkillName(name)) return false;
      if (onlyNames && !onlyNames.has(name)) return false;
      if (!onlyNames && !isDefaultSkillForTarget(name, target)) return false;
      try {
        return lstatSync(join(skillsSrc, name)).isDirectory();
      } catch {
        return false;
      }
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
        if (mode === 'symlink') {
          // Remove existing symlink if present; real files/directories are user-owned.
          if (isSymlink(dest)) {
            unlinkSync(dest);
          } else if (existsSync(dest)) {
            err(`destination already exists and is not a symlink: ${dest}`);
            process.exit(1);
          }

          symlinkSync(srcDir, dest);
          ok(`linked ${name}`);
        } else {
          if (existsSync(dest)) {
            err(`destination already exists: ${dest}`);
            process.exit(1);
          }
          cpSync(srcDir, dest, { recursive: true });
          ok(`copied ${name}`);
        }
        count++;
      }
    }

    if (count === 0) {
      print('No skills found to install.');
    } else if (!opts.uninstall) {
      const hostName = target === 'codex' ? 'Codex' : 'Claude Code';
      print(`\nInstalled ${count} skill(s). Restart ${hostName} to load them.`);
    }
  });
}
