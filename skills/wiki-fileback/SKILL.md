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
2. **识别主语**（按 `99_系统/filing-rules.md`）
   - 谁/哪个项目/哪个概念 是这条内容的"主角"？
   - 一条内容可以有多个主语 → 每个主语都要处理
3. **定位目标页**：`wiki search "<主语>"`
   - 命中 → update 分支
   - 未命中 → 过 Notability gate，决定新建还是挂到最近相关页
4. **写入格式**（严格）：
   - 只追加到 `## Timeline` 段落，**永不改写 compiled truth**
   - 条目格式：`- YYYY-MM-DD HH:mm — <一句话事实/决定/洞察>（来源：对话）`
   - 如涉及其他实体，用 `[[wikilink]]` 引用
5. **反向链接**：如果这条 timeline 提到别的主语页，对方也要追加一条反向条目
6. **自检**：`wiki lint --quick`
7. **汇报**

## Tools to use

- `wiki search "<主语>"` — 定位目标页
- `wiki lint --quick` — 写完自检
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
