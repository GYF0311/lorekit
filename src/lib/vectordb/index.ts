/**
 * vectordb/index.ts — 子模块对外主入口（barrel re-export）
 *
 * v0.4.0：本文件是 vectordb 子模块的公开入口（barrel re-export）；
 * commands/vector.ts 通过本 barrel dynamic import 9 个公开 API
 * （openDb / syncFile / buildLayeredIndex / collectFiles / queryFlat /
 * queryLayered / queryBM25Layered / queryHybrid / getStatus）+ rrfMerge
 * + 常量 + types。本文件不含 runtime 代码。
 *
 * **公开 surface**（commands/*.ts 真正用到的 API）：
 * - 9 个 value：openDb / syncFile / buildLayeredIndex / collectFiles
 *   + queryFlat / queryLayered / queryBM25Layered / queryHybrid + getStatus
 * - 1 个额外算法 export：rrfMerge（commands 暂未用，但作为 hybrid 配套算法暴露）
 * - 2 个常量：EMBEDDING_DIM / MODE_THRESHOLD_FILES
 * - 3 个 type：Db / StatusInfo / QueryResult
 *
 * **不 re-export 的内部 helper**（保持封装，commands 不应直接调用）：
 * - sha256 / float32ToBuffer / distanceToScore / shouldIndex / extractPageSummary（files.ts）
 * - sanitizeFtsQuery（query-bm25.ts，私有）
 * - parseIndexSections / parseIndexEntries / findAllIndexFiles（build-layered-index.ts，私有）
 * - DDL / FTS_DDL / vecDdl / loadSqlite（schema.ts，仅 openDb 内部用）
 * - EmbedFn type（sync.ts + build-layered-index.ts 双 inline，commands 自定义实现喂入）
 *
 * **EmbedFn 决策**（22e 拍板）：保持双 inline 不上提到 schema.ts。理由：
 * (a) commands 不用 EmbedFn type（commands 自定义实现喂入 syncFile / buildLayeredIndex）
 * (b) 上提引入 sync/build-layered → schema.ts 的额外耦合
 * (c) 仅 2 处 inline，type 定义 1 行 + 注释 2 行，复制成本极小
 */

// ---------------------------------------------------------------------------
// 公开 value（commands/*.ts 用）
// ---------------------------------------------------------------------------

export { openDb } from './schema.js';
export { syncFile } from './sync.js';
export { buildLayeredIndex } from './build-layered-index.js';
export { queryFlat } from './query-flat.js';
export { queryLayered } from './query-layered.js';
export { queryBM25Layered } from './query-bm25.js';
export { queryHybrid, rrfMerge } from './query-hybrid.js';
export { getStatus } from './status.js';
export { collectFiles } from './files.js';

// ---------------------------------------------------------------------------
// 公开常量
// ---------------------------------------------------------------------------

export { EMBEDDING_DIM, MODE_THRESHOLD_FILES } from './schema.js';

// ---------------------------------------------------------------------------
// 公开 type
// ---------------------------------------------------------------------------

export type { Db, StatusInfo, QueryResult } from './schema.js';
