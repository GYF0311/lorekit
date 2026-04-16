#!/usr/bin/env bash
set -euo pipefail

# wiki audit — human feedback loop for corpus content
#
# Usage:
#   wiki audit [--list] [--open] [--resolved]
#   wiki audit --create --target <file> --severity <low|medium|high> --text "..."

cmd_audit() {
  local root
  if ! root=$(lk_find_corpus); then lk_bad "cwd not inside a corpus"; return 1; fi

  local mode="list" filter="all"
  local target="" severity="" text=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --list)     mode="list" ;;
      --open)     filter="open" ;;
      --resolved) filter="resolved" ;;
      --create)   mode="create" ;;
      --target)   shift; target="${1:-}" ;;
      --severity) shift; severity="${1:-}" ;;
      --text)     shift; text="${1:-}" ;;
      --help|-h)  _audit_help; return 0 ;;
      *) lk_err "audit: unknown option: $1"; return 2 ;;
    esac
    shift
  done

  case "$mode" in
    list)   _audit_list "$root" "$filter" ;;
    create) _audit_create "$root" "$target" "$severity" "$text" ;;
  esac
}

_audit_help() {
  cat <<'EOF'
Usage: wiki audit [options]

List audit entries (default):
  --list          List entries (default action)
  --open          Only show open (待处理) entries
  --resolved      Only show resolved (已处理) entries

Create new audit entry:
  --create        Create a new audit entry
  --target FILE   Target file path (relative to corpus root)
  --severity LVL  Severity: low | medium | high
  --text "..."    Feedback text
EOF
}

_audit_list() {
  local root="$1" filter="$2"
  local dirs=()
  case "$filter" in
    open)     dirs=("$root/反馈/待处理") ;;
    resolved) dirs=("$root/反馈/已处理") ;;
    all)      dirs=("$root/反馈/待处理" "$root/反馈/已处理") ;;
  esac

  local count=0
  local -a entries=()

  for dir in "${dirs[@]}"; do
    [ -d "$dir" ] || continue
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      [ "$(basename "$f")" = ".gitkeep" ] && continue
      lk_has_fm "$f" || continue

      local s t tx dt
      s=$(lk_fm_field "$f" "severity")
      t=$(lk_fm_field "$f" "target")
      dt=$(lk_fm_field "$f" "created")
      st=$(lk_fm_field "$f" "status")
      # read first non-frontmatter, non-empty line as text preview
      tx=$(awk 'NR==1 && $0=="---" {inside=1; next}
        inside && /^---[[:space:]]*$/ {inside=0; next}
        inside {next}
        /^[[:space:]]*$/ {next}
        {print; exit}' "$f")

      local sev_order=0
      case "$s" in
        high)   sev_order=3 ;;
        medium) sev_order=2 ;;
        low)    sev_order=1 ;;
      esac

      entries+=("${sev_order}|[$s] $t — $tx ($dt) [${st}]")
      count=$((count+1))
    done < <(find "$dir" -type f -name '*.md' 2>/dev/null)
  done

  if [ $count -eq 0 ]; then
    echo "No audit entries found."
    return 0
  fi

  # sort by severity descending
  printf '%s\n' "${entries[@]}" | sort -t'|' -k1 -rn | cut -d'|' -f2-
  echo ""
  echo "Total: $count entries"
}

_audit_create() {
  local root="$1" target="$2" severity="$3" text="$4"

  if [ -z "$target" ]; then lk_err "audit --create requires --target"; return 2; fi
  if [ -z "$severity" ]; then lk_err "audit --create requires --severity"; return 2; fi
  if [ -z "$text" ]; then lk_err "audit --create requires --text"; return 2; fi

  case "$severity" in
    low|medium|high) ;;
    *) lk_err "severity must be low|medium|high, got: $severity"; return 2 ;;
  esac

  # generate slug from target filename
  local slug
  slug=$(basename "$target" .md | tr ' /' '-' | tr '[:upper:]' '[:lower:]')

  local ts_file ts_fm
  ts_file=$(date '+%Y%m%d-%H%M%S')
  ts_fm=$(date '+%Y-%m-%d %H:%M')

  local filename="${ts_file}-${slug}.md"
  local dest_dir="$root/反馈/待处理"
  local dest="$dest_dir/$filename"

  mkdir -p "$dest_dir"

  cat > "$dest" <<EOF
---
type: audit
target: $target
severity: $severity
status: open
created: $ts_fm
---

$text
EOF

  lk_ok "created: 反馈/待处理/$filename"
  echo "  target:   $target"
  echo "  severity: $severity"
}
