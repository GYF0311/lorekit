# AGENTS.md

See `CLAUDE.md` for the authoritative ruleset.

This file exists so that non-Claude harnesses (Codex, Cursor, Aider, etc.) can find the same corpus constitution via their conventional entry point. The content of record lives in `CLAUDE.md`. 下方 **Harness 规则**部分与 `CLAUDE.md` 保持一致镜像，便于不支持 `@./` include 的 agent 直接读取。

---

## Harness 规则（LLM 行为契约）

> 下列 9 项规则是 lorekit 当前版本的 **harness 契约**，与 `skills/wiki-*` 的行为约定配套。
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
