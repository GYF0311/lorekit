# lorekit QUICKSTART

30 分钟从零开始，让 Claude Code 拥有一个属于你的 Wiki。

---

## 0. lorekit 是什么

lorekit 是给 Claude Code（以及任意支持 skill / markdown 指令的 agent harness）的 **LLM Wiki toolkit**：一组 skill + 一个 corpus 目录骨架 + 一支薄 CLI（`wiki`），让 agent 能在本地知识库里 ingest、查询、回写、lint。

---

## 1. 前置要求

| 工具 | 用途 | 检查 |
|---|---|---|
| macOS / Linux | 目前只测过这俩 | `uname` |
| bash ≥ 4 | CLI 脚本 | `bash --version` |
| git | 克隆仓库 | `git --version` |
| ripgrep (`rg`) | 全文检索 | `rg --version` |
| Claude Code（可选但强烈推荐） | 最佳使用体验 | `claude --version` |

macOS 装 ripgrep：`brew install ripgrep`

---

## 2. 安装 lorekit

```bash
git clone https://github.com/gyf0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit
./bin/install.sh
```

`install.sh` 会把 `~/code/lorekit/bin` 加到你的 shell rcfile（zsh/bash/fish 自动识别）。重开一个终端或 `source ~/.zshrc`，然后验证：

```bash
$ wiki --version
lorekit wiki 0.1.0
```

---

## 3. 初始化你的第一个 corpus

corpus 就是一个装知识的目录。`wiki init` 会帮你建好骨架：

```bash
$ wiki init ~/Desktop/my-corpus
[lorekit] creating corpus at /Users/you/Desktop/my-corpus
  ├── 00_每日/     # 日记
  ├── 10_人物/     # people
  ├── 20_项目/     # projects
  ├── 30_概念/     # concepts
  ├── 40_主题/     # topics
  ├── 50_方法/     # methods / SOPs
  ├── 60_来源/     # sources (只读)
  ├── 70_录音/     # recordings
  ├── 80_写作/     # creations
  ├── 99_系统/     # schema + rules
  ├── _工作台/     # inbox / drafts / triage
  ├── _archive/    # cold storage
  ├── .wiki/       # lorekit metadata
  └── CLAUDE.md    # agent constitution
[lorekit] done. cd into it and open Claude Code.
```

目录是 lorekit 的默认约定（11 主 + 2 特殊），具体语义见 `99_系统/schema.md`。你可以改——lorekit 只认 `.wiki/` 这个元数据目录。

---

## 4. 装 Claude Code skills

让 Claude Code 能识别 `wiki-ingest` / `wiki-query` / `wiki-fileback` / `wiki-lint` 这几个 skill：

```bash
$ wiki install-skills --target claude-code
[lorekit] linking skills to ~/.claude/skills/
  ✓ wiki-ingest
  ✓ wiki-query
  ✓ wiki-fileback
  ✓ wiki-lint
[lorekit] restart Claude Code to pick up new skills.
```

skill 是软链，更新 lorekit 时自动跟进。

---

## 5. 第一次对话

```bash
cd ~/Desktop/my-corpus
claude
```

用自然语言直接说，skill 会自动触发：

**ingest 一个 URL：**
> 帮我把这篇文章整理进知识库：https://lilianweng.github.io/posts/2023-06-23-agent/

Claude Code 会触发 `wiki-ingest`，抓页面 → 清洗 → 落到 `40_知识与卡片/` 带 frontmatter。

**查一下：**
> 我之前整理过关于 ReAct 的东西吗？

触发 `wiki-query`，用 ripgrep + 可选向量层检索。

**lint 一下：**
> 检查知识库的健康度

触发 `wiki-lint`，扫孤岛、断链、重复、过时。

---

## 6. 手写 3 张锚点卡

为了给 Claude Code 一些初始 context，建议你第一天手写这三张 markdown 卡片：

### `10_人物/me.md`
你是谁、在做什么、沟通偏好、禁忌。Claude Code 通过 CLAUDE.md 指针找到它。

### `20_项目/<当前主要项目>.md`
现在占你最多时间的那个项目，一句话目标 + 当前状态 + 下一步。

### `30_概念/<第一个概念卡>.md`
随便挑一个最近在琢磨的概念，用你自己的话写下来。这是示范，Claude Code 之后生成的卡片会参考这个风格。

三张卡都需要 frontmatter：

```yaml
---
title: xxx
created: 2026-04-15 10:00
tags: [自建]
---
```

---

## 7. 常见问题

**skill 没触发怎么办？**
检查 `~/.claude/skills/wiki-*` 是否存在。如果在，重开 Claude Code 会话。再不行在 prompt 里显式说「用 wiki-ingest 整理这篇」。

**corpus 应该放哪里？**
推荐 `~/Desktop/` 或 `~/Documents/`，不要放 iCloud 同步目录（向量 sqlite 会被拖累）。个人 wiki 一个就够，项目专用 wiki 可以单独开。

**多 corpus 怎么办？**
CLI 认 cwd——`cd` 到哪个 corpus 就操作哪个。Claude Code 同理，在对应目录启动即可。

**向量层什么时候装？**
Phase 1 只用 ripgrep 就够了，几千张卡内无感。卡片数破 5000 或者开始需要「模糊意图查询」再 `wiki vector init` 启用向量层（Phase 2 特性）。

---

准备好了。遇到问题参考 [`../README.md`](../README.md) 或在 GitHub 提 issue。
