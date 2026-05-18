# INSTALLATION.md — lorekit 安装与 GBrain 协作指南

> Last updated: 2026-05-18

本文回答两个问题：

1. 只安装 lorekit 时，如何初始化和运行一个知识库 corpus。
2. 用户想加 GBrain 时，如何把它作为 read-only 增强检索层接入，而不是把两个系统揉成一个。

## 先问用户

AI 帮用户安装前，先问清楚：

```text
你希望怎么安装 lorekit？

默认：只安装 lorekit，本机全局可用 `lorekit` CLI，并安装目标 agent 对应的 lorekit skills。

可选项：
1. 全局 corpus 入口：安装 `corpus-*` / `wiki-daily` 到 Codex 全局 skills，让任意项目能路由到同一个 corpus。
2. 项目级隔离：只在目标 corpus 里放 wrapper、AGENTS/CLAUDE 路由和项目级 skills。
3. Hybrid：全局只放入口 skills，项目内保留 `wiki-*` 执行细则。
4. GBrain 增强：把 GBrain 作为 read-only 候选检索层接入 lorekit。
```

默认建议：

- 普通知识库用户：只安装 lorekit + 目标 agent 对应的 lorekit skills。
- 需要隔离某个 corpus、不想影响其他 coding 项目时，再选择项目级安装。
- 需要从任意代码项目访问同一个个人 corpus 时，选择 Hybrid：全局 `corpus-*` 负责入口和路由，项目级 `wiki-*` 负责治理规则。
- 需要 graph / hybrid retrieval、多跳关系、候选发现时，再安装 GBrain bridge。
- 安装器类 skill 也可以全局保留，例如 `lorekit-corpus-bootstrap` / `lorekit-gbrain-project-bridge`，用于快速部署项目级配置。

## 路线 A：只安装 lorekit（默认）

适合不需要 GBrain 的用户。此时 lorekit 已能完成摄入、维护、查询、同步、备份和安全删除。

### 1. 安装源码和 CLI

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit
npm install
npm run build
npm link
lorekit --version
```

Node.js >= 18 是唯一硬依赖。`ripgrep`、`ollama`、`bge-m3` 都是可选增强。

### 2. 初始化 corpus

```bash
lorekit init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus
lorekit doctor
```

如果目录里已有内容，先走 lorekit 的备份提示；不要手动移动或删除用户内容。

### 3. 安装 lorekit skills

#### 全局 skills（默认）

Claude Code 可用：

```bash
lorekit install-skills --target claude-code
```

这会安装到 Claude Code 的全局 skill 位置。优点是触发和预览更直接，也符合 lorekit 的默认安装路线。

Codex 默认安装全局入口 skills（`corpus-*` + `wiki-daily`）到用户级目录：

```bash
lorekit install-skills --target codex --mode copy
```

如果只要个人日记入口，可以只安装 `wiki-daily`：

```bash
lorekit install-skills --target codex --only wiki-daily --mode copy
```

这会把 `skills/wiki-daily` 复制到 Codex 的 `~/.agents/skills`，让 `$wiki-daily` 可作为全局个人日记 gateway 使用。然后创建配置：

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

如果需要定时提醒，在 Codex app 里给中央 corpus 项目创建 automation，工作目录选 `default_corpus`，优先使用 local project，不要让任意代码项目跨 workspace 写 corpus。prompt 应显式触发 `$wiki-daily`：

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

#### Codex 全局 corpus 入口 skills（可选）

如果你希望在任意项目中都能查询、收件、摄入或写回同一个 canonical corpus，可以把全局入口 skills 安装到 Codex 用户级目录：

```bash
lorekit install-skills --target codex --mode copy
```

这会把这些入口复制到 `~/.agents/skills/`：

| 全局 Skill | 用途 | 默认写入边界 |
| --- | --- | --- |
| `corpus-capture` | 跨项目随手记、观察、临时信息 | `_工作台/收件/` |
| `corpus-query` | 从任何项目查询中央 corpus | 默认只读 `知识库/` |
| `corpus-ingest` | 从任何项目摄入 URL / 文件 / 外部资料 | `原料/` + `知识库/` |
| `corpus-fileback` | 用户确认后把结论写回知识库 | `知识库/` |
| `corpus-gbrain-query` | GBrain / 多跳候选召回 | 只读派生索引，回读 `知识库/` |
| `corpus-health` | 检查 corpus / vector / GBrain 健康 | 报告，不写知识 |
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
  "gbrain_bin": "/ABSOLUTE/PATH/TO/CORPUS/bin/gbrain",
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
  "gbrain_bin": "/Users/gaoyifan/Desktop/corpus/bin/gbrain",
  "workbench_inbox_dir": "_工作台/收件",
  "daily_inbox_dir": "_工作台/日记收件",
  "knowledge_dir": "知识库",
  "raw_dir": "原料",
  "output_dir": "输出"
}
```

全局 skill 只负责入口和路由；执行规范仍以目标 corpus 内的 `AGENTS.md` / `CLAUDE.md` / `skills/wiki-*` 为准。不要把 corpus 项目级的 `wiki-remove`、GBrain 原生 mutating skill、或自动 fileback 规则做成全局默认入口。

`install-skills --only` 支持逗号列表，也支持单个名字：

```bash
lorekit install-skills --target codex --only corpus-query --mode copy
```

#### 项目级 skills（可选隔离）

把 `~/code/lorekit/skills/wiki-*` 复制或同步到：

```text
~/Desktop/my-corpus/skills/
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

这个模式适合个人 corpus 或团队知识库项目，不是 lorekit 的默认必需步骤。

#### Hybrid：全局入口 + 项目级执行规范

这是推荐给个人 canonical corpus 的长期形态：

```text
全局 skill = 入口和路由
项目级 skill = 执行规范
Lorekit = canonical 写入
GBrain = 派生检索
知识库/ = 唯一事实源
```

具体做法：

- 全局安装：`corpus-capture`、`corpus-query`、`corpus-ingest`、`corpus-fileback`、`corpus-gbrain-query`、`corpus-health`、`wiki-daily`
- corpus 内保留：`skills/wiki-ingest`、`skills/wiki-query`、`skills/wiki-fileback`、`skills/wiki-lint`、`skills/wiki-remove` 等项目级执行细则
- `AGENTS.md` / `CLAUDE.md` 只写短路由，不把长 daily 或 GBrain 规则塞进入口文件
- 删除、高风险 GBrain mutating 命令、自动 fileback 不做全局 skill

### 4. 日常运行

```bash
cd ~/Desktop/my-corpus
lorekit fetch <url>
lorekit sync --json
lorekit search "关键词"
lorekit vector query --hybrid --text "问题"
lorekit snapshot
lorekit doctor --json
```

AI 工作流：

- `wiki-ingest`：URL / 文件 / 文本入库。
- `wiki-query`：查询已有知识。
- `wiki-fileback`：把对话洞察写回。
- `wiki-lint`：健康检查。
- `wiki-remove`：安全移除。

## 路线 B：lorekit + GBrain（可选增强）

适合需要 graph / hybrid retrieval、多跳关系、候选发现的用户。

边界：

```text
lorekit = canonical wiki 管理层
GBrain  = read-only 增强检索层
```

GBrain 不直接写 `知识库/`、`原料/` 或 `输出/`。新知识写回仍走 lorekit 的 `wiki-fileback` / `wiki-ingest` / `audit`。

### 1. 安装 GBrain 源码

```bash
git clone https://github.com/garrytan/gbrain.git ~/code/gbrain
cd ~/code/gbrain
bun install
bun link
gbrain --version
```

如果用户没有 `OPENAI_API_KEY`，仍可通过项目 wrapper 让 `gbrain import` 使用 `--no-embed`，先维护 keyword/metadata index。

### 2. 项目级 wrapper（可选但建议用于隔离）

在 corpus 里放：

```text
bin/
├── lorekit
└── gbrain
```

`bin/lorekit` 要点：

```bash
export LOREKIT_GBRAIN_BIN="$CORPUS_ROOT/bin/gbrain"
exec /path/to/lorekit "$@"
```

`bin/gbrain` 要点：

```bash
export GBRAIN_HOME="$CORPUS_ROOT/.wiki/integrations/gbrain"
exec /path/to/bun /path/to/gbrain/src/cli.ts "$@"
```

以后在这个 corpus 里只用：

```bash
./bin/lorekit
./bin/gbrain
```

如果你选择项目级隔离，不要让 agent 默认调用全局 `gbrain` 写入别的 brain。没有项目级 wrapper 时，也可以直接使用全局 `lorekit gbrain ...`，但要确认 `gbrain` 的 home/config 不会串到其他项目。

### 3. 同步与查询

```bash
cd ~/Desktop/my-corpus
./bin/lorekit gbrain status --json
./bin/lorekit gbrain export --dry-run --json
./bin/lorekit gbrain sync --json
./bin/lorekit gbrain doctor --json
./bin/lorekit gbrain query "问题" --json
```

数据流：

```text
知识库/ canonical pages
  -> lorekit gbrain export
  -> .wiki/integrations/gbrain-export/pages/ + manifest.reverseMap
  -> gbrain import --fresh
  -> gbrain extract all --source db --include-frontmatter --json
  -> .wiki/integrations/gbrain/ derived index
```

回答时：

1. 先用 lorekit/index/search/vector 找 canonical 页面。
2. 召回不足或需要多跳关系时，用 `lorekit gbrain query` 找候选。
3. 回读 `知识库/` canonical 页面。
4. 最终答案引用 canonical wiki，而不是 `.wiki/integrations/gbrain-export/`。

### 4. GBrain skill 处理

不要全量安装 GBrain 原生 skills。推荐映射：

| GBrain skill                                                     | 在 lorekit corpus 中怎么用                  |
| ---------------------------------------------------------------- | ------------------------------------------- |
| `query`                                                          | 映射为 `lorekit-gbrain-query`，只做候选召回 |
| `skillpack-check` / `smoke-test`                                 | 映射为 `lorekit-gbrain-sync-check`          |
| `brain-ops` / `ingest` / `enrich` / `maintain` / `reports`       | 默认禁用；这些会写 GBrain brain             |
| `article-enrichment` / `concept-synthesis` / `strategic-reading` | 可作为研究参考，结果经 lorekit 写回         |
| `media-ingest` / `meeting-ingestion` / `voice-note-ingest`       | 默认走 `wiki-ingest`                        |
| `cron-scheduler` / `minion-orchestrator` / `daily-task-*`        | 不属于默认 corpus workflow                  |

如果选择项目级隔离，建议新增 bridge skills：

- `lorekit-gbrain-query`
- `lorekit-gbrain-sync-check`
- `lorekit-fileback-after-gbrain`
- `lorekit-gbrain-research`

## 全局安装与项目级安装的取舍

| 组件           | 全局安装                         | 项目级安装                                 |
| -------------- | -------------------------------- | ------------------------------------------ |
| lorekit CLI    | 默认路线，任意目录可调用         | wrapper 锁定 corpus 与 GBrain binary       |
| GBrain CLI     | 方便调试 GBrain                  | wrapper 锁定 `GBRAIN_HOME`，避免写错 brain |
| lorekit skills | 默认路线，触发和预览更直接       | 靠 `AGENTS.md` 路由，不污染其他项目        |
| GBrain skills  | 容易启用 mutating brain workflow | 只映射，不直接启用                         |
| hooks          | 可能影响所有项目                 | 只做项目内轻量提醒                         |

一句话：lorekit 默认全局安装，项目级安装是隔离策略；GBrain 是增强策略，不是 lorekit 基础功能的前置条件。

## 验收清单

只安装 lorekit：

```bash
cd ~/Desktop/my-corpus
lorekit --version
lorekit doctor --json
```

安装 GBrain bridge：

```bash
cd ~/Desktop/my-corpus
./bin/lorekit gbrain status --json
./bin/lorekit gbrain export --dry-run --json
./bin/lorekit gbrain doctor --json
```

写入后：

```bash
./bin/lorekit sync --json
./bin/lorekit gbrain sync --json
```

如果 GBrain 缺失，lorekit 仍可单独使用；GBrain health warning 不代表 canonical wiki 损坏。
