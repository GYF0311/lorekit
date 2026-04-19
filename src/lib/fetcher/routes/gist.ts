/**
 * fetcher/routes/gist.ts — GitHub Gist 抓取
 *
 * 批次 21e strangler fig 第五步：从 src/lib/fetcher.ts copy 出 parseGistUrl + fetchGist。
 * 原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import，仅作旁路。21g 才切换 dispatcher 并删旧。
 *
 * **本批首次集成 21b 的 buildFrontmatter()**：旧 fetchGist 内嵌的 fmLines 拼装段
 * 替换为 `lines.push(...buildFrontmatter({routeKind: 'gist', ...}))`，验证 21b 抽出的
 * helper 设计可用。21b 已用 6 mock case 证明 byte-level 等价；本文件因此 frontmatter
 * 段无需重复验证，整份文件 buffer 等价由 21e 自有 mock 兜底。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as cheerio from 'cheerio';

import { buildFrontmatter } from '../frontmatter.js';
import { normalizeDateText, slugify, todayYMD } from '../helpers.js';
import { buildHeaders, fetchHtmlL1 } from '../http.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * inline 定义，与 fetcher.ts:16-46 FetchResult 字段、可选性、注释完全一致。
 * 21g 收尾时再决定是否上提到共享 types 模块。
 */
export interface FetchResult {
  status: 'ok' | 'error' | 'unsupported' | 'duplicate';
  route: string;
  url: string;
  title?: string;
  author?: string;
  publishDate?: string; // YYYY-MM-DD, Asia/Shanghai
  sourceKind?: string; // clipping | article | ...
  sourceLayer?: string;
  slug?: string;
  markdown?: string;
  assetsDir?: string;
  imagesOk?: number;
  imagesFailed?: number;
  suggest?: string;
  reason?: string;
  duplicate?: {
    path: string;
    sourceDate?: string;
    title?: string;
  };
}

// ---------------------------------------------------------------------------
// parseGistUrl
// ---------------------------------------------------------------------------

/**
 * 校验并解析 gist URL。仅接受 `gist.github.com` / `gist.githubusercontent.com`，
 * 路径需含 `/<user>/<id>` 至少两段。其余返回 null。
 */
export function parseGistUrl(url: string): { user: string; id: string } | null {
  try {
    const u = new URL(url);
    if (
      !u.hostname.endsWith('gist.github.com') &&
      !u.hostname.endsWith('gist.githubusercontent.com')
    ) {
      return null;
    }
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { user: parts[0], id: parts[1] };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchGist 主流程
// ---------------------------------------------------------------------------

/**
 * gist 抓取流程：
 * 1. 校验 URL，解析 user / id
 * 2. fetch gist 主页 HTML（L1 only，gist 页面不需要 playwright）
 * 3. 用 cheerio 抽 title / author / publishDate
 * 4. 扫所有 `<a href>`，匹配 `/<user>/<id>/raw/<sha>/<filename>` 模式抽 raw 链接
 * 5. 优先 `.md` / `.markdown`，否则取第一个；二次 fetch 拿正文
 * 6. 拼 frontmatter（用 21b buildFrontmatter）+ 可选 H1 + 正文，写到 outRoot/<slug>.md
 *
 * 失败路径返回 `{status:'error', reason:...}`，由调用方决定是否兜底。
 */
export async function fetchGist(url: string, outRoot: string): Promise<FetchResult> {
  const parsed = parseGistUrl(url);
  if (!parsed) {
    return { status: 'error', route: 'gist', url, reason: 'invalid_gist_url' };
  }

  const headers = buildHeaders('generic');
  let html: string;
  try {
    html = await fetchHtmlL1(url, headers);
  } catch (e) {
    return {
      status: 'error',
      route: 'gist',
      url,
      reason: `fetch_failed: ${(e as Error).message}`,
    };
  }

  const $ = cheerio.load(html);

  // gist 页面把描述放在 .gist-header [itemprop="about"]，OpenGraph title 通常是第一个文件名
  const description = $('[itemprop="about"]').first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const title = description || ogTitle || parsed.id;

  const author = parsed.user;

  // 日期：<relative-time datetime="ISO"> 是 GitHub 标准元素
  let publishDate: string | undefined;
  const dateRaw =
    $('relative-time').first().attr('datetime') ||
    $('time-ago').first().attr('datetime') ||
    $('meta[property="article:published_time"]').attr('content') ||
    '';
  if (dateRaw) publishDate = normalizeDateText(dateRaw);

  // 抽 raw 链接。gist 页面的 raw 链接形如：
  //   /karpathy/442a6b.../raw/ac46de.../llm-wiki.md
  const rawRe = /^\/([^/]+)\/([a-f0-9]{20,})\/raw\/([a-f0-9]{20,})\/(.+)$/i;
  const rawLinks: Array<{ name: string; rawUrl: string }> = [];
  $('a').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(rawRe);
    if (m) {
      rawLinks.push({
        name: m[4],
        rawUrl: 'https://gist.githubusercontent.com' + href,
      });
    }
  });

  if (rawLinks.length === 0) {
    return { status: 'error', route: 'gist', url, reason: 'no_raw_files_found' };
  }

  // 优先 markdown，其次第一个
  const mdLink = rawLinks.find((l) => /\.(md|markdown)$/i.test(l.name)) || rawLinks[0];

  let content: string;
  try {
    const res = await fetch(mdLink.rawUrl, { headers, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${mdLink.rawUrl}`);
    content = await res.text();
  } catch (e) {
    const err = e as Error & { cause?: Error };
    const cause = err.cause?.message ? ` (${err.cause.message})` : '';
    return {
      status: 'error',
      route: 'gist',
      url,
      reason: `raw_fetch_failed: ${err.message}${cause} [raw_url=${mdLink.rawUrl}]`,
    };
  }

  const slug = slugify(title);
  await mkdir(outRoot, { recursive: true });

  const today = todayYMD();
  const hasH1 = /^#\s+/m.test(content);
  // 21b buildFrontmatter 返回的行数组与原 fetcher.ts:709-718 内嵌 fmLines 块
  // byte-level 等价（21b 已 6 mock case 证明），spread 进 fmLines 后续操作不变
  const fmLines: string[] = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: 'gist',
      title,
      today,
      url,
      author,
      publishDate,
    }),
  );
  fmLines.push('');
  if (!hasH1) fmLines.push(`# ${title}`, '');
  fmLines.push(content.trim(), '');

  const articlePath = join(outRoot, `${slug}.md`);
  await writeFile(articlePath, fmLines.join('\n'), 'utf-8');

  return {
    status: 'ok',
    route: 'gist',
    url,
    title,
    author,
    publishDate,
    sourceKind: 'gist',
    sourceLayer: 'L1',
    slug,
    markdown: articlePath,
    imagesOk: 0,
    imagesFailed: 0,
  };
}
