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
