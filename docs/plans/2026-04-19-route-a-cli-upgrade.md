---
type: plan
title: "Plan A：lorekit CLI + docs + 默认骨架升级"
slug: docs/plans/2026-04-19-route-a-cli-upgrade
created: 2026-04-19
updated: 2026-04-19
status: draft
---

# Plan A：lorekit CLI 升级

> 路线定位：**lorekit 工具侧**（代码 / docs / 默认 corpus 骨架）。
> 对应路线：先生今日确认的"两条路线"中的 CLI 路线。
> 另一路线见：[Plan B](./2026-04-19-route-b-schema-skill-upgrade.md)。

## 目标

把今天（2026-04-19）讨论收束的**产品定位（harness）** 和 **Read 路径保障** 落地到 lorekit 仓库侧。本轮**不做向量栈新功能**，不做新 lint 检查项——聚焦文档收束、默认骨架升级、Read 路径验证。

## 背景

今日讨论轨迹：多领域分区 → 图书馆心智 → LLM Wiki 原生 → harness 定位。最终收束：

- lorekit 定位 = **个人知识 compilation 的 harness**
- 四层建构：Schema / Skill / CLI / State
- 三环循环：沉淀 / 复用 / 输出 + fileback 回流
- 先生 corpus 规模（14 页）远低于阈值（100），**Read 三层够用，向量延后**

本 plan 所有改动在 `~/code/lorekit/` 内完成，产出新 version 后先生通过 `git pull + npm run build` 获取。

## 分批

### 批次 A1：文档收束（产品定位钉死）

**目标**：把今天的产品定位共识写进 lorekit 仓库的 docs/ 下，归档已证伪的废案，让新会话接手时能一眼看到正确方向。

**改动文件**：

| 文件 | 动作 |
|------|------|
| `docs/DESIGN-NOTES.md` | 删 §5.1（综合 wiki schema 升级） |
| `docs/DESIGN-NOTES.md` | 新增章节「§7 lorekit 产品定位：个人知识 compilation harness」 |
| `docs/DESIGN-NOTES.md` | 新增章节「§8 Karpathy 原文 vs 多领域 corpus：为什么 wiki 不做物理分区」（今日讨论沉淀） |
| `docs/DESIGN-NOTES.md` | 新增 reference 指向先生飞书《LLM Wiki 搭建教程》URL |
| `docs/IDEAS.md` | 删顶部「2026-04-19 综合 wiki schema 升级」条目（已证伪） |
| `docs/IDEAS.md` | 新增高 ROI 条目（见下） |
| `AGENTS.md` | 更新 "Project Status" / "待决策（高）" 从 "schema 升级" 改为 "harness 规则补全 + Read 路径保障（见 Plan A/B）" |

**IDEAS 新增条目（按「本轮做 → 规模触发 → 远期」三组排序）**：

#### A. 本轮 Plan A/B 正在做的（落地条目，完成后从 IDEAS 移除或归档）

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

#### B. 规模触发才做（列为 IDEAS 备案，触发条件明确）

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

#### C. 远期（硬件 / 生态成熟）

26. **LLM re-rank 第四环**（硬件允许后）——候选路径：Claude Haiku API / Cohere rerank / 等蒸馏小模型
27. **向量 chunk 元数据注入**（向量栈启用前必做）——chunk 携带 `confidence / domain_volatility / last_reviewed / aliases`。**推荐方案 C**（关键字段嵌 prefix 提高 embedding 区分度 + 次要 JOIN 回查）
28. **Wikilink 格式铁律**（英文 slug 强制 lint）——当前保留中文现状（决策 1 (i)），规模起来真痛再做
29. **Query 产物自动 fileback**（Karpathy 原文"explorations compound"）——query 结束后 LLM 主动判断是否值得 fileback
30. **多轮讨论产物持久化**——wiki-query skill 检测对话轮数 ≥ N 触发收束，落 `输出/讨论/`
31. **LLM 主动联想下一步研究话题**——依赖 Gap Analysis 和 arXiv / 公众号订阅源接入

**验证**：
- `docs/DESIGN-NOTES.md` 能被新会话通过 `@./docs/DESIGN-NOTES.md` 加载
- `AGENTS.md` 顶部状态刷新，新会话读 AGENTS.md 立即看到新方向

**产物**：一个 commit：
`docs: 产品定位收束为 harness + 归档 schema 升级废案 + 新增 harness 补强 IDEAS`

**回滚**：单 commit `git revert` 即可恢复。

---

### 批次 A2：templates/default-corpus/ 骨架升级

**目标**：让 `lorekit init` 生成的新 corpus 自带 harness 升级所需的目录 + 文件骨架。

**改动文件**：

| 文件 / 目录 | 动作 |
|------------|------|
| `templates/default-corpus/原料/个人写作/.gitkeep` | 新增（personal-writing 落点） |
| `templates/default-corpus/输出/问答/.gitkeep` | 新增 |
| `templates/default-corpus/输出/文章/.gitkeep` | 新增 |
| `templates/default-corpus/输出/幻灯片/.gitkeep` | 新增 |
| `templates/default-corpus/输出/图表/.gitkeep` | 新增 |
| `templates/default-corpus/输出/体检报告/.gitkeep` | 新增 |
| `templates/default-corpus/输出/空缺分析/.gitkeep` | 新增 |
| `templates/default-corpus/知识库/模板/.gitkeep` | 新增（模板本身在 Plan B 批次 3 写内容） |
| `templates/default-corpus/QUESTIONS.md` | 新增（空骨架 + frontmatter `type: system-questions, graph-excluded: true`） |
| `templates/default-corpus/overview.md` | 新增（空骨架 Health Dashboard + frontmatter `type: system-overview, graph-excluded: true`） |
| `src/commands/init.ts` | 验证拷贝逻辑覆盖新目录（如果是递归拷贝应该自动工作，不需改代码） |

**验证**：

```bash
# 新临时目录验证 init 骨架
mkdir -p /tmp/lorekit-init-test-$(date +%s)
cd /tmp/lorekit-init-test-*
lorekit init .
ls -la                          # 应看到 原料/ 知识库/ 输出/ _工作台/ _归档/ 每日/ 写作/ 反馈/ 系统/
ls 输出/                         # 应看到 6 个子目录
ls 知识库/模板/                  # 应是空目录（或只有 .gitkeep）
test -f QUESTIONS.md && echo ok
test -f overview.md && echo ok
```

**产物**：一个 commit：
`feat(init): 骨架加 输出/ QUESTIONS.md overview.md 原料/个人写作 知识库/模板`

**回滚**：单 commit revert；不影响已 init 的 corpus（不会自动迁移）。

---

### 批次 A3：src/lib/paths.ts exclude 更新

**目标**：让 `输出/` 目录默认不进向量索引（即使未来启用向量，答案产物也不该被重复索引）。

**改动文件**：

| 文件 | 动作 |
|------|------|
| `src/lib/paths.ts` | exclude 列表加 `输出/**` |
| `src/lib/paths.ts` | 代码注释说明 `.assets/` 随父目录 exclude（不需要单独列） |

**验证**：

```bash
cd ~/code/lorekit
npm run build
cd /Users/gaoyifan/Desktop/OpenClaw-Base-Camp/corpus
# 向量未同步的话先不跑 sync，只看 status
lorekit vector status --json | jq '.indexed_files, .exclude_patterns'
# 确认 输出/ 在 exclude_patterns，且未来同步不会扫进去
```

**产物**：一个 commit：
`feat(paths): 输出/ 加入 exclude + .assets/ 注释说明随父目录`

**回滚**：单 commit revert。

---

### 批次 A4：先生 corpus Read 路径健康度基线

**目标**：在先生 corpus 上跑一次 `lorekit index` + `lorekit lint`，摸清当前 Read 路径的真实状态。建立 baseline，后续问题按 baseline 回归。

**动作**：

```bash
cd /Users/gaoyifan/Desktop/OpenClaw-Base-Camp/corpus

# 1. 先 snapshot（防失误）
lorekit snapshot

# 2. 补全所有 _INDEX.md
lorekit index

# 3. lint 扫全量
lorekit lint > /tmp/lorekit-lint-baseline-$(date +%Y-%m-%d).txt

# 4. diff 前后（看哪些 _INDEX.md 新建 / 更新）
git -C . status   # 如果 corpus 是 git 管理的
```

**验证**：

- `lorekit index` 输出无报错
- `lorekit lint` 报告落到 `/tmp/` 文件
- baseline 报告的漂移项（缺 _INDEX / frontmatter 不全 / 孤岛 / 死链）汇总

**产物**：**非 commit**。baseline 报告在 `/tmp/` 产生副本，lorekit 仓库侧不变。报告结果决定要不要追加批次 A4.5（补修 baseline 中的问题）。

**回滚**：通过 `lorekit restore <snapshot>` 恢复 corpus。

---

## 不做的（本 plan 明确延后）

| 延后项 | 理由 |
|--------|------|
| `lorekit vector sync` / hybrid 新功能 | 先生明确"先不管向量" |
| 改 `index.md` 为"领域导览图" | DESIGN-NOTES §4 那个问题是向量 MATCH 背景下的，纯 Read 不是问题 |
| 新 lint 检查项（aliases / SHA-256 / Jaccard / Stale / Wikilink 铁律） | 属于 harness 规则补全，按 ROI 分批做，不在本 plan |
| 新 CLI 命令 `lorekit output` | 输出环的 CLI 端，新 skill `wiki-output` 先落（Plan B），CLI 命令未来加 |
| LLM re-rank | 硬件瓶颈 + 规模未到 |

## 整体验证

- `npm run verify` 在本 plan 每批完成后都能通过
- `lorekit init <temp>` 新骨架完整
- `lorekit lint` 在先生 corpus 上的 baseline 报告产生
- 新会话读 `AGENTS.md` + `docs/DESIGN-NOTES.md` 立即对齐 harness 定位

## 整体风险

| 风险 | 缓解 |
|------|------|
| 改 paths.ts exclude 误伤现有 corpus 索引 | 批次 A3 先 vector status 看现状，只加不删 |
| `lorekit init` 拷贝逻辑对新骨架行为异常 | 批次 A2 跑临时目录 init 验证 |
| 先生 corpus lint baseline 报告大量问题 | 批次 A4 产出 baseline，问题不要立即改，进入"baseline 治理"路径分批 |

## 整体回滚

- 每批独立 commit，单批 `git revert`
- 先生 corpus 侧只有批次 A4 会改（`_INDEX.md` 补全）——有 snapshot 兜底
- `templates/default-corpus/` 改动不影响现有 corpus

## 执行顺序

A1 → A2 → A3 → A4（A1 A2 A3 可合并一次 PR，A4 独立执行）。

---

## 签收

先生 review 通过后：
- [ ] 批次 A1 开始
- [ ] 批次 A2 开始
- [ ] 批次 A3 开始
- [ ] 批次 A4 开始
