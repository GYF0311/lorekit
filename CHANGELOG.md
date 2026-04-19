# Changelog

All notable changes to **lorekit** will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

_（留给下一个版本）_

## [0.4.0] — 2026-04-19

架构现代化分水岭：两个 P0 巨型文件拆分 + BM25 老 bug 修复 + 新用户 Obsidian 开箱即用。

### Added

- **`lorekit obsidian-tune`** 命令：老用户升级一键应用 Obsidian graph filter（默认只读 / `--write` 备份后写 / `--print` 管道用）
- **Obsidian graph filter 自动配置**：`lorekit init` 新 corpus 预置 `.obsidian/graph.json`（safe-write 不覆盖用户既有配置），排除 `_工作台 / _归档 / 反馈 / 系统 / _INDEX / 根元数据` 等非知识节点
- **`lorekit doctor`** 加 Obsidian filter 完整性检查
- `docs/DESIGN-NOTES.md` 设计决策永久文档（图书馆 4 层模型 / Karpathy 偏差 / queryLayered 失败根因 / 综合 wiki schema 升级方向）
- `docs/history/` 归档区 + `docs/plans/` 路线方案区
- `CONVENTIONS.md §13` 文档架构永久 reference + Do Not #13（防止 docs 再次膨胀）
- `AGENTS.md` 顶部 Project Status 段（新会话接手的 25k tok 入口）
- smoke test 扩展到 34 tests（init / ingest / vector / obsidian-tune 等）

### Changed

- **🏗️ 架构级重构**：`src/lib/fetcher.ts` (856 行) → `src/lib/fetcher/` 10 文件子模块（最大 180 行）
- **🏗️ 架构级重构**：`src/lib/vectordb.ts` (1057 行) → `src/lib/vectordb/` 10 文件子模块（最大 282 行）
- `src/commands/index.ts` → `src/commands/dir-index.ts`（消歧义）
- `docs/WORKLOG.md` / `REFACTOR-PLAN.md` / `DEVLOG.md` 归档到 `docs/history/`
- npm `version` hook 自动同步 VERSION 文件

### Fixed

- **⚠️ BM25 老 bug 根因修复**（批次 24-fix）：`queryBM25Layered` 取消 L0/L1 gate 走 chunk 直查。原设计在 `fts_dirs` 摘要做硬 gate，L0 永远空集 → 整条 BM25 查询链死。v0.4.0 之前 `lorekit vector query --bm25` 几乎从不返回结果（被 hybrid 融合下的向量路掩盖未暴露）。升级后首次能看到 BM25 真实命中，hybrid 检索质量**显著提升**
- `rrfMerge` 用前 80 字做 dedup key → 中文长文档假合并。改用 `sha256(text).slice(0,16)`（批次 23b）
- `sanitizeFtsQuery` 把 `2026-04-19` 拆成 `2026` token → 日期查询退化为年查询。改 protect-and-restore 保留 ISO 日期整 token（批次 23b）
- fetcher weixin route `<picture>` / `<source srcset>` 处理缺失 → 部分微信文章丢图（批次 21d / P4-4）
- `lorekit ingest record --wiki-page` / `--step` 多次调用不去重 → `[...new Set(...)]`（批次 20 / 20b）
- `lorekit ingest record --status xyz` 非法值静默写入 state → 显式校验 + exit 2（批次 12）
- 13 处 `console.log` / 沉默 catch → `logger` 分流（CONVENTIONS #2 #3 残留清零）

### Removed

- `docs/LEGACY.md`（P0 / P1 / P2 / P3 系列全部 ✅ 完成，P4 未决项 6 条迁入 `docs/IDEAS.md`）

### Internal

- ESLint 9 + Prettier 3 + `node:test` smoke 框架（批次 1 / 3）
- `lib/paths.ts` / `lib/date.ts` 抽出共用常量和 helper（批次 5-9）
- `utils/logger.ts` 加 `info` / `debug` / `out` / `print` 等级 + 全部走 stderr（批次 10 / 13 / 14）
- **lint baseline**：132 problems → 25 problems（净降 107）
- 共 26 批次重构 / 47+ commits / 24 tags 覆盖完整轨迹（详见 `docs/history/WORKLOG-2026-04-19.md` 与 git log）

## [0.3.0] — 2026-04-18

首版能力骨架（详见 `docs/history/DEVLOG-pre-refactor.md`）：

- wiki-ingest 流程下沉到 CLI + state machine
- 文本三层 + 向量三层共享档案 + 阶段 2 混合检索骨架（BM25 + 向量 + RRF）
- Obsidian 插件（audit）+ Web 预览服务器
