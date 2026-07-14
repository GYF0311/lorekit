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

const WEIXIN_CODE_SNIPPET_HTML = `<!DOCTYPE html>
<html><head>
  <meta property="og:title" content="Weixin Code Snippet Fixture">
</head><body>
  <h1 id="activity-name">Weixin Code Snippet Fixture</h1>
  <a id="js_name">lorekit-smoke</a>
  <div id="js_content">
    <p>所以最后的Prompt，是这个样子的：</p>
    <section class="code-snippet__fix code-snippet__js">
      <pre class="code-snippet__js" data-lang="markdown"><code><span># 寓言写作 Prompt</span></code><code><span>line 2 should survive</span></code><code><span>line 3 should survive</span></code></pre>
    </section>
    <p>This fake WeChat article has enough plain text content to pass the
    empty_body guard, and it keeps a marker: lorekit-weixin-code-snippet-marker.</p>
  </div>
</body></html>`;

const WEIXIN_TEXT_PAGE_HTML = `<!DOCTYPE html>
<html><head>
  <meta property="og:title" content="Weixin Text Page Fixture">
</head><body>
  <div id="js_article"></div>
  <script>
    window.item_show_type = '10';
    window.ct = '1784031320' || '';
    window.cgiData = {
      text_page_info: {
        content: '第一段包含一个\\x26lt;a href=\\x26quot;https://example.com?a=1\\x26amp;amp;b=2\\x26quot;\\x26gt;内联链接\\x26lt;/a\\x26gt;，也包含 Seedance\\\'s 转义文本。\\n\\n第二段用于验证纯文字分享页不再依赖 js_content 节点，并且正文长度足以通过 empty_body 检查。weixin-text-page-marker。'
      }
    };
  </script>
</body></html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (req.url === '/weixin-code-snippet') {
    res.end(WEIXIN_CODE_SNIPPET_HTML);
  } else if (req.url === '/weixin-text-page') {
    res.end(WEIXIN_TEXT_PAGE_HTML);
  } else {
    res.end(HTML);
  }
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
