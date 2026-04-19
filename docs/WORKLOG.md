# WORKLOG.md — lorekit 工作日志

> append-only。最新条目在最上方。
> 不反推历史 commit；这份日志从 2026-04-19 开始。
> 每条格式：`## YYYY-MM-DD — 标题` + 三段（做了什么 / 为什么 / 接下来）。

---

## 2026-04-19 — 批次 20b：ingest stepsDone 同模式去重（规划方批准追加）

**做了什么**

- 批次 20 提交后，规划方拍板把"发现但未处理"里的 stepsDone 同模式 bug 也一并修
- `src/commands/ingest.ts:195` `[...prev, ...parsedSteps]` → `[...new Set([...prev, ...parsedSteps])]`，注释引用"批次 20b / P4-1 同模式"
- `tests/smoke/ingest-record.test.mjs` 加 1 条 smoke：用独立 URL（避开前一条 smoke 状态污染），`record --step archive,wiki` 然后 `record --step wiki,backlink`，断言 `stepsDone === [archive, wiki, backlink]`
- tag：`refactor-batch-20b`
- smoke 18 tests / 17 pass / 1 skip；lint baseline 37 → 37（无变化）

**为什么**

- 规划方判断 stepsDone 同模式 bug 与 P4-1 同质，没必要拖到下个批次；同 5 分钟工作量一次清掉
- 不去重的副作用：`stepsDone` 出现 `[archive, archive, wiki, wiki, backlink]` 这种噪声，`nextStepHint` / `pending` 推断逻辑虽然现在用 `includes` 看似不受影响，但任何未来用 `.length` 或 frequency 推断的地方都会被误导

**接下来**

- 主线只剩：批次 18（CI，可选推迟）+ 批次 21（拆 fetcher，高风险）+ 批次 22（拆 vectordb，极高风险）

---

## 2026-04-19 — 批次 20：P4-1 ingest variadic 验证（修 wikiPages 去重）

**做了什么**

- 复现 P4-1 现象：`lorekit ingest record <url> --wiki-page A --wiki-page B` 然后 `--wiki-page B --wiki-page C` 后，`.wiki/ingest-state.json` 的 `wikiPages` 实际是 `[A, B, B, C]`，B 重复
- `src/commands/ingest.ts:208` 修：`patch.wikiPages = [...prev, ...opts.wikiPage]` → `[...new Set([...prev, ...opts.wikiPage])]`，保留首次出现顺序去重，加注释指 LEGACY P4-1
- 新增 `tests/smoke/ingest-record.test.mjs`：建临时 corpus，连发两次 record，断言 `wikiPages === [A, B, C]`
- LEGACY P4-1 标 ✅（待验证 → 已修）
- 工作 1 顺手：LEGACY 加 P4-8（Windows 路径分隔符硬编码）入档，单独 commit
- tag：`refactor-batch-20`
- smoke 17 tests / 16 pass / 1 skip；lint baseline 37 → 37（无变化）

**为什么**

- LEGACY P4-1 / B2 描述 wiki-page 多次追加的去重行为未实测；smoke 当场暴露 bug，按"修复 bug"路径走（fix + smoke 锁行为单 commit，比"先 smoke 锁错误行为再后续修"清晰）
- 不去重的副作用：log.md 的 `- **新建/更新页**` bullet 列表里同一页可能出现多次；下游脚本若用 wikiPages 数量统计也会偏高
- 用 `[...new Set(...)]` 保持首次顺序，对调用方友好（不会因为顺序变化而难以预测最终列表）

**发现但未处理**

- `src/commands/ingest.ts:195` `patch.stepsDone = [...prev, ...parsedSteps]` 同样不去重。多次 `--step archive` 或 `--step archive,wiki` 与 `--step wiki,backlink` 链式调用会产生 `[archive, archive, wiki, wiki, backlink]`。**不在 P4-1 描述范围**（P4-1 只提 wiki-page），未修，留给后续单独评估是否要加去重 + 进 LEGACY

**接下来**

- 主线只剩：批次 18（CI，可选推迟）+ 批次 21（拆 fetcher，高风险）+ 批次 22（拆 vectordb，极高风险）。21/22 必须每子批先生 review，不许 unattended

---

## 2026-04-19 — 批次 19：P4 杂项 snapshot/restore/vector 安全收敛（B3/B4/B6）

**做了什么**

- `src/commands/snapshot.ts`（P4-2/B3）：manifest 写入后用 try/finally 包 tar.create 调用链，任何抛错都会清掉 `.wiki/snapshots/manifest.json`，不再残留
- `src/commands/restore.ts`（P4-3/B4）：`rmDirRecursive` 上加一整块注释明确锁定 `os.tmpdir()` 子目录，对齐先生全局 CLAUDE.md 的数据安全红线（rm-guard 精神，源码侧的文档性约束）
- `src/commands/vector.ts`（P4-5/B6）：`runVectorSync` 内 `filePath.replace(corpus + '/', '')` → `path.relative(corpus, filePath)`，顶部 import 加 `relative`
- `tests/smoke/corpus.test.mjs`：snapshot 测试追加 "`.wiki/snapshots/` 不应残留 manifest.json" 断言（try/finally 后置条件的可验证覆盖）
- 手动验：`init . && snapshot` 后目录只剩 `.tar.gz`，无 manifest
- tag：`refactor-batch-19`
- smoke 16 tests / 15 pass / 1 skip；lint baseline 38 → 37

**为什么**

- LEGACY P4-2 / P4-3 / P4-5：三个 P4 小项一起做，低风险可并批
- P4-4（fetcher 微信 `<picture>`/`<source>`）按原计划留给批次 21 拆 fetcher 时一起修，**本批不碰 fetcher**
- restore.ts 的 `rmSync` 本就锁在 tmpdir，注释化是"道德约束"，等于把不可改动的前置条件写进代码里给后续动这段的人看

**接下来**

- 批次 20（P4-1 ingest variadic 待验证）：需要先写 smoke 复现 `--wiki-page a --wiki-page b --step archive,wiki` 的实际行为是否如预期（去重 / 列表 append），再决定是否改 src
- 批次 21 / 22：P0 拆库，**必须每子批一 review**，不可 unattended

---

## 2026-04-19 — 批次 14b：install-skills.ts console sweep（P2-4 补）

**做了什么**

- `src/commands/install-skills.ts` 3 处 console → logger 分流：
  - `--list` 输出 `name -> target` symlink 列表 → `out` (stdout, 机器可读；下游可 `awk` / `wc` 统计)
  - "No skills found to install." → `print` (stderr)
  - "\nInstalled N skill(s). Restart Claude Code..." → `print` (stderr，保留 `\n` 空行)
- 手动验：`node dist/cli.js install-skills --list > /tmp/out 2> /tmp/err` → stdout 6 行 / stderr 0 行，分流正确
- tag：`refactor-batch-14b`
- smoke 16 tests / 15 pass / 1 skip；lint baseline 41 → 38

**为什么**

- 批次 14 sweep 时 unattended 没敢碰：`--list` 是给脚本读的 stdout 还是给人看的 stderr，需要判断，不适合无人值守批量替换
- 先生前台 review 下定了：`out` 走 stdout（machine-readable），`print` 走 stderr（human-readable）；install-skills 的 `--list` 明显是后者可以管道 `| wc -l` 统计的
- `src/commands/fetch.ts` 5 处 console 按 LEGACY 备注**留给批次 21 拆 fetcher 时一并做**

**接下来**

- 进 Commit C 批次 19（P4 小项）

---

## 2026-04-19 — 批次 17：P3 commands/index.ts rename + NaN 守卫（**单批合并**）

**做了什么**

- `git mv src/commands/index.ts src/commands/dir-index.ts` —— 消除文件名歧义（之前像 barrel export，实际是 `lorekit index` 命令）
- `src/cli.ts:16` import 路径 `./commands/index.js` → `./commands/dir-index.js`
- `src/commands/sync.ts:5` import 路径 `./index.js` → `./dir-index.js`
- `src/lib/paths.ts` 注释里 `commands/index.ts` → `commands/dir-index.ts`（cosmetic）
- `src/commands/vector.ts`：query action 加 `topK` / `threshold` NaN + 范围守卫（`Number.isFinite + 范围`），不合法 → exit 2
- `tests/smoke/cli-meta.test.mjs`：新增 `vector query --top-k notanumber → exit 2` smoke
- tag：`refactor-batch-17`
- smoke 16 tests / 15 pass / 1 skip

**为什么**

- LEGACY P3-4 + P3-5：commands/index.ts 名字误导 + parseInt/parseFloat 不守 NaN 是 CONVENTIONS #4 漏洞
- doctor.ts 和 fetch.ts 在原计划列了，但实际 doctor 早已不 import commands/index.ts（批次 7 后改为 paths.ts），fetch.ts 没有 parseInt/parseFloat 调用 —— 计划列表是 forward-looking 误估

**接下来 — 主线全部完成**

- 批次 3-17 全完成（共 15 个逻辑批，约 18 个 commit）。剩 18 (CI 推迟) / 19-20 (P4 明早先生看) / 21-22 (P0 拆库, 不许 unattended 动)
- 写 DONE.md 给先生明早复检

---

## 2026-04-19 — 批次 16：P3 文档 sweep（README + integrations + .gitignore）

**做了什么**

- `README.md` L116：`lorekit --version  # → 0.2.0` → `0.3.0`（VERSION 文件实值）
- `.gitignore`：加 `/.wiki/` 根级排除；`.wiki/vector.sqlite*` 等子规则保留兼容 corpus 目录
- `integrations/claude-code/install.sh`：57 行旧实现 → 11 行 thin shim，`exec lorekit install-skills --target claude-code "$@"`，去掉了原文里的 `rm -rf` 路径
- `integrations/claude-code/uninstall.sh`：34 行旧实现 → 11 行 thin shim，转发 `lorekit install-skills --target claude-code --uninstall`
- `integrations/claude-code/README.md`：补一行说明现在是 thin shim
- tag：`refactor-batch-16`

**为什么**

- LEGACY P3-1 / P3-2 / P3-3：文档 / 历史脚本 / 仓库清洁的杂项
- 旧 install.sh 自带 `rm -rf "$target"` 在 macOS rm-guard 红线眼里是定时炸弹；shim 化后所有删除都走 lorekit CLI 的 unlinkSync（仅删 symlink，安全）

**接下来**

- 进批次 17：P3 commands/index.ts rename + NaN 守卫（**单批合并**，先生 Q2 决定）

---

## 2026-04-19 — 批次 15：P2 杂项 vector 静态 import + 退出码 + eslint disable 删（P2-1 / P2-5 / P2-6）

**做了什么**

- `src/commands/vector.ts`：4 处 `await import('node:fs')` / `'node:path'` / `'node:crypto'` 提到顶部静态 import（CONVENTIONS #8）
- `src/lib/vectordb.ts:49`：删 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`，注释里说明"由批次 22 拆 vectordb 时一并改成精确类型"。`Db = any` 暂留为已知违规
- `src/commands/restore.ts:54`：snapshot 路径不存在 `process.exitCode = 1` → `2`（参数错，CONVENTIONS #4）
- `src/cli.ts`：加 commander `exitOverride`，把 missing argument / unknown command / invalid option 等 arg 错统一映射到 exit 2；help / version → exit 0
- `tests/smoke/cli-meta.test.mjs`：新增 2 条 smoke：`fetch` 缺 URL → exit 2，`nonexistent-command` → exit 2
- tag：`refactor-batch-15`
- smoke 15 tests / 14 pass / 1 skip

**为什么**

- LEGACY P2-1 / P2-5 / P2-6：把 P2 杂项一次清掉
- exitOverride 是给 commander 的全局拦截，把"用户用法错"统一到 exit 2，下游脚本判断 status 码就能区分"运行时挂"vs"调用错了"

**注**

- ESLint baseline 现在 18 = 7 no-console (vectordb) + 5 no-console (fetch) + 3 no-console (install-skills) + 2 no-explicit-any (含本批暴露的 Db = any) + 1 ban-ts-comment
- vectordb 的 `Db = any` 暂留是已知违规，待批次 22 拆库时按 `import type Database from 'better-sqlite3'` 改成精确类型

**接下来**

- 进批次 16：P3 文档 sweep（README 版本号 + integrations 删 / 转发 + 根 .wiki 进 .gitignore）

---

## 2026-04-19 — 批次 14：P2 sweep console→logger 余下 9 commands（P2-4 b）

**做了什么**

- 加 `out(msg)` 到 logger.ts —— 写 stdout 给 JSON / 机器输出（CONVENTIONS Do Not #2 收口）
- 9 commands 文件 sweep：
  - `restore.ts` 5 处 `console.log` → `print`
  - `audit.ts` 6 处 `console.log` → `print`（list / summary 输出归 stderr，符合 CONVENTIONS）
  - `stats.ts` 1 处 `console.log(JSON.stringify)` → `out`
  - `vector.ts` 3 处：1 print + 2 out（Building... → print，2 个 JSON → out）
  - `search.ts` 1 处 `console.log(JSON.stringify)` → `out`
  - `ingest.ts` 24 处：8 个 `console.log(JSON.stringify)` → `out`，16 个 `console.error('[lorekit ingest XXX] ...')` → `print`（消息自带前缀，不再叠加 logger 装饰）
  - `index.ts` / `snapshot.ts` 已经 0 console，不动
  - `lint.ts` 5 处 `console.log` → `print`
- tag：`refactor-batch-14`
- **lint baseline**：no-console 60 → **15**（-45）

**手动验**

- `stats 2>/dev/null | python3 -c 'json.load(sys.stdin)'` → JSON 解析成功 ✓
- `vector status 2>/dev/null` → JSON 解析成功 ✓

**已知遗留（不在批次 14 计划内，留 WORKLOG 给先生）**

- `src/lib/vectordb.ts` 7 处 console — **批次 22 拆库时一起做**（已在原计划）
- `src/commands/fetch.ts` 5 处 console — **不在 13 / 14 计划列表里**（计划遗漏）；建议明早先生决定：插入 batch 14 后做一次小补丁，或归到批次 21 拆 fetcher 时一并做
- `src/commands/install-skills.ts` 3 处 console — 同样**不在计划列表**；建议同上处理（list 输出涉及 stdout 机器读用例 vs 人类输出之别，需要先生定夺）
- 批次 12 时 ingest.ts 我引入的一处 console.error 已被本批顺手清掉（`out`→ 16 个 console.error 的批量替换覆盖到了）

**接下来**

- 进批次 15：P2 杂项（vector.ts 标准库静态 import + 退出码统一 + vectordb eslint disable 删）

---

## 2026-04-19 — 批次 13：P2 sweep console→logger（cli + init + doctor + sync）（P2-4 a）

**做了什么**

- 加 `print(msg = '')` 到 logger.ts —— 写 stderr 无装饰，专为 banner / headers / 空行用
- `src/cli.ts`：18 处 `console.log` → `print`（banner 全部，含 ASCII art）
- `src/commands/init.ts`：2 处 `console.log` → `print`
- `src/commands/doctor.ts`：15 处 `console.log` → `print`
- `src/commands/sync.ts`：7 处 `console.log` → `print`
- tag：`refactor-batch-13`
- **lint baseline**：no-console 102 → **60**（-42 符合预期）；cli/init/doctor/sync 这 4 文件本批后 0 违规
- **手动验**：`doctor 2>/dev/null` stdout 空（vs 批次 10 后 stdout 有 chalk headers）；stderr 含完整输出

**为什么**

- LEGACY P2-4 (a) + CONVENTIONS Do Not #2 / #3：commands 内的 `console.log(chalk.xxx)` 会污染 stdout，破坏 `lorekit ... | jq` 这种管道用法
- 加 `print()` 而不是把所有 header 强行套 `info()` 的 ℹ 前缀，是为了保留 banner / 分区线的视觉结构

**已知问题（批次 14 / 12 顺手项）**

- 批次 12 修 ingest 时引入了一处 `console.error`（无意），由批次 14 sweep ingest.ts 时一并清掉
- vectordb.ts 7 处 console.log 留给批次 22

**接下来**

- 进批次 14：余下 9 个 commands 文件 console→logger 大批合并

---

## 2026-04-19 — 批次 12：P2 sweep `as any`（P2-3）

**做了什么**

- `src/commands/ingest.ts:208` 的 `patch.status = opts.status as any` 改为先在 `IngestStatus` 三值范围内校验，非法 → exit 2 + stderr 提示，合法 → `as IngestStatus`
- 顺手 import `IngestStatus` 类型（之前只 import 了 `IngestStep`）
- tag：`refactor-batch-12`
- `vectordb.ts:276 (Database as any)` 留给批次 22；`fetcher.ts:155 @ts-ignore` 留给批次 21

**为什么**

- LEGACY P2-3 + CONVENTIONS Do Not #4：裸 `as any` 把类型校验绕过，运行时若来个 `--status xyz` 静默写进 state，下游 `nextStepHint` 走 `failed` 分支但没 reason，行为奇怪
- 现在显式校验 + exit 2 符合 CONVENTIONS #4（参数错→2）

**接下来**

- 进批次 13：P2 sweep — `console → logger`（cli + init + doctor + sync）

---

## 2026-04-19 — 批次 11：P2 sweep 沉默 catch（P2-2）

**做了什么**

- 5 文件 8 处 catch 全清，按"批量调用 → debug；一次性关键 → warn"分级：
  - `src/cli.ts` × 2（banner 内）→ `debug`
  - `src/lib/corpus.ts` × 2（extractFrontmatter / hasFrontmatter）→ `debug`
  - `src/lib/root-index.ts` × 1（extractCompiledTruthSnippet）→ `debug`
  - `src/commands/stats.ts` × 2（per-file mtime / readFileSync）→ `debug`
  - `src/utils/fs.ts` × 1（readVersion，VERSION 缺失是安装异常）→ `warn`
- tag：`refactor-batch-11`
- `fetcher.ts` / `vectordb.ts` 内的沉默 catch 按计划留给批次 21 / 22

**为什么**

- LEGACY P2-2 + CONVENTIONS Do Not #3：沉默 catch 丢诊断信息
- 大 corpus 上批量调用的 catch（lib 层）走 debug 避免刷屏；用户开 `LOREKIT_DEBUG=1` 复现时再看
- 每条 catch 加了一行注释解释"为什么可以继续 / 为什么仍降级"，符合 CONVENTIONS 范例

**接下来**

- 进批次 12：P2 sweep — `as any` / `@ts-ignore`（主要 ingest.ts，剩余 vectordb / fetcher 留给 21/22）

---

## 2026-04-19 — 批次 10：logger 加等级 + bad → stderr（P1-3）

**做了什么**

- `src/utils/logger.ts` 完全重写：所有 6 个 export（`ok` / `bad` / `warn` / `err` / `info` / `debug`）一律走 stderr；新增 `info` / `debug`；debug 受 `LOREKIT_DEBUG=1` 控制
- 修了 `bad` 写 stdout 的 bug（CONVENTIONS #3 早就规定但 logger 自身没落地）
- tag：`refactor-batch-10`
- **手动验**（task spec 4 条全过）：
  - `--version 2>/dev/null` → stdout = "0.3.0"，6 字符 ✓
  - 非 corpus 跑 doctor → stdout 空 ✓
  - `nonexistent-command` → stderr 有 "error: unknown command 'nonexistent-command'" ✓

**为什么**

- LEGACY P1-3：CONVENTIONS #3 锁定的 stdout/stderr 分流，logger 自己不实现等于规则没落地；这一改让所有走 logger 的输出全 stderr
- `info` 是 batch 13/14 sweep 时大量用到的等级（替代当前的 `console.log` 中性提示）

**已知中间态（不算"异常"）**

- 在真实 corpus 内跑 `doctor 2>/dev/null` 会看到 chalk 着色的 headers 还在 stdout —— 那是 doctor.ts 自己有 `console.log(chalk.bold/cyan(...))` 直接调用，不是 logger 的问题。**批次 13 (cli + 简单 commands console→logger sweep) 收掉这个**
- 同样问题在 init / sync 等 commands 的直接 console 调用里。批次 13 / 14 各自负责
- smoke 全过；该中间态不阻塞，是计划内的

**接下来**

- 进批次 11：P2 sweep — 沉默 catch（cli + corpus + root-index + stats + utils/fs）

---

## 2026-04-19 — 批次 9：date.ts sweep 2（snapshot + ingest）（P1-2 b）

**做了什么**

- `src/commands/snapshot.ts`：8 行手写 `pad / now.getXxx` 拼接 → `tsCompact()` 一行
- `src/commands/ingest.ts`：`today()` 内部从手写 → `dateToYMDLocal(new Date())`
- tag：`refactor-batch-9`
- fetcher.ts 内 `todayYMD/tsToYMD/normalizeDateText` 暂留，按计划随批次 21 拆 fetcher 时一起迁

**为什么**

- LEGACY P1-2 (b)：完成 P1-2 的剩余 sweep，集中完毕（除 fetcher.ts）

**接下来**

- 进批次 10：logger.ts 加 `info` / `debug` + `bad → stderr`（P1-3，**中风险，要额外手动验证**）

---

## 2026-04-19 — 批次 8：建 lib/date.ts + 迁 index/audit（P1-2 a）

**做了什么**

- 新建 `src/lib/date.ts`：导出 `pad2` / `todayYMDShanghai` / `dateToYMDUtc` / `dateToYMDLocal` / `tsCompact`（YYYYMMDD-HHMMSS）/ `tsMinute`（YYYY-MM-DD HH:MM）
- `src/commands/index.ts`：2 处 `pad/getUTCFullYear/...` 拼接 → `dateToYMDUtc(d)` / `dateToYMDLocal(mtime)`
- `src/commands/audit.ts`：`pad`+`tsFile`+`tsFm` 4 行 → `tsCompact(now)` + `tsMinute(now)`
- tag：`refactor-batch-8`

**为什么**

- LEGACY P1-2 (a)：日期 helper 散落在 6 个文件，先把 init/index/audit 这一组迁掉
- **发现并未处理**：`init.ts` 计划里列了，但实际只有 `Date.now()`（数字时间戳），没有日期格式化代码。**实际改动 = index.ts + audit.ts 两处**。计划文档里 init.ts 是误列；明早先生可在 LEGACY 备注下

**接下来**

- 进批次 9：snapshot.ts + ingest.ts 的 date 迁移

---

## 2026-04-19 — 批次 7：paths.ts 迁 commands/{index,lint,snapshot,doctor}.ts（P1-1 c）

**做了什么**

- `src/lib/paths.ts`：追加 `indexExcludeDirPrefixes` / `isIndexExcluded` / `isFolderPackage` / `lintSkipFrontmatterBasenames` / `lintRootOnlySkipBasenames` / `lintSkipOrphanPrefixes` / `lintSkipFrontmatterPrefixes` / `snapshotExcludeNames`
- `src/commands/index.ts`：删 `INDEX_EXCLUDE_DIR_PREFIXES` / `isIndexExcluded` / `isFolderPackage` 定义，删 2 个内部别名 `EXCLUDE_DIR_PREFIXES` / `isExcluded`，全部改 import
- `src/commands/lint.ts`：删 4 个 local set，改 import
- `src/commands/snapshot.ts`：删函数内 local `EXCLUDE`，改 `snapshotExcludeNames` import
- `src/commands/doctor.ts`：import 源从 `./index.js` 改为 `../lib/paths.js`
- tag：`refactor-batch-7`
- **CONVENTIONS Do Not #11 正式生效** —— 后续不许再硬编码新的"排除目录"集合

**为什么**

- LEGACY P1-1 (c)：把所有"排除规则"集中在 paths.ts 是 P1-1 的最后一步。完成后加新顶层目录只改一个文件
- 函数 `isIndexExcluded` / `isFolderPackage` 也搬过去：它们是路径判定 helper，按职责归属属于 paths.ts；commands/index.ts 之前 export 它们就是为给 doctor.ts 用的，跨命令共享应该走 lib/

**接下来**

- 进批次 8：建 `lib/date.ts` + 迁 commands sweep 1（init / index / audit）

---

## 2026-04-19 — 批次 6：paths.ts 迁 vectordb.ts 常量（P1-1 b）

**做了什么**

- `src/lib/paths.ts`：追加 `vectorIncludeDirs` / `vectorExcludePrefixes` / `vectorExcludeNames`
- `src/lib/vectordb.ts`：删 3 个 local const，import 自 paths.ts；同步更新 1 处 stale 注释
- tag：`refactor-batch-6`

**为什么**

- LEGACY P1-1 (b)：vectordb.ts 是 P0-1 待拆，但常量迁移行为等价，先把这块单独完成
- `vectorExcludeNames` 故意不含 `_INDEX.md`（vs `alwaysExcludeNames`），严格保留迁移前行为；语义差别记在 paths.ts 注释里，留给批次 22 拆 vectordb 时再审视

**接下来**

- 进批次 7：迁 commands/{index,lint,snapshot}.ts 到 paths.ts，**完成后 CONVENTIONS Do Not #11 正式生效**

---

## 2026-04-19 — 批次 5：建 lib/paths.ts + 迁 corpus.ts EXCLUDE_NAMES（P1-1 a）

**做了什么**

- 新建 `src/lib/paths.ts`：导出 `alwaysExcludeNames`（`.gitkeep` / `.DS_Store` / `_INDEX.md`）；约定后续命名空间 `vectorInclude*` / `vectorExclude*` / `lintSkip*` / `indexExclude*` / `snapshotExclude*`，由批次 6 / 7 追加
- `src/lib/corpus.ts`：删 `const EXCLUDE_NAMES = new Set(...)`，改 `import { alwaysExcludeNames } from './paths.js'`
- tag：`refactor-batch-5`

**为什么**

- LEGACY P1-1：4-5 套独立维护的 exclude 集合，加新顶层目录易漏改某处。先建集中入口，再分批迁移
- 本批只迁 corpus.ts 一处（最简单的入口）。CONVENTIONS Do Not #11 在批次 7 收尾后才"正式生效"

**接下来**

- 进批次 6：迁 vectordb.ts 的 INCLUDE_DIRS / EXCLUDE_PREFIXES / EXCLUDE_NAMES 到 paths.ts

---

## 2026-04-19 — 批次 4：cli.ts banner 静态 import 替换 ESM require（P1-6）

**做了什么**

- 5e778c7 refactor(cli): banner 用静态 import 替换 ESM require — 3 处 `require(...)` 改顶部静态 import：`existsSync` from node:fs、`Database` from better-sqlite3、`collectMdFiles` from ./lib/corpus.js
- 副作用：better-sqlite3 类型暴露后 `.get()` 返回值需要显式 cast，加了 2 处 `as { c: number } | undefined` / `as { value: string } | undefined`（不是 `as any`，符合 CONVENTIONS Do Not #4）
- tag：`refactor-batch-4`
- verify 全绿；手动 `node dist/cli.js` banner 输出正常（corpus / pages / indexed / model 字段都对）

**为什么**

- LEGACY P1-6 + B1：ESM 文件里 `require()` 是巧合可跑，tsup bundle 后 `./lib/corpus.js` 相对路径在单文件 bundle 中可能解析不到。属于"基础设施级"风险
- 静态 import 让 better-sqlite3 在 lorekit 任何子命令启动时都加载（哪怕 `--version`），但 better-sqlite3 启动开销小（< 50ms），可接受

**接下来**

- 进批次 5：建 `lib/paths.ts` 骨架 + 迁 `corpus.ts` 的 `EXCLUDE_NAMES`（P1-1 a）

---

## 2026-04-19 — 批次 3：ESLint 9 + Prettier 3 配置 + 全仓 initial format

**做了什么**

- d5a5da0 chore(lint): 引入 ESLint 9 flat config + Prettier 3（批次 3 config）— 装 devDeps、写 `eslint.config.js` / `.prettierrc.json` / `.prettierignore`、加 `lint` / `lint:fix` / `format` / `format:check` 4 个 script
- 0420a94 style: 全仓跑一次 prettier 做 initial format（批次 3 format）— 42 文件机械 reformat（+1096 / -1085），verify 前后均绿
- d4a8460 chore: 加 .git-blame-ignore-revs 让 blame 跳过批次 3 format commit
- tag：`batch-3-config`、`batch-3-format`
- lint baseline 132 problems（110 errors + 22 warnings）：101 no-console + 22 no-unused-vars + 3 no-require-imports（cli.ts ESM require）+ 3 prefer-const + 2 no-explicit-any + 1 ban-ts-comment

**为什么**

- 先生选 A：现在一次性 reformat 干净，避免 P0 拆 vectordb / fetcher 时混进 540+ 行格式噪声
- `verify` chain 严守 `tsc + build + smoke`，**不加 lint**（先生硬约束）：lint 进 chain 会让 P2 sweep 完成前每批都红，安全网失效
- `.git-blame-ignore-revs` 让 GitHub blame 自动跳过 format commit；本地 `git config blame.ignoreRevsFile .git-blame-ignore-revs` 启用

**接下来**

- 进批次 4：cli.ts `showBanner()` 内 ESM require → 静态 import（P1-6）

---

## 2026-04-19 — 批次 0：修复 verify pipeline 前置阻塞（P1-7 / P1-8）

**做了什么**

- `src/lib/corpus.ts`：`Frontmatter.updated` 类型从 `string` 放宽到 `string | Date`（gray-matter 解析 YAML 日期返回 Date，`commands/index.ts:77` 的 `instanceof Date` 检查在 TS 层面终于成立）
- `src/commands/init.ts`：`const resolved = join(process.cwd(), targetPath)` → `resolve(targetPath)`，并在 import 加 `resolve`。修掉 `lorekit init <绝对路径>` 把绝对路径当相对路径拼接的 bug
- 跑 `npm run verify` → 全绿（tsc → build → smoke 13 通过 / 1 跳过 / 0 失败，~3s）
- LEGACY.md 把 P1-7 / P1-8 标 ✅
- REFACTOR-PLAN.md 同步：批次 2 标已完成（被本批替代）；批次 14 合并 (a/b/c 子批撤掉)；批次 18 (CI) 标可选 / 推迟到重构稳定后单独 session

**为什么**

- 批次 1 (smoke + verify 落地) 上一轮交付后跑 `npm run verify`，tsc 步骤直接挂在 `commands/index.ts:77`。这是已存在的源码类型不一致，不是 smoke 引入的，但加 verify 后第一次显形
- P1-8 是写 smoke 时撞到：`lorekit init /tmp/xxx` 默默在 `<cwd>/tmp/xxx` 创建文件，smoke 只能用 `cd $tmpdir && init .` 绕过。属于"会让用户数据走错位置"的 bug，跟 P1-7 一起一次修掉省得回头
- "本轮只动 P1-7 / P1-8 两处 src" —— 批次 1 (smoke + verify) 的产物本身就要求这两处不能挂，所以这两处不算违反"Step 4 不动 src"

**接下来**

- 进批次 3：ESLint + Prettier 配置（见 REFACTOR-PLAN.md）

---

## 2026-04-19 — 立规矩：补 docs/

**做了什么**

- 生成 `docs/CODEBASE-MAP.md` / `ARCHITECTURE.md` / `CONVENTIONS.md` / `LEGACY.md` / `WORKLOG.md`
- 重写 `AGENTS.md`：保留安装 / 使用入口给"用 lorekit 的 AI"，新增"贡献者文档"区段 include 上述 5 份给"改 lorekit 的 AI"
- 重写 `CLAUDE.md`：一行 `@./AGENTS.md` 转发，避免双份维护

**为什么**

- 项目从临时脚本演化成工具，风格漂移已经看得见（5 套 exclude 列表、4 套日期 helper、bilingual 注释、巨型文件 vectordb 1115 行 / fetcher 848 行）
- 想从今天起新代码按规范来，老代码暂不动；先把"规范"写下来才有可执行性
- 全面重构方向已定，所以 LEGACY 写成 punch list 而非"暂不重构"清单

**接下来**

- 见 `LEGACY.md` P0 / P1 列表：先拆 vectordb / fetcher，配套建 `lib/paths.ts` / `lib/date.ts` / smoke test 框架
