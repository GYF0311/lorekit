# CLAUDE.md — lorekit 安装与使用指令

> 本文件指导任何 AI Coding Agent（Claude Code、Codex、Cursor、Aider、Windsurf 等）如何安装和使用 lorekit。
> 用户只需要把本仓库链接丢给 AI，AI 读到这份文件就知道怎么做。

## 这是什么

lorekit 是一个基于 Karpathy LLM Wiki 模式的个人知识库工具包。
安装后，AI 帮用户维护一个持久的、结构化的 markdown 知识库——原料进来，AI 编译成 wiki，知识积累而不是每次重新发现。

## 安装（AI 执行）

当用户说"帮我装这个项目"/"帮我安装 lorekit"/"set up this tool"时，按以下步骤执行：

### Step 1: 检查并安装依赖

```bash
which git      || echo "需要安装 git"
which rg       || { echo "安装 ripgrep..."; brew install ripgrep; }
which jq       || { echo "安装 jq..."; brew install jq; }
which uv       || { echo "安装 uv..."; brew install uv; }
```

### Step 2: 克隆到本地

```bash
[ -d ~/code/lorekit ] || git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
```

### Step 3: 把 CLI 加入 PATH

```bash
cd ~/code/lorekit && ./bin/install.sh
export PATH="$HOME/code/lorekit/bin:$PATH"
wiki --version
```

### Step 4: 问用户知识库要放哪

默认建议 `~/Desktop/my-corpus`，但用户可能有自己的偏好。确认后执行：

```bash
wiki init <用户选择的路径>
```

如果用户已有笔记/知识库目录，`wiki init` 会自动检测并提供备份选项。

### Step 5: 安装 Agent Skills

根据当前 agent 类型选择：

```bash
# Claude Code
wiki install-skills --target claude-code

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
wiki vector sync
```

不装也能用——AI 通过 index.md 文本定位内容，小规模完全够用。

## 使用（AI 日常）

安装完成后，用户在 corpus 目录下开对话。AI 读到 corpus 内的 CLAUDE.md（schema）和 AGENTS.md 就自动进入知识库模式。

核心操作：
- **ingest**：用户给 URL/文本 → AI 抓取 → 原文存 `原料/` → 编译进 `知识库/` → 更新 `index.md` + `log.md`
- **query**：用户提问 → AI 读 `index.md` 定位 → 读 wiki 页面 → 综合回答
- **fileback**：对话中的好洞察 → AI 写回知识库对应页面
- **lint**：定期健康检查 → 扫断链、孤岛、过期文件

可用的 CLI 命令：
```bash
wiki doctor          # 健康检查
wiki stats           # 统计
wiki search <text>   # 文本搜索
wiki fetch <url>     # 网页抓取
wiki snapshot        # 备份快照
wiki restore         # 从快照恢复
wiki audit --list    # 查看反馈
wiki vector sync     # 向量索引
wiki vector query    # 语义检索
wiki index           # 生成子目录索引
```

详见 `docs/QUICKSTART.md` 和 `README.md`。
