/**
 * fetcher/routes/web.ts — generic 网页解析（OpenGraph + meta + article/main/body）
 *
 * 批次 21c strangler fig 第三步：从 src/lib/fetcher.ts copy 出 parseGeneric。
 * 原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import，仅作旁路 parser。21g 才创建 routes/index.ts dispatcher 取代
 * fetchUrl 内的 `site === 'weixin' ? parseWeixin : parseGeneric` 三元逻辑。
 *
 * 不含微信特定逻辑（见 21d 抽 routes/weixin.ts）。
 * 不含 frontmatter 拼装（见 21b 的 frontmatter.ts，本文件仅做 HTML → ParsedDoc）。
 */
import * as cheerio from 'cheerio';

import { normalizeDateText, resolveUrl } from '../helpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * inline 定义，与 fetcher.ts 第 175-181 行的 ParsedDoc 字段、可选性、注释含义
 * 完全一致。21g 收尾时再决定是否上提到共享 types 模块（避免双向依赖）。
 */
export interface ParsedDoc {
  title: string;
  author: string;
  publishDate?: string; // YYYY-MM-DD Asia/Shanghai, optional
  bodyHtml: string;
  imgSrcs: string[]; // absolute URLs in document order
}

// ---------------------------------------------------------------------------
// parseGeneric
// ---------------------------------------------------------------------------

/**
 * generic 网页 HTML → ParsedDoc。
 *
 * 策略：
 * - title: og:title > <title>
 * - author: meta[name=author]
 * - publishDate: 一组常见 meta / `<time datetime>` / `<time>` 文本，按优先级第一个能解析的胜出
 * - body: <article> > <main> > <body>（找不到则返回空 bodyHtml）
 * - 图片：data-src > data-original > src，相对路径转绝对，丢弃 data:URL
 */
export function parseGeneric(html: string, baseUrl: string): ParsedDoc {
  const $ = cheerio.load(html);

  // Title
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const titleTag = $('title').text().trim();
  const title = ogTitle || titleTag || '';

  // Author
  const author = $('meta[name="author"]').attr('content')?.trim() || '';

  // Publish date — common places: OpenGraph article, meta, <time datetime>, JSON-LD
  let publishDate: string | undefined;
  const dateCandidates: Array<string | undefined> = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[property="og:article:published_time"]').attr('content'),
    $('meta[name="article:published_time"]').attr('content'),
    $('meta[itemprop="datePublished"]').attr('content'),
    $('meta[name="date"]').attr('content'),
    $('meta[name="pubdate"]').attr('content'),
    $('meta[name="publishdate"]').attr('content'),
    $('time[datetime]').first().attr('datetime'),
    $('time').first().text(),
  ];
  for (const cand of dateCandidates) {
    if (!cand) continue;
    const norm = normalizeDateText(cand);
    if (norm) {
      publishDate = norm;
      break;
    }
  }

  // Body: article > main > body
  let body = $('article');
  if (!body.length) body = $('main');
  if (!body.length) body = $('body');
  if (!body.length) {
    return { title, author, publishDate, bodyHtml: '', imgSrcs: [] };
  }

  // Clean junk
  body.find('script, style, nav, footer, header, aside').remove();

  // Normalize images
  const imgSrcs: string[] = [];
  body.find('img').each((_i, el) => {
    const $el = $(el);
    const real = (
      $el.attr('data-src') ||
      $el.attr('data-original') ||
      $el.attr('src') ||
      ''
    ).trim();
    if (!real || real.startsWith('data:')) {
      $el.remove();
      return;
    }
    const abs = resolveUrl(real, baseUrl);
    $el.attr('src', abs);
    imgSrcs.push(abs);
  });

  return { title, author, publishDate, bodyHtml: body.html() || '', imgSrcs };
}
