// Smoke test 共享工具。
// 直接 spawn `node dist/cli.js`，不依赖 npm link 的全局 `lorekit`，CI 也能跑。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
export const REPO_ROOT = resolve(dirname(__filename), '..', '..');
export const CLI = join(REPO_ROOT, 'dist', 'cli.js');
export const VERSION = readFileSync(join(REPO_ROOT, 'VERSION'), 'utf-8').trim();

if (!existsSync(CLI)) {
  // 故意 throw 而不是 t.skip 全部：smoke 是 verify 的最后一步，跑到这里 build 一定已经成功
  throw new Error(`dist/cli.js not found at ${CLI}. 跑 smoke 之前先 npm run build`);
}

/**
 * 跑一次 lorekit 子命令。
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string,string>, timeout?: number }} [opts]
 * @returns {{ status: number|null, stdout: string, stderr: string, error?: Error }}
 */
export function runLorekit(args, opts = {}) {
  const r = spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    cwd: opts.cwd ?? REPO_ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    timeout: opts.timeout ?? 30_000,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error,
  };
}

/**
 * 在 os.tmpdir() 下创建一个唯一空目录，调用方负责 cleanupTmpDir 清理。
 */
export function mkTmpDir(prefix = 'lorekit-smoke-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * 清理 tmpdir。**仅限 os.tmpdir() 子目录，不许扩展到任何用户数据路径**。
 * 收到外部路径时 throw，防止 smoke test 误删真实数据。
 * （此约束跟 LEGACY P4-3 对 restore.ts rmSync 的要求一致。）
 */
export function cleanupTmpDir(p) {
  const root = tmpdir();
  if (!p || !p.startsWith(root)) {
    throw new Error(`refuse to clean ${p}: outside ${root}`);
  }
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

/** 失败时把命令、退出码、stdout、stderr 拼成易读的诊断块 */
export function fmtRun(r, args, expectation = '') {
  return [
    expectation && `expected: ${expectation}`,
    `cmd: lorekit ${args.join(' ')}`,
    `exit: ${r.status}`,
    `stdout: ${r.stdout.slice(0, 500)}${r.stdout.length > 500 ? '…' : ''}`,
    `stderr: ${r.stderr.slice(0, 500)}${r.stderr.length > 500 ? '…' : ''}`,
    r.error ? `spawn error: ${r.error.message}` : '',
  ]
    .filter(Boolean)
    .join('\n  ');
}

/** sqlite-vec 当前是否可加载（用于条件跳过 vector 相关错误路径测试） */
export async function hasSqliteVec() {
  try {
    await import('sqlite-vec');
    return true;
  } catch {
    return false;
  }
}
