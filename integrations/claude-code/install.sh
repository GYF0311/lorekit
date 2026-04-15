#!/usr/bin/env bash
# lorekit → Claude Code skill installer
# Usage: ./install.sh
# Softlinks all lorekit skills to ~/.claude/skills/ and records installation
# into the nearest corpus's .wiki/installed-harnesses.json (if any).
set -euo pipefail

LOREKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILLS_SRC="$LOREKIT_ROOT/skills"
SKILLS_DST="$HOME/.claude/skills"
VERSION="$(cat "$LOREKIT_ROOT/VERSION" 2>/dev/null || echo 0.1.0)"

[ -d "$SKILLS_SRC" ] || { echo "[err] $SKILLS_SRC missing" >&2; exit 1; }
mkdir -p "$SKILLS_DST"

installed=()
for skill_dir in "$SKILLS_SRC"/wiki-*/; do
  [ -d "$skill_dir" ] || continue
  name="$(basename "$skill_dir")"
  target="$SKILLS_DST/$name"
  if [ -L "$target" ] || [ -e "$target" ]; then
    rm -rf "$target"
  fi
  ln -s "$skill_dir" "$target"
  installed+=("$name")
  echo "  ✓ $name"
done

# Record into corpus (if cwd is one)
_find_corpus() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    [ -d "$d/.wiki" ] && { echo "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}

if corpus="$(_find_corpus)"; then
  mkdir -p "$corpus/.wiki"
  cat > "$corpus/.wiki/installed-harnesses.json" <<EOF
{
  "claude-code": {
    "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "lorekit_version": "$VERSION",
    "installed_skills": [$(printf '"%s",' "${installed[@]}" | sed 's/,$//')]
  }
}
EOF
  echo "[lorekit] recorded in $corpus/.wiki/installed-harnesses.json"
fi

echo ""
echo "[lorekit] installed ${#installed[@]} skills to $SKILLS_DST"
echo "[lorekit] restart Claude Code to pick them up."
