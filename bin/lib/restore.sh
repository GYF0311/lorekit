#!/usr/bin/env bash
set -euo pipefail

cmd_restore() {
  local from="" dry_run=0 single_file=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --from)    shift; from="${1:-}"; [ -z "$from" ] && { lk_err "--from requires a path"; return 1; } ;;
      --dry-run) dry_run=1 ;;
      --file)    shift; single_file="${1:-}"; [ -z "$single_file" ] && { lk_err "--file requires a path"; return 1; } ;;
      -h|--help) cat <<EOF
Usage: wiki restore --from <snapshot.tar.gz> [--dry-run] [--file <path>]

  --from <path>   Snapshot archive to restore from (required)
  --dry-run       List differences without restoring
  --file <path>   Restore only this file (relative to corpus root)
EOF
        return 0 ;;
      *) lk_err "unknown arg: $1 (try: wiki restore --help)"; return 1 ;;
    esac; shift
  done

  [ -z "$from" ] && { lk_err "--from is required"; return 1; }
  [ -f "$from" ] || { lk_err "snapshot not found: $from"; return 1; }

  local root
  root=$(lk_require_corpus)

  # extract to temp dir
  local tmp_dir
  tmp_dir=$(mktemp -d)
  tar xzf "$from" -C "$tmp_dir"

  # read manifest
  local manifest="$tmp_dir/.wiki-snapshot-manifest.json"
  if [ ! -f "$manifest" ]; then
    lk_err "manifest not found in snapshot (not a valid lorekit snapshot?)"
    command rm -r -- "$tmp_dir"
    return 1
  fi

  # parse manifest and find differences
  local missing=() changed=()
  # simple line-by-line parse: extract path and sha256 from each JSON entry
  while IFS= read -r line; do
    local rel sha_snap
    rel=$(printf '%s' "$line" | sed -n 's/.*"path":"\([^"]*\)".*/\1/p')
    sha_snap=$(printf '%s' "$line" | sed -n 's/.*"sha256":"\([^"]*\)".*/\1/p')
    [ -z "$rel" ] && continue
    [ "$rel" = ".wiki-snapshot-manifest.json" ] && continue

    # if --file given, skip everything else
    if [ -n "$single_file" ] && [ "$rel" != "$single_file" ]; then continue; fi

    local full="$root/$rel"
    if [ ! -f "$full" ]; then
      missing+=("$rel")
    else
      local sha_cur
      sha_cur=$(shasum -a 256 "$full" | cut -d' ' -f1)
      if [ "$sha_cur" != "$sha_snap" ]; then
        changed+=("$rel")
      fi
    fi
  done < "$manifest"

  local total=$(( ${#missing[@]} + ${#changed[@]} ))

  if [ "$total" -eq 0 ]; then
    lk_ok "no differences — corpus matches snapshot"
    command rm -r -- "$tmp_dir"
    return 0
  fi

  # show diff table
  printf '\n%-10s %s\n' "STATUS" "FILE"
  printf '%-10s %s\n' "------" "----"
  for f in "${missing[@]+"${missing[@]}"}"; do
    printf '%-10s %s\n' "MISSING" "$f"
  done
  for f in "${changed[@]+"${changed[@]}"}"; do
    printf '%-10s %s\n' "CHANGED" "$f"
  done
  printf '\nTotal: %d file(s) to restore\n\n' "$total"

  if [ "$dry_run" = "1" ]; then
    lk_ok "dry-run complete (no files restored)"
    command rm -r -- "$tmp_dir"
    return 0
  fi

  # ask for confirmation
  printf 'Restore these %d file(s)? [y/N] ' "$total"
  read -r confirm
  case "$confirm" in
    y|Y|yes|YES) ;;
    *) lk_warn "aborted"; command rm -r -- "$tmp_dir"; return 0 ;;
  esac

  # restore files
  local restored=0
  for f in "${missing[@]+"${missing[@]}"}" "${changed[@]+"${changed[@]}"}"; do
    [ -z "$f" ] && continue
    local src="$tmp_dir/$f" dst="$root/$f"
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    restored=$((restored + 1))
  done

  # clean up
  command rm -r -- "$tmp_dir"
  lk_ok "restored $restored file(s)"
}
