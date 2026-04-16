#!/usr/bin/env bash
set -euo pipefail

cmd_vector() {
    local corpus subcmd
    corpus="$(lk_find_corpus)" || { lk_err "not inside a corpus"; exit 1; }
    subcmd="${1:-status}"; shift || true

    local script="$LOREKIT_ROOT/bin/vectors/vector_engine.py"

    case "$subcmd" in
        sync)   uv run --script "$script" sync --corpus "$corpus" "$@" ;;
        query)  uv run --script "$script" query --corpus "$corpus" "$@" ;;
        status) uv run --script "$script" status --corpus "$corpus" "$@" ;;
        -h|--help|help) cat <<EOF
Usage: wiki vector <subcommand> [args]

Subcommands:
  sync   [--force]                  Embed corpus into vector DB
  query  --text "..." [--top-k N] [--threshold F]  Semantic search
  status                            Show index status
EOF
            ;;
        *) lk_err "unknown vector subcommand: $subcmd"; exit 2 ;;
    esac
}
