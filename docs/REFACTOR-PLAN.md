# REFACTOR-PLAN.md — lorekit 重构批次计划

> 基于 `LEGACY.md` 的 P0/P1/P2/P3/P4 清单。原始编号 22 批；当前 **2 批已完成（1 + 2）+ 1 批可选推迟（18）+ 19 批主线待做** = **20 批主线**。
> 排序原则：**P1 基础设施先 → P2 批量修整（有 smoke 兜底）→ P3/P4 杂项 → P0 拆库（最后做，前面越稳后面越安心）**。
>
> 每批：≤ 5 文件（个别允许超并标注），单一逻辑单元，结尾必跑 `npm run verify`。
>
> 编号保持 1-22 稳定不变（用于跨文档引用），不做 renumber。状态见"已完成 / 可选"标记。

## 总览

| # | 标题 | LEGACY | 风险 | 估时 | 依赖 |
|---|---|---|---|---|---|
| ✅ 1 | smoke + verify 落地 | P1-4 | 低 | — | — |
| ✅ 2 | tsc 解锁 + init 绝对路径修（作为"批次 0"在批次 1 之后立刻完成） | P1-7, P1-8 | 低 | — | 1 |
| 3 | ESLint + Prettier 配置 | P1-5 | 低 | 1h | 1 |
| 4 | cli.ts ESM `require()` 修 | P1-6 | 低 | 30m | 1, 2 |
| 5 | 建 lib/paths.ts + 迁 corpus.ts | P1-1 (a) | 低 | 1h | 2 |
| 6 | paths.ts 迁 vectordb.ts 常量 | P1-1 (b) | 中 | 30m | 5 |
| 7 | paths.ts 迁 commands/{index,lint,snapshot} | P1-1 (c) | 中 | 1h | 5 |
| 8 | 建 lib/date.ts + 迁 commands sweep 1 | P1-2 (a) | 低 | 1h | 2 |
| 9 | date.ts sweep 2 | P1-2 (b) | 低 | 30m | 8 |
| 10 | logger.ts 加等级 + bad → stderr | P1-3 | 中 | 1h | 1 |
| 11 | P2 sweep — 沉默 catch | P2-2 | 低 | 1.5h | 10 |
| 12 | P2 sweep — as any / @ts-ignore | P2-3 | 低 | 1h | 3, 10 |
| 13 | P2 sweep — console → logger（cli + 简单 commands） | P2-4 (a) | 中 | 1.5h | 10 |
| 14 | P2 sweep — console → logger（其余 9 个 commands，**单批合并**） | P2-4 (b) | 中 | 2-3h | 13 |
| 15 | P2 杂项（vector.ts 静态 import + 退出码 + eslint disable 删） | P2-1, P2-5, P2-6 | 中 | 1h | 3, 10 |
| 16 | P3 文档 sweep（README + integrations + 根 .wiki） | P3-1, P3-2, P3-3 | 低 | 30m | — |
| 17 | P3 commands/index.ts rename + NaN 守卫 | P3-4, P3-5 | 中 | 1h | 7 |
| 🅾️ 18 | P3 dist/CI 校验（**可选 / 推迟**：本轮重构暂不做，重构稳定后单独 session） | P3-6, P3-7 | 中 | 1.5h | — |
| 19 | P4 已知小项（B3/B4/B5/B6） | P4-2, P4-3, P4-5 | 低 | 1h | 10 |
| 20 | P4 待验证（B2 ingest variadic） | P4-1 | 待定 | 1h | 1 |
| 21 | **P0-2 拆 fetcher.ts**（含 P4-4） | P0-2, P4-4 | 高 | 4-6h | 5, 9, 10, 11, 12, 14 |
| 22 | **P0-1 拆 vectordb.ts** | P0-1 | 极高 | 6-8h | 6, 11, 12, 13, 14, 15, 21 |

总估时 ~30h（不含批次 18，因为推迟）。**可并行**：3 ‖ 4 ‖ 5 ‖ 8 ‖ 10 ‖ 16 ‖ 20（依赖只到批次 1 或 2 即可，且这两个已 ✅）。

---

## ✅ 批次 1：smoke + verify 落地（已完成 2026-04-19）

- 对应 LEGACY 条目：P1-4
- 风险等级：低
- 改的文件：`tests/smoke/_util.mjs`、`tests/smoke/cli-meta.test.mjs`、`tests/smoke/corpus.test.mjs`、`package.json`
- 改什么：用 `node:test`（CONVENTIONS #11 锁定）覆盖 13 条 smoke；加 `test:smoke` / `verify` script
- 验证结果：13 tests / 12 pass / 1 skip（sqlite-vec 已装条件跳）/ ~1.5s

---

## ✅ 批次 2：tsc 解锁 + init 绝对路径修（已完成 2026-04-19，作为"批次 0"提前做）

- 对应 LEGACY 条目：✅ P1-7（`Frontmatter.updated` 类型放宽）+ ✅ P1-8（`init.ts` 用 `path.resolve`）
- 风险等级：低
- 实际改的文件：`src/lib/corpus.ts`、`src/commands/init.ts`（共 3 处编辑：1 类型字段 + 1 import + 1 调用）
- 验证结果：
  - `npm run verify` 全绿，~3s（tsc + build + smoke 全过）
  - 手动：`lorekit init /tmp/xxx` 在正确的 `/tmp/xxx` 下创建文件
- 备注：当时仅放宽了 `updated`，未碰 `created`（无 `instanceof Date` 调用，类型不报错）。新发现 bug P1-8 也一并完成
- **待补**（不阻塞后续）：smoke 没新增"用绝对路径 init"的断言。可以在任何后续 P3 / P4 批次顺手加

---

## 批次 3：ESLint + Prettier 配置

- 对应 LEGACY 条目：P1-5
- 风险等级：低（仅配置，零行为改动）
- 改的文件：`.eslintrc.cjs`（new）、`.prettierrc.json`（new）、`.editorconfig`（new）、`package.json`（devDeps + `lint` / `format` scripts）
- 改什么：eslint + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`；规则覆盖 `no-console`（除 logger.ts）、`no-explicit-any`、`no-empty`（catch 不许空）、`@typescript-eslint/ban-ts-comment`（禁 `@ts-ignore`，允许带注释的 `@ts-expect-error`）
- **硬约束（先生 2026-04-19 决）**：`package.json` 的 `verify` script 保持 `tsc --noEmit && npm run build && npm run test:smoke`，**不加 `&& npm run lint`**。理由：lint 进 verify 后 P2 sweep 完成前每批都红，安全网失效。lint 是独立 script，重构期间 AI / 先生手动跑，不自动阻断
- 依赖批次：1
- 验证：
  - `npm run lint` 跑出当前所有违反点（**预期会列一大堆**——这就是 P2 sweep 的 input）
  - `npm run verify` 仍全绿（lint 不在 chain 里）
- 估时：1h

---

## 批次 4：cli.ts ESM `require()` 修

- 对应 LEGACY 条目：P1-6
- 风险等级：低
- 改的文件：`src/cli.ts`
- 改什么：`showBanner()` 里 3 处 `require(...)` 改成顶部 `import { existsSync } from 'node:fs'` + `import Database from 'better-sqlite3'`；`require('./lib/corpus.js')` 改成顶部 `import { collectMdFiles }`（已存在）
- 依赖批次：1, 2
- 验证：
  - smoke `lorekit --version` / `lorekit --help` 必过
  - 手动 `lorekit`（无参）输出 banner 含 corpus 路径、pages、indexed
- 估时：30m

---

## 批次 5：建 lib/paths.ts + 迁 corpus.ts

- 对应 LEGACY 条目：P1-1 (a)
- 风险等级：低
- 改的文件：`src/lib/paths.ts`（new）、`src/lib/corpus.ts`
- 改什么：`paths.ts` 导出语义化的常量集合：`alwaysExcludeNames`（`.gitkeep` `.DS_Store` `_INDEX.md`）+ 后续会扩展的其他 set。corpus.ts 的 `EXCLUDE_NAMES` 改 import
- 依赖批次：2
- 验证：
  - smoke 全过（corpus 发现 + collectMdFiles 是 smoke 走过的核心路径）
- 估时：1h

---

## 批次 6：paths.ts 迁 vectordb.ts 常量

- 对应 LEGACY 条目：P1-1 (b)
- 风险等级：中（vectordb.ts 是 P0-1 待拆，但仅常量迁移行为等价）
- 改的文件：`src/lib/vectordb.ts`、`src/lib/paths.ts`（追加 `vectorIncludeDirs` / `vectorExcludePrefixes`）
- 改什么：vectordb.ts 的 `INCLUDE_DIRS` / `EXCLUDE_PREFIXES` / `EXCLUDE_NAMES` 抽到 paths.ts，vectordb.ts import
- 依赖批次：5
- 验证：
  - smoke `lorekit vector status` 正常
  - 手动：`lorekit vector sync` → 比迁移前的 indexed_files 计数一致
- 估时：30m

---

## 批次 7：paths.ts 迁 commands/{index, lint, snapshot}

- 对应 LEGACY 条目：P1-1 (c) — **完成后 CONVENTIONS Do Not #11 正式生效**
- 风险等级：中
- 改的文件：`src/commands/index.ts`、`src/commands/lint.ts`、`src/commands/snapshot.ts`、`src/lib/paths.ts`（追加）
- 改什么：
  - `INDEX_EXCLUDE_DIR_PREFIXES` → paths.ts
  - `SKIP_FRONTMATTER_PREFIXES` / `SKIP_ORPHAN_PREFIXES` / `SKIP_FRONTMATTER_BASENAMES` / `ROOT_ONLY_SKIP_BASENAMES` → paths.ts
  - snapshot.ts 的 `EXCLUDE` → paths.ts 的 `snapshotExcludeNames`
  - 同时 `doctor.ts` 现在 import 自 commands/index.ts 的 `isIndexExcluded` / `isFolderPackage` —— 这两个函数也搬到 paths.ts
- 依赖批次：5
- 验证：
  - smoke `doctor` / `lint` / `index` / `snapshot` 全过
  - 手动：lint 在一个有真实问题的 corpus 上跑，issue 数与迁移前一致
- 估时：1h

---

## 批次 8：建 lib/date.ts + 迁 commands sweep 1

- 对应 LEGACY 条目：P1-2 (a)
- 风险等级：低
- 改的文件：`src/lib/date.ts`（new）、`src/commands/init.ts`、`src/commands/index.ts`、`src/commands/audit.ts`
- 改什么：date.ts 导出 `todayYMD()` / `nowISO()` / `tsFile()`（snapshot 用的紧凑时间戳）/ `padDate()` 等；3 个 command 文件里的 `pad()` / `today()` / 手写日期格式化全部 import
- 依赖批次：2
- 验证：
  - smoke `init` / `index` / `audit --create` 全过
  - 手动：`lorekit audit --create --target xxx --severity low --text "y"` 文件名时间戳格式跟之前一致
- 估时：1h

---

## 批次 9：date.ts sweep 2

- 对应 LEGACY 条目：P1-2 (b)
- 风险等级：低
- 改的文件：`src/commands/snapshot.ts`、`src/commands/ingest.ts`
- 改什么：snapshot.ts 的 stamp 拼接 + ingest.ts 的 `today()` 全部走 date.ts
- 依赖批次：8
- 验证：smoke `snapshot` 过；手动 `lorekit ingest record xxx --step archive --log "test"` log.md 时间戳格式一致
- 估时：30m
- 备注：`fetcher.ts` 内的 `todayYMD` / `tsToYMD` / `normalizeDateText` **不在本批**，留给批次 21 拆 fetcher 时一起做

---

## 批次 10：logger.ts 加等级 + bad → stderr

- 对应 LEGACY 条目：P1-3
- 风险等级：中（输出通道改变，所有现有 caller 受影响）
- 改的文件：`src/utils/logger.ts`
- 改什么：
  - 加 `info(msg)` / `debug(msg)`；debug 受 `LOREKIT_DEBUG=1` 控制
  - **`bad` 从 stdout 改 stderr**（与 CONVENTIONS #3 对齐）
  - 加一行注释说明每个函数的通道
- 依赖批次：1
- 验证：
  - smoke 全过（断言里没有依赖 bad 在 stdout 的，已确认）
  - 手动 `lorekit doctor` 输出仍正常着色
  - 手动 `lorekit doctor 2>/dev/null` 应只剩 JSON 部分（如果有）/ 啥都没有（doctor 全是人类输出）
- 估时：1h

---

## 批次 11：P2 sweep — 沉默 catch

- 对应 LEGACY 条目：P2-2
- 风险等级：低
- 改的文件：`src/cli.ts`、`src/lib/corpus.ts`、`src/lib/root-index.ts`、`src/commands/stats.ts`、`src/utils/fs.ts`
- 改什么：所有 `catch { /* ignore */ }` / `catch {}` 改为 `catch (e) { logger.warn(...) }` + 注释说明为什么可继续
- 依赖批次：10（要用 `logger.warn`）
- 备注：`fetcher.ts` / `vectordb.ts` 内的沉默 catch 留给批次 21 / 22 拆库时一起处理（避免在待拆文件上反复改）
- 验证：smoke 全过；手动跑一次 `lorekit stats` 确认无新警告噪声
- 估时：1.5h

---

## 批次 12：P2 sweep — as any / @ts-ignore

- 对应 LEGACY 条目：P2-3
- 风险等级：低
- 改的文件：`src/commands/ingest.ts`（`patch.status = opts.status as any`）+ 视 ESLint 报告补充
- 改什么：
  - ingest.ts 的 `as any` 改 `as IngestStatus`（先校验值在枚举内，否则报参数错 exit 2）
- 依赖批次：3, 10
- 备注：`vectordb.ts` 的 `Db = any` 与 `fetcher.ts` 的 `@ts-ignore` 留给批次 21 / 22
- 验证：smoke 全过；ESLint 在剩余文件上无 `no-explicit-any` 违反（vectordb / fetcher 例外标 `// eslint-disable` 临时）
- 估时：1h

---

## 批次 13：P2 sweep — console → logger（cli + 简单 commands）

- 对应 LEGACY 条目：P2-4 (a)
- 风险等级：中（输出格式改变可被脚本调用方感知）
- 改的文件：`src/cli.ts`（banner 大量 console.log + chalk）、`src/commands/init.ts`、`src/commands/doctor.ts`、`src/commands/sync.ts`
- 改什么：所有 `console.log` / `console.error` / 直接 `chalk.xxx()` 改 `logger.{ok,bad,warn,err,info}`；保持 stdout/stderr 分流（CONVENTIONS #3）
- 依赖批次：10
- 验证：smoke `init` / `doctor` / `sync` 退出码 / JSON 输出不变；手动 `lorekit` 无参 banner 视觉一致
- 估时：1.5h

---

## 批次 14：P2 sweep — console → logger（其余 commands，**单批合并**）

- 对应 LEGACY 条目：P2-4 (b)
- 风险等级：中
- 改的文件：`src/commands/{snapshot,restore,audit,stats,vector,search,ingest,index,lint}.ts`（**9 文件，超 5 行红线**）
- 改什么：同批次 13；机械替换 `console.log` / `console.error` / 直接 `chalk.xxx()` 为 `logger.{ok,bad,warn,err,info}`
- **不拆子批**（先生 Q2 决定）：console→logger 是机械替换、单文件改动小，9 文件合并一次 review 更清晰；中间状态"有的用 logger 有的用 console"反而更混乱。拆批原则是"隔离风险"，不是"让 PR 看起来小"
- 依赖批次：13
- 验证：跑 smoke 全套；对应命令 JSON 输出严格不变（用 jq 比对 stats / vector status 关键字段）
- 估时：2-3h

---

## 批次 15：P2 杂项（vector.ts 静态 import + 退出码 + eslint disable 删）

- 对应 LEGACY 条目：P2-1, P2-5, P2-6
- 风险等级：中（退出码改变可能影响 shell 脚本调用方）
- 改的文件：`src/commands/vector.ts`（query action 内的 `await import('node:fs')` / `'node:path')` 提到顶部）+ 各 `process.exit(1)` / `process.exit(2)` / `process.exitCode = 1` 按 CONVENTIONS #4 重排（参数错→2、运行时→1）+ `src/lib/vectordb.ts` 顶部 `eslint-disable-next-line` 删除（如批次 3 的 ESLint 规则已覆盖此处）
- 依赖批次：3, 10
- 验证：
  - smoke 错误路径：`install-skills` 仍 exit 2；`fetch` 缺 URL 应改为 exit 2（commander `exitOverride`），smoke 加一条断言
  - tsc + lint 全绿
- 估时：1h

---

## 批次 16：P3 文档 sweep

- 对应 LEGACY 条目：P3-1, P3-2, P3-3
- 风险等级：低
- 改的文件：`README.md`（版本 0.2.0 → VERSION 实值）、`integrations/claude-code/install.sh` & `uninstall.sh`（删 or 改 exec lorekit install-skills）、`.gitignore`（加 `/.wiki/` 根级排除）
- 依赖批次：—
- 验证：smoke 不受影响；`git status` 干净
- 估时：30m

---

## 批次 17：P3 commands/index.ts rename + NaN 守卫（**单批合并**）

- 对应 LEGACY 条目：P3-4, P3-5
- 风险等级：中（rename 影响 import）
- 改的文件：`src/commands/index.ts` → `src/commands/dir-index.ts`（git mv）、`src/cli.ts`（import 改名）、`src/commands/sync.ts`（import 改名）、`src/commands/doctor.ts`（如还 import）、`src/commands/fetch.ts`（NaN 守卫）、`src/commands/vector.ts`（NaN 守卫）（**6 文件，超 5 行**）
- **不拆子批**（先生 Q2 精神延伸到本批）：rename 与 NaN 守卫都是小风险独立修改，分开做 6 文件 review 反而碎。拆批原则是"隔离风险"，不是"让 PR 看起来小"
- 依赖批次：7
- 验证：smoke `index` / `sync` / `doctor` 全过；smoke 加一条 `vector query --top-k notanumber` 应 exit 2
- 估时：1h

---

## 🅾️ 批次 18：P3 dist / CI 校验（**可选 / 推迟**）

- 对应 LEGACY 条目：P3-6, P3-7
- 风险等级：中（CI 接入点）
- 状态：**本轮重构不做**（先生 Q4 决定）。理由：CI 与重构耦合容易互相干扰；本地 `npm run verify` 跑过就够。重构稳定（批次 22 收尾）后单独 session 配
- 改的文件：`.github/workflows/ci.yml`（new）、`package.json`（加 `verify:dist` script）
- 改什么：CI 在 PR 上跑 `npm run verify` + 校验"build 后 dist/ 与 commit 内容一致"
- 依赖批次：—（但 verify 全绿之后才有意义）
- 验证：开一个 PR 故意只改 src 不重 build → CI fail
- 估时：1.5h（推迟到独立 session）

---

## 批次 19：P4 已知小项（B3 / B4 / B5 / B6）

- 对应 LEGACY 条目：P4-2, P4-3, P4-5
- 风险等级：低
- 改的文件：`src/commands/snapshot.ts`（manifest 写 os.tmpdir() + try/finally）、`src/commands/restore.ts`（rmSync 加锁定注释 + 路径校验）、`src/commands/vector.ts`（path.relative 替换 string.replace）（**3 文件**）
- 依赖批次：10（snapshot 改动可能用 logger）
- 验证：smoke `snapshot` / `restore` 全过
- 估时：1h
- 备注：P4-4（fetcher 微信 picture/source）留给批次 21

---

## 批次 20：P4-1 待验证（B2 ingest variadic）

- 对应 LEGACY 条目：P4-1
- 风险等级：待定（先验证再决定）
- 改的文件：`tests/smoke/ingest-record.test.mjs`（new）+ 视情况 `src/commands/ingest.ts`
- 改什么：写一个 smoke 复现 `lorekit ingest record <url> --step archive,wiki --wiki-page a.md --wiki-page b.md` 的实际行为，看是否如预期（去重、append）
- 依赖批次：1
- 验证：smoke 自带断言
- 估时：1h

---

## 批次 21：P0-2 拆 fetcher.ts（含 P4-4 picture）

- 对应 LEGACY 条目：P0-2, P4-4
- 风险等级：**高**
- 改的文件：拆为：
  - `src/lib/fetcher/types.ts`（FetchResult / FetchOptions / ParsedDoc 等）
  - `src/lib/fetcher/frontmatter.ts`（共享的 frontmatter 拼装，去 4 份重复）
  - `src/lib/fetcher/images.ts`（downloadOneImage / downloadImages / sniffExt）
  - `src/lib/fetcher/web.ts`（generic + parseGeneric）
  - `src/lib/fetcher/weixin.ts`（含 P4-4 picture/source 修）
  - `src/lib/fetcher/gist.ts`
  - `src/lib/fetcher/github.ts`
  - `src/lib/fetcher.ts`（barrel：仅 re-export 三个 public 函数）
- **必须拆子批**：
  - 21a：types.ts + frontmatter.ts + images.ts（共享工具，原文件不动）
  - 21b：抽 web.ts（包括 fetchUrl 主入口）+ weixin.ts（含 P4-4）
  - 21c：抽 gist.ts + github.ts
  - 21d：fetcher.ts 收尾成 barrel；删除原文件冗余代码
- 依赖批次：5（paths）、9（date）、10（logger）、**11（沉默 catch 已清完——批次 11 明确把 fetcher 留到这里，所以拆出去的新文件不用再扫一遍 catch）**、12（as any 清理已就位）、14（console → logger 覆盖到 fetcher.ts 调用方）
- 验证：
  - smoke 不覆盖网络 fetch（默认）
  - **必须手动跑** `LOREKIT_SMOKE_ONLINE=1` 在线测试 + 4 种 URL fixtures（微信、wiki gist、github blob、generic 博客）
  - 加 `tests/smoke/fetcher.test.mjs` online-only：`LOREKIT_SMOKE_ONLINE=1 npm run test:smoke` 时跑 4 条
- 估时：4-6h

---

## 批次 22：P0-1 拆 vectordb.ts

- 对应 LEGACY 条目：P0-1
- 风险等级：**极高**
- 改的文件：拆为：
  - `src/lib/vectordb/types.ts`
  - `src/lib/vectordb/schema.ts`（DDL / vecDdl / FTS_DDL / openDb / 迁移 ALTER）
  - `src/lib/vectordb/sync-file.ts`（syncFile）
  - `src/lib/vectordb/query-flat.ts`
  - `src/lib/vectordb/query-layered.ts`
  - `src/lib/vectordb/query-bm25.ts`（含 sanitizeFtsQuery）
  - `src/lib/vectordb/query-hybrid.ts`（含 rrfMerge）
  - `src/lib/vectordb/build-layered-index.ts`（含 parseIndexSections / parseIndexEntries）
  - `src/lib/vectordb/status.ts`（getStatus / computeMode）
  - `src/lib/vectordb.ts`（barrel）
- **必须拆子批**：
  - 22a：types.ts + schema.ts + sync-file.ts（基础层）
  - 22b：query-flat.ts + query-layered.ts
  - 22c：query-bm25.ts + query-hybrid.ts（含 RRF）
  - 22d：build-layered-index.ts
  - 22e：status.ts
  - 22f：vectordb.ts 收尾成 barrel
- 依赖批次：6（paths 已迁完）、**11（沉默 catch 已清完——批次 11 明确把 vectordb 留到这里）**、12-15（其余 P2 在剩余文件已清，避免在此批反复改）、21（fetcher 拆完，开发节奏验证过）
- 验证：
  - smoke `vector status` 正常
  - **必须手动跑**：`lorekit sync` 完整跑（需 ollama）、`vector query --hybrid --text "<某词>"` 与拆分前结果一致（top-K 重合度 ≥ 80%）
  - 加 `tests/smoke/vector-flow.test.mjs` ollama-gated：检测 ollama 可用 + bge-m3 已 pull → 跑 sync + query 一遍
- 估时：6-8h

---

## 收尾汇总

### 风险最高的批次（重点盯）

1. **批次 22 (vectordb 拆)** — 极高，建议放最后；前面所有批次 commit 都干净后再开
2. **批次 21 (fetcher 拆)** — 高，无现成单元测试兜底，要靠 4 种 URL fixtures 手动验证
3. **批次 14 (console → logger 余下 commands)** — 中，但触面广，输出格式改变可能影响下游脚本

### 可并行的批次

批次 1 + 2 已 ✅，启动后立刻可同时开：
- **批次 3**（ESLint 配置）
- **批次 4**（cli.ts require 修）
- **批次 5**（建 lib/paths.ts + corpus.ts 迁移）
- **批次 8**（建 lib/date.ts + commands sweep 1）
- **批次 10**（logger.ts 升级）
- **批次 16**（README + integrations 杂项）
- **批次 20**（P4-1 ingest variadic 待验证）

P2 sweep（批次 11-15）在批次 10 完成后可分人 / 分机时段并行。

P0 拆库（21、22）必须串行，且 22 在 21 之后。

批次 18 (CI) 已推迟出本轮，不计入主线。

### 先生已决（2026-04-19）

1. **Q1 P1-7 / P1-8 立即修** → 已完成于"批次 0"（即批次 2 提前做掉）
2. **Q2 批次 14 不拆子批** → 已合并成单一批次 14
3. **Q3 P0 拆库的手动验证报告写进 WORKLOG.md**（不写进 PR 描述；WORKLOG 是长期记忆）
4. **Q4 批次 18 推迟** → 已标记可选，本轮主线不做
