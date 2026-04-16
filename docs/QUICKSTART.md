# lorekit QUICKSTART

30 分钟从零开始，让 Claude Code 拥有一个属于你的 LLM Wiki。

---

## 0. lorekit 是什么

lorekit 是基于 [Karpathy LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 的个人知识库工具包。核心思路：不走 RAG，让 LLM 增量编译并维护一个持久 wiki——原料进来，LLM 编译成结构化的交叉引用页面，知识编译一次、持续更新。

---

## 1. 前置依赖

### 必需

| 工具 | 用途 | 安装 | 验证 |
|---|---|---|---|
| macOS / Linux | 操作系统 | — | `uname` |
| bash ≥ 4 | CLI 脚本 | 自带 | `bash --version` |
| git | 版本控制 | 自带 | `git --version` |
| ripgrep | 文本搜索 | `brew install ripgrep` | `rg --version` |
| jq | JSON 处理 | `brew install jq` | `jq --version` |
| uv | Python 脚本运行 | `brew install uv` | `uv --version` |

### 向量检索（推荐）

| 工具 | 用途 | 安装 | 验证 |
|---|---|---|---|
| ollama | 本地嵌入推理 | `brew install ollama` | `ollama --version` |
| bge-m3 | 嵌入模型（中英双语） | `ollama pull bge-m3` | `ollama list` |

ollama 是本地 LLM 运行框架，bge-m3 是 BAAI 智源开源的嵌入模型（1024 维，100+ 语言）。不需要 API key，不需要装 pip/torch/sentence-transformers。

### 可选

| 工具 | 用途 |
|---|---|
| Claude Code | 最佳使用体验（自然语言 → skill 自动触发） |
| Obsidian | 浏览 wiki + 使用内置的 lorekit-audit 审阅插件 |

---

## 2. 安装 lorekit

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit
./bin/install.sh
```

`install.sh` 把 `~/code/lorekit/bin` 加到 PATH。重开终端或 `source ~/.zshrc`，验证：

```bash
wiki --version
# → lorekit wiki 0.1.0
```

---

## 3. 初始化 corpus

```bash
wiki init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus
```

如果目录已有内容，会弹出选择：

```
⚠️  检测到 ~/Desktop/my-corpus 已有内容（352 个文件）

请选择：
  [1] 备份后初始化（推荐）→ 先 wiki snapshot，再初始化
  [2] 就地初始化 → 保留已有文件
  [3] 取消
```

初始化完成后你会得到：

```
corpus/
├── CLAUDE.md           ← 填写你的 corpus scope
├── index.md            ← wiki 内容目录（LLM 维护）
├── log.md              ← 操作时间线
├── 原料/               ← 只读原始素材
├── 知识库/             ← LLM 编译的 wiki
├── 每日/               ← 日记
├── 写作/               ← 创作输出
├── 反馈/               ← 审阅闭环
├── _工作台/            ← 过程文件
├── _归档/              ← 冷数据
└── .wiki/              ← 元数据
```

---

## 4. 安装 Claude Code skills

```bash
wiki install-skills --target claude-code
# → 软链 6 个 skill 到 ~/.claude/skills/
```

重启 Claude Code 生效。

---

## 5. 启动向量检索

确保 ollama 在运行，bge-m3 已下载：

```bash
# 启动 ollama（如果没有自动启动）
ollama serve

# 下载 bge-m3（1.2GB，只需一次）
ollama pull bge-m3

# 对 corpus 做第一次向量索引
wiki vector sync
# → synced N files (M chunks), skipped 0 unchanged
```

之后每次有新内容，跑一次 `wiki vector sync` 即可（增量，只处理变化的文件）。

---

## 6. 第一次对话

```bash
cd ~/Desktop/my-corpus
claude
```

**ingest 一篇文章：**
> 帮我把这篇文章整理进知识库：https://mp.weixin.qq.com/s/xxx

Agent 触发 `wiki-ingest`：抓页面 → 原文存 `原料/文章/` → 编译进 `知识库/` → 更新 `index.md` + `log.md`

**语义查询：**
> RAG 和 LLM Wiki 有什么区别？

Agent 触发 `wiki-query`：先读 `index.md` → 再向量搜索 → 综合回答

**回写洞察：**
> 把刚才的分析存进知识库

Agent 触发 `wiki-fileback`：按主语归到对应 wiki 页面

**健康检查：**
> 检查知识库的健康度

Agent 触发 `wiki-lint`：扫断链、孤岛、过期工作台文件

**备份：**
> 帮我备份一下知识库

Agent 执行 `wiki snapshot`

---

## 7. 手写 3 张锚点卡

给 Agent 一些初始 context：

### `知识库/实体/me.md`
你是谁、在做什么、沟通偏好。

### `知识库/实体/<当前项目>.md`
占你最多时间的项目，一句话目标 + 当前状态。

### `知识库/概念/<第一个概念>.md`
一个你最近在琢磨的概念。Agent 生成的新卡片会参考这个风格。

三张卡都带 frontmatter：

```yaml
---
type: entity
title: xxx
slug: 知识库/实体/xxx
created: 2026-04-16
updated: 2026-04-16
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
`wiki vector sync` 会报错提示。跑 `ollama serve` 启动。

**想换嵌入模型？**
```bash
ollama pull nomic-embed-text
wiki vector sync --model nomic-embed-text --force
```
`--force` 全量重建索引（因为模型变了）。

**已有知识库怎么迁移？**
```bash
wiki init ~/existing-notes
# → 自动检测已有内容，提供备份选项
```

---

## 9. 可选嵌入模型

默认 bge-m3，以下是 ollama 支持的其他嵌入模型：

| 模型 | 命令 | 大小 | 维度 | 适合 |
|---|---|---|---|---|
| **bge-m3**（默认） | `ollama pull bge-m3` | 1.2GB | 1024 | 中英双语，最均衡 |
| nomic-embed-text | `ollama pull nomic-embed-text` | 274MB | 768 | 英文为主，轻量 |
| mxbai-embed-large | `ollama pull mxbai-embed-large` | 670MB | 1024 | 英文强，中等大小 |
| snowflake-arctic-embed | `ollama pull snowflake-arctic-embed` | 670MB | 1024 | 英文检索优化 |
| all-minilm | `ollama pull all-minilm` | 45MB | 384 | 极致轻量 |

选模型的原则：内容以中文为主选 bge-m3；纯英文选 nomic-embed-text；磁盘紧张选 all-minilm。
