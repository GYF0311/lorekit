# 我的 Corpus

这是一个用 [lorekit](https://github.com/lorekit/lorekit) 初始化的个人知识 corpus。

## 它是什么

一个结构化的 Markdown 知识库，专门设计给 LLM harness（Claude Code / Codex / Cursor 等）读写。它有：

- 11 个主内容目录（人、项目、概念、主题、方法、来源、录音、写作、日记、领域、系统）
- 2 个特殊目录（`_工作台` 过程文件、`_archive` 冷数据）
- 一个 `.wiki/` 元数据目录（向量库、版本、缓存）
- 一套 Agent 宪法（`CLAUDE.md` + `99_系统/*`）

## 怎么用

### 第一次

1. 打开 `CLAUDE.md` 通读一遍——那是 Agent 和你都要遵守的规则。
2. 打开 `99_系统/filing-rules.md` 看归档路由表。
3. 在 `00_每日/` 创建今天的日记；在 `10_人物/` 放一两个你关心的人的卡片；在 `20_项目/` 放一两个正在做的项目。这样 Agent 才有上下文可读。

### 日常

- 想记点什么却没整理好 → 扔进 `_工作台/00_收件/`
- 有一篇想保存的文章 → 原文进 `60_来源/文章/`，结论/观点搬到对应主语目录
- 想搜"我之前整理过什么" → 让 Agent 用 `wiki query` 或 `wiki-query` skill
- 对话中产生的洞察 → 让 Agent 用 `wiki fileback` / `wiki-fileback` skill 存回去
- 定期体检 → `wiki lint` / `wiki-lint` skill 扫断链孤岛

### 规则

三条铁律，刻在 `CLAUDE.md`：

1. **主语决定归属**——判断这条内容讲的是谁/什么，再落盘
2. **sources 只放原文**——分析必须搬走
3. **任何 ingest 至少一条反向链接**

## 目录结构

见 `99_系统/schema.md`。

## 版本

当前 lorekit 版本记在 `.wiki/version`。
