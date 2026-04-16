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
    mkdir -p "$path"/{原料,知识库/概念,知识库/实体,知识库/摘要,每日,系统,.wiki}
  elif [ "$in_place" = "1" ]; then
    mkdir -p "$path"
    (cd "$tpl" && find . -type f) | while IFS= read -r f; do
      local dst="$path/${f#./}"; mkdir -p "$(dirname "$dst")"
      [ -e "$dst" ] || cp "$tpl/${f#./}" "$dst"
    done
  else
    if [ -e "$path" ] && [ "$(ls -A "$path" 2>/dev/null || true)" ]; then
      local file_count
      file_count=$(find "$path" -type f 2>/dev/null | wc -l | tr -d ' ')
      if [ -t 0 ]; then
        printf '\n%s⚠️  检测到 %s 已有内容（%s 个文件）%s\n\n' "$C_Y" "$path" "$file_count" "$C_0" >&2
        printf '请选择：\n' >&2
        printf '  [1] 备份后初始化（推荐）\n' >&2
        printf '      → 先运行 wiki snapshot，然后初始化\n' >&2
        printf '  [2] 就地初始化（--in-place）\n' >&2
        printf '      → 保留已有文件，只补充缺失的目录和配置\n' >&2
        printf '  [3] 取消\n\n' >&2
        local choice=""
        read -p "> " choice
        case "$choice" in
          1)
            source "$LIB/snapshot.sh"
            cmd_snapshot
            # continue with in-place logic after snapshot
            mkdir -p "$path"
            (cd "$tpl" && find . -type f) | while IFS= read -r f; do
              local dst="$path/${f#./}"; mkdir -p "$(dirname "$dst")"
              [ -e "$dst" ] || cp "$tpl/${f#./}" "$dst"
            done
            ;;
          2)
            mkdir -p "$path"
            (cd "$tpl" && find . -type f) | while IFS= read -r f; do
              local dst="$path/${f#./}"; mkdir -p "$(dirname "$dst")"
              [ -e "$dst" ] || cp "$tpl/${f#./}" "$dst"
            done
            ;;
          3|"")
            lk_ok "已取消"; exit 0 ;;
          *)
            lk_err "无效选项: $choice"; exit 1 ;;
        esac
      else
        # non-interactive: default to cancel to avoid hanging
        lk_err "$path exists and is non-empty (non-interactive mode, use --in-place)"; exit 1
      fi
    else
      mkdir -p "$path" && cp -R "$tpl"/. "$path"/
    fi
  fi
  mkdir -p "$path/.wiki"
  printf '%s\n' "$(lk_version)" > "$path/.wiki/version"
  [ -f "$path/.wiki/config.yaml" ] || printf 'lorekit: 0.1.0\n' > "$path/.wiki/config.yaml"

  # deploy obsidian audit plugin
  local plugin_src="$LOREKIT_ROOT/plugins/obsidian-audit"
  if [ -d "$plugin_src" ]; then
    local plugin_dst="$path/.obsidian/plugins/lorekit-audit"
    mkdir -p "$plugin_dst"
    cp "$plugin_src/main.js"       "$plugin_dst/main.js"
    cp "$plugin_src/manifest.json" "$plugin_dst/manifest.json"
    cp "$plugin_src/styles.css"    "$plugin_dst/styles.css"
    lk_ok "obsidian plugin installed: lorekit-audit"
  fi

  lk_ok "corpus ready at $path"
}
