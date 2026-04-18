# DEVLOG

> lorekit 开发流水账，比 git commit message 更细，比 CHANGELOG 更随性。
> 记录踩过的坑、为什么这么改、验证证据。按日期倒序（最新在上）。

---

## [2026-04-18 晚] 文本三层 + 向量三层共享档案 + 阶段 2 混合检索骨架

### 背景

先生从"lorekit lint 报 104 假错"开始，一路 review 到架构层。发现 lorekit 现状是：
设计说好 L0/L1/L2 三层（corpus/CLAUDE.md 里的"三层读取策略"），**实际只有 L2 在跑**——
`index.md` 和 `_INDEX.md` 没人读，向量侧 `buildLayeredIndex` 在自合成摘要不读档案。

Karpathy 原文哲学是"**LLM 做 grunt work，人只 source/问**"，先生要求把"还要操心的事"一件件
自动化交给 AI。这轮把文本检索和向量检索**统一到一套档案上**：一份 `index.md` / `_INDEX.md`，
AI 可 Read、向量可嵌入，规模到阈值自动切模式。

### 主线 4 条（锁死）

1. **共享档案**：`index.md` / `_INDEX.md` 既是文本入口，也是向量 L0/L1 输入源
2. **规模切换**：<100 文档走 Read 三层，>=100 走混合检索
3. **自动同步**：`lorekit sync` 一条命令把文本侧 + 向量侧对齐
4. **综合图书馆**：主题馆按需生长，目录不预规划

### 改动 1：`lorekit index` 递归 + 目录包装式原料

`src/commands/index.ts` 重写：

- **递归发现**：`INDEX_DIRS` 硬编码改成扫 corpus 任何"含 .md 或 article.md 子目录"的目录
  - 排除前缀：`.wiki/ .git/ _归档/ _工作台/ 系统/ 反馈/`
  - 导出 `INDEX_EXCLUDE_DIR_PREFIXES` / `isIndexExcluded` / `isFolderPackage` 给 doctor / sync 复用
- **目录包装式原料识别**：`原料/文章/xxx/article.md` 这种"子目录 = 一份原料"的格式，子目录作为 entry 登记（用父目录路径做 slug、article.md 的 frontmatter.title 做 title）
- **`_INDEX.md` 链接用 slug**：`| [[知识库/概念/Anthropic-Harness]] | ... | ... |`，跟 lint 的 wikilink 解析规则对齐，不再依赖文件 basename 猜测
- **导出 `runIndex(root, specificDir?)`** 给 `lorekit sync` 调用
- 同步改 `doctor.ts::checkIndexFiles` 复用 `isIndexExcluded` + `isFolderPackage`，修掉"`_INDEX.md missing in _工作台/...`"假错

**验证**：
```
✓ 写作/_INDEX.md (2 entries)
✓ 原料/剪藏/_INDEX.md (1 entries)
✓ 原料/文章/_INDEX.md (1 entries)          ← 之前没有，目录包装式支持
✓ 知识库/实体/_INDEX.md (2 entries)
✓ 知识库/摘要/_INDEX.md (1 entries)
✓ 知识库/概念/_INDEX.md (2 entries)
```

### 改动 2：向量 L0/L1 输入源切到 index.md / _INDEX.md 档案

`src/lib/vectordb.ts::buildLayeredIndex` 重写（**最大头**）：

**之前**（错的）：
- L0 `vec_dirs` 输入 = 运行时合成"目录名：子文件标题列表"一句话
- L1 `vec_pages` 输入 = 每个文件的 "title + Compiled Truth 前 200 字"
- **不读 index.md / _INDEX.md**——向量层自己造了一套平行摘要

**之后**（对的，跟 Karpathy 原文 "LLM reads the index first" 对齐）：
- L0 = 读 `corpus/index.md`，按 `## 分区` 切分，每区向量化一条，`dir_path` 存分区名（"概念"/"实体"/"摘要"/"写作"）
- L1 = 读每个 `{dir}/_INDEX.md` 每行条目，向量化 summary 字段；doc_id 映射兼容"目录包装式"（slug `原料/文章/xxx` → `xxx/article.md` 的 doc_id）
- 新增辅助 `parseIndexSections` / `parseIndexEntries` / `findAllIndexFiles`

**验证（SQLite 直查）**：
```
dir_path | summary
---------|--------
概念     | ## 概念\n\n- [[知识库/概念/Anthropic-Harness]] — ...
实体     | ## 实体\n\n- [[知识库/实体/Anthropic]] — ...
摘要     | ## 摘要\n\n- [[知识库/摘要/anthropic-harness-deep-research]] — ...
写作     | ## 写作\n\n- [[写作/Harness文章_完整版]] — ...
```

`dir_path` 字段现在是真实分区名而不是合成句子 ✅

### 改动 3：`lorekit sync` 组合命令

新增 `src/commands/sync.ts`。一条命令三步：

1. `runIndex()` — 刷新所有 `_INDEX.md`（改动 1）
2. `runVectorSync({ layered: true })` — 增量嵌入 chunk + 刷 L0/L1 向量（改动 2）
3. `runDoctor()` — sanity check，只报告不阻塞

顺序强制：**先 index 后 vector**——因为 L0/L1 向量要读刚更新的 `_INDEX.md`。

配套：`vector.ts` 抽出 `runVectorSync` export；`doctor.ts` 抽出 `runDoctor` export。

**验证**：
- 空 corpus 全量建：`✓ synced 13 files (104 chunks), skipped 0 unchanged`
- 无变更重跑：**0.86s** 完成（含 L0/L1 4+8 条 embedding 调用）
- `--skip-vector` 只刷 `_INDEX.md` / `--skip-doctor` 跳过体检

### 改动 4：Skill 流程串联

`~/.claude/skills/wiki-ingest/SKILL.md`：Step 9 插入"跑 `lorekit sync`"——ingest 完反向链接后自动同步档案 + 向量。AI 不用记得手工提醒"要不要 sync"。

`~/.claude/skills/wiki-query/SKILL.md`：新增"规模模式切换"规则——读 `lorekit vector status` 的 `mode` 字段决定走 Read 三层还是混合检索。**阈值不在 skill 里写数字**，直接读 status 返回的 mode（后续第 6 轮补上）。

`~/.claude/skills/wiki-fileback/SKILL.md`：新建页面或改 `index.md` 后提示跑 `lorekit sync`。

### 改动 5：Phase B 回归修复 — queryLayered 用 slug_list 过滤

改动 2 改了 `dir_summaries.dir_path` 语义（目录路径 → 分区名），但 `queryLayered` 还用老的 LIKE 过滤：`d.path LIKE '概念/%'`——文件实际路径是 `知识库/概念/xxx.md`，匹配不上。**当时跑 `vector query --layered` 返回空**。

修复：

- DDL `dir_summaries` 加 `slug_list TEXT DEFAULT '[]'`（JSON 数组存分区覆盖的 slug）
- `openDb` 里 migration：老库 `ALTER TABLE ... ADD COLUMN slug_list`
- `parseIndexSections` 同时抽每分区的主 slug 列表（每行 `- [[slug]]` 的第一个 wikilink）
- `buildLayeredIndex` L0 写入时带 `slug_list` JSON
- `queryLayered` 从 LIKE 过滤改成 `slug_list` → `doc_id` IN 过滤（兼容目录包装式 slug）

**验证（`vector query --layered --text "Harness 五版演化"`）**：
```
1. 知识库/概念/Anthropic-Harness.md (Compiled Truth)  score 0.8988
2. 写作/Harness文章_完整版.md (intro)                  score 0.8944
3. 知识库/概念/Anthropic-Harness.md (Timeline)         score 0.8922
```
三层召回完整工作 ✅

### 改动 6：mode 字段放代码层，skill 只读不算

先生 review 时指出：**阈值应该写在代码里，skill 只做流程判断**。

- `src/lib/vectordb.ts` 新增 `MODE_THRESHOLD_FILES = 100` 常量（按 Karpathy 原文 "~100 sources" 锚定）
- `getStatus()` 返回 `mode: 'text' | 'vector'` + `mode_threshold` + `mode_reason`
- 判断逻辑：`indexed_files < 100 → text`，`>= 100 → vector`，未建库 → text（没得选）
- skill 改成**读 `mode` 字段直接走对应路径**，不做数值判断

阈值调整路径：改 `MODE_THRESHOLD_FILES` 常量 + rebuild，所有 skill 通过 `vector status` 自动跟随。

先生用 `chunks` 计数会被单文档长度扭曲（一篇 2 万字切 30+ chunks）——改成 `indexed_files`（文档数）后跟 Karpathy 原文锚定一致。

### 改动 7：阶段 2 混合检索骨架（BM25 + 向量 + RRF，无 re-rank）

先生 review 发现我之前写的"阶段 2 = 纯向量 layered"**定义错了**。Karpathy 原文直接点了 qmd 的模式：

> "hybrid BM25/vector search **and LLM re-ranking**"

纯向量的致命弱点：查 "2026-04-18 发生了什么"——日期向量化后跟"2025-03-22..."余弦相似度几乎一样，
纯向量无法区分。专有名词（实体名）向量化也会被抹平。必须靠 BM25 精确打分互补。

**实施**（本轮只做 BM25 + 向量 + RRF，re-rank 延后）：

- DDL 加 FTS5 虚表 `fts_chunks` / `fts_dirs` / `fts_pages`，`tokenize='trigram'`（中文友好）
- `syncFile` 每个 chunk 同步写 `fts_chunks`；删 doc 时级联清 page_summaries/vec_pages/fts_pages（修 `SQLITE_CONSTRAINT_FOREIGNKEY`）
- `buildLayeredIndex` L0/L1 写入时同步写 FTS；**L1 FTS 内容 = `slug + summary`**，让 BM25 通过路径（含实体名）命中（纯 summary 可能不含实体名本身）
- 新增 `sanitizeFtsQuery`：清洗 FTS5 运算符（`" * : ^ ( ) - +` + `OR/AND/NOT/NEAR`），短于 3 字符的 token 丢弃（trigram 约束）
- 新增 `queryBM25Layered`（BM25 三层分层，镜像 `queryLayered` 的过滤逻辑）
- 新增 `rrfMerge`（RRF 公式 `score = Σ 1/(k+rank)`，k=60）
- 新增 `queryHybrid`：两路各召回 topK*2 → RRF 融合取 topK
- `lorekit vector query` 加 `--hybrid` / `--bm25` flag
- skill 侧：`wiki-query` 的"向量模式"升级成"hybrid 模式标配"

**踩的坑**：

1. **FTS5 `-` 运算符冲突**：查 `2026-04-15` 被解析成 `2026 NOT 04 NOT 15` 返回空。修复：`sanitizeFtsQuery` 把 `-` 替换成空格。
2. **L1 summary 不含实体名**：查 `卡兹克` L0 命中实体分区但 L1 挂空——因为"数字生命卡兹克"页的 Compiled Truth 首句是"是微信公众号 AI 科普作者"（主语在标题里，首句不重复）。修复：FTS L1 索引内容改成 `slug + summary`（向量 L1 保持纯 summary）。
3. **短语搜索太严**：最初用 `"<q>"` 包短语，trigram 要求整句连续匹配几乎永远失败。修复：改成空格分词 FTS5 默认 AND 语义。

**验证（三路对比）**：

| query | BM25 | 纯向量 layered | Hybrid |
|---|---|---|---|
| `卡兹克`（精确实体名） | ✅ 4.1085 | ✅ | ✅ |
| `2026-04-15`（精确日期） | ✅ 1.0124 | 弱 | ✅ |
| `Harness 五版演化`（复合语义） | 空（AND 过严，合理） | ✅ 0.8988 | ✅ 向量主导 |
| `卡兹克 Harness`（混合） | ✅ | ✅ | ✅ RRF 融合 |

互补证据清晰：BM25 弱项（复合语义）由向量补，向量弱项（精确日期/实体名）由 BM25 补。

### 目录架构现状（递归示意）

```
corpus/
├── CLAUDE.md                     # schema（LLM 规则）
├── index.md                      # L0 总索引，按形态分区（概念/实体/摘要/写作/专题）
├── log.md                        # 操作流水
├── 知识库/
│   ├── 概念/_INDEX.md             # L1 书架
│   ├── 实体/_INDEX.md
│   ├── 摘要/_INDEX.md
│   └── 专题/
├── 原料/
│   ├── 文章/_INDEX.md             # 目录包装式原料的父目录也有 _INDEX.md
│   │   └── <slug>/article.md     # 具体原料
│   └── 剪藏/_INDEX.md
├── 写作/_INDEX.md
└── .wiki/
    ├── vector.sqlite             # vec_chunks/dirs/pages + fts_chunks/dirs/pages
    └── ingest-state.json
```

**未来主题馆长出后**（doctor 按密度提示）：

```
知识库/
├── AI/                           # 某主题积累到阈值自动建馆
│   ├── _INDEX.md
│   ├── 概念/_INDEX.md
│   └── 实体/_INDEX.md
└── 概念/                          # 通用篓子继续存在
```

### 遗留 TODO / IDEAS

- **LLM re-rank**（硬件限制，先生当前电脑跑不动本地 reranker 模型）——见 `docs/IDEAS.md`
  四条替代路径：换机器本地跑 / Claude Haiku API / cohere / 等轻量模型
- **query 产物自动 fileback**（Karpathy 原文"explorations compound"）——见 `docs/IDEAS.md`
- **`_工作台/` frontmatter 豁免**（lint/doctor 还在要求过渡区文件有 frontmatter）
- **`原料/剪藏` 在 vectordb 的 EXCLUDE_PREFIXES 里被排除**——跟 lint/index 规则不一致，今天的卡兹克文章没被向量化
- **L0/L1 增量嵌入**（当前每次 `DELETE + INSERT` 全量重建，13 files 时 0.86s 可接受，规模大要优化）

### 为什么这一轮值得这么大改

这是把 lorekit 从"开发者视角"拧到"**先生视角 + Karpathy 哲学**"的结构性升级：

- 之前：先生要记得跑 `lorekit vector sync`、要提醒 LLM 更新 `index.md`、要想查询该走哪层
- 之后：先生只做三件事——**存**（"帮我存这份"）、**问**（"xxx 是什么"）、**看**（偶尔被 doctor 问"要不要拆馆"）

主线焊死、阶段 2 混合检索骨架到位、未来生长路径记进 IDEAS——lorekit 现在能按规模自动演化，不需要先生每次手动推进。

---

## [2026-04-18] lint / index / fetch 三块修复 + gist-github 爬取强化

### 背景

先生在 corpus（`~/Desktop/OpenClaw-Base-Camp/corpus`）跑 `lorekit lint` 得到 **104 条告警**，逐个核实后发现**绝大多数是 lint 工具本身的误报**——真正该管的只有 ~10 条"未建页概念"空缺。顺带发现 `lorekit index` 直接崩溃，以及 `lorekit fetch` 对 gist/github URL 返回 `unsupported`。把三件事一起焊了。

### 改动 1：`lint` 命令误报清理（104 → 9）

`src/commands/lint.ts` 三处修改：

1. **剥代码块再扫 wikilink**：新增 `stripCodeBlocks()`，匹配前先去掉 ```` ``` ```` fenced block 和 `` ` `` inline code，避免 `系统/schema.md` 里的 `[[Page]]` `[[slug]]` 占位符被当作真 wikilink。
2. **识别目录包装式原料**：`原料/文章/xxx/article.md` 这种"文件夹 = 一个原料"的惯例——规范引用是 `[[原料/文章/xxx]]`（不带 `/article`）。在 `stemSet` 里同时登记 `xxx/article` 和 `xxx` 两种形式；orphan 检查反向也认"父目录名"入链。这一个改动直接消掉 38 条误报（25 条 `anthropic-harness-deep-research` + 13 条 `harness-engineering-kazike`）。
3. **顶层配置/索引文件豁免**：
   - `SKIP_FRONTMATTER_BASENAMES` = `README.md / AGENTS.md / CLAUDE.md / MEMORY.md`（任何位置）
   - `ROOT_ONLY_SKIP_BASENAMES` = `index.md / log.md`（只在 corpus 根）
   - `SKIP_ORPHAN_PREFIXES` = `_工作台/ / _归档/ / 系统/`（这些目录下的文件不参与 orphan 检查）

**验证**：

| 类别 | 修前 | 修后 |
|---|---|---|
| frontmatter | 35 | 0 |
| broken links | 54 | 9 |
| orphan pages | 15 | 0 |
| 总计 | **104** | **9** |

剩下的 9 条是 `[[MCP]]` `[[Claude Code]]` `[[上下文工程]]` `[[Andrej Karpathy]]` 等合法的"未建页"提示，与 corpus `CLAUDE.md` 里"空缺"区已经承认的条目完全一致——**这是有价值的 TODO 信号，不是 bug**。

### 改动 2：`index` 命令 YAML Date 崩溃修复

**现象**：`lorekit index` 第一次运行直接抛 `TypeError: b.updated.localeCompare is not a function`。

**根因**：`gray-matter` 把 YAML frontmatter 里的 `updated: 2026-04-18`（符合 YAML spec 的 timestamp 字面量）解析成 **JavaScript Date 对象**，不是字符串。原代码 `(fm.updated as string) ?? ''` 只骗了编译器，运行时 `Date.localeCompare` 不存在直接炸。

**修复**（`src/commands/index.ts:82-95`）：
- title 字段：`typeof fm.title === 'string' ? fm.title : String(fm.title)` 兜底
- updated 字段：`fm.updated instanceof Date` 判断，走 `getUTCFullYear/Month/Date` 归一成 `YYYY-MM-DD` 字符串

**验证**：`lorekit index` 对先生 corpus 生成了 4 个 `_INDEX.md`（概念 / 实体 / 摘要 / 写作），内容格式正确。

**已知局限（没在本次修掉，列成 TODO）**：
- `INDEX_DIRS` 常量硬编码 11 个目录，不支持递归进子目录——比如未来 `知识库/概念/AI相关/` 这种二级分类拿不到自己的 `_INDEX.md`
- 不支持"目录包装式原料"（`原料/文章/xxx/article.md` 这种文件夹里只有一个 article.md 的情况），所以 `原料/文章/_INDEX.md` 和 `原料/剪藏/_INDEX.md` 都没生成
- 需要另一轮改造：`buildIndex` 扫子目录时，如果子目录内含 `article.md` 就把子目录登记为一个 entry

### 改动 3：`fetch` 新增 gist + github README 支持

**现象**：`lorekit fetch https://gist.github.com/karpathy/442a6b...` 返回 `{"status":"unsupported","route":"github","suggest":"WebFetch or github-content-fetch skill"}`——但 gist 和 GitHub README 都是标准公开 HTTPS markdown，根本不需要"其他 skill"来代劳。

**改动**（`src/lib/fetcher.ts` 末尾新增 ~160 行 + `src/commands/fetch.ts` 路由表）：

- `parseGistUrl()` + `fetchGist()`：拉 gist 页面 HTML → cheerio 解析所有 `/raw/` href（正则 `/^\/([^/]+)\/([a-f0-9]{20,})\/raw\/([a-f0-9]{20,})\/(.+)$/i`）→ 优先选 `.md` 文件拉 raw 内容 → 落盘成 `article.md` + 合规 frontmatter。日期从 `<relative-time datetime>` 抽。
- `parseGithubRepoUrl()` + `fetchGithubDoc()`：`github.com/owner/repo` → `raw.githubusercontent.com/owner/repo/HEAD/README.md`（按 `README.md / README.MD / Readme.md / readme.md / README` 顺序尝试）；`github.com/owner/repo/blob/<ref>/<path>` → 对应 raw 文件。
- `src/commands/fetch.ts` 路由表：
  - `gist.github.com` / `gist.githubusercontent.com` → `fetchGist()`
  - `github.com` / `www.github.com` → `fetchGithubDoc()`
  - 原来两个分支都返回 `unsupported`

**实测**：

| URL | status | title | 产物 |
|---|---|---|---|
| `https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f` | `ok` | `llm-wiki` | `article.md` + 完整 frontmatter（`source_date: 2026-04-04`） |
| `https://github.com/GYF0311/lorekit` | `ok` | `GYF0311/lorekit` | `article.md` 461 行（README 全文） |

**调试插曲**：第一次跑 gist 报 `raw_fetch_failed: fetch failed`，一度怀疑是 URL 拼错或 headers 冲突。隔离跑同样的 URL 和 headers 能返回 200——原来是 `npm run build` 之后没走 global symlink 刷新，跑的还是老代码。重 build 后一次通过。顺手把 `cause.message` 加进了错误字符串，下次排查更快。

### 改动 4：`wiki-ingest` skill 路由表同步更新

`~/.claude/skills/wiki-ingest/SKILL.md` 的 Step 0 改动：
- 新增"支持的路由"表，列全 weixin / gist / github / rich / lark / x / pdf 的 host → route 映射
- `status=error` 的下一步指示里加了 `raw_fetch_failed` 的回退路径（curl 直抓 raw URL）
- Step 5 归档规则加一行：gist / github 产物归 `原料/文章/<slug>/`

### 遗留 TODO

- `lorekit index` 支持递归子目录 + 目录包装式原料（改动 2 的已知局限）
- `lorekit doctor` 增加"单区条目数阈值警告"（index.md 某区 > 30 条提示拆二级）
- 从架构设计看，"文本三层 + 向量三层"两套检索共用同一套 `index.md` / `_INDEX.md` 档案是更优解——当前向量侧在 `vectordb.ts::buildLayeredIndex` 里自合成 L0/L1 输入，与文本侧脱钩，是下阶段要焊的大头
