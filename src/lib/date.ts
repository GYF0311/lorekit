/**
 * date.ts — 日期 / 时间戳 helper 集中处。
 *
 * 历史背景（LEGACY P1-2）：`pad(n)`、`today()`、`todayYMD()` 等小工具散落在
 * init / index / audit / snapshot / ingest / fetcher 各文件内重复实现。本文件
 * 把它们集中起来，下游 import 即可。
 *
 * 时区策略：除 `*Shanghai*` 后缀的函数显式按 Asia/Shanghai 偏移外，其他函数
 * 默认走 JS 系统时区（在先生这台机器上 = Asia/Shanghai）。
 *
 * 后续批次（9 / 21）继续往本文件追加；先生不要在其他文件里"另起炉灶"。
 */

const SHANGHAI_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 把数字补足到 2 位（如月 / 日 / 时 / 分 / 秒） */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 今天的 YYYY-MM-DD（按 Asia/Shanghai 偏移）—— 适合记录 source_date / created / updated */
export function todayYMDShanghai(): string {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

/** 把任意 Date 格式化成 YYYY-MM-DD（**UTC**，常用于 frontmatter 解析回写） */
export function dateToYMDUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 把任意 Date 格式化成 YYYY-MM-DD（**本地**时区，常用于 mtime 显示） */
export function dateToYMDLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 紧凑文件名时间戳：YYYYMMDD-HHMMSS（本地时区）。
 * 用在 snapshot 文件名、audit 反馈条目文件名等不希望出现冒号 / 空格的位置。
 */
export function tsCompact(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate()),
    '-',
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds()),
  ].join('');
}

/** YYYY-MM-DD HH:MM（本地时区，audit frontmatter 用） */
export function tsMinute(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
