// fetch happy path + error path smoke。
// cli-meta.test.mjs 只测了 `lorekit fetch` 不带 url 的参数错路径，本文件补 happy。
//
// 设计：fork 一个独立子进程跑 node:http server（不能在主进程里跑，因为
// `runLorekit` 用 spawnSync 会阻塞主线程的 event loop，server 无法 accept
// 连接）。子进程通过 IPC 把 listen 到的随机端口发回；测试结束 kill 子进程。
//
// 验证：
//   - exit 0
//   - stdout 是 status=ok 的 JSON
//   - <tmpdir>/<slug>.md 落盘且含 frontmatter source_url 字段
//
// 关于 SSRF 守卫：当前 main 的 fetcher/http.ts 不拒绝 localhost；若未来 PR 加了
// SSRF guard，可通过 LOREKIT_FETCH_ALLOW_PRIVATE=1（或类似 env）绕过本测试。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = join(__dirname, 'fixtures', 'mock-fetch-server.mjs');

/**
 * fork 一个独立子进程跑 mock HTTP server。
 * 子进程通过 IPC（`process.send({port})`）把监听端口告诉主进程。
 * 返回 { url, close }；close 必须在 finally 里调用，否则会 leak 子进程。
 */
function startMockServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_SCRIPT], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('mock server did not report port within 5s'));
    }, 5000);
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.once('message', (msg) => {
      clearTimeout(timer);
      if (!msg || typeof msg !== 'object' || typeof msg.port !== 'number') {
        child.kill('SIGKILL');
        reject(new Error(`unexpected message from server: ${JSON.stringify(msg)}`));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${msg.port}/`,
        close: () =>
          new Promise((res) => {
            child.once('exit', () => res());
            child.kill('SIGTERM');
            // Safety: 1s 后还没退就 SIGKILL
            setTimeout(() => child.kill('SIGKILL'), 1000);
          }),
      });
    });
    child.once('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`failed to spawn mock server: ${e.message} (stderr: ${stderr})`));
    });
    child.once('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`mock server exited early with code ${code} (stderr: ${stderr})`));
      }
    });
  });
}

test('fetch happy path: 本地 mock server → markdown + frontmatter 落盘', async () => {
  const tmp = mkTmpDir('lorekit-smoke-fetch-');
  const { url, close } = await startMockServer();
  try {
    const args = ['fetch', url, '--out', tmp, '--no-images'];
    const r = runLorekit(args);
    assert.equal(r.status, 0, fmtRun(r, args, 'exit 0'));

    // stdout 单行 JSON
    let parsed;
    assert.doesNotThrow(
      () => {
        parsed = JSON.parse(r.stdout.trim());
      },
      fmtRun(r, args, 'stdout 是合法 JSON'),
    );
    assert.equal(parsed.status, 'ok', fmtRun(r, args, `status=ok, 实际 ${parsed.status}`));
    assert.equal(parsed.url, url, fmtRun(r, args, 'echo url'));
    assert.equal(parsed.title, 'Smoke Mock Article', fmtRun(r, args, '抽 og:title'));
    assert.equal(parsed.author, 'lorekit-smoke', fmtRun(r, args, '抽 meta[name=author]'));
    assert.equal(parsed.publishDate, '2026-05-14', fmtRun(r, args, '抽 article:published_time'));
    assert.equal(parsed.sourceLayer, 'L1', fmtRun(r, args, 'L1 native fetch 成功'));

    // 物理验证：tmp 下应有 <slug>.md，含 frontmatter 关键字段
    const mdFiles = readdirSync(tmp).filter((n) => n.endsWith('.md'));
    assert.ok(mdFiles.length === 1, fmtRun(r, args, `expected 1 .md in tmp, got ${mdFiles.length}`));
    const mdPath = join(tmp, mdFiles[0]);
    const content = readFileSync(mdPath, 'utf-8');
    // frontmatter 字段（参考 fetcher/frontmatter.ts 的 buildFrontmatter 输出）
    assert.match(content, /^---\n/, `expected frontmatter at top of ${mdPath}`);
    assert.match(content, new RegExp(`source_url:\\s*${url.replace(/[/:]/g, '\\$&')}`), '含 source_url');
    assert.match(content, /source_date:\s*2026-05-14/, '含 source_date');
    assert.match(content, /source_kind:\s*article/, '含 source_kind: article');
    assert.match(content, /lorekit-smoke-mock-marker/, 'markdown body 含原文 marker');
  } finally {
    await close();
    cleanupTmpDir(tmp);
  }
});

test('fetch error path: 不可达的 host → exit 1 + status=error JSON', () => {
  const tmp = mkTmpDir('lorekit-smoke-fetch-err-');
  try {
    // RFC 5737 documentation-only 段，永远不可路由
    const args = ['fetch', 'http://192.0.2.1:1/', '--out', tmp, '--no-images'];
    const r = runLorekit(args, { timeout: 90_000 });
    assert.equal(r.status, 1, fmtRun(r, args, 'exit 1 (network error)'));
    // stdout 应仍是 JSON（fetch 一路 catch 到 error 也会输出 result）
    let parsed;
    assert.doesNotThrow(
      () => {
        parsed = JSON.parse(r.stdout.trim());
      },
      fmtRun(r, args, 'stdout 是合法 JSON 即使 error'),
    );
    assert.equal(parsed.status, 'error', fmtRun(r, args, `status=error, 实际 ${parsed.status}`));
  } finally {
    cleanupTmpDir(tmp);
  }
});
