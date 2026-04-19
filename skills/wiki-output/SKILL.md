---
name: wiki-output
description: 对外输出：Marp 幻灯片、对外文章草稿、matplotlib 图表、汇报材料。读 corpus/知识库/ 里已有沉淀综合生成，落盘到 corpus/输出/{子目录}/，不自动回流。触发词：Marp 幻灯片、对外文章、matplotlib 图表、汇报、演讲稿、做 ppt、出图、投稿。
---

# wiki-output

把 `corpus/知识库/` 里的已有沉淀组合成**对外产物**（幻灯片 / 文章 / 图表 / 汇报稿），落在 `corpus/输出/{子目录}/` 下作为**终态产物**保留。

## When to trigger

- 用户说"做个 Marp 幻灯片讲 XXX"、"给我做个分享 PPT"、"演讲稿"
- 用户说"写一篇对外文章"、"我要投公众号"、"给我一份投稿草稿"
- 用户说"出一张 matplotlib 图"、"趋势图"、"对比图"
- 用户说"汇报一下 XXX"、"写一份给 XXX 看的汇报材料"

**不要触发**：

- 用户只是内部 query / 综合 → `wiki-query`（产物落 `输出/问答/`）
- 用户要存外部资料 → `wiki-ingest`
- 用户要存对话洞察 → `wiki-fileback`

## 分工边界（重要）

| 本 skill 负责 | 不负责 |
| --- | --- |
| 读 `知识库/` 综合，组织成对外叙事 | 爬外部新资料（去 wiki-ingest） |
| 按输出类型选格式（.md / .py / marp） | 回流进知识库（除非先生明确） |
| 落盘到 `corpus/输出/{子目录}/` | 更新 concept 页 compiled truth |
| frontmatter 加 `graph-excluded: true` | 修改 `corpus/index.md` 的知识库登记 |

## 产出形式 × 落盘路径

| 输出类型 | 文件形式 | 落盘路径 | frontmatter 关键字段 |
| --- | --- | --- | --- |
| Marp 幻灯片 | `.md`（含 `marp: true`） | `corpus/输出/幻灯片/YYYY-MM-DD-<slug>.md` | `marp: true`, `graph-excluded: true` |
| matplotlib 图表 | `.py`（可直接运行） | `corpus/输出/图表/YYYY-MM-DD-<slug>.py` | 无 frontmatter；头部注释写数据来源 wikilink |
| 对外文章 | `.md`（公众号友好） | `corpus/输出/文章/YYYY-MM-DD-<slug>.md` | `graph-excluded: true`, `target_audience: <对象>` |
| 汇报材料 | `.md`（结构化汇报稿） | `corpus/输出/文章/YYYY-MM-DD-<slug>.md` | 同上 |

**铁律**：所有产物 frontmatter **必含** `graph-excluded: true`——输出属于终态产物，不进图谱、不进向量索引（向量 exclude 规则已覆盖 `输出/**`）。

## 6 步流程

### 1. 明确输出类型与受众

先问清楚（或从上下文推断）：

- 什么类型？（Marp 幻灯片 / 对外文章 / matplotlib 图表 / 汇报材料）
- 给谁看？（领导 / 同行 / 公众号读者 / 投稿目标刊物）
- 大概多长？（几页 / 几分钟 / 几千字）

### 2. 读 `知识库/` 相关沉淀

- 先 Read `corpus/index.md` 定位相关分区
- Read `{dir}/_INDEX.md` 定位具体页
- Read 对应 concept / synthesis / 摘要页
- **只用 `知识库/` 的沉淀作为素材**，不要临时 WebFetch 新资料（那是 wiki-ingest 的职责）
- 如果素材不够，主动告诉先生："corpus 里相关沉淀只有 N 页，输出可能单薄。要不要先 ingest 一些新来源？"

### 3. 按输出类型组织叙事

- **Marp 幻灯片**：title / agenda / 分节 slides / take-aways / Q&A / sources 页。每 slide 一个核心论点 + 1-2 个 wikilink 引用
- **对外文章**：标题 → 导言 → 核心论点分节（每节带 source 引用脚注）→ 结论 → 参考资料
- **matplotlib 图表**：头部注释写数据来源 wikilink + 生成时间；代码块可直接跑；若数据需要手工填，注释明确标"数据源 TODO"
- **汇报材料**：背景 → 关键事实 → 分析 → 建议 → 附录（sources）

### 4. 落盘到 `corpus/输出/{子目录}/`

- 路径按上方表格
- frontmatter 必含 `graph-excluded: true`
- 同步更新 `corpus/log.md`：`## [YYYY-MM-DD HH:mm] output | <类型> | <一句话简述>`

### 5. 列出引用的 source / concept wikilink

产物末尾列"引用来源"节，把用到的 `知识库/` 页面以 wikilink 列出，方便先生回查原始证据。

### 6. 不自动回流

**铁律**：输出产物**不自动**触发 `wiki-fileback` 回流进知识库。

- 默认场景：输出是**终态产物**（发出去就完事，不沉淀）
- 例外：先生明确说"这个写的好，存进知识库"→ 才触发 `wiki-fileback` 按主语把精华回流到对应 concept 页 / 新建 synthesis 页

## Tools to use

- Read `corpus/index.md` / `{dir}/_INDEX.md` / 具体文件
- `lorekit search "<q>"` / `lorekit vector query --hybrid --text "<q>"` — 检索素材
- Write — 落盘输出文件
- `lorekit sync` — 输出目录也会被 `_INDEX.md` 扫描（但向量 exclude 规则跳过 `输出/**`）
- 底层：Edit（微调已有输出文件）

## Output format

```
输出类型：Marp 幻灯片
受众：团队技术分享（~15 分钟）
素材来源（N 页）：
  - [[知识库/概念/RAG]]（high confidence）
  - [[知识库/专题/rag-evolution-2024]]（3 sources）
  - [[知识库/摘要/lewis-2020-rag]]
落盘：corpus/输出/幻灯片/2026-04-19-rag-overview.md
log 追加：## [2026-04-19 23:30] output | marp | RAG 技术分享 15min
```

**铁律**：

1. 所有产物 frontmatter 含 `graph-excluded: true`
2. 只用 `知识库/` 的已有沉淀作素材，不临时爬新资料
3. 不自动回流；终态产物就是终态产物
4. 落盘后更新 `corpus/log.md`（一行即可）
