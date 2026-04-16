# CLAUDE.md — lorekit 项目指令

> 本文件指导 AI Agent 如何安装和使用 lorekit。
> 用户只需要把本仓库链接丢给 AI，AI 读到这份文件就知道怎么做。

## 这是什么

lorekit 是一个基于 Karpathy LLM Wiki 模式的个人知识库工具包。
用户安装后，AI 可以帮用户维护一个持久的、结构化的 markdown 知识库。

## 安装（AI 执行）

当用户说"帮我装这个项目"或"帮我安装 lorekit"时，按以下步骤执行：

### Step 1: 克隆到本地（如果还没克隆）

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
```

### Step 2: 把 CLI 加入 PATH

```bash
cd ~/code/lorekit && ./bin/install.sh
export PATH="$HOME/code/lorekit/bin:$PATH"
```

### Step 3: 验证安装

```bash
wiki --version
# 应该输出: lorekit wiki 0.1.0
```

### Step 4: 问用户知识库要放哪

默认建议 `~/Desktop/my-corpus`，但用户可能有自己的偏好。确认后执行：

```bash
wiki init <用户选择的路径>
```

如果用户已有知识库/笔记目录，`wiki init` 会自动检测并提供备份选项。

### Step 5: 安装 Claude Code skills

```bash
wiki install-skills --target claude-code
```

这会把 6 个 skill 软链到 `~/.claude/skills/`。

### Step 6: 告诉用户

安装完成后告诉用户：
1. 以后在知识库目录下开对话就能用（`cd <corpus-path> && claude`）
2. 说"帮我整理这篇文章"触发 ingest
3. 说"我之前整理过 xxx 吗"触发 query
4. 说"检查知识库健康度"触发 lint
5. 用 Obsidian 打开 corpus 目录可以浏览和跳转

## 安装向量检索（可选）

如果用户想要语义搜索能力，需要 ollama：

```bash
# 检查 ollama 是否已安装
which ollama

# 没有的话
brew install ollama

# 启动 ollama 并下载嵌入模型
ollama serve  # 如果没有自动启动
ollama pull bge-m3

# 做第一次向量索引
cd <corpus-path>
wiki vector sync
```

如果用户不需要向量检索，跳过这步即可。知识库正常使用不依赖向量——AI 通过 index.md 定位内容。

## 依赖检查

安装前检查以下工具是否存在，缺了就装：

```bash
# 必需
which git      || echo "需要安装 git"
which rg       || echo "brew install ripgrep"
which jq       || echo "brew install jq"
which uv       || echo "brew install uv"

# 可选（向量检索用）
which ollama   || echo "brew install ollama（可选）"
```

## 使用（AI 日常）

安装完成后，用户在 corpus 目录下开对话，AI 读到 corpus 内的 CLAUDE.md 就自动进入知识库模式。

核心操作：
- **ingest**：用户给 URL/文本 → AI 抓取 → 原文存原料/ → 编译进知识库/
- **query**：用户提问 → AI 读 index.md 定位 → 读 wiki 页面 → 综合回答
- **fileback**：对话中的好洞察 → AI 写回知识库对应页面
- **lint**：定期健康检查 → 扫断链、孤岛、过期文件

详见 `docs/QUICKSTART.md`。
