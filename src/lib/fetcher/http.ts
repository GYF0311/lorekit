/**
 * fetcher/http.ts — 站点检测、请求头、antibot 探测、L1/L2 抓页
 *
 * 批次 21a strangler fig 第一步：从 src/lib/fetcher.ts copy 出来作为旁路新模块。
 * 原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换，本文件目前未被使用。
 *
 * 依赖关系：本文件不 import fetcher/helpers.ts 或 fetcher/images.ts，self-contained。
 * `HTTP_TIMEOUT_MS` 同时被 fetcher/images.ts 引用（images→http 单向依赖）。
 *
 * SSRF 防御（PR #5）：
 * `fetchHtmlL1` 默认拒绝抓取解析到 RFC 1918 / RFC 6890 私网范围的目标，
 * 并手动跟随 redirect（最多 5 跳）逐跳重检，避免 redirect-to-private-ip 绕过。
 * 用户可通过环境变量 `LOREKIT_FETCH_ALLOW_PRIVATE=1` opt-out（本地开发 / 自建
 * localhost wiki 场景）。注意：该检查仅作用于 fetcher，**不影响** `lib/ollama.ts`
 * 的本地 localhost:11434 调用（那是另一个 import 路径，未经 http.ts）。
 */

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

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

/**
 * 手动跟随 redirect 的最大跳数。超过即拒绝（防 redirect 循环 / SSRF 跳板）。
 */
const MAX_REDIRECTS = 5;

const ANTIBOT_TRIGGERS = [
  '环境异常',
  '请在微信客户端打开',
  '完成验证后即可继续',
  'Just a moment',
  'cf-browser-verification',
];

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

/**
 * 私网 / 链路本地 / loopback 地址段。RFC 1918 / RFC 6890 / RFC 4193。
 * 与 `node:net.BlockList` 配合使用做 IP 归属判断。
 */
const PRIVATE_BLOCKS = (() => {
  const bl = new BlockList();
  // IPv4 RFC 1918 + loopback + link-local
  bl.addSubnet('127.0.0.0', 8, 'ipv4');
  bl.addSubnet('10.0.0.0', 8, 'ipv4');
  bl.addSubnet('172.16.0.0', 12, 'ipv4');
  bl.addSubnet('192.168.0.0', 16, 'ipv4');
  bl.addSubnet('169.254.0.0', 16, 'ipv4');
  bl.addSubnet('0.0.0.0', 8, 'ipv4'); // 0.0.0.0/8 — "this network"
  // IPv6 loopback + ULA + link-local
  bl.addAddress('::1', 'ipv6');
  bl.addSubnet('fc00::', 7, 'ipv6');
  bl.addSubnet('fe80::', 10, 'ipv6');
  return bl;
})();

/**
 * 由 SSRF guard 抛出的 sentinel error。调用方可用 `instanceof` 识别后短路 L2
 * fallback，把私网拒绝原因冒泡给用户（而不是被通用 catch 误判为 antibot）。
 */
export class PrivateAddressError extends Error {
  readonly code = 'SSRF_PRIVATE_ADDRESS';
  constructor(
    message: string,
    public readonly host: string,
    public readonly address: string,
  ) {
    super(message);
    this.name = 'PrivateAddressError';
  }
}

function isPrivateOptOut(): boolean {
  const v = process.env.LOREKIT_FETCH_ALLOW_PRIVATE;
  return v === '1' || v === 'true';
}

/**
 * 检查给定 host 的 DNS 解析结果是否落在私网范围。
 * - host 已经是 IP 字面量：直接判定
 * - 否则 `dns.lookup()` 拿 A/AAAA 记录后判定
 *
 * 命中即抛 `PrivateAddressError`；未命中静默返回。
 * 若环境变量 `LOREKIT_FETCH_ALLOW_PRIVATE=1` 已设置，本函数直接跳过检查。
 */
export async function assertPublicAddress(urlStr: string): Promise<void> {
  if (isPrivateOptOut()) return;

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    // URL 无法解析交给上游 fetch 报错，不在 SSRF 层判
    return;
  }

  // 仅检查 http(s)；其它 scheme（data:/file:）由上游决定是否拒绝
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;

  const rawHost = parsed.hostname;
  // URL.hostname 对 IPv6 会带方括号 [::1]，去掉以匹配 isIP / dns.lookup
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;
  if (!host) return;

  const ipVersion = isIP(host);
  if (ipVersion === 4 || ipVersion === 6) {
    const family = ipVersion === 4 ? 'ipv4' : 'ipv6';
    if (PRIVATE_BLOCKS.check(host, family)) {
      throw new PrivateAddressError(
        `refusing to fetch private address ${host} (set LOREKIT_FETCH_ALLOW_PRIVATE=1 to override)`,
        host,
        host,
      );
    }
    return;
  }

  // 普通域名 → DNS 解析
  let addr: { address: string; family: number };
  try {
    addr = await lookup(host);
  } catch {
    // DNS 失败交给上游 fetch 报错（用户能看到更明确的 ENOTFOUND）
    return;
  }
  const family = addr.family === 6 ? 'ipv6' : 'ipv4';
  if (PRIVATE_BLOCKS.check(addr.address, family)) {
    throw new PrivateAddressError(
      `refusing to fetch ${host} which resolves to private address ${addr.address} ` +
        `(set LOREKIT_FETCH_ALLOW_PRIVATE=1 to override)`,
      host,
      addr.address,
    );
  }
}

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
 *
 * 行为说明：
 * - 默认拒绝私网（RFC 1918 / RFC 6890）目标；可由 `LOREKIT_FETCH_ALLOW_PRIVATE=1`
 *   绕过（本地开发场景）。失败抛 `PrivateAddressError`
 * - `redirect: 'manual'` 手动跟随，最多 `MAX_REDIRECTS=5` 跳，每跳前对目标 URL
 *   重新做 SSRF 检查（避免公网 URL 通过 302 跳板进内网）
 * - HTTP 非 2xx 或 abort 抛 `Error`，由调用方决定是否走 L2 fallback
 */
export async function fetchHtmlL1(url: string, headers: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // 每跳前 SSRF 检查（首跳也查）
      await assertPublicAddress(currentUrl);

      const res = await fetch(currentUrl, {
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      // 3xx with Location → 手动跟随
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) {
          // 没有 Location header 的 3xx 当作错误返回
          throw new Error(`HTTP ${res.status} without Location header`);
        }
        if (hop === MAX_REDIRECTS) {
          throw new Error(`too many redirects (>${MAX_REDIRECTS}) starting from ${url}`);
        }
        // 相对 URL 用 currentUrl 作 base 解析
        currentUrl = new URL(loc, currentUrl).toString();
        // 释放 body，避免连接泄漏
        try {
          await res.arrayBuffer();
        } catch {
          // 流式响应可能已 abort，吞掉
        }
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    }
    // 理论不可达：循环出口都在 return / throw
    throw new Error(`unreachable: redirect loop exit ${url}`);
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
    // @ts-expect-error — playwright-core 是可选依赖，类型可能未安装
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
