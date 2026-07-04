---
cmap_version: 0.1
context_type: checkpoint
project: lorekit
source_commit: HEAD
updated_at: 2026-07-05T09:30:00Z
confidence: ai-drafted
---
# Current Checkpoint

> 中文检查点。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。

## Current Task
0.5.2 收尾（2026-07-05）。前序批次全部完成：①工作台闭环（两级召回 / stale-review /
unresolved-source / workbench report / wiki-triage / 防漂移测试）✅ ②桌面 corpus 部署
（skills 刷新 + 契约补丁 + 凭据 gitignore）✅ ③npm 发布（scoped 包 `@xiaowuovo/lorekit`）✅
④Windows 适配（relPosix 27 处归一 / `lorekit trash` 新命令 / install-skills win32 默认
copy / homedir()/tmpdir()）✅ ⑤联网兜底转正（wiki-query 第 6 步 / corpus-query 直接兜底 /
模板契约 + 总库 + AI产品库同步）✅ ⑥docs 全面对齐（npm-first 安装 / 架构图 / trash 进
INTRODUCTION/CODEBASE-MAP）✅。

版本注意：npm `0.5.1` 发布于 Windows 批次中途（中间状态、版本号已占用），完整内容
以 `0.5.2` 为准；CHANGELOG 已注明。

## Current Hypothesis
功能面已闭环；当前最大风险不是缺功能，而是新机制（triage 清算 / stale 复审）尚未在
真实 corpus 实战过一轮，以及 Windows 修复未经真机端到端验证（逻辑确定性、macOS 90+
测试全过）。

## Changed Files
- 0.5.2 批次新增：`src/commands/trash.ts`、`src/lib/paths.ts` relPosix()、
  `tests/smoke/trash.test.mjs`
- 0.5.2 批次修改：12 个文件的 `relative()` → `relPosix()`、`install-skills.ts`
  （win32 copy 默认 + homedir）、`fetch.ts`（tmpdir）、`skills/wiki-{query,ingest,triage}`
  与 `skills/corpus-{query,ingest}`（trash 措辞 + 联网兜底）、`templates/default-corpus`
  契约、README / QUICKSTART / INSTALLATION / INTRODUCTION / CODEBASE-MAP / CHANGELOG
- 现场同步（不在本 repo）：总库 corpus 契约 + skills、AI产品库 AGENTS.md + 新建
  CLAUDE.md 入口镜像、`~/.agents/skills/corpus-query`

## Verified
- `npm run verify`: 90 tests / 90 pass（含 5 个 trash 边界新测试）。
- npm registry `0.5.1` 上架确认（`npm view`）；`0.5.2` 待先生 publish。
- skills↔CLI 防漂移测试确认 `lorekit trash` 措辞与真实命令一致。

## Failed / Pending
- npm `0.5.2` publish：需先生终端 Touch ID（0.5.1 版本号被中间状态占用，不可覆盖）。
- Windows 真机端到端验证未做；GitHub Actions `windows-latest` 测试矩阵已立项
  （docs/ai/TODO-lorekit-cleanup.md §5）。
- triage / stale 首轮实战 + 存量页 `domain_volatility` backfill 未做。
- 桌面 corpus git 工作树有未提交改动（契约 / MEMORY / gitignore / 课件清理删除），
  按先生惯例分路径提交，AI 不代 git。

## Next Step
先生 `npm publish` 发 0.5.2 → 轮询确认上架。之后按需：Windows CI 矩阵 / 总库首轮
triage 实战 / stale backfill。

## Do Not Redo
- 不要恢复 GBrain / wiki-enrich / vector；历史档案（CHANGELOG、docs/history/、docs/plans/）豁免不清。
- 不要动 `src/lib/wikilinks.ts` 的 problem1 改动。
- 不要把 SHA SOURCE MODIFIED / valid_until / 矛盾检测加进 CLI——先生选的是"列清单+预查建议"
  档位，skill 里已明示这些是手动流程；防漂移原则下 skill 不许再声称 CLI 有这些能力。
- AGENTS.md 不再维护 Last updated / 近期重点状态行，状态一律看本文件；不要加回去。
- 桌面 corpus 的 `_工作台/转写/`、`_工作台/日记收件/` 不进清算与 --all 召回。
- 路径相对化一律走 `relPosix()`（`src/lib/paths.ts`），不要新增裸 `path.relative` 比较。
- skill 层保持单一套跨平台：平台差异下沉 CLI 吸收，不要为 Windows 分叉 skill。
