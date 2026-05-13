# AGENTS.md — lorekit

## Project Status (2026-04-19, last updated: 2026-04-19 晚)

- **当前版本**：v0.4.0
- **最近完成**：21+22+23+24-fix（拆 fetcher / 拆 vectordb / 清 follow-up / 修 BM25 L0 gate 老 bug）+ 25/26（Obsidian graph filter 新老用户触达 + `lorekit obsidian-tune` + doctor 集成）+ GBrain 只读集成（`lorekit gbrain status/export/sync/doctor/query`，只写 `.wiki/integrations/`）
- **⚠️ 待 push**：本地 main 领先 origin/main 若干 commits（最新 `a498f1c` docs: 补 CHANGELOG + 修 ARCHITECTURE 过期引用）。上次 push 时 GitHub SSL 连接挂（网络瞬时故障），先生稍后自己 `git push origin main` 收尾，或让你帮他重试 push
- **待决策（高）**：harness 规则补全 + Read 路径保障 —— 详见 `docs/plans/2026-04-19-route-a-cli-upgrade.md` 与 `docs/plans/2026-04-19-route-b-schema-skill-upgrade.md`
- **待决策（中）**：综合 wiki schema 升级（按类型分目录 + domains tag + L0 改领域导览图）—— 详见 `docs/DESIGN-NOTES.md` §5.1 + `docs/IDEAS.md` 顶部"schema 升级"条目
- **新会话接手顺序**：AGENTS.md → docs/CONVENTIONS → docs/ARCHITECTURE → docs/CODEBASE-MAP → docs/DESIGN-NOTES → docs/IDEAS → docs/plans/（~25k tok 完全对齐）
- **历史日志**：`docs/history/`（WORKLOG / REFACTOR-PLAN / DEVLOG，默认不读）

### 给新 AI 的交接提醒（必读）

1. **先跑 `git status` + `git log --oneline origin/main..HEAD`** 确认是否有未 push 的 commits。有就先帮先生 push（如之前 SSL 挂过，就重试 `git push origin main`）
2. **功能完成 Definition of Done**：任何新命令 / 新 skill / 跨文件行为改动，必须同 commit 更新 docs。至少检查并按需更新 `docs/ARCHITECTURE.md`、`docs/CODEBASE-MAP.md`、`docs/DESIGN-NOTES.md`、`docs/QUICKSTART.md`；用户可见能力还要更新 `README.md`。下一个 AI 要靠这些文档接手和排 bug。
3. **跨文件级改动（拆库 / 改名 / 新模块）必须同步更新 `docs/ARCHITECTURE.md` + `docs/CODEBASE-MAP.md`**——这是 CONVENTIONS §13 维护原则 #1。之前批次 21/22/17 因漏做吃过亏（后补 `a498f1c`），别重犯
4. **新加 / 删 / 改 docs/ 前对照 CONVENTIONS §13** 文档架构清单，违反 Do Not #13 一律退回
5. **数据安全红线**：不许用 `rm`（用 trash）；不许改原料层（`原料/`）；破坏性命令拆开单步执行

---

> 给 AI Coding Agent（Claude Code / Codex / Cursor / Aider / Windsurf / Kimi CLI ...）的项目入口。
> 用户把 GitHub 链接丢给你，说"帮我装这个"或"帮我改这个"——你按本文操作。

## 你是哪种用法？

| 场景                       | 跳到                                       |
| -------------------------- | ------------------------------------------ |
| 安装 lorekit 给用户用      | 本文「安装与使用」                         |
| 在用户的 corpus 里日常运行 | 本文「日常使用」                           |
| 修改 lorekit 源码 / 提 PR  | 本文「贡献者文档」（强制读完 CONVENTIONS） |

---

## ⚠️ 数据安全红线（必须遵守）

1. **绝对不能删除用户已有的知识库 / 笔记内容**。不管是 `rm`、覆盖、还是清空——都不允许。
2. **安装前如果用户已有知识库 / 笔记目录，必须先备份**。用 `lorekit snapshot` 或 `tar` 打包到桌面，确认备份成功后再继续。
3. **不要用 `rm` 删除任何用户文件**。如果需要删除，用 `trash`（macOS 回收站，可恢复）。
4. **迁移 / 整理 / 归档操作中不允许出现 `rm`**。嵌套难看就让它嵌套，重复就让它重复——便利永远不能排在数据安全前面。
5. **链式破坏性命令必须拆开单步执行**，每步确认后再执行下一步。
6. **原料层（`原料/`）是只读的**，AI 不能修改或删除原料目录下的任何文件。

违反以上任何一条都可能导致用户不可恢复的数据丢失。

---

## 安装与使用

当用户说「帮我装这个项目」/「帮我安装 lorekit」/「set up this tool」时，按以下步骤执行：

### Step 1: 检查并安装依赖

```bash
which git    || echo "需要安装 git"
which node   || { echo "安装 Node.js..."; brew install node; }
# 可选依赖
which rg     || { echo "（可选）brew install ripgrep 加速文本搜索"; }
which ollama || { echo "（可选）brew install ollama 启用语义搜索"; }
```

Node.js 要求 >= 18。**不需要 bash / Python / uv**。

### Step 2: 克隆到本地

```bash
[ -d ~/code/lorekit ] || git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
```

### Step 3: 安装依赖并链接 CLI

```bash
cd ~/code/lorekit
npm install
npm run build
npm link            # 让 `lorekit` 命令全局可用
lorekit --version   # 验证版本（见 VERSION 文件）
```

### Step 4: 问用户知识库要放哪

默认建议 `~/Desktop/my-corpus`，但用户可能有自己的偏好。确认后执行：

```bash
lorekit init <用户选择的路径>
```

如果用户已有笔记 / 知识库目录，`lorekit init` 会自动检测并提供备份选项。

### Step 4.5: Obsidian 图谱配置（可选但推荐）

如果用户打算用 Obsidian 做可视化：

1. `lorekit init` 已自动写入 `.obsidian/graph.json` 推荐 filter（排除 `_工作台/_归档/反馈/系统/` + 索引 + 根元数据）
2. 若用户原 corpus 已有 `.obsidian/`，init 会自动跳过避免覆盖；
   提醒用户手动把以下 filter 复制到「关系图谱 → 筛选」并保存为默认：

   ```
   -path:"_工作台" -path:"_归档" -path:"反馈" -path:"系统" -file:"_INDEX" -file:"index" -file:"log" -file:"MEMORY" -file:"README" -file:"AGENTS" -file:"CLAUDE"
   ```

3. 改完 graph.json 后关掉「关系图谱」标签页再重开才生效

### Step 5: 安装 Agent Skills

```bash
# Claude Code
lorekit install-skills --target claude-code

# 其他 Agent（Codex / Cursor / Aider）
# skills 在 ~/code/lorekit/skills/ 下，按各 agent 的 skill 注册方式配置
# 每个 skill 是纯 markdown（SKILL.md），任何支持 markdown 指令的 agent 都能用
```

### Step 6: 告诉用户安装完成

1. 以后在知识库目录下开对话就能用
2. 说「帮我整理这篇文章」触发 ingest
3. 说「我之前整理过 xxx 吗」触发 query
4. 说「检查知识库健康度」触发 lint
5. 用 Obsidian 打开 corpus 目录可以浏览和跳转（已内置 lorekit-audit 插件）

---

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

---

## 日常使用

安装完成后，用户在 corpus 目录下开对话。AI 读到 corpus 内的 CLAUDE.md（schema）和 AGENTS.md 就自动进入知识库模式。

核心操作：

- **ingest**：用户给 URL / 文本 → AI 抓取 → 原文存 `原料/` → 编译进 `知识库/` → 更新 `index.md` + `log.md`
- **query**：用户提问 → AI 读 `index.md` 定位 → 读 wiki 页面 → 综合回答
- **fileback**：对话中的好洞察 → AI 写回知识库对应页面
- **lint**：定期健康检查 → 扫断链、孤岛、过期文件

可用的 CLI 命令：

```bash
lorekit doctor                              # 健康检查
lorekit stats                               # 统计
lorekit search <text>                       # ripgrep 文本搜索
lorekit fetch <url>                         # 网页抓取
lorekit snapshot                            # 备份快照
lorekit restore                             # 从快照恢复
lorekit audit --list                        # 查看反馈
lorekit lint                                # frontmatter / 死链 / 孤岛扫描

lorekit index                               # 递归生成所有 _INDEX.md（L1 书架）
lorekit sync                                # 一条命令：index → vector sync --layered → doctor
lorekit sync --json                         # 机器可读步骤报告
lorekit sync --report                       # 写 .wiki/reports/sync/<timestamp>.json
lorekit vector sync [--layered]             # 仅向量同步（需要 ollama bge-m3）
lorekit vector status                       # 看 mode 推荐（text|vector）+ indexed_files
lorekit vector query --hybrid --text "<q>"  # 混合检索（BM25+向量+RRF）
lorekit vector query --layered --text "<q>" # 纯向量分层（debug）
lorekit vector query --bm25 --text "<q>"    # 纯 BM25（debug 精确词 / 日期）

lorekit gbrain status                       # 可选：检查外部 GBrain 是否安装
lorekit gbrain export --dry-run             # 预览导出 知识库/ 到 .wiki/integrations/gbrain-export/
lorekit gbrain export                       # 生成 GBrain-safe staging；不改 知识库/ 或 原料/
lorekit gbrain sync --dry-run               # 预览 sync，不调用 gbrain import
lorekit gbrain sync                         # 调用外部 gbrain import，并写 sync-report.json
lorekit gbrain doctor                       # 检查 manifest stale / 上次 sync / binary 状态
```

详见 `docs/QUICKSTART.md` 和 `README.md`。

---

## 贡献者文档（改 lorekit 源码必读）

> 以下用 `@./` 引用，支持 include 语法的 agent（如 Claude Code）会自动加载。
> 不支持 include 的 agent，请手动打开对应文件阅读。

- @./docs/CODEBASE-MAP.md — 仓库地图：目录结构 + 关键文件 Top 10 + 依赖清单
- @./docs/ARCHITECTURE.md — 系统架构 + ingest / query 数据流（mermaid）+ 核心抽象
- @./docs/CONVENTIONS.md — 编码规范 + Do Not 红线（**强制**，违反一律退回）
- @./docs/DESIGN-NOTES.md — 设计决策与"为什么这样设计"
- @./docs/IDEAS.md — 待做灵感库（含原 LEGACY 残余项）
