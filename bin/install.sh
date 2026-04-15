#!/usr/bin/env bash
set -euo pipefail

# lorekit installer: add bin/ to user's PATH via shell rcfile.

LOREKIT_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT_LINE="export PATH=\"$LOREKIT_BIN:\$PATH\""

detect_rcfile() {
  local shell_name
  shell_name="$(basename "${SHELL:-}")"
  case "$shell_name" in
    zsh)  echo "$HOME/.zshrc" ;;
    bash) [[ -f "$HOME/.bashrc" ]] && echo "$HOME/.bashrc" || echo "$HOME/.bash_profile" ;;
    fish) echo "$HOME/.config/fish/config.fish" ;;
    *)    echo "$HOME/.profile" ;;
  esac
}

RCFILE="$(detect_rcfile)"
mkdir -p "$(dirname "$RCFILE")"
touch "$RCFILE"

if grep -Fq "$LOREKIT_BIN" "$RCFILE"; then
  echo "[lorekit] PATH already contains $LOREKIT_BIN in $RCFILE — skipping."
else
  {
    echo ""
    echo "# lorekit"
    echo "$EXPORT_LINE"
  } >> "$RCFILE"
  echo "[lorekit] added lorekit bin to $RCFILE"
fi

echo "[lorekit] run 'source $RCFILE' or open a new shell, then try: wiki --version"
