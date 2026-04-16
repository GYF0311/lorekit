#!/usr/bin/env bash
set -euo pipefail

_emit() { jq -n -c --arg f "$1" --arg i "$2" --arg s "$3" '{file:$f,issue:$i,suggestion:$s}'; }

cmd_lint() {
  local quick=0 docs=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --quick) quick=1 ;; --docs) docs=1 ;;
      -h|--help) echo "Usage: wiki lint [--quick] [--docs]"; return 0 ;;
    esac; shift
  done
  local root; root=$(lk_require_corpus)
  local scan="$root"; [ "$docs" = "1" ] && scan="$root/docs"
  [ -d "$scan" ] || { lk_err "scan dir missing: $scan"; return 1; }
  local names="/tmp/.lkn.$$"
  find "$scan" -type f -name '*.md' -not -path '*/_归档/*' -not -path '*/.wiki/*' \
    -exec basename {} .md \; 2>/dev/null | sort -u > "$names"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if ! lk_has_fm "$f"; then
      _emit "$f" "missing-frontmatter" "add --- block with type/title/slug/created/updated"
    else
      for k in type title slug created updated; do
        [ -z "$(lk_fm_field "$f" "$k" || true)" ] && _emit "$f" "missing-fm-field:$k" "add $k to frontmatter"
      done
    fi
    grep -oE '\[\[[^]]+\]\]' "$f" 2>/dev/null | sed 's/^\[\[//;s/\]\]$//;s/|.*//;s/#.*//' | while IFS= read -r lnk; do
      [ -n "$lnk" ] && ! grep -Fxq -- "$lnk" "$names" && _emit "$f" "broken-link:$lnk" "target page not found"
    done
    if [ "$quick" = "0" ]; then
      local base; base=$(basename "$f" .md)
      rg -q "\[\[$base" "$scan" 2>/dev/null && continue
      grep -qE '\[\[[^]]+\]\]' "$f" 2>/dev/null && continue
      _emit "$f" "orphan" "no inbound or outbound wikilinks"
    fi
  done < <(find "$scan" -type f -name '*.md' -not -path '*/_归档/*' -not -path '*/.wiki/*' 2>/dev/null)
  # TODO: _工作台 expiry scan (7/14/30/3 days) deferred
  rm -f "$names"
}
