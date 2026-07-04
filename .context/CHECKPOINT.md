---
cmap_version: 0.1
context_type: checkpoint
project: lorekit
source_commit: HEAD
updated_at: 2026-07-04T13:00:00Z
confidence: ai-drafted
---
# Current Checkpoint

> 中文检查点。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。

## Current Task
「工作台闭环」批次（2026-07-04，先生四项决策后实施）：①防漂移 smoke test ✅
②`search --all` 两级召回（排除 `_工作台/转写` 噪音层）✅ ③lint stale-review 复审窗口
（软性）✅ ④sync 机械刷新 MEMORY.md L0 统计 ✅ ⑤lint unresolved-source + wiki-ingest
original_path 惯例 ✅ ⑥wiki-triage 清算 skill + wiki-query 第二级召回指引 + wiki-lint
对齐 CLI 现状 ✅ ⑦文档/.context 同步（本文件）✅ ⑧部署桌面 corpus（进行中，见 Next Step）。

先生已定的决策：废稿处置=trash 可恢复；转写=默认排除点名才查；stale=列清单+预查建议，
改动经先生；corpus 契约=授权直接改、改完报 diff。

## Current Hypothesis
CLI 与 skills 已对齐并有防漂移测试兜底；剩余风险集中在"现场 corpus 部署"这一步
（动真实知识库，必须 snapshot 先行）。

## Changed Files
- 新增：`tests/smoke/skills-cli-drift.test.mjs`、`tests/smoke/search-all.test.mjs`、
  `tests/smoke/lint-stale-review.test.mjs`、`tests/smoke/lint-source-resolve.test.mjs`、
  `tests/smoke/sync-memory-index.test.mjs`、`src/lib/memory-index.ts`、`skills/wiki-triage/`
- 修改：`src/lib/paths.ts`（searchAllExcludePrefixes）、`src/commands/search.ts`（--all）、
  `src/commands/lint.ts`（stale-review + unresolved-source + SOFT_ISSUE_KINDS）、
  `src/commands/sync.ts`（memoryIndex 步骤）、`skills/wiki-{query,lint,ingest}/SKILL.md`、
  `README.md`、`docs/QUICKSTART.md`、`docs/CODEBASE-MAP.md`、`AGENTS.md`（去状态双写 + Rule 6 修订）、
  `.context/modules/safety-maintenance.md`
- 另：CMAP_coding 已 build + push（7efefd9..536e0c9）；cmap 是 npm link 直连
  `~/Desktop/CMAP_coding`，CMAP 改 src 后需 rebuild 才生效。

## Verified
- `npm run verify`: 82 tests, 82 pass, 0 fail（72 基线 + 10 新增）。
- 防漂移测试做过注入坏引用的负向检验（能真实失败）。
- 现场 corpus 只读预检：新 lint 检查零新增问题（仍是存量 2 条 hard）；
  stale 零命中正确（视频评测两页 68 天 < 90 天窗口）。

## Failed / Pending
- 部署桌面 corpus 未做（第 8 项）：snapshot → install-skills 刷新（含新 wiki-triage）→
  契约 AGENTS/CLAUDE.md 加两级召回/归档层/清算说明（已授权直接改，改完报 diff）→
  links suggest 修存量断链 → 清 4 条悬挂 ingest（codenice ×3 + quoteinvestigator）→
  `.wiki/snapshots/` 9.7GB 定保留策略（trash 旧快照）→ 首次 sync 喂 MEMORY.md。
- npm 发布仍搁置（先生暂无法注册 npm 账号；包名 lorekit 2026-07-04 时点未被占用）。

## Next Step
第 8 项部署桌面 corpus：先 `lorekit snapshot` 备份，再 install-skills 刷新 →
契约补丁（两级召回 / `_归档/` 启用 / wiki-triage 说明，改完报 diff）→ 存量断链
`links suggest` → 悬挂 ingest 清理 → 快照 trash 保留策略 → `lorekit sync` 首喂 MEMORY.md。

## Do Not Redo
- 不要恢复 GBrain / wiki-enrich / vector；历史档案（CHANGELOG、docs/history/、docs/plans/）豁免不清。
- 不要动 `src/lib/wikilinks.ts` 的 problem1 改动。
- 不要把 SHA SOURCE MODIFIED / valid_until / 矛盾检测加进 CLI——先生选的是"列清单+预查建议"
  档位，skill 里已明示这些是手动流程；防漂移原则下 skill 不许再声称 CLI 有这些能力。
- AGENTS.md 不再维护 Last updated / 近期重点状态行，状态一律看本文件；不要加回去。
- 桌面 corpus 的 `_工作台/转写/`、`_工作台/日记收件/` 不进清算与 --all 召回。
