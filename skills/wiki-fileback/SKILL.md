---
name: wiki-fileback
description: 把对话中产生的洞察/决策/事实按主语写回 corpus，追加 timeline 或新建页面。触发词：记一下、存下来、笔记、把刚才那个放进去、fileback、存回知识库。
---

# wiki-fileback

把**对话里**产生的新洞察、新决定、新事实按主语写回 corpus。和 `wiki-ingest` 的关键区别：输入不是外部资料，而是当前对话的对话记录/结论。

## When to trigger

- 用户说"这个记一下"、"存下来"、"做个笔记"、"把刚才那个放进去"
- 用户说"fileback"、"存回知识库"、"归档到 wiki"
- `wiki-query` 返回结果后，用户说"好，把今天聊到的这点补到这个页上"
- 对话里刚得出一个决定 / 结论 / 事实，用户示意要留痕

**不要触发**：

- 输入是 URL / 文件 / 外部资料 → 那是 `wiki-ingest`
- 只是随口说，用户没明确要存 → 不要自作主张
- 要从历史日记里批量提炼 → 那是 `wiki-enrich`

## Decision tree

1. **识别待存内容**：用户指向"刚才那段"、"今天聊的 X"，明确边界
2. **识别主语**（按 `系统/filing-rules.md`）
   - 谁/哪个项目/哪个概念 是这条内容的"主角"？
   - 一条内容可以有多个主语 → 每个主语都要处理
3. **定位目标页**：`lorekit search "<主语>"`
   - 命中 → update 分支
   - 未命中 → 过 Notability gate，决定新建还是挂到最近相关页
4. **写入格式**（严格）：
   - 只追加到 `## Timeline` 段落，**永不改写 compiled truth**
   - 条目格式：`- YYYY-MM-DD HH:mm — <一句话事实/决定/洞察>（来源：对话）`
   - 如涉及其他实体，用 `[[wikilink]]` 引用
5. **反向链接**：如果这条 timeline 提到别的主语页，对方也要追加一条反向条目
6. **同步档案与向量**（`lorekit sync`）：
   - 如果本次 fileback 新建了页面或修改了 `corpus/index.md`：**必须跑**
   - 如果只是往已有页面追加 timeline 一行：**可选**（summary 没变，L0/L1 向量也不会变；只有 chunk 级别会 sha 不同，但影响小）
   - 一条命令刷新 `_INDEX.md` + 增量嵌入 chunk + 刷 L0/L1 向量
7. **自检**：`lorekit lint --quick`
8. **汇报**

## Tools to use

- `lorekit search "<主语>"` — 定位目标页
- `lorekit sync` — 同步 `_INDEX.md` 和向量库（新建页面或改 index.md 后必跑）
- `lorekit lint --quick` — 写完自检
- 底层：Read / Edit（追加 timeline，**不要 Write 覆盖**）

## Output format

```
本次 fileback：
  - 内容：<一句话摘要>
  - 主语：<人物/项目/概念>
  - 目标：[[页面名]]（追加 timeline 1 条）
  - 反向链接：[[另一页]] 已追加
lint：PASS
```

**铁律**：

1. 只追加，不改写 compiled truth（那是 wiki-ingest 或人工 review 的职责）
2. 每条都要带时间戳和"来源：对话"标记
3. 不确定主语时先问用户，不要猜

## 价值判断：建 synthesis 页的阈值

fileback 的常规路径是"追加 Timeline"。但当本次 fileback 的内容**同时**满足以下**任一**条件时，**主动向先生提议升级为 synthesis 页**（`知识库/专题/<slug>.md`）：

- **跨源 ≥ 3 个 source** — fileback 内容综合了 3 个及以上 `知识库/摘要/` 的观点
- **有新综合见解** — 内容不是单源复述，而是对多源的新组合、新结论、新模型
- **先生明确立场** — 对话中先生说过"我认为..."、"我的立场是..."、"综合来看..."

**提议话术**：

```
本次 fileback 涉及多源综合（或："先生的明确立场"）。
这个答案建议升级为 `知识库/专题/<slug>.md`，作为独立的 synthesis 页留存，便于下次引用。
建不建？(Y/N)
  Y → 走"建 synthesis 页"流程（见下节），先做反向检验再建
  N → 只追加 Timeline，结束
```

## 反向检验（防回音室，建 synthesis 页前必做）

**REFLECT Stage 0 精神**：建 synthesis 页**前**必须主动搜索已有 source 中的**反驳证据**，把 echo chamber 的风险暴露出来。

**步骤**：

1. 从本次 fileback 的核心论点里抽 2-3 个关键词（专有名词 / 方法名 / 结论短语）
2. `lorekit search "<关键词>"` 扫 `知识库/摘要/` 与 `原料/`，找**反对 / 质疑 / 局限性**相关片段
3. 也可以反向 query：用 `lorekit vector query --hybrid --text "against <论点> / 反对 / 局限性 / critique"`
4. 根据检索结果分支：

   | 找到反驳来源 | 没找到反驳来源 |
   | --- | --- |
   | 在 synthesis 页的 `## Counter-evidence` 节**写入**所有反驳来源与具体分歧点 | 在 `## Counter-evidence` 节**明确标注**：`⚠ 回音室风险：未找到反驳来源，结论可能存在确认偏差` |

**为什么必做**：LLM 综合很容易形成"看到的都是支持证据"的回音室，特别当先生的 corpus 本身带有选择性收藏偏差时。Counter-evidence 节即使为空也要标注——"没反驳"是一个**信号**而不是沉默。

## 建 synthesis 页的规范

反向检验完成后，按 `知识库/模板/synthesis.md` 模板建页：

- 路径：`知识库/专题/<slug>.md`
- frontmatter 必填：`type: topic` + `source_count: <本次引用的 source 页数>` + `confidence: low|medium|high`（初始通常 low/medium，high 需先生确认）
- 必含节：`## Thesis` / `## Evidence` / `## Counter-evidence` / `## Synthesis` / `## Confidence Notes` / `## Limitations` / `## Sources` / `## Timeline`
- `source_count` 初始化为"本次引用的 `知识库/摘要/` 页数"（**个人写作不计**）
- Timeline 首条：`- YYYY-MM-DD（N sources）| 首次合成：<一句话 thesis>`

建完页后：

- 在被引用的每个 source 页的 Timeline 加一条反向引用（防孤岛）
- 跑 `lorekit sync` 刷 `_INDEX.md` + 向量
- 跑 `lorekit lint --quick` 自检
