---
name: wiki-lint
description: 对 corpus 做健康检查，扫 frontmatter 合规、断链、孤岛、来源可解析、复审到期（stale），只报告不自动修。触发词：lint、体检、检查 corpus、看看有没有问题、知识库健康。
---

# wiki-lint

给 corpus 做一次健康检查。**只报告，不自动修**——任何修改都要用户或后续 skill 明确决定。每条问题必须给出可执行的修复建议。

## When to trigger

- 用户说"lint 一下"、"体检"、"检查 corpus"、"看看有没有问题"
- 用户说"知识库最近有啥毛病"、"health check"
- `wiki-ingest` / `wiki-fileback` 写完后的 `--quick` 自检
- 周期性维护（例如每周一次）

**不要触发**：

- 用户要写新内容 → `wiki-ingest` / `wiki-fileback`

## Decision tree

根据用户意图选模式：

1. **`lorekit lint --quick`**（ingest/fileback 自检用）
   - v0.4.x 中是默认 lint 的兼容别名，用于避免自检命令参数漂移
2. **`lorekit lint`**（默认 / 用户显式触发）——CLI 实际检查项见下节
3. **工作台清理** → 交给 `wiki-triage` skill（on-demand 清算账单），不在 lint 范围

**关键原则**：lint **输出是 diagnostics 列表**，不是 diff。用户点头后才交给相应 skill 处理（拆重复 → wiki-ingest，修断链 → lorekit links(fix/stub/backlog/plain)）。

## Tools to use

- `lorekit lint` / `lorekit lint --quick` — 主命令
- `lorekit doctor` — 每日体检（frontmatter / 断链 / 元数据一致性的子集）
- `lorekit search` — 验证断链目标
- `lorekit links suggest/fix/stub/backlog/plain` — 断链处置闭环（AI 判断选哪种，CLI 执行）；`links plained` 查可重连的降级记录
- 底层：Read / Grep

## Output format

按严重级别分组输出，每条问题带可执行建议：

```
=== lorekit lint 报告 ===
corpus: <path>
扫描页数: 342

[ERROR] frontmatter 缺失（2 条）
  - 知识库/概念/RAG.md：缺 updated_at
    修复：在 frontmatter 补 updated_at: 2026-04-15 22:30
  - ...

[WARN] 断链（5 条）
  - 知识库/实体/lorekit.md 引用 [[fat skill]]，目标不存在
    修复：(a) 新建 知识库/概念/fat skill.md；(b) 改为 [[已有同义页]]；(c) 删除此链接

[WARN] 孤岛（3 条）
  - 知识库/实体/李四.md 没有任何反向链接
    修复：ingest 一条提到[[李四]]的内容，或评估是否合并

[INFO] 可合并的相似页（2 组）
  - 知识库/概念/RAG.md  vs  知识库/概念/检索增强生成.md
    修复：人工 review 后合并到 RAG.md，把另一篇 redirect

[INFO] 过期（valid_until 已到）（1 条）
  - 知识库/实体/求职.md：valid_until 2026-03-31
    修复：review 并更新 compiled truth，或延长 valid_until
```

**铁律**：

1. 只报告，不自动改
2. 每条都有具体的修复命令 / 建议
3. 报告写进 `系统/_CHANGELOG.md`（追加一行本次 lint 摘要）
4. 完整报告写入 `corpus/输出/体检报告/lint-YYYY-MM-DD.md`（frontmatter 必含 `graph-excluded: true`）

## CLI 实际检查项（v0.4.x `lorekit lint`）

本节与 `src/commands/lint.ts` 对齐；skills-cli-drift smoke test 防命令漂移，本节防能力描述漂移。

**硬性问题（计入失败，exit 1）**：

1. **frontmatter 必填字段**：`type` / `title` / `slug` / `created` / `updated`
   （`_工作台/` `_归档/` 与入口文档豁免）
2. **断链**：所有 `[[...]]` 指向的目标页必须可解析（共享 resolver，图片嵌入不误报；
   `知识库/模板/` 占位符豁免）
3. **孤岛**：无任何入链的页面（过渡区 / 模板 / `graph-excluded: true` 豁免）
4. **workbench-source-link**：知识库页把 `_工作台/` 当 source 引用
5. **unresolved-source**：知识库页 frontmatter 的 `原料/`、`知识库/` 来源引用解析不到真实文件

**软性提示（报告但不计入失败）**：

6. **backlogged-link**：已在 `系统/missing-nodes.md` 登记的待建节点（`lorekit links backlog` 闭环）
7. **stale-review**：`domain_volatility`（high/medium/low → 90/180/365 天）+ `last_reviewed`
   （缺省回退 `updated`）超复审窗口。无 volatility 字段的老页跳过，不误报。

### stale-review 的后续处置（AI 流程，非 CLI）

lint 报出复审到期页后，AI 按"列清单 + 预查建议"模式处理：

1. 汇总到期页清单（页面 / volatility / 距上次复核天数）
2. 对每页主动重查：重读 `原料/` 来源、必要时联网核实关键事实是否已变化
3. 给先生一份**结论级**建议：`无需改动，仅刷新 last_reviewed` / `建议更新：<具体点>`
4. 先生点头后才改页面内容；刷新 `last_reviewed: YYYY-MM-DD` 收尾

## CLI 未实现的检查（需要时 AI 手动做，不要假设命令存在）

| 检查项 | 现状 |
| --- | --- |
| SHA-256 SOURCE MODIFIED（原料被外部改动） | CLI 不重算哈希；AI 手动 `shasum -a 256` 对比 frontmatter `raw_sha256` |
| `valid_until` 过期 | 未落地；字段可写，检查靠 AI 扫描 |
| 重复 / 高度相似页、矛盾检测 | 未落地；规模触发后再评估（concept ≥ 50 页） |
| `_INDEX.md` 覆盖度、index.md 一致性 | 由 `lorekit sync` 的 merge-refresh 兜底，lint 不单独报 |
| 规模哨兵（index.md >100 行提醒） | 未落地；AI 体检时顺手 `wc -l` 即可 |
