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

### 5.1 wiki-query skill 的 Read L0 + 向量 L1/L2 + Read L3 路径

对应 §1 的 4 层模型。skill 端做 L0 Read 和 L3 Read，lorekit CLI 做 L1/L2。
需要 CLI 加 `--section <name>` 参数（给 L1/L2 一个 scope）。

## 5.2 remove 为什么只做来源归因级联

`lorekit remove` 的删除边界是 provenance，不是 topic keyword。

反例：三篇文章都讨论 `harness`。删除其中一篇时，如果按关键词级联，会误删其他来源共同支撑的 `知识库/概念/harness.md`，等于把"主题相同"错当成"来源相同"。

当前决策：

- 自动删除：目标摘要页、对应原料页/目录、明确包含目标来源 wikilink 的列表行
- 自动修改：frontmatter `sources` 移除目标 source，`source_count` 递减到不小于 0
- 只报告不改：`## Compiled Truth` 中疑似依赖该来源的段落
- 永不做：按 `harness` 这类关键词删除同主题页面

bug 修复线索：

1. 如果删除后 query 仍召回旧内容，优先查 `src/lib/vectordb/prune.ts` 是否被调用，以及 `documents.path` 是否还保留已失踪文件。
2. 如果误删了其他来源，检查 `commands/remove.ts` 的 alias 集合是否把普通关键词加入了 provenance aliases；aliases 只能来自被移入回收站的实际路径 slug。
3. 如果 `Compiled Truth` 没被更新，这是设计行为；应由 `wiki-audit` 或人工 review 处理，不要让 remove 自动改写事实综述。

## 6. 暂不做的事

- 不加 LLM re-ranker（先生本机跑不动小模型；但可以让主 agent 自己 rerank，属 skill 层）
- 不加 Query expansion 到 CLI（属 skill 层，让 agent 自己改写 query 调多次 lorekit）
- 不回归 Karpathy 纯度（删自实现向量栈换 qmd）：代价大于收益（见 §3 模型自由度论证）

## 6.1 P0+links MVP 决策

本轮目标不是做完整图数据库，而是补上 agent 关账前最容易漏的确定性护栏：

- `lorekit sync` 默认 text-safe：先保证 `index.md` / `_INDEX.md` / doctor 可用；无 vector 依赖或 ollama 时跳过向量，不阻断小 corpus 日常使用。
- `doctor --json --strict` 给 CI / agent gate 用；普通 doctor 继续做人类可读体检。
- `lint --json` 给机器读，`lint plan` 给人审，`lint fix --safe` 只做无争议修复；复杂语义合并仍交给 agent / 人。
- `source finalize` 把“原料归档后的 slug/hash/verified 字段补齐”从 skill 手工步骤下沉到 CLI。
- `links suggest/fix/stub/backlog/plain` 把 wikilink closure 做成独立 surface：ingest 关账用 `suggest --file` 限定本次页面，能安全修的用 `fix --file` 修，真有价值的建 stub，暂不建的进 `系统/missing-nodes.md`，一次性提及转纯文本。
- `wiki-ingest` 在 `record --step lint` 前必须完成 links closure，避免“完成态 ingest”留下 P0 死链。

刻意不做：自动判断所有缺失节点的语义价值、自动合并近义概念、自动改写 Compiled Truth。这些仍属于 LLM / 人类判断层。

## 7. lorekit 产品定位：个人知识 compilation harness

**一句话定位**：

> lorekit = 个人知识 compilation 的 harness。通过 Schema/Skill/CLI/State 四层约束 LLM 行为；三环循环（沉淀→复用/输出→回流）让 wiki compound 增长。人类只 curate/question/think，LLM 负责 summarize/cross-ref/maintain。

### 四层建构

```
+-----------------------------------------------------------+
| Schema 层                                                 |
|   corpus/CLAUDE.md + frontmatter-spec + 目录约定          |
|   职责：规定"数据长什么样"（type / 必填字段 / wikilink）   |
+-----------------------------------------------------------+
| Skill 层（wiki-ingest / query / fileback / lint / ...）   |
|   纯 markdown 指令；定义"怎么操作数据"                    |
|   职责：规定 LLM 的工作流程与决策规则                     |
+-----------------------------------------------------------+
| CLI 层（lorekit fetch / index / sync / lint / ...）       |
|   thin CLI，无 LLM 调用；提供文件系统 + 向量原语           |
|   职责：保证 Skill 能跑的确定性操作（io / 索引 / 校验）    |
+-----------------------------------------------------------+
| State 层                                                  |
|   .wiki/ingest-state.json + vector.sqlite + snapshots/    |
|   职责：记录"事情做到哪一步"，防止 LLM 进程断后丢线        |
+-----------------------------------------------------------+
```

### 三环循环

```
              +--- 沉淀环 (ingest) ---+
              |                       |
              v                       |
  URL/文本/日记  ──► 原料/ ──► 知识库/（wiki page）
                                  │
                                  │
              +--- 复用环 (query) ---+
              |                      |
              v                      │
            提问 ──► Read/向量检索 ──┘
                                  │
                                  ▼
                               答案
                                  │
              +--- 输出环 (output) ---+
              |                       |
              v                       │
  输出/问答 + 输出/文章 + 输出/幻灯片 ...
                                  │
                                  │ fileback 回流
                                  ▼
                            synthesis 页回知识库/
```

人类职责：`curate` 素材 / `question` 提问 / `think` 判断。
LLM 职责：`summarize` 压缩 / `cross-ref` 建联 / `maintain` 巡检。

### harness 视角下的 Gap 简表

| 环   | 已有                         | 缺                                                                 |
| ---- | ---------------------------- | ------------------------------------------------------------------ |
| 沉淀 | fetch/ingest state machine   | aliases 对齐、Evolution Log、SHA-256 完整性、QUESTIONS 队列、personal 分流 |
| 复用 | BM25/vector/RRF hybrid       | re-rank 第四环、confidence 加权、query 产物价值评估                |
| 输出 | wiki-fileback（手动触发）    | `输出/` 目录骨架、outputs 持久化、fileback 自动化、反向检验（防回音室） |

### Reference

harness 规则设计参考：先生飞书《LLM Wiki 搭建教程》
`https://hcn9zwu8a0fz.feishu.cn/wiki/AM3ewXySViopPdkE8Gic90BDnRb`
（外部链接，不归档副本；需查阅规则设计思路时打开）

## 8. Karpathy 原文 vs 多领域 corpus：为什么 wiki 不做物理分区

### 背景

Karpathy 的 LLM Wiki Gist 原文假设：**1 wiki = 1 domain**（专项 wiki，如一个 Python 项目 wiki / 一个论文领域 wiki）。
先生 corpus 是**跨领域**：AI / 求职 / 金融 / 内容生产 / 个人项目 / 思考...

### 图书馆心智（按领域物理分区）的证伪

今日讨论曾推演过"按领域分顶层目录"方案（`知识库/ai/` / `知识库/求职/` / ...），被证伪：

- **压制跨领域联想**：顶层物理分区把"AI 的思维方式用在求职"这类跨域综合**物理阻断**
- **压制复用**：一份内容（如"第一性原理"）同时服务 AI / 思考 / 写作，物理分区逼人复制或者选一个归属
- **新增维护负担**：领域边界模糊时（AI Agent 是 AI 还是工具？），分类纠结消耗人类 attention

### 正确方向：融合是 LLM 的活，不是产品的活

- **物理层按内容类型**（Karpathy 原味）：`知识库/{概念,实体,摘要,专题,思考}/`
- **逻辑层靠 LLM 语义融合**：frontmatter tag（若需）+ 向量检索 + L0 导览图
- **L0 `index.md` 可以按领域组织导览段落**，但**物理目录不按领域切**

### 两极同事物：起点 vs 演化终态

- **Karpathy 原味 = 起点**：小规模（<100 页），单目录扁平，全量 catalog 够用
- **图书馆心智 = 演化终态**：大规模（1000+ 页），单个 `_INDEX.md` 触发阈值才分流
- **分形演化原理**：任何一层 index 超阈值 → 本层简介化 + 下层 _INDEX 接班做目录，递归下去就是图书馆

图书馆心智本身没错，错在**现在就按图书馆样子物理分区**——那是把终态结构强加给起点规模。
详见 IDEAS.md 「演化核心原则：局部触发、局部执行」与「演化工程清单」。

## 9. 设计原则：lorekit 引入的结构，配套约定应该 CLI 化

### 原则

> **当 lorekit 以工具身份决定了某种结构（`_INDEX.md` 自动生成、约定 `_工作台/` 是临时区、约定 `系统/` 是规范区），与之配套的"使用约定"（图谱过滤 / 搜索过滤 / lint 跳过）也应该是 lorekit 工具层提供的预设，不该让每个用户重新发明一遍。**

### Obsidian graph filter 的设计决策（批次 25）

**排除**（非知识 / 临时 / 元数据）：

- 目录：`_工作台/` `_归档/` `反馈/` `系统/`
- 文件：`_INDEX.md` `index.md` `log.md` `MEMORY.md` `README.md` `AGENTS.md` `CLAUDE.md`

**保留**（综合图书馆心智模型）：

- `每日/` — 先生定位"我的来时路"：日记含人际互动 + 工作项目细节，不是乱记录。Karpathy 原文也保留日记
- `写作/` — 对外作品，和 wiki 强关联，需要看到溯源链
- `原料/` — wiki 页 `[[原料/...]]` 反链大量，排除会切断溯源
- `知识库/` — 主体

### 已落地的"工具决定 → 约定内置"应用

| lorekit 引入的结构                                     | 配套约定                          | 状态                |
| ------------------------------------------------------ | --------------------------------- | ------------------- |
| `_工作台/` `_归档/`                                    | vector 不索引 / lint 跳过         | ✅（lib/paths.ts）  |
| `_INDEX.md` 自动生成                                   | Obsidian graph filter             | ✅ 批次 25          |
| `系统/` schema 区                                      | graph filter                      | ✅ 批次 25          |
| 根元数据（AGENTS / CLAUDE / log / MEMORY / README）    | graph filter                      | ✅ 批次 25          |
| `反馈/` audit 区                                       | graph filter                      | ✅ 批次 25          |
| `.wiki/` 元数据                                        | .gitignore（已做）+ Obsidian userIgnoreFilters | ⏳ 后续  |
| 中文目录命名                                           | 备份 / 归档命令默认包含           | ✅ 已做             |

### 设计判断标准

当考虑是否内置某约定时，问自己：**这个约定是 lorekit 决定的，还是用户偏好？**

- 工具决定 → 内置预设（safe-write 不覆盖用户调整）
- 用户偏好 → 不动

### 老用户触达：批次 26 升级 Layer 3

批次 25 的 `lorekit init` 解决新用户。老用户（v0.4.0 前 init 的 corpus）通过：
1. **CLI** — `lorekit obsidian-tune` 检查 + `--write` 一键应用
2. **被动触达** — `lorekit doctor` 主动提示 filter 不完整 + 修复命令
3. **Layer 3 命令存在意义升级**：从"单条 graph filter 不值得养独立命令"变成"诊断 + 修复 .obsidian/ 配置漂移的专门命令"，未来加 colorGroups / userIgnoreFilters 等都纳入这个命令
