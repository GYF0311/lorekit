---
cmap_version: 0.1
context_type: map
project: lorekit
source_commit: 62576ef
updated_at: 2026-05-17T14:34:56Z
confidence: ai-drafted
---
# Project Map

> 中文项目地图。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。

## Purpose
lorekit 是一个个人 LLM Wiki 工具包。它让 AI agent 把网页、笔记、会议、录音等原料整理成可长期复用的本地知识库，同时用确定性的 CLI 负责文件、状态、索引、检索、备份、恢复和安全删除。

核心边界：AI 负责语义判断和 wiki 编译，lorekit CLI 负责可验证、可回滚、可重复的确定性操作。

## Tech Stack & Runtime
- TypeScript ESM，Node.js >= 18，`commander` 做 CLI，`tsup` 负责构建。
- Runtime dependencies：`chalk`、`cheerio`、`turndown`、`gray-matter`、`tar`、`trash`、`better-sqlite3`。
- Optional dependencies / services：`sqlite-vec`、Ollama + `bge-m3`、外部 `gbrain` CLI。
- 测试使用 Node 内置 `node:test`，主要集中在 `tests/smoke/`。
- 构建产物在 `dist/`，不要手工改，跑 `npm run build` 生成。

## Entry Points
- 人类入口：`README.md`、`docs/QUICKSTART.md`、`docs/INSTALLATION.md`。
- AI 入口：`AGENTS.md`；`CLAUDE.md` 目前转发到 `@./AGENTS.md`，但本轮会补一段 CMAP 快速入口。
- 贡献者入口：`docs/CONVENTIONS.md`、`docs/ARCHITECTURE.md`、`docs/CODEBASE-MAP.md`、`docs/DESIGN-NOTES.md`、`docs/IDEAS.md`。
- CLI 入口：`bin/lorekit.js` -> `dist/cli.js`；源码入口是 `src/cli.ts`。
- 项目地图入口：`.context/CHECKPOINT.md` -> `.context/MAP.md` -> `cmap route "<task>"` -> `.context/modules/<module>.md`。

## Module Map
| 模块 | 职责 | 路径 | 文档 | 别名 |
|---|---|---|---|---|
| project-map | repo-local CMAP 记忆、AI 交接入口、模块关系、Obsidian/View 导出 | `.context/**`, `AGENTS.md`, `CLAUDE.md`, `_cmap/**`, `_cmap-view/**` | `.context/modules/project-map.md` | cmap, context, handoff, 接手 |
| cli | 注册命令、展示 banner、读取版本、统一 commander 退出码 | `src/cli.ts`, `bin/lorekit.js`, `VERSION`, `package.json`, `dist/**` | `.context/modules/cli.md` | command, version, banner |
| corpus-core | 识别 corpus、维护 schema/path 边界、root index 和通用工具 | `src/lib/corpus.ts`, `src/lib/paths.ts`, `src/lib/root-index.ts`, `src/lib/date.ts`, `src/utils/**` | `.context/modules/corpus-core.md` | schema, paths, index, logger |
| fetch-ingest | 抓取外部来源，并跟踪 URL -> 原料 -> wiki 的 ingest 进度 | `src/commands/fetch.ts`, `src/commands/ingest.ts`, `src/lib/fetcher/**`, `src/lib/ingest-state.ts` | `.context/modules/fetch-ingest.md` | fetch, ingest, state machine, WeChat |
| sync-search-vector | 刷新 `_INDEX.md` / root index，提供文本搜索、向量、BM25、RRF 检索 | `src/commands/dir-index.ts`, `src/commands/sync.ts`, `src/commands/search.ts`, `src/commands/vector.ts`, `src/lib/vectordb/**`, `src/lib/ollama.ts`, `src/lib/chunker.ts` | `.context/modules/sync-search-vector.md` | index, sync, search, vector, BM25, RRF |
| safety-maintenance | doctor/lint/snapshot/restore/remove/audit/stats 等安全维护命令 | `src/commands/doctor.ts`, `src/commands/lint.ts`, `src/commands/snapshot.ts`, `src/commands/restore.ts`, `src/commands/remove.ts`, `src/commands/audit.ts`, `src/commands/stats.ts` | `.context/modules/safety-maintenance.md` | doctor, lint, snapshot, restore, remove, audit |
| skills-agent | `wiki-*` markdown skills 与 AI 侧工作流约束 | `skills/**`, `integrations/claude-code/**`, `templates/default-corpus/AGENTS.md`, `templates/default-corpus/CLAUDE.md`, `src/commands/install-skills.ts` | `.context/modules/skills-agent.md` | wiki skills, agent workflows, install-skills |
| obsidian-gbrain | Obsidian 图谱配置 / 插件，以及 GBrain 只读 staging/export/sync/query | `src/commands/obsidian-tune.ts`, `src/lib/obsidian.ts`, `plugins/obsidian-audit/**`, `src/commands/gbrain.ts`, `src/lib/integrations/**`, `docs/integrations/**` | `.context/modules/obsidian-gbrain.md` | Obsidian, graph, GBrain, integration |
| docs-tests-release | 永久文档、smoke tests、构建配置、发布与变更记录 | `docs/**`, `tests/smoke/**`, `README.md`, `CHANGELOG.md`, `eslint.config.js`, `tsconfig.json`, `tsup.config.ts`, `package-lock.json` | `.context/modules/docs-tests-release.md` | docs, tests, verify, release |

## Natural Language Route
| 用户说法 | 模块 | 优先阅读 |
|---|---|---|
| 接手 / cmap / .context / 项目地图 / AGENTS / CLAUDE | project-map | `.context/modules/project-map.md` |
| 加命令 / CLI 输出 / 版本 / banner / commander | cli | `.context/modules/cli.md` |
| schema / 路径排除 / node_modules 被扫 / skills 被扫 / index.md | corpus-core | `.context/modules/corpus-core.md` |
| 抓网页 / 微信公众号 / fetch / ingest / duplicate / in-progress | fetch-ingest | `.context/modules/fetch-ingest.md` |
| sync / _INDEX / search / vector / BM25 / RRF / Ollama | sync-search-vector | `.context/modules/sync-search-vector.md` |
| doctor / lint / snapshot / restore / remove / trash / audit | safety-maintenance | `.context/modules/safety-maintenance.md` |
| wiki skill / install-skills / agent 接手 / project-local skills | skills-agent | `.context/modules/skills-agent.md` |
| Obsidian / graph filter / GBrain / integrations | obsidian-gbrain | `.context/modules/obsidian-gbrain.md` |
| 文档同步 / smoke test / verify / release / package scripts | docs-tests-release | `.context/modules/docs-tests-release.md` |

## Module Relationships
- `project-map` 是 repo-local 项目地图层，负责告诉 AI 先读哪里、怎么路由、哪些 `.context` 文件可信。它不替代 `AGENTS.md` / `CLAUDE.md`，只补长期项目续接。
- `cli` 是所有命令入口，调用各 `src/commands/*`；命令再调用 `corpus-core`、`fetch-ingest`、`sync-search-vector`、`safety-maintenance` 和 integration 模块。
- `corpus-core` 是路径、schema、logger、root index 的共享底座；其他模块遇到扫描边界时优先复用这里。
- `fetch-ingest` 负责从外部来源进入工作台和 `.wiki/ingest-state.json`；AI skills 再把它编译成 wiki。
- `sync-search-vector` 负责把 wiki 结果转成 `_INDEX.md`、root `index.md`、向量库和搜索结果。
- `safety-maintenance` 在高风险操作前后提供 snapshot、doctor、lint、restore、remove 等护栏。
- `skills-agent` 是语义工作流层；CLI 不调用 LLM，AI 行为由 markdown skills 约束。
- `obsidian-gbrain` 是外部阅读/检索视图层，只读或 staging，不应回写 `知识库/` / `原料/` 的事实。
- `docs-tests-release` 保证用户可见能力与文档、测试、构建、发布状态同步。

## Data Flow
1. 用户给 URL / 文本 / 文件线索。
2. `lorekit fetch` 把来源抓到 `_工作台/收件/`，并在 `.wiki/ingest-state.json` 写入 `started + stepsDone=[fetch]`。
3. AI 根据 `wiki-ingest` 把来源归档到 `原料/`，再编译或更新 `知识库/` 页面。
4. `lorekit ingest record/check` 记录 `archive/wiki/lint` 步骤，避免断点后丢状态。
5. `lorekit sync` 刷新 `_INDEX.md`、root `index.md`、可选 vector DB，并跑 doctor。
6. 用户查询时，AI 先 Read `index.md` / `_INDEX.md` / 具体页面；规模变大后可用 `lorekit vector query --hybrid` 辅助。
7. 输出、复盘或对外材料再通过 skill 判断是否 fileback 回 `知识库/`。

## State / Storage
- corpus 里的 canonical data：`原料/`、`知识库/`、root `index.md`、root `log.md`、corpus 内的 `AGENTS.md` / `CLAUDE.md`。
- corpus 里的 runtime metadata：`.wiki/ingest-state.json`、`.wiki/vector.sqlite`、`.wiki/reports/`、`.wiki/snapshots/`、`.wiki/integrations/`。
- lorekit 仓库自己的项目地图：`.context/`。
- `.context` canonical facts：`MAP.md`、`CHECKPOINT.md`、`STATUS.md`、`DECISIONS.md`、`VERIFY.md`、`modules/*.md`。
- `.context/out/`、`.context/inbox/`、`.context/generated/`、`.context/logs/`、`.context/ideas/` 是辅助层或过程层，不直接当项目事实。
- Obsidian 导出默认在 `_cmap/lorekit/`，中文 Review HTML 默认在 `_cmap-view/`。

## External Integrations
- Web fetch：原生 HTTP + HTML parse；必要时走可选 Playwright fallback。
- Obsidian：读取 markdown corpus，`obsidian-tune` 写 graph filter，`plugins/obsidian-audit` 支持反馈。
- Ollama / `sqlite-vec`：可选向量检索，不应阻塞纯文本层。
- GBrain：外部 CLI，只读读取 `.wiki/integrations/gbrain-export/` staging；不得直接改 canonical wiki。
- CMAP Review HTML / Obsidian export：从 `.context` 渲染视图，不重新做语义判断。

## Risk Areas
- 数据安全：禁止不可逆删除用户内容；`remove` 必须保留 snapshot + Trash + provenance-aware cleanup。
- 路径边界：新增排除目录必须集中到 `src/lib/paths.ts`，不要在各命令里散落硬编码。
- stdout/stderr：JSON / machine-readable 输出必须保持可管道；人类提示走 stderr。
- 向量环境：Ollama/native deps 失败不能拖死文本层工作流，除非当前任务明确是 vector。
- docs drift：新命令、新 skill、跨文件行为变动要同步 README/docs/ARCHITECTURE/CODEBASE-MAP/DESIGN-NOTES/QUICKSTART。
- CMAP drift：改 `.context` 后要刷新 `_cmap/lorekit` 和 `_cmap-view`，再跑 check。
- 入口文件：`AGENTS.md` / `CLAUDE.md` 只能追加或 marker merge，不做整文件覆盖。

## Verification Summary
- 代码基线：`npm run verify`。
- CMAP 路由：`cmap route "<task>"`。
- CMAP 结构：`cmap verify --changed`，必要时加 `--coverage` / `--stale` / `--freshness`。
- Obsidian 视图：`cmap obsidian export --out _cmap/lorekit` 后跑 `cmap obsidian export --check --out _cmap/lorekit`。
- Review HTML：`cmap view export --ui-lang zh-CN --out _cmap-view` 后跑 `cmap view export --check --ui-lang zh-CN --out _cmap-view`。
- 收尾：`git diff --check`。

## Handoff Notes
后续 AI 先读 `AGENTS.md`，再读 `.context/CHECKPOINT.md` 和 `.context/MAP.md`。不要一上来全量读 `.context`；先用 `cmap route "<task>"` 找模块，再读对应 `.context/modules/*.md`。
