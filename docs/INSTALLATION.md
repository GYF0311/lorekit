# INSTALLATION.md — lorekit 安装与模块组合指南

> Last updated: 2026-06-02

本文回答两个问题：

1. 默认只安装 lorekit CLI 时，如何初始化和运行一个知识库 corpus。
2. 什么时候把项目级 Agent Skills、中央 corpus 入口、项目级隔离组合进来。

## 先问用户

AI 帮用户安装时，先问一个简短问题。默认推荐单 lorekit，因为其他组合会引入额外概念、配置文件和长期维护成本。用户只说“安装一下”或没有明确选择时，执行默认路线，不要自动安装 skills 或 project-local wrapper。

```text
我可以帮你安装 lorekit。推荐默认是「只安装 lorekit CLI」：
安装全局 `lorekit` 命令、初始化 corpus、跑 `lorekit doctor`。
这条学习成本最低，后续需要时可以再加模块。

你要哪一种？
1. 只安装 lorekit CLI（推荐）
2. CLI + 项目级 Agent Skills：安装 `wiki-*`，让 agent 在当前 corpus / 当前项目里显式触发工作流。
3. CLI + Project-local research corpus：把 `wiki-*` 安装到项目 `skills/`，并在 `AGENTS.md` 记录项目/domain skill 路由。
4. CLI + Central corpus entrypoints：显式安装选定 `corpus-*` / `wiki-daily`，让任意项目能路由到同一个 corpus。
5. Hybrid：只在确实需要时，把中央入口与项目级 `wiki-*` 执行细则组合。
```

默认建议：

- 普通知识库用户：只安装 lorekit CLI，初始化 corpus，跑 `lorekit doctor`。
- 想让 agent 有明确工作流入口时，再安装目标 agent 对应的项目级 `wiki-*` skills。
- 研究型知识库通常选择 Project-local：项目内 `skills/wiki-*` 执行 LoreKit 原生 ingest/query/fileback，项目/domain skill 只做领域路由和定制。
- 需要从任意代码项目访问同一个个人 corpus 时，再显式安装选定 `corpus-*`；这是中央知识库拓扑，不是默认路线。
- 安装器类 skill 也可以全局保留，例如 `lorekit-corpus-bootstrap`，用于快速部署项目级配置。

AI 安装规则：

- 默认路线不运行 `lorekit install-skills`。
- 用户选择 Codex 项目级 skills 时，运行 `--target codex --mode copy`；默认安装 `wiki-*` 项目工作流，不安装 `corpus-*` 或 `wiki-daily`。
- 用户选择 Project-local research corpus 时，运行 `--target project --mode copy`，把 `wiki-*` 放在当前项目 `skills/` 并用 `AGENTS.md` 短路由。
- 用户选择 Codex `wiki-daily` 时，只运行 `--only wiki-daily`，不要顺手装 `corpus-*`。
- 用户选择中央 corpus 入口时，使用 `--only corpus-query,corpus-capture,...` 显式安装选定 `corpus-*`；不要把它解释成 Codex 默认。
- 每加一个组合，都要说明它解决什么问题、增加什么学习成本、需要维护哪个配置文件。

## 模块组合速查

| 组合 | 包含 | 不包含 | 适合 |
| --- | --- | --- | --- |
| 默认：CLI only | `lorekit` CLI + corpus skeleton | skills / project wrapper | 新用户、最小安装、验证工具本体 |
| CLI + Agent Skills | CLI + `wiki-*` project workflows | 中央 corpus 配置 | 希望 agent 在当前项目触发 ingest / query / fileback |
| CLI + Project-local research | CLI + 当前项目 `skills/wiki-*` + `AGENTS.md` 短路由 | central gateway skills | 研究型知识库、团队库、项目专有 skill 定制 |
| CLI + Central Corpus | 显式选定的 Codex `corpus-*` / `wiki-daily` + `global-corpus.json` | project-local execution rules | 任意项目都要访问同一个个人 corpus |
| Hybrid | 中央入口 skills + 项目级执行 rules | — | 一个 central corpus 服务多个项目；可选高级拓扑 |

## 路线 A：只安装 lorekit（默认）

此时 lorekit 已能完成摄入、维护、查询、同步、备份和安全删除。

### 1. 安装源码和 CLI

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit
npm install
npm run build
npm link
lorekit --version
```

Node.js >= 18 是唯一硬依赖。`ripgrep` 是可选文本搜索加速。

### 2. 初始化 corpus

```bash
lorekit init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus
lorekit doctor
```

如果目录里已有内容，先走 lorekit 的备份提示；不要手动移动或删除用户内容。

### 3. 可选：安装 lorekit skills

基础 lorekit 不要求安装 skills。skills 是 agent 侧触发层，用来把 ingest / query / fileback / lint / daily 等工作流显式暴露给 Claude Code、Codex 或其他 agent。

#### 默认：不安装 skills

默认路线到这里已经完成：

```bash
lorekit --version
cd ~/Desktop/my-corpus
lorekit doctor
```

没有用户明确选择时，AI 安装器应停在这里，并提示后续可按模块追加 skills。

#### Claude Code / Codex project workflow skills（可选）

默认安装项目级 `wiki-*` 工作流，不安装中央 corpus 的 `corpus-*`，也不安装 `wiki-daily`。这些 skills 应作用于当前 corpus / 当前项目。

```bash
lorekit install-skills --target claude-code
lorekit install-skills --target codex --mode copy
```

Claude Code 写入 `~/.claude/skills/`；Codex 写入 `~/.agents/skills/`。虽然目标目录是 agent 的用户级 skill 目录，但默认安装的是 current-project `wiki-*` workflow：调用后必须先以当前 cwd / 当前 corpus 的 `AGENTS.md` 和 `skills/wiki-*` 为准，不应跨项目写中央库。

如果你希望 skills 物理落在当前 research corpus 内，用 project target：

```bash
cd ~/Desktop/my-research-corpus
lorekit install-skills --target project --mode copy
```

这会写入 `./skills/wiki-*`。如果当前 shell 不在目标 corpus 里，可以用 `--dest /path/to/corpus/skills` 指定安装目录。随后在 `AGENTS.md` 里放短路由表即可。

#### Codex personal diary gateway（可选）

如果只要个人日记入口，可以只安装 `wiki-daily`：

```bash
lorekit install-skills --target codex --only wiki-daily --mode copy
```

这会把 `skills/wiki-daily` 复制到 Codex 的 `~/.agents/skills`，让 `$wiki-daily` 可作为目标 corpus 的 daily workflow 使用。然后创建配置：

```bash
mkdir -p ~/.config/lorekit
$EDITOR ~/.config/lorekit/daily.json
```

最小配置：

```json
{
  "default_corpus": "/ABSOLUTE/PATH/TO/CORPUS",
  "daily_inbox_dir": "_工作台/日记收件",
  "daily_archive_dir": "_归档/日记收件",
  "daily_dir": "每日",
  "knowledge_dir": "知识库",
  "output_dir": "输出/复盘",
  "journal_day_boundary": "04:00",
  "timezone": "Asia/Shanghai",
  "notifications": {
    "enabled": false,
    "channel": "lark",
    "lark_user_id": "ou_xxx",
    "send_on": [
      "daily_compile_candidates",
      "rolling_synthesis_candidates",
      "weekly_synthesis_candidates"
    ]
  }
}
```

`notifications` 是可选配置。打开后，daily compile / rolling synthesis / weekly synthesis 只在生成 `Suggested fileback candidates` 时发一条飞书 / Lark bot 提醒，内容包含来源路径、候选编号、短摘要和可复制到 Codex 的确认句。提醒不是写库确认；真正写入 `知识库/` 仍需要回到 Codex 明确说“确认第几条写入知识库”。

以下内容是用户本机配置，不会随 lorekit repo 分发或 `git push` 同步：

- `~/.config/lorekit/daily.json`
- `~/.config/lorekit/global-corpus.json`
- `~/.agents/skills/wiki-daily/` 中的已安装 copy
- `~/.agents/skills/corpus-*/` 中的已安装 copy
- Codex Automations 配置
- 飞书 / Lark `lark_user_id` 和本机 `lark-cli` 登录态

如果需要定时提醒，在 Codex app 里给目标 corpus 项目创建 automation，工作目录选 `default_corpus`，优先使用 local project，不要让任意代码项目跨 workspace 写 corpus。prompt 应显式触发 `$wiki-daily`：

```text
Use $wiki-daily to execute daily compile. Read ~/.config/lorekit/daily.json. Based on journal_day_boundary, process the just-finished journal_date. Merge inbox fragments into 每日/<journal_date>.md, generate Daily compile and Fileback candidates, do not write directly to 知识库/, and send a Lark bot reminder only when notifications.enabled is true and candidates exist.
```

```text
Use $wiki-daily to execute rolling synthesis. Read the latest 3 compiled daily notes, link related 知识库/ pages, write 输出/复盘/<date>-rolling-synthesis.md, generate Suggested fileback candidates for repeated high-value signals, and send a Lark bot reminder only when notifications.enabled is true and candidates exist.
```

```text
Use $wiki-daily to execute weekly synthesis. Read the latest 7 daily notes and relevant 知识库/ pages, write 输出/复盘/<YYYY-WW>-weekly-synthesis.md, generate Suggested fileback candidates for reusable weekly judgments, and send a Lark bot reminder only when notifications.enabled is true and candidates exist.
```

Cursor / Kimi CLI / Aider / Windsurf 等 agent 按各自的 skill / rule 目录注册 Markdown skills 即可。

#### Codex central corpus entrypoints（可选）

如果你希望在任意项目中都能查询、收件、摄入或写回同一个 central corpus，可以显式安装选定 `corpus-*` skills：

```bash
lorekit install-skills --target codex --only corpus-query,corpus-capture,corpus-ingest,corpus-fileback --mode copy
```

`corpus-*` 不再是 Codex target 的默认安装内容；`wiki-daily` 也必须用 `--only wiki-daily` 单独安装。这样可以避免用户只是想做当前项目 research corpus，却意外获得跨项目写中央库的入口。

这会把这些入口复制到 `~/.agents/skills/`：

| 可选入口 Skill | 用途 | 默认写入边界 |
| --- | --- | --- |
| `corpus-capture` | 跨项目随手记、观察、临时信息 | configured corpus 的 `_工作台/收件/` |
| `corpus-query` | 从任何项目查询 configured corpus | 默认只读 `知识库/` |
| `corpus-ingest` | 从任何项目摄入 URL / 文件 / 外部资料 | configured corpus 的 `原料/` + `知识库/` |
| `corpus-fileback` | 用户确认后把结论写回 configured corpus | `知识库/` |
| `corpus-health` | 检查 corpus / LoreKit 健康 | 报告，不写知识 |
| `wiki-daily` | 日记、todo、daily compile | `_工作台/日记收件/`、`每日/`、`输出/复盘/` |

再创建全局 corpus 配置：

```bash
mkdir -p ~/.config/lorekit
$EDITOR ~/.config/lorekit/global-corpus.json
```

最小配置：

```json
{
  "default_corpus": "/ABSOLUTE/PATH/TO/CORPUS",
  "lorekit_bin": "/ABSOLUTE/PATH/TO/CORPUS/bin/lorekit",
  "workbench_inbox_dir": "_工作台/收件",
  "daily_inbox_dir": "_工作台/日记收件",
  "knowledge_dir": "知识库",
  "raw_dir": "原料",
  "output_dir": "输出"
}
```

个人 corpus 例子：

```json
{
  "default_corpus": "/Users/gaoyifan/Desktop/corpus",
  "lorekit_bin": "/Users/gaoyifan/Desktop/corpus/bin/lorekit",
  "workbench_inbox_dir": "_工作台/收件",
  "daily_inbox_dir": "_工作台/日记收件",
  "knowledge_dir": "知识库",
  "raw_dir": "原料",
  "output_dir": "输出"
}
```

这些可选入口 skill 只负责入口和路由；执行规范仍以目标 corpus 内的 `AGENTS.md` / `CLAUDE.md` / `skills/wiki-*` 为准。不要把 corpus 项目级的 `wiki-remove` 或自动 fileback 规则做成默认入口。

`install-skills --only` 支持逗号列表，也支持单个名字：

```bash
lorekit install-skills --target codex --only corpus-query --mode copy
```

#### 项目级 research corpus skills（推荐给研究型知识库）

研究型知识库通常有项目专有材料、阶段性 `_工作台/`、项目/domain skill 和少量本地约定。推荐把 LoreKit 原生 `wiki-*` 工作流放进当前 corpus：

```bash
cd ~/Desktop/my-corpus
lorekit install-skills --target project --mode copy
```

然后在 corpus 的 `AGENTS.md` / `CLAUDE.md` 里只写短路由：

```markdown
| 触发                   | Skill                           |
| ---------------------- | ------------------------------- |
| 查询已有知识           | `skills/wiki-query/SKILL.md`    |
| 摄入 URL / 文件 / 文本 | `skills/wiki-ingest/SKILL.md`   |
| 写回对话洞察           | `skills/wiki-fileback/SKILL.md` |
| 健康检查               | `skills/wiki-lint/SKILL.md`     |
| 安全移除               | `skills/wiki-remove/SKILL.md`   |
```

Codex 里，项目级 skills 通常不会出现在 `/` 菜单预览中；模型会先读 `AGENTS.md`，再按路由读取 `skills/<name>/SKILL.md`。

项目/domain skill 可以做：

- 定义研究单元、课程单元、客户项目或专有资料的命名规则。
- 判断 `_工作台/` 里的 finished package 何时应 promote。
- 把“注入这个研究单元”“file back 这个项目包”路由到 `wiki-ingest` / `wiki-fileback`。

项目/domain skill 不应做：

- 复制一份自己的 ingest/fileback 实现。
- 绕过 `原料/` 保存、`知识库/` 编译、provenance、sync/lint 和确认门。
- 默认把项目研究材料写进中央 corpus。中央回流必须是可选、显式确认的 promotion。

新增项目/domain skill 前，先过一遍检查清单：

| 问题 | 推荐答案 |
| --- | --- |
| 它解决的是领域触发、来源分类、命名、验收，还是知识库写入语义？ | 只让项目/domain skill 做前者；写入语义交给 native `wiki-*` |
| 这句话最终应该路由到哪个 native workflow？ | 在 `AGENTS.md` 写清：`wiki-ingest`、`wiki-fileback`、`wiki-query`、`wiki-lint` 或 `wiki-remove` |
| 是否需要保存完整 finished package？ | 先进入本项目 `原料/`，再编译本项目 `知识库/` |
| 是否要回流 central corpus？ | 只在用户显式确认 promotion / fileback 时发生 |
| 发现 native skill 不够用怎么办？ | 优先改 LoreKit native skill / template，或开 upstream issue；不要在项目 skill 里静默 fork 一套流程 |

#### Hybrid：全局入口 + 项目级执行规范

这是只推荐给明确维护 central corpus 的高级形态：

```text
central gateway skill = 入口和路由
项目级 skill = 执行规范
Lorekit = canonical 写入
知识库/ = 唯一事实源
```

具体做法：

- central gateway 安装：显式选定 `corpus-capture`、`corpus-query`、`corpus-ingest`、`corpus-fileback`、`corpus-health`、`wiki-daily`
- corpus 内保留：`skills/wiki-ingest`、`skills/wiki-query`、`skills/wiki-fileback`、`skills/wiki-lint`、`skills/wiki-remove` 等项目级执行细则
- `AGENTS.md` / `CLAUDE.md` 只写短路由，不把长 daily 规则塞进入口文件
- 删除类命令、自动 fileback 不做 gateway skill

### 4. 日常运行

```bash
cd ~/Desktop/my-corpus
lorekit fetch <url>
lorekit search "关键词"
lorekit snapshot
lorekit doctor --json
```

`lorekit sync --json` is a closeout step for durable corpus changes: new `原料/` imports, `知识库/` fileback, index/routing changes, stage closeout, or commit/push verification. Workbench notes and transient learning artifacts can wait for closeout.

AI 工作流：

- `wiki-ingest`：URL / 文件 / 文本入库。
- `wiki-query`：查询已有知识。
- `wiki-fileback`：把对话洞察写回。
- `wiki-lint`：健康检查。
- `wiki-remove`：安全移除。

## 用户级安装与项目级安装的取舍

| 组件           | 用户级安装                       | 项目级安装                                 |
| -------------- | -------------------------------- | ------------------------------------------ |
| lorekit CLI    | 默认路线，任意目录可调用         | wrapper 锁定 corpus                        |
| lorekit skills | 可选模块，触发和预览更直接       | 靠 `AGENTS.md` 路由，不污染其他项目        |
| hooks          | 可能影响所有项目                 | 只做项目内轻量提醒                         |

一句话：lorekit 默认只有 CLI；skills 是 agent 触发层，研究型 corpus 优先项目级安装，central gateway 是增强策略，不是 lorekit 基础功能的前置条件。

## 验收清单

只安装 lorekit：

```bash
cd ~/Desktop/my-corpus
lorekit --version
lorekit doctor --json
```

写入后：

```bash
./bin/lorekit sync --json
```

这里的"写入"指 `原料/` / `知识库/` / 路由索引这类 durable corpus 写入，不是每一次 `_工作台/` 记录。
