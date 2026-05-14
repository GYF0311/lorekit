// fetch SSRF guard smoke（PR #5）。
//
// 验证两条核心路径：
// 1. 默认配置下，`lorekit fetch http://127.0.0.1:<port>/x` 应被 SSRF guard 拒绝，
//    退出码非 0，输出（stdout 或 stderr）含 "private" / "PRIVATE_ADDRESS" 关键字
// 2. 设置 `LOREKIT_FETCH_ALLOW_PRIVATE=1` opt-out 后，应能跨过 guard 进入实际网络请求，
//    然后因端口关闭（或 antibot 报错）失败 —— 失败原因**不应**是 PRIVATE_ADDRESS
//
// 注意：这里用 127.0.0.1 + 一个大概率没人监听的随机高位端口；fetch.ts 在 corpus 外
// 跑也支持（会写到 /tmp/lorekit-fetch），方便从 REPO_ROOT 直接调用。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

// 用一个大概率空闲的高位端口（动态 / 临时端口范围），避免误中真实服务
const UNUSED_PORT = 59387;
const PRIVATE_URL = `http://127.0.0.1:${UNUSED_PORT}/lorekit-ssrf-smoke`;

test('SSRF guard 默认拒绝抓取 127.0.0.1（私网）目标', () => {
  const tmp = mkTmpDir('lorekit-smoke-ssrf-deny-');
  try {
    const args = ['fetch', PRIVATE_URL];
    const r = runLorekit(args, { cwd: tmp });
    assert.notEqual(r.status, 0, fmtRun(r, args, 'exit != 0 (private 被拒)'));
    // stdout 走 JSON（含 reason: PRIVATE_ADDRESS_BLOCKED），stderr 可能有补充提示
    const combined = `${r.stdout}\n${r.stderr}`;
    assert.match(
      combined,
      /private|PRIVATE_ADDRESS/i,
      fmtRun(r, args, 'output 含 "private" / "PRIVATE_ADDRESS"'),
    );
  } finally {
    cleanupTmpDir(tmp);
  }
});

test('SSRF guard 在 LOREKIT_FETCH_ALLOW_PRIVATE=1 时放行（仍会因端口不通而失败，但理由不再是 private）', () => {
  const tmp = mkTmpDir('lorekit-smoke-ssrf-allow-');
  try {
    const args = ['fetch', PRIVATE_URL];
    const r = runLorekit(args, {
      cwd: tmp,
      env: { LOREKIT_FETCH_ALLOW_PRIVATE: '1' },
    });
    // 端口空闲 → ECONNREFUSED → fetcher 走 L2（playwright 缺也返回 null）→ ANTIBOT_BLOCKED
    // 总之 exit 非 0，但失败 reason 不应是 PRIVATE_ADDRESS_BLOCKED
    assert.notEqual(r.status, 0, fmtRun(r, args, 'exit != 0 (端口拒绝)'));
    const combined = `${r.stdout}\n${r.stderr}`;
    assert.doesNotMatch(
      combined,
      /PRIVATE_ADDRESS_BLOCKED/,
      fmtRun(r, args, 'output 不含 "PRIVATE_ADDRESS_BLOCKED"（opt-out 应已放行）'),
    );
  } finally {
    cleanupTmpDir(tmp);
  }
});
