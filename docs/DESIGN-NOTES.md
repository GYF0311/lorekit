# DESIGN-NOTES.md — lorekit 设计决策

> 新 agent 接手读这份，能快速理解"为什么这样设计 / 下一步方向"。
> WORKLOG / git log 记"做了什么"，这份记"为什么"。

## 1. 图书馆类比（4 层查询模型）

用图书馆理解 lorekit：

| 类比         | lorekit 实体                                          |
| ------------ | ----------------------------------------------------- |
| 图书馆       | corpus（一个目录）                                    |
| 导览图       | `corpus/index.md`                                     |
| 图书区       | 主题域（AI / 求职 / 项目 等，由 frontmatter `domains` tag 表达） |
| 书架         | 内容类型目录（概念 / 实体 / 摘要 / 专题 / 思考）      |
| 书本         | wiki page（Compiled Truth + Timeline）                |
| 原文段落     | chunks                                                |

4 层查询分工：

| 层  | 内容                | 谁做                                          |
| --- | ------------------- | --------------------------------------------- |
| L0  | 导览图              | Agent Read + LLM 判断相关 section             |
| L1  | 书架目录（_INDEX.md）| 向量 MATCH                                    |
| L2  | chunks              | 向量 MATCH                                    |
| L3  | 原文                | Agent Read 完整页补 context                   |

关键：L0 / L3 是 Agent 做的事（LLM 有判断力），L1 / L2 是 lorekit 做的事（向量效率高）。
对应 ARCHITECTURE.md "渐进披露的 token 预算"段：单次 query 总 token < 5k，检索不是兜底而是分层渐进。

## 2. Karpathy 原文 vs lorekit 偏差

Karpathy 原文（https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f）核心：

- Read 三层文件（index → dir index → page）
- 向量是可选 fallback，推荐用 qmd 外部工具
- **没有"向量分层 gate"概念**

lorekit 偏差：

- 自实现 BM25 + vector + RRF hybrid（不用 qmd），见 `src/lib/vectordb/query-hybrid.ts`
- 21 引入 layered gate 设计（错误，见 §4）

## 3. 为什么 lorekit 不用 qmd

qmd（https://github.com/tobi/qmd）是 Karpathy 推荐的外部工具，功能：

- BM25 + vector + RRF（基础同 lorekit）
- Query expansion / LLM re-ranking / position-aware blend（高级 lorekit 没有）

**但 qmd 的 embedding 模型和 reranker 模型是固定的**（qwen3-reranker-0.6b 等）。
lorekit 优先支持**模型自由度** —— 用户可换 bge-m3 / e5 / 自训练领域模型（通过 `lorekit vector` 后端配置）。
这一条就值得 lorekit 自己造 vectordb 模块（CONVENTIONS #10 依赖管理评估的反例：手写 + 模型自由度 > qmd 高级特性）。

## 4. queryLayered L0 gate 设计失败（24-fix 修复背景）

原设计：L0 (`fts_dirs`) MATCH → 取 top-3 section → L1 MATCH WHERE section 内 → L2 MATCH WHERE page 内。

**两个独立问题叠加**：

(a) **L0 数据源问题**：`corpus/index.md` 当前是"L1 冒充 L0" —— 内容是 wikilink 全列表
（`- [[Anthropic]] — AI 安全公司...`），本该是"图书馆导览图"
（每个 section 的领域介绍，语义密度高）。wikilink 列表被 embed 后语义稀释，MATCH 不准。

(b) **BM25 vs 向量语义不兼容**：BM25 是硬 gate（精确词匹配），任何一层词没命中就 0 结果；
向量是软 gate（相似度排序总有候选）。lorekit 原设计把"软 gate 思路"套到 BM25 上，逻辑破产。
真实 corpus 跑 `lorekit vector query --bm25` 永远返回空，藏在 hybrid 融合后（向量路补救）。

### 24-fix 决策

方案 X：BM25 不走 layered，chunk 直查（`queryBM25Layered` 函数名保留，内部变 flat）。
向量 `queryLayered` 保留代码（软 gate 下还能工作），但 L0 数据源问题仍在，效果有限。
详见 `src/lib/vectordb/query-bm25.ts` 注释 + LEGACY P0-3 audit trail。

## 5. 待决策（高优先级）

### 5.1 综合 wiki schema 升级

**问题**：先生 corpus 跨多领域（AI 现在，未来加金融 / 内容生产 / 求职 / 个人项目 / 思考），
Karpathy 原文是"专项 wiki"（单主题），不直接适用。

**推荐方案**（需先生确认后做）：

- **物理目录按内容类型**（保持 Karpathy 原文风格）：
  - `知识库/{概念,实体,摘要,专题}/` 现有，保留
  - 新增 `知识库/思考/`（voice 区别于"概念"）
- **逻辑领域按 frontmatter tag**：
  - 每页加 `domains: [ai, 求职, 思考]` 多 tag
  - 一份内容服务多领域，跨域 wikilink 自由
- **`corpus/index.md` 改成"导览图"**：
  - 按领域分 section（"📚 AI / 📚 求职 / ..."）
  - 每 section 一段领域介绍（不是 wikilink 列表，书目去 `_INDEX.md`）
  - 顺带解决 §4 (a) 的 L0 数据源问题
- **lorekit CLI 加 `--domain <name>` 过滤**：
  - `lorekit vector query --hybrid --text "xxx" --domain "求职"`

### 5.2 wiki-query skill 的 Read L0 + 向量 L1/L2 + Read L3 路径

对应 §1 的 4 层模型。skill 端做 L0 Read 和 L3 Read，lorekit CLI 做 L1/L2。
需要 CLI 加 `--section <name>` 参数（给 L1/L2 一个 scope）。

## 6. 暂不做的事

- 不加 LLM re-ranker（先生本机跑不动小模型；但可以让主 agent 自己 rerank，属 skill 层）
- 不加 Query expansion 到 CLI（属 skill 层，让 agent 自己改写 query 调多次 lorekit）
- 不回归 Karpathy 纯度（删自实现向量栈换 qmd）：代价大于收益（见 §3 模型自由度论证）
