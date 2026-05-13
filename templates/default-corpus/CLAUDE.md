# CLAUDE.md — Corpus Schema

> 本文件是这份 corpus 的 schema，由 LLM Agent 每次对话自动读取。
> 它告诉 Agent：这份知识库的范围、约定、当前状态和待填空缺。
> 人和 LLM 共同维护这份文件（co-evolve）。

## 这是什么

这是一个由 **lorekit** 管理的个人知识 corpus。

核心理念来自 [Karpathy 的 LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)：
- 不走 RAG（每次查询从原始文档重新发现知识），而是让 LLM **增量编译并维护一个持久 wiki**
- 知识只编译一次，然后持续更新——交叉引用已就位、矛盾已标注、综合已反映全部来源
- **你**负责：策展原料、提出好问题、审阅反馈
- **LLM**负责：所有写入、交叉引用、归档、簿记

## 三层架构

```
corpus/
├── CLAUDE.md           ← 你在读的这份 schema
├── index.md            ← wiki 内容目录（LLM 维护）
├── log.md              ← 操作时间线（append-only）
│
├── 原料/               ← Raw sources（只读，不可变）
│   ├── 文章/           ← 网页文章
│   ├── 论文/           ← 学术论文
│   ├── 书籍/           ← 读书笔记
│   ├── 会议/           ← 会议纪要
│   ├── 录音/           ← 录音转写（原始文本）
│   ├── 剪藏/           ← 公众号/网页剪藏
│   └── 引用/           ← 大文件指针
│
├── 知识库/             ← Wiki（LLM 编译产物）
│   ├── 概念/           ← 心智模型、方法论
│   ├── 实体/           ← 人物、工具、组织、项目
│   ├── 摘要/           ← 逐源摘要页
│   └── 专题/           ← 跨源主题综述（可选）
│
├── 每日/               ← 日记（YYYY-MM-DD.md）
├── 写作/               ← 对外创作输出
│
├── 反馈/               ← 人类审阅闭环
│   ├── 待处理/         ← open feedback
│   └── 已处理/         ← resolved（含 resolution 说明）
│
├── _工作台/            ← 过程文件（有过期策略）
│   ├── 收件/           ← 7 天
│   ├── 草稿/           ← 30 天
│   ├── 临时/           ← 14 天
│   └── 待整理/         ← 3 天
│
├── _归档/              ← 冷数据陵园
└── .wiki/              ← lorekit 元数据（不要手工改）
```

## Scope

> 在这里定义这份 corpus 的覆盖范围。新建 corpus 后请填写。

覆盖：
- （填写：这份 corpus 关注什么领域）

不覆盖：
- （填写：哪些东西不该出现在这里）

## 三个操作

### Ingest（摄入）
新原料进 `原料/`，LLM 阅读后编译进 `知识库/`——更新实体页、修订概念摘要、标注矛盾、在 `index.md` 登记、在 `log.md` 追加记录。一篇原料可能触碰 10+ 页 wiki。

### Query（查询）
先读 `index.md` 定位相关页，再钻入具体文件综合回答。好的回答应该 **file back** 成 `知识库/` 的新页面——探索的成果不该消失在聊天记录里。

### Lint（健康检查）
定期检查：死链、孤岛页、提到但没建页的概念、矛盾、过期工作台文件。`lorekit doctor` 执行。

## 三层读取策略

Agent system prompt 是稀缺资源，永远用指针风格而不是全量注入。

| 层 | 位置 | 加载方式 | 预算 |
|---|---|---|---|
| **L0** | `CLAUDE.md` + `index.md` | 对话启动自动注入 | ≤ 3k tokens |
| **L1** | `{目录}/_INDEX.md` | Agent 按需 Read | ≤ 2k tokens/次 |
| **L2** | 具体文件 | Agent 按需 Read | 按页大小 |

## 页面结构

```markdown
---
(frontmatter — 见 系统/frontmatter-spec.md)
---

# 页面标题

## Compiled Truth

当下最好的理解，2-3 段话。可被后续 ingest 重写覆盖。

---

## Timeline

- YYYY-MM-DD | 事件摘要 [[双链到来源页]]
- ...（只追加，不编辑）
```

## 归档铁律

1. **主语决定归属**：内容在讲谁/什么 → 去对应目录。详见 `系统/filing-rules.md`
2. **原料只读**：`原料/` 严格只读，任何分析结论搬到 `知识库/`
3. **至少一条反向链接**：没有链接的信息等于没有
4. **好答案写回 wiki**：query 产出有复用价值的，file back 成 `知识库/` 新页

## 当前 wiki 内容

> 下面的清单由 LLM 在每次 ingest 后更新。也可查看 `index.md`。

### 概念
（暂无）

### 实体
（暂无）

### 摘要
（暂无）

## 待研究问题
（暂无）

## 空缺
（暂无）

## 相关规则文件

- `系统/filing-rules.md` — 完整归档路由表
- `系统/frontmatter-spec.md` — frontmatter 字段规范
- `系统/schema.md` — 目录结构详解 + 向量索引规则

---

## Harness 规则（LLM 行为契约）

> 下列 10 项规则是 lorekit 当前版本的 **harness 契约**，与 `skills/wiki-*` 的行为约定配套。
> 新 corpus 一建好就带这些规则；老 corpus 不追溯，但新建页要按新规则。

### 1. Personal-writing 分流规则

LLM 收到原料后，**先判来源类型**，优先级由高到低：

1. frontmatter `type: personal-writing` → 走"个人写作"流程
2. 原料路径含 `原料/个人写作/` → 走"个人写作"流程
3. 其他 → 走"外部来源"标准流程

"个人写作"与"外部来源"的关键差异：

- **不计 `source_count`**（防自我背书——自己给自己的结论背书不构成证据）
- **不生成客观 Summary 节**（个人立场不是事实综述）
- 核心论点写入相关 concept 页的 `## My Position` 节（标注"个人立场"）
- concept 页 Timeline 追加：`- YYYY-MM-DD 个人写作 [[slug]] 确立了对此概念的明确立场`

### 2. aliases 对齐规则

ingest 提取 concept / entity 前，**必须先扫已有页的 aliases**，避免同物异名建重复页：

- 生成当前概念英文 slug，Grep `知识库/概念/*.md` 与 `知识库/实体/*.md` 的 frontmatter `aliases` 字段
- 命中已有页 → **追加 Timeline 到已有页**，不新建
- 新建 concept / entity 时 `aliases` 字段**必填**，列出中文名 / 英文名 / 常见别名 / 缩写的全部叫法

### 3. Timeline / Evolution 规则

Timeline 在本 corpus 承担 Evolution Log 的角色。追加新条目时必须按三类标注：

| 标注 | 含义 |
| --- | --- |
| **强化** | 新来源与已有 compiled truth 一致，结论被进一步印证 |
| **修正** | 新来源推翻 / 修订原结论的一部分 |
| **新增分歧** | 新来源与已有来源冲突、当前不裁决，同时写入 `## Contradictions` |

格式：`- YYYY-MM-DD（N sources）| [标注]：[一句话描述变化] [[来源页]]`

### 4. Outputs 持久化规则

query 答案若有**复用价值**（跨多页综合的比较表 / 深度分析 / 清单 / 先生明示保留），自动写入：

- 路径：`corpus/输出/问答/YYYY-MM-DD-<slug>.md`
- frontmatter 必含 `graph-excluded: true`
- 同时更新 `corpus/index.md` 的 **Recent Synthesis** 列表

答案末尾**必含 "⚠ Confidence Notes" 节**，展开每条核心引用的 confidence 级别（low / medium 必须显式列出）。

### 5. QUESTIONS.md 匹配规则

- ingest 结束前，LLM 必须 Read `corpus/QUESTIONS.md` 的 **Open Questions** 列表
- 若新来源能回答某问题 → 主动提示先生"此来源可能回答了 Open Question：...，是否立即 QUERY？"
- 先生新提问题时 → 走 **ADD-QUESTION** 流程，把问题加入 Open Questions

### 6. Confidence 门控规则

`confidence` 字段在 concept / synthesis 页必填，按以下规则分级：

| Confidence | 触发条件 |
| --- | --- |
| `low` | 1 source（自动） |
| `medium` | 3+ sources（自动） |
| `high` | 5+ sources **且无重大矛盾** **且先生明确确认**（LLM 展示 Definition + Sources 给先生，**等先生明确说"升 high"才升**） |

**铁律：LLM 不允许自动把 confidence 升 `high`**——必须有先生的显式确认。

### 7. SHA-256 完整性规则

- ingest 时，LLM 对原料文件计算 SHA-256，写入对应 wiki source 页 frontmatter：
  - `raw_sha256: <64-hex>`
  - `last_verified: YYYY-MM-DD`
  - 原料发表日期超 2 年 → 加 `possibly_outdated: true`
- lint 检测到 ⚠ SOURCE MODIFIED（哈希不一致）→ 触发 re-ingest，Timeline 记录"来源更新"
- **老页无 `raw_sha256` 字段的不追溯**，lint 跳过

### 8. 反向检验规则（防回音室）

建 synthesis 页（`知识库/专题/<slug>.md`）**前必须**：

1. 搜索已有 source 中的**反驳证据**（`lorekit search` + `lorekit vector query`）
2. 若找到反对来源 → 在 `## Counter-evidence` 节写入具体分歧点
3. 若无反对来源 → `## Counter-evidence` 节**明确标注**：`⚠ 回音室风险：未找到反驳来源，结论可能存在确认偏差`

Counter-evidence 节**即使为空也必须写**——"没反驳"是一个信号而不是沉默。

### 9. 系统文件隔离规则

以下文件 frontmatter **必填** `graph-excluded: true`（不进图谱、不进向量索引、不进 _INDEX 排序）：

- `corpus/index.md`
- `corpus/log.md`
- `corpus/overview.md`
- `corpus/QUESTIONS.md`
- `corpus/输出/**/*.md`（所有对外输出产物）
- `corpus/系统/**/*.md`（所有 schema 规范文档）

**不在上述清单里的文件**（`知识库/**` / `原料/**` / `每日/**` 等）不加 `graph-excluded`——它们是知识资产，需要进索引。

### 10. GBrain 只读集成规则

如果使用 `lorekit gbrain`：

- `知识库/` 仍是 canonical source of truth
- GBrain 只能读取 `.wiki/integrations/gbrain-export/` staging copy
- 不允许 GBrain 直接写回 `知识库/` 或 `原料/`
- 任何新知识持久化仍必须走 wiki-fileback / audit / snapshot
- `lorekit gbrain export` 默认跳过 `_INDEX.md`、local `index.md` 和 `知识库/模板/`
- `lorekit gbrain export --out` 默认只能写在 `.wiki/integrations/` 下
- `lorekit gbrain sync` 缺 binary 时默认只写 failure report，不刷新 staging
- `lorekit gbrain query` 默认检查 corpus + export/sync freshness；stale 时提醒但不阻止查询
- `lorekit doctor --section integrations` 可单独检查 GBrain health；未知 section 必须报参数错
