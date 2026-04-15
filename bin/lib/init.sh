#!/usr/bin/env bash
set -euo pipefail

cmd_init() {
  local path="" in_place=0 minimal=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --in-place) in_place=1 ;;
      --minimal)  minimal=1 ;;
      -h|--help)  echo "Usage: wiki init [path] [--in-place] [--minimal]"; return 0 ;;
      *) path="$1" ;;
    esac; shift
  done
  [ -z "$path" ] && path="$PWD"
  local tpl="$LOREKIT_ROOT/templates/default-corpus"
  [ -d "$tpl" ] || { lk_err "template not found: $tpl"; exit 1; }
  if [ "$minimal" = "1" ]; then
    mkdir -p "$path"/{00_每日,10_人物,20_项目,30_概念,99_系统,.wiki}
  elif [ "$in_place" = "1" ]; then
    mkdir -p "$path"
    (cd "$tpl" && find . -type f) | while IFS= read -r f; do
      local dst="$path/${f#./}"; mkdir -p "$(dirname "$dst")"
      [ -e "$dst" ] || cp "$tpl/${f#./}" "$dst"
    done
  else
    [ -e "$path" ] && [ "$(ls -A "$path" 2>/dev/null || true)" ] && { lk_err "$path exists and is non-empty (use --in-place)"; exit 1; }
    mkdir -p "$path" && cp -R "$tpl"/. "$path"/
  fi
  mkdir -p "$path/.wiki"
  printf '%s\n' "$(lk_version)" > "$path/.wiki/version"
  [ -f "$path/.wiki/config.yaml" ] || printf 'lorekit: 0.1.0\n' > "$path/.wiki/config.yaml"
  lk_ok "corpus ready at $path"
}
