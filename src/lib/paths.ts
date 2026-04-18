/**
 * paths.ts — corpus 路径 / 排除规则的单一事实源。
 *
 * 历史背景（LEGACY P1-1）：corpus.ts / vectordb.ts / commands/{index,lint,snapshot}
 * 各自维护独立的"排除目录"集合，加新顶层目录时容易漏改其中一处。本文件把所有
 * 集合集中起来，下游 import 即可。
 *
 * CONVENTIONS Do Not #11：建 paths.ts 后不许再硬编码新的"排除目录"常量。
 *
 * 命名约定：
 *   - alwaysExclude*  — 全局通用，所有 collect / scan 都该跳过
 *   - vectorInclude*  — 仅向量库索引时纳入
 *   - vectorExclude*  — 仅向量库索引时排除
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

// ---------------------------------------------------------------------------
// 向量库索引（vectordb.ts）专用规则
// ---------------------------------------------------------------------------

/**
 * 向量库纳入索引的目录前缀。任何文件 rel path 必须以下列之一开头才参与 chunk
 * embedding。注意：原料里只索引"长文"类（文章 / 书籍 / 会议）；剪藏 / 录音
 * 走另外的路径（embed 摘要而非全文）。
 */
export const vectorIncludeDirs: readonly string[] = [
  '知识库',
  '每日',
  '写作',
  '原料/文章',
  '原料/书籍',
  '原料/会议',
];

/**
 * 向量库排除目录前缀。先 exclude 检查再 include 检查 — exclude 规则胜出。
 *   - `_工作台` / `_archive` / `_归档`：过渡区 / 冷数据，不该污染向量空间
 *   - `原料/录音` / `原料/剪藏`：走摘要 embedding，不索引全文 chunk
 *   - `反馈` / `系统` / `.wiki`：流程 / 规范 / 元数据，跟知识检索无关
 */
export const vectorExcludePrefixes: readonly string[] = [
  '_工作台',
  '_archive',
  '_归档',
  '原料/录音',
  '原料/剪藏',
  '反馈',
  '系统',
  '.wiki',
];

/**
 * 向量库排除文件名（不含 `_INDEX.md` —— 注意跟 alwaysExcludeNames 不同）。
 * `_INDEX.md` 由 buildLayeredIndex 通过 L1 路径单独处理（embed 条目摘要），
 * 不应进 chunk 池；但当前 vectordb.shouldIndex 没有显式排除它，依赖 INCLUDE_DIRS
 * 圈定边界。本集合**严格保留迁移前行为**，不在本批改语义。
 */
export const vectorExcludeNames: ReadonlySet<string> = new Set(['.gitkeep', '.DS_Store']);

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
  for (const prefix of indexExcludeDirPrefixes) {
    if (rel === prefix || rel.startsWith(prefix + '/')) return true;
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
 * lint 不参与 orphan 检查的目录前缀（过渡区 / 冷数据 / 系统规范）。
 */
export const lintSkipOrphanPrefixes: readonly string[] = ['_工作台/', '_归档/', '系统/'];

/**
 * lint 不参与 frontmatter 检查的目录前缀（过渡区 / 冷数据）。
 * 注：`系统/` 故意保留 frontmatter 检查（schema 文件应规范）。
 */
export const lintSkipFrontmatterPrefixes: readonly string[] = ['_工作台/', '_归档/'];

// ---------------------------------------------------------------------------
// `lorekit snapshot` 专用规则
// ---------------------------------------------------------------------------

/**
 * snapshot 打包时跳过的目录 / 文件名。
 *   - .wiki：corpus 元数据（含向量库），快照里要重建不要拷
 *   - .git：corpus 自己的 git 仓库
 *   - .DS_Store：环境噪声
 */
export const snapshotExcludeNames: ReadonlySet<string> = new Set(['.wiki', '.git', '.DS_Store']);

// ---------------------------------------------------------------------------
// 内部 helper（用静态 import；放文件末尾以保持顶部导出干净）
// ---------------------------------------------------------------------------

import { lstatSync } from 'node:fs';
import { join as pathJoin } from 'node:path';
