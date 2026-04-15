#!/usr/bin/env bash
set -euo pipefail

if [ -t 1 ]; then C_R=$'\033[31m'; C_G=$'\033[32m'; C_Y=$'\033[33m'; C_0=$'\033[0m'
else C_R=""; C_G=""; C_Y=""; C_0=""; fi

lk_err()  { printf '%swiki:%s %s\n' "$C_R" "$C_0" "$*" >&2; }
lk_warn() { printf '%swiki:%s %s\n' "$C_Y" "$C_0" "$*" >&2; }
lk_ok()   { printf '%s✓%s %s\n'   "$C_G" "$C_0" "$*"; }
lk_bad()  { printf '%s✗%s %s\n'   "$C_R" "$C_0" "$*"; }

lk_version() { [ -f "$LOREKIT_ROOT/VERSION" ] && tr -d '[:space:]' < "$LOREKIT_ROOT/VERSION" || printf '0.1.0'; }

lk_find_corpus() {
  local d="${1:-$PWD}"
  while [ "$d" != "/" ] && [ -n "$d" ]; do
    if [ -d "$d/.wiki" ] || [ -f "$d/CLAUDE.md" ]; then echo "$d"; return 0; fi
    d=$(dirname "$d")
  done; return 1
}
lk_require_corpus() { lk_find_corpus || { lk_err "not inside a corpus (no .wiki/ or CLAUDE.md)"; exit 1; }; }

# extract frontmatter field: lk_fm_field <file> <key>
lk_fm_field() {
  awk -v k="$2" 'NR==1 && $0!="---" {exit} NR==1 {inside=1; next}
    inside && /^---[[:space:]]*$/ {exit}
    inside && match($0,"^"k"[[:space:]]*:[[:space:]]*") {
      v=substr($0,RLENGTH+1); gsub(/^["\x27]|["\x27][[:space:]]*$/,"",v); print v; exit
    }' "$1"
}
lk_has_fm() { [ -f "$1" ] && [ "$(head -1 "$1" 2>/dev/null)" = "---" ]; }
