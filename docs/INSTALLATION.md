# INSTALLATION.md — lorekit 安装与 GBrain 协作指南

> Last updated: 2026-05-16

本文回答两个问题：

1. 只安装 lorekit 时，如何初始化和运行一个知识库 corpus。
2. 用户想加 GBrain 时，如何把它作为 read-only 增强检索层接入，而不是把两个系统揉成一个。

## 先问用户

AI 帮用户安装前，先问清楚：

```text
你希望怎么安装 lorekit？

默认：只安装 lorekit，本机全局可用 `lorekit` CLI，并安装全局 lorekit wiki skills。

可选项：
1. 项目级隔离：只在目标 corpus 里放 wrapper、AGENTS/CLAUDE 路由和项目级 skills。
2. GBrain 增强：把 GBrain 作为 read-only 候选检索层接入 lorekit。
```

默认建议：

- 普通知识库用户：只安装 lorekit + 全局 lorekit skills。
- 需要隔离某个 corpus、不想影响其他 coding 项目时，再选择项目级安装。
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

Codex 可把这些 Markdown skills 放到 `$CODEX_HOME/skills`（默认 `~/.codex/skills`）；Cursor / Kimi CLI / Aider / Windsurf 等 agent 按各自的 skill / rule 目录注册即可。`lorekit install-skills` 目前只自动写 Claude Code 目标。

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
