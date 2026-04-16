# lorekit QUICKSTART

30 分钟从零开始，让你的 AI Coding Agent 拥有一个属于你的 LLM Wiki。

---

## 0. lorekit 是什么

lorekit 是基于 [Karpathy LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 的个人知识库工具包。核心思路：不走 RAG，让 LLM 增量编译并维护一个持久 wiki——原料进来，LLM 编译成结构化的交叉引用页面，知识编译一次、持续更新。

纯 TypeScript 实现，只依赖 Node.js，支持任意 AI Coding Agent（Claude Code / Codex / Cursor / Kimi CLI / Aider / Windsurf）。

---

## 1. 前置依赖

### 必需

| 工具 | 用途 | 安装 | 验证 |
|---|---|---|---|
| Node.js ≥ 18 | JS 运行时 | `brew install node` | `node --version` |
| git | 克隆仓库 | 自带 | `git --version` |

### 可选（推荐）

| 工具 | 用途 | 安装 | 验证 |
|---|---|---|---|
| ripgrep | 文本搜索加速 | `brew install ripgrep` | `rg --version` |
| ollama | 本地向量嵌入 | `brew install ollama` | `ollama --version` |
| bge-m3 | 嵌入模型（中英双语） | `ollama pull bge-m3` | `ollama list` |
| Claude Code | 最佳使用体验 | [下载](https://claude.com/claude-code) | `claude --version` |
| Obsidian | 可视化浏览 wiki | [下载](https://obsidian.md) | — |

**不再需要 bash / Python / uv / pip**。lorekit 是纯 Node.js 项目，全平台（macOS / Linux / Windows）。

---

## 2. 安装 lorekit

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit
npm install
npm run build
npm link
```

`npm link` 把 `lorekit` 命令链接到全局 PATH。验证：

```bash
lorekit --version
# → 0.2.0

lorekit
# → 显示蓝色 ASCII 启动界面（无参数启动看 banner）
```

---

## 3. 初始化 corpus

```bash
lorekit init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus
```

如果目录已有内容，会弹出选择：

```
⚠️  检测到 ~/Desktop/my-corpus 已有内容（352 个文件）

请选择：
  [1] 备份后初始化（推荐）→ 先 lorekit snapshot，再初始化
  [2] 就地初始化 → 保留已有文件
  [3] 取消
```

初始化完成后你会得到完整的 corpus 目录结构（详见 README.md）。

---

## 4. 安装 AI Agent skills

```bash
lorekit install-skills --target claude-code
# → 软链 6 个 skill 到 ~/.claude/skills/
```

重启 Claude Code 生效。其他 AI Agent 按各自的 skill 注册方式配置 `~/code/lorekit/skills/` 下的 markdown 文件。

---

## 5. 启动向量检索（可选）

```bash
ollama serve          # 如果没自动启动
ollama pull bge-m3    # 1.2GB，只需一次

cd ~/Desktop/my-corpus
lorekit vector sync
```

之后每次有新内容，跑 `lorekit vector sync` 即可（增量，只处理变化的文件）。

---

## 6. 第一次对话

```bash
cd ~/Desktop/my-corpus
claude  # 或 codex / cursor / kimi 等
```

**ingest 一篇文章：**
> 帮我把这篇文章整理进知识库：https://mp.weixin.qq.com/s/xxx

Agent 触发 `wiki-ingest`：抓页面 → 原文存 `原料/文章/` → 编译进 `知识库/` → 更新 `index.md` + `log.md`

**语义查询：**
> RAG 和 LLM Wiki 有什么区别？

Agent 触发 `wiki-query`：先读 `index.md` → 再向量搜索 → 综合回答

**回写洞察：**
> 把刚才的分析存进知识库

**健康检查：**
> 检查知识库的健康度

**备份：**
> 帮我备份一下知识库

---

## 7. 手写 3 张锚点卡

给 Agent 一些初始 context：

### `知识库/实体/me.md`
你是谁、在做什么、沟通偏好。

### `知识库/实体/<当前项目>.md`
占你最多时间的项目。

### `知识库/概念/<第一个概念>.md`
一个你最近在琢磨的概念。Agent 生成的新卡片会参考这个风格。

三张卡都带 frontmatter：

```yaml
---
type: entity
title: xxx
slug: 知识库/实体/xxx
created: 2026-04-17
updated: 2026-04-17
---
```

---

## 8. 常见问题

**skill 没触发？**
检查 `~/.claude/skills/wiki-*` 是否存在。如果在，重开 Claude Code 会话。

**corpus 放哪里？**
推荐 `~/Desktop/` 或 `~/Documents/`，不要放 iCloud（sqlite 会被拖累）。

**多 corpus 怎么办？**
CLI 认 cwd，`cd` 到哪个 corpus 就操作哪个。

**ollama 没启动？**
`lorekit vector sync` 会报错提示。跑 `ollama serve` 启动。

**想换嵌入模型？**
```bash
ollama pull nomic-embed-text
lorekit vector sync --model nomic-embed-text --force
```

**已有知识库怎么迁移？**
```bash
lorekit init ~/existing-notes
# → 自动检测已有内容，提供备份选项
```

**想更新 lorekit？**
```bash
cd ~/code/lorekit
git pull
npm install
npm run build
# 无需重新 npm link，软链会自动指向新构建
```

---

## 9. 可选嵌入模型

默认 bge-m3，ollama 生态内可随意切换：

| 模型 | 命令 | 大小 | 维度 | 适合 |
|---|---|---|---|---|
| **bge-m3**（默认） | `ollama pull bge-m3` | 1.2GB | 1024 | 中英双语，最均衡 |
| nomic-embed-text | `ollama pull nomic-embed-text` | 274MB | 768 | 英文为主，轻量 |
| mxbai-embed-large | `ollama pull mxbai-embed-large` | 670MB | 1024 | 英文强，中等大小 |
| all-minilm | `ollama pull all-minilm` | 45MB | 384 | 极致轻量 |

选模型的原则：内容以中文为主选 bge-m3；纯英文选 nomic-embed-text；磁盘紧张选 all-minilm。
