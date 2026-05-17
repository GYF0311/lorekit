---
cmap_version: 0.1
context_type: decision
project: lorekit
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: high
---
# 决策记录

## 2026-05-17 — 先搭 `.context`，再安全追加入口文件

**Context:** 仓库已有内容很重的 `AGENTS.md`，`CLAUDE.md` 目前是一行 `@./AGENTS.md` 转发。先生明确提醒不要错误覆盖这两个入口文件。
**Decision:** 先用 `.context` 建 CMAP 项目地图；入口文件只用 `apply_patch` 追加简短中文说明，不运行会直接写入的 `bootstrap`。
**Why:** `bootstrap` 没有 dry-run，虽然当前 install 语义是 marker merge，但手工 patch 更容易审阅，也更符合先生对入口文件安全的要求。
**Impact:** `.context` 可以立刻成为项目续接地图；入口文件仍保留原规则，只多一个 CMAP 读取顺序。
**Revisit if:** 后续希望完全改成标准 `<!-- cmap:start -->` marker block。

## 2026-05-17 — lorekit CLI 继续保持确定性、LLM-free

**Context:** lorekit 的架构核心是 thin CLI + fat skills。CLI 提供文件系统、状态、索引、检索和安全操作；AI skills 负责语义判断。
**Decision:** CMAP 模块边界保留这条分工。语义工作流归 `skills-agent`；确定性实现归 `cli`、`corpus-core`、`fetch-ingest`、`sync-search-vector`、`safety-maintenance` 等模块。
**Why:** 这是 lorekit 的产品边界，能防止它滑向 RAG app、workflow OS 或 autonomous daemon。
**Impact:** 新需求先判断是 skill 规则、CLI 原语、docs 更新，还是 corpus 使用侧反馈。
**Revisit if:** lorekit 明确改变定位，从本地 LLM Wiki toolkit 变成 agent runtime 或服务端系统。

## 2026-05-17 — `.context` 正文用中文，格式字段保留英文

**Context:** 先生要求本项目 `.context` 的正文内容是中文，但 `cmap` CLI 依赖 frontmatter 字段读取 module id、aliases、paths、relations。
**Decision:** Markdown 正文、交接说明、模块说明用中文；frontmatter key、module id、路径、命令、代码标识符保持英文。
**Why:** 这样既方便人读，也不破坏工具解析。
**Impact:** 后续更新 `.context` 时默认中文正文；不要把 frontmatter 字段翻译成中文。
**Revisit if:** `cmap` CLI 未来支持本地化 frontmatter schema。
