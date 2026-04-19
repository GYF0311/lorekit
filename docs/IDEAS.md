# IDEAS

> 项目的小灵感库。跟 DEVLOG.md 不同——DEVLOG 记**已经做完**的事，IDEAS 记**还没做但值得做**的点子。
> 按"何时想到"倒序（最新在上）。实施后把条目搬进 DEVLOG 并删除这里的对应条目。

---

## [2026-04-19] harness 规则补全路线图（31 条，按"本轮做 → 规模触发 → 远期"分组）

> 背景：今日讨论把 lorekit 产品定位收束为 **"个人知识 compilation harness"**（详见 `docs/DESIGN-NOTES.md` §7 §8）。
> 旧「综合 wiki schema 升级」条目（2026-04-19）已证伪（不做顶层领域物理分区）。
> 以下条目按 ROI + 触发规模分三组：A = Plan A/B 本轮做；B = 规模触发才做；C = 远期（硬件 / 生态成熟）。

### A. 本轮 Plan A/B 正在做的（落地条目，完成后从 IDEAS 移除或归档）

1. **先生 corpus 新目录骨架**：`输出/{问答,文章,幻灯片,图表,体检报告,空缺分析}/` / `原料/个人写作/` / `知识库/模板/`
2. **新文件**：`QUESTIONS.md`（开放问题队列）/ `overview.md`（Health Dashboard 骨架）
3. **frontmatter 选填扩展字段**：`aliases` / `confidence` / `domain_volatility` / `source_count` / `last_reviewed` / `raw_sha256` / `last_verified` / `possibly_outdated` / `confidence_at_writing` / `status` / `superseded_by`
4. **`.assets/` 图片子目录规范**：随 markdown 并排，exclude 随父目录
5. **aliases 对齐机制**（ingest 前扫现有 concept 的 aliases 字段，同名自动合并）
6. **Confidence 分级 + 门控**（5+ source 候选 high 要人类明确确认）
7. **outputs 持久化**（query 答案自动回盘到 `输出/问答/`）
8. **fileback 自动化**（跨源 ≥3 或新综合见解主动提议建 synthesis 页）
9. **反向检验（防回音室）**（fileback 建 synthesis 前搜反驳证据）
10. **Marp / 对外文章 / 图表输出**（新 `wiki-output` skill）
11. **SHA-256 完整性检查**（lint 带字段的 source 页，老页跳过）
12. **Stale 页面检查**（lint 带 `domain_volatility` 的 concept 页，阈值 90/180/365）
13. **规模哨兵**（lint 只提醒不动作：`index.md > 100 行` / `_INDEX.md > 200 行`）

### B. 规模触发才做（列为 IDEAS 备案，触发条件明确）

14. **REFLECT Stage 3 Gap Analysis**——扫 frontmatter 识别三类空洞（孤立概念 / 隐性盲区 / 稀薄领域），产出 `输出/空缺分析/gap-YYYY-MM-DD.md`。**结构化扫描，非自由联想**。触发：concept ≥ 50 页
15. **REFLECT Stage 1 模式扫描**——跨来源隐性关联 / 矛盾对识别。触发：concept ≥ 50 页且多个 domain
16. **近重复 concept（Jaccard > 0.7）**——slug 名相似度检测。触发：concept ≥ 50 页（决策 2 (y)）
17. **Stub 页面检查（字数方案废弃）**——字数 < 100 是规则主义；改为"纯空正文"或"必填 section 缺失"判定。触发：观察到建页残缺 bug
18. **L1 `_INDEX.md` 分流方案**——单 `_INDEX.md` ≥ 200 行时，LLM 按该子目录内 concept 的 tags / 主题相似性建议类型内二级子目录（如 `知识库/概念/ai-技术/`）。**跟"不做顶层领域分区"不冲突**——这是类型内局部分流
19. **index.md 规模化渐进演化**：
    - 阶段 1（子目录 < 100 页）：全量 catalog（Karpathy 原味，当前）
    - 阶段 2（子目录 100-500 页）：压缩（top 5 + → _INDEX）+ 该子目录 _INDEX 承担完整列表 + 向量兜底
    - 阶段 3（子目录 500+ 页）：主题导览化 + 多级子目录 + `_元目录/*.md` 综述 + 向量为主
    - 阶段 4（corpus 2000+ 页）：harness 升级为 MCP server
20. **Harness 分形演化原理**：任何一层 index 到阈值"当前 index 简介化 → 下一层 _INDEX 接班做目录"，递归下去形成"大图书馆"终态。**图书馆心智 = 演化终态**，**Karpathy 原味 = 起点**，两者是同一事物的不同规模形态
21. **🔑 演化核心原则：局部触发、局部执行**：
    - 触发粒度 = 单个 `_INDEX.md` 行数（或子目录页数），**逐目录独立判**
    - 执行粒度 = 只分流触发的那个子目录，**邻居不动**
    - 顶层 `index.md` 只改对应 section，其他 section 保持原状
    - ❌ 错误示例：整个 wiki 超总规模 → 全局同步分流
    - ✅ 正确示例：`知识库/概念/_INDEX.md` 超阈值 → 只动概念，实体/摘要/专题/写作 保持原状
    - 图书馆类比：AI 区书满了先重组 AI 区，文学区不动
22. **演化工程清单（单目录分流动作序列）**：
    1. LLM 仅对触发目录提建议 + 先生拍板
    2. snapshot 全量
    3. 物理迁移**仅该目录内**文件到新子目录
    4. 老路径建 redirect 页（飞书 MERGE 精神）
    5. 全 corpus wikilink replace（或 redirect 兜底；影响面 = 所有指向该目录的链接）
    6. 级联更新：顶层 `index.md` 的对应 section + 该子目录的两层 _INDEX
    7. 更新 `系统/schema.md` 的**该目录相关**路径说明
    8. 向量库 path 增量同步（仅该目录）
    9. 建 `_元目录/<主题>-overview.md` 作该子目录图谱枢纽
    10. lint 验证该子目录无断链 + `log.md` 记录演化事件
23. **演化 3 个决策点**（未来真触发分流时最终确定）：
    - α 历史 wikilink 迁移：**推荐 C 用 redirect 兜底**（不迁历史但可达）
    - β 知识图谱展示：**推荐 c 用 `_元目录/` 综述页做图谱枢纽**
    - γ 演化 trigger：**推荐 (i) LLM 建议 + 先生拍板**（非自动分裂）
24. **演化工程 CLI 套件**（"thin CLI + fat skill" 哲学，触发：任一子目录 `_INDEX.md` ≥ 200 行）：
    - CLI 原语：
      - `lorekit redirect create/delete/list` — 建/删/列 redirect 页
      - `lorekit rewrite-wikilink --from X --to Y` — 全 corpus wikilink 替换
      - `lorekit migrate-page --from A --to B` — 原子操作（= mv + redirect + rewrite + index 更新）
    - LLM 业务：决定分流时机 + 子类边界 / 写 `_元目录/*-overview.md` 综述 / 级联更新 `CLAUDE.md` / 写 `log.md` 叙事
    - 前置依赖：`.wiki/redirects.json` SSOT / schema 版本号（snapshot 兼容）/ 向量库 path 变更支持
25. **Health Dashboard `overview.md` 渐进化**：
    - 小规模：列总 source / high-conf concept / 开放问题 / stale 数
    - 中规模：加趋势（过去 30 天 ingest / query / fileback 数）
    - 大规模：按主题分 section 呈现各子图健康度

### C. 远期（硬件 / 生态成熟）

26. **LLM re-rank 第四环**（硬件允许后）——候选路径：Claude Haiku API / Cohere rerank / 等蒸馏小模型
27. **向量 chunk 元数据注入**（向量栈启用前必做）——chunk 携带 `confidence / domain_volatility / last_reviewed / aliases`。**推荐方案 C**（关键字段嵌 prefix 提高 embedding 区分度 + 次要 JOIN 回查）
28. **Wikilink 格式铁律**（英文 slug 强制 lint）——当前保留中文现状（决策 1 (i)），规模起来真痛再做
29. **Query 产物自动 fileback**（Karpathy 原文"explorations compound"）——query 结束后 LLM 主动判断是否值得 fileback
30. **多轮讨论产物持久化**——wiki-query skill 检测对话轮数 ≥ N 触发收束，落 `输出/讨论/`
31. **LLM 主动联想下一步研究话题**——依赖 Gap Analysis 和 arXiv / 公众号订阅源接入

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
