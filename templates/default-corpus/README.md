# 我的 Corpus

这是一个用 [lorekit](https://github.com/GYF0311/lorekit) 初始化的个人知识 corpus。

## 它是什么

基于 [Karpathy LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 的结构化 Markdown 知识库，设计给 LLM Agent（Claude Code / Codex / Cursor 等）读写。

核心思路：不走 RAG，让 LLM 增量编译并维护一个持久 wiki。知识编译一次、持续更新。

## 三层架构

- **原料/** — 只读原始素材（文章、论文、录音转写…）
- **知识库/** — LLM 编译的 wiki 产物（概念、实体、摘要…）
- **CLAUDE.md** — 本 corpus 的 schema，人 + LLM 共同维护

## 怎么用

### 第一次

1. 打开 `CLAUDE.md` 通读——那是 Agent 和你都要遵守的 schema
2. 打开 `系统/filing-rules.md` 看归档路由表
3. 在 `每日/` 创建今天的日记；往 `原料/` 丢一些素材让 Agent 编译

### 日常

- 想记点什么却没整理好 → 扔进 `_工作台/收件/`
- 有一篇想保存的文章 → 原文进 `原料/文章/`，Agent 编译进 `知识库/`
- 想搜之前整理过什么 → 让 Agent 用 `wiki query` 查 `index.md`
- 对话中产生的洞察 → 让 Agent file back 存进 `知识库/`
- 定期体检 → `lorekit doctor` 扫断链、孤岛、过期文件
- 对 wiki 内容有意见 → 往 `反馈/待处理/` 提 feedback

### 三条铁律

1. **主语决定归属**——判断内容讲的是谁/什么，再落盘
2. **原料只读**——分析结论必须搬到 `知识库/`
3. **任何 ingest 至少一条反向链接**

## 目录结构

见 `系统/schema.md`。

## Obsidian 图谱过滤建议

`lorekit init` 已写入 `.obsidian/graph.json` 推荐 filter（若你原本就有 `.obsidian/graph.json`，init 会跳过避免覆盖）。推荐 filter：

```
-path:"_工作台" -path:"_归档" -path:"反馈" -path:"系统" -file:"_INDEX" -file:"index" -file:"log" -file:"MEMORY" -file:"README" -file:"AGENTS" -file:"CLAUDE"
```

排除 `_工作台/_归档/反馈/系统/` 与 `_INDEX / index / log / MEMORY / README / AGENTS / CLAUDE` 这些非知识 / 元数据文件；保留 `知识库/`（主体）`原料/`（溯源）`每日/`（日记）`写作/`（对外作品）。

手动复制到 Obsidian「关系图谱 → 筛选」并保存为默认即可。改完 graph.json 后关掉「关系图谱」标签页再重开才生效。

## GBrain 可选集成

`lorekit gbrain` 可以把 `知识库/` 导出成 GBrain 友好的只读 staging copy：

```bash
lorekit gbrain export --dry-run
lorekit gbrain export
lorekit gbrain sync --dry-run
lorekit gbrain sync
lorekit gbrain query "..."
```

边界：GBrain 只读 `.wiki/integrations/gbrain-export/`，不能直接写回 `知识库/` 或 `原料/`。`sync` 会先检查外部 binary；缺失时默认不刷新 staging。`query` 默认检查 export/sync freshness，只有明确调试旧索引时才传 `--no-stale-check`。

## 版本

当前 lorekit 版本记在 `.wiki/version`。
