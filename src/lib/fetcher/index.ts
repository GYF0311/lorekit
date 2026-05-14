/**
 * fetcher/index.ts — fetcher 子模块对外主入口（barrel + fetchUrl 主流程）
 *
 * 批次 21g-pre strangler fig 第七步：建主入口模块。本文件含：
 * - `fetchUrl`：从 src/lib/fetcher.ts:493-606 copy，dispatcher 模式根据 site
 *   选 routes/web 或 routes/weixin 的 parser。frontmatter 拼装替换为 21b
 *   buildFrontmatter（routeKind = 'article' | 'clipping'）
 * - `fetchGist` / `fetchGithubDoc`：从 routes 直接 re-export
 * - `FetchResult` / `FetchOptions`：从 types.ts 直接 re-export（type-only）
 *
 * **不 re-export** parser / helpers / http / images / frontmatter —— 这些是
 * fetcher 子模块内部实现细节，对外 surface 只有 4 个公开 API。
 *
 * 21g-pre 阶段：本文件目前未被任何调用方 import；commands/fetch.ts 仍 import
 * 旧 src/lib/fetcher.ts。21g-final 才切换 + 删旧。
 *
 * **Strangler fig 双份代码状态**：
 * - 旧 src/lib/fetcher.ts 的 fetchUrl / fetchGist / fetchGithubDoc 完整保留
 * - 新 src/lib/fetcher/index.ts 的 fetchUrl 与旧版 byte 等价（21g-pre parity 验证）
 * - 21g-final commit 一旦完成切换 + 删旧，本文件就成为 SSOT
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildFrontmatter } from './frontmatter.js';
import { htmlToMarkdown, slugify, todayYMD } from './helpers.js';
import {
  buildHeaders,
  detectAntibot,
  detectSite,
  fetchHtmlL1,
  fetchHtmlL2,
  PrivateAddressError,
} from './http.js';
import { downloadImages, rewriteMarkdownImages } from './images.js';
import { parseGeneric } from './routes/web.js';
import { parseWeixin } from './routes/weixin.js';
import type { FetchOptions, FetchResult } from './types.js';

// ---------------------------------------------------------------------------
// fetchUrl 主入口（dispatcher）
// ---------------------------------------------------------------------------

/**
 * 主入口：URL → 本地 markdown + 图片。
 *
 * Pipeline：
 * 1. detectSite 选 weixin / generic 的 headers / parser
 * 2. L1 fetch；命中 antibot 关键字 → 清空 html
 * 3. L1 失败或被拦 → L2 playwright fallback；仍失败 → 报 ANTIBOT_BLOCKED
 * 4. site 选 parseWeixin / parseGeneric
 * 5. body 太短报 empty_body
 * 6. htmlToMarkdown → 写文件（含 21b buildFrontmatter）+ 下载图 + 改写图链
 *
 * 与旧 fetcher.ts:493-606 byte 等价（21g-pre parity 验证 generic + weixin 各一例）。
 */
export async function fetchUrl(url: string, opts: FetchOptions): Promise<FetchResult> {
  const site = detectSite(url);
  const headers = buildHeaders(site);
  let sourceLayer = 'L1';
  let html = '';

  // --- L1 fetch ---
  try {
    html = await fetchHtmlL1(url, headers);
    if (detectAntibot(html, site)) {
      html = '';
    }
  } catch (e) {
    // SSRF guard 拒绝时直接冒泡为 FetchResult error，不退 L2 fallback
    // （L2 playwright 同样会被绕过 guard 命中私网，必须显式拒绝）
    if (e instanceof PrivateAddressError) {
      return {
        status: 'error',
        route: 'rich',
        url,
        reason: 'PRIVATE_ADDRESS_BLOCKED',
        suggest:
          `target resolves to private address ${e.address}. ` +
          'Set LOREKIT_FETCH_ALLOW_PRIVATE=1 to allow (local dev only).',
      };
    }
    // 其它 L1 失败（HTTP 非 2xx / abort / 网络错误）→ 退 L2 fallback
    html = '';
  }

  // --- L2 fallback ---
  if (!html) {
    sourceLayer = 'L2';
    const l2html = await fetchHtmlL2(url);
    if (!l2html) {
      return {
        status: 'error',
        route: 'rich',
        url,
        reason: 'ANTIBOT_BLOCKED',
        suggest: 'Install playwright-core + chromium, or paste content manually',
      };
    }
    html = l2html;
    if (detectAntibot(html, site)) {
      return {
        status: 'error',
        route: 'rich',
        url,
        reason: 'ANTIBOT_BLOCKED',
        suggest: 'Site requires login or manual intervention',
      };
    }
  }

  // --- Parse ---
  const doc = site === 'weixin' ? parseWeixin(html, url) : parseGeneric(html, url);

  if (!doc.bodyHtml || doc.bodyHtml.replace(/<[^>]*>/g, '').trim().length < 50) {
    return {
      status: 'error',
      route: 'rich',
      url,
      reason: 'empty_body',
    };
  }

  // --- Convert to markdown ---
  let md = htmlToMarkdown(doc.bodyHtml);

  // --- Output paths (Obsidian-compatible flat layout) ---
  //   <outRoot>/<slug>.md
  //   <outRoot>/<slug>.assets/img_01.jpg
  const slug = slugify(doc.title || 'untitled');
  const assetsDir = join(opts.outRoot, `${slug}.assets`);
  await mkdir(opts.outRoot, { recursive: true });

  // --- Download images ---
  let imagesOk = 0;
  let imagesFailed = 0;
  if (!opts.noImages && doc.imgSrcs.length > 0) {
    const imgResults = await downloadImages(doc.imgSrcs, assetsDir, headers, `./${slug}.assets/`);
    md = rewriteMarkdownImages(md, imgResults);
    for (const r of imgResults) {
      if (r.status === 'ok') imagesOk++;
      else imagesFailed++;
    }
  }

  // --- Build frontmatter + write article.md ---
  // Follows templates/default-corpus/系统/frontmatter-spec.md
  // 21b buildFrontmatter（routeKind 二元）替换原 inline fmLines 拼装；title/
  // author 在 generic/weixin 路由都是条件输出（21b 已用 generic-full /
  // weixin-no-author-no-date / generic-no-title-no-author 三 case 验证 byte 等价）
  const sourceKind: 'article' | 'clipping' = site === 'weixin' ? 'clipping' : 'article';
  const today = todayYMD();
  const fmLines: string[] = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: sourceKind,
      title: doc.title,
      today,
      url,
      author: doc.author,
      publishDate: doc.publishDate,
    }),
  );
  fmLines.push('');
  if (doc.title) fmLines.push(`# ${doc.title}`, '');
  fmLines.push(md, '');

  const articlePath = join(opts.outRoot, `${slug}.md`);
  await writeFile(articlePath, fmLines.join('\n'), 'utf-8');

  return {
    status: 'ok',
    route: 'rich',
    url,
    title: doc.title || undefined,
    author: doc.author || undefined,
    publishDate: doc.publishDate,
    sourceKind,
    sourceLayer,
    slug,
    markdown: articlePath,
    assetsDir,
    imagesOk,
    imagesFailed,
  };
}

// ---------------------------------------------------------------------------
// Public API re-exports
// ---------------------------------------------------------------------------

export { fetchGist } from './routes/gist.js';
export { fetchGithubDoc } from './routes/github.js';
export type { FetchOptions, FetchResult } from './types.js';
