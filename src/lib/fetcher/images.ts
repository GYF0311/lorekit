/**
 * fetcher/images.ts — 图片下载、magic byte 嗅探、markdown 链接重写
 *
 * 批次 21a strangler fig 第一步：从 src/lib/fetcher.ts copy 出来作为旁路新模块。
 * 原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换，本文件目前未被使用。
 *
 * 依赖关系：仅 import fetcher/http.ts 的 HTTP_TIMEOUT_MS，不依赖 helpers.ts。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { HTTP_TIMEOUT_MS } from './http.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_IMG_BYTES = 5 * 1024 * 1024;
const IMG_CONCURRENCY = 5;

// 常见图片格式的 magic bytes — 优先靠字节签名判断扩展名，
// 其次才落回 Content-Type（远端 MIME 经常乱报）。
const MAGIC: Array<[Uint8Array | number[], string]> = [
  [[0xff, 0xd8, 0xff], '.jpg'],
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], '.png'], // \x89PNG\r\n\x1a\n
  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], '.gif'], // GIF87a
  [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], '.gif'], // GIF89a
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImgDownloadResult {
  originalUrl: string;
  localRel: string | null; // relative path like ./images/img_01.jpg
  status: 'ok' | 'failed' | 'too_large';
}

// ---------------------------------------------------------------------------
// Magic byte sniffing
// ---------------------------------------------------------------------------

/**
 * 优先按文件头的 magic bytes 判扩展，不命中再用 Content-Type 作 fallback。
 * 都不命中返回 null（调用方应当丢弃此图）。
 */
export function sniffExt(head: Uint8Array, contentType: string): string | null {
  for (const [sig, ext] of MAGIC) {
    if (sig.every((b, i) => head[i] === b)) return ext;
  }
  // RIFF....WEBP
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
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

// ---------------------------------------------------------------------------
// Image downloading
// ---------------------------------------------------------------------------

/**
 * 单张图下载：最多 2 次尝试；超过 MAX_IMG_BYTES 标 too_large；
 * 文件名格式 `img_{idx:02d}.{ext}`，相对链接形如 `./<slug>.assets/img_01.jpg`。
 */
export async function downloadOneImage(
  url: string,
  idx: number,
  imagesDir: string,
  headers: Record<string, string>,
  assetsRelPath: string,
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
      // localRel 相对于 .md 文件位置；assetsRelPath 例如 "./<slug>.assets/"
      return { originalUrl: url, localRel: `${assetsRelPath}${fname}`, status: 'ok' };
    } catch {
      // retry
    }
  }
  return { originalUrl: url, localRel: null, status: 'failed' };
}

/**
 * 批量下载：按 IMG_CONCURRENCY 分批 Promise.all，避免一次打开太多 socket。
 * 返回结果数组顺序对应 imgSrcs。
 */
export async function downloadImages(
  imgSrcs: string[],
  imagesDir: string,
  headers: Record<string, string>,
  assetsRelPath: string,
): Promise<ImgDownloadResult[]> {
  if (imgSrcs.length === 0) return [];
  await mkdir(imagesDir, { recursive: true });

  const results: ImgDownloadResult[] = [];
  // Process in batches of IMG_CONCURRENCY
  for (let i = 0; i < imgSrcs.length; i += IMG_CONCURRENCY) {
    const batch = imgSrcs.slice(i, i + IMG_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((src, j) => downloadOneImage(src, i + j + 1, imagesDir, headers, assetsRelPath)),
    );
    results.push(...batchResults);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Markdown link rewriting
// ---------------------------------------------------------------------------

/**
 * 用下载结果把 markdown 中的 `![alt](远端 URL)` 重写为 `![alt](本地相对路径)`。
 * 下载失败的图保留原 URL。
 */
export function rewriteMarkdownImages(md: string, imgResults: ImgDownloadResult[]): string {
  const urlToLocal = new Map<string, string>();
  for (const r of imgResults) {
    if (r.status === 'ok' && r.localRel) {
      urlToLocal.set(r.originalUrl, r.localRel);
    }
  }
  // Replace ![alt](url) with ![alt](localRel)
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const local = urlToLocal.get(url);
    return local ? `![${alt}](${local})` : match;
  });
}
