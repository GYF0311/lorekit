---
cmap_version: 0.1
context_type: candidate
project: lorekit
source: auto-adopt
confidence: candidate
needs_review: true
---
# Adoption Guide

本项目正在接入 CMAP。该文件是 adoption 过程的候选说明，不是最终项目事实；最终可信入口看 `.context/MAP.md`、`.context/CHECKPOINT.md`、`.context/STATUS.md`、`.context/VERIFY.md` 和 `.context/modules/*.md`。

## 确定性扫描信号

检测到的技术栈：
- Node.js
- TypeScript

检测到的文件：
- package.json
- README.md

检测到的 npm scripts：
- npm run build
- npm run dev
- npm run test:smoke
- npm run verify
- npm run lint
- npm run lint:fix
- npm run format
- npm run format:check
- npm run prepublishOnly
- npm run version

候选模块目录：
- None detected

已有入口文件：
- README.md
- AGENTS.md
- CLAUDE.md

## 重要边界

以上只是自动扫描候选，不要直接当成可信项目事实。

AI 接手时必须：
1. 先读 `AGENTS.md` 和 `README.md`。
2. 再读 `package.json` 与代表性源码。
3. 确认模块边界，不只相信自动扫描。
4. 更新 `MAP.md`。
5. 创建或补齐 `modules/*.md`。
6. 更新 `STATUS.md`。
7. 更新 `VERIFY.md`。
8. 运行 `cmap verify`。
