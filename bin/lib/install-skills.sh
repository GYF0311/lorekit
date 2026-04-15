#!/usr/bin/env bash
set -euo pipefail

cmd_install_skills() {
  local target="" list=0 uninstall=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --target) target="$2"; shift ;;
      --list) list=1 ;; --uninstall) uninstall=1 ;;
      -h|--help) echo "Usage: wiki install-skills --target claude-code [--uninstall] | --list"; return 0 ;;
    esac; shift
  done
  local sk="$HOME/.claude/skills"
  if [ "$list" = "1" ]; then
    [ -d "$sk" ] || return 0
    find "$sk" -maxdepth 1 -type l -name 'wiki-*' 2>/dev/null | while IFS= read -r l; do
      printf '%s -> %s\n' "$(basename "$l")" "$(readlink "$l")"
    done; return 0
  fi
  [ -z "$target" ] && { lk_err "install-skills: --target required"; return 2; }
  [ "$target" = "claude-code" ] || { lk_err "target '$target' not supported in MVP"; return 2; }
  mkdir -p "$sk"
  local corpus installed="[]"; corpus=$(lk_find_corpus 2>/dev/null || true)
  for s in "$LOREKIT_ROOT"/skills/wiki-*/SKILL.md; do
    [ -f "$s" ] || continue
    local name tgt; name=$(basename "$(dirname "$s")"); tgt="$sk/$name"
    if [ "$uninstall" = "1" ]; then
      [ -L "$tgt" ] && rm -f "$tgt" && lk_ok "removed $name"
    else
      rm -f "$tgt"; ln -s "$(dirname "$s")" "$tgt"; lk_ok "linked $name"
      installed=$(jq -c --arg n "$name" '. + [$n]' <<< "$installed")
    fi
  done
  if [ -n "$corpus" ] && [ -d "$corpus/.wiki" ]; then
    jq -n --arg t "$target" --argjson i "$installed" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{harnesses:{($t):{installed_at:$ts,skills:$i}}}' > "$corpus/.wiki/installed-harnesses.json"
  fi
  [ "$uninstall" = "0" ] && echo "Restart Claude Code to load the new skills." >&2
}
