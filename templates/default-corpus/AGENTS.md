# AGENTS.md

See `CLAUDE.md` for the authoritative ruleset.

This file exists so that non-Claude harnesses (Codex, Cursor, Aider, etc.) can find the same corpus constitution via their conventional entry point. The content of record lives in `CLAUDE.md`. 下方 **Harness 规则**部分与 `CLAUDE.md` 保持一致镜像，便于不支持 `@./` include 的 agent 直接读取。

---

## Skill 部署模式

这份 corpus 支持三种 AI 使用方式：

| 模式 | 适合场景 | 规则 |
| --- | --- | --- |
| 项目级 | 只在本 corpus 对话里维护知识库 | 读取本项目 `skills/wiki-*`，按 `CLAUDE.md` 和 `系统/filing-rules.md` 执行 |
| 全局入口 | 任意项目都要访问同一个 canonical corpus | 用户级 `corpus-*` / `wiki-daily` 只做入口和路由 |
| Hybrid | 推荐给个人长期 corpus | 全局 `corpus-*` 负责跨项目入口，本项目 `wiki-*` 负责执行规范 |

边界：

- 全局 `corpus-capture` 默认只写 `_工作台/收件/`
- 全局 `wiki-daily` 写 `_工作台/日记收件/`、`每日/`、`输出/复盘/`
- 全局 `corpus-query` / `corpus-gbrain-query` 默认只读，必须回读 canonical `知识库/` 页面
- 全局 `corpus-ingest` / `corpus-fileback` 写库前必须先读本项目规则和相关 `skills/wiki-*`
- `wiki-remove`、GBrain 原生 mutating 命令、自动 fileback 不做全局默认入口

如果从其他项目进入本 corpus，优先读取 `~/.config/lorekit/global-corpus.json` 中的 `default_corpus`、`lorekit_bin`、`gbrain_bin`，并使用本 corpus 的 wrapper，不要裸调用不确定来源的全局 `lorekit` / `gbrain`。

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
