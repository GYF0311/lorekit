/**
 * logger.ts — 全仓库人类输出唯一通道（CONVENTIONS #2 强制）。
 *
 * 通道分流（CONVENTIONS #3）：所有人类信息（ok / bad / warn / err / info / debug）
 * 一律 stderr，stdout 只留给机器可读输出（JSON / 数据）。这样
 * `lorekit xxx 2>/dev/null | jq .` 才能正确读到结果。
 *
 * debug：受 `LOREKIT_DEBUG=1` 环境变量控制；不开时静默。
 *
 * 历史：批次 10 之前 `ok` / `bad` 走 stdout，是 CONVENTIONS 已规定但 logger 自己
 * 没落地的 bug（LEGACY P1-3）。本批次修复。
 */
import chalk from 'chalk';

const DEBUG_ENABLED = process.env.LOREKIT_DEBUG === '1';

/** 成功 / 完成提示，绿勾 */
export const ok = (msg: string) => console.error(`${chalk.green('✓')} ${msg}`);

/** 失败 / 取消提示，红叉。批次 10 前错误地写 stdout，已修正 */
export const bad = (msg: string) => console.error(`${chalk.red('✗')} ${msg}`);

/** 警告：可继续但需注意 */
export const warn = (msg: string) => console.error(`${chalk.yellow('lorekit:')} ${msg}`);

/** 错误：致命或已退出条件 */
export const err = (msg: string) => console.error(`${chalk.red('lorekit:')} ${msg}`);

/** 一般信息：进度 / 提示 */
export const info = (msg: string) => console.error(`${chalk.cyan('ℹ')} ${msg}`);

/** 调试输出：仅当 LOREKIT_DEBUG=1 时打印；其他时候静默 */
export const debug = (msg: string) => {
  if (DEBUG_ENABLED) console.error(`${chalk.dim('debug:')} ${msg}`);
};

/**
 * 原样写一行到 stderr（无前缀 / 无装饰）。
 * 用于 banner / 分隔线 / 空行 / 自定义 chalk 着色的 header 等纯展示内容。
 * 调用方负责自己加 chalk —— 如 `print(chalk.cyan('── 区块 ──'))`。
 */
export const print = (msg = '') => console.error(msg);
