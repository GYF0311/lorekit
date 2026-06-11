# CODEBASE-MAP.md — lorekit 仓库地图

> 仓库根：`/Users/gaoyifan/code/lorekit`
> GitHub：https://github.com/GYF0311/lorekit
> 当前版本：`0.4.0`（见 `VERSION`）

## 顶层布局

```
lorekit/
├── src/                    TypeScript 源码（约 7430 LoC，含 fetcher / integrations 子模块）
│   ├── cli.ts              CLI 入口 + 启动 banner + 命令注册
│   ├── commands/           16 个子命令实现
│   ├── lib/                核心库 + fetcher/ + integrations/ 子模块目录
│   └── utils/              通用 helper（fs / logger）
├── bin/                    npm bin shim（lorekit.js）
├── dist/                   tsup 构建产物（提交进 git，给免构建用户用）
├── skills/                 15 个 SKILL.md（wiki-* 项目级执行 skill + corpus-* 可选跨项目入口 skill）
├── plugins/obsidian-audit/ Obsidian 反馈插件
├── templates/default-corpus/ corpus 骨架（lorekit init 拷贝）
├── integrations/           thin shim 转发到 `lorekit install-skills`
├── docs/                   贡献者文档（本目录，含 INSTALLATION 模块组合指南）
├── tests/smoke/            18 个 node:test smoke 用例（npm run verify 跑）
├── AGENTS.md               AI Agent 项目入口
├── CLAUDE.md               一行 `@./AGENTS.md` 转发
├── README.md               用户向 README
├── VERSION                 版本号单一来源
├── package.json            npm manifest
├── tsconfig.json           TS 配置（strict / ES2022 / Node16）
├── tsup.config.ts          构建配置（esm bundle，外置 native deps）
├── eslint.config.js        ESLint 9 flat config
├── .prettierrc.json        Prettier 3 配置
└── .gitignore
```

## src/commands/ 详单

| 文件                | LoC | 职责                                                                                                              |
| ------------------- | --- | ----------------------------------------------------------------------------------------------------------------- |
| `init.ts`           | 189 | 初始化 corpus，部署 Obsidian 插件 + 批次 25 safe-write `.obsidian/graph.json`                                     |
| `stats.ts`          | 85  | 输出 corpus 统计 JSON                                                                                             |
| `search.ts`         | 133 | ripgrep 包装（有内置 fallback）；默认排除过程/系统区，显式 `--dir` 可查指定子目录                                   |
| `fetch.ts`          | 183 | URL 路由 → 调 fetcher 子模块，duplicate / in-progress 检测                                                        |
| `ingest.ts`         | 393 | ingest pipeline state machine：list / pending / record / check / forget / reconcile；`check` 复用 `lib/wikilinks.ts` 解析       |
| `links.ts`          | 470 | links closure：suggest / fix / stub / backlog / plain / plained；确定性收口断链，写 系统/missing-nodes.md + .wiki/links-state.json（plain 台账可恢复），原料/ 只读保护 |
| `dir-index.ts`      | 273 | 递归生成 `_INDEX.md`；复用 `paths.ts` 跳过 `skills/` / `node_modules/` 等工具目录                                  |
| `sync.ts`           | 171 | 一键链：dir-index → root index → doctor；`--json/--report` 输出步骤收据                                             |
| `doctor.ts`         | 501 | corpus 健康检查；human 输出 + `--json` 结构化报告 + 严格 `--section <name>` 检查；frontmatter 主指标按 durable layers 统计；默认跳过 inactive optional integrations |
| `lint.ts`           | 307 | frontmatter / 死链 / 孤岛页 / `知识库` 直链 `_工作台` source 扫描；死链解析复用 `lib/wikilinks.ts`；`--quick` 是 agent 自检兼容别名；已 backlog 的待建节点降级为 backlogged 不计入失败 |
| `audit.ts`          | 162 | 反馈条目 CRUD                                                                                                     |
| `snapshot.ts`       | 108 | tarball 备份                                                                                                      |
| `restore.ts`        | 170 | 从 tarball 恢复                                                                                                   |
| `install-skills.ts` | 202 | 可选安装 lorekit-managed skills 到 Claude Code、Codex 或当前项目；默认安装 `wiki-*` project workflows（排除 `wiki-daily`），`corpus-*` / `wiki-daily` 必须用 `--only` 显式选择；支持 `--dest`、`--only` 逗号列表与 copy/symlink |
| `obsidian-tune.ts`  | 120 | 批次 26：老用户升级一键应用 `.obsidian/graph.json` filter（默认检查 / `--write` 备份后写 / `--print` 管道用）     |
| `remove.ts`         | 466 | 安全移除 URL/路径：dry-run 影响报告，`--apply` snapshot → OS Trash → provenance 清理 → sync/lint                  |

## src/lib/ 详单

### 顶层 lib/ 文件

| 文件              | LoC | 职责                                                                                                                                                                       |
| ----------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paths.ts`        | 250 | **统一 exclude / include 路径常量 SSOT**；包含 `skills/`、`node_modules/` 工具目录边界、search 默认排除边界（CONVENTIONS Do Not #11）                                      |
| `root-index.ts`   | 196 | merge-refresh `corpus/index.md` 的受控分区                                                                                                                                 |
| `ingest-state.ts` | 147 | `.wiki/ingest-state.json` 读写，pipeline SSOT                                                                                                                              |
| `corpus.ts`       | 98  | corpus 发现 + frontmatter 提取；`collectMdFiles` 跳过全局工具目录                                                                                                          |
| `wikilinks.ts`    | 90  | **唯一的 wikilink 解析层 SSOT**：`buildWikiLinkIndex` + `resolveWikiLink`，对齐 Obsidian 相对/嵌入/素材语义；`lint` / `ingest check` / `links suggest` 共用（issue #18 去重） |
| `missing-nodes.ts` | 73 | 系统/missing-nodes.md 待建节点 backlog 的 SSOT helper；links backlog 写入、lint 读取降噪                                                                                   |
| `date.ts`         | 56  | 日期 helper：`pad2` / `dateToYMDUtc` / `tsCompact` 等                                                                                                                      |
| `obsidian.ts`     | 86  | 批次 26：graph.json 读写 helper（`getRecommendedFilter` / `readCorpusFilter` / `isFilterComplete`），`templates/default-corpus/.obsidian/graph.json` 是 filter 字符串 SSOT |

### `src/lib/fetcher/`（10 文件 1473 行，最大 180 行 — 批次 21 拆分产物）

| 文件               | LoC | 职责                                                          |
| ------------------ | --- | ------------------------------------------------------------- |
| `index.ts`         | 180 | `fetchUrl` 主入口 dispatcher + 4 个 public API barrel         |
| `types.ts`         | 77  | `FetchResult` / `FetchOptions` / `ParsedDoc` SSOT             |
| `frontmatter.ts`   | 111 | `buildFrontmatter()` 4 路由共用 frontmatter 拼装              |
| `helpers.ts`       | 98  | `slugify` / `resolveUrl` / `htmlToMarkdown` / 3 个日期 helper |
| `http.ts`          | 131 | `detectSite` / `buildHeaders` / `detectAntibot` / L1/L2 fetch |
| `images.ts`        | 172 | `sniffExt` / `downloadImages` / `rewriteMarkdownImages`       |
| `routes/web.ts`    | 98  | `parseGeneric` 通用 HTML parser                               |
| `routes/weixin.ts` | 164 | `parseWeixin` 微信公众号（含 P4-4 picture/source 修复）       |
| `routes/gist.ts`   | 180 | `fetchGist` GitHub gist                                       |
| `routes/github.ts` | 159 | `fetchGithubDoc` GitHub repo doc                              |

### `src/lib/integrations/`

| 文件               | 职责                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `process.ts`       | `spawn` 外部命令封装；不走 shell interpolation，捕获 stdout/stderr/exitCode/timeout                                                   |

## src/utils/ 详单

| 文件        | LoC | 职责                                                                                    |
| ----------- | --- | --------------------------------------------------------------------------------------- |
| `fs.ts`     | 31  | sha256 / mtime / lorekitRoot / readVersion                                              |
| `logger.ts` | 49  | `ok` / `bad` / `warn` / `err` / `info` / `debug` / `out` / `print` — 全仓库输出唯一入口 |

## 关键文件 Top 10（"动一行影响很广"）

按当前架构（v0.4.0 准备态）排序：

1. `src/cli.ts` — 加新命令必经，启动 banner + commander 注册 + exitOverride
2. `src/lib/corpus.ts` — corpus 发现 + Frontmatter 解析，所有命令的根
3. `src/lib/ingest-state.ts` — pipeline SSOT，ingest / fetch 都靠它判 duplicate / in-progress
4. `src/lib/paths.ts` — 全部 exclude / include 集合的 SSOT，加新顶层目录唯一改点
5. `src/lib/fetcher/index.ts` — 抓取主入口 dispatcher，4 路由 + buildFrontmatter 在此组合
6. `src/commands/ingest.ts` — state machine 对外 surface，最大单文件
7. `src/commands/sync.ts` — 把索引 / 体检串起来，复用 `runIndex` + `doctor`，并产出 agent-readable report
8. `src/commands/remove.ts` — 删除路径最敏感：只做来源归因级联，先 snapshot，再 OS Trash
9. `src/utils/logger.ts` — 全仓库输出统一入口（CONVENTIONS 强制，stdout/stderr 分流）

## 配置文件

| 文件               | 用途                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `tsconfig.json`    | strict TS，ES2022，Node16 模块解析                                                        |
| `tsup.config.ts`   | esm bundle 到 `dist/cli.js`                                                               |
| `package.json`     | scripts: `build` / `dev` / `verify` / `test:smoke` / `lint` / `format` / `prepublishOnly` |
| `eslint.config.js` | ESLint 9 flat config（no-console / no-explicit-any / no-empty / ts-expect-error 等）      |
| `.prettierrc.json` | Prettier 3 配置 + `.git-blame-ignore-revs` 跳过 batch-3 format commit                     |
| `.gitignore`       | 排除 `node_modules/` / 各处 `_INDEX.md` / `tmp/`                                          |
| `VERSION`          | 版本号单一事实源（cli 与 init 都从此读）                                                  |

## 外部依赖

| 包                | 类型       | 用途                                                        |
| ----------------- | ---------- | ----------------------------------------------------------- |
| `commander`       | runtime    | CLI 框架（含 exitOverride 统一退出码）                      |
| `chalk`           | runtime    | 颜色（**只能在 logger.ts 内用**）                           |
| `cheerio`         | runtime    | HTML 解析（fetcher/routes/）                                |
| `turndown`        | runtime    | HTML → markdown                                             |
| `gray-matter`     | runtime    | frontmatter 解析                                            |
| `tar`             | runtime    | snapshot / restore                                          |
| `trash`           | runtime    | 跨平台移动到 OS Trash / Recycle Bin；remove 不调用系统 `rm` |
| `playwright-core` | （未声明） | fetcher L2 fallback；动态 import，缺了就降级                |
