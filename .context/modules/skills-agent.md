---
cmap_version: 0.1
context_type: module
project: lorekit
module: skills-agent
aliases:
  - skill
  - skills
  - wiki-ingest
  - wiki-query
  - install-skills
  - agent
  - AGENTS
  - CLAUDE
  - AI
  - 工作流
paths:
  include:
    - skills/**
    - src/commands/install-skills.ts
    - integrations/claude-code/**
    - templates/default-corpus/AGENTS.md
    - templates/default-corpus/CLAUDE.md
relations:
  uses:
    - cli
    - fetch-ingest
    - sync-search-vector
    - safety-maintenance
  constrained_by:
    - corpus-core
source_commit: 62576ef
updated_at: 2026-05-17T10:44:32Z
confidence: ai-drafted
---
# Module: Skills / Agent Workflows

## Purpose
定义 `wiki-*` markdown skills，告诉 AI agent 如何使用 lorekit 的确定性 CLI 原语完成 ingest / query / fileback / lint / output / audit / remove 等工作流。

## Owned Paths
- `skills/wiki-*/SKILL.md`
- `skills/wiki-*/_INDEX.md`
- `src/commands/install-skills.ts`
- `integrations/claude-code/**`
- `templates/default-corpus/AGENTS.md`
- `templates/default-corpus/CLAUDE.md`

## Key Contracts
- CLI 保持 thin + deterministic；语义工作流放在 markdown skills。
- `lorekit install-skills` 当前主要支持 Claude Code 全局安装；其他 agent 可 copy/symlink markdown skill folders。
- project-local skills 是工具，不是 canonical corpus pages；lint/index/vector 不能把它们扫成 wiki 内容。
- skill 不能承诺不存在的 CLI 命令或参数。
- skill 规则应保持通用，不把 lorekit 项目自身的临时边界写进用户 corpus skill。

## Module Relationships
- 使用 `cli` 暴露的命令。
- 调用 `fetch-ingest`、`sync-search-vector`、`safety-maintenance`。
- 受 `corpus-core` 的 schema/path 约束。

## Read Next
- `README.md` install routes 和 feature map。
- `docs/ARCHITECTURE.md` design philosophy。
- 相关 `skills/wiki-*` 目录。

## Tests / Verification
- 人工从头到尾读变更 skill。
- 如果 skill 引用了改动后的 CLI 行为，跑对应 targeted CLI tests。
- 如果伴随代码变更，跑 `npm run verify`。
