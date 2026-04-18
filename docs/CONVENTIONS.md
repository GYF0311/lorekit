# CONVENTIONS.md — lorekit 编码与协作规范

> 本文是硬规范。任何对本仓库的修改（人或 AI Agent）都必须遵守。
> "Do Not 红线"违反一律退回，没有例外谈判。

## 1. 注释与语言

- 注释**以中文为主**。技术术语、API 名、库名、缩写保留英文原文（如 `await import()`、`BM25`、`RRF`）
- 文档面向 AI Agent 时也用中文，跨 agent 一致

## 2. 日志输出

- 所有输出**统一走 `src/utils/logger.ts`**
- 禁止 `console.log` / `console.error` 直接调用，禁止裸 `chalk.xxx()` 输出
- 当前 logger 导出：`ok` / `bad` / `warn` / `err`。需要 `info` / `debug` 等新等级，先在 logger.ts 加，再调用

## 3. stdout / stderr 分流

| 内容 | 通道 |
|---|---|
| JSON、数据结构、机器可读结果 | **stdout** |
| 进度提示、错误说明、人类信息 | **stderr** |

CLI 命令必须支持 `lorekit xxx | jq` 这种管道用法。所有人类信息（`ok` / `bad` / `warn` / `err` / `info`）统一走 stderr，stdout 只留给机器可读输出。`logger.bad` 当前写 stdout 是 bug，已列入 LEGACY P1-3 一并修正。

## 4. 退出码

| code | 含义 |
|---|---|
| `0` | 成功 |
| `1` | 运行时错误（fetch 失败、文件读不到、外部命令崩了） |
| `2` | 参数或用法错误（缺必传、值非法） |

`process.exit(N)` 和 `process.exitCode = N` 二选一即可，单条命令内统一一种风格。

## 5. 错误处理

- **禁止沉默 catch**（`catch {}` 或 `catch { /* ignore */ }`）
- 必须至少 `logger.warn(...)` + 一行注释说明为什么可以继续
- 范例：
  ```ts
  try {
    optionalFeature();
  } catch (e) {
    logger.warn(`feature unavailable: ${(e as Error).message}`);
    // 可选依赖缺失时降级到默认路径，不阻塞主流程
  }
  ```

## 6. 类型逃生

- 禁止裸 `as any` → 改用 `as unknown as X` + 原因注释
- 禁止 `@ts-ignore` → 改用 `@ts-expect-error` + 原因注释（编译器会校验注释是否仍必要，避免烂在代码里）
- 范例：
  ```ts
  // @ts-expect-error — playwright-core 是可选依赖，类型可能未安装
  const pw = await import('playwright-core');
  ```

## 7. 文件大小

- 单文件**硬上限 500 行**
- 新代码 + 重构后的老代码都遵守
- 当前 `lib/vectordb.ts`（1115 行）、`lib/fetcher.ts`（848 行）超标，已列入 `LEGACY.md` 待拆

## 8. ESM 一致性

- 全仓库 `"type": "module"`，**禁止在 `.ts` 文件里出现 `require()`**
- 动态加载用 `await import(...)`
- Node 标准库（`node:fs` / `node:path` 等）请在文件顶部静态 import，不要在函数里 `await import('node:fs')`

## 9. Commit 信息

- 用 [Conventional Commits](https://www.conventionalcommits.org/)
- 允许的 type：`feat` / `fix` / `refactor` / `docs` / `chore` / `perf` / `test` / `build` / `ci`
- subject ≤ 50 字符（不含 `type(scope):` 前缀）
- body 写**为什么**这么改，不写"做了什么"（diff 已经说明做了什么）
- 范例：
  ```
  refactor(vectordb): 抽出 layered query 到独立模块

  原 vectordb.ts 单文件 1115 行，触发 CONVENTIONS Do Not #12。
  L0/L1/L2 三层查询逻辑独立性强，先拆出来。
  ```

## 10. 依赖管理

- 加 runtime `dependency` 必须在 PR 描述写明：
  1. 为什么需要
  2. 评估过的替代方案（包括手写实现）
- `devDependencies` 自由
- `optionalDependencies` 用于"装了更好、不装也能跑"的库（如 `sqlite-vec`）

## 11. 验证脚本

`npm run verify` 必须 60 秒内跑完，包含：
1. `tsc --noEmit` — 类型检查
2. `npm run build` — tsup 构建
3. `npm run test:smoke` — 烟雾测试

测试框架用 **`node:test`**（Node 18+ 内置，零依赖，符合 Do #10 的依赖保守原则）。后续若真需要 watcher / snapshot / fixture 等高级功能再考虑升级到 vitest，smoke test 不需要。

新命令必须配套写 smoke test（覆盖 happy path + 一个错误路径即可）。

---

## Do Not 清单（红线，违反一律退回）

| # | 红线 | 说明 / 替代方案 |
|---|---|---|
| 1 | ❌ ESM 文件里用 `require()` | 用 `await import()` |
| 2 | ❌ 直接 `console.log` / `console.error` / `chalk.xxx()` 输出 | 统一走 `utils/logger.ts` |
| 3 | ❌ 沉默 catch（`catch {}` 或 `catch { /* ignore */ }`） | 至少 `logger.warn(...)` + 注释 |
| 4 | ❌ 裸 `as any` 或 `@ts-ignore` | 用 `as unknown as X` / `@ts-expect-error` + 原因 |
| 5 | ❌ 改 `.env` | 只能改 `.env.example` |
| 6 | ❌ 手动改 `dist/` | 跑 `npm run build` |
| 7 | ❌ 手动改 `VERSION` | 用 `npm version <patch\|minor\|major>` |
| 8 | ❌ 动中文目录名硬编码（`'原料'` / `'知识库'` / `'_工作台'` 等） | 这是 schema 设计决定，不是技术债，**不许"清理"** |
| 9 | ❌ 给 `lib/vectordb.ts` 继续加代码 | 必须先拆；拆完后此条由 #12 接管 |
| 10 | ❌ 写不带 smoke test 的新命令 | 至少覆盖 happy path |
| 11 | ❌ 硬编码新的"排除目录"常量 | 统一用 `lib/paths.ts`（此条在 `lib/paths.ts` 创建后生效，见 LEGACY.md P1） |
| 12 | ❌ 单文件超过 500 行 | 拆 |
