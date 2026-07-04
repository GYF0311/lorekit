# lorekit 对齐收尾 — To-Do

> **由来**：从修 GitHub issue #18 延展出的整体清理计划。结论——lorekit CLI 本体 ≈95% 成熟，病灶在**技能层(skills)超前于工具 + 从没同步到现场 corpus**。刀法是「**对齐 + 收敛**」，不是「扩张造新功能」。
> **三刀**：止血（清死引用/污染、删 GBrain）→ 补齐（problem2 links）→ 同步（升级现场 corpus）。
> **用法**：`- [ ]` 未做，`- [x]` 完成，`- [~]` 进行中。大任务套小任务，一件件勾。
> **约束**：改 `src/` 后 `npm run build`，收尾 `npm run verify` + `cmap verify --changed` 全绿；删除用 `/usr/bin/trash` 不用 `rm`；委托 Codex 用 `--model spark --effort xhigh --cwd /Users/gaoyifan/code/lorekit`，暂不用 gpt-5.5；委托产出主控独立 review diff + 复跑测试，不自审自过。

---

## 0. 前置核实（动刀前先查清）

- [ ] 核实 `src/commands/init.ts` 完整性（曾现满屏 `logarithms` 异常 grep 输出；但 build/tsc/smoke 都过，大概率终端抖动。`Read` 头部确认）
- [ ] 核实 lorekit 有没有「升级已有 corpus」能力 + 安全姿势
  - [ ] `init` 对已存在 corpus 的行为（scaffold version、`--force`、不覆盖用户内容）
  - [ ] `.wiki/version`+`config.yaml` 怎么更新（现场 0.1.0，源码 0.4.0）
  - [ ] 升级路径 = `install-skills` 刷新 + 模板 merge，还是重跑 `init`
- [x] 核实删 GBrain 对核心命令无影响（2026-06-11 验证：核心命令零 gbrain import；删除后 build + 62/62 smoke 全绿）

---

## 1. 第一刀：止血（清死引用 + 清污染 + 删 GBrain）— ✅ 2026-06-11 完成

### 1.1 移除 GBrain
- [x] trash `brain/`（GBrain 研究快照，1292 文件）
- [x] trash gbrain 代码：`src/commands/gbrain.ts`、`src/lib/integrations/{gbrain.ts,gbrain-export.ts,gbrain-status.ts,manifest.ts,gbrain/}`（**保留 `integrations/process.ts`**，search.ts 依赖）
- [x] trash `skills/corpus-gbrain-query/`、`docs/integrations/gbrain.md`、5 个 `tests/smoke/gbrain-*.test.mjs`、委托单 `docs/ai/remove-gbrain.md`
- [x] 剥离 gbrain：`cli.ts`（退注册）、`paths.ts`（1 行）、`doctor.ts`（整段摘除 integrations section——它就是 gbrain 专属）
- [x] 剥离测试断言：`sync-report.test.mjs`（去 env）、`doctor-json.test.mjs`（重写，只留 4 个非 gbrain 用例）
- [x] 剥离 docs：README、CODEBASE-MAP、ARCHITECTURE、IDEAS、DESIGN-NOTES、QUICKSTART、INTRODUCTION、INSTALLATION、AGENTS.md 近期重点行
- [x] 剥离 corpus 模板：`templates/default-corpus/{README,AGENTS,CLAUDE}.md`
- [x] 拆 `.context/modules/obsidian-gbrain.md` → `obsidian-export.md`；同步 MAP/STATUS/VERIFY/BRIEF/glossary/其它 modules
- [x] 重新生成：`cmap graph build` + `npm run build` + `_cmap`/`_cmap-view` 重导
- 边界（先生 2026-06-11 定）：历史档案豁免——CHANGELOG、`docs/history/`、`docs/plans/` 不动，只清会被照着执行的现行文档

### 1.2 清 vector 死引用
- [x] 核实后实际不存在：`grep -ri vector skills/` 零命中，应已随嵌套污染副本一起消失，无需动作

### 1.3 清嵌套污染副本
- [x] trash 7 个 `skills/wiki-*/wiki-*/`（install-skills 在 repo 自身误跑产生，untracked）

### 1.4 处理"未实现命令"的引用
- [x] 核实后只剩 `enrich` 一处是真死引用；其余（`lint plan`/`lint fix --safe`/`--workbench`/`doctor --strict`/`source finalize`）在现 skills 里不存在
- [x] enrich 处置（先生 2026-06-11 定）：**删除 wiki-enrich skill**，不保留月度复盘流程；连带清 wiki-ingest/wiki-lint/wiki-fileback/wiki-query 里的转介引用 + README skill 列表

---

## 2. 第二刀：补齐（problem2 — links 断链闭环）— ✅ 2026-06-11 完成

- [x] **problem1**：lint/ingest-check 图片嵌入误报修复（共享 resolver `src/lib/wikilinks.ts`，已完成）
- [x] **恢复 links 命令**：从废纸篓找回今早 09:52 工作版（先生提示；比分支 bc07224 旧版新，且就是按现 resolver 写的）
  - [x] `src/commands/links.ts`（suggest/fix/stub/backlog/plain + 新增 plained）
  - [x] `src/cli.ts` 加回 import + 注册
  - [x] `tests/smoke/links.test.mjs` 恢复 + 新增 2 个缺陷修复用例（10/10 过）
  - [x] README / CODEBASE-MAP / QUICKSTART / wiki-lint skill 文档（委托 Sonnet，主控已 review + 复跑验证）
- [x] **修缺陷 1：`plain` 降级有损** — 方案：`plain` 记台账到 `.wiki/links-state.json`；新子命令 `links plained` 列台账，目标页已建的标 revivable 提醒重连，已重连的自动清出
- [x] **修缺陷 2：`backlog` 不真闭环** — 方案：lint 读 `系统/missing-nodes.md`（提取 SSOT helper `src/lib/missing-nodes.ts`），已登记 label 的断链降级 backlogged 不计入失败；建页删行后恢复检测
- [x] 补测试 + `npm run verify` 全绿（72/72）

---

## 3. 第三刀：同步（把对齐后的 lorekit 推到现场 corpus）

> Route B 收尾批次 B6/B7/B8 从没做，现场 corpus 还用 0.1.0 旧 skills。→ ✅ 2026-06-11 完成
> **⚠️ 这一刀动的是先生真实知识库，全计划唯一高不可逆风险处——改动前必须先有可回滚快照。**

- [x] **动 corpus 前先备份**：桌面 corpus snapshot `20260611-144317.tar.gz`（21056 文件 1.8GB）；第二库未做任何改动故无需快照
- [x] 桌面 `corpus`（`/Users/gaoyifan/Desktop/corpus`）升级（2026-06-11 完成）
  - [x] `install-skills --target project --mode copy` 刷新 7 个 wiki-* 到 0.4.0（旧 0.1.0 英文薄版已 trash，确认非定制）
  - [x] `CLAUDE.md`/`AGENTS.md`：现场契约比模板更新更好，**未覆盖**；仅修 1 处失效引用（`wiki-links` skill → `lorekit links`），两份保持一致
  - [x] `.wiki/version`+`config.yaml` 升到 0.4.0
  - [x] 清理遗留物（trash，可恢复）：`.wiki/{vector.sqlite,link-candidates.json,installed-harnesses.json}`（grep 确认无代码引用）；`~/.config/lorekit/global-corpus.json` 去掉 `gbrain_bin`
  - [x] 标定（只读）：doctor 全绿；lint 18 条全为存量内容噪音（10 frontmatter + 6 断链 + 2 孤岛）；ingest pending 状态机正常；search 正常；`links suggest` 真实库可用
- [x] 第二个知识库「AI产品视频转写与课件工作集-20260522」：已是 0.4.0、零死引用、doctor 全绿、纯 domain-skill 自洽（不依赖 wiki-*）——无需动作
- [x] 两库现场体检：AGENTS/CLAUDE + skills 零失效引用
- 备忘：`/Users/gaoyifan/Desktop/OpenClaw-Base-Camp` 也有 `.wiki` 但 version 文件缺失，不在本刀范围，待先生定性

---

## 4. 收尾 / 治本

- [x] `.context` 同步：`modules/safety-maintenance.md` 已更新（2026-07-04，含新 lint 分级与防漂移测试说明）
- [x] **commit 时机**：三刀改动已在 6ea1244 / ee83742 提交；2026-07-04 工作台闭环批次逐任务小步 commit
- [x] skills ↔ lorekit **防漂移机制**：`tests/smoke/skills-cli-drift.test.mjs`（2026-07-04），从 CLI --help 动态提取命令清单比对 skills 引用，已做负向检验，纳入 `npm run verify`
- [ ] （远期可选）npm 发布，`npm install -g lorekit`（包名 2026-07-04 时点未被占用；先生 npm 账号就绪后 `npm login` + `npm publish` 即可）

---

## 参考

- 蓝图：`docs/plans/2026-04-19-route-b-schema-skill-upgrade.md`（Route B）
- GBrain 移除委托单：`docs/ai/remove-gbrain.md`
- problem1 产物：`src/lib/wikilinks.ts`
- lorekit 本质：确定性 CLI + agent 技能包，AI 判断/CLI 机械，corpus-agnostic；`brain/` 是 GBrain 研究快照、非依赖
