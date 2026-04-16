#!/usr/bin/env bash
set -euo pipefail

cmd_doctor() {
  [ "${1:-}" = "--help" ] && { echo "Usage: wiki doctor"; return 0; }
  local root rc=0 missing=0 total=0 ok=0
  if ! root=$(lk_find_corpus); then lk_bad "cwd not inside a corpus"; return 1; fi
  lk_ok "corpus root: $root"
  for d in 每日 知识库/实体 知识库/概念 知识库/专题 原料 原料/录音 写作 系统 _工作台; do
    [ -d "$root/$d" ] && lk_ok "dir $d" || { lk_bad "missing dir $d"; missing=$((missing+1)); }
  done
  [ $missing -gt 0 ] && rc=1
  [ -f "$root/.wiki/version" ] && lk_ok ".wiki/version = $(cat "$root/.wiki/version")" || lk_bad ".wiki/version missing"
  while IFS= read -r f; do
    [ -z "$f" ] && continue; total=$((total+1)); lk_has_fm "$f" && ok=$((ok+1))
  done < <(find "$root" -type f -name '*.md' -not -path '*/_归档/*' 2>/dev/null | head -20)
  if [ $total -gt 0 ]; then
    local pct=$(( ok * 100 / total ))
    [ $pct -ge 60 ] && lk_ok "frontmatter coverage: $ok/$total ($pct%)" || lk_bad "frontmatter coverage low: $ok/$total ($pct%)"
  else lk_warn "no markdown files to sample"; fi
  return $rc
}
