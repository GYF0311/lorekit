---
name: wiki-lint
description: 对 corpus 做健康检查，扫 frontmatter 合规、断链、孤岛、重复、过期、工作台清理，只报告不自动修。触发词：lint、体检、检查 corpus、看看有没有问题、知识库健康。
---

# wiki-lint

给 corpus 做一次健康检查。**只报告，不自动修**——任何修改都要用户或后续 skill 明确决定。每条问题必须给出可执行的修复建议。

## When to trigger

- 用户说"lint 一下"、"体检"、"检查 corpus"、"看看有没有问题"
- 用户说"知识库最近有啥毛病"、"health check"
- `wiki-ingest` / `wiki-fileback` 写完后的 `--quick` 自检
- 周期性维护（例如每周一次）

**不要触发**：
- 用户要定期从日记提炼 → 那是 `wiki-enrich`
- 用户要写新内容 → `wiki-ingest` / `wiki-fileback`

## Decision tree

根据用户意图选模式：

1. **`wiki lint --quick`**（ingest/fileback 自检用）
   - frontmatter schema 合规
   - 新写入页的断链
   - 新写入页是否有至少一条反向链接
2. **`wiki lint`**（默认 / 用户显式触发）
   - 上面全部 +
   - 断链（所有 `[[...]]` 指向的目标页是否存在）
   - 孤岛（没有任何反向链接的页面）
   - 重复 / 高度相似页（标题相近或内容向量相似）
   - 过期：`valid_until` 早于今天
   - 矛盾：同一主语在不同页的 compiled truth 互相冲突
3. **`wiki lint --workbench`**（工作台清理）
   - 扫 `_工作台/` 下按过期策略（7 / 14 / 30 天）老化的条目
   - 对每条追问："入库还是扔"

**关键原则**：lint **输出是 diagnostics 列表**，不是 diff。用户点头后才交给相应 skill 处理（拆重复 → wiki-ingest，修断链 → 人工或 fileback）。

## Tools to use

- `wiki lint` / `wiki lint --quick` / `wiki lint --workbench` — 主命令
- `wiki doctor` — 每日体检（frontmatter / 断链 / 元数据一致性的子集）
- `wiki search` — 验证断链目标
- 底层：Read / Grep

## Output format

按严重级别分组输出，每条问题带可执行建议：

```
=== wiki lint 报告 ===
corpus: <path>
扫描页数: 342

[ERROR] frontmatter 缺失（2 条）
  - 30_概念/RAG.md：缺 updated_at
    修复：在 frontmatter 补 updated_at: 2026-04-15 22:30
  - ...

[WARN] 断链（5 条）
  - 20_项目/lorekit.md 引用 [[gbrain]]，目标不存在
    修复：(a) 新建 30_概念/gbrain.md；(b) 改为 [[gbrain 页]]；(c) 删除此链接

[WARN] 孤岛（3 条）
  - 10_人物/李四.md 没有任何反向链接
    修复：ingest 一条提到[[李四]]的内容，或评估是否合并

[INFO] 可合并的相似页（2 组）
  - 30_概念/RAG.md  vs  30_概念/检索增强生成.md
    修复：人工 review 后合并到 RAG.md，把另一篇 redirect

[INFO] 过期（valid_until 已到）（1 条）
  - 20_项目/求职.md：valid_until 2026-03-31
    修复：review 并更新 compiled truth，或延长 valid_until
```

**铁律**：
1. 只报告，不自动改
2. 每条都有具体的修复命令 / 建议
3. 报告写进 `99_系统/_CHANGELOG.md`（追加一行本次 lint 摘要）
