// 独立子进程 mock HTTP server，给 fetch-mock.test.mjs 用。
//
// 为什么独立进程：tests/smoke/_util.mjs 的 runLorekit 用 spawnSync，会阻塞主测试
// 进程的 event loop。如果 server 跟测试在同一进程里跑，spawnSync 期间 server
// 无法 accept 连接，子进程的 fetch 直接 timeout/失败，全部走 ANTIBOT_BLOCKED。
//
// 协议：listen 到随机端口后通过 IPC `process.send({port})` 告诉父进程，然后
// 等待 SIGTERM 退出。所有 stdout 写到 stderr，避免污染 IPC。

import { createServer } from 'node:http';

const HTML = `<!DOCTYPE html>
<html><head>
  <meta property="og:title" content="Smoke Mock Article">
  <meta name="author" content="lorekit-smoke">
  <meta property="article:published_time" content="2026-05-14T00:00:00Z">
</head><body>
  <article>
    <h1>Smoke Mock Article</h1>
    <p>This is a fake article body with enough text content to pass the fetcher
    empty_body 50-char guard. lorekit-smoke-mock-marker used to verify markdown body.</p>
  </article>
</body></html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.on('error', (e) => {
  process.stderr.write(`mock server error: ${e.message}\n`);
  process.exit(1);
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    process.stderr.write(`unexpected server address: ${addr}\n`);
    process.exit(1);
  }
  if (typeof process.send !== 'function') {
    process.stderr.write('no IPC channel (process.send unavailable)\n');
    process.exit(1);
  }
  process.send({ port: addr.port });
});

const shutdown = () => {
  server.close(() => process.exit(0));
  // Safety net：1s 还没关就强退
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
