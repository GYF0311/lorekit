---
cmap_version: 0.1
context_type: verify
project: lorekit
source_commit: 62576ef
updated_at: 2026-05-17T14:34:56Z
confidence: ai-drafted
---
# Verification

> 中文验证页。英文标题是 CMAP CLI 的结构锚点，正文以中文为准。

## Required Commands
| Purpose | Command | Expected | When |
|---|---|---|---|
| 代码基线 | `npm run verify` | `tsc --noEmit`、`tsup`、`node --test tests/smoke/*.test.mjs` 通过 | 声称代码变更完成前 |
| Lint | `npm run lint` | exit 0 | release 或 lint 规则交接前 |
| Build | `npm run build` | exit 0 | release 或构建相关交接前 |
| CMAP 结构 | `cmap verify --changed` | 0 errors；warnings 必须解释 | 收尾 `.context` 或源码变更前 |
| Obsidian 导出 | `cmap obsidian export --check --out _cmap/lorekit` | 导出层与 `.context` 一致 | `.context` 变更并导出后 |
| Review HTML | `cmap view export --check --ui-lang zh-CN --out _cmap-view` | 中文 Review HTML 与 `.context` 一致 | `.context` 变更并导出后 |
| 空白检查 | `git diff --check` | 没有 whitespace errors | commit 或最终交接前 |

## Module-specific Checks
| 模块 | 命令 | 人工检查 |
|---|---|---|
| project-map | `cmap route "<task>"` + `cmap verify --changed` | `.context` 正文中文，frontmatter 可被工具解析；入口文件未被覆盖 |
| cli | `node dist/cli.js --help` after build | 命令列表包含新增/修改的命令 |
| corpus-core | 相关路径规则 smoke test | 新路径/排除规则集中在 `src/lib/paths.ts` |
| fetch-ingest | `node --test tests/smoke/fetch-mock.test.mjs tests/smoke/ingest-record.test.mjs` | state transitions、duplicate、in-progress 行为仍明确 |
| sync-search-vector | 相关 vector/search smoke tests | 非 vector 任务不被可选向量环境阻塞 |
| safety-maintenance | 相关 `doctor/lint/snapshot/restore/remove` smoke tests | `remove` 保持 snapshot + Trash + provenance 边界 |
| skills-agent | 人工读改动的 `skills/*/SKILL.md` | skill 不承诺不存在的 CLI 能力 |
| obsidian-gbrain | 相关 Obsidian/GBrain smoke tests | GBrain 仍只写 staging/report，不写回 canonical wiki |
| docs-tests-release | `npm run verify` + docs diff review | 用户可见行为已更新到现有永久文档 |

## Optional Commands
- `npm run lint`
- `npm run format:check`
- Targeted `node --test tests/smoke/<name>.test.mjs`
- `lorekit doctor --json` inside a real corpus when changing corpus health semantics
- `cmap verify --coverage`
- `cmap verify --stale`
- `cmap verify --freshness`

## Manual Verification
- 确认 `AGENTS.md` / `CLAUDE.md` 只追加 CMAP 说明，没有覆盖原有规则。
- 确认 `_cmap/lorekit` 和 `_cmap-view` 是生成视图，不含新语义事实。
- 涉及数据移动命令时，先看 dry-run，再确认 snapshot / Trash 行为。
- JSON 输出要确认 stdout 仍可机器读取，人类提示走 stderr。

## Known Flaky Checks
Vector / Ollama 检查依赖本机可选服务和 native deps。验证文本层行为时，优先 targeted tests 或 `--skip-vector`。

## Environment Assumptions
本机应有 Node.js >= 18、npm、git、ripgrep。Ollama、`sqlite-vec`、GBrain、Playwright 都是可选集成；缺失时应清晰降级或报错。
