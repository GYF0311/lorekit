# lorekit

A personal LLM Wiki toolkit — let AI build and maintain your knowledge base.

基于 [Karpathy 的 LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)，lorekit 给任意 AI Coding Agent（Claude Code / Codex / Cursor / Kimi CLI / Aider 等）提供一套本地知识库工作流：**原料 → LLM 编译 → 持久 wiki**，知识编译一次、持续更新，不走 RAG。

> **把 GitHub 链接丢给你的 AI，说"帮我装这个"——AI 读到 CLAUDE.md / AGENTS.md 后会自动完成安装。**

## 核心理念

> "Instead of just retrieving from raw documents at query time, the LLM incrementally builds and maintains a persistent wiki." — [Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

传统 RAG：每次查询从原始文档重新检索，没有积累。

lorekit（LLM Wiki）：LLM 增量编译原料成结构化 wiki，知识一次编译、持续更新。交叉引用已就位、矛盾已标注、综合已反映全部来源。

三层架构：
- **原料层**（`原料/`）：只读原始素材，LLM 不改
- **产物层**（`知识库/`）：LLM 编译的 wiki，交叉引用、综合、持续更新
- **Schema**（`CLAUDE.md` / `AGENTS.md`）：每个 corpus 的配置，人和 LLM 共同维护

> **数据安全**：lorekit 对用户数据零容忍删除。已有知识库安装前自动备份；`原料/` 只读不可变；不使用 `rm`，删除走 `trash`（可恢复）。详见 CLAUDE.md 数据安全红线。

## 功能清单

| 功能 | 命令 | 说明 |
|---|---|---|
| 启动界面 | `lorekit` | 显示 corpus 状态概览 |
| 初始化 | `lorekit init` | 创建 corpus 骨架 + 部署 Obsidian 插件 + 已有内容自动备份 |
| 健康检查 | `lorekit doctor` | 目录完整性 + frontmatter 覆盖率 + 过期工作台提醒 |
| 统计 | `lorekit stats` | 页数/类型分布 |
| 搜索 | `lorekit search` | 文本搜索 + 向量语义搜索（混合） |
| 网页抓取 | `lorekit fetch <url>` | 公众号/通用网页内容抓取到工作台 |
| 代码检查 | `lorekit lint` | 断链/孤岛/重复检测 |
| 备份快照 | `lorekit snapshot` | corpus 全量打包 + manifest |
| 快照恢复 | `lorekit restore` | 从快照恢复缺失/变化的文件 |
| 反馈管理 | `lorekit audit` | 创建/列出/处理人类对 wiki 的反馈 |
| 向量索引 | `lorekit vector sync` | 增量嵌入 corpus 到 sqlite-vec |
| 语义查询 | `lorekit vector query` | 基于向量的语义检索（支持分层 L0/L1/L2） |
| 索引状态 | `lorekit vector status` | 查看向量索引状态 |
| 目录索引 | `lorekit index` | 生成/刷新子目录 _INDEX.md |

6 个 Agent Skills：`wiki-ingest` / `wiki-query` / `wiki-fileback` / `wiki-lint` / `wiki-enrich` / `wiki-audit`

## 快速开始

### 方式一：让 AI 自动安装（推荐）

把本仓库链接丢给你的 AI Coding Agent，说"帮我安装这个项目"。AI 读到 `CLAUDE.md` / `AGENTS.md` 后会自动执行：检查依赖 → 克隆 → 安装 CLI → 初始化 corpus → 装 skills。

### 方式二：手动安装

```bash
# 1. 克隆
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit

# 2. 安装依赖并构建
cd ~/code/lorekit && npm install && npm run build

# 3. 链接到全局（让 lorekit 命令全局可用）
npm link

# 4. 验证
lorekit
# → 显示启动界面

# 5. 初始化知识库
lorekit init ~/Desktop/my-corpus

# 6. 安装 Agent Skills
lorekit install-skills --target claude-code

# 7. 在知识库目录下开始对话
cd ~/Desktop/my-corpus
claude  # 或 codex / cursor / kimi 等
```

未来（npm 发布后）：`npx lorekit init` 一条命令搞定。

### 依赖

| 工具 | 用途 | 安装 | 必需 |
|---|---|---|---|
| Node.js ≥ 18 | JS 运行时 | `brew install node` | ✅ |
| git | 版本控制 | macOS/Linux 自带 | ✅ |
| ripgrep | 文本搜索加速（可选） | `brew install ripgrep` | 可选 |
| ollama | 本地向量嵌入 | `brew install ollama` | 可选 |
| bge-m3 | 嵌入模型 | `ollama pull bge-m3` | 可选 |

**只需要 Node.js**——不再需要 bash / Python / uv。lorekit 是纯 TypeScript 项目，全平台支持（macOS / Linux / Windows）。

向量检索是可选功能——不装 ollama 也能用，AI 通过 index.md 文本定位内容。

## 开始使用

```bash
cd ~/Desktop/my-corpus
claude  # 或 codex / cursor / kimi 等任意 AI Agent
```

用自然语言对话，AI 自动触发对应 skill：

```
> 帮我把这篇文章整理进知识库：https://mp.weixin.qq.com/s/xxx
# → wiki-ingest：抓页面 → 原文存原料/ → 编译进知识库/ → 更新 index.md

> 我之前整理过关于 RAG 的东西吗？
# → wiki-query：读 index.md → 定位页面 → 综合回答

> 把刚才的分析存进知识库
# → wiki-fileback：按主语写回对应 wiki 页面

> 检查知识库的健康度
# → wiki-lint：扫断链、孤岛、过期文件

> 帮我备份一下
# → wiki snapshot → .wiki/snapshots/xxx.tar.gz
```

## 向量检索

默认使用 **[ollama](https://ollama.com/) + [bge-m3](https://huggingface.co/BAAI/bge-m3)**（BAAI 智源，1024 维，100+ 语言，中英双语）。

通过 ollama 本地 API 完成嵌入，**不需要装 torch/pip/sentence-transformers，不需要 API key，数据不出本机**。

```bash
# 安装 ollama 和模型（一次性）
brew install ollama
ollama pull bge-m3

# 索引 corpus（增量）
lorekit vector sync

# 语义检索
lorekit vector query --text "检索增强生成和知识库的关系"

# 分层检索（L0 目录级 → L1 页面级 → L2 chunk 级，更精准）
lorekit vector sync --layered
lorekit vector query --text "xxx" --layered
```

可选嵌入模型（ollama 生态内随意切换）：

| 模型 | 安装 | 大小 | 维度 | 适合 |
|---|---|---|---|---|
| **bge-m3**（默认） | `ollama pull bge-m3` | 1.2GB | 1024 | 中英双语，最均衡 |
| nomic-embed-text | `ollama pull nomic-embed-text` | 274MB | 768 | 英文为主，轻量 |
| mxbai-embed-large | `ollama pull mxbai-embed-large` | 670MB | 1024 | 英文强 |
| all-minilm | `ollama pull all-minilm` | 45MB | 384 | 极致轻量 |

## Corpus 目录结构

```
corpus/
├── CLAUDE.md           ← per-corpus schema（AI Agent 自动读取）
├── AGENTS.md           ← 同 CLAUDE.md（给 Codex/Kimi/GPT 等读）
├── index.md            ← wiki 内容目录（LLM 每次 ingest 更新）
├── log.md              ← 操作时间线（append-only）
│
├── 原料/               ← Raw sources（只读，不可变）
│   ├── 文章/           ← 网页文章
│   ├── 论文/           ← 学术论文
│   ├── 书籍/           ← 读书笔记
│   ├── 会议/           ← 会议纪要
│   ├── 录音/           ← 录音整理稿
│   ├── 剪藏/           ← 公众号/网页剪藏
│   └── 引用/           ← 大文件指针
│
├── 知识库/             ← Wiki（LLM 编译产物）
│   ├── 概念/           ← 心智模型、方法论
│   ├── 实体/           ← 人物、工具、组织、项目
│   ├── 摘要/           ← 逐源摘要页
│   └── 专题/           ← 跨源主题综述（可选）
│
├── 每日/               ← 日记（YYYY-MM-DD.md）
├── 写作/               ← 对外创作输出
│
├── 反馈/               ← 人类审阅闭环（Obsidian 插件 + CLI）
│   ├── 待处理/
│   └── 已处理/
│
├── _工作台/            ← 过程文件（有过期策略）
│   ├── 收件/           ← 7 天
│   ├── 草稿/           ← 30 天
│   ├── 临时/           ← 14 天
│   └── 待整理/         ← 3 天
│
├── _归档/              ← 冷数据
└── .wiki/              ← lorekit 元数据（向量库、快照等）
```

`知识库/` 子目录不是固定的——由 `CLAUDE.md` 声明，可以根据场景自定义。

## 自定义

lorekit 是骨架，不是固定结构：

1. **修改 CLAUDE.md 的 Scope** — 声明 corpus 覆盖什么、不覆盖什么
2. **调整知识库子目录** — 面试场景加 `知识库/面经/`，读书场景改成 `知识库/角色/章节/`
3. **修改 filing-rules** — 在 `系统/filing-rules.md` 追加归档路由规则
4. **换向量模型** — `lorekit vector sync --model <ollama-model-name>`

## 备份与恢复

```bash
# 创建快照
lorekit snapshot --tag before-migration

# 查看差异（不恢复）
lorekit restore --from .wiki/snapshots/xxx.tar.gz --dry-run

# 恢复
lorekit restore --from .wiki/snapshots/xxx.tar.gz
```

`lorekit init` 检测到已有内容时也会自动提供备份选项。

## Obsidian 集成

`lorekit init` 自动部署 `lorekit-audit` Obsidian 插件。在 Obsidian 中选中 wiki 文本 → 留反馈 → 写入 `反馈/待处理/`，AI 通过 `wiki-audit` skill 批量处理。

所有 wiki 页面的 `[[双链]]` 在 Obsidian 中可直接点击跳转，graph view 可视化知识网络。

## 项目结构

```
lorekit/
├── bin/
│   └── lorekit.js           Node.js CLI 入口
├── src/                     TypeScript 源码
│   ├── cli.ts               命令分发 + 启动界面
│   ├── commands/            12 个子命令实现
│   ├── lib/                 核心库（corpus/ollama/vectordb/chunker/fetcher）
│   └── utils/               工具函数（logger/fs）
├── dist/                    tsup 编译产物（提交到仓库，省去用户构建）
├── skills/                  6 个 Agent Skills（纯 markdown，任何 agent 可用）
│   ├── wiki-ingest/
│   ├── wiki-query/
│   ├── wiki-fileback/
│   ├── wiki-lint/
│   ├── wiki-enrich/
│   └── wiki-audit/
├── plugins/
│   └── obsidian-audit/      Obsidian 审阅插件
├── templates/
│   └── default-corpus/      corpus 目录骨架
├── docs/
│   └── QUICKSTART.md        30 分钟上手指南
├── package.json             npm 包配置
├── tsconfig.json            TypeScript 配置
├── tsup.config.ts           构建配置
├── CLAUDE.md                AI Agent 自动安装指令（Claude Code）
└── AGENTS.md                AI Agent 自动安装指令（Codex/Kimi/GPT 等）
```

## 致谢

lorekit 的诞生离不开以下项目和作者：

### 核心灵感

| 来源 | 作者 | 贡献 |
|---|---|---|
| [LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) | **Andrej Karpathy** | 核心理念——三层架构（raw/wiki/schema）、ingest/query/lint 三操作、"wiki 是编译缓存不是内容本身"的哲学。lorekit 的灵魂来自这篇 gist |
| [llm-wiki-skill](https://github.com/lewislulu/llm-wiki-skill) | **Lewis Liu** | audit 反馈系统设计、Obsidian 审阅插件、references 指导文档体系。lorekit 的 `反馈/` 目录和 `lorekit-audit` 插件直接参考了这个项目 |

### 参考项目

| 项目 | 作者 | 贡献 |
|---|---|---|
| [llm-wiki-skill](https://github.com/lewislulu/llm-wiki-skill) | **Lewis Liu** | audit 反馈系统、Obsidian 插件、references 指导文档。lorekit 的 `反馈/` 目录和审阅插件直接参考 |
| [OpenViking](https://github.com/nicepkg/OpenViking) | **nicepkg** | Context Database 设计理念，启发了 lorekit 的分层向量检索架构 |

### 关键依赖

| 项目 | 作者 | 用途 |
|---|---|---|
| [bge-m3](https://huggingface.co/BAAI/bge-m3) | **BAAI 智源** | 默认嵌入模型（1024 维，100+ 语言，中英双语） |
| [sqlite-vec](https://github.com/asg017/sqlite-vec) | **Alex Garcia** | 向量存储引擎（单文件 sqlite 扩展） |
| [ollama](https://github.com/ollama/ollama) | **Ollama Inc.** | 本地模型推理框架，零配置嵌入 API |
| [qmd](https://github.com/tobi/qmd) | **Tobi Lütke**（Shopify CEO） | Karpathy 推荐的本地 markdown 搜索引擎，搜索设计参考 |

### 间接参考

| 来源 | 影响 |
|---|---|
| Vannevar Bush "As We May Think"（1945） | Karpathy 在原文中引用的 Memex 概念——个人策展的知识库，连接比文档本身更有价值 |
| [字节跳动 RAG 实践手册](https://blog.csdn.net/2401_84204207/article/details/155104775) | 分片策略、混合检索的工程实践参考 |
| [Coze Studio 源码](https://blog.csdn.net/AT_GCS/article/details/149905112) | 知识库四步流水线的设计参考 |
| [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) | 嵌入模型选型依据 |

### 设计原则

| 原则 | 来源 |
|---|---|
| "Thin CLI, Fat Skills" | Garry Tan（YC CEO）的 latent judgment in markdown 思路 |
| "Filesystem is all you need" | Unix 哲学 + Obsidian 纯文件设计 |
| "Compiled Truth + Timeline" | 类似 Wikipedia 的"正文可重写 + 历史只追加" |
| Per-corpus CLAUDE.md / AGENTS.md | Karpathy 的 Schema 概念 + Claude Code / Codex 的约定 |

## License

MIT
