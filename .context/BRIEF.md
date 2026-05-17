---
cmap_version: 0.1
context_type: brief
project: lorekit
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# Project Brief

> 中文项目简报。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。

## One-liner
lorekit 是个人知识 compilation harness：用 schema、markdown skills、确定性 CLI 和状态文件约束 AI，把原始材料持续编译成可复用的本地 wiki。

## 目标用户
- 高一帆先生，以及长期维护本地 corpus / Obsidian 知识库的个人用户。
- Codex、Claude Code、Cursor、Kimi CLI、Aider、Windsurf 等需要本地知识库工作流的 AI coding agent。
- 维护 lorekit CLI、skills、corpus schema、Obsidian/GBrain 集成的贡献者。

## 核心使用场景
- 初始化安全的 corpus：`原料/`、`知识库/`、`_工作台/`、`.wiki/`、Obsidian 配置和 agent 入口。
- 抓取网页、微信公众号、GitHub/Gist 文档到工作台，再让 AI 编译成 wiki 页面。
- 用 ingest state 精确记录每个来源走到 fetch / archive / wiki / lint 哪一步。
- 用 `sync` 刷 `_INDEX.md`、root `index.md`、可选向量库和 doctor 报告。
- 通过 Read-first 三层路径回答问题，规模变大后再引入 BM25/vector/RRF。
- 用 snapshot / restore / audit / remove 处理高风险维护，避免不可逆删除。
- 将 canonical wiki staging 到 GBrain，或导出 CMAP Obsidian / Review HTML 阅读层。

## 当前范围
当前产品面是 `lorekit` CLI v0.4.0 + `skills/wiki-*` markdown workflows。CLI 不调用 LLM，只提供确定性文件、状态、索引、检索和安全原语；语义判断留给 AI agent 和 skill。

## Non-goals
- 不做托管 RAG app。
- 不做自动知识 daemon。
- 不让 CLI 代替 AI/human 做语义归纳。
- 不修改 `原料/`，不做不可逆删除。
- 不把 GBrain 变成 runtime dependency，也不 vendor GBrain 源码。
- 不把新 CLI surface、底层修复和大规模内容清扫混在一批。

## 产品约束
- 数据安全优先级高于便利性：风险操作先 snapshot，删除走 OS Trash，cleanup 只按明确来源归因。
- `原料/` 只读；`知识库/` 是编译产物；`.wiki/` 是 state / report / index / integration metadata。
- Node.js >= 18 是唯一必需运行时；向量能力依赖可选 Ollama + `sqlite-vec`。
- CLI 的 stdout/stderr 分流必须保留，JSON 输出要可 pipe。
- 新命令、新 skill、跨文件行为变化必须同步永久文档。

## 当前阶段
`main` 对齐 `origin/main`，当前源码基线是 `62576ef`。2026-05-17 开始将 lorekit 接入 CMAP：`.context` 进入中文正文、模块路由、Obsidian 导出和 Review HTML 完整搭建阶段。

## 给 AI 的备注
先读 `AGENTS.md`。如果任务涉及项目接手、模块定位、上下文续接，再读 `.context/CHECKPOINT.md` 和 `.context/MAP.md`，然后运行 `cmap route "<task>"`。改代码前必须读对应 module doc 和 `docs/CONVENTIONS.md`。
