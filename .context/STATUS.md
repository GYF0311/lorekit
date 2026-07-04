---
cmap_version: 0.1
context_type: status
project: lorekit
source_commit: HEAD
updated_at: 2026-07-04T15:00:00Z
confidence: ai-drafted
---
# Status

> 中文状态页。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。
> 角色约定（2026-07-04 起）：本页只保留**发布级里程碑**摘要；逐任务的当前状态、
> 决策与待办一律以 `.context/CHECKPOINT.md` 为准，两页不重复维护细节。

## Active Goal
发布 v0.5.0（首个 npm 公开版本）：工作台闭环批次 + GPT-5.5 审查采纳项（findCorpus
收紧、workbench report 只读账单 CLI、模板契约同步）。

## Done Recently
- 2026-06-11：「对齐 + 收敛」三刀完成（GBrain/wiki-enrich 移除、links 恢复、现场 corpus 升 0.4.0）。
- 2026-07-04：工作台闭环批次完成并部署现场 corpus（search --all 两级召回、lint
  stale-review/unresolved-source、sync 喂 MEMORY.md、wiki-triage、防漂移测试、
  多库注册表 corpus-query）；现场 lint/doctor 全绿。
- 2026-07-04：GPT-5.5 对抗审查回收，采纳 findCorpus 只认 `.wiki/`、
  `lorekit workbench report` 下沉候选生成、STATUS 角色收紧（即本页）。

## Left Off
0.5.0 发布流程进行中：CHANGELOG + 版本号 + 全量 verify + push + npm publish。

## Next Steps
1. 完成 0.5.0 发布（npm 账号 xiaowuovo 已就绪）。
2. 后续批次（见 `docs/ai/TODO-lorekit-cleanup.md` §5）：capability manifest 结构化
   防漂移、小解析器集中（frontmatter-date / source-ref / search-query）。

## Changed Files
见 `.context/CHECKPOINT.md` 的 Changed Files 节（唯一细节源）。

## Risks
- `AGENTS.md` / `CLAUDE.md` 不能覆盖，只能追加或 marker merge。
- `_cmap/lorekit` 和 `_cmap-view` 是生成视图，不能倒灌成 canonical facts。
- findCorpus 收紧后，无 `.wiki/` 的老 corpus 需重跑 `lorekit init` 补标记（发布说明已写）。

## Last Verified
2026-07-04：`npm run verify` 全绿（详见 CHECKPOINT Verified 节）；`cmap verify --changed`
0 errors / 1 expected warning；现场 corpus lint/doctor 全绿。
