A toolkit for Claude Code to grow a personal corpus from scratch.

# lorekit

> 不是 harness，是给 Claude Code 的 LLM Wiki 工具包。贡献 Fat Skills + Thin CLI + 可插拔本地向量层，让用户从零起点长出自己的 `corpus`。

## 这是什么

- **lorekit** —— 一个 Claude Code 插件工具包
- **corpus** —— 用户初始化出来的资料库（默认 `~/Desktop/my-corpus/`）
- **Claude Code** —— 真正的"大脑"，lorekit 只给它提供铲子和柜子

## 核心原则

1. **不是 harness** —— 不跑 LLM loop，不接模型 API
2. **Filesystem is all you need** —— 纯 markdown + git + sqlite-vec
3. **Thin Harness Fat Skills** —— 判断在 skill（markdown），执行在 CLI（bash）
4. **向量模型可插拔** —— BGE-M3 默认，但你可以换成任何开源 embedding
5. **零起点设计** —— 不做迁移，新用户从空目录开始

## 快速开始

```bash
# 1. 克隆并安装
git clone https://github.com/your-org/lorekit ~/code/lorekit
cd ~/code/lorekit && ./bin/install.sh

# 2. 初始化 corpus
wiki init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus

# 3. 装 Claude Code skills
wiki install-skills --target claude-code

# 4. 重启 Claude Code，开始用自然语言对话即可
```

## 项目结构

```
lorekit/
├── bin/                  thin CLI (bash ≤ 500 行)
├── skills/               fat skills (pure markdown)
├── templates/            corpus 骨架模板
├── integrations/         harness 集成脚本
│   └── claude-code/
└── docs/                 用户/开发者文档
```

## 当前状态

Phase 1 MVP 开发中。技术规范见项目规划目录（非本仓库）：
`~/Desktop/OpenClaw-Base-Camp/lorekit-project/docs/03-SPEC-AND-PLAN.md`

## License

MIT
