---
type: plan
title: "Plan B：目录 + Skill + CLAUDE.md 升级"
slug: docs/plans/2026-04-19-route-b-schema-skill-upgrade
created: 2026-04-19
updated: 2026-04-19
status: draft
---

# Plan B：目录 + Skill + CLAUDE.md 升级

> 路线定位：**LLM 行为契约侧**（先生 corpus 目录 / skills SKILL.md / CLAUDE.md 规则）。
> 对应路线：先生今日确认的"两条路线"中的 "目录与 skill 以及 CLAUDE.md 的更新"。
> 另一路线见：[Plan A](./2026-04-19-route-a-cli-upgrade.md)。

## 目标

把今天讨论收束的 **harness 规则** 落地到三个位置：

1. 先生 corpus 的**目录骨架** + `系统/` 规范文档
2. lorekit `skills/wiki-*/SKILL.md` 的**行为契约**
3. `templates/default-corpus/CLAUDE.md` + 先生 corpus 根 `CLAUDE.md` 的**LLM 约束**

按 ROI 分批，最小化破坏性改动；所有破坏性动作前先 snapshot；全程**零 rm**（AGENTS.md 数据红线 + 全局 CLAUDE.md 删除红线）。

## 背景

先生的 corpus 已经是一个相当成熟的 LLM Wiki 实现（`系统/schema.md / filing-rules.md / frontmatter-spec.md` 已具备），与今天讨论的方向**70% 对齐**。本 plan 是**增量补强**，不是推倒重来。

关键对齐点：

- 沿用先生现有的 **Compiled Truth + Timeline** 双节结构（Timeline **已经承担** Evolution Log 功能，不引入独立字段）
- 沿用先生现有的 `写作/` 顶层（对外创作输出），与新增的 `原料/个人写作/`（个人写作作为原料）**语义严格分离**
- 沿用先生现有的 `系统/{schema,filing-rules,frontmatter-spec}` 三件套作为 schema 落地点

## 分批

### 批次 B1：先生 corpus 增量骨架补齐

**目标**：给先生 corpus 加上今天讨论的新目录和骨架文件，**全 mkdir + 新文件，零 mv 零 rm**。

**位置**：`/Users/gaoyifan/Desktop/OpenClaw-Base-Camp/corpus/`

**动作**（执行前先 `lorekit snapshot`）：

| 动作 | 对象 |
|------|------|
| mkdir | `原料/个人写作/` |
| mkdir | `输出/问答/` |
| mkdir | `输出/文章/` |
| mkdir | `输出/幻灯片/` |
| mkdir | `输出/图表/` |
| mkdir | `输出/体检报告/` |
| mkdir | `输出/空缺分析/` |
| mkdir | `知识库/模板/` |
| 新建文件 | `QUESTIONS.md`（frontmatter: `type: system-questions, graph-excluded: true`，正文含 Open Questions / Resolved Questions 两段） |
| 新建文件 | `overview.md`（frontmatter: `type: system-overview, graph-excluded: true`，正文含 Health Dashboard 占位表格） |

**验证**：

```bash
cd /Users/gaoyifan/Desktop/OpenClaw-Base-Camp/corpus
ls -la 原料/个人写作/ 输出/ 知识库/模板/
test -f QUESTIONS.md && test -f overview.md && echo ok
```

**回滚**：
- 新建目录可用 `rmdir`（空目录）清理
- 新建文件可用 `trash` 移动到回收站（不用 rm）

**产物**：先生 corpus 目录结构更新。

---

### 批次 B2：先生 corpus 的 `系统/` 规范更新

**目标**：把今天讨论的新目录、新规则反映到先生现有的 `系统/schema.md`、`系统/filing-rules.md`、`系统/frontmatter-spec.md`。

**位置**：`/Users/gaoyifan/Desktop/OpenClaw-Base-Camp/corpus/系统/`

**动作**：

#### B2.1 `系统/schema.md` 更新

- 目录结构图加新目录：
  - `原料/个人写作/`（personal-writing 作为原料落点）
  - `输出/{问答,文章,幻灯片,图表,体检报告,空缺分析}/`
  - `知识库/模板/`
  - 根下 `QUESTIONS.md` / `overview.md`
- 向量 include/exclude 规则更新：
  - exclude 加 `输出/**`
  - exclude 加 `知识库/模板/**`
  - 其他不变
- 新增小节「输出层（对外产物持久化）」说明
- 更新 `updated` 字段为当前日期

#### B2.2 `系统/filing-rules.md` 更新

路由表加 2 行：

| 内容类型 | 主语判断 | 目标目录 |
|---------|---------|---------|
| 自己写的原料型内容（草稿 / 投资笔记 / 思考随笔） | 自我写作作为 ingest 原料 | `原料/个人写作/` |
| query 答案 / Marp / 图表 / lint 报告 / gap 分析 | query/lint/reflect 产物 | `输出/{对应子目录}/` |

新增小节「个人写作分流原则」：

> `原料/个人写作/` vs `写作/` 的语义区别：
> - `原料/个人写作/` — 你写了但愿意被 LLM 二次处理的内容（ingest 成 wiki 页），`type: personal-writing`，**不计 source_count**（防自我背书）
> - `写作/` — 对外发表的成品（公众号 / 汇报 / 投稿），`type: writing`，成品期不被 ingest

更新 `updated` 字段。

#### B2.3 `系统/frontmatter-spec.md` 更新

新增"选填扩展字段"小节（不追溯老页，只要求新建页按需填）：

| 字段 | 类型 | 适用 | 说明 |
|------|------|-----|-----|
| `aliases` | string[] | concept / entity | 同义名 / 跨语言名（防碎裂） |
| `confidence` | enum: low/medium/high | concept / synthesis | 基于 source_count + 人类确认 |
| `domain_volatility` | enum: low/medium/high | concept | 时效衰减阈值（90/180/365 天） |
| `source_count` | int | concept / synthesis | 引用此概念的外部 source 数 |
| `last_reviewed` | date | concept | 最近一次审核日期 |
| `raw_sha256` | string (64 hex) | source | 原料文件哈希（SHA-256 完整性） |
| `last_verified` | date | source | 最近一次哈希验证日期 |
| `possibly_outdated` | boolean | source | 来源是否超过 2 年 |

新增 `type: personal-writing` 专用字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `confidence_at_writing` | enum | 写作时对内容的把握 |
| `status` | enum: draft/published/deprecated | 写作状态 |
| `superseded_by` | slug | 被新文章替代 |

更新 `type` 枚举：加入 `personal-writing`、`system-questions`、`system-overview`。

更新 `updated` 字段。

**验证**：三份规范文档 `updated` 刷新；LLM 读取这三份能看到新规则。

**产物**：先生 corpus `系统/` 下三份规范更新。

---

### 批次 B3：`知识库/模板/` 下 5 个页面模板

**目标**：给 LLM 建新页时一个"填空卡片"，保证字段结构一致、lint 不报错。

**位置**：`/Users/gaoyifan/Desktop/OpenClaw-Base-Camp/corpus/知识库/模板/`

**特别说明**：沿用先生现有 **Compiled Truth + Timeline** 双节结构，不引入飞书教程版的独立 Evolution Log（Timeline 已承担）。

**5 个模板**（frontmatter + 正文骨架，每份约 30-50 行）：

#### B3.1 `source.md` — 外部来源模板

frontmatter 字段：`type: source`, `title`, `slug`, `created`, `updated`, `source_url`, `source_author`, `source_date`, `source_kind`, `raw_sha256`, `last_verified`, `possibly_outdated`

正文骨架：
```markdown
# {{title}}

## Compiled Truth
（2-3 段客观摘要）

## Key Points
- ...

## Concepts Extracted
- [[知识库/概念/xxx]]

## Entities Extracted
- [[知识库/实体/xxx]]

## Contradictions
（与其他来源的分歧）

## Timeline
- YYYY-MM-DD | 首次 ingest
```

#### B3.2 `personal-writing.md` — 个人写作模板

frontmatter：`type: personal-writing`, `status`, `confidence_at_writing`, `topic_tags`, `superseded_by`, `raw_sha256`, `last_verified`

正文骨架：
```markdown
# {{title}}

## Core Argument
（核心论点）

## Key Claims
- ...

## Evidence Referenced
- [[知识库/摘要/xxx]] 提到了 ...

## Limitations
（立场的边界）

## Timeline
- YYYY-MM-DD | 写作完成
```

#### B3.3 `concept.md` — 概念模板

frontmatter：`type: concept`, `aliases`, `confidence`, `domain_volatility`, `source_count`, `last_reviewed`, `tags`

正文骨架：
```markdown
# {{title}}（{{English Name}}）

## Compiled Truth
（当下最好的理解，2-3 段）

## Key Points
- ...

## My Position
（先生的立场，与客观综述分离；来自 type: personal-writing 的 ingest）

## Contradictions
（来源分歧显式记录）

## Sources
- [[知识库/摘要/xxx]]

## Timeline
- YYYY-MM-DD（N sources）| 强化 / 修正 / 新增分歧：[描述]
```

#### B3.4 `entity.md` — 实体模板

frontmatter：`type: entity`, `entity_kind`, `aliases`, `tags`

正文骨架：
```markdown
# {{title}}

## Compiled Truth
（描述：人物/工具/机构/论文）

## Key Contributions
- ...

## Related Concepts
- [[知识库/概念/xxx]]

## Sources
- [[知识库/摘要/xxx]]

## Timeline
- YYYY-MM-DD | 首次建页
```

#### B3.5 `synthesis.md` — 专题模板

frontmatter：`type: topic`, `source_count`, `confidence`, `tags`

正文骨架：
```markdown
# {{title}}

## Thesis
（主论点）

## Evidence
- [[知识库/摘要/xxx]] 支持 ...

## Counter-evidence
（Stage 0 反向检验结果；若无反对来源标注"⚠ 回音室风险"）

## Synthesis
（跨源综合见解）

## Confidence Notes
（置信度说明）

## Limitations
（边界条件）

## Sources
- [[知识库/摘要/xxx]]

## Timeline
- YYYY-MM-DD（N sources）| 首次合成
```

**验证**：LLM 新建 concept 页时能读 `知识库/模板/concept.md` 并按字段填空。

**产物**：先生 corpus 知识库/模板/ 下 5 个模板就位。

---

### 批次 B4：lorekit `skills/wiki-*/SKILL.md` 行为契约升级

**目标**：把 harness 规则写进 skill 行为剧本，让 LLM 每次执行时自动按新规则走。

**位置**：`/Users/gaoyifan/code/lorekit/skills/`

**动作**：

#### B4.1 `skills/wiki-ingest/SKILL.md`

增加 step：

- **来源类型判断**（优先级）：
  1. frontmatter `type: personal-writing` → personal 流程
  2. 路径含 `原料/个人写作/` → personal 流程
  3. 其他 → 外部来源标准流程
- **aliases 对齐检查**（ingest 前必做）：
  - 生成当前概念的英文 slug
  - 扫 `知识库/概念/*.md` 的 `aliases` 字段
  - 若匹配到已有页 → 追加 timeline，不新建
- **SHA-256 记录**（source 页必做）：
  - 计算原料文件哈希
  - 写入 source 页 frontmatter `raw_sha256` + `last_verified`
  - 超过 2 年的源加 `possibly_outdated: true`
- **Timeline 语义明确化**（替代 Evolution Log）：
  - 强化 / 修正 / 新增分歧 三类标注
  - 格式：`- YYYY-MM-DD（N sources）| [标注]：[变化描述]`
- **QUESTIONS.md 匹配**（ingest 结束前）：
  - 读 `QUESTIONS.md` 的 Open Questions 列表
  - 若新来源能回答某问题 → 提示先生"是否立即 QUERY"

#### B4.2 `skills/wiki-query/SKILL.md`

增加 step：

- **溯源铁律**：每个核心结论必须追溯到具体 `知识库/摘要/<slug>.md`，禁止只引 concept 页
- **Confidence 标注**：答案末尾列出所有引用的 confidence 级别；low/medium 标 "⚠ Confidence Notes"
- **outputs 回盘**：若答案有复用价值，自动写入 `输出/问答/YYYY-MM-DD-<slug>.md`（frontmatter 含 `graph-excluded: true`），更新 `index.md` Recent Synthesis
- **log 追加**：`log.md` 末尾加 `## [YYYY-MM-DD] query | <question>`

#### B4.3 `skills/wiki-fileback/SKILL.md`

增加 step：

- **价值判断阈值**：
  - 跨源 ≥ 3 个 source
  - 有新综合见解（不是单源复述）
  - 或先生明确立场
- **自动建议**：达到阈值 → 主动问"这个答案建议升级为 `知识库/专题/<slug>.md`，建不建？"
- **反向检验（防回音室）**：建 synthesis 页前**必须**搜索已有 source 中的反驳证据；若无反对来源，在 `Counter-evidence` 节标注 "⚠ 回音室风险：未找到反驳来源，结论可能存在确认偏差"（对应 Karpathy REFLECT Stage 0 精神，收敛在 fileback 环节做）
- **建页时**：用 `synthesis.md` 模板；source_count 初始化

#### B4.4 `skills/wiki-lint/SKILL.md`

本轮增加的检查项（对应 Read 路径保障 + 沉淀质量基础，**共 6 项 + 规模哨兵**）：

**基础 4 项**（Read 路径保障）：
- `_INDEX.md` 覆盖度（所有有内容子目录都该有）
- `index.md` ↔ 实际页面一致性（漂移检查）
- 所有系统文件（`index.md / log.md / QUESTIONS.md / overview.md / 输出/*`）必须有 `graph-excluded: true`
- frontmatter 必填字段合规（`type / title / slug / created / updated`）

**沉淀质量 2 项**（利用 B2.3 新增的 frontmatter 字段）：
- **SHA-256 完整性**：检查带 `raw_sha256` 字段的 source 页，重算原料文件哈希对比；不一致报 "⚠ SOURCE MODIFIED"。**老页无 `raw_sha256` 字段跳过**，不误报。
- **Stale 页面**：检查带 `domain_volatility` 的 concept 页，`last_reviewed` 距今是否超阈值——`high=90d / medium=180d / low=365d`。**老页无 `domain_volatility` 字段跳过**，不误报。

**规模哨兵**（**逐目录独立判，非报错只提醒**，对应 IDEAS 中"图书馆分形演化"的局部触发原则）：
- `corpus/index.md` 行数超 100 → 提示 "考虑升级到阶段 2（index 压缩 + _INDEX 承担全量列表）"
- 任一 `_INDEX.md` 行数超 200 → 提示 "考虑该子目录分流"（**只判该目录，不看邻居**）
- 不自动触发任何迁移动作，只输出提示，等先生决策

**延后的检查项**（本 plan 不做，列入未来批次）：
- 近重复 concept（Jaccard > 0.7）：规模触发（concept ≥ 50 页再做），决策 2 (y)
- Wikilink 格式铁律（英文 slug 强制）：保留现状，决策 1 (i)
- stub 检测：字数方案废弃，改成"纯空正文 / 必填 section 缺失"再实现（见 Plan A IDEAS）
- aliases 重叠：等跨语言碎裂痛点出现再做

#### B4.5 新增 `skills/wiki-output/SKILL.md`

- **触发词**：Marp 幻灯片 / 对外文章 / matplotlib 图表 / 汇报 / 演讲稿
- **动作**：读 `知识库/` 相关页 → 按输出类型生成 → 落 `输出/{子目录}/YYYY-MM-DD-<slug>.*`
- **产出形式**：
  - Marp 幻灯片：`.md`（含 `marp: true` frontmatter）
  - matplotlib 图表：`.py`（可跑）
  - 对外文章：`.md`（可投公众号）
- **不回流**：输出属于终态产物，不自动 fileback（除非先生明确）

**验证**：
```bash
cd ~/code/lorekit
npm run verify
```

**产物**：一个 commit：
`feat(skills): harness 规则升级（ingest/query/fileback/lint + 新 wiki-output）`

**回滚**：单 commit revert。

---

### 批次 B5：`templates/default-corpus/CLAUDE.md` + `AGENTS.md` 规则补充

**目标**：把 harness 规则写进默认 corpus 的 schema 层（LLM 契约），让未来新 corpus 一开始就带新规则。

**位置**：`/Users/gaoyifan/code/lorekit/templates/default-corpus/CLAUDE.md` + `AGENTS.md`

**动作**：新增以下 sections（**共 8 项**，Wikilink 铁律按决策 1 (i) 不加，保留现状）：

1. **Personal-writing 分流规则**（type 判断优先级 + 不计 source_count）
2. **aliases 对齐规则**（ingest 前检查 + 中英文填 aliases）
3. **Timeline / Evolution 规则**（强化 / 修正 / 新增分歧 三类标注）
4. **Outputs 持久化规则**（query 答案必须回盘）
5. **QUESTIONS.md 匹配规则**（ingest 时自动检查）
6. **Confidence 门控规则**（5+ source 候选 high 要人类确认）
7. **SHA-256 完整性规则**（lint 检测 SOURCE MODIFIED 触发 re-ingest）
8. **反向检验规则**（建 synthesis 页前必须搜反驳证据，无则标回音室风险）
9. **系统文件隔离**（graph-excluded: true 清单）

**不加**：Wikilink 格式铁律（保留现状；决策 1 (i)；老页中文 wikilink 不迁移）。

**验证**：
```bash
# 新临时目录 init 后
lorekit init /tmp/test-corpus
grep -c "personal-writing\|aliases\|confidence\|SHA-256\|反向检验" /tmp/test-corpus/CLAUDE.md
```

**产物**：一个 commit：
`docs(templates): CLAUDE.md/AGENTS.md 加入 harness 新规则`

**回滚**：单 commit revert。

---

### 批次 B6：先生现有 corpus 的 `CLAUDE.md` / `AGENTS.md` 同步

**目标**：把批次 B5 的新规则**手工 merge** 到先生现有 corpus 根的 `CLAUDE.md` / `AGENTS.md`，保留先生个性化部分。

**位置**：`/Users/gaoyifan/Desktop/OpenClaw-Base-Camp/corpus/`

**动作**：

1. 先 `lorekit snapshot`
2. 读先生现有 `CLAUDE.md` 与 `AGENTS.md`
3. 识别先生个性化内容（先生画像 / 主工作区路径 / 安全红线 / 日常工作流等）—— **保留**
4. 将批次 B5 的 9 个新 sections **增量加入**（不覆盖旧内容）
5. 更新 frontmatter `updated`

**验证**：
- 新规则 9 项都能在 CLAUDE.md 搜到
- 先生的个性化部分完整保留（逐项对比）

**产物**：先生 corpus 根文件更新。

**回滚**：snapshot restore。

---

### 批次 B7：skill 同步到 `~/.claude/skills/`

**目标**：让 LLM 下一次对话就用上新 skill 行为。

**动作**：
```bash
cd ~/code/lorekit
lorekit install-skills --target claude-code
```

**验证**：
```bash
ls -la ~/.claude/skills/wiki-ingest ~/.claude/skills/wiki-query ~/.claude/skills/wiki-fileback ~/.claude/skills/wiki-lint ~/.claude/skills/wiki-output
# 确认所有 skill 存在，新增 wiki-output 也在
```

**产物**：`~/.claude/skills/` 更新。

**回滚**：把 `~/.claude/skills/wiki-*` 软链删掉（这个是软链，不是数据，trash 即可）重新 install 上一版。

---

### 批次 B8：标定测试（Calibration，至少跑 2 篇真实 ingest 验证新规则）

**目标**：新规则上线后不是直接铺开使用，先跑 2 篇真实 ingest 验证 LLM 行为**符合预期**、**不退化**。

**动作**：

1. 挑 2 篇 `原料/文章/` 或 `原料/剪藏/` 下的既有文章（或新剪一篇）
2. 按 wiki-ingest skill 新规则让 LLM 跑 ingest
3. 先生逐步审查：
   - Timeline 节的强化/修正/分歧标注是否合理？
   - aliases 对齐检查有没有正确触发（如果有同名概念）？
   - Confidence 分级是否正确？
   - QUESTIONS.md 匹配是否触发？
   - source 页 frontmatter 的 raw_sha256 是否写入？

**验证**：2 篇 ingest 产物先生 review 通过；如果发现 LLM 行为偏差，调 SKILL.md 再试。

**产物**：**非文档**，是标定记录。记入 `docs/WORKLOG.md`（lorekit 仓库侧）或先生 corpus `log.md`。

**回滚**：snapshot restore。

---

## 不做的（本 plan 明确延后）

| 延后项 | 理由 |
|--------|------|
| 追溯老 concept 页加 aliases / confidence | 只要求新建页按新规则，老页保留 |
| 跨语言合并专项流程（MERGE 操作） | 当前没有同物异名页面，痛点未出现 |
| **REFLECT Stage 0 反向检验** | **已在 B4.3 fileback 环节覆盖**（建 synthesis 前搜反驳证据） |
| **REFLECT Stage 2 深度合成** | **已在 B4.3 fileback 建 synthesis 页覆盖** |
| REFLECT Stage 1 模式扫描（跨来源隐性关联） | 属于周期性治理，非基础能力，延后 |
| REFLECT Stage 3 Gap Analysis | 规模触发（concept ≥ 50 页），延后到 IDEAS |
| LLM rerank / 向量新功能 | 先生明确"先不管向量" |
| 近重复 concept（Jaccard > 0.7） | 决策 2 (y)：concept ≥ 50 页再做 |
| Wikilink 格式铁律（英文 slug 强制） | 决策 1 (i)：保留现状 |
| Stub 检查（字数方案废弃） | 改成"纯空正文 / 必填 section 缺失"再实现，延后 |
| aliases 重叠（lint 层） | 跨语言碎裂痛点未出现 |
| Marp / 图表 CLI 端（`lorekit output` 命令） | skill 先落，CLI 命令未来加 |
| 向量 chunk 元数据注入 | 向量栈启用前必做，但本轮不启用 |
| 演化工程 CLI 套件（`redirect / rewrite-wikilink / migrate-page`） | 规模触发（_INDEX ≥ 200 行），延后 |
| 多轮讨论产物持久化 | wiki-query 多轮收束，延后 |
| LLM 主动联想下一步话题 | 依赖 Gap Analysis，延后 |

## 整体验证（端到端）

- [ ] 批次 B1-B3 完成后：先生 corpus 目录 + 规范 + 模板齐整
- [ ] 批次 B4-B5 完成后：`npm run verify` 通过
- [ ] 批次 B6 完成后：先生现有 corpus CLAUDE.md 包含 9 项新规则
- [ ] 批次 B7 完成后：`~/.claude/skills/wiki-*` 更新完整
- [ ] 批次 B8 完成后：2 篇真实 ingest 产物符合新规则

## 整体风险

| 风险 | 缓解 |
|------|------|
| skill 规则太多，LLM ingest 变慢 | 规则按必要性取舍；批次 B8 标定若发现卡顿先精简 |
| aliases / confidence 是选填，新老页共存 | 只要求新建页新规则，不追溯；lint 逐步加检查 |
| 先生 corpus CLAUDE.md merge 冲突 | 批次 B6 人工 review，不用脚本覆盖 |
| 新规则与现有 filing-rules 主语决定归属冲突 | 批次 B2 明确新旧规则关系；filing-rules 是 **ingest 路由**，新规则是 **ingest 内部流程**，两者正交不冲突 |
| LLM 行为退化 | 批次 B8 必须做，不能跳 |

## 整体回滚

- 先生 corpus 改动：每批前 `lorekit snapshot`，问题 restore
- lorekit 仓库改动：每批独立 commit，单批 revert
- `~/.claude/skills/` 软链：trash + re-install 旧版

## 执行顺序

B1 → B2 → B3 →（先生 review）→ B4 → B5 → B6 → B7 → B8

其中：
- B1-B3 是**先生 corpus 侧改动**（纯文件）
- B4-B5 是 **lorekit 仓库侧改动**（需 PR + commit）
- B6 是**先生 corpus 的 schema merge**（手工）
- B7 是**软链刷新**（`install-skills`）
- B8 是**标定验收**（不可跳）

---

## 签收

先生 review 通过后：
- [ ] 批次 B1 开始
- [ ] 批次 B2 开始
- [ ] 批次 B3 开始
- [ ] 批次 B4 开始
- [ ] 批次 B5 开始
- [ ] 批次 B6 开始
- [ ] 批次 B7 开始
- [ ] 批次 B8 开始
