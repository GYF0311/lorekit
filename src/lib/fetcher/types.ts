/**
 * fetcher/types.ts — fetcher 子模块共用类型
 *
 * 批次 21g-pre：把 21c/21d/21e/21f 各 routes 文件 inline 4 次的 ParsedDoc / FetchResult
 * 上提到这里，作为 fetcher/* 内部共用 surface。同时新增 FetchOptions（fetchUrl 签名用）。
 *
 * 字段定义与原 src/lib/fetcher.ts:16-52 + :175-181 byte 等价（字段、可选性、注释一致）。
 *
 * 这是纯类型模块（无 runtime 代码），routes/* 改 `import type {...}` 即可，无 emit。
 *
 * **承诺**：21g-final 删旧 fetcher.ts 后，本文件就是 fetcher 子模块对外类型 SSOT。
 */

// ---------------------------------------------------------------------------
// FetchResult — 4 routes（gist/github/web/weixin）+ fetchUrl 主入口的统一返回类型
// ---------------------------------------------------------------------------

/**
 * 抓取结果。`status` 决定后续语义；`reason` 仅 error 路径有意义；`duplicate`
 * 仅 status='duplicate' 时由 commands/fetch.ts 在外层填入。
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
  /**
   * <outRoot>/<slug>.md  —— 原文文件（Obsidian 兼容扁平结构）。
   * 跟 <outRoot>/<slug>.assets/ 同级；wiki 页里写 `[[<archive-root>/<slug>]]`
   * 就能被 Obsidian 按 basename 直接匹配到这个文件。
   */
  markdown?: string;
  /**
   * <outRoot>/<slug>.assets  —— 图片目录（Obsidian 原生 `.assets` 约定）。
   * 跟 .md 同级，替代旧的 `<slug>/images/` 嵌套结构。
   */
  assetsDir?: string;
  imagesOk?: number;
  imagesFailed?: number;
  suggest?: string;
  reason?: string;
  duplicate?: {
    path: string; // existing article.md path
    sourceDate?: string; // from existing frontmatter
    title?: string;
  };
}

// ---------------------------------------------------------------------------
// FetchOptions — fetchUrl 主入口签名
// ---------------------------------------------------------------------------

export interface FetchOptions {
  outRoot: string;
  noImages?: boolean;
  forceRich?: boolean;
}

// ---------------------------------------------------------------------------
// ParsedDoc — routes/web.ts 与 routes/weixin.ts 的解析输出
// ---------------------------------------------------------------------------

/**
 * 单篇文档解析结果。fetchUrl 拿到后负责 markdown 转换、图片下载、frontmatter 拼装。
 */
export interface ParsedDoc {
  title: string;
  author: string;
  publishDate?: string; // YYYY-MM-DD Asia/Shanghai, optional
  bodyHtml: string;
  imgSrcs: string[]; // absolute URLs in document order
}
