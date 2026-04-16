# Claude Code Integration

Softlinks lorekit's fat skills into `~/.claude/skills/` so Claude Code auto-discovers them.

## Install

```bash
# Preferred (via wiki CLI):
lorekit install-skills --target claude-code

# Or directly:
./integrations/claude-code/install.sh
```

Both do the same thing:

1. Ensure `~/.claude/skills/` exists
2. Create symlinks for each `skills/wiki-*/` to `~/.claude/skills/<name>/`
3. Record installation into the nearest corpus's `.wiki/installed-harnesses.json`
4. Remind you to restart Claude Code

## What gets installed

| skill | trigger |
|---|---|
| `wiki-ingest` | external content (URL / file / paste) |
| `wiki-query` | search / recall from corpus |
| `wiki-fileback` | write conversation insights back |
| `wiki-lint` | deep health scan |
| `wiki-enrich` | periodic daily-session extraction |

Because we symlink (not copy), editing a skill in `~/code/lorekit/skills/...` takes effect in the next Claude Code session — no re-install.

## Uninstall

```bash
./integrations/claude-code/uninstall.sh
```

## Why symlink, not copy?

lorekit is young. Skills will evolve. Symlinks mean you `git pull` and the new skill version is live on next restart.

When lorekit hits v1.0 and skills stabilize, we may switch to copy-on-install with a `--dev` flag for contributors.
