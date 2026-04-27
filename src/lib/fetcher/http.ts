/**
 * fetcher/http.ts — 站点检测、请求头、antibot 探测、L1/L2 抓页
 *
 * 批次 21a strangler fig 第一步：从 src/lib/fetcher.ts copy 出来作为旁路新模块。
 * 原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换，本文件目前未被使用。
 *
 * 依赖关系：本文件不 import fetcher/helpers.ts 或 fetcher/images.ts，self-contained。
 * `HTTP_TIMEOUT_MS` 同时被 fetcher/images.ts 引用（images→http 单向依赖）。
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 ' +
  'Mobile/15E148 Safari/604.1';

const UA_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * L1 / L2 抓页超时（ms）。images.ts 下载图片时也复用此常量。
 */
export const HTTP_TIMEOUT_MS = 20_000;

const ANTIBOT_TRIGGERS = [
  '环境异常',
  '请在微信客户端打开',
  '完成验证后即可继续',
  'Just a moment',
  'cf-browser-verification',
];

// ---------------------------------------------------------------------------
// Site detection / headers
// ---------------------------------------------------------------------------

/**
 * 简单 host 匹配：识别微信公众号文章，其他一律 'generic'。
 */
export function detectSite(url: string): 'weixin' | 'generic' {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('mp.weixin.qq.com')) return 'weixin';
  } catch {
    /* ignore */
  }
  return 'generic';
}

/**
 * 按站点构造 fetch headers：微信公众号必须 iPhone UA + Referer 才返回正文。
 */
export function buildHeaders(site: string): Record<string, string> {
  if (site === 'weixin') {
    return {
      'User-Agent': UA_IPHONE,
      Referer: 'https://mp.weixin.qq.com/',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
  }
  return {
    'User-Agent': UA_DESKTOP,
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
}

/**
 * 粗略判断返回 HTML 是否被反爬拦截。微信特别加了"无 js_content 节点"启发式。
 */
export function detectAntibot(html: string, site: string): boolean {
  if (ANTIBOT_TRIGGERS.some((t) => html.includes(t))) return true;
  if (site === 'weixin' && !html.includes('js_content')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// L1 fetch — native Node fetch
// ---------------------------------------------------------------------------

/**
 * 用 Node 内置 fetch 拉 HTML，超时由 HTTP_TIMEOUT_MS 控制。
 * 失败抛 Error（HTTP 非 2xx 或 abort），由调用方决定是否走 L2 fallback。
 */
export async function fetchHtmlL1(url: string, headers: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// L2 fetch — optional playwright-core
// ---------------------------------------------------------------------------

/**
 * playwright-core fallback。可选依赖，缺了或 chromium 没装就返回 null，
 * 由调用方汇报 ANTIBOT_BLOCKED。
 */
export async function fetchHtmlL2(url: string): Promise<string | null> {
  try {
    // Dynamic import — playwright-core is optional
    // @ts-expect-error — playwright-core may not be installed
    const pw = await import('playwright-core');
    const browser = await pw.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      return await page.content();
    } finally {
      await browser.close();
    }
  } catch {
    // playwright-core not installed or chromium not available
    return null;
  }
}
