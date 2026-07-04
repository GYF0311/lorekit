/**
 * paths.ts — corpus 路径 / 排除规则的单一事实源。
 *
 * 历史背景（LEGACY P1-1）：早期多个模块各自维护扫描排除目录，
 * 各自维护独立的"排除目录"集合，加新顶层目录时容易漏改其中一处。本文件把所有
 * 集合集中起来，下游 import 即可。
 *
 * CONVENTIONS Do Not #11：建 paths.ts 后不许再硬编码新的"排除目录"常量。
 *
 * 命名约定：
 *   - alwaysExclude*  — 全局通用，所有 collect / scan 都该跳过
 *   - lintSkip*       — 仅 lint 时跳过
 *   - indexExclude*   — 仅 dir-index (`_INDEX.md`) 生成时跳过
 *   - snapshotExclude* — 仅 snapshot 时跳过
 *
 * 后续批次（6/7）会继续往本文件追加 set；先生不要在其他文件里"另起炉灶"。
 */

/**
 * 全局排除：任何 markdown 收集都该跳过的文件名（不是目录）。
 *   - .gitkeep / .DS_Store：环境噪声
 *   - _INDEX.md：`lorekit index` 自动生成的目录索引文件，不是用户内容
 */
export const alwaysExcludeNames: ReadonlySet<string> = new Set([
  '.gitkeep',
  '.DS_Store',
  '_INDEX.md',
]);

/**
 * 全局排除：任何递归 markdown 扫描都该整枝跳过的目录名。
 *   - node_modules：包依赖自带 README 不是 corpus 内容
 *   - skills：项目级 Agent workflow packs，不是 wiki 页面
 */
export const alwaysExcludeDirNames: ReadonlySet<string> = new Set(['node_modules', 'skills']);

function normalizeRelPath(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
}

function relParts(rel: string): string[] {
  return normalizeRelPath(rel).split('/').filter(Boolean);
}

export function hasAlwaysExcludedDirSegment(rel: string): boolean {
  return relParts(rel).some((part) => alwaysExcludeDirNames.has(part));
}

export function matchesDirPrefix(rel: string, prefix: string): boolean {
  const normalizedRel = normalizeRelPath(rel);
  const normalizedPrefix = normalizeRelPath(prefix);
  return normalizedRel === normalizedPrefix || normalizedRel.startsWith(normalizedPrefix + '/');
}

// ---------------------------------------------------------------------------
// `lorekit search` 默认检索规则
// ---------------------------------------------------------------------------

/**
 * 默认全文搜索聚焦 durable knowledge layers，跳过过程区、派生产物和系统区。
 * 用户显式传 `search --dir <dir>` 时，认为他正在指定范围搜索，不套这组默认排除。
 */
export const searchDefaultExcludePrefixes: readonly string[] = [
  '_工作台',
  '_archive',
  '_归档',
  '反馈',
  '系统',
  '输出',
  '.wiki',
  '.git',
];

/**
 * `search --all`（两级召回的第二级）仍要跳过的噪音层。
 * --all 的语义是"把过程区（工作台/归档/输出等）纳入 fallback 召回"，
 * 不是"什么都搜"：
 *   - .wiki / .git：系统元数据
 *   - _工作台/转写：未提炼的 ASR 原始语料，体量大且口语噪音多，
 *     会淹没内容笔记；点名 `--dir _工作台/转写` 才进。
 */
export const searchAllExcludePrefixes: readonly string[] = ['.wiki', '.git', '_工作台/转写'];

// ---------------------------------------------------------------------------
// `lorekit index` 专用规则（生成 _INDEX.md）
// ---------------------------------------------------------------------------

/**
 * `lorekit index` 不为下列前缀目录生成 `_INDEX.md`。
 * 系统 / 反馈 / 工作台 / 归档 / git / .wiki 都不是用户内容书架。
 */
export const indexExcludeDirPrefixes: readonly string[] = [
  '.wiki',
  '.git',
  'node_modules',
  'skills',
  '_归档',
  '_工作台',
  '系统',
  '反馈',
];

/**
 * 判断给定 corpus 内相对路径是否落在"不索引"前缀里。
 * 对外暴露的小工具（doctor.ts / commands/dir-index.ts 都用）。
 */
export function isIndexExcluded(rel: string): boolean {
  if (hasAlwaysExcludedDirSegment(rel)) return true;
  for (const prefix of indexExcludeDirPrefixes) {
    if (matchesDirPrefix(rel, prefix)) return true;
  }
  return false;
}

/**
 * 判断目录是否"目录包装式原料"——即 `<dir>/article.md` 存在。
 * 此类目录在生成 `_INDEX.md` 时被当作"一个条目"而非容器，不递归进入。
 *
 * 注：lstatSync 直接 throw 时返回 false（catch 静默是有意——目录不存在 / 权限拒绝
 * 都按"不是 folder package" 处理；这是 paths.ts 的小预言式 helper，没有副作用）。
 */
export function isFolderPackage(dir: string): boolean {
  const articlePath = pathJoin(dir, 'article.md');
  try {
    return lstatSync(articlePath).isFile();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// `lorekit lint` 专用规则
// ---------------------------------------------------------------------------

/**
 * lint 时按 basename 跳过 frontmatter / orphan 检查的文件名（任何位置）。
 * 这些是 schema / 入口文档，不该被当作 wiki 页验证。
 */
export const lintSkipFrontmatterBasenames: ReadonlySet<string> = new Set([
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'MEMORY.md',
]);

/**
 * 仅在 corpus 根目录跳过的文件名。`index.md` / `log.md` 在子目录里如果有
 * 同名文件，仍按普通 wiki 页校验。
 */
export const lintRootOnlySkipBasenames: ReadonlySet<string> = new Set(['index.md', 'log.md']);

/**
 * lint 不参与 orphan 检查的目录前缀（过渡区 / 冷数据 / 系统规范 / 模板区）。
 * `知识库/模板/` 下是页面模板，不是正式 wiki 页，天然无入链，不应报 orphan。
 */
export const lintSkipOrphanPrefixes: readonly string[] = [
  '_工作台/',
  '_归档/',
  '系统/',
  '知识库/模板/',
];

/**
 * lint 不参与 frontmatter 检查的目录前缀（过渡区 / 冷数据）。
 * 注：`系统/` 故意保留 frontmatter 检查（schema 文件应规范）。
 */
export const lintSkipFrontmatterPrefixes: readonly string[] = ['_工作台/', '_归档/'];

/**
 * lint 不参与 broken-link 检查的目录前缀。
 * `知识库/模板/` 下模板正文含 `[[知识库/摘要/xxx]]` 这种占位符，让 LLM 建页时替换，
 * 不是真实 wikilink 目标，不该被报 broken。
 */
export const lintSkipBrokenLinkPrefixes: readonly string[] = ['知识库/模板/'];

// ---------------------------------------------------------------------------
// `lorekit snapshot` 专用规则
// ---------------------------------------------------------------------------

/**
 * snapshot 打包时跳过的目录 / 文件名。
 *   - .wiki：corpus 元数据，快照里要重建不要拷
 *   - .git：corpus 自己的 git 仓库
 *   - .DS_Store：环境噪声
 */
export const snapshotExcludeNames: ReadonlySet<string> = new Set(['.wiki', '.git', '.DS_Store']);

// ---------------------------------------------------------------------------
// 边界守卫 helper
// ---------------------------------------------------------------------------

/**
 * 检查 abs 是否在 root 边界内（含 root 自身）。
 * 用法：corpus / tmpdir / .wiki/integrations 任一作为 root 都行。
 *
 * 实现来源：原 src/commands/remove.ts 的 withinCorpus()，
 * v0.4.x 抽到 SSOT 供 restore / search 复用。
 */
export function isWithin(root: string, abs: string): boolean {
  const rel = pathRelative(root, abs);
  return rel === '' || (!rel.startsWith('..') && !pathIsAbsolute(rel));
}

// ---------------------------------------------------------------------------
// 内部 helper（用静态 import；放文件末尾以保持顶部导出干净）
// ---------------------------------------------------------------------------

import { lstatSync } from 'node:fs';
import { join as pathJoin, relative as pathRelative, isAbsolute as pathIsAbsolute } from 'node:path';
