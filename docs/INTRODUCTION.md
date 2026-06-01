# INTRODUCTION.md — lorekit 功能介绍

> Last updated: 2026-06-02

lorekit 帮你把网页、公众号、课程笔记、会议记录、项目资料和日常想法，整理成一个本地 Markdown 知识库。AI 负责读懂材料、归纳概念、更新页面；lorekit 负责记录进度、刷新索引、搜索旧知识、检查健康状态，并保护你的文件不被误删误改。

最常见形态之一是 research corpus：围绕一个课题、课程、产品方向或项目，把来源、摘要、概念、实体和专题沉淀在同一个本地 corpus。中央知识库只是可选拓扑，不是使用 lorekit 的前置条件。

它适合这样的工作方式：

```text
零散材料 -> AI 整理 -> 本地 Markdown Wiki -> 搜索 / Obsidian 阅读 / 持续更新
```

用户看到的不是黑盒数据库，而是一组可以直接打开、审阅、编辑和备份的本地 Markdown 文件。lorekit 的价值，是把 AI 的整理能力放进一条有状态、有检查、有回滚的知识库维护流程里。

## 它解决什么问题

很多人已经在用 AI 整理资料，但长期使用时会遇到几个实际问题：

- 材料分散在网页、聊天记录、课程讲义、会议纪要和项目文件里。
- AI 总结完一次就结束，下次不知道旧结论在哪里。
- 知识库越写越大，目录、反链、孤岛页、断链很难维护。
- 想让 AI 帮忙整理，又担心它误删、覆盖或移动多年积累的笔记。
- Obsidian 能阅读 Markdown，但缺少面向 AI 的摄入、进度、同步、体检和反馈闭环。

lorekit 的答案是：让个人知识库变成一个本地 LLM Wiki。

原始材料保留在 `原料/`，AI 整理出的知识进入 `知识库/`，lorekit 把抓取、处理进度、索引、检查、快照和删除都变成明确命令。用户既能让 AI 参与长期整理，又能随时看到文件和状态。

## 功能导览

| 用户要做的事 | lorekit 功能 | 相关命令 |
| --- | --- | --- |
| 创建知识库 | 生成 corpus 目录、AI 使用规则、基础状态目录和 Obsidian 配置 | `lorekit init` |
| 检查是否健康 | 检查目录、frontmatter、索引、Obsidian Graph filter，以及已启用/显式请求的可选集成 | `lorekit doctor` |
| 收进外部材料 | 把网页、微信公众号等材料抓到 workbench，并登记处理进度 | `lorekit fetch <url>` |
| 记录处理到哪一步 | 记录 archive、wiki、backlink、lint 等步骤，方便断点续接和避免重复 | `lorekit ingest <sub>` |
| 找回旧知识 | 做文本搜索；知识库变大后可单独使用向量检索增强语义召回 | `lorekit search` / `lorekit vector query` |
| 刷新目录 | 为目录生成 `_INDEX.md`，让人和 AI 快速看到内容结构 | `lorekit index` |
| 整理后收尾 | 依次刷新目录索引、root `index.md`、向量索引，再跑健康检查 | `lorekit sync` |
| 检查内容质量 | 查 required frontmatter、broken wikilinks、orphan pages | `lorekit lint` |
| 留备份 | 创建全库 tarball 和 manifest | `lorekit snapshot` |
| 恢复文件 | 从快照恢复缺失或变更文件，支持 dry-run | `lorekit restore` |
| 安全删除 | 先看影响面；确认后快照、进 OS Trash，并清理关联状态 | `lorekit remove` |
| 收集人工反馈 | 创建、列出和按状态过滤审阅反馈；具体修正通常由 AI workflow 完成 | `lorekit audit` |
| 调整 Obsidian 图谱 | 检查、打印或备份后写入推荐 Graph filter | `lorekit obsidian-tune` |
| 接入 AI 工作流 | 可选安装 Claude Code / Codex skills，让 agent 有明确入口 | `lorekit install-skills` |
| 做多跳候选召回 | 可选接入 GBrain，只做 read-only 候选检索 | `lorekit gbrain <sub>` |

可以把这些功能理解成一条链路：先建库和收材料，再让 AI 整理成知识页，随后用搜索、索引、同步和体检维持可用性；当需要审阅、删除、恢复和扩展时，也都有对应的安全入口。

## 1. 创建一个 AI 能长期维护的本地知识库

`lorekit init` 会创建一个本地 corpus。它不是只建几个空文件夹，而是给用户和 AI 约定一套长期使用的知识库结构：

```text
corpus/
├── CLAUDE.md / AGENTS.md  # AI 使用规则和 corpus schema
├── index.md               # 知识库入口
├── 原料/                  # 原始来源，默认只读
├── 知识库/                # AI 整理后的 Markdown Wiki
├── 每日/                  # 日记和日常观察
├── 写作/                  # 输出草稿
├── 反馈/                  # 人工审阅反馈
├── _工作台/               # 临时摄入和处理中材料
├── _归档/                 # 冷存档
└── .wiki/                 # lorekit 状态、索引、快照、报告
```

这个结构的重点是分清“证据”和“结论”：`原料/` 保存来源，`知识库/` 保存可持续更新的知识页面，`.wiki/` 保存工具状态。AI 可以整理和写作，但不应该绕过 CLI 去乱改状态、索引和删除流程。

如果目标目录里已有文件，初始化会提示备份，不会默认覆盖用户已有内容。

## 2. 收进外部材料，并记住处理进度

`lorekit fetch <url>` 用来把外部网页抓进本地 workbench。它适合处理普通网页、微信公众号文章，以及后续需要由 AI 整理进 wiki 的长文材料。

抓取完成后，lorekit 会登记这篇材料的处理状态。fetch 只是第一步，不代表“已经入库完成”。一次完整处理通常会经历：

```text
fetch -> archive -> wiki -> backlink -> lint -> completed
```

这条进度记录很重要。对话断掉、模型换了、用户重复提交同一个 URL，AI 都可以通过 `lorekit ingest` 知道材料已经处理到哪一步，而不是靠记忆猜。

## 3. 把材料整理成可继续更新的知识页

lorekit 的核心不是“保存原文”或“生成一次摘要”，而是让 AI 把材料整理进可持续维护的 Markdown Wiki。项目里把这个过程称为 LLM Wiki compilation。

例如一篇文章进入 corpus 后，理想产物不是一段孤立总结，而是：

- 在 `知识库/概念/` 更新一个概念页。
- 在 `知识库/实体/` 补一个工具、人物、项目或组织页。
- 在 `知识库/摘要/` 保留来源摘要。
- 在 `index.md` 或专题页里补入口。
- 用 `[[wikilinks]]` 建立页面之间的关系。
- 标出来源、冲突和未确认点。

lorekit 不替 AI 做语义判断。它提供的是工作轨道：材料在哪里、进度到哪一步、索引有没有更新、页面有没有断链、收尾检查有没有跑过。

## 4. 找回旧知识：目录、文本搜索和可选语义检索

知识库开始增长后，最实际的问题就是“写进去了，下次怎么找回来”。

lorekit 提供三层方式：

- 目录索引：`lorekit index` 生成 `_INDEX.md`，让人和 AI 能快速看到一个目录里有什么。
- 文本搜索：`lorekit search` 做关键词搜索，优先使用 ripgrep，必要时使用内置文本 fallback。
- 可选向量检索：`lorekit vector sync/query/status` 为较大的 corpus 提供语义召回、BM25 和 hybrid 检索能力。

这里要分清：`lorekit search` 是文本搜索；语义召回由 `lorekit vector query` 负责。向量检索是增强能力，不是唯一事实源。

## 5. 整理后的收尾：同步和体检

AI 更新了多个页面后，不应该只说“整理好了”。lorekit 提供 `sync` 和健康检查，让收尾动作可验证。

`lorekit sync` 会按顺序执行：

```text
_INDEX.md -> root index.md -> layered vector sync -> doctor
```

这意味着目录更新了，根入口更新了，检索索引同步了，健康检查也跑过了。它适合作为一次入库、批量整理或 fileback 后的收尾命令。

`lorekit doctor` 更像系统体检，检查 corpus 目录、wiki metadata、frontmatter、索引、Obsidian Graph filter，以及启用或显式请求的可选集成。未启用的 GBrain 不会被当成默认错误。

`lorekit lint` 更偏内容质量，检查 required frontmatter、broken wikilinks 和 orphan pages。它不负责重复检测。

## 6. 快照、恢复和安全删除

lorekit 很重视数据安全，因为它面对的往往是个人长期积累的笔记和资料。

`lorekit snapshot` 会创建全库快照，包含 tarball 和 manifest。manifest 记录路径、哈希、大小和修改时间，后续可用于判断文件缺失或变化。

`lorekit restore` 会先计算差异，再恢复文件。它支持 dry-run，避免用户还没看清影响就覆盖内容。

`lorekit remove` 是安全删除入口。默认只给 impact report，不真正删除：

```bash
lorekit remove <target>
```

确认后再执行：

```bash
lorekit remove <target> --apply
```

真正执行时，lorekit 会先创建 snapshot，再把文件移动到 OS Trash，并清理 provenance、ingest state 和向量索引里的相关状态。它的目标不是“删得快”，而是让 AI 参与清理时不制造不可逆事故。

## 7. Obsidian：把 corpus 当成可浏览、可审阅的 Markdown vault

lorekit 和 Obsidian 的关系很自然：lorekit 负责 corpus 的生成、状态和安全维护；Obsidian 负责阅读、图谱和人工审阅体验。

用户可以直接把 corpus 作为 Obsidian vault 打开：

- `知识库/` 是 AI 整理后的核心 wiki。
- `原料/` 保留原始来源和证据。
- `每日/` 保存日记和每日观察。
- `写作/` 保存输出草稿。
- `反馈/` 保存人工审阅意见。

Markdown 的好处是透明。你可以用 Obsidian 点开 `[[wikilinks]]`，也可以用任何编辑器直接改文件；你可以看 Graph view，也可以回到命令行跑 `sync`、`doctor` 和 `lint`。

### Graph filter

新 corpus 初始化时，lorekit 会写入推荐的 `<corpus>/.obsidian/graph.json`，让 Graph view 隐藏 `_工作台`、`_归档`、`反馈`、`系统`、自动索引和根配置文件，重点显示 `知识库/`、`原料/`、`每日/`、`写作/`。

如果已有 `.obsidian/graph.json`，`lorekit init` 会跳过，不覆盖用户设置。老 vault 可以用：

```bash
lorekit obsidian-tune
lorekit obsidian-tune --print
lorekit obsidian-tune --write
```

默认是只读检查；`--write` 会先备份再写入。

### lorekit-audit 插件

`lorekit init` 会把轻量 Obsidian 插件 `lorekit-audit` 部署到 `.obsidian/plugins/lorekit-audit/`。它不会自动启用，用户仍需在 Obsidian `Settings -> Community plugins` 中启用 `Lorekit Audit`。

启用后，用户在 Obsidian 里读 wiki 时，可以选中一段文字并留下反馈：

- `info`：补充信息。
- `suggest`：改进建议。
- `warn`：需要注意。
- `error`：必须修正。

默认设置下，反馈会写入：

```text
反馈/待处理/<id>[-slug].md
```

其中 id 形如 `YYYYMMDD-HHMMSS-rand`，反馈文件会带 anchor context，方便页面编辑后仍能定位原文。后续可以用 `lorekit audit --list` 查看反馈，或用 `--open` / `--resolved` 按状态过滤；真正修正 wiki、移动到 `反馈/已处理/` 并写 resolution note，通常由 AI workflow 处理。

这里要注意边界：lorekit 不是 Obsidian 插件平台。Obsidian 是阅读和审阅界面；lorekit 是管理 corpus 的 CLI。真正的事实源仍然是本地文件和 `.wiki/` 状态。

## 8. 进阶增强：Agent Skills 和 GBrain

默认路线就是 CLI-only：安装 `lorekit` 命令，初始化 corpus，跑 `doctor`。这已经能完成建库、抓取、处理进度、搜索、索引、同步、体检、快照、恢复、安全删除、Obsidian tuning 和基础 audit。

当用户需要更顺手的 AI workflow 入口时，再加 Agent Skills。默认推荐项目/研究型 workflow，而不是跨项目中央入口：

| 路线 | 包含 | 边界 |
| --- | --- | --- |
| Claude Code / Codex project workflows | `install-skills --target claude-code` 或 `--target codex --mode copy` 安装 `wiki-*` | 当前项目 / 当前 corpus 的 native workflow；CLI 仍做确定性动作 |
| Project-local research skills | `install-skills --target project --mode copy` | `skills/wiki-*` 落在当前 corpus；`AGENTS.md` 负责短路由 |
| Codex daily gateway | `--target codex --only wiki-daily --mode copy` | 可选日记/复盘入口，不随 project workflow 默认安装 |
| Central corpus entrypoints | `--target codex --only corpus-query,corpus-capture,... --mode copy` | 显式 cross-project router；先解析目标 corpus，再委托目标 `wiki-*` |
| GBrain bridge | `lorekit gbrain <sub>` | read-only candidate retrieval；只写 `.wiki/integrations` 派生层，不写 canonical wiki |

`wiki-*`、`corpus-*` 和 `wiki-daily` 不是同一套默认包。`wiki-*` 是当前 corpus 的原生工作流；项目/domain skill 只能做触发、分类和路由，不应重写 ingest/fileback。`corpus-*` 是可选的跨项目入口，适合明确维护 central corpus 的用户；`wiki-daily` 是单独的日记 gateway。

GBrain 则适合知识库变大后做 graph / hybrid retrieval 和多跳候选召回。它读取 lorekit 导出的 staging copy，返回候选并映射回 canonical `知识库/` 页面；新知识要沉淀，仍然回到 lorekit 的 fileback、audit 和 snapshot 流程。

## 典型使用场景

### 场景一：把一篇长文变成可继续更新的知识页

用户的问题：一篇文章有用，但不想只得到一次性摘要。

lorekit 的参与方式：AI 先用 `lorekit fetch <url>` 把材料收进 workbench，然后阅读材料、归档来源、更新 `知识库/` 的概念/实体/摘要页，并记录处理进度：

```bash
lorekit ingest record <url> --step archive,wiki,backlink,lint --archived-to 原料/文章/example --wiki-page 知识库/概念/example.md
lorekit sync
```

得到的结果：这篇材料变成了可搜索、可链接、可审阅、可继续更新的 wiki 内容，而不是聊天窗口里的一段临时摘要。

### 场景二：在 Obsidian 里读知识库并留下反馈

用户的问题：读到一段 AI 写得不准的内容，想直接指出问题。

lorekit 的参与方式：用户在 Obsidian 里选中文本，用 `lorekit-audit` 留下 `warn` 或 `error` 反馈。反馈进入 `反馈/待处理/`，后续 AI workflow 根据锚点修正页面，再把反馈移到 `反馈/已处理/`。

得到的结果：Obsidian 不只是阅读器，也变成一个人机协作的审阅入口。

### 场景三：安全清理过时材料

用户的问题：某个来源或某批页面已经过时，但直接删除风险太高。

lorekit 的参与方式：先运行 `lorekit remove <target>` 看 impact report；确认后再运行 `lorekit remove <target> --apply`。真正执行时会先 snapshot，再进 OS Trash，并清理关联状态。

得到的结果：清理动作可检查、可恢复、可追踪，不会变成一次不可逆文件事故。

### 场景四：一次整理后的收尾检查

用户的问题：AI 更新了多个页面，怎么确认不是“看起来整理好了”。

lorekit 的参与方式：运行 `lorekit sync`，必要时再跑 `lorekit doctor` 和 `lorekit lint`。

得到的结果：目录、root index、检索索引和健康状态都被刷新，问题会在命令输出里显式暴露。

## 为什么这个项目适合 AI 使用

lorekit 的设计假设是：未来很多知识库动作会由 AI 执行，但 AI 不应该直接自由操作用户文件系统。

所以 lorekit 把 AI 擅长的事情和 CLI 擅长的事情分开：

- AI 做理解、归纳、比较、命名、链接和写作。
- CLI 做抓取、进度、索引、检查、快照、恢复和安全删除。

这让 AI 可以真正参与长期知识工作，而不是每次只在聊天窗口里生成一段答案。更重要的是，用户可以追踪它做了什么、撤回它做错的事、在 Obsidian 里审阅结果，并把知识库继续当作自己的本地文件系统来掌控。
