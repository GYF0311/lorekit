---
cmap_version: 0.1
context_type: checkpoint
project: lorekit
source_commit: 52d8bf0
updated_at: 2026-06-11T05:30:00Z
confidence: ai-drafted
---
# Current Checkpoint

> 中文检查点。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。

## Current Task
「对齐 + 收敛」三刀计划（见 `docs/ai/TODO-lorekit-cleanup.md`）。第一刀（止血：删 GBrain、删 wiki-enrich、清死引用与污染）与第二刀（恢复 `links` 命令 + 修两个设计缺陷）均已于 2026-06-11 完成。下一刀：现场 corpus 0.1.0 → 0.4.0 升级（高风险，动手前必须 snapshot + 先生单独确认）。

## Current Hypothesis
CLI 本体成熟；病灶在技能层超前于工具 + 从未同步到现场 corpus。方向是对齐收敛，不是扩张造新功能。

## Changed Files
- 删除（trash）：`brain/`、`src/commands/gbrain.ts`、`src/lib/integrations/{gbrain*,manifest.ts}`（保留 `process.ts`）、`skills/corpus-gbrain-query/`、`skills/wiki-enrich/`、`docs/integrations/gbrain.md`、5 个 `tests/smoke/gbrain-*.test.mjs`、`.context/modules/obsidian-gbrain.md`
- 剥离引用：`src/cli.ts`、`src/commands/doctor.ts`（整段摘除 integrations section）、`src/lib/paths.ts`、`tests/smoke/{sync-report,doctor-json}.test.mjs`
- 清理文档：README、ARCHITECTURE、CODEBASE-MAP、DESIGN-NOTES、IDEAS、INSTALLATION、INTRODUCTION、QUICKSTART、AGENTS.md、`integrations/claude-code/README.md`、`templates/default-corpus/{README,AGENTS,CLAUDE}.md`、6 个 skills
- `.context`：新增 `modules/obsidian-export.md`，同步 MAP/STATUS/VERIFY/BRIEF/glossary/各模块；`cmap graph build` + `_cmap`/`_cmap-view` 重导
- 另有未 commit 的 problem1 修复：`src/lib/wikilinks.ts` + `lint.ts`/`ingest.ts`（图片嵌入误报断链，勿动）

## Verified
- `npm run build`: Build success.
- `npm run verify`: 72 tests, 72 pass, 0 fail（62 一刀后基线 + 10 个 links 用例）。
- `cmap verify --changed`: 0 errors；warnings 均为已删除文件 unmapped，预期。
- `grep -ri gbrain` / `wiki-enrich` / `lorekit vector`：现行文件零残留（豁免历史档案：CHANGELOG、`docs/history/`、`docs/plans/`、`DONE.md`、TODO 文档自身）。
- `git diff --check`: passed.

## 第二刀要点（2026-06-11）
- `links.ts` 从废纸篓恢复（今早 09:52 工作版，先生提示找回），注册回 cli.ts；子命令 suggest/fix/stub/backlog/plain/plained。
- 缺陷 1 修复：`plain` 写台账到 `.wiki/links-state.json`；`links plained` 列台账、标 revivable、自动清出已重连条目。
- 缺陷 2 修复：新建 `src/lib/missing-nodes.ts`（SSOT helper）；lint 把已 backlog 的断链降级为 `backlogged-link` 不计入失败（`countHardLintIssues`，lint/remove 两个调用方都改）。
- 测试 `tests/smoke/links.test.mjs` 10/10，含两个缺陷修复专项用例。

## Failed / Pending
- 全部改动（problem1 + 第一刀 + 第二刀）未 commit，等先生指示分批提交。
- 第三刀：现场 corpus 0.1.0 → 0.4.0 升级（高风险，动手前必须 snapshot + 单独确认）。
- `modules/safety-maintenance.md` 仍描述旧的 lint 断链实现，待更新。

## Next Step
第三刀：先 snapshot 备份两个现场知识库，再 install-skills 刷新 / 模板 merge / 升版本；动手前与先生单独确认。

## Do Not Redo
- 不要恢复任何 GBrain / wiki-enrich / vector 内容；历史档案（CHANGELOG、docs/history/、docs/plans/）里的相关字样是故意保留的，不要清。
- 不要动 `src/lib/wikilinks.ts` 及 lint/ingest 的 problem1 改动。
- 不要为消除 `AGENTS.md and CLAUDE.md differ` warning 复制整份 `AGENTS.md`。不要把 `_cmap/`、`_cmap-view/` 当 canonical facts。
