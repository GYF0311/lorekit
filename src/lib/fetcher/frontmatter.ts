/**
 * fetcher/frontmatter.ts — 4 路由共用的 frontmatter 拼装
 *
 * 批次 21b strangler fig 第二步：从 src/lib/fetcher.ts 抽出 frontmatter 生成逻辑。
 * 原 fetcher.ts 仍保留 3 处内嵌拼装代码（generic/weixin 共一处 + gist + github），
 * commands/*.ts 暂未切换，本文件目前未被使用，21f 才切换并删旧文件。
 *
 * ## 4 路由字段差异矩阵
 *
 * | 字段                          | generic/weixin    | gist          | github      |
 * | ----------------------------- | ----------------- | ------------- | ----------- |
 * | `type: source`                | 总有              | 总有          | 总有        |
 * | `title: "..."`                | **条件** if title | 总有          | 总有        |
 * | `created: <today>`            | 总有              | 总有          | 总有        |
 * | `updated: <today>`            | 总有              | 总有          | 总有        |
 * | `source_url: <url>`           | 总有              | 总有          | 总有        |
 * | `source_author: "..."`        | **条件** if 有    | 总有          | 总有        |
 * | `source_date: <YMD>`          | 条件 if 有        | 条件 if 有    | **从不输出**|
 * | `source_kind: <kind>`         | article/clipping  | 固定 gist     | 固定 github |
 *
 * 字段顺序、引号风格、缺字段不输出的语义都按上表，与原 4 路由内嵌实现 byte-level 等价。
 *
 * ## byte-level 一致性验证（手动）
 *
 * 用 4 mock 输入分别比对 buildFrontmatter() 和原 fetcher.ts 的 fmLines 数组，
 * `JSON.stringify(actual) === JSON.stringify(expected)` 全部 pass，
 * 详见 `tmp/frontmatter-parity-check.mjs`（一次性脚本，跑完 21b 即可丢弃）。
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 4 路由的 sourceKind 取值。注意 weixin 写出来是 `clipping`（剪藏），
 * generic 是 `article`，gist / github 同名。
 */
export type RouteKind = 'article' | 'clipping' | 'gist' | 'github';

export interface BuildFrontmatterOpts {
  /** sourceKind，决定 `source_kind:` 字段值，也决定 title/author 必输出还是条件输出 */
  routeKind: RouteKind;
  /** 文章标题。generic/weixin 路由可空（不输出 title 行）；gist/github 路由必填 */
  title?: string;
  /** 创建/更新日期 `YYYY-MM-DD`，调用方传入（一般是 todayYMD()） */
  today: string;
  /** 抓取来源 URL */
  url: string;
  /** 作者。generic/weixin 路由可空（不输出 source_author 行）；gist/github 路由必填 */
  author?: string;
  /** 发布日期 `YYYY-MM-DD`。github 路由忽略此字段（永远不输出） */
  publishDate?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * YAML 双引号字符串内嵌双引号需 `\"` 转义。原 4 路由都用同一句 `replace(/"/g, '\\"')`。
 */
function escapeDoubleQuote(s: string): string {
  return s.replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/**
 * 生成 frontmatter YAML 块（含外层 `---` 起止符），返回行数组。
 *
 * 调用方拿到后用 `lines.push(...buildFrontmatter(opts))` 拼到文章 fmLines 里。
 * 拼接后的下一行通常是空行，再跟正文 `# title` 等。
 *
 * 不负责 slug / 写文件 / 正文 —— 仅 frontmatter 一段。
 *
 * 字段输出语义见文件头注释的差异矩阵。
 */
export function buildFrontmatter(opts: BuildFrontmatterOpts): string[] {
  const { routeKind, title, today, url, author, publishDate } = opts;
  const omitPublishDate = routeKind === 'github';

  const lines: string[] = ['---'];
  lines.push('type: source');

  // title / author 在 generic/weixin 是条件输出；在 gist/github 调用方
  // 必传非空字符串，分支同样命中。统一用 truthy 判定，与原 4 路由 `if (xxx)` 等价。
  if (title) {
    lines.push(`title: "${escapeDoubleQuote(title)}"`);
  }
  // slug 留空：fetcher 不知道最终归档位置（_工作台 vs 原料/剪藏 vs 原料/文章），
  // wiki-ingest 在 mv 时再补。语义同原代码注释。

  lines.push(`created: ${today}`);
  lines.push(`updated: ${today}`);
  lines.push(`source_url: ${url}`);

  if (author) {
    lines.push(`source_author: "${escapeDoubleQuote(author)}"`);
  }

  if (!omitPublishDate && publishDate) {
    lines.push(`source_date: ${publishDate}`);
  }

  lines.push(`source_kind: ${routeKind}`);
  lines.push('---');

  return lines;
}
