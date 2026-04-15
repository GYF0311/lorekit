#!/usr/bin/env bash
set -euo pipefail

cmd_search() {
  local q="" ftype="" dir=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --type) ftype="$2"; shift ;;
      --dir)  dir="$2"; shift ;;
      -h|--help) echo "Usage: wiki search <query> [--type md] [--dir path]"; return 0 ;;
      *) [ -z "$q" ] && q="$1" ;;
    esac; shift
  done
  [ -z "$q" ] && { lk_err "search: query required"; return 2; }
  [ -z "$dir" ] && dir="$(lk_find_corpus 2>/dev/null || echo "$PWD")"
  local rg_args=(--no-heading --line-number --color never)
  [ -n "$ftype" ] && rg_args+=(-t "$ftype")
  rg_args+=(-- "$q" "$dir")
  rg "${rg_args[@]}" 2>/dev/null | while IFS= read -r line; do
    local file rest lineno text title
    file="${line%%:*}"; rest="${line#*:}"; lineno="${rest%%:*}"; text="${rest#*:}"
    title=$(lk_fm_field "$file" title 2>/dev/null || true)
    [ -z "$title" ] && title=$(grep -m1 '^# ' "$file" 2>/dev/null | sed 's/^# //')
    [ -z "$title" ] && title=$(basename "$file" .md)
    jq -n -c --arg f "$file" --argjson l "$lineno" --arg t "$text" --arg ti "$title" \
      '{file:$f,line:$l,text:$t,title:$ti}'
  done
  local ec=${PIPESTATUS[0]}; [ "$ec" = "1" ] && return 0; return "$ec"
}
