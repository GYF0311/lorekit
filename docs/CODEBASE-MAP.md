# CODEBASE-MAP.md — lorekit 仓库地图

> 仓库根：`/Users/gaoyifan/code/lorekit`
> GitHub：https://github.com/GYF0311/lorekit
> 当前版本：见 `VERSION` 文件（package.json 同步）

## 顶层布局

```
lorekit/
├── src/                    TypeScript 源码（约 4950 LoC）
│   ├── cli.ts              CLI 入口 + 启动 banner + 命令注册
│   ├── commands/           14 个子命令实现
│   ├── lib/                7 个核心库
│   └── utils/              通用 helper
├── bin/                    npm bin shim（lorekit.js）
├── dist/                   tsup 构建产物（提交进 git，给免构建用户用）
├── skills/                 6 个 wiki-* SKILL.md（Agent skill）
├── plugins/obsidian-audit/ Obsidian 反馈插件
├── templates/default-corpus/ corpus 骨架（lorekit init 拷贝）
├── integrations/           老安装脚本（疑似已被 install-skills 命令取代，见 LEGACY.md）
├── docs/                   贡献者文档（本目录）
├── AGENTS.md               AI Agent 项目入口
├── CLAUDE.md               一行转发到 AGENTS.md
├── README.md               用户向 README
├── VERSION                 版本号单一来源
├── package.json            npm manifest
├── tsconfig.json           TS 配置（strict / ES2022 / Node16）
├── tsup.config.ts          构建配置（esm bundle，外置 native deps）
└── .gitignore
```

## src/commands/ 详单

| 文件 | LoC | 职责 |
|---|---|---|
| `init.ts` | 149 | 初始化 corpus，部署 Obsidian 插件 |
| `doctor.ts` | 167 | 健康检查（目录、frontmatter 覆盖率、_INDEX.md） |
| `stats.ts` | 82 | 输出 corpus 统计 JSON |
| `search.ts` | 125 | ripgrep 包装（有内置 fallback） |
| `fetch.ts` | 173 | URL 路由 → 调 fetcher，duplicate / in-progress 检测 |
| `ingest.ts` | 380 | ingest pipeline state machine：list / pending / record / check / forget / reconcile |
| `index.ts` | 287 | 递归生成 `_INDEX.md`（**文件名歧义**，见 LEGACY） |
| `sync.ts` | 119 | 一键链：index → vector sync → doctor |
| `vector.ts` | 185 | 向量子命令：sync / query（flat / layered / bm25 / hybrid）/ status |
| `lint.ts` | 214 | frontmatter / 死链 / 孤岛页扫描 |
| `audit.ts` | 146 | 反馈条目 CRUD |
| `snapshot.ts` | 110 | tarball 备份 |
| `restore.ts` | 161 | 从 tarball 恢复 |
| `install-skills.ts` | 95 | 把 skills 软链到 `~/.claude/skills` |

## src/lib/ 详单

| 文件 | LoC | 职责 |
|---|---|---|
| `vectordb.ts` | **1115** | sqlite-vec + FTS5 + 三层 query + RRF（**触发 500 行红线，待拆**） |
| `fetcher.ts` | **848** | URL → markdown：generic / weixin / gist / github（**触发 500 行红线，待拆**） |
| `root-index.ts` | 193 | merge-refresh `corpus/index.md` 的受控分区 |
| `ingest-state.ts` | 152 | `.wiki/ingest-state.json` 读写，pipeline SSOT |
| `corpus.ts` | 98 | corpus 发现 + frontmatter 提取 |
| `chunker.ts` | 72 | markdown 按 `## heading` 切 chunk |
| `ollama.ts` | 47 | ollama embed API 客户端 |

## src/utils/ 详单

| 文件 | LoC | 职责 |
|---|---|---|
| `fs.ts` | 28 | sha256 / mtime / lorekitRoot / readVersion |
| `logger.ts` | 6 | `ok` / `bad` / `warn` / `err`（chalk 封装）— 全仓库输出唯一入口 |

## 关键文件 Top 10（"动一行影响很广"）

1. `src/cli.ts` — 加新命令必经
2. `src/lib/corpus.ts` — corpus 发现，所有命令的根
3. `src/lib/vectordb.ts` — 整个检索栈（待拆）
4. `src/lib/fetcher.ts` — 抓取入口（待拆）
5. `src/lib/ingest-state.ts` — pipeline SSOT
6. `src/commands/ingest.ts` — state machine 对外 surface
7. `src/commands/index.ts` — `runIndex` 被 sync 复用
8. `src/commands/sync.ts` — 把索引 / 向量 / 体检串起来
9. `src/utils/logger.ts` — 全仓库输出统一入口（CONVENTIONS 强制）
10. `templates/default-corpus/` — 影响每一个新建 corpus

## 配置文件

| 文件 | 用途 |
|---|---|
| `tsconfig.json` | strict TS，ES2022，Node16 模块解析 |
| `tsup.config.ts` | esm bundle 到 `dist/cli.js`，外置 `better-sqlite3` 与 `sqlite-vec` |
| `package.json` | scripts: `build` / `dev` / `prepublishOnly`（**`verify` / `test:smoke` 待补**，见 LEGACY P1） |
| `.gitignore` | 排除 `node_modules/` / `.wiki/vector.sqlite*` / 各处 `_INDEX.md` |
| `VERSION` | 版本号单一事实源（cli 与 init 都从此读） |

## 外部依赖

| 包 | 类型 | 用途 |
|---|---|---|
| `commander` | runtime | CLI 框架 |
| `chalk` | runtime | 颜色（**只能在 logger.ts 内用**） |
| `cheerio` | runtime | HTML 解析（fetcher） |
| `turndown` | runtime | HTML → markdown |
| `gray-matter` | runtime | frontmatter 解析 |
| `tar` | runtime | snapshot / restore |
| `better-sqlite3` | runtime | 向量库底座 |
| `sqlite-vec` | optional | 向量虚表扩展 |
| `playwright-core` | （未声明） | fetcher L2 fallback；动态 import，缺了就降级 |
