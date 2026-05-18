# AGENTS.md — lorekit

> 本文件是 lorekit 源码仓库的 AI coding 入口，只服务于开发、维护和交接。
> 如果用户要安装或使用 lorekit，请转到 `README.md`、`docs/INSTALLATION.md`、`docs/QUICKSTART.md`，不要把安装支持误当成源码改动任务。

## Project Status

- Last updated: 2026-05-18
- 当前版本：`v0.4.0`（以 `VERSION` 和 `package.json` 为准）
- 产品边界：AI 负责语义判断；lorekit CLI 负责确定性、安全、可重复的文件、状态、索引、检索动作。
- 近期重点：CMAP repo-local 项目地图、Obsidian / Review HTML 导出、可选 GBrain 只读 staging/query bridge。
- 当前交接事实源：`.context/CHECKPOINT.md` 和 `.context/STATUS.md`。
- 历史日志在 `docs/history/`，默认不读。

## 入口边界

| 读者 / 任务 | 先读 |
| --- | --- |
| 人类或用户评估 lorekit | `README.md` |
| 用户或 AI 安装 lorekit | `docs/INSTALLATION.md`，再读 `docs/QUICKSTART.md` |
| AI 修改 lorekit 源码 | 本文件，再按下方 CMAP route |
| 贡献者理解架构 | `docs/CONVENTIONS.md`、`docs/ARCHITECTURE.md`、`docs/CODEBASE-MAP.md`、`docs/DESIGN-NOTES.md` |

不要把长安装教程放进本文件。安装文档漂移时，改 `README.md` / `docs/INSTALLATION.md` / `docs/QUICKSTART.md`。

<!-- cmap:start -->
## CMAP 项目地图（接手时必读）

本仓库已接入 CMAP，`.context` 是 repo-local 项目地图，用来帮助 AI 新会话快速续接上下文；它不替代本文的项目规则。

接手顺序：

1. 先读本文，确认数据安全、文档同步和验证规则。
2. 读 `.context/CHECKPOINT.md` 看当前任务和最近验证。
3. 读 `.context/MAP.md` 看模块地图、数据流和路由规则。
4. 运行 `cmap route "<task>"`，只读取命中的 `.context/modules/<module>.md`，不要默认全量读取 `.context`。
5. 修改代码、docs 或 `.context` 后，按 `.context/VERIFY.md` 跑验证；收尾至少跑 `cmap verify --changed` 和 `git diff --check`。

可信事实源：`.context/MAP.md`、`.context/CHECKPOINT.md`、`.context/STATUS.md`、`.context/DECISIONS.md`、`.context/VERIFY.md`、`.context/modules/*.md`。

辅助层：`.context/out/`、`.context/inbox/`、`.context/generated/`、`.context/logs/`、`.context/ideas/`、`_cmap/lorekit/`、`_cmap-view/`。这些只做候选、日志或展示，不直接当项目事实。

正文约定：`.context` 的人读正文默认中文；frontmatter key、module id、命令、路径和代码标识符保留英文，保证 `cmap` CLI 可解析。
<!-- cmap:end -->

## AI 编码 12 条准则（原始版）

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

### Rule 1 — Think Before Coding

State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

### Rule 2 — Simplicity First

Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

### Rule 3 — Surgical Changes

Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

### Rule 4 — Goal-Driven Execution

Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

### Rule 5 — Use the model only for judgment calls

Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

### Rule 6 — Token budgets are not advisory

Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

### Rule 7 — Surface conflicts, don't average them

If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

### Rule 8 — Read before you write

Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

### Rule 9 — Tests verify intent, not just behavior

Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

### Rule 10 — Checkpoint after every significant step

Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

### Rule 11 — Match the codebase's conventions, even if you disagree

Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

### Rule 12 — Fail loud

"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

## 数据安全

1. 永远不要不可逆删除用户知识库或笔记内容。
2. 不要对用户文件使用 `rm`；需要删除时用 `/usr/bin/trash`。
3. 迁移、隔离、归档、整理任务中完全不要用 `rm`；目录嵌套难看也比数据丢失好。
4. 任何破坏性动作都不要用 `&&` / `||` 串联；拆成可观察的单步。
5. corpus 的 `原料/` 只读；AI 不得修改或删除原料。
6. `lorekit remove` 必须保持 snapshot + dry-run + Trash + provenance-aware cleanup 语义。

## 源码工作流

1. 先跑 `git status --short` 和 `git log --oneline origin/main..HEAD`。
2. 如果有未 push commits 或无关 dirty files，先报告；不要擅自 push 或 revert。
3. 跑 `cmap route "<task>"`，先读命中的模块，不要一上来全仓库扫读。
4. 优先复用现有 pattern、helper 和边界，不轻易新增抽象。
5. 不要手工改 `dist/**`；改 `src/**` 后用 build 生成。
6. JSON / 机器可读输出必须保持 stdout 干净；人类提示走 stderr。

## 文档规则

- 新命令、新 skill、跨文件行为变化，必须在同一 commit 更新文档。
- 用户可见行为：检查 `README.md` 和 `docs/QUICKSTART.md`。
- 安装或 setup 行为：检查 `docs/INSTALLATION.md`。
- 架构或模块边界变化：更新 `docs/ARCHITECTURE.md` 和 `docs/CODEBASE-MAP.md`。
- 设计取舍变化：更新 `docs/DESIGN-NOTES.md`。
- 新增、删除、重组 docs 前，先读 `docs/CONVENTIONS.md` 第 13 节。两份永久文档回答同一问题就是 bug。

## 验证

用最窄的检查证明当前改动；涉及代码或共享行为时再跑更宽检查。

| 改动类型 | 最小检查 |
| --- | --- |
| docs-only / AGENTS-only | `git diff --check`；若改 `.context`、`AGENTS.md` 或 `CLAUDE.md`，再跑 `cmap verify --changed` |
| CLI 行为 | targeted `node --test tests/smoke/<name>.test.mjs`，再跑 `npm run verify` |
| build / release surface | `npm run build`，`npm run verify` |
| CMAP context/view | `cmap verify --changed`，`cmap obsidian export --check --out _cmap/lorekit`，`cmap view export --check --ui-lang zh-CN --out _cmap-view` |

未检查相关命令输出前，不要声称 done、fixed 或 passes。

## 贡献者参考

按 route 需要再读：

- `docs/CONVENTIONS.md` — 项目宪法和 Do Not 红线
- `docs/ARCHITECTURE.md` — 系统设计和数据流
- `docs/CODEBASE-MAP.md` — 目录地图和关键文件
- `docs/DESIGN-NOTES.md` — 设计理由和失败教训
- `docs/IDEAS.md` — 未决想法和未来方向
