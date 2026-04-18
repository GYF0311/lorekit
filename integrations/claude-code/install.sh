#!/usr/bin/env bash
# Thin shim — 转发到 `lorekit install-skills --target claude-code`。
#
# 历史背景（LEGACY P3-2）：本脚本曾是独立 install 入口，自带软链 / 记录逻辑，
# 还包含 rm -rf 操作。现在 `lorekit install-skills` 命令已经内置同样能力（且
# 更安全：用 unlinkSync 仅删 symlink，不动真目录）。本脚本保留是为了兼容既有
# README / 教程的引用；新代码请直接调 lorekit CLI。
set -euo pipefail

if ! command -v lorekit >/dev/null 2>&1; then
  echo "[err] lorekit CLI not found in PATH" >&2
  echo "       run: cd \"\$(dirname \"\$0\")/../..\" && npm link" >&2
  exit 1
fi

exec lorekit install-skills --target claude-code "$@"
