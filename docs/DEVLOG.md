# DEVLOG

> lorekit 开发流水账，比 git commit message 更细，比 CHANGELOG 更随性。
> 记录踩过的坑、为什么这么改、验证证据。按日期倒序（最新在上）。

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
