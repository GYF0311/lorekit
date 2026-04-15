---
name: wiki-ingest
description: 把新内容摄入 corpus，按 filing-rules 落盘并建反向链接。触发词：ingest、存一下、整理进知识库、收藏、归档，或用户直接发 URL / 文件路径。
---

# wiki-ingest

把外部内容（URL / 文件 / 粘贴文本）摄入到当前 corpus，按主语落盘、建反向链接、通过 lint 自检。

## When to trigger

- 用户发来 URL / 文件路径 / 粘贴一段外部内容
- 用户说"ingest 这个"、"存一下"、"整理进知识库"、"收藏"、"归档一下"、"记录下来（配外部资料）"
- 录音整理、剪藏、公众号文章等外部资料进入 corpus 的场景

**不要触发**：
- 对话中的洞察/决定/事实要存回 —— 那是 `wiki-fileback`（输入是对话，不是外部资料）
- 只是查询已有内容 —— 那是 `wiki-query`
- 从日记里定期提炼 —— 那是 `wiki-enrich`

## Decision tree

1. **抓取内容**
   - URL 公众号/带图 → `fetch-rich`
   - URL 需要登录/反爬 → `web-access`
   - 一般 URL → `WebFetch`
   - 本地文件 → 直接 Read
2. **解析**：抽取标题、作者、日期、关键实体
3. **查重**：`wiki search "<title>"` + `wiki search "<关键实体>"`
   - 命中既有页 → update 分支（走到第 6 步，追加 timeline）
   - 没命中 → create 分支
4. **原文落地**：原文件永远保留在 `60_来源/`（文章 / 会议纪要 / 公众号原文 / 书籍笔记 ...），**只读**
5. **判断主语**（见 `99_系统/filing-rules.md`）：
   - 主题是人 → `10_人物/<人名>.md`
   - 主题是项目 → `20_项目/<项目名>.md`
   - 主题是概念/方法 → `30_概念/<概念名>.md`
   - 主题是事件 → `40_事件/<事件名>.md`
   - 一条内容可能有多个主语，**每个主语都要处理**
6. **Notability gate**（决定建新页还是追加 timeline）
   - 问："下次我会不会主动引用这个实体？"
   - 是 → 新建页面：frontmatter + `## Compiled Truth` + `---` + `## Timeline`（首条）
   - 否 → 找最近相关页，往 `## Timeline` 追加一条，**禁止新建**
7. **建反向链接**（铁律：**至少一条**，防孤岛）
   - 页面里提到的所有 `[[人物]]` / `[[项目]]` / `[[概念]]` 都要确认目标页存在
   - 目标页也要在 timeline 留下一条反向引用
8. **自检**：`wiki lint --quick`，有问题就修到没问题再汇报
9. **汇报**

## Tools to use

- `wiki search "<q>"` — 精确查重（ripgrep 实现）
- `wiki vector query "<summary>"` — 模糊找相似页（可选，v0.5+）
- `wiki lint --quick` — 快速自检 frontmatter / 断链 / 孤岛
- `fetch-rich` / `web-access` / `WebFetch` — 按站点类型选抓取工具
- 底层文件操作：Read / Write / Edit

## Output format

向用户汇报时必须包含：

```
原文：<60_来源/.../xxx.md>
新建页面：
  - [[人物/张三]]
  - [[概念/RAG 评估]]
更新页面（追加 timeline）：
  - [[项目/lorekit]]
反向链接：已建 N 条
lint：PASS / 发现 X 个问题（已列出）
```

**铁律复述**：
1. 原文保留在 `60_来源/`，有主语的分析必须移走
2. 至少一条反向链接
3. Notability gate 未过的实体不建独立页，只追加 timeline
