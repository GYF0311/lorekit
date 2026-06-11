---
name: wiki-query
description: 从 corpus 检索已有内容并综合答案，按精确/模糊/图遍历三层路由。触发词：查、找、搜、知识库里有没有、记得吗、之前说过、关于 XXX。
---

# wiki-query

从当前 corpus 回答问题。核心是三层检索决策 + 答案必须标注来源 + corpus 没有就诚实说没有。

## When to trigger

- 用户说"查一下 XXX"、"找一下 XXX"、"搜 XXX"
- 用户说"我之前整理过 XXX 吗"、"记得 XXX 吗"、"之前说过 XXX"
- 用户问"关于 XXX 我都有什么资料"
- 用户抛一个概念性问题，且明显在问已有知识库，而不是要上网

**不要触发**：

- 查询后用户说"把这个记下来" → 交给 `wiki-fileback`
- 用户给了新外部资料要存 → 交给 `wiki-ingest`
- 用户在问需要上网的新知识 → 用 `WebSearch` / `WebFetch`

## 默认查询顺序

**铁律**：先走确定性文本层，不先启动重型召回流程。

默认顺序：

1. `rg` / `lorekit search "<q>"` 找精确词、实体名、文件名和短语。
2. Read `corpus/index.md` 定位知识分区。
3. Read `{dir}/_INDEX.md` 缩小到候选页。
4. Read 具体 `知识库/` canonical page，再按页内 wikilink 追 1-2 跳。

## Decision tree

按 query 类型选层：

### 1. 精确关键词（实体名 / 文件名 / 具体词）

先走 `lorekit search "<q>"`（ripgrep fallback）。命中就读对应页面。

### 2. 模糊语义（概念性 / 意图类 / "跟 X 相关的东西"）

- Read `corpus/index.md` / `知识库/` → AI 按语义选 1-3 个分区
- Read `{选中分区}/_INDEX.md` → 选具体页
- Read 具体 `.md` 文件 → 综合答案
- 只有需要完整 provenance 时才打开 `原料/`；project-local evidence / `_工作台/**` 只在当前任务点名时读取，不作为默认召回层

### 3. 多跳推理（"A 相关 B 的 C"）

在第 2 步基础上，沿候选页的 `[[wikilinks]]` 递归遍历 1-2 步，综合。

---

**大部分真实 query 是组合**：先精确找锚点（第 1 步），再沿语义展开（第 2 步），最后拉链接（第 3 步）。

## Tools to use

- `lorekit search "<q>"` — 精确 ripgrep/fallback 检索
- Read `corpus/index.md` / `{dir}/_INDEX.md` / 具体文件
- 底层：Grep（复杂匹配时用）

## Output format

综合答案时必须遵守：

1. **每条信息标注来源** `[[页面名]]`，用户能直接跳过去
2. **如果 corpus 没相关内容**，诚实说"corpus 里没有关于 XXX 的内容"，**永远不要瞎编**
3. **给出检索路径**（可折叠），方便用户判断是不是漏了
4. **末尾主动提议 fileback**（见下一节）

**铁律**：源页面 wikilink 必须真实存在；不要生造页面名。

## 溯源铁律（answer provenance）

每个核心结论必须追溯到具体的 `知识库/摘要/<slug>.md`（即 source 页），**禁止只引 concept 页**。原因：

- concept 页是 compiled truth（综合产物），**不是证据**
- source 页才是带 raw_sha256 的原始证据
- 只引 concept 页会让读者无法反查原文，属于"二手转述"级别的信任

**正确姿势**：`[[知识库/概念/RAG]] 定义了 RAG（引自 [[知识库/摘要/lewis-2020-rag]], [[知识库/摘要/rag-survey-2024]]）` — concept 页提供语义锚点，source 页提供证据。

**结论：每条核心论点必须至少有 1 个 `知识库/摘要/` 引用**；只有 concept / entity 没有 source 的引用不算完整答案。

## Confidence 标注（答案末尾必加）

答案末尾必须列出"Confidence Notes"节，展开每条核心引用的 confidence 级别：

```markdown
---

### ⚠ Confidence Notes

| 引用 | Confidence | 备注 |
| --- | --- | --- |
| [[知识库/概念/RAG]] | high | 5+ sources，先生已确认 |
| [[知识库/概念/HyDE]] | medium | 3 sources |
| [[知识库/摘要/xxx]] | low | 单源，未经交叉验证 |
```

- **low / medium confidence** 的引用必须**显式出现在 Confidence Notes 节**——先生读到这里才知道"这个结论只有一个来源，慎用"
- 答案正文里也可用视觉提示（如 `⚠`）标出 low confidence 的引用
- 若所有引用都是 high confidence，仍要输出此节，说明"全部 high confidence"

## 输出格式分流（按问题类型）

根据问题类型选输出形式（先生在问题里明示或你合理推断）：

| 问题类型 | 输出形式 | 说明 |
| --- | --- | --- |
| 普通问题 | Markdown 正文 | 默认 |
| 比较类（"A vs B"） | Markdown 表格 | 维度 × 对象矩阵 |
| 演示类（"给我做个分享 / 讲一下"） | Marp 幻灯片 | frontmatter 加 `marp: true` |
| 趋势类（"过去 N 个月如何变化"） | Python matplotlib 代码块 | 可直接复制运行 |
| 清单类（"列出所有 X"） | 结构化 bullet list | 分组 + 每条带 wikilink |

**注意**：复杂输出（Marp / matplotlib）落盘规则见下方 outputs 回盘小节；不是每次都要落盘，只有先生确认"值得留存"或价值门槛达到才落。

## Outputs 回盘（复用价值触发）

如果答案满足以下任一**复用价值**条件，自动写入 `corpus/输出/问答/YYYY-MM-DD-<slug>.md`：

- 跨多页综合的比较表 / 对比矩阵
- 深度分析（非单源复述、有新综合见解）
- 结构化清单（未来还会查第二遍）
- 先生明确说"这个答案存一下"

**落盘规范**：

- 路径：`corpus/输出/问答/YYYY-MM-DD-<slug>.md`
- frontmatter 必填 `graph-excluded: true`（系统文件隔离，不进图谱）
- 同时更新 `corpus/index.md` 的 **Recent Synthesis** 列表（在对应受控区追加一行）

**不落盘的情况**：单条事实查询（如"XX 的作者是谁"）、临时探索、corpus 里没找到答案。

## log 追加

query 结束后，在 `corpus/log.md` **末尾追加一行**：

```
## [YYYY-MM-DD HH:mm] query | <question 一句话简述>
```

用于先生回看"这个月都查了什么"。

## Query → Fileback 闭环（核心 UX）

**综合答案本身是新的知识产物**——它把 corpus 里分散的信息组合成了一个新的结论。这个结论
如果不存回去，下次还要重新综合一遍，浪费认知。所以 wiki-query 的**标准输出末尾必须带一个
明确的 fileback 提议**，让用户一句话决定要不要把今天的结论存回 corpus。

**输出模板**：

```
根据你的 corpus：

{综合答案，每条带 [[页面]] 引用}

引用来源：[[页面 A]] · [[页面 B]] · [[页面 C]]

---
💾 要把这个答案存回 corpus 吗？(Y/N)
  Y → 我会触发 `wiki-fileback`，按主语追加 timeline 条目
  N → 结束（不保存）
```

**分支**：

- **用户回 Y** → 交给 `wiki-fileback`，输入是刚才的综合答案 + 引用清单 + 用户的原始问题
  （用于判断主语和目标页）
- **用户回 N** 或没回 → 结束，不保存
- **答案没找到** → 不提议 fileback（没东西可存），改问"要不要我帮你上网搜一下？"
  或"要不要新建一个页面占坑？"
- **答案是**"corpus 里没有" → 同上，不提议 fileback

**为什么这个闭环重要**：

- 综合答案是 LLM 的劳动成果，不存下次就要重做
- 用户的关注点是**临时**从短期记忆变成**长期**沉淀的唯一入口
- 这是 corpus 从"静态数据"升级成"活知识"的核心机制
