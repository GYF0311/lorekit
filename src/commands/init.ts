import type { Command } from 'commander';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  cpSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { ok, bad, warn, print } from '../utils/logger.js';
import { readVersion, lorekitRoot } from '../utils/fs.js';

const MINIMAL_DIRS = ['原料', '知识库/概念', '知识库/实体', '知识库/摘要', '每日', '系统', '.wiki'];

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function isDirEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  const entries = readdirSync(dir).filter((n) => n !== '.DS_Store' && n !== '.git');
  return entries.length === 0;
}

/**
 * Recursively copy files from src to dest, skipping files that already exist.
 *
 * 顶层目录 `.obsidian/` 由 `deployObsidianGraphConfig` 与 `deployObsidianPlugin`
 * 单独处理（safe-write + 用户提示），这里跳过避免重复/越权覆盖。
 */
function copyTemplateFiles(src: string, dest: string, isRoot = true) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    // 顶层 `.obsidian/` 单独由 deployObsidian* 处理
    if (isRoot && entry.isDirectory() && entry.name === '.obsidian') continue;

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyTemplateFiles(srcPath, destPath, false);
    } else {
      if (!existsSync(destPath)) {
        mkdirSync(join(destPath, '..'), { recursive: true });
        cpSync(srcPath, destPath);
      }
    }
  }
}

function deployObsidianPlugin(corpusPath: string) {
  const pluginSrc = join(lorekitRoot(), 'plugins', 'obsidian-audit');
  const pluginDest = join(corpusPath, '.obsidian', 'plugins', 'lorekit-audit');

  if (!existsSync(pluginSrc)) {
    warn('obsidian-audit plugin not found in lorekit install, skipping');
    return;
  }

  mkdirSync(pluginDest, { recursive: true });
  for (const file of readdirSync(pluginSrc)) {
    cpSync(join(pluginSrc, file), join(pluginDest, file));
  }
  ok('deployed obsidian-audit plugin → .obsidian/plugins/lorekit-audit/');
}

/**
 * safe-write `.obsidian/graph.json`：
 * - 已存在 → 跳过 + stderr 警告（保留用户自定义的 colorGroups / forceGravity 等）
 * - 目标已有 `.obsidian/` 但缺 graph.json → 只写 graph.json
 * - 目标完全没 `.obsidian/` → 建目录 + 写 graph.json
 *
 * 批次 25 引入：把"lorekit 决定的结构（_工作台 / _INDEX / 系统 ...）"
 * 对应的 Obsidian graph filter 作为预设内置，用户无需自己发明一遍。
 */
function deployObsidianGraphConfig(corpusPath: string) {
  const src = join(lorekitRoot(), 'templates', 'default-corpus', '.obsidian', 'graph.json');
  if (!existsSync(src)) {
    // 模板缺失不阻塞 init；warn 即可
    warn('templates/default-corpus/.obsidian/graph.json not found, skipping graph config');
    return;
  }

  const destDir = join(corpusPath, '.obsidian');
  const dest = join(destDir, 'graph.json');

  if (existsSync(dest)) {
    // 绝对不许覆盖用户已有的 graph.json（可能含 colorGroups / forceGravity 等个性化字段）
    warn('.obsidian/graph.json 已存在，跳过写入。推荐 filter 见 docs/QUICKSTART.md');
    return;
  }

  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  cpSync(src, dest);
  ok('deployed Obsidian graph filter → .obsidian/graph.json');
}

function createWikiMeta(corpusPath: string) {
  const wikiDir = join(corpusPath, '.wiki');
  mkdirSync(wikiDir, { recursive: true });

  const version = readVersion();
  writeFileSync(join(wikiDir, 'version'), version + '\n');

  const configPath = join(wikiDir, 'config.yaml');
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      [
        '# lorekit corpus config',
        `version: "${version}"`,
        'lang: zh-CN',
        'frontmatter_required: true',
        '',
      ].join('\n'),
    );
  }
  ok(`created .wiki/version (${version}) + config.yaml`);
}

export function initCommand(program: Command) {
  program
    .command('init')
    .argument('[path]', 'target directory', '.')
    .option('--in-place', 'initialize in-place even if directory is non-empty')
    .option('--minimal', 'only create core directories (no template files)')
    .description('initialize a new lorekit corpus')
    .action(async (targetPath: string, opts: { inPlace?: boolean; minimal?: boolean }) => {
      const resolved = resolve(targetPath);
      const templateDir = join(lorekitRoot(), 'templates', 'default-corpus');

      if (opts.minimal) {
        // Minimal mode: just create core directories
        for (const dir of MINIMAL_DIRS) {
          mkdirSync(join(resolved, dir), { recursive: true });
        }
        createWikiMeta(resolved);
        ok(`minimal corpus initialized at ${resolved}`);
        return;
      }

      if (!isDirEmpty(resolved) && !opts.inPlace) {
        print(chalk.yellow(`\n  target directory is not empty: ${resolved}\n`));
        const answer = await ask(
          '  [b] backup & init  [i] in-place (skip existing)  [c] cancel\n  > ',
        );

        if (answer === 'c' || answer === 'C' || answer === '') {
          bad('cancelled');
          return;
        }
        if (answer === 'b' || answer === 'B') {
          const backupDir = resolved + '.bak.' + Date.now();
          cpSync(resolved, backupDir, { recursive: true });
          ok(`backed up to ${backupDir}`);
        }
        // answer 'i'/'b' both fall through to in-place copy
      }

      // Copy template files (skip existing)
      if (existsSync(templateDir)) {
        copyTemplateFiles(templateDir, resolved);
        ok('template files copied (skipped existing)');
      } else {
        warn('template directory not found, creating minimal structure');
        for (const dir of MINIMAL_DIRS) {
          mkdirSync(join(resolved, dir), { recursive: true });
        }
      }

      createWikiMeta(resolved);
      deployObsidianGraphConfig(resolved);
      deployObsidianPlugin(resolved);

      print();
      ok(chalk.bold(`corpus initialized at ${resolved}`));
    });
}
