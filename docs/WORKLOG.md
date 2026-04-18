# WORKLOG.md — lorekit 工作日志

> append-only。最新条目在最上方。
> 不反推历史 commit；这份日志从 2026-04-19 开始。
> 每条格式：`## YYYY-MM-DD — 标题` + 三段（做了什么 / 为什么 / 接下来）。

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
