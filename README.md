# lorekit

A personal LLM Wiki toolkit — let AI build and maintain your knowledge base.

基于 [Karpathy 的 LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)，lorekit 给 Claude Code（及任何支持 skill/markdown 指令的 agent）提供一套本地知识库工作流：**原料 → LLM 编译 → 持久 wiki**，知识编译一次、持续更新，不走 RAG。

## 核心理念

> "Instead of just retrieving from raw documents at query time, the LLM incrementally builds and maintains a persistent wiki." — Karpathy

- **原料层**（`原料/`）：只读原始素材，LLM 不改
- **产物层**（`知识库/`）：LLM 编译的 wiki，交叉引用、综合、持续更新
- **Schema**（`CLAUDE.md`）：每个 corpus 的配置，人和 LLM 共同维护

## 功能清单

| 功能 | 命令 | 说明 |
|---|---|---|
| 初始化 | `wiki init` | 创建 corpus 骨架 + 部署 Obsidian 插件 + 已有内容自动备份 |
| 健康检查 | `wiki doctor` | 目录完整性 + frontmatter 覆盖率 + 过期工作台提醒 |
| 统计 | `wiki stats` | 页数/类型分布 |
| 搜索 | `wiki search` | 文本搜索 + 向量语义搜索（混合） |
| 网页抓取 | `wiki fetch <url>` | 公众号/通用网页内容抓取到工作台 |
| 代码检查 | `wiki lint` | 断链/孤岛/重复检测 |
| 备份快照 | `wiki snapshot` | corpus 全量打包 + manifest |
| 快照恢复 | `wiki restore` | 从快照恢复缺失/变化的文件 |
| 反馈管理 | `wiki audit` | 创建/列出/处理人类对 wiki 的反馈 |
| 向量索引 | `wiki vector sync` | 增量嵌入 corpus 到 sqlite-vec |
| 语义查询 | `wiki vector query` | 基于向量的语义检索 |
| 索引状态 | `wiki vector status` | 查看向量索引状态 |

6 个 Agent Skills：`wiki-ingest` / `wiki-query` / `wiki-fileback` / `wiki-lint` / `wiki-enrich` / `wiki-audit`

## 快速开始

### 1. 安装 lorekit

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit && ./bin/install.sh
```

重开终端，验证：

```bash
wiki --version
# → lorekit wiki 0.1.0
```

### 2. 安装依赖

| 工具 | 用途 | 安装 |
|---|---|---|
| bash ≥ 4 | CLI 脚本 | macOS/Linux 自带 |
| git | 版本控制 | macOS/Linux 自带 |
| ripgrep | 文本搜索 | `brew install ripgrep` |
| jq | JSON 处理 | `brew install jq` |
| uv | Python 脚本运行 | `brew install uv` |
| **ollama** | **向量嵌入（本地）** | `brew install ollama` |
| **bge-m3** | **嵌入模型** | `ollama pull bge-m3` |

向量嵌入通过 ollama 本地 API 完成，**不需要装 torch/pip/sentence-transformers**，不需要 API key。

### 3. 初始化 corpus

```bash
wiki init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus
```

如果目标目录已有内容，会弹出选择菜单：备份后初始化 / 就地初始化 / 取消。

### 4. 安装 Claude Code skills

```bash
wiki install-skills --target claude-code
# → 软链 6 个 skill 到 ~/.claude/skills/
```

### 5. 开始使用

```bash
cd ~/Desktop/my-corpus
claude
```

用自然语言对话：

```
> 帮我把这篇文章整理进知识库：https://mp.weixin.qq.com/s/xxx
# → 触发 wiki-ingest：抓页面 → 存原料/ → 编译进知识库/

> 我之前整理过关于 RAG 的东西吗？
# → 触发 wiki-query：读 index.md → 向量搜索 → 综合回答

> 检查知识库的健康度
# → 触发 wiki-lint：扫断链、孤岛、过期文件

> 帮我备份一下
# → wiki snapshot → .wiki/snapshots/xxx.tar.gz
```

## 向量检索

### 嵌入模型

默认使用 **ollama + bge-m3**（BAAI 智源，1024 维，100+ 语言，中英双语效果优秀）。

```bash
# 确保 ollama 在运行
ollama serve

# 拉取 bge-m3（1.2GB，只需一次）
ollama pull bge-m3
```

也可以换其他 ollama 支持的嵌入模型：

```bash
# 用 nomic-embed-text
ollama pull nomic-embed-text
wiki vector sync --model nomic-embed-text

# 用 mxbai-embed-large
ollama pull mxbai-embed-large
wiki vector sync --model mxbai-embed-large
```

### 使用

```bash
# 同步索引（增量，只处理新增/变化的文件）
wiki vector sync

# 语义检索
wiki vector query --text "检索增强生成和知识库的关系"

# 查看索引状态
wiki vector status

# 全量重建
wiki vector sync --force
```

### 索引范围

| 进索引 | 不进索引 |
|---|---|
| `知识库/**` | `_工作台/**` |
| `每日/` | `_归档/**` |
| `写作/` | `原料/录音/**` |
| `原料/文章/` | `原料/剪藏/**` |
| `原料/书籍/` | `反馈/**` |
| `原料/会议/` | `系统/**` |

向量存储在 `.wiki/vector.sqlite`（sqlite-vec，单文件，零运维）。

## Corpus 目录结构

```
corpus/
├── CLAUDE.md           ← per-corpus schema（人 + LLM 共同维护）
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
├── 反馈/               ← 人类审阅闭环
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
└── .wiki/              ← lorekit 元数据
```

`知识库/` 子目录不是固定的——由每个 corpus 的 `CLAUDE.md` 声明，可以根据场景自定义（比如研究型 corpus 用 `wiki/papers/findings/`，读书 corpus 用 `wiki/characters/themes/`）。

## 自定义

lorekit 是骨架，不是固定结构。自定义方式：

1. **修改 CLAUDE.md 的 Scope**：声明你的 corpus 覆盖什么、不覆盖什么
2. **调整知识库子目录**：在 CLAUDE.md 中声明，然后创建对应目录
3. **修改 filing-rules**：在 `系统/filing-rules.md` 中追加归档路由规则
4. **换向量模型**：`wiki vector sync --model <ollama-model-name>`

## 备份与恢复

```bash
# 创建快照
wiki snapshot --tag before-migration
# → .wiki/snapshots/20260416-120000-before-migration.tar.gz

# 查看快照中的差异（不恢复）
wiki restore --from .wiki/snapshots/xxx.tar.gz --dry-run

# 恢复全部缺失/变化的文件
wiki restore --from .wiki/snapshots/xxx.tar.gz

# 只恢复单个文件
wiki restore --from .wiki/snapshots/xxx.tar.gz --file 知识库/概念/RAG.md
```

## Obsidian 集成

`wiki init` 时自动部署 `lorekit-audit` Obsidian 插件到 `.obsidian/plugins/`。在 Obsidian 中选中 wiki 文本 → 留反馈 → 写入 `反馈/待处理/`，LLM 通过 `wiki-audit` skill 批量处理。

## 项目结构

```
lorekit/
├── bin/
│   ├── wiki                 主命令分发器
│   ├── lib/                 子命令（init/doctor/stats/search/lint/fetch/
│   │                        snapshot/restore/audit/vector）
│   ├── vectors/             向量引擎（Python, ollama + sqlite-vec）
│   └── fetchers/            网页抓取后端（fetch_rich.py）
├── skills/                  6 个 Agent Skills（纯 markdown）
│   ├── wiki-ingest/
│   ├── wiki-query/
│   ├── wiki-fileback/
│   ├── wiki-lint/
│   ├── wiki-enrich/
│   └── wiki-audit/
├── plugins/
│   └── obsidian-audit/      Obsidian 审阅插件（编译产物）
├── templates/
│   └── default-corpus/      corpus 目录骨架
└── docs/
```

## License

MIT
