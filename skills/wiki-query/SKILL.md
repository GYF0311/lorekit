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

## Decision tree

先判断 query 类型，再选检索层：

1. **有具体实体名 / 文件名 / 明确关键词** → **精确层**
   - `wiki search "<实体名>"` (ripgrep)
   - 命中就直接读对应 L2 页面
2. **概念性 / 模糊意图 / 时间模糊** → **模糊层**
   - `wiki vector query "<fuzzy intent>"`（两阶段层次检索）
   - 读 top 5 候选对应的 L2 文件
3. **多跳推理**（"跟 A 相关的 B 的 C"）→ **图遍历层**
   - 先模糊层拿候选
   - 沿候选页的 `[[wikilinks]]` 递归遍历 2 步
   - 综合

**大部分真实 query 是组合**：先精确找锚点，再沿链接展开。

## Tools to use

- `wiki search "<q>"` — 精确 ripgrep
- `wiki vector query "<q>"` — 模糊语义检索（v0.5+）
- `wiki show <page>` — 读某页完整内容
- `wiki links <page>` — 列出某页的所有 wikilinks（正反向）
- 底层：Read、Grep

## Output format

综合答案时必须遵守：

1. **每条信息标注来源** `[[页面名]]`，用户能直接跳过去
2. **如果 corpus 没相关内容**，诚实说"corpus 里没有关于 XXX 的内容"，**永远不要瞎编**
3. **给出检索路径**（可折叠），方便用户判断是不是漏了
4. **末尾建议下一步**：
   - 找到了 → "要不要基于这个继续 ingest 新资料？要不要把今天的讨论 fileback 回去？"
   - 没找到 → "要不要我帮你上网搜一下？" 或 "要不要新建一个页面占坑？"

**铁律**：源页面 wikilink 必须真实存在；不要生造页面名。
