# IDEAS

> 项目的小灵感库。跟 DEVLOG.md 不同——DEVLOG 记**已经做完**的事，IDEAS 记**还没做但值得做**的点子。
> 按"何时想到"倒序（最新在上）。实施后把条目搬进 DEVLOG 并删除这里的对应条目。

---

## [2026-04-19] 综合 wiki schema 升级：按类型分目录 + domains tag + L0 改领域导览图

### 背景

lorekit 当前 schema 继承自 Karpathy 专项 wiki（单一主题），但先生 corpus 实际要服务多领域（AI / 求职 / 金融 / 内容生产 / 个人项目 / 思考...）。今日讨论确定方向：

- **物理按内容类型**（保持现有）：`知识库/{概念,实体,摘要,专题}/` + 新增 `知识库/思考/`
- **逻辑按领域**：frontmatter 加 `domains: [ai, 求职, ...]` 多 tag
- **corpus/index.md 改成"图书馆导览图"**：按领域分 section + 每节一段领域介绍（不是 wikilink 列表）
- **lorekit 加 `--domain <name>` 过滤**

### 动因

queryLayered L0 gate 失败的根因之一就是 corpus/index.md 是"L1 冒充 L0"（全 wikilink 列表），embedding 语义稀释。升级后 L0 是领域介绍（短密语义），Agent Read 和向量 MATCH 都能工作。

### 工作量估计

见 `docs/DESIGN-NOTES.md` §5.1，分 4-5 个子批约 2.5h + 用户 30min 写领域介绍。

### 为什么不立刻做

- 重构刚完成 4 批（21/22/23/24-fix），该先让代码稳定
- schema 升级涉及 corpus 迁移（现有 wiki page 都要加 domains 字段），希望先生想清楚主题域分类再动

---

## [2026-04-19 迁自 LEGACY P4-2] snapshot 的 manifest.json 应该写到 tmpdir + try/finally 清理

### 背景

`src/commands/snapshot.ts:67` 把 `manifest.json` 写到 `<corpus>/.wiki/snapshots/`，然后 `tar.create` 打包，最后 `unlinkSync`。两个隐患：

1. 期间若 `tar.create` 抛错则 manifest 残留在 corpus 内
2. manifest 在被打包目录内，理论上可能被自己包进去

### 改法

改用 `os.tmpdir()` 写 manifest，或者保持原位置但用 `try/finally` 包住 unlink，确保失败也清理。

### 估算
低优先，30 分钟工作量。

---

## [2026-04-19 迁自 LEGACY P4-3] restore 的 rmSync 加注释明确 tmpdir 范围

### 背景

`src/commands/restore.ts:158` 用 `rmSync(tmpDir, { recursive: true, force: true })` 清理临时解压目录。这是 `rm -rf` 等价。虽然路径锁定在 `os.tmpdir()`，但触发先生 CLAUDE.md 全局规则的精神。

### 改法

**保留 `rmSync`**（这里没法走 trash，是程序自动清理），但必须：

- 加注释明确 `// 仅限 os.tmpdir() 子目录，不许扩展到任何用户数据路径`
- 路径必须由 `tmpdir() + 'lorekit-restore-' + Date.now()` 构造
- 禁止接受外部路径参数

### 估算
低优先，15 分钟工作量。中等数据安全敏感度。

---

## [2026-04-19 迁自 LEGACY P4-5] vector.ts 用 path.relative 替代字符串替换

### 背景

`src/commands/vector.ts:47` 的 `filePath.replace(corpus + '/', '')` 在 corpus 路径在 filePath 里出现两次（罕见）时会替换错位。

### 改法

改用 `path.relative(corpus, filePath)` 更稳。

### 估算
低优先，10 分钟工作量。

---

## [2026-04-19 迁自 LEGACY P4-6] fetcher web 路由抽 source_date

### 背景

昨晚真实 ingest `claude.com/blog/...` 验证发现：原文页面多处可见 "April 15, 2026"，但 fetcher 产物 frontmatter 缺 `source_date` 字段。所有 claude.com / Webflow 类站点受影响。21 严守 strangler fig "copy 不修"原则未动 parseGeneric 内逻辑；gist 路由的 `<relative-time datetime>` 抽取在原代码已存在。

### 改法

在 `src/lib/fetcher/routes/web.ts` parseGeneric 阶段识别常见日期 pattern：

- `<time datetime="...">`
- `meta[property=article:published_time]`
- JSON-LD `datePublished`

抽到后回填 `frontmatter.source_date`。

### 估算
低优先，1 小时工作量（含写 mock 测试）。

---

## [2026-04-19 迁自 LEGACY P4-7] 决策 fetcher 产物 slug 字段

### 背景

昨晚真实 ingest 验证发现：lint 报 `missing frontmatter field: slug`。frontmatter-spec 把 slug 列为必填，所有 fetch 产物都触发这条。21b `buildFrontmatter` 注释明说 "slug omitted: fetcher doesn't know the final archive location, wiki-ingest will set it on mv"——这是 by-design，但 lint 仍报。

### 待决策方案

(a) 改 lint 规则承认"工作台收件未归档"状态，对 `_工作台/收件/` 下的产物豁免 slug 检查
(b) 在 `buildFrontmatter` 加可选 `slug` 字段，调用方按需传

### 备注

(a) 已部分落地（最近 commit `f0f4027 fix(lint): 豁免 _工作台/ _归档/ 目录下文件的 frontmatter 检查`），但是否完全覆盖 slug 这一条还要确认。可能本条已被消化，需要先复核 lint 现状再决定是否还要 (b)。

### 估算
低优先，30-60 分钟（含决策 + 实施 + 验证）。

---

## [2026-04-19 迁自 LEGACY P4-8] Windows 路径分隔符兼容

### 背景

`src/lib/vectordb.ts:182 / 185 / 837` + `src/lib/paths.ts:98` 共 4 处用 `rel.startsWith(prefix + '/')` 判断目录归属。Windows 上 Node `path.relative()` 返回反斜杠 `\`，这些判断永远 false → 该排除的目录没排除（向量化、索引、lint 全部受影响）。批次 22 拆 vectordb 时未顺手做。

### 何时做

**当前无 Windows 用户需求，暂不动**。等真有反馈时单批处理。

### 改法

统一改用 `path.sep` 或路径归一化（`rel.split(path.sep).join('/')`）。vectordb 拆分后这 3 处分布到子模块，需重新定位；paths.ts 的 1 处独立做。

### 估算
低优先，1-2 小时工作量（含 Windows 环境验证）。

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

| 要素      | 当前                                    | 需要补                                                  |
| --------- | --------------------------------------- | ------------------------------------------------------- |
| 向量召回  | ✅ 三层 layered（含 slug_list 过滤）    | —                                                       |
| BM25 打分 | ❌ `lorekit search` 只走 ripgrep 无分数 | SQLite FTS5 虚表（`chunks_fts`/`pages_fts`/`dirs_fts`） |
| 融合      | ❌ 两路独立跑                           | Reciprocal Rank Fusion（RRF）                           |
| re-rank   | ❌ 无                                   | Claude Haiku 或本地小模型挑最终 top-k                   |

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
