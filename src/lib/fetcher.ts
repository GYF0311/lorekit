/**
 * fetcher.ts — URL -> local markdown + images
 *
 * L1: Node native fetch (iPhone UA for WeChat, desktop UA for others)
 * L2: Optional playwright-core fallback for antibot sites
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchResult {
  status: 'ok' | 'error' | 'unsupported';
  route: string;
  url: string;
  title?: string;
  author?: string;
  publishDate?: string;  // YYYY-MM-DD, Asia/Shanghai
  sourceKind?: string;   // clipping | article | ...
  sourceLayer?: string;
  slug?: string;
  dir?: string;
  markdown?: string;
  imagesDir?: string;
  imagesOk?: number;
  imagesFailed?: number;
  suggest?: string;
  reason?: string;
}

export interface FetchOptions {
  outRoot: string;
  noImages?: boolean;
  forceRich?: boolean;
}

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

const MAX_IMG_BYTES = 5 * 1024 * 1024;
const IMG_CONCURRENCY = 5;
const HTTP_TIMEOUT_MS = 20_000;

const ANTIBOT_TRIGGERS = [
  '环境异常',
  '请在微信客户端打开',
  '完成验证后即可继续',
  'Just a moment',
  'cf-browser-verification',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectSite(url: string): 'weixin' | 'generic' {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('mp.weixin.qq.com')) return 'weixin';
  } catch { /* ignore */ }
  return 'generic';
}

function buildHeaders(site: string): Record<string, string> {
  if (site === 'weixin') {
    return {
      'User-Agent': UA_IPHONE,
      'Referer': 'https://mp.weixin.qq.com/',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
  }
  return {
    'User-Agent': UA_DESKTOP,
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
}

function detectAntibot(html: string, site: string): boolean {
  if (ANTIBOT_TRIGGERS.some((t) => html.includes(t))) return true;
  if (site === 'weixin' && !html.includes('js_content')) return true;
  return false;
}

function slugify(s: string): string {
  let slug = s
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 50) || 'untitled';
}

function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

// ---------------------------------------------------------------------------
// L1 fetch — native Node fetch
// ---------------------------------------------------------------------------

async function fetchHtmlL1(url: string, headers: Record<string, string>): Promise<string> {
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

async function fetchHtmlL2(url: string): Promise<string | null> {
  try {
    // Dynamic import — playwright-core is optional
    // @ts-ignore — playwright-core may not be installed
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

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

interface ParsedDoc {
  title: string;
  author: string;
  publishDate?: string; // YYYY-MM-DD Asia/Shanghai, optional
  bodyHtml: string;
  imgSrcs: string[]; // absolute URLs in document order
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const SHANGHAI_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

function tsToYMD(seconds: number): string {
  const d = new Date(seconds * 1000 + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

function todayYMD(): string {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

function normalizeDateText(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  // ISO-ish: 2026-04-15, 2026/04/15, 2026-04-15T10:00:00+08:00
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Chinese: 2026年4月15日
  const zh = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (zh) {
    const [, y, m, d] = zh;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
}

function parseWeixin(html: string, baseUrl: string): ParsedDoc {
  const $ = cheerio.load(html);

  // Title
  let title = $('h1#activity-name').text().trim()
    || $('h1.rich_media_title').text().trim()
    || $('meta[property="og:title"]').attr('content')?.trim()
    || '';

  // Author
  const author = $('a#js_name').text().trim()
    || $('#js_author_name').text().trim()
    || '';

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

  // Normalize images: data-src / data-original → src
  const imgSrcs: string[] = [];
  body.find('img').each((_i, el) => {
    const $el = $(el);
    const real = (
      $el.attr('data-src') || $el.attr('data-original') ||
      $el.attr('data-url') || $el.attr('src') || ''
    ).trim();
    if (!real || real.startsWith('data:')) {
      $el.remove();
      return;
    }
    const abs = resolveUrl(real, baseUrl);
    $el.attr('src', abs);
    // Remove noisy attrs
    for (const a of ['data-src', 'data-original', 'data-url', 'data-w',
      'data-ratio', 'data-type', 'data-s', 'srcset']) {
      $el.removeAttr(a);
    }
    imgSrcs.push(abs);
  });

  return { title, author, publishDate, bodyHtml: body.html() || '', imgSrcs };
}

function parseGeneric(html: string, baseUrl: string): ParsedDoc {
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
    if (norm) { publishDate = norm; break; }
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
      $el.attr('data-src') || $el.attr('data-original') ||
      $el.attr('src') || ''
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

// ---------------------------------------------------------------------------
// HTML -> Markdown
// ---------------------------------------------------------------------------

function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  return td.turndown(html).trim();
}

// ---------------------------------------------------------------------------
// Image downloading
// ---------------------------------------------------------------------------

const MAGIC: Array<[Uint8Array | number[], string]> = [
  [[0xff, 0xd8, 0xff], '.jpg'],
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], '.png'], // \x89PNG\r\n\x1a\n
  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], '.gif'], // GIF87a
  [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], '.gif'], // GIF89a
];

function sniffExt(head: Uint8Array, contentType: string): string | null {
  for (const [sig, ext] of MAGIC) {
    if (sig.every((b, i) => head[i] === b)) return ext;
  }
  // RIFF....WEBP
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
    && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
    return '.webp';
  }
  const ct = contentType.toLowerCase();
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return '.jpg';
  if (ct.includes('image/png')) return '.png';
  if (ct.includes('image/gif')) return '.gif';
  if (ct.includes('image/webp')) return '.webp';
  if (ct.includes('image/svg')) return '.svg';
  return null;
}

interface ImgDownloadResult {
  originalUrl: string;
  localRel: string | null; // relative path like ./images/img_01.jpg
  status: 'ok' | 'failed' | 'too_large';
}

async function downloadOneImage(
  url: string,
  idx: number,
  imagesDir: string,
  headers: Record<string, string>,
): Promise<ImgDownloadResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      const res = await fetch(url, {
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;

      const cl = Number(res.headers.get('content-length') || 0);
      if (cl && cl > MAX_IMG_BYTES) {
        return { originalUrl: url, localRel: null, status: 'too_large' };
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_IMG_BYTES) {
        return { originalUrl: url, localRel: null, status: 'too_large' };
      }

      const data = new Uint8Array(buf);
      const ext = sniffExt(data.slice(0, 16), res.headers.get('content-type') || '');
      if (!ext) continue;

      const fname = `img_${String(idx).padStart(2, '0')}${ext}`;
      await writeFile(join(imagesDir, fname), data);
      return { originalUrl: url, localRel: `./images/${fname}`, status: 'ok' };
    } catch {
      // retry
    }
  }
  return { originalUrl: url, localRel: null, status: 'failed' };
}

async function downloadImages(
  imgSrcs: string[],
  imagesDir: string,
  headers: Record<string, string>,
): Promise<ImgDownloadResult[]> {
  if (imgSrcs.length === 0) return [];
  await mkdir(imagesDir, { recursive: true });

  const results: ImgDownloadResult[] = [];
  // Process in batches of IMG_CONCURRENCY
  for (let i = 0; i < imgSrcs.length; i += IMG_CONCURRENCY) {
    const batch = imgSrcs.slice(i, i + IMG_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((src, j) => downloadOneImage(src, i + j + 1, imagesDir, headers)),
    );
    results.push(...batchResults);
  }
  return results;
}

function rewriteMarkdownImages(
  md: string,
  imgResults: ImgDownloadResult[],
): string {
  const urlToLocal = new Map<string, string>();
  for (const r of imgResults) {
    if (r.status === 'ok' && r.localRel) {
      urlToLocal.set(r.originalUrl, r.localRel);
    }
  }
  // Replace ![alt](url) with ![alt](localRel)
  return md.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      const local = urlToLocal.get(url);
      return local ? `![${alt}](${local})` : match;
    },
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

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
  } catch {
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
  const doc = site === 'weixin'
    ? parseWeixin(html, url)
    : parseGeneric(html, url);

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

  // --- Output directory ---
  const slug = slugify(doc.title || 'untitled');
  const dir = join(opts.outRoot, slug);
  const imagesDir = join(dir, 'images');
  await mkdir(dir, { recursive: true });

  // --- Download images ---
  let imagesOk = 0;
  let imagesFailed = 0;
  if (!opts.noImages && doc.imgSrcs.length > 0) {
    const imgResults = await downloadImages(doc.imgSrcs, imagesDir, headers);
    md = rewriteMarkdownImages(md, imgResults);
    for (const r of imgResults) {
      if (r.status === 'ok') imagesOk++;
      else imagesFailed++;
    }
  }

  // --- Build frontmatter + write article.md ---
  // Follows templates/default-corpus/系统/frontmatter-spec.md
  const sourceKind = site === 'weixin' ? 'clipping' : 'article';
  const today = todayYMD();
  const fmLines = ['---'];
  fmLines.push('type: source');
  if (doc.title) fmLines.push(`title: "${doc.title.replace(/"/g, '\\"')}"`);
  // slug omitted here: fetcher doesn't know the final archive location
  // (工作台 vs 原料/剪藏 vs 原料/文章). wiki-ingest will set it on mv.
  fmLines.push(`created: ${today}`);
  fmLines.push(`updated: ${today}`);
  fmLines.push(`source_url: ${url}`);
  if (doc.author) fmLines.push(`source_author: "${doc.author.replace(/"/g, '\\"')}"`);
  if (doc.publishDate) fmLines.push(`source_date: ${doc.publishDate}`);
  fmLines.push(`source_kind: ${sourceKind}`);
  fmLines.push('---');
  fmLines.push('');
  if (doc.title) fmLines.push(`# ${doc.title}`, '');
  fmLines.push(md, '');

  const articlePath = join(dir, 'article.md');
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
    dir,
    markdown: articlePath,
    imagesDir,
    imagesOk,
    imagesFailed,
  };
}
