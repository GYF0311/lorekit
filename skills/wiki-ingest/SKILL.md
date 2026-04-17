---
name: wiki-ingest
description: 把新内容摄入 corpus，按 filing-rules 落盘并建反向链接。触发词：ingest、存一下、整理进知识库、收藏、归档、mp.weixin、公众号、带图文章，或用户直接发 URL / 文件路径。
---

# wiki-ingest

把外部内容（URL / 文件 / 粘贴文本）摄入当前 corpus：先 fetch，再按主语落盘，建反向链接，通过 lint 自检。

## When to trigger

- 用户发来 URL / 文件路径 / 粘贴一段外部内容
- 用户说"ingest 这个"、"存一下"、"整理进知识库"、"收藏"、"归档一下"
- 用户发公众号链接（`mp.weixin.qq.com`）且希望整理

**不要触发**：
- 对话中的洞察要存回 → `wiki-fileback`
- 只是查询已有内容 → `wiki-query`
- 从日记里定期提炼 → `wiki-enrich`

## Step 0: Fetch

对任何 URL，统一调 `lorekit fetch <url>`，它会按站点类型自动路由并把产物落在 `_工作台/收件/fetch/<slug>/`（corpus 内）或 `/tmp/lorekit-fetch/<slug>/`（corpus 外）。

stdout 是**单行 JSON**，解析它决定下一步：

| status | 含义 | 下一步 |
|---|---|---|
| `ok` | 抓取成功 | 读 `markdown` 字段指向的 article.md；按需 `Read` `images_dir/` 下关键图片 |
| `error` | 抓取失败（如 `ANTIBOT_BLOCKED`） | 按 `fallback` 字段提示回退工具，或让用户粘贴 |
| `unsupported` | 站点 lorekit fetch 不直接处理 | 按 `suggest` 字段使用对应工具（如 lark-cli / pdf skill / WebFetch） |

**成功 JSON 示例**：
```json
{"status":"ok","route":"rich","url":"...","title":"...","author":"...","publishDate":"2026-04-15","sourceKind":"clipping","sourceLayer":"L1","slug":"abc","dir":"<workbench>/abc","markdown":"<workbench>/abc/article.md","imagesDir":"<workbench>/abc/images","imagesOk":12,"imagesFailed":1}
```

抓取产物的 `article.md` frontmatter 已按 `系统/frontmatter-spec.md` 合规生成（`type: source` + `source_url` / `source_author` / `source_date` / `source_kind` 等）。`source_date` 会从 HTML 的 `var ct="xxx"` Unix 时间戳、`<em id="publish_time">`、`<meta property="article:published_time">`、`<time datetime>` 等字段里抽——你通常不需要再手动核实日期。

**本地文件 / 粘贴文本** 不走 `lorekit fetch`，直接 `Read`。

完成 Step 0 后进入下面的 decision tree，输入是：正文 markdown、标题、作者、日期、图片清单、工作台 slug 目录。

## Decision tree

1. **Step 0: Fetch**（见上）—— 拿到正文 + 图片，产物在工作台 slug 目录
2. **解析**：抽取标题、作者、关键实体
3. **核实日期**（见下方"日期填写规则"）
4. **查重**：`lorekit search "<title>"` + `lorekit search "<关键实体>"`
   - 命中既有页 → update 分支（跳到第 7 步，追加 timeline）
   - 没命中 → create 分支
5. **原文落地（铁律）**：用 `mv` 把工作台 slug 目录**搬到**永久位置，**不要用 cp**
   - 公众号 → `原料/剪藏/<slug>/`
   - 一般文章 → `原料/文章/<slug>/`
   - 书籍笔记 → `原料/书籍/<slug>/`
   - 会议纪要 → `原料/会议/<slug>/`
   - **搬完工作台那份就不存在了**——产物永远只存一份，未被 ingest 的孤儿才留在工作台等 7 天过期
   - 如果原文本身不值得入档（如 low-quality 片段），可以 `rm -rf` 工作台 slug 目录
6. **判断主语**（见 `系统/filing-rules.md`）：
   - 主题是人/组织/项目 → `知识库/实体/<名称>.md`
   - 主题是概念/方法 → `知识库/概念/<概念名>.md`
   - 主题是跨源主题 → `知识库/专题/<主题名>.md`
   - 一条内容可能有多个主语，**每个主语都要处理**
7. **Notability gate**（决定建新页还是追加 timeline）
   - 问："下次我会不会主动引用这个实体？"
   - 是 → 新建页面：frontmatter + `## Compiled Truth` + `---` + `## Timeline`（首条）
   - 否 → 找最近相关页，往 `## Timeline` 追加一条，**禁止新建**
8. **建反向链接**（铁律：**至少一条**，防孤岛）
   - 页面里提到的所有 `[[人物]]` / `[[项目]]` / `[[概念]]` 都要确认目标页存在
   - 目标页也要在 timeline 留下一条反向引用
9. **自检**：`lorekit lint --quick`，有问题就修到没问题再汇报
10. **汇报**（见 Output format）

## 日期填写规则（重要）

**优先级**：

| 优先级 | 方法 | 说明 |
|---|---|---|
| 1 | **fetcher 返回的 `publishDate`** | 成功抓取时 `lorekit fetch` 输出 JSON 里的 `publishDate` 字段已从 HTML 元数据抽好，article.md frontmatter 也已写入 `source_date`。**直接用**。|
| 2 | **原文正文明确日期** | "Posted on 2026-04-04"、"2026年4月4日" 等作者自己写在正文里的日期 |
| 3 | **用户确认** | 不确定时问用户 |
| 4 | **留空或标注** | 实在找不到，frontmatter 的 `source_date` 留空，timeline 条目写 `"(未标注)"` |

**禁止行为**：
- ❌ **猜测年份**（如默认填 2025）
- ❌ **用"今年/去年"** 等相对时间
- ❌ **用 ingest 时间冒充发布日期**
- ❌ **反爬一次就放弃**：`WebFetch` 被拦不代表没办法；`curl -A '<UA>'` 抓原始 HTML、或直接看 `lorekit fetch` 产物 frontmatter 里的 `source_date` 都是路子
- ❌ **从图片/截图里扒日期写进 corpus**：那是二手考证，不是作者原话

## 禁止跨源污染（实体页铁律）

**实体页 / 概念页的 `## Compiled Truth` 和 `## Timeline` 的每一条都必须能 trace 回 corpus 内的某个 `[[原料页]]` 或已有 `[[知识库页]]`**。

本次 ingest 只能消化**本次的原料**。以下材料**不能**被当作"顺手的背景色"混进产物：

- `MEMORY.md` / `memory/*.md` 里的老日记条目
- 项目根 `CLAUDE.md` / 全局 `~/.claude/CLAUDE.md` 里的偏好
- 其他已 ingest 但本次不直接相关的原料页（除非做跨源综合判断且标明来源）
- 纯脑补推测（年份、月份、具体事件）

这些信息想进 corpus，走独立的 `wiki-fileback` 流程，带独立来源标记。

**自查**：实体页写完，逐条问"这句话的证据在哪个 `[[页面]]`？"——答不上来就删掉或改成"（未提及）"。

## Tools to use

- `lorekit fetch <url>` — 统一 URL 抓取入口（lorekit 项目自带，内部路由 fetch_rich / lark / WebFetch / 其它）
- `lorekit search "<q>"` — 精确查重（ripgrep）
- `lorekit vector query "<summary>"` — 模糊找相似页（v0.5+）
- `lorekit lint --quick` — 写完自检
- 底层：Read / Write / Edit / `mv` / `rm -rf`

## Output format

```
抓取：lorekit fetch → rich (L1, 12 images, 1 failed)
原文：mv 工作台/abc → 原料/剪藏/abc/
新建页面：
  - [[知识库/实体/张三]]
  - [[知识库/概念/RAG 评估]]
更新页面（追加 timeline）：
  - [[知识库/实体/lorekit]]
反向链接：已建 N 条
日期来源：原文标注 2026-04-04
lint：PASS / 发现 X 个问题（已列出）
```

**铁律**：
1. 原文 **mv**（不是 cp）到 `原料/`，工作台那份搬完就不存在
2. 有主语的分析必须移走，`原料/` 只放原文
3. 至少一条反向链接，防孤岛
4. Notability gate 未过的实体不建独立页，只追加 timeline
5. 日期必须核实，禁止猜测年份
