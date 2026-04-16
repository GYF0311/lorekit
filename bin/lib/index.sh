#!/usr/bin/env bash
set -euo pipefail

# Directories that should have _INDEX.md
_INDEX_DIRS=(
  "知识库/概念"
  "知识库/实体"
  "知识库/摘要"
  "知识库/专题"
  "每日"
  "写作"
  "原料/文章"
  "原料/书籍"
  "原料/会议"
  "原料/录音"
  "原料/剪藏"
)

# Directories that should NOT get _INDEX.md
_INDEX_SKIP_PATTERN='_工作台|_归档|反馈|系统|\.wiki'

# Extract first sentence from Compiled Truth section (up to first period or 50 chars)
_extract_summary() {
  local file="$1"
  local text
  text=$(awk '
    /^## Compiled Truth/ { found=1; next }
    found && /^---[[:space:]]*$/ { exit }
    found && /^## / { exit }
    found && /^[[:space:]]*$/ { next }
    found { print; exit }
  ' "$file" 2>/dev/null)
  if [ -z "$text" ]; then
    echo ""
    return
  fi
  # Strip leading markup (bold, links, etc.)
  text=$(printf '%s' "$text" | sed 's/^\*\*[^*]*\*\*[[:space:]]*//')
  # Take up to first period or 50 chars
  local before_period
  before_period=$(printf '%s' "$text" | sed 's/\([^。.]*[。.]\).*/\1/')
  if [ ${#before_period} -le 50 ] && [ -n "$before_period" ] && [ "$before_period" != "$text" ]; then
    printf '%s' "$before_period"
  else
    printf '%s' "${text:0:50}"
  fi
}

# Build _INDEX.md for a single directory
_build_index() {
  local dir="$1"
  local root="$2"
  local reldir="${dir#$root/}"
  local dirname
  dirname=$(basename "$dir")
  local index_file="$dir/_INDEX.md"

  # Collect .md files (exclude _INDEX.md, dotfiles, .gitkeep)
  local files=()
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    local bn
    bn=$(basename "$f")
    [ "$bn" = "_INDEX.md" ] && continue
    [ "$bn" = ".gitkeep" ] && continue
    [[ "$bn" == .* ]] && continue
    files+=("$f")
  done < <(find "$dir" -maxdepth 1 -type f -name '*.md' 2>/dev/null)

  if [ ${#files[@]} -eq 0 ]; then
    return 0
  fi

  # Build entries: title|summary|updated|sortkey
  local entries=()
  for f in "${files[@]}"; do
    local title="" updated="" summary=""
    if lk_has_fm "$f"; then
      title=$(lk_fm_field "$f" "title")
      updated=$(lk_fm_field "$f" "updated")
      summary=$(_extract_summary "$f")
      [ -z "$summary" ] && summary="—"
    else
      summary="（缺少 frontmatter）"
    fi
    [ -z "$title" ] && title=$(basename "$f" .md)
    [ -z "$updated" ] && updated=$(stat -f '%Sm' -t '%Y-%m-%d' "$f" 2>/dev/null || date -r "$f" '+%Y-%m-%d' 2>/dev/null || echo "unknown")
    entries+=("$title|$summary|$updated")
  done

  # Sort by updated descending
  local sorted
  sorted=$(printf '%s\n' "${entries[@]}" | sort -t'|' -k3 -r)

  local count=${#entries[@]}
  {
    printf '# %s\n\n' "$dirname"
    printf '> 本目录共 %d 个条目。由 `wiki index` 自动生成，请勿手动编辑。\n\n' "$count"
    printf '| 条目 | 摘要 | 更新 |\n'
    printf '|---|---|---|\n'
    while IFS='|' read -r t s u; do
      [ -z "$t" ] && continue
      printf '| [[%s]] | %s | %s |\n' "$t" "$s" "$u"
    done <<< "$sorted"
  } > "$index_file"

  lk_ok "$reldir/_INDEX.md ($count entries)"
}

cmd_index() {
  local target_dir=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --dir) target_dir="${2:-}"; [ -z "$target_dir" ] && { lk_err "--dir requires a value"; return 1; }; shift ;;
      -h|--help) echo "Usage: wiki index [--dir <subdir>]"; return 0 ;;
      *) lk_err "unknown option: $1"; return 1 ;;
    esac; shift
  done

  local root
  root=$(lk_require_corpus)

  if [ -n "$target_dir" ]; then
    local full="$root/$target_dir"
    if [ ! -d "$full" ]; then
      lk_err "directory not found: $target_dir"
      return 1
    fi
    _build_index "$full" "$root"
  else
    local generated=0
    for d in "${_INDEX_DIRS[@]}"; do
      local full="$root/$d"
      [ -d "$full" ] || continue
      _build_index "$full" "$root"
      generated=$((generated + 1))
    done
    if [ $generated -eq 0 ]; then
      lk_warn "no indexable directories found"
    fi
  fi
}
