#!/usr/bin/env bash
set -euo pipefail

cmd_snapshot() {
  local tag=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --tag)  shift; tag="${1:-}"; [ -z "$tag" ] && { lk_err "--tag requires a value"; return 1; } ;;
      -h|--help) echo "Usage: wiki snapshot [--tag NAME]"; return 0 ;;
      *) lk_err "unknown arg: $1 (try: wiki snapshot --help)"; return 1 ;;
    esac; shift
  done

  local root
  root=$(lk_require_corpus)

  local snap_dir="$root/.wiki/snapshots"
  mkdir -p "$snap_dir"

  local ts
  ts=$(date '+%Y%m%d-%H%M%S')
  local name="$ts"
  [ -n "$tag" ] && name="${ts}-${tag}"
  local archive="$snap_dir/${name}.tar.gz"

  # collect files (relative to corpus root), excluding .wiki/ .DS_Store .git/
  local tmp_list
  tmp_list=$(mktemp)
  (cd "$root" && find . -type f \
    ! -path './.wiki/*' \
    ! -path './.git/*' \
    ! -name '.DS_Store' \
  ) | sed 's|^\./||' | LC_ALL=C sort > "$tmp_list"

  local file_count
  file_count=$(wc -l < "$tmp_list" | tr -d ' ')
  if [ "$file_count" -eq 0 ]; then
    lk_warn "no files to snapshot"; command rm -- "$tmp_list"; return 0
  fi

  # build manifest.json
  local tmp_manifest
  tmp_manifest=$(mktemp)
  printf '[\n' > "$tmp_manifest"
  local first=1
  while IFS= read -r rel; do
    local full="$root/$rel"
    local sha size mtime
    sha=$(shasum -a 256 "$full" | cut -d' ' -f1)
    size=$(wc -c < "$full" | tr -d ' ')
    mtime=$(stat -f '%m' "$full" 2>/dev/null || stat -c '%Y' "$full" 2>/dev/null || echo 0)
    [ "$first" = "1" ] && first=0 || printf ',\n' >> "$tmp_manifest"
    printf '  {"path":"%s","sha256":"%s","bytes":%s,"mtime":%s}' \
      "$rel" "$sha" "$size" "$mtime" >> "$tmp_manifest"
  done < "$tmp_list"
  printf '\n]\n' >> "$tmp_manifest"

  # copy manifest into corpus temporarily so tar picks it up
  cp "$tmp_manifest" "$root/.wiki-snapshot-manifest.json"
  echo ".wiki-snapshot-manifest.json" >> "$tmp_list"

  # create tar.gz
  (cd "$root" && tar czf "$archive" -T "$tmp_list")

  # clean up temp files
  command rm -- "$root/.wiki-snapshot-manifest.json"
  command rm -- "$tmp_list" "$tmp_manifest"

  local size_mb
  size_mb=$(awk "BEGIN { printf \"%.1f\", $(wc -c < "$archive" | tr -d ' ') / 1048576 }")

  lk_ok "snapshot saved: .wiki/snapshots/${name}.tar.gz ($file_count files, ${size_mb} MB)"
}
