# WORKLOG.md — lorekit 工作日志

> append-only。最新条目在最上方。
> 不反推历史 commit；这份日志从 2026-04-19 开始。
> 每条格式：`## YYYY-MM-DD — 标题` + 三段（做了什么 / 为什么 / 接下来）。

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
