# Changelog

All notable changes to **lorekit** will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [0.5.2] — 2026-07-05

Windows 适配版：平台差异全部由 CLI 吸收，skill 层保持单一套（不分平台）。

> 版本说明：npm 上的 `0.5.1` 发布于本批次完成之前的中间状态（仅含部分修复），
> 版本号已被占用不可覆盖；本节全部内容以 `0.5.2` 为准。

### Added

- **`lorekit trash <paths...>`**：跨平台可恢复删除（macOS 废纸篓 / Windows 回收站 /
  Linux trash）。skill 层清理工作台过渡副本、废稿的统一入口，取代 macOS 专属的
  `/usr/bin/trash`。硬边界：只收 corpus 内路径；`原料/` 只读拒绝；`知识库/` 提示走
  `lorekit remove`；`.wiki/` 拒绝。

### Changed

- `wiki-triage` / `wiki-ingest` / `corpus-ingest` skills 与 corpus 模板契约中的删除措辞
  统一为 `lorekit trash`，不再引用平台相关命令。
- **联网兜底转正**：`wiki-query` 默认查询顺序新增第 6 步——库内（含 `--all` 二级召回）
  无命中且问题涉及库外新知识 / 时效信息时直接联网检索，回答分层标注「库内已沉淀」vs
  「联网新查（URL，未入库）」；`corpus-query` 同步由"提议联网"改为直接兜底；corpus
  模板契约新增同款检索规则。

### Fixed

- **Windows 路径分隔符**：新增 `relPosix()` helper，全部 27 处 `path.relative` 调用点统一
  输出 POSIX 分隔符。修复 Windows 上 wikilink stem 解析全量误报 broken、`_INDEX.md` slug
  写出反斜杠、workbench 分桶失效、search 结果路径不一致等问题。
- **Windows install-skills 默认模式**：`--mode` 缺省时 Windows 下用 `copy`（symlink 需要
  开发者模式 / 管理员权限），macOS / Linux 仍默认 `symlink`。
- **Windows 环境变量与临时目录**：`install-skills` 的用户目录改用 `os.homedir()`（原
  `process.env.HOME` 在 Windows 上为空）；`fetch` 无 corpus 时的兜底目录改用
  `os.tmpdir()`（原硬编码 `/tmp`）。

## [0.5.0] — 2026-07-04

首个 npm 公开版本（包名 `@xiaowuovo/lorekit`，registry 相似度规则不允许裸名 `lorekit`；CLI 命令仍为 `lorekit`）。主题：工作台闭环（两级召回 / 过时治理 / 清算流程）+ 硬边界收紧。

### Added

- **`lorekit search --all`**：两级召回第二级——把 `_工作台/`、`_归档/` 等过程区纳入
  fallback 检索；仍排除 `.wiki/.git` 与 `_工作台/转写` 噪音层；与 `--dir` 互斥。
- **`lorekit lint` stale-review（软性提示）**：按 `domain_volatility`（high/medium/low →
  90/180/365 天）+ `last_reviewed`（缺省回退 `updated`）报告复审到期页，不计入失败。
- **`lorekit lint` unresolved-source（硬性）**：知识库页 frontmatter 的 `原料/`、`知识库/`
  来源引用必须可解析，防"入库搬家改路径导致 provenance 断链"。
- **`lorekit sync` 刷新 `MEMORY.md`**：L0 统计仪表盘（总页数/类型分布/最近活跃）由 sync
  机械喂数；语义字段与指针说明保留；无 MEMORY.md 的 corpus 跳过。
- **`lorekit workbench report`**：只读清算候选账单（`--json`）——账龄候选、活跃项目目录
  跳过、过程桶（收件/草稿/临时/待整理/下载）按单文件判账龄、噪音层固定排除；是
  `wiki-triage` skill 的确定性输入。
- **`wiki-triage` skill**：on-demand 工作台清算（扫描 → AI 预判分组 → 账单 → 用户勾选 →
  入库/归档/trash），未勾选不动任何文件。
- **`corpus-query` 多库注册表**：`global-corpus.json` 可选 `corpora` 字段，点名库名/alias
  即路由到任意注册 corpus；对不上注册表列出候选，不猜路径。
- **skills ↔ CLI 防漂移测试**（`tests/smoke/skills-cli-drift.test.mjs`）：从 CLI `--help`
  动态提取命令/子命令/flag 清单，比对 skills 引用，漂移即 verify 失败。
- wiki-ingest `original_path` 惯例：工作台晋升件入 `原料/` 时记录搬家前路径。

### Changed

- **BREAKING：corpus 识别只认 `.wiki/` 标记**，不再把 `CLAUDE.md` 当 marker——普通代码
  仓库普遍带 CLAUDE.md，误判会把 search/sync/lint 打到错误位置。老 corpus 若无
  `.wiki/`，重跑 `lorekit init` 补齐。
- `wiki-query` 默认查询顺序加第 5 步 `search --all` fallback，命中标注非 canonical。
- `wiki-lint` skill 与 CLI 实际检查项逐条对齐；SHA SOURCE MODIFIED / valid_until /
  矛盾检测明示为"CLI 未实现，需要时 AI 手动"。
- `templates/default-corpus` 契约同步：两级召回、`_归档/` 完结留存层定位、wiki-triage
  路由、corpora 注册表说明；模板 Harness 规则 7 的 SHA 措辞对齐工具现状。
- lint 问题分级引入 `SOFT_ISSUE_KINDS`（backlogged-link / stale-review 不计入失败）。

### Fixed

- Preserve multi-line WeChat `code-snippet__js` blocks during rich fetch instead of silently keeping only the first line.
- Make default `lorekit doctor` skip inactive optional GBrain checks, while explicit integration checks and existing GBrain state still surface health issues.

### Removed / Prior alignment (pre-0.5.0, 2026-06-11)

- Removed LoreKit native semantic indexing/search from the current product surface. `sync` is now documented and implemented as `_INDEX.md` + root `index.md` + `doctor`; default query guidance is `search` + index drill-down + canonical page readback.
- Narrow default sync guidance for workbench/process files: `lorekit sync` is now documented as a durable corpus closeout step, not something to run after every transient note.
- Clarify that `原料/` is the canonical raw-source layer; project-local evidence directories stay local unless explicitly ingested.

## [0.4.0] — 2026-04-19

架构现代化分水岭：P0 巨型文件拆分 + 新用户 Obsidian 开箱即用。

### Added

- **`lorekit obsidian-tune`** 命令：老用户升级一键应用 Obsidian graph filter（默认只读 / `--write` 备份后写 / `--print` 管道用）
- **Obsidian graph filter 自动配置**：`lorekit init` 新 corpus 预置 `.obsidian/graph.json`（safe-write 不覆盖用户既有配置），排除 `_工作台 / _归档 / 反馈 / 系统 / _INDEX / 根元数据` 等非知识节点
- **`lorekit doctor`** 加 Obsidian filter 完整性检查
- `docs/DESIGN-NOTES.md` 设计决策永久文档（图书馆 4 层模型 / Karpathy 偏差 / queryLayered 失败根因 / 综合 wiki schema 升级方向）
- `docs/history/` 归档区 + `docs/plans/` 路线方案区
- `CONVENTIONS.md §13` 文档架构永久 reference + Do Not #13（防止 docs 再次膨胀）
- `AGENTS.md` 顶部 Project Status 段（新会话接手的 25k tok 入口）
- smoke test 扩展到 34 tests（init / ingest / obsidian-tune 等）

### Changed

- **🏗️ 架构级重构**：`src/lib/fetcher.ts` (856 行) → `src/lib/fetcher/` 10 文件子模块（最大 180 行）
- `src/commands/index.ts` → `src/commands/dir-index.ts`（消歧义）
- `docs/WORKLOG.md` / `REFACTOR-PLAN.md` / `DEVLOG.md` 归档到 `docs/history/`
- npm `version` hook 自动同步 VERSION 文件

### Fixed

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
- 文本三层共享档案 + query/fileback workflow 骨架
- Obsidian 插件（audit）+ Web 预览服务器
