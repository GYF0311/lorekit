# lorekit

A toolkit for Claude Code to grow a personal corpus from scratch.

`lorekit` 给 Claude Code（以及任何支持 skill / markdown 指令的 agent harness）提供一套本地 LLM Wiki 工作流：**skill + corpus 目录骨架 + 薄 CLI + 可插拔本地向量层**。用户从空目录起步，逐步沉淀出自己的个人知识库。

## 这是什么

- **lorekit** — 本仓库，包含 skill / CLI / corpus 模板 / 集成脚本
- **corpus** — 用户的知识库目录，由 `wiki init` 创建，纯 markdown + git
- **wiki CLI** — 一支 bash 脚本，提供 `init / doctor / search / stats / lint / install-skills` 等确定性操作
- **wiki-\* skills** — 5 个纯 markdown skill，指导 agent 如何做 ingest / query / fileback / lint / enrich

## 核心原则

1. **Filesystem is all you need** — 数据层是纯 markdown + git，向量层用 sqlite-vec
2. **Thin CLI, fat skills** — 需要判断的事放 skill（markdown 指令），确定性操作放 CLI（bash）
3. **向量模型可插拔** — 通过 `providers/` 适配器抽象，默认 BGE-M3（via Ollama），可换任意开源 embedding
4. **零起点设计** — 所有功能围绕"空目录开始"为默认场景
5. **破坏性操作可回滚** — 改动 corpus 前必须 git commit；lint 只报告不自动修

## 快速开始

```bash
# 1. 克隆并安装
git clone https://github.com/GYF0311/lorekit ~/code/lorekit
cd ~/code/lorekit && ./bin/install.sh

# 2. 初始化 corpus
wiki init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus

# 3. 装 Claude Code skills
wiki install-skills --target claude-code

# 4. 重启 Claude Code，用自然语言对话即可
```

详见 [`docs/QUICKSTART.md`](docs/QUICKSTART.md)。

## 项目结构

```
lorekit/
├── bin/                  thin CLI (bash ≤ 300 行)
│   ├── wiki              主命令分发器
│   ├── lib/              子命令实现
│   └── install.sh        把 wiki 加入 PATH
├── skills/               fat skills (pure markdown)
│   ├── wiki-ingest/
│   ├── wiki-query/
│   ├── wiki-fileback/
│   ├── wiki-lint/
│   └── wiki-enrich/
├── templates/
│   └── default-corpus/   corpus 目录骨架（11 主 + 2 特殊）
├── integrations/
│   └── claude-code/      Claude Code 集成脚本
└── docs/                 用户 / 开发者文档
```

## Corpus 骨架

`wiki init` 创建的 corpus 默认包含 11 个主目录和 2 个特殊目录：

| 目录 | 用途 |
|---|---|
| `00_每日/` | 日记、月度复盘 |
| `10_人物/` | people，单页 MECE |
| `20_项目/` | projects |
| `30_概念/` | concepts，可复用心智模型 |
| `40_主题/` | topics，实战方法论 |
| `50_方法/` | methods、工具 SOP |
| `60_来源/` | sources（严格只读原始数据） |
| `70_录音/` | 录音原始 + 流程产物 |
| `80_写作/` | 创作输出 |
| `90_*/` | 自选活跃领域（默认留空） |
| `99_系统/` | schema、filing-rules、changelog |
| `_工作台/` | 过程文件缓冲区（7/14/30 天过期策略） |
| `_archive/` | 冷数据陵园 |

元数据目录 `.wiki/` 保存 corpus 版本、向量库配置、向量数据库（v0.5+）。

## 五个 skill

| skill | 职责 |
|---|---|
| `wiki-ingest` | 把外部资料（URL / 文件 / 粘贴文本）按主语落盘到 corpus |
| `wiki-query` | 三层检索（精确 / 模糊 / 图遍历）并综合答案，带来源引用 |
| `wiki-fileback` | 把对话中产生的洞察追加到对应页面的 Timeline |
| `wiki-lint` | 健康检查：frontmatter、断链、孤岛、重复、过期、工作台清理 |
| `wiki-enrich` | 从日记按主语提炼高信号内容，生成月度复盘 |

所有 skill 是纯 markdown，不含任何 harness 专有语法，可被 Claude Code 通过 `install-skills` 软链到 `~/.claude/skills/`。

## 路线图

| 阶段 | 内容 |
|---|---|
| **v0.1 MVP**（当前） | 模块 1-4：骨架 + skill + CLI + Claude Code 集成 |
| **v0.5** | 模块 5：可插拔向量层（sqlite-vec + L0/L1/L2 层次检索） |
| **v1.0** | 增加 provider（FlagEmbedding / ST / llama.cpp）、交互式 init、文档完善 |
| **v2.0+** | 时效标记、reranker、循环工作、其他 harness 支持 |

完整规划见 [`docs/03-SPEC-AND-PLAN.md`](https://github.com/GYF0311/lorekit/blob/main/docs/)（技术规范，尚在整理入仓）。

## 依赖

| 工具 | 用途 |
|---|---|
| bash ≥ 4 | CLI 脚本 |
| git | 版本控制、commit gate |
| ripgrep (`rg`) | 精确搜索 |
| jq | JSON 处理 |
| Ollama + BGE-M3（v0.5+） | 默认向量层 |

macOS / Linux 测试通过。Windows 未测试。

## License

MIT
