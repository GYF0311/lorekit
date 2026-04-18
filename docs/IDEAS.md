# IDEAS

> 项目的小灵感库。跟 DEVLOG.md 不同——DEVLOG 记**已经做完**的事，IDEAS 记**还没做但值得做**的点子。
> 按"何时想到"倒序（最新在上）。实施后把条目搬进 DEVLOG 并删除这里的对应条目。

---

## [2026-04-18] LLM re-rank 作为混合检索的第四环

### 来源

阶段 2 混合检索骨架已经落地（BM25 + 向量 + RRF）。Karpathy 原文推荐的 qmd 还额外加了一步 **LLM re-rank**：

> "hybrid BM25/vector search **and LLM re-ranking**"

re-rank 负责在 RRF 融合后的 top-k 候选里，让一个小模型快速判断"这些哪几个真的答题"，挑出最终 top-k'（k' < k）。RRF 解决的是"候选排名合理"的问题，re-rank 解决的是"候选跟 query 语义真对齐"的问题——两者互补。

### 为什么本轮没做

**先生当前电脑配置跑不动 bge-reranker 模型**——硬件资源不够（bge-reranker-v2-m3 约 567M 参数，推理时内存峰值较高，加上已经在跑 bge-m3 embedding 模型，本地同时跑两个模型容易吃爆内存）。这是硬件限制，不是软件兼容性问题。

可选的替代路径（未来选一条）：

1. **换机器或加内存**后本地跑 bge-reranker
2. **用 Claude Haiku API 做 re-rank**——Anthropic API 远程推理，不占本地资源。成本约 0.001 USD/10 候选，先生规模下一天跑百次问题不大
3. **cohere rerank API**——商业服务，质量高但多一个账号要管
4. **等更轻量的 reranker 模型出现**——比如蒸馏版小于 100M 参数的

先生倾向哪条：待定。当前电脑跑不动本地模型是主要约束，第 2 条（Claude Haiku API）最务实。

### 实施时的接入点

- `queryHybrid()` 的返回前，多一步 `rerank()` 调用
- 新增 `src/lib/reranker.ts`：抽象 reranker 接口，支持多种 backend
- 新增 `lorekit vector query --rerank` flag（默认关闭，启用时走 re-rank）
- skill 里"hybrid 模式"升级为"hybrid + rerank 模式"

### 相关

- `src/lib/vectordb.ts::queryHybrid` — 现有混合检索，re-rank 插在这里之后
- `corpus/_工作台/收件/karpathy-llm-wiki/llm-wiki.md` — 原文 qmd 段落

---

## [2026-04-18] 第二层应该是混合检索，不是纯向量

### 来源

先生在对上一轮 Phase A-D 改造做架构 review 时，指出我写的"阶段 2 = 纯向量 layered 召回"**定义错了**——Karpathy 原文明确说了下一阶段的搜索应该用 qmd 的 **hybrid BM25/vector search + LLM re-ranking** 模式：

> "A search engine over the wiki pages ... at small scale the index file is enough, but as the wiki grows you want proper search. **qmd is a good option: it's a local search engine for markdown files with hybrid BM25/vector search and LLM re-ranking, all on-device.**"

Karpathy 要解决的核心问题是"RAG 向量块过于碎片化导致返回内容不对劲"——**解法不是"换纯向量"而是"混合 + re-rank"**。我之前写的阶段 2 漏了 BM25 和 re-rank，是错的。

### 架构定型

```
阶段 1（现在，< 100 files）：纯文本 Read 三层
  Read index.md → _INDEX.md → 具体文件
  LLM 凭语义理解 drill down

阶段 2（未来，>= 100 files）：混合检索
  ① 向量三层 layered（已就绪）
  ② BM25 三层（待建 FTS5）
  ③ RRF 融合两路候选
  ④ LLM re-rank 挑最终 top-k
```

### 离终态的距离

| 要素 | 当前 | 需要补 |
|---|---|---|
| 向量召回 | ✅ 三层 layered（含 slug_list 过滤） | — |
| BM25 打分 | ❌ `lorekit search` 只走 ripgrep 无分数 | SQLite FTS5 虚表（`chunks_fts`/`pages_fts`/`dirs_fts`）|
| 融合 | ❌ 两路独立跑 | Reciprocal Rank Fusion（RRF）|
| re-rank | ❌ 无 | Claude Haiku 或本地小模型挑最终 top-k |

### 为什么纯向量不够

- 查"2026-04-18 发生了什么"——日期向量化后跟"2025-03-22 ..."相似度几乎一样，纯向量无法区分
- 查"Anthropic 估值"——专有名词向量化被抹平，BM25 精确命中反而稳
- 向量擅长意图，BM25 擅长精确，两者互补不可替代

### 为什么延后

- 当前 corpus 13 files，离 100 阈值还远，阶段 1 够用
- 动手前要先等规模跨阈值，避免过早优化
- 阶段 1 刚焊完，验证稳定性至少一个月

### 实施时要考虑的

- **SQLite FTS5 和 sqlite-vec 同库共存**：两个虚表并存没问题，一份 `.wiki/vector.sqlite` 装两套索引
- **中文分词**：FTS5 默认的 tokenizer 对中文效果差，要用 `fts5(content, tokenize='unicode61 remove_diacritics 2')` 或接 jieba 自定义 tokenizer
- **RRF 公式**：`score = Σ 1 / (k + rank_i)`，k 通常取 60；两路 top-N 合并后按 RRF score 再排
- **re-rank 成本**：Claude Haiku 4.5 单次 re-rank ~10 个候选约 0.001 USD，先生规模下一天跑百次问题不大
- **跟 Karpathy 原文一致的关键**：qmd 是开源的，可以抄它的架构少走弯路（`https://github.com/tobi/qmd`）

### 关联文件

- `src/lib/vectordb.ts` — 现有向量层；FTS5 加到这个文件的 DDL 里
- `src/commands/search.ts` — 现有 ripgrep 搜索；未来要升级成 BM25
- `skills/wiki-query/SKILL.md` — 阶段 2 mode 的流程规则要加"混合检索"分支
- Karpathy 原文: `corpus/_工作台/收件/karpathy-llm-wiki/llm-wiki.md`

---

## [2026-04-18] Query 产物自动 fileback（来自 Karpathy 原文）

### 来源

Karpathy 的 LLM Wiki 原文（`~/Desktop/OpenClaw-Base-Camp/corpus/_工作台/收件/karpathy-llm-wiki/llm-wiki.md`）里有一句：

> "**good answers can be filed back into the wiki as new pages.** A comparison you asked for, an analysis, a connection you discovered — these are valuable and shouldn't disappear into chat history. This way your explorations compound in the knowledge base just like ingested sources do."

### 现状

lorekit 有 `wiki-fileback` skill 对应这个概念，但它是**跟 query 解耦的**——用户查完问题，回答不会自动触发 fileback。所以 Karpathy 强调的"explorations compound in the knowledge base"这一环**其实没闭环**——除非用户主动说"把刚才那个存下来"。

### 想法

`wiki-query` skill 回答完一个复杂问题后，自动判断产出价值：

- **对比表**（问"A vs B"得到的 markdown 表格）
- **跨源综合**（需要 3+ 文件才能回答的综合题）
- **新发现的关联**（LLM 在回答时发现两个实体有意外联系）

符合上述条件时，skill **主动建议** fileback："这个回答值得存成 `知识库/专题/xxx.md` / `知识库/概念/xxx.md`，要不要建？"——用户一句话确认就能自动建页。

### 为什么没放进当前这一期 plan

1. 要先把"文本三层 + 向量三层共享档案"地基焊死（Phase A-E），query 侧才有稳定的召回，才轮得到判断"query 产物值不值得 fileback"
2. "值不值得 fileback"的判断规则本身是个小设计——需要几条启发式（结果长度、跨源度、用户追问轮数等）
3. 先生当前更关注**检索侧**的地基，写入侧的加强可以延后

### 实施时要考虑的风险

- **过度主动**：每次查都提示 fileback 会骚扰用户，判断阈值要保守
- **重复入库**：新建页面前要 dedupe（`lorekit search` 查一遍，有相似页就追加 timeline 而不是新建）
- **质量漂移**：query 产物是 LLM 综合的二次加工，`source_url` 字段没法填（用户的问题算不算 source？）——需要个新 frontmatter type 比如 `type: synthesis`

### 关联文件

- `skills/wiki-fileback/SKILL.md` — 现有 fileback 流程
- `skills/wiki-query/SKILL.md` — 要加"回答后自动建议 fileback"的判断逻辑
- `corpus/_工作台/收件/karpathy-llm-wiki/llm-wiki.md` — 原文依据
