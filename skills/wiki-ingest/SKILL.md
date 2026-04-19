---
name: wiki-ingest
description: 把新内容摄入 corpus，按 filing-rules 落盘并建反向链接。触发词：ingest、存一下、整理进知识库、收藏、归档、mp.weixin、公众号、带图文章，或用户直接发 URL / 文件路径。
---

# wiki-ingest

把外部内容（URL / 文件 / 粘贴文本）摄入当前 corpus：fetch → 写 wiki → 反链 → CLI 关账。

## When to trigger

- 用户发来 URL / 文件路径 / 粘贴一段外部内容
- 用户说"ingest 这个"、"存一下"、"整理进知识库"、"收藏"、"归档一下"
- 用户发公众号链接（`mp.weixin.qq.com`）且希望整理

**不要触发**：

- 对话中的洞察存回 → `wiki-fileback`
- 只是查询已有内容 → `wiki-query`
- 从日记里定期提炼 → `wiki-enrich`

## 分工边界（重要）

| CLI 负责（自动）                       | LLM 负责（你）                 |
| -------------------------------------- | ------------------------------ |
| URL 查重（fetch 内建）                 | 主语识别 / Notability 判断     |
| 抽 publishDate / 写 frontmatter        | Compiled Truth 写作            |
| 死链检测（`ingest check`）             | Timeline 措辞、反链选择        |
| 刷 `corpus/index.md` 受控区（sync）    | 建反链时的 timeline 追加       |
| 写 `corpus/log.md`（`record --log`）   | 一句话归纳本次 ingest 做了什么 |
| 推进 ingest state machine（record）    | 决定哪些主语该建独立页         |
| 向量同步 / `_INDEX.md`（sync）         | —                              |
| frontmatter 合规 / 死链 / 孤岛（lint） | —                              |

**铁律：能让 CLI 做的就让 CLI 做。** 不要手动 Edit `index.md` / `log.md`，不要先跑 `lorekit search` 做查重（fetch 已做）。

## 6 步流程

### 1. Fetch — `lorekit fetch <url>`

对任何 URL 统一调 `lorekit fetch`，按站点路由抓正文 + 图片，落 `_工作台/收件/fetch/<slug>/`。stdout 是单行 JSON：

| status        | 含义                             | 下一步                                                                                 |
| ------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `ok`          | 抓取成功                         | 读 `markdown` 字段、按需读关键图。fetcher 自动写 `status:started, stepsDone:['fetch']` |
| `duplicate`   | URL 之前已 ingest 过             | 读 `duplicate.path` 看已有页，跟用户确认覆盖/追加/取消；要重抓加 `--force`             |
| `in_progress` | 上次 ingest 中断                 | 读 `ingestState.stepsDone` + `nextStep`，从下一步继续，**不要重抓**                    |
| `error`       | 抓取失败                         | 按 `reason` 字段判断回退路径（反爬走 web-access skill；gist/github raw 失败用 `curl`） |
| `unsupported` | 站点不直接处理（lark / x / pdf） | 按 `suggest` 字段用对应工具                                                            |

**支持的路由**（按 host 自动分发）：

| host                           | route       | fetcher 行为                            |
| ------------------------------ | ----------- | --------------------------------------- |
| `mp.weixin.qq.com`             | `rich`      | iPhone UA + 抽 `ct` 时间戳 + 懒加载图   |
| `gist.github.com`              | `gist`      | 解析 raw + 抽 `<relative-time>` 日期    |
| `github.com`                   | `github`    | 仓库 → README；`/blob/...` → raw 文件   |
| 其他                           | `rich`      | 通用 article/main/body + OpenGraph 日期 |
| `feishu.cn` / `larkoffice.com` | unsupported | 走 `lark-cli docs`                      |
| `x.com` / `twitter.com`        | unsupported | 反爬强，粘截图或文本                    |
| `*.pdf`                        | unsupported | 走 pdf skill                            |

**本地文件 / 粘贴文本** 不走 `lorekit fetch`，直接 `Read`。

### 1.5 来源类型判断（决定走哪条 ingest 流程）

抓完原料后**先判断来源类型**，不同类型 ingest 流程有差异。优先级由高到低：

1. frontmatter `type: personal-writing` → 走**个人写作流程**（见下方 §个人写作流程）
2. 原料文件路径含 `原料/个人写作/` → 走**个人写作流程**
3. 其他（来自外部 URL / 外部文件） → 走**外部来源标准流程**（即本文档 Step 2-6）

**为什么要区分**：个人写作是先生自己的立场，**不计 source_count**（防自我背书），不生成客观 Summary 节，核心论点走 concept 页的 `## My Position` 节。外部来源才是可信事实的证据。

### 2. 解析主语

读 `article.md` 全文（按需读关键图），抽：

- 标题、作者、日期（fetcher 已写进 frontmatter，**直接用**）
- 主语清单：人/组织/项目（→ 实体）、概念/方法（→ 概念）、跨源主题（→ 专题）

一条内容可能有**多个主语**——每个主语都要决定建页或追加 timeline。

### 3. 原文落地（mv 不 cp）

fetcher 产出的扁平结构（**Obsidian 兼容**，`[[<归档路径>/<slug>]]` 能按 basename 直接匹配）：

```
_工作台/收件/fetch/
├── <slug>.md            ← 原文（含 frontmatter）
└── <slug>.assets/       ← 图片（没图片时此目录不存在）
```

按 `系统/filing-rules.md` 路由到归档目录：

| 原料类型                        | 目标目录     |
| ------------------------------- | ------------ |
| 公众号                          | `原料/剪藏/` |
| 一般文章 / gist / GitHub README | `原料/文章/` |
| 书籍笔记                        | `原料/书籍/` |
| 会议纪要                        | `原料/会议/` |

**mv 命令**：`.md` 和 `.assets/` 同名配对，两件一起搬：

```bash
mv _工作台/收件/fetch/<slug>.md 原料/剪藏/<slug>.md
# 图片目录存在时一起搬（同名才能让 Obsidian 相对引用继续工作）：
[ -d _工作台/收件/fetch/<slug>.assets ] && \
  mv _工作台/收件/fetch/<slug>.assets 原料/剪藏/<slug>.assets
```

**铁律**：

- **不要 cp**——产物永远只存一份
- **`.md` 和 `.assets/` 必须同名同级**——不要拆开，否则 Obsidian 里图片引用断
- 不值得入档的低质量片段 → 用 `trash` 扔回收站，**绝不用 `rm`**

**铁律：保持 fetcher slug，禁止 LLM 自作主张 rename / 缩写**

fetcher 已用 `slugify(title)` 生成的 slug 是先生希望的"文件名 = 真实标题"。
LLM 在 mv 时**不许**改名（即使觉得短英文 slug 更专业）。

❌ 错误示例（早期吃过的亏，2026-04-19 修复）：
- title: "Web Access：一个Skill，拉满Agent联网和浏览器能力"
- fetcher slug: `Web-Access-一个Skill-拉满Agent联网和浏览器能力`
- LLM 自作主张改成: `web-access-skill-yize`  ← **错**，先生看图谱时无法直观知道是哪篇

✅ 正确：
- mv `_工作台/收件/fetch/Web-Access-一个Skill-拉满Agent联网和浏览器能力.md` `原料/剪藏/Web-Access-一个Skill-拉满Agent联网和浏览器能力.md`

  保持 fetcher 给的 slug 一字不改。

### 3.5 aliases 对齐检查（提取概念前必做，防碎裂）

对每个要建 concept / entity 页的主语，**先扫已有页的 aliases，避免同物异名建重复页**：

1. 生成当前概念的英文 slug（正规化：lowercase + kebab-case）
2. Grep `知识库/概念/*.md` 与 `知识库/实体/*.md` 的 frontmatter `aliases` 字段
3. 若当前叫法命中已有页的 aliases（或相反——已有页的 title/slug 命中当前概念的叫法清单）：
   - **不新建**，走"追加 Timeline"分支，把本次来源的信息合并到已有页
4. 若确认无匹配 → 新建时 `aliases` 字段必填，把当前概念的**所有叫法**（中文名 / 英文名 / 常见别名 / 缩写）都列进去

**示例**：要建"检索增强生成"页，先搜 aliases，命中已有 `知识库/概念/RAG.md`（其 aliases 含"检索增强生成"）→ 追加 Timeline 到 RAG.md，不新建。

### 3.6 SHA-256 记录（source 页 + personal-writing 都做）

对落进 `原料/` 的原料文件计算 SHA-256 哈希，写入对应 wiki source 页 frontmatter：

- `raw_sha256: <64-hex>` — 原料文件哈希
- `last_verified: YYYY-MM-DD` — 本次 ingest 日期（即哈希校验成功日期）
- `possibly_outdated: true` — 若原料发表日期距今 **超过 2 年**（按 `source_date` 判）

**为什么**：lint 阶段可以重算哈希对比，若原料被外部改动（例如微信公众号偷偷改原文）会报 "⚠ SOURCE MODIFIED"，触发 re-ingest。老页没 `raw_sha256` 字段的，lint 会跳过不误报。

```bash
# 计算哈希示例
shasum -a 256 原料/剪藏/<slug>.md | awk '{print $1}'
```

### 4. 并行建 wiki 页（Notability gate）

对每个主语先问："**下次我会不会主动引用这个实体？**"

- 是 → 在 `知识库/{概念,实体,摘要,专题}/` 建新页
- 否 → 找最近相关页，往 `## Timeline` 追加一条

**铁律：多个独立 wiki 页必须并行 Write**——单条消息里一次性发出 N 个 Write 调用，不要串行。串行是上次 ingest 慢的主因（每页 40-60s × N）。

页面结构按 `corpus/CLAUDE.md` 的"页面结构"章节：

```markdown
---
{ frontmatter — 见 系统/frontmatter-spec.md }
---

# 标题

## Compiled Truth

当下最好的理解，2-3 段。可被后续 ingest 重写覆盖。

---

## Timeline

- YYYY-MM-DD（N sources）| [标注]：[变化描述] [[双链到来源页]]
```

#### Timeline 语义（三类标注）

Timeline 在本 corpus 已承担 Evolution Log 的角色。追加新条目时**必须按以下三类打标注**，让 LLM 能从 Timeline 看出页面是如何演化的：

| 标注 | 含义 | 什么时候用 |
| --- | --- | --- |
| **强化** | 新来源与已有 compiled truth 一致 | 结论被第 N 个来源进一步印证 |
| **修正** | 新来源推翻 / 修订了原结论的一部分 | 需要改 compiled truth，Timeline 记录原因 |
| **新增分歧** | 新来源与已有来源在某点冲突、但当前不做裁决 | 写入 `## Contradictions` 节同时 Timeline 标注 |

格式：`- YYYY-MM-DD（N sources）| [标注]：[一句话描述变化] [[来源页]]`

示例：
- `- 2026-04-10（3 sources）| 强化：HyDE 在长查询上提升 ~10% 召回 [[知识库/摘要/rag-2024-survey]]`
- `- 2026-04-15（4 sources）| 修正：RAG 的上下文窗口问题原归因错误，应是 chunk 边界 [[知识库/摘要/xxx]]`
- `- 2026-04-18（4 sources）| 新增分歧：BM25 与向量融合权重 0.5 vs 0.7 两派 [[知识库/摘要/yyy]]`

写页时**只用本次的原料**作证据。**禁止跨源污染**：

- ❌ MEMORY.md / 老日记里的偏好
- ❌ CLAUDE.md / 全局 prefs
- ❌ 其他不相关的旧原料页（除非做跨源综合且标明来源）
- ❌ 纯脑补推测（年份、月份、具体事件）

自查：实体页写完逐条问"这句话证据在哪个 `[[页面]]`？"——答不上就删或改"（未提及）"。

### 5. 死链预检 — `lorekit ingest check <wiki-page...>`

写完页**立即**跑：

```bash
lorekit ingest check 知识库/实体/A.md 知识库/实体/B.md 知识库/概念/C.md
```

返回 JSON `{checked, ok, broken}`。

- `broken: []` → 进下一步
- `broken: [{file, link}]` → 决定每条死链怎么处理：
  - 真该建独立页的（已存在主语但还没建） → 回 Step 4 补建
  - 不该独立成页的（一次性提及） → Edit 把 `[[xxx]]` 改成纯文本

死链清完再继续。**不要让死链漏到 sync / lint 阶段**。

### 6. 一次性关账 — `lorekit ingest record ... --step ... --log ...`

**一条命令**关账 + 写日志：

```bash
lorekit ingest record <url> \
  --step archive,wiki,backlink,lint \
  --archived-to "原料/剪藏/<slug>" \
  --wiki-page "知识库/实体/A.md" \
  --wiki-page "知识库/实体/B.md" \
  --wiki-page "知识库/概念/C.md" \
  --log "一句话归纳本次 ingest 的核心收获 / 主语 / 关键事实。CLI 自动补 URL/归档/页面清单。"
```

效果：

- `stepsDone` 一次性补齐 4 步
- `--step` 含 `lint` 时 status 自动转 `completed`
- `--log` body 自动 prepend 到 `corpus/log.md` 顶部，带标准格式

然后跑 `lorekit sync`：

- 自动刷 `_INDEX.md`
- 自动 merge `corpus/index.md`（新页追加 / 失踪页删除 / 人类手写摘要保留）
- 增量向量同步
- doctor 健康检查

**不要**手动 Edit `corpus/index.md` 或 `corpus/log.md`——CLI 全包了。

最后跑一次 `lorekit lint`（可选）查全局健康度——只关注本次新建页的 issue，历史遗留可忽略。

### 7. QUESTIONS.md 匹配（ingest 结束前）

ingest 结束后、汇报前，Read `corpus/QUESTIONS.md` 的 **Open Questions** 列表：

1. 用本次新来源的核心论点对每条 Open Question 做一次简短 relevance 判断
2. 若本次来源**能回答或部分回答**某问题 → **主动提示先生**：
   > 此次 ingest 的来源 `[[xxx]]` 可能回答了 Open Question："{问题描述}"。是否现在执行 QUERY 综合一次？
3. 先生回 Y → 交给 `wiki-query` skill 跑一次查询，答案端看到"这个问题已经被回答"，可将 QUESTIONS.md 的此条从 Open Questions 移到 Resolved Questions（`wiki-query` 里处理）
4. 先生回 N → 结束，不动 QUESTIONS.md

**为什么**：Open Questions 是先生留给自己的"研究钩子"，新来源进来的一瞬间是最佳匹配时机。错过这个时点，问题就可能一直挂着。

## 个人写作流程（type: personal-writing 走这条）

与外部来源流程（Step 2-7）的关键差异：

| 环节 | 外部来源 | 个人写作 |
| --- | --- | --- |
| Compiled Truth | 2-3 段客观摘要 | **不生成 Summary 节**（跳过客观摘要——个人立场不是事实综述） |
| 核心论点落点 | 抽 concept / entity 建页 | 写入相关 concept 页的 `## My Position` 节（标注"个人立场"来源） |
| source_count | 参与计数（+1） | **不参与计数**（防自我背书） |
| Timeline 记录 | 标"强化 / 修正 / 新增分歧" | concept 页追加：`- YYYY-MM-DD 个人写作 [[slug]] 确立了对此概念的明确立场` |
| 外部引用 wikilink | 必做 | 若本文引用了外部来源，尽量与 `知识库/摘要/` 建 wikilink |

**示例**：先生写了一篇《我对 RAG 的立场》，ingest 后：
- 原料留在 `原料/个人写作/`
- 不新建 summary 页，也不建 synthesis 页
- 在 `知识库/概念/RAG.md` 的 `## My Position` 节追加"先生认为...（来自 [[原料/个人写作/...]]）"
- RAG.md Timeline 追加：`- 2026-04-19 个人写作 [[原料/个人写作/my-rag-position]] 确立了对此概念的明确立场`
- RAG.md 的 `source_count` **不变**

## 意外中断怎么办

唯一数据源 `.wiki/ingest-state.json`，三档 status：`started` / `completed` / `failed`。

- 重跑 `lorekit fetch <url>` → CLI 返回 `in_progress` + `nextStep`，按提示从下一步继续
- 查所有中断：`lorekit ingest pending`
- 放弃一条：`lorekit ingest forget <url>` 或 `record --fail <reason>`
- 老 ingest 没 state 记录：`lorekit ingest reconcile`（先 `--dry-run`）

## 日期填写规则

| 优先级 | 方法                                                                       |
| ------ | -------------------------------------------------------------------------- |
| 1      | `lorekit fetch` 抽出来的 `publishDate`（已写进 frontmatter `source_date`） |
| 2      | 原文正文明确日期（"Posted on 2026-04-04"）                                 |
| 3      | 用户确认                                                                   |
| 4      | 留空 + timeline 写"(未标注)"                                               |

**禁止**：猜年份 / 用"今年/去年" / 用 ingest 时间冒充发布日期 / 反爬一次就放弃（`curl -A` 抓原始 HTML 有戏）/ 从图片扒日期（二手考证不算原话）。

## 反链铁律

至少一条反向链接，防孤岛：

- 新建页里提到的 `[[人物]]` / `[[项目]]` / `[[概念]]` 必须真存在 → 靠 Step 5 的 `ingest check` 兜底
- 被链的目标页也要在 timeline 留一条反向引用
- 没链接的信息等于没有

## Output format

```
抓取：lorekit fetch → rich (L1, 12 images)
原文：mv 工作台/abc → 原料/剪藏/abc/
新建页面（并行 Write）：
  - [[知识库/实体/张三]]
  - [[知识库/概念/RAG 评估]]
更新页面（追加 timeline）：
  - [[知识库/实体/lorekit]]
死链预检：3 file, 10 link ok, 0 broken
一次关账：record --step archive,wiki,backlink,lint --log "..."
sync：index.md +2 added, 6 _INDEX.md refreshed, vectors synced
日期来源：fetcher publishDate=2026-04-04
```

## 工具速查

- `lorekit fetch <url>` — URL 抓取入口（自动 dedupe + 抽 publishDate + 起 state）
- `lorekit fetch <url> --force` — 忽略 dedupe 强制重抓
- `lorekit ingest check <files...>` — 死链预检（写完页立刻跑）
- `lorekit ingest record <url> --step a,b,c,d --log "..."` — 多步一次关账 + 写 log
- `lorekit ingest record <url> --complete` / `--fail <reason>` — 显式收尾
- `lorekit ingest pending` / `list` / `forget` / `reconcile` — 状态管理
- `lorekit sync` — 一条命令：刷 \_INDEX + merge index.md + 向量 + doctor
- `lorekit lint` — 全局健康（事后扫）
- 底层：Read / Write / Edit / `mv` / `trash`（删东西绝不用 `rm`）
