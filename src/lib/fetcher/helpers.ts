/**
 * fetcher/helpers.ts — 通用工具函数（slug / url / markdown / 日期）
 *
 * 批次 21a strangler fig 第一步：从 src/lib/fetcher.ts copy 出来作为旁路新模块。
 * 原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换，本文件目前未被使用。
 *
 * self-contained：不 import fetcher 子目录下其他模块。
 */
import TurndownService from 'turndown';

// ---------------------------------------------------------------------------
// 字符串 / URL helper
// ---------------------------------------------------------------------------

/**
 * 把任意字符串裁成可作文件名的 slug：
 * 保留 word 字符（含中文），其他符号收敛成 `-`，限长 50；空串回退 `untitled`。
 */
export function slugify(s: string): string {
  const slug = s.replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.slice(0, 50) || 'untitled';
}

/**
 * 相对 URL 解析为绝对 URL；解析失败则原样返回，避免异常向上抛。
 */
export function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href;
  } catch {
    // URL 构造失败说明输入已经是非法 URI（典型如 `data:` / 空字符串），
    // 维持原值让上游 caller 自己决定怎么处理。
    return src;
  }
}

// ---------------------------------------------------------------------------
// HTML -> Markdown
// ---------------------------------------------------------------------------

/**
 * Turndown 包装：固定 ATX heading + fenced code 风格，trim 末尾空白。
 */
export function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  return td.turndown(html).trim();
}

// ---------------------------------------------------------------------------
// 日期 helper（Asia/Shanghai 视角）
// ---------------------------------------------------------------------------

const SHANGHAI_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 把 unix seconds 时间戳格式化为 `YYYY-MM-DD`（Asia/Shanghai）。
 */
export function tsToYMD(seconds: number): string {
  const d = new Date(seconds * 1000 + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * 当前日期 `YYYY-MM-DD`（Asia/Shanghai）。
 *
 * 注意：批次 9 已建立 `src/lib/date.ts`，迁移到统一 helper 的工作留给批次 21
 * 后续子批一起做（见 LEGACY 批次 9 备注）。本批次仅 copy 保持行为一致。
 */
export function todayYMD(): string {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * 把人类常见格式的日期文本归一化为 `YYYY-MM-DD`。
 * 支持 ISO（`2026-04-15` / `2026/04/15` / 带 `T...`）和中文（`2026年4月15日`）。
 * 无法识别返回 undefined。
 */
export function normalizeDateText(raw: string): string | undefined {
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
