# CLAUDE.md — lorekit 安装与使用指令

> 本文件指导任何 AI Coding Agent（Claude Code、Codex、Cursor、Aider、Windsurf 等）如何安装和使用 lorekit。
> 用户只需要把本仓库链接丢给 AI，AI 读到这份文件就知道怎么做。

## 这是什么

lorekit 是一个基于 Karpathy LLM Wiki 模式的个人知识库工具包。纯 TypeScript 实现，只依赖 Node.js。
安装后，AI 帮用户维护一个持久的、结构化的 markdown 知识库——原料进来，AI 编译成 wiki，知识积累而不是每次重新发现。

## ⚠️ 数据安全红线（必须遵守）

1. **绝对不能删除用户已有的知识库/笔记内容**。不管是 `rm`、覆盖、还是清空——都不允许。
2. **安装前如果用户已有知识库/笔记目录，必须先备份**。用 `lorekit snapshot` 或 `tar` 打包到桌面，确认备份成功后再继续。
3. **不要用 `rm` 删除任何用户文件**。如果需要删除，用 `trash`（macOS 回收站，可恢复）。
4. **迁移/整理/归档操作中不允许出现 `rm`**。嵌套难看就让它嵌套，重复就让它重复——便利永远不能排在数据安全前面。
5. **链式破坏性命令必须拆开单步执行**，每步确认后再执行下一步。
6. **原料层（`原料/`）是只读的**，AI 不能修改或删除原料目录下的任何文件。

违反以上任何一条都可能导致用户不可恢复的数据丢失。

## 安装（AI 执行）

当用户说"帮我装这个项目"/"帮我安装 lorekit"/"set up this tool"时，按以下步骤执行：

### Step 1: 检查并安装依赖

```bash
which git   || echo "需要安装 git"
which node  || { echo "安装 Node.js..."; brew install node; }
# 可选依赖
which rg    || { echo "（可选）brew install ripgrep 加速文本搜索"; }
which ollama || { echo "（可选）brew install ollama 启用语义搜索"; }
```

Node.js 要求 >= 18。**不再需要 bash / Python / uv**。

### Step 2: 克隆到本地

```bash
[ -d ~/code/lorekit ] || git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
```

### Step 3: 安装依赖并链接 CLI

```bash
cd ~/code/lorekit
npm install
npm run build
npm link           # 让 `lorekit` 命令全局可用
lorekit --version  # 验证输出 0.2.0
```

### Step 4: 问用户知识库要放哪

默认建议 `~/Desktop/my-corpus`，但用户可能有自己的偏好。确认后执行：

```bash
lorekit init <用户选择的路径>
```

如果用户已有笔记/知识库目录，`lorekit init` 会自动检测并提供备份选项。

### Step 5: 安装 Agent Skills

根据当前 agent 类型选择：

```bash
# Claude Code
lorekit install-skills --target claude-code

# 其他 Agent（Codex/Cursor/Aider）
# skills 在 ~/code/lorekit/skills/ 下，按各 agent 的 skill 注册方式配置
# 每个 skill 是纯 markdown（SKILL.md），任何支持 markdown 指令的 agent 都能用
```

### Step 6: 告诉用户安装完成

安装完成后告诉用户：
1. 以后在知识库目录下开对话就能用
2. 说"帮我整理这篇文章"触发 ingest
3. 说"我之前整理过 xxx 吗"触发 query
4. 说"检查知识库健康度"触发 lint
5. 用 Obsidian 打开 corpus 目录可以浏览和跳转（已内置 lorekit-audit 插件）

## 安装向量检索（可选）

如果用户想要语义搜索能力：

```bash
which ollama || brew install ollama
ollama serve   # 如果没自动启动
ollama pull bge-m3

cd <corpus-path>
lorekit sync   # 一条命令：刷 _INDEX.md → 向量嵌入 → 建 FTS5 → doctor 体检
```

不装 ollama 也能用——AI 通过 `index.md` → `_INDEX.md` → 具体文件三层 Read 定位内容，< 100 文档时完全够用。
`lorekit vector status` 返回的 `mode` 字段会按 `MODE_THRESHOLD_FILES`（默认 100）自动推荐 text 还是 vector 模式，skill 读这个字段决定检索路径，不用手工记阈值。

## 使用（AI 日常）

安装完成后，用户在 corpus 目录下开对话。AI 读到 corpus 内的 CLAUDE.md（schema）和 AGENTS.md 就自动进入知识库模式。

核心操作：
- **ingest**：用户给 URL/文本 → AI 抓取 → 原文存 `原料/` → 编译进 `知识库/` → 更新 `index.md` + `log.md`
- **query**：用户提问 → AI 读 `index.md` 定位 → 读 wiki 页面 → 综合回答
- **fileback**：对话中的好洞察 → AI 写回知识库对应页面
- **lint**：定期健康检查 → 扫断链、孤岛、过期文件

可用的 CLI 命令：
```bash
lorekit doctor                        # 健康检查
lorekit stats                         # 统计
lorekit search <text>                 # ripgrep 文本搜索
lorekit fetch <url>                   # 网页抓取
lorekit snapshot                      # 备份快照
lorekit restore                       # 从快照恢复
lorekit audit --list                  # 查看反馈
lorekit lint                          # frontmatter / 死链 / 孤岛扫描

lorekit index                         # 递归生成所有 _INDEX.md（L1 书架）
lorekit sync                          # 一条命令：index → vector sync --layered → doctor
lorekit vector sync [--layered]       # 仅向量同步（需要 ollama bge-m3）
lorekit vector status                 # 看 mode 推荐（text|vector）+ indexed_files
lorekit vector query --hybrid --text "<q>"  # 混合检索（BM25+向量+RRF）— 阶段 2 标配
lorekit vector query --layered --text "<q>" # 纯向量分层（debug）
lorekit vector query --bm25 --text "<q>"    # 纯 BM25（debug 精确词/日期）
```

详见 `docs/QUICKSTART.md` 和 `README.md`。
