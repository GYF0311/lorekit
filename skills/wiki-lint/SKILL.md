---
name: wiki-lint
description: 对 corpus 做健康检查，扫 frontmatter 合规、断链、孤岛、重复、过期、工作台清理，并按需输出 JSON/plan 或执行 safe fix。触发词：lint、体检、检查 corpus、看看有没有问题、知识库健康。
---

# wiki-lint

给 corpus 做一次健康检查。默认只报告；用户或上游流程明确要求时，可用 `lorekit lint plan` 生成修复计划，或用 `lorekit lint fix --safe` 只执行无争议安全修复。每条问题必须给出可执行的修复建议。

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

1. **`lorekit lint --quick`**（ingest/fileback 自检用）
   - frontmatter schema 合规
   - 新写入页的断链
   - 新写入页是否有至少一条反向链接
2. **`lorekit lint`**（默认 / 用户显式触发）
   - 上面全部 +
   - 断链（所有 `[[...]]` 指向的目标页是否存在）
   - 孤岛（没有任何反向链接的页面）
   - 重复 / 高度相似页（标题相近或内容向量相似）
   - 过期：`valid_until` 早于今天
   - 矛盾：同一主语在不同页的 compiled truth 互相冲突
3. **`lorekit lint --workbench`**（工作台清理）
   - 扫 `_工作台/` 下按过期策略（7 / 14 / 30 天）老化的条目
   - 对每条追问："入库还是扔"

4. **`lorekit lint --json`**（agent / CI 读）
   - 输出结构化 diagnostics，不夹杂人类说明
   - 适合和 `doctor --json --strict` 一起做 gate
5. **`lorekit lint plan`**（准备修复）
   - 输出 proposed actions，不改文件
   - 复杂项（近重复、语义矛盾、Compiled Truth 改写）只能进 plan
6. **`lorekit lint fix --safe`**（安全修复）
   - 只做确定性修复，例如缺失安全 frontmatter、系统文件 `graph-excluded: true`、索引刷新提示
   - 不自动合并页面，不自动创建语义节点，不自动改写事实综述

**关键原则**：默认 lint 输出 diagnostics；`lint plan` 输出计划；只有 `lint fix --safe` 可以改文件，且只能做无争议修复。断链闭环优先交给 `wiki-links`。

## Tools to use

- `lorekit lint` / `lorekit lint --quick` / `lorekit lint --workbench` — 主命令
- `lorekit lint --json` / `lorekit lint plan` / `lorekit lint fix --safe` — 机器输出、修复计划、安全修复
- `lorekit doctor` / `lorekit doctor --json --strict` — 每日体检与严格门禁
- `lorekit links suggest/fix/stub/backlog/plain` — 断链闭环
- `lorekit search` — 验证断链目标
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
  - 知识库/实体/lorekit.md 引用 [[gbrain]]，目标不存在
    修复：(a) 新建 知识库/概念/gbrain.md；(b) 改为 [[gbrain 页]]；(c) 删除此链接

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

1. 默认只报告；只有显式 `lorekit lint fix --safe` 才改文件
2. 每条都有具体的修复命令 / 建议
3. `lorekit lint plan` 只能产计划，不能偷偷修改
4. 报告写进 `系统/_CHANGELOG.md`（追加一行本次 lint 摘要）
5. 完整报告写入 `corpus/输出/体检报告/lint-YYYY-MM-DD.md`（frontmatter 必含 `graph-excluded: true`）

## 本轮新增检查项（共 6 项 + 规模哨兵）

在 `lorekit lint` 默认模式里加入以下 6 项 + 规模提醒。前 4 项保障 Read 路径，后 2 项用 B2.3 新增 frontmatter 字段做质量沉淀。

### 基础 4 项（Read 路径保障）

1. **`_INDEX.md` 覆盖度**
   - 扫 `原料/` / `知识库/` / `输出/` 等有内容的子目录
   - 每个有 `.md` 内容的子目录都必须有对应 `_INDEX.md`（`lorekit index` 自动产出）
   - 缺失 → `[WARN] _INDEX.md 缺失：<dir>`，修复建议 `lorekit sync`

2. **`index.md` ↔ 实际页面一致性**（漂移检查）
   - 比对 `corpus/index.md` 受控区登记的页面 vs 实际文件系统
   - 漂移 1：`index.md` 登记了但文件不存在 → `[ERROR] index.md 登记的 [[xxx]] 不存在`
   - 漂移 2：有页面但 `index.md` 没登记 → `[WARN] 页面 xxx 未登记到 index.md`
   - 修复建议：`lorekit sync`（merge-refresh 会处理）

3. **系统文件隔离（`graph-excluded: true`）**
   - 必填清单：`index.md` / `log.md` / `QUESTIONS.md` / `overview.md` / `输出/**/*.md` / `系统/**/*.md`
   - 缺失此字段 → `[WARN] 系统文件未隔离：<file>`，修复：frontmatter 补 `graph-excluded: true`

4. **frontmatter 必填字段合规**
   - 所有 `知识库/**/*.md` 与 `原料/**/*.md` 必含：`type` / `title` / `slug` / `created` / `updated`
   - 缺字段 → `[ERROR] frontmatter 缺 <field>：<file>`，修复建议给出具体字段与示例值

### 沉淀质量 2 项（利用 B2.3 新增字段）

5. **SHA-256 完整性**
   - 扫所有带 `raw_sha256` 字段的 source 页
   - 根据 frontmatter 记录的原料路径 + 字段值，重算对应原料文件的 SHA-256
   - 对比：不一致 → `[ERROR] ⚠ SOURCE MODIFIED：<wiki-page>`，原料哈希与 wiki 页记录的 `raw_sha256` 不符
   - 修复建议：re-ingest 此来源，重写 Timeline 记录"来源更新"
   - **老页无 `raw_sha256` 字段的**：**跳过**，不误报。老页走渐进补齐，不追溯

6. **Stale 页面**（时效衰减）
   - 扫所有带 `domain_volatility` 字段的 concept 页
   - 按阈值判 `last_reviewed` 距今是否过期：
     - `domain_volatility: high` → 阈值 **90 天**
     - `domain_volatility: medium` → 阈值 **180 天**
     - `domain_volatility: low` → 阈值 **365 天**
   - 超阈值 → `[INFO] concept 页已 stale：<page>（last_reviewed N 天前，volatility=X）`
   - 修复建议：review compiled truth，刷新后改 `last_reviewed: YYYY-MM-DD`
   - **老页无 `domain_volatility` 字段的**：**跳过**，不误报

### 规模哨兵（逐目录独立判，非报错只提醒）

7. **`corpus/index.md` 行数**
   - 行数 > 100 → 输出提示：`[INFO] index.md 已 X 行（>100），考虑升级到阶段 2（index 压缩 + _INDEX 承担全量列表）`
   - **非错误**，只是提醒先生"规模到了，该想结构升级了"

8. **任一 `_INDEX.md` 行数**
   - **逐目录独立判**：扫每个 `_INDEX.md`，只看该文件本身，不看邻居
   - 行数 > 200 → 输出提示：`[INFO] <dir>/_INDEX.md 已 X 行（>200），考虑该子目录分流`
   - **局部触发原则**：只判该目录，邻居目录无关；对应 IDEAS 中"图书馆分形演化"思路
   - **不自动触发任何迁移动作**——CLI 不会改文件，等先生自己决策如何拆分

**注意**：规模哨兵是软提示，不进 ERROR / WARN 级别，走 INFO 级别。目的是把"何时升级结构"的决策点暴露出来，避免 corpus 悄悄膨胀到难以治理。

## 延后的检查项（本轮不做）

| 检查项 | 延后原因 |
| --- | --- |
| 近重复 concept（Jaccard > 0.7） | 规模触发（concept ≥ 50 页再做） |
| Wikilink 格式铁律（英文 slug 强制） | 保留中文 wikilink 现状，老页不迁移 |
| Stub 检测 | 交给 `lorekit links stub` 与 `系统/missing-nodes.md` 先承接 |
| aliases 重叠 | 等跨语言碎裂痛点出现再做 |
