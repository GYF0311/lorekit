#!/usr/bin/env bash
# Thin shim — 转发到 `lorekit install-skills --target claude-code --uninstall`。
# 见 install.sh 的注释。
set -euo pipefail

if ! command -v lorekit >/dev/null 2>&1; then
  echo "[err] lorekit CLI not found in PATH" >&2
  exit 1
fi

exec lorekit install-skills --target claude-code --uninstall "$@"
