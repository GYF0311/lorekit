@./AGENTS.md

<!-- cmap:start -->
## CMAP 项目地图

本仓库已接入 CMAP。Claude Code 仍应先遵守 `AGENTS.md`；需要续接项目上下文时，按以下顺序读取：

1. `.context/CHECKPOINT.md`
2. `.context/MAP.md`
3. `cmap route "<task>"`
4. 命中的 `.context/modules/<module>.md`
5. 收尾跑 `.context/VERIFY.md` 中的相关命令，至少 `cmap verify --changed`

`.context` 正文默认中文；frontmatter key、module id、命令、路径和代码标识符保留英文。
<!-- cmap:end -->
