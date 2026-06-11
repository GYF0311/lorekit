---
cmap_version: 0.1
context_type: ref
project: lorekit
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: medium
---
# Glossary

| 术语 | 含义 |
|---|---|
| LLM Wiki | AI 把原始材料持续编译成持久 wiki，而不是每次 query 都从 raw docs 重新检索。 |
| `原料/` | corpus 里的只读原始来源层。 |
| `知识库/` | corpus 里的编译后 wiki artifact 层。 |
| `.wiki/` | corpus metadata/state 目录，存 ingest state、snapshots、reports、integrations。 |
| `ingest-state.json` | 每个来源 ingest 进度的唯一事实源。 |
| provenance-aware remove | 按明确来源/页面引用安全移除，不按 topic keyword 级联删除。 |
| CMAP | repo-local 项目地图和确定性维护 CLI，用于帮助 AI coding 新会话续接项目上下文。 |
