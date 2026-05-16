# lorekit QUICKSTART

30 minutes from zero to an AI coding agent backed by your own LLM Wiki.

Default setup is lorekit-only: global `lorekit` CLI plus global lorekit skills where the agent supports them. Project-local isolation and GBrain are optional routes; see [`INSTALLATION.md`](INSTALLATION.md).

---

## 0. What lorekit is

lorekit is a personal knowledge-base toolkit based on [Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The core idea: skip RAG, let the LLM incrementally compile and maintain a persistent wiki — raw sources come in, the LLM compiles them into structured, cross-linked pages, and the knowledge is compiled once and continuously updated.

Pure TypeScript, Node.js-only, usable from any AI coding agent (Claude Code / Codex / Cursor / Kimi CLI / Aider / Windsurf).

---

## 1. Prerequisites

### Required

| Tool         | Purpose        | Install             | Verify           |
| ------------ | -------------- | ------------------- | ---------------- |
| Node.js ≥ 18 | JS runtime     | `brew install node` | `node --version` |
| git          | Clone the repo | ships with the OS   | `git --version`  |

### Optional (recommended)

| Tool         | Purpose                    | Install                                                                                    | Verify             |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| ripgrep      | Faster text search         | `brew install ripgrep`                                                                     | `rg --version`     |
| ollama       | Local vector embeddings    | `brew install ollama`                                                                      | `ollama --version` |
| bge-m3       | Embedding model (EN+ZH)    | `ollama pull bge-m3`                                                                       | `ollama list`      |
| Bun + GBrain | Optional graph retrieval   | `git clone https://github.com/garrytan/gbrain.git && cd gbrain && bun install && bun link` | `gbrain --version` |
| Claude Code  | Best end-to-end experience | [download](https://claude.com/claude-code)                                                 | `claude --version` |
| Obsidian     | Visual wiki browsing       | [download](https://obsidian.md)                                                            | —                  |

**No bash / Python / uv / pip needed.** lorekit is a pure Node.js project and runs on macOS / Linux / Windows.

---

## 2. Install lorekit

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit
npm install
npm run build
npm link
```

`npm link` puts the `lorekit` command on your global PATH. Verify:

```bash
lorekit --version
# → 0.4.0

lorekit
# → prints the blue ASCII banner (no-arg invocation shows status)
```

---

## 3. Initialize a corpus

```bash
lorekit init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus
```

If the target directory already has content, lorekit prompts:

```
⚠️  Detected 352 existing files in ~/Desktop/my-corpus

Choose:
  [1] Snapshot then init (recommended) — runs lorekit snapshot first
  [2] Init in place                   — keep existing files
  [3] Cancel
```

After init you have the full corpus skeleton (see README for layout).

---

## 4. Install the AI agent skills

### Global skills, default

Claude Code:

```bash
lorekit install-skills --target claude-code
# → symlinks the wiki-* skills into ~/.claude/skills/
```

Restart Claude Code to pick global skills up. Codex can load Markdown skills from `$CODEX_HOME/skills` (default `~/.codex/skills`); other agents should point their skill / rule system at `~/code/lorekit/skills/`.

### Project-local skills, optional isolation

If you want one corpus to carry isolated rules and avoid exposing wiki behavior to other coding projects, put the `wiki-*` skills inside the corpus:

```text
~/Desktop/my-corpus/skills/
```

Then keep only a short route table in `AGENTS.md` / `CLAUDE.md`. In Codex, these project-local skills usually do not appear in the `/` skill preview; Codex reads `AGENTS.md` first and loads `skills/<name>/SKILL.md` on demand.

---

## 5. Enable vector + FTS5 retrieval (optional)

```bash
ollama serve          # if not already running
ollama pull bge-m3    # 1.2 GB, one time

cd ~/Desktop/my-corpus
lorekit sync          # one-shot: index → vector sync --layered → doctor
```

`lorekit sync` is the standard entry point after any ingest/fileback. It:

1. Recursively refreshes every `_INDEX.md` (via `lorekit index`)
2. Incrementally re-embeds only changed files into `sqlite-vec` + FTS5
3. Runs `doctor` as a non-blocking sanity check

Query modes (pick based on intent, not scale — the skill reads `lorekit vector status`'s `mode` field and routes automatically):

```bash
lorekit vector query --hybrid  --text "…"   # BM25 + vector + RRF (production default)
lorekit vector query --layered --text "…"   # vector-only layered (debug)
lorekit vector query --bm25    --text "…"   # FTS5-only BM25 (debug precise terms / dates)

lorekit sync --json                         # machine-readable step report
lorekit sync --report                       # writes .wiki/reports/sync/<timestamp>.json
```

---

## 6. Optional: export to GBrain

GBrain is optional. lorekit alone already handles the base knowledge workflow. Add GBrain only when you want a graph / agent-memory retrieval layer next to lorekit's Markdown wiki. lorekit remains the source of truth; GBrain reads a staging copy.

If you choose project-local isolation, keep GBrain project-local to the corpus through wrappers such as `./bin/lorekit` and `./bin/gbrain`. Do not install GBrain's full native mutating skill set as a corpus default.

```bash
cd ~/Desktop/my-corpus
lorekit gbrain status
lorekit gbrain export --dry-run
lorekit gbrain export
lorekit gbrain sync --dry-run
lorekit gbrain sync
lorekit gbrain doctor
lorekit gbrain query "..."
```

`export` writes only under `.wiki/integrations/gbrain-export/` by default. Custom `--out` paths must stay under `.wiki/integrations/`; pass `--allow-outside-corpus` only for an intentional unsafe target. It skips generated indexes and templates, removes frontmatter `slug`, and records source hashes in `manifest.json`. `sync` checks the external binary before writing staging, calls external `gbrain import`, and writes `.wiki/integrations/gbrain/sync-report.json`. `query` checks corpus/export/sync freshness before calling GBrain; stale state prints `GBrain index may be stale. Run lorekit gbrain sync.` but does not block the query.

When GBrain finds candidates, the final answer should still read canonical pages under `知识库/`. New knowledge is written back through `wiki-fileback` / `wiki-ingest`, not direct GBrain mutating commands.

---

## 7. What Success Looks Like

You are ready for real use once the same corpus can complete this loop:

```bash
lorekit init ~/Desktop/my-corpus
lorekit fetch <url>
# AI ingest compiles the fetched source into 知识库/
lorekit sync --json
lorekit snapshot
```

Optional GBrain is healthy enough when `lorekit gbrain export --dry-run` shows the expected pages and `lorekit doctor` reports hard checks passing. Missing GBrain itself is only an optional warning.

---

## 8. First conversation

```bash
cd ~/Desktop/my-corpus
claude  # or codex / cursor / kimi …
```

**Ingest an article:**

> Ingest this article: https://mp.weixin.qq.com/s/xxx

The agent triggers `wiki-ingest`: fetch → archive under `原料/文章/` → compile into `知识库/` → update `index.md` + `log.md`.

**Query:**

> What's the difference between RAG and an LLM wiki?

Triggers `wiki-query`: read `lorekit vector status` → if `mode: text` walk `index.md` → `_INDEX.md` → specific files; if `mode: vector` run `lorekit vector query --hybrid`. Synthesize answer with citations.

**File back an insight:**

> Save that analysis into the knowledge base.

**Lint:**

> Check the corpus health.

**Backup:**

> Back up the corpus.

**Remove an outdated source:**

> Delete this article from the knowledge base.

The agent triggers `wiki-remove`. It must first run a dry-run:

```bash
lorekit remove "知识库/摘要/<slug>.md"
```

Review the impact report. If it looks right, apply:

```bash
lorekit remove "知识库/摘要/<slug>.md" --apply
```

`remove` creates a snapshot, moves the selected files to OS Trash / Recycle Bin, cleans only provenance-linked references, refreshes indexes, prunes stale vector records, and runs lint. It does **not** delete other pages just because they share the same topic keyword.

---

## 8. Ingest pipeline cheat sheet

Every `lorekit fetch` writes a record to `<corpus>/.wiki/ingest-state.json` with `status: started, stepsDone: ['fetch']`. As the skill advances through the pipeline, it records each step:

```bash
lorekit ingest record <url> --step archive --archived-to 原料/文章/<slug>
lorekit ingest record <url> --step wiki --wiki-page 知识库/概念/<slug>.md
lorekit ingest record <url> --step lint     # auto-promotes to status=completed
```

Check what's in flight:

```bash
lorekit ingest pending      # non-completed records
lorekit ingest list         # everything
```

Re-fetching the same URL is a no-op by default:

```bash
lorekit fetch <url>
# → status: duplicate       (already completed)
# → status: in_progress     (was interrupted, shows next step to resume)

lorekit fetch <url> --force # ignore the check and re-fetch anyway
```

For corpora that predate this state store, back-fill once:

```bash
lorekit ingest reconcile --dry-run   # preview
lorekit ingest reconcile             # commit
```

---

## 9. Write three anchor cards

Give the agent some initial context:

### `知识库/实体/me.md`

Who you are, what you're working on, how you like to communicate.

### `知识库/实体/<current project>.md`

The project taking most of your time.

### `知识库/概念/<a concept>.md`

Something you've been thinking about. The agent mirrors this style when it generates new cards.

All three need frontmatter:

```yaml
---
type: entity
title: xxx
slug: 知识库/实体/xxx
created: 2026-04-17
updated: 2026-04-17
---
```

---

## 8.5 Obsidian graph filter (recommended)

If you plan to browse the corpus in Obsidian, `lorekit init` has already dropped a recommended filter into `.obsidian/graph.json`. It hides non-knowledge nodes so the graph actually looks like your knowledge, not your scaffolding:

- **excluded dirs**: `_工作台/` `_归档/` `反馈/` `系统/`
- **excluded files**: `_INDEX` `index` `log` `MEMORY` `README` `AGENTS` `CLAUDE`
- **kept**: `知识库/` (wiki) `原料/` (raw, heavily back-linked) `每日/` (daily notes) `写作/` (outgoing drafts)

If you initialized into a directory that already had `.obsidian/graph.json`, `lorekit init` left it untouched (to preserve your custom `colorGroups` / `forceGravity` / etc.). Copy this filter into **Graph view → Filters** manually:

```
-path:"_工作台" -path:"_归档" -path:"反馈" -path:"系统" -file:"_INDEX" -file:"index" -file:"log" -file:"MEMORY" -file:"README" -file:"AGENTS" -file:"CLAUDE"
```

Toggle the graph tab off/on after editing `graph.json` so Obsidian re-reads the file.

---

## 9. FAQ

**Skill didn't trigger?**
Check that `~/.claude/skills/wiki-*` exist. If they do, restart the Claude Code session.

**Where should I put the corpus?**
Prefer `~/Desktop/` or `~/Documents/`. Avoid iCloud (sqlite gets stalled by the syncer).

**Multiple corpora?**
The CLI follows `cwd`. `cd` into whichever corpus you want to operate on.

**ollama isn't running?**
`lorekit vector sync` will tell you. Run `ollama serve`.

**Swap embedding models?**

```bash
ollama pull nomic-embed-text
lorekit vector sync --model nomic-embed-text --force
```

**Migrate existing notes?**

```bash
lorekit init ~/existing-notes
# → detects existing content and offers backup
```

**Update lorekit?**

```bash
cd ~/code/lorekit
git pull
npm install
npm run build
# npm link is still valid — the symlink picks up the new build
```

---

## 10. Embedding model options

Default is bge-m3; anything in ollama's catalog works:

| Model                | Install                         | Size   | Dim  | Best for                   |
| -------------------- | ------------------------------- | ------ | ---- | -------------------------- |
| **bge-m3** (default) | `ollama pull bge-m3`            | 1.2 GB | 1024 | Chinese+English, balanced  |
| nomic-embed-text     | `ollama pull nomic-embed-text`  | 274 MB | 768  | English-heavy, lightweight |
| mxbai-embed-large    | `ollama pull mxbai-embed-large` | 670 MB | 1024 | Strong English             |
| all-minilm           | `ollama pull all-minilm`        | 45 MB  | 384  | Ultra-lightweight          |

Rule of thumb: primary language is Chinese → bge-m3; English-only → nomic-embed-text; tight on disk → all-minilm.
