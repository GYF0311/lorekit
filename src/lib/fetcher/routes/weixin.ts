/**
 * fetcher/routes/weixin.ts — 微信公众号文章解析
 *
 * 批次 21d strangler fig 第四步：从 src/lib/fetcher.ts copy 出 parseWeixin。
 * 原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换；本文件目前未被任何
 * 调用方 import，仅作旁路 parser。21g 才创建 routes/index.ts dispatcher 取代
 * fetchUrl 内的 `site === 'weixin' ? parseWeixin : parseGeneric` 三元逻辑。
 *
 * ## 与原 parseWeixin 的差异（LEGACY P4-4 顺手修，规划方批准）
 *
 * 旧版只识别 `<img>` 标签的 lazy attrs（data-src / data-original / data-url）。
 * 部分微信文章用 `<picture><source srcset="..."><img ...></picture>` 或仅 `<picture>
 * <source srcset="..."></picture>`（无 img）的写法，旧版会丢图。
 *
 * 新版在跑 img 流程前先扫一遍 `<picture>` 节点：
 * - 取内部第一个 `<source>` 的 `srcset`，parse 第一个 URL（srcset 语法：`url [w|x], url2 [w|x], ...`，用 `,` 分隔候选 + 空白分隔 url 与 descriptor）
 * - 若 picture 内有 `<img>` 且其 `src/data-src/data-original/data-url` 都为空，把 srcset url 写入 `data-src`（让后续 img 流程统一处理）
 * - 若 picture 内无 `<img>` 且 srcset 有效，append 一个 `<img data-src="...">`
 * - 用 picture 的 first `<img>` 节点替换 picture 整体（unwrap），删掉 picture 与所有 `<source>` 子节点，避免 turndown 输出残留
 * - 兜底：扫整个 body 内残留的 `<source>` 节点（picture 之外野生的，极少见）一并 remove
 *
 * 这样后续 `body.find('img').each(...)` 流程不变，imgSrcs 自然累加。
 */
import * as cheerio from 'cheerio';

import { normalizeDateText, resolveUrl, tsToYMD } from '../helpers.js';
import type { ParsedDoc } from '../types.js';

// ParsedDoc 21g-pre 上提到 fetcher/types.ts，本文件 21d 内的 inline 定义已删除。
// 字段、可选性、注释完全一致，纯类型替换。

// ---------------------------------------------------------------------------
// P4-4 helper: srcset → 第一个 URL
// ---------------------------------------------------------------------------

/**
 * srcset 形如：`a.jpg 320w, b.jpg 640w` 或 `a.jpg, b.jpg 2x`。
 * 取第一个候选（按 `,` 分），再取候选里第一个 whitespace token（去掉 `Nw` / `Nx` descriptor）。
 * 空 / 非法返回空串。"最高质量 URL"判断需要 parse w/x 比较，本批次只取第一个保持最简实现。
 */
function firstSrcsetUrl(srcset: string): string {
  const s = srcset.trim();
  if (!s) return '';
  const firstCandidate = s.split(',')[0].trim();
  if (!firstCandidate) return '';
  const url = firstCandidate.split(/\s+/)[0].trim();
  return url;
}

// ---------------------------------------------------------------------------
// parseWeixin
// ---------------------------------------------------------------------------

export function parseWeixin(html: string, baseUrl: string): ParsedDoc {
  const $ = cheerio.load(html);

  // Title
  let title =
    $('h1#activity-name').text().trim() ||
    $('h1.rich_media_title').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    '';

  // Author
  const author = $('a#js_name').text().trim() || $('#js_author_name').text().trim() || '';

  // Publish date — prefer `var ct = "<unix seconds>"` (most reliable),
  // fallback to <em id="publish_time"> text node.
  let publishDate: string | undefined;
  const ctMatch = html.match(/var\s+ct\s*=\s*"(\d+)"/);
  if (ctMatch) {
    const ts = Number(ctMatch[1]);
    if (Number.isFinite(ts) && ts > 0) publishDate = tsToYMD(ts);
  }
  if (!publishDate) {
    const ptText = $('em#publish_time').text().trim();
    if (ptText) publishDate = normalizeDateText(ptText);
  }

  // Body
  const body = $('#js_content');
  if (!body.length) {
    return { title, author, publishDate, bodyHtml: '', imgSrcs: [] };
  }

  // Clean
  body.find('script, style').remove();

  // ---------------------------------------------------------------------------
  // P4-4: 把 <picture><source srcset> 展开成 <img>，再走原有 img 流程
  // ---------------------------------------------------------------------------
  body.find('picture').each((_i, el) => {
    const $picture = $(el);
    // 取第一个 source 的 srcset
    const $firstSource = $picture.find('source[srcset]').first();
    const srcsetRaw = $firstSource.attr('srcset') || '';
    const pickedUrl = firstSrcsetUrl(srcsetRaw);

    let $img = $picture.find('img').first();

    if ($img.length) {
      // 有 img：若 src / data-* 都空才用 srcset 兜底，避免覆盖原有更明确的来源
      const existing = (
        $img.attr('data-src') ||
        $img.attr('data-original') ||
        $img.attr('data-url') ||
        $img.attr('src') ||
        ''
      ).trim();
      if (!existing && pickedUrl) {
        $img.attr('data-src', pickedUrl);
      }
    } else if (pickedUrl) {
      // 无 img：用 srcset url 新建一个，后续 img 流程统一处理
      $picture.append(`<img data-src="${pickedUrl}">`);
      $img = $picture.find('img').first();
    }

    // unwrap：用 img 替换 picture 整体；若没拿到 img（srcset 也空），picture 整块移除
    if ($img.length) {
      $picture.replaceWith($img);
    } else {
      $picture.remove();
    }
  });

  // 兜底：清掉野生 <source> 节点（picture 之外极少见，但为 turndown 干净起见统一删）
  body.find('source').remove();

  // Normalize images: data-src / data-original → src
  const imgSrcs: string[] = [];
  body.find('img').each((_i, el) => {
    const $el = $(el);
    const real = (
      $el.attr('data-src') ||
      $el.attr('data-original') ||
      $el.attr('data-url') ||
      $el.attr('src') ||
      ''
    ).trim();
    if (!real || real.startsWith('data:')) {
      $el.remove();
      return;
    }
    const abs = resolveUrl(real, baseUrl);
    $el.attr('src', abs);
    // Remove noisy attrs
    for (const a of [
      'data-src',
      'data-original',
      'data-url',
      'data-w',
      'data-ratio',
      'data-type',
      'data-s',
      'srcset',
    ]) {
      $el.removeAttr(a);
    }
    imgSrcs.push(abs);
  });

  return { title, author, publishDate, bodyHtml: body.html() || '', imgSrcs };
}
