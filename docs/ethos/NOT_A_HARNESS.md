# lorekit 不是 harness

## 先把话说清楚

**我们不是 harness。**

Claude Code、Cursor、Codex、Cline、Aider 这些才是 harness——它们负责跑 LLM loop、管上下文、调工具、处理流式输出、协调 subagent。那是一门大学问，我们不碰。

lorekit 是 harness 的**工具包**：贡献 skill（markdown 指令）、骨架（corpus 目录约定）、薄 CLI（deterministic 的 `wiki` 命令）。仅此而已。

## 类比一下

| skill | 依赖的 harness / 底层工具 |
|---|---|
| `lark-*` skill | `lark-cli` 命令 |
| `bash` skill | Bash shell |
| `wiki-*` skill（lorekit） | `wiki` CLI + Claude Code |

lark skill 不需要自己实现一个 IM 协议栈，它站在 lark-cli 上面。lorekit 也一样——不需要自己实现 LLM loop，站在 Claude Code 上面。

## 为什么不自己造 harness

**因为 Claude Code 已经是地球上最好的 coding harness 了。** 上下文管理、tool use、subagent、hook、skill 系统，Anthropic 的工程师把这事做得又狠又细。我们再造一个只会更烂。

站在巨人肩膀上，把精力花在巨人还没顾上的地方——数据层、知识结构化、跨会话记忆——才是正经事。

## 为什么这个定位重要

**可组合性。** 今天你用 Claude Code，明天可能换 Codex，后天 GPT-6 出来又有新 harness。只要新 harness 支持 skill / markdown 指令这个抽象（目前看几乎都会支持），lorekit 的数据层（corpus 目录 + `.wiki/` 元数据）原封不动，只需要换一套 skill 绑定。

**不重写。** 你的知识库是你一辈子的资产，不该绑在任何一个 harness 的生命周期上。lorekit 的 corpus 是纯文本 markdown + sqlite，哪天 lorekit 自己死了你也能接着用 Obsidian 打开。

**专注。** 不造 harness 意味着我们可以把 skill 写厚、把 CLI 写薄、把 corpus 约定打磨精。Thin Harness, Fat Skills——这是 Garry Tan 在 YC 演讲里点出来的趋势，也是我们的赌注。

## 一句话

> lorekit = skills + corpus skeleton + thin CLI。harness 的活交给 harness，我们只管把 LLM 的 Wiki 层做扎实。
