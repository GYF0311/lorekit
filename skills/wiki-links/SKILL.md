---
name: wiki-links
description: 处理 corpus wikilink 闭环：为缺失链接给出 suggest，执行 safe fix，创建 stub，写 missing-nodes backlog，或把一次性提及转纯文本。触发词：links、断链、缺失节点、stub、backlog、修链接、关账前链接闭环。
---

# wiki-links

为新写入或被修改的 wiki 页做 links closure。目标是让 `wiki-ingest` / `wiki-fileback` 在完成前没有 P0 断链，同时不把一次性提及硬建成知识节点。

## When to trigger

- 用户说"修链接"、"检查断链"、"建 stub"、"missing nodes"
- `wiki-ingest` / `wiki-fileback` 写完页面，准备关账前
- `wiki-lint` 报出 broken wikilinks，需要进入处理流程

## Decision tree

1. 先跑：

```bash
lorekit links suggest --file "<file>" --json --write-state
```

2. 按每条建议选择动作：

| 情况 | 命令 | 原则 |
| --- | --- | --- |
| 明显同一页：大小写、别名、路径漂移 | `lorekit links fix "<label>" --to "<canonical-slug>" --alias "<label>" --file "<file>"` | 可自动修，优先用 `--file` 限定本次页面 |
| 应该有独立知识节点，但目前没有内容 | `lorekit links stub "<label>" --type concept|entity --source "<file>"` | 建最小 stub，后续再补 |
| 可能有价值，但本次证据不足 | `lorekit links backlog "<label>" --type concept|entity --source "<file>"` | 写 `系统/missing-nodes.md` |
| 只是一次性提及 | `lorekit links plain "<label>" --file "<file>"` | 转纯文本，不污染图谱 |

3. 再跑一次 `lorekit links suggest --file "<file>" --json --write-state`，确认没有 P0 unresolved。

## Stub boundary

只给未来确实会被复用的节点建 stub。stub 必须有合法 frontmatter、标题、一个短 `## Status`，并说明它是缺内容的占位页。

不要为了“清零断链”给所有名词建 stub。人名、工具名、概念名只有满足 Notability gate（以后会主动引用）才建页。

## Backlog boundary

`系统/missing-nodes.md` 是暂存清单，不是失败状态。适合：

- 本次来源提到一次，但上下文不足
- 可能需要未来补资料
- 暂时不确定属于 concept / entity / topic

每条 backlog 必须有 `type` 和 `source`，让以后批量处理时知道它第一次出现在哪里；需要额外解释时，在 `系统/missing-nodes.md` 里补人类备注。

## Output format

```text
links closure:
  fixed: 2
  stubs: 1
  backlog: 1
  plain: 3
  unresolved_p0: 0
```
