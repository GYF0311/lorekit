// skills ↔ CLI 防漂移检查（TODO-lorekit-cleanup §4）：
// skills/**/SKILL.md 里引用的 `lorekit <cmd> [sub] [--flag]` 必须真实存在。
// 命令清单不硬编码，从 CLI --help 动态提取，CLI 增删命令时测试自动跟随。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, runLorekit, fmtRun } from './_util.mjs';

const SKILLS_DIR = join(REPO_ROOT, 'skills');

// 已知豁免：值为行内容匹配的子串。当前为空；新增豁免必须注明原因。
const ALLOWLIST = [];

/** 解析 commander help 输出里 "Commands:" 段的子命令名 */
function parseCommands(helpText) {
  const lines = helpText.split('\n');
  const start = lines.findIndex((l) => /^Commands:/.test(l.trim()));
  if (start === -1) return [];
  const names = [];
  for (const line of lines.slice(start + 1)) {
    const m = line.match(/^\s{2,}([a-z][a-z-]*)/);
    if (m && m[1] !== 'help') names.push(m[1]);
  }
  return names;
}

/** 提取 help 输出里的所有 --flag */
function parseFlags(helpText) {
  return new Set(helpText.match(/--[a-z][a-z-]*/g) ?? []);
}

function helpOf(args) {
  const r = runLorekit([...args, '--help']);
  assert.equal(r.status, 0, fmtRun(r, [...args, '--help'], 'help exit 0'));
  return r.stdout + r.stderr;
}

/** 收集所有 SKILL.md 文件路径 */
function collectSkillFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...collectSkillFiles(abs));
    else if (entry === 'SKILL.md') out.push(abs);
  }
  return out;
}

test('skills 引用的 lorekit 命令/子命令/flag 必须在 CLI 中真实存在', () => {
  // 1. 从 CLI help 构建事实清单
  const rootHelp = helpOf([]);
  const topCommands = parseCommands(rootHelp);
  assert.ok(topCommands.length >= 10, `top-level 命令解析异常: ${topCommands.join(',')}`);
  const globalFlags = parseFlags(rootHelp);

  /** @type {Map<string, {flags: Set<string>, subs: Map<string, Set<string>>}>} */
  const inventory = new Map();
  for (const cmd of topCommands) {
    const help = helpOf([cmd]);
    const subs = new Map();
    for (const sub of parseCommands(help)) {
      subs.set(sub, parseFlags(helpOf([cmd, sub])));
    }
    inventory.set(cmd, { flags: parseFlags(help), subs });
  }

  // 2. 扫描 skills/**/SKILL.md 的 lorekit 引用
  const problems = [];
  for (const file of collectSkillFiles(SKILLS_DIR)) {
    const rel = file.slice(REPO_ROOT.length + 1);
    const lines = readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      if (ALLOWLIST.some((frag) => line.includes(frag))) return;
      const refRe = /lorekit\s+([a-z][a-z-]*)((?:[^`\n])*)/g;
      let m;
      while ((m = refRe.exec(line)) !== null) {
        const cmd = m[1];
        const rest = m[2] ?? '';
        const loc = `${rel}:${i + 1}`;
        const entry = inventory.get(cmd);
        if (!entry) {
          problems.push(`${loc}: 引用了不存在的命令 \`lorekit ${cmd}\``);
          continue;
        }
        // 子命令：仅当父命令有子命令、且下一个 token 是纯小写词时才校验
        let subEntry = null;
        if (entry.subs.size > 0) {
          const tok = rest.trim().split(/\s+/)[0] ?? '';
          if (/^[a-z][a-z-]*$/.test(tok)) {
            if (!entry.subs.has(tok)) {
              problems.push(`${loc}: \`lorekit ${cmd}\` 没有子命令 \`${tok}\``);
              continue;
            }
            subEntry = entry.subs.get(tok);
          }
        }
        // flag：引用行内 lorekit 之后、遇反引号前的所有 --flag 都必须存在
        for (const flag of rest.match(/--[a-z][a-z-]*/g) ?? []) {
          const known =
            globalFlags.has(flag) || entry.flags.has(flag) || (subEntry?.has(flag) ?? false);
          if (!known) {
            problems.push(`${loc}: \`lorekit ${cmd}\` 没有 flag \`${flag}\``);
          }
        }
      }
    });
  }

  assert.deepEqual(problems, [], `skills ↔ CLI 漂移:\n${problems.join('\n')}`);
});
