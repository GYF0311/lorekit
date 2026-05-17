---
cmap_version: 0.1
context_type: status
project: lorekit
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# Status

> 中文状态页。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。

## Active Goal
把 lorekit 的 `.context` 搭成可用的中文 CMAP 项目地图，并补齐 Obsidian / Review HTML 导出、`AGENTS.md` / `CLAUDE.md` 使用入口。

## 最近完成
- 已确认 `main` 对齐 `origin/main`，开始时没有未 push commit。
- 已运行 `cmap adopt`，生成 `.context` skeleton 和 `.context/ADOPTION.md`。
- 已阅读 `AGENTS.md`、`README.md`、`docs/CONVENTIONS.md`、`docs/ARCHITECTURE.md`、`docs/CODEBASE-MAP.md`、`docs/DESIGN-NOTES.md`、`docs/IDEAS.md` 与代表性源码。
- 已建立 9 个模块：`project-map`、`cli`、`corpus-core`、`fetch-ingest`、`sync-search-vector`、`safety-maintenance`、`skills-agent`、`obsidian-gbrain`、`docs-tests-release`。
- 已将 `.context` 正文中文化，同时保留 CMAP 必需英文结构标题和 frontmatter key。
- 已生成 `.context/graph/*.json`、`_cmap/lorekit/` 和 `_cmap-view/index.html`。
- 已在 `AGENTS.md` 和 `CLAUDE.md` 追加中文 CMAP 使用入口。

## 当前停靠点
CMAP 接入工作已完成，剩余事项是人工 review diff，并决定是否提交。

## Next Steps
1. 人工 review `.context/`、`_cmap/lorekit/`、`_cmap-view/index.html`、`AGENTS.md`、`CLAUDE.md` 的 diff。
2. 若认可这版接入，再考虑 commit。

## 变更文件
- `.context/**`
- `AGENTS.md`
- `CLAUDE.md`
- `_cmap/lorekit/**`
- `_cmap-view/index.html`

## 风险
- `AGENTS.md` / `CLAUDE.md` 不能覆盖，只能保留原内容并追加 CMAP 入口说明。
- `_cmap/lorekit` 和 `_cmap-view` 是生成视图，不能倒灌成 canonical facts。
- `.context` 是 repo-local 项目地图，不替代 docs/ 的长期架构文档。
- Review HTML 当前是项目理解页，不重做源码语义推断。

## Last Verified
2026-05-17：`cmap route` smoke checks 通过；`cmap verify --changed` 为 0 errors / 1 expected warning（`AGENTS.md` 与 `CLAUDE.md` 保持不同入口形态）；`cmap obsidian export --check --out _cmap/lorekit` 通过；`cmap view export --check --out _cmap-view` 通过；`git diff --check` 通过；`npm run verify` 通过（72 tests, 71 pass, 1 skipped）。
