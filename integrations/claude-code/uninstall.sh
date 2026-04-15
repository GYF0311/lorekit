#!/usr/bin/env bash
# Remove lorekit skill symlinks from ~/.claude/skills/
set -euo pipefail

LOREKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILLS_SRC="$LOREKIT_ROOT/skills"
SKILLS_DST="$HOME/.claude/skills"

removed=0
for skill_dir in "$SKILLS_SRC"/wiki-*/; do
  name="$(basename "$skill_dir")"
  target="$SKILLS_DST/$name"
  if [ -L "$target" ]; then
    rm "$target"
    echo "  ✗ removed $name"
    removed=$((removed + 1))
  fi
done

# Clear corpus record
_find_corpus() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    [ -d "$d/.wiki" ] && { echo "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}
if corpus="$(_find_corpus)"; then
  rm -f "$corpus/.wiki/installed-harnesses.json"
fi

echo "[lorekit] removed $removed skills."
