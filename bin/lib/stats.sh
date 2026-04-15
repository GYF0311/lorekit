#!/usr/bin/env bash
set -euo pipefail

cmd_stats() {
  local since="" ftype=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --since) since="$2"; shift ;;
      --type)  ftype="$2"; shift ;;
      -h|--help) echo "Usage: wiki stats [--since Nd] [--type T]"; return 0 ;;
    esac; shift
  done
  local root; root=$(lk_require_corpus)
  local cutoff=0 now; now=$(date +%s)
  [ -n "$since" ] && cutoff=$(( now - ${since%d}*86400 ))
  local total=0 recent=0 orphans=0 last=0 tf="/tmp/.lkt.$$" df="/tmp/.lkd.$$"
  : > "$tf"; : > "$df"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    local t mtime; t=$(lk_fm_field "$f" type 2>/dev/null || true)
    [ -n "$ftype" ] && [ "$t" != "$ftype" ] && continue
    mtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo 0)
    [ "$cutoff" -gt 0 ] && [ "$mtime" -lt "$cutoff" ] && continue
    total=$((total+1)); [ "$mtime" -gt "$last" ] && last=$mtime
    [ $(( now - mtime )) -lt 604800 ] && recent=$((recent+1))
    [ -z "$t" ] && t="_untyped"
    local rel="${f#$root/}"
    rg -q "\[\[$(basename "$f" .md)" "$root" 2>/dev/null || orphans=$((orphans+1))
    printf '%s\n' "$t" >> "$tf"; printf '%s\n' "${rel%%/*}" >> "$df"
  done < <(find "$root" -type f -name '*.md' -not -path '*/_archive/*' -not -path '*/.wiki/*' 2>/dev/null)
  local bt bd; bt=$(sort "$tf"|uniq -c|awk '{printf "{\"%s\":%s}\n",$2,$1}'|jq -s 'add // {}')
  bd=$(sort "$df"|uniq -c|awk '{printf "{\"%s\":%s}\n",$2,$1}'|jq -s 'add // {}')
  rm -f "$tf" "$df"
  local lu=""; [ "$last" -gt 0 ] && lu=$(date -u -r "$last" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$last" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
  jq -n --argjson t "$total" --argjson bt "$bt" --argjson bd "$bd" --argjson r "$recent" --argjson o "$orphans" --arg lu "$lu" \
    '{total_pages:$t,by_type:$bt,by_dir:$bd,recent_active_7d:$r,orphans:$o,last_updated:$lu}'
}
