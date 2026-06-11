# DESIGN-NOTES.md — lorekit 设计决策

> 新 agent 接手读这份，理解"为什么这样设计 / 下一步方向"。
> WORKLOG / git log 记"做了什么"，这份记"为什么"。

## 1. 产品边界

lorekit 是个人知识 compilation harness：

- AI 负责语义判断、摘要、合并、交叉引用和回流建议。
- CLI 负责确定性文件动作、状态机、索引、检查、备份、恢复和安全移除。
- corpus 的可信结果在 `知识库/`、`原料/`、root `index.md`、各级 `_INDEX.md` 和 `.wiki/ingest-state.json`。

默认路线必须轻：Node.js + 本地文件 + ripgrep fallback。不要把重型召回、外部服务或多套知识存储放进默认体验。

## 2. 查询路线

当前默认查询顺序：

1. `lorekit search "<q>"` 找精确词、实体名、文件名和短语。
2. Read `corpus/index.md`，选择相关知识分区。
3. Read `{dir}/_INDEX.md`，缩小到候选页。
4. Read 具体 `知识库/` 页面，必要时沿 wikilink 追 1-2 跳。

这个顺序来自 Karpathy LLM Wiki 的核心思想：wiki 是 compilation cache，不是每次 query 时重新从 raw docs 拼答案。

## 3. `lorekit sync` 的职责

`lorekit sync` 是 durable closeout step，不是每次小改都要跑的后台管线。

它只做三件事：

1. 刷新子目录 `_INDEX.md`。
2. 合并 root `index.md` 的受控区，同时保留人类写的一句话摘要。
3. 运行 `doctor` 并输出可读/可机器解析的收据。

适合触发 sync 的场景：

- 新来源已经 archive 到 `原料/`。
- 新知识页或 fileback 已经进入 `知识库/`。
- 阶段收口、commit/push 前验证，或需要给 agent 留结构化 closeout 证据。

不适合触发 sync 的场景：

- `_工作台/` 临时 note。
- daily fragment、学习过程小改、HTML 展示产物。
- 只是在读 corpus 或做一次临时查询。

## 4. Ingest 状态机

`.wiki/ingest-state.json` 是 ingest pipeline 的单一事实源。状态保持小而稳定：

- `started`
- `completed`
- `failed`

具体进度写在 `stepsDone[]`，例如 `fetch`、`archive`、`wiki`、`backlink`、`lint`。新增步骤只扩展 step 枚举，不扩展顶层状态，避免 caller 复杂化。

## 5. Remove 边界

`lorekit remove` 的删除边界是 provenance，不是 topic keyword。

反例：三篇文章都讨论 `harness`。删除其中一篇时，如果按关键词级联，会误删其他来源共同支撑的 `知识库/概念/harness.md`。

当前决策：

- 自动删除：目标摘要页、对应原料页/目录、明确目标 wiki 页。
- 自动修改：frontmatter `sources` 移除目标 source，`source_count` 递减到不小于 0。
- 只报告不改：`## Compiled Truth` 中疑似依赖该来源的段落。
- 永不做：按普通关键词删除同主题页面。

`--apply` 必须先 snapshot，再把目标移动到 OS Trash，之后 sync/lint。

## 6. 文档与入口

`AGENTS.md` 是源码维护入口，不承载安装教程。安装和使用文档归：

- `README.md`
- `docs/INSTALLATION.md`
- `docs/QUICKSTART.md`

新增命令、skill 或跨文件行为变化时，同一批改动必须同步更新用户入口、架构文档、代码地图和测试。

## 7. 暂不做的事

- 不把外部图数据库或候选发现工具做成默认依赖。
- 不让 CLI 调 LLM 做语义判断。
- 不在 `remove` 中自动改写 compiled truth。
- 不为单次临时输出强制 sync。
