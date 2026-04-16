#!/usr/bin/env bash
# wiki fetch <url> — route URL to the right fetcher, write single-line JSON to stdout.
set -euo pipefail

cmd_fetch() {
  local url="" out_override="" force="" no_images=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -h|--help) cat <<'EOF'
Usage: wiki fetch <url> [--out DIR] [--force-rich] [--no-images]

Fetch a URL and write its content (and images, if any) to local disk.
Routes by URL host to the right fetcher. Emits a single JSON line on stdout.

  --out DIR      Override output parent dir. Default: <corpus>/_工作台/收件/fetch/
                 (or /tmp/lorekit-fetch/ if not inside a corpus).
  --force-rich   Skip host routing, always use fetch_rich.py.
  --no-images    Skip image download.
EOF
        return 0 ;;
      --out) out_override="$2"; shift 2 ;;
      --force-rich) force="rich"; shift ;;
      --no-images) no_images="1"; shift ;;
      -*) lk_err "unknown flag: $1"; return 2 ;;
      *) url="$1"; shift ;;
    esac
  done
  [ -n "$url" ] || { lk_err "wiki fetch: <url> required"; return 2; }

  # Decide output root
  local out_root corpus=""
  if [ -n "$out_override" ]; then
    out_root="$out_override"
  elif corpus="$(lk_find_corpus)"; then
    out_root="$corpus/_工作台/收件/fetch"
  else
    out_root="/tmp/lorekit-fetch"
  fi
  mkdir -p "$out_root"

  # Route by host
  local host route
  host=$(printf '%s' "$url" | awk -F/ '{print tolower($3)}')
  if [ -n "$force" ]; then
    route="rich"
  else
    case "$host" in
      mp.weixin.qq.com|*.mp.weixin.qq.com) route="rich" ;;
      *feishu.cn|*larkoffice.com)  _fetch_suggest "lark" "$url" "lark-cli docs +read --as user --doc $url"; return 0 ;;
      x.com|twitter.com|*.x.com|*.twitter.com) _fetch_suggest "x" "$url" "paste screenshot or text (antibot too strong)"; return 0 ;;
      github.com|gist.github.com) _fetch_suggest "github" "$url" "WebFetch or github-content-fetch skill"; return 0 ;;
      *) case "$url" in *.pdf|*.PDF) _fetch_suggest "pdf" "$url" "pdf skill"; return 0 ;; esac
         route="rich" ;;  # generic → fetch_rich works for most sites
    esac
  fi

  # Run fetch_rich.py
  local script="$LOREKIT_ROOT/bin/fetchers/fetch_rich.py"
  [ -x "$script" ] || { _fetch_err "rich" "$url" "fetch_rich.py missing at $script"; return 1; }
  local args=("$url" "--out" "$out_root")
  [ -n "$no_images" ] && args+=("--no-images")

  local tmp; tmp="$(mktemp)"
  if ! "$script" "${args[@]}" >"$tmp" 2>&1; then
    local last; last="$(tail -1 "$tmp" 2>/dev/null || echo ERROR)"
    case "$last" in
      ANTIBOT_BLOCKED) _fetch_err "rich" "$url" "ANTIBOT_BLOCKED" "qiaomu-markdown-proxy or user paste" ;;
      ERROR*)          _fetch_err "rich" "$url" "${last#ERROR }" ;;
      *)               _fetch_err "rich" "$url" "$last" ;;
    esac
    rm -f "$tmp"; return 1
  fi

  # Parse successful stdout (key: value lines + last line OK fetch-rich)
  local title author src images md images_dir
  title=$(awk -F': ' '/^title: /{$1="";sub(/^ /,"");print;exit}' "$tmp")
  author=$(awk -F': ' '/^author: /{$1="";sub(/^ /,"");print;exit}' "$tmp")
  src=$(awk -F': ' '/^source: /{print $2;exit}' "$tmp")
  images=$(awk -F': ' '/^images: /{print $2;exit}' "$tmp")
  md=$(awk -F': ' '/^markdown: /{print $2;exit}' "$tmp")
  images_dir=$(awk -F': ' '/^images_dir: /{print $2;exit}' "$tmp")
  rm -f "$tmp"

  local slug; slug="$(basename "$(dirname "$md")")"
  local ok fail
  ok=$(printf '%s' "$images" | awk '{print $1}')
  fail=$(printf '%s' "$images" | awk -F',' '{for(i=1;i<=NF;i++) if($i~/failed/){gsub(/[^0-9]/,"",$i); print $i; exit}}')
  : "${ok:=0}" "${fail:=0}"

  # Emit JSON (jq -n for safe escaping)
  jq -cn --arg status ok --arg route rich --arg url "$url" \
         --arg title "$title" --arg author "$author" --arg src "$src" \
         --arg slug "$slug" --arg dir "$(dirname "$md")" \
         --arg md "$md" --arg imgs "$images_dir" \
         --argjson ok "$ok" --argjson fail "$fail" \
    '{status:$status,route:$route,url:$url,title:$title,author:$author,
      source_layer:$src,slug:$slug,dir:$dir,markdown:$md,images_dir:$imgs,
      images_ok:$ok,images_failed:$fail}'
}

_fetch_suggest() {
  jq -cn --arg route "$1" --arg url "$2" --arg suggest "$3" \
    '{status:"unsupported",route:$route,url:$url,suggest:$suggest}'
}

_fetch_err() {
  jq -cn --arg route "$1" --arg url "$2" --arg reason "$3" --arg fb "${4:-}" \
    '{status:"error",route:$route,url:$url,reason:$reason} +
     (if $fb=="" then {} else {fallback:$fb} end)'
}
