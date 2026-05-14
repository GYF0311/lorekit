# lorekit

A personal LLM Wiki toolkit — let AI build and maintain your knowledge base.

Based on [Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), lorekit gives any AI coding agent a local knowledge-base workflow: **raw sources → LLM compilation → persistent wiki**. Compile once, keep updating — no RAG. `lorekit install-skills` currently auto-installs the `wiki-*` skills for Claude Code only; for other agents (Codex / Cursor / Kimi CLI / Aider / Windsurf), the `skills/` directory is plain Markdown — symlink or copy into your agent's skill path.

> **Hand the GitHub link to your AI, say "install this for me" — it reads CLAUDE.md / AGENTS.md and does the rest.**

## Core Idea

> "Instead of just retrieving from raw documents at query time, the LLM incrementally builds and maintains a persistent wiki." — [Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

Traditional RAG: every query re-retrieves from raw documents. Nothing accumulates.

lorekit (LLM Wiki): the LLM incrementally compiles raw material into a structured wiki. Knowledge is compiled once and continuously updated — cross-references in place, contradictions flagged, every source reflected.

Three layers:

- **Raw layer** (`原料/`): read-only source material, the LLM never mutates it
- **Artifact layer** (`知识库/`): the compiled wiki — cross-linked, synthesized, continuously updated
- **Schema** (`CLAUDE.md` / `AGENTS.md`): per-corpus configuration, co-maintained by human + LLM

> **Data safety**: lorekit has zero tolerance for data loss. Existing notes are backed up before init; `原料/` is immutable; no `rm` is ever used — deletions go through `trash` (recoverable from macOS Trash). See the data-safety rules in CLAUDE.md.

## Feature Map

| Feature         | Command                 | Notes                                                                                                                                                                 |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch screen   | `lorekit`               | No-arg invocation prints the blue logo + corpus status                                                                                                                |
| Init            | `lorekit init`          | Scaffolds the corpus, deploys the Obsidian plugin, auto-backs up pre-existing content                                                                                 |
| Doctor          | `lorekit doctor`        | Directory integrity, frontmatter coverage, Obsidian hints, optional integration health; supports `--json` and strict `--section <name>` filters                        |
| Stats           | `lorekit stats`         | Page count, type breakdown                                                                                                                                            |
| Search          | `lorekit search`        | Text search + vector semantic search (hybrid)                                                                                                                         |
| Web fetch       | `lorekit fetch <url>`   | Pulls WeChat / generic pages into the workbench; auto-extracts `publishDate`, writes spec-compliant frontmatter, detects duplicate / in-progress URLs from state.json |
| Ingest state    | `lorekit ingest <sub>`  | `list` / `pending` / `record` / `forget` / `reconcile` — the single source of truth for ingest pipeline progress                                                      |
| Lint            | `lorekit lint`          | Broken wikilinks, orphan pages, duplicate detection                                                                                                                   |
| Snapshot        | `lorekit snapshot`      | Full-corpus tarball + manifest                                                                                                                                        |
| Restore         | `lorekit restore`       | Recover missing / changed files from a snapshot                                                                                                                       |
| Remove          | `lorekit remove`        | Dry-run impact report, then safely move selected sources/pages to OS Trash with provenance-aware cleanup                                                              |
| Audit           | `lorekit audit`         | Create / list / resolve human feedback on wiki pages                                                                                                                  |
| Vector sync     | `lorekit vector sync`   | Incrementally embed the corpus into sqlite-vec + FTS5                                                                                                                 |
| Vector query    | `lorekit vector query`  | Search modes: `--layered` (vector), `--bm25` (FTS5), `--hybrid` (both + RRF)                                                                                          |
| Vector status   | `lorekit vector status` | Inspect the index; returns `mode: text\|vector` recommendation based on `indexed_files` vs `MODE_THRESHOLD_FILES` (default 100)                                       |
| Directory index | `lorekit index`         | Recursively generate `_INDEX.md` for every subdirectory (including folder-packaged sources like `原料/文章/<slug>/article.md`)                                        |
| **Sync**        | **`lorekit sync`**      | **One-shot: `index` → `vector sync --layered` → `doctor`; supports `--json` and `--report` for agent-readable step receipts**                                       |
| Obsidian tune   | `lorekit obsidian-tune` | 老用户升级一键应用 Obsidian graph filter（默认只读检查 / `--write` 备份后写 / `--print` 管道用）                                                                       |
| GBrain          | `lorekit gbrain <sub>`  | Optional read-only bridge: export `知识库/` into `.wiki/integrations/gbrain-export/`, then call external `gbrain import`; never writes canonical wiki pages             |

> The CLI is named `lorekit`. The 6 Agent Skills keep the `wiki-` prefix (a nod to Karpathy's LLM Wiki): `wiki-ingest` / `wiki-query` / `wiki-fileback` / `wiki-lint` / `wiki-enrich` / `wiki-audit`.

## Ingest Pipeline (single-source-of-truth state machine)

Every ingest is tracked in `<corpus>/.wiki/ingest-state.json`. This file is the **only** authority on pipeline progress — no filesystem scans, no duplicate heuristics.

**Three top-level states**: `started` / `completed` / `failed`.

Fine-grained progress is tracked in a `stepsDone[]` array so an interrupted ingest can resume exactly where it left off. The top-level status only changes when the pipeline as a whole ends.

```json
{
  "version": 1,
  "ingests": {
    "https://example.com/post": {
      "url": "https://example.com/post",
      "title": "…",
      "sourceDate": "2026-04-15",
      "status": "started",
      "stepsDone": ["fetch", "archive", "wiki"],
      "archivedTo": "原料/文章/post",
      "wikiPages": ["知识库/概念/foo.md"],
      "startedAt": "2026-04-17T10:00:00.000Z",
      "updatedAt": "2026-04-17T10:05:00.000Z"
    }
  }
}
```

**Status transitions** driven by `lorekit ingest record --step <X>`:

| Action                                       | `status`        | `stepsDone`                    |
| -------------------------------------------- | --------------- | ------------------------------ |
| `lorekit fetch <url>` (success)              | `started`       | `[fetch]`                      |
| `lorekit ingest record <url> --step archive` | `started`       | `[fetch, archive]`             |
| `lorekit ingest record <url> --step wiki`    | `started`       | `[fetch, archive, wiki]`       |
| `lorekit ingest record <url> --step lint`    | **`completed`** | `[fetch, archive, wiki, lint]` |

Only `--step lint` auto-promotes to `completed`. Every other `--step` keeps the top status at `started` — all progress detail lives in `stepsDone`. Explicit `--complete` and `--fail <reason>` are also available.

**What `lorekit fetch` does before hitting the network**, consulting state.json:

- Record with `status: completed` → returns `{"status":"duplicate", duplicate}`, does not re-fetch
- Record with `status: started` → returns `{"status":"in_progress", ingestState, nextStep}`, does not re-fetch
- No record, but a matching `source_url` exists in `原料/` → same `duplicate` path (legacy fallback)
- Otherwise → fetches normally, writes `status: started, stepsDone: [fetch]`

`--force` bypasses every check.

**Extensibility** — adding a new step (e.g. `embed`) is just appending `"embed"` to `stepsDone`. The status enum stays at three. No switch-case in the caller needs to change.

## Quick Start

### Option 1: let AI install it (recommended)

Send the repo link to your AI coding agent and say "install this project." It reads `CLAUDE.md` / `AGENTS.md` and runs: dependency check → clone → build → link → init corpus → install skills.

### Option 2: manual install

```bash
# 1. Clone
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit

# 2. Install deps + build
cd ~/code/lorekit && npm install && npm run build

# 3. Link to global PATH
npm link

# 4. Verify
lorekit --version   # → 0.4.0
lorekit             # no-arg invocation shows the brand banner

# 5. Initialize a corpus
lorekit init ~/Desktop/my-corpus

# 6. Install Agent Skills
lorekit install-skills --target claude-code

# 7. Start a conversation from the corpus directory
cd ~/Desktop/my-corpus
claude  # or codex / cursor / kimi …
```

(Future: once published to npm, `npm install -g lorekit` will be enough.)

### What Success Looks Like

You can start real use when these five checks work in the same corpus:

```bash
lorekit init ~/Desktop/my-corpus
lorekit fetch <url>
# AI ingest compiles the fetched source into 知识库/
lorekit sync --json
lorekit snapshot
```

At that point, stop polishing the tool and use the corpus for 1-2 weeks. The next iteration should come from actual friction, not imagined completeness.

### Dependencies

| Tool         | Purpose                  | Install                | Required |
| ------------ | ------------------------ | ---------------------- | -------- |
| Node.js ≥ 18 | JS runtime               | `brew install node`    | ✅       |
| git          | Version control          | ships with macOS/Linux | ✅       |
| ripgrep      | Text-search acceleration | `brew install ripgrep` | Optional |
| ollama       | Local embedding runtime  | `brew install ollama`  | Optional |
| bge-m3       | Embedding model          | `ollama pull bge-m3`   | Optional |
| Bun + GBrain | Graph retrieval bridge   | `git clone https://github.com/garrytan/gbrain.git && cd gbrain && bun install && bun link` | Optional |

**Only Node.js is required.** No bash / Python / uv / pip. lorekit is pure TypeScript, cross-platform (macOS / Linux / Windows).

Vector retrieval is optional — without ollama, the AI still navigates via `index.md`.

## Optional GBrain Bridge

GBrain is an optional graph / hybrid retrieval layer. lorekit remains the source of truth:

```text
lorekit writes 知识库/
GBrain reads an exported staging copy
```

No GBrain code is vendored into lorekit, and GBrain is not a `package.json` dependency. The bridge only shells out to an installed `gbrain` binary.

```bash
cd ~/Desktop/my-corpus
lorekit gbrain status
lorekit gbrain export --dry-run
lorekit gbrain export
lorekit gbrain sync --dry-run
lorekit gbrain sync
lorekit gbrain doctor
lorekit gbrain query "RAG"
```

`export` writes only under `.wiki/integrations/gbrain-export/` by default. Custom `--out` paths must stay under `.wiki/integrations/`; pass `--allow-outside-corpus` only when you intentionally want an unsafe export target. `export` skips `_INDEX.md`, local `index.md`, and `知识库/模板/`, removes frontmatter `slug`, and injects `lorekit_source_path`, `lorekit_hash`, and `lorekit_exported_at`. `sync` first checks the external GBrain binary, then exports and runs `gbrain import <export/pages>`, writing `.wiki/integrations/gbrain/sync-report.json`. If the binary is missing, `sync` writes a failure report without refreshing staging unless `--export-even-if-missing` is explicit.

`query` requires a corpus and checks the export manifest + last sync report before calling GBrain. If the export or sync report looks stale, it warns with `GBrain index may be stale. Run lorekit gbrain sync.` but still calls `gbrain query`; use `--no-stale-check` only for debugging noisy freshness checks.

Boundary: GBrain must not write back to `知识库/` or `原料/`. Persisting new knowledge still goes through wiki-fileback / audit / snapshot review.

## Using It

```bash
cd ~/Desktop/my-corpus
claude  # or codex / cursor / kimi …
```

Talk in natural language; the AI routes to the right skill:

```
> Ingest this article: https://mp.weixin.qq.com/s/xxx
# → wiki-ingest: fetch → store in 原料/ → compile into 知识库/ → update index.md

> Have I filed anything about RAG before?
# → wiki-query: read index.md → locate pages → synthesize answer

> Save that analysis into the knowledge base
# → wiki-fileback: route to the right wiki page by subject

> Check the health of the knowledge base
# → wiki-lint: scan broken links, orphans, stale workbench

> Back up the corpus
# → lorekit snapshot → .wiki/snapshots/xxx.tar.gz
```

## Vector Retrieval

Default stack: **[ollama](https://ollama.com/) + [bge-m3](https://huggingface.co/BAAI/bge-m3)** (BAAI, 1024-d, 100+ languages, strong on Chinese+English).

Embeddings are produced through ollama's local API. **No torch, no pip, no API key, nothing leaves your machine.**

```bash
# One-time setup
brew install ollama
ollama pull bge-m3

# Standard workflow (layered + FTS5 by default)
lorekit sync                               # index → vector sync → doctor, one shot

# Three query modes (pick based on the problem, not the index)
lorekit vector query --hybrid --text "xxx" # BM25 + vector + RRF fusion (production default)
lorekit vector query --layered --text "xxx" # vector-only layered (debug)
lorekit vector query --bm25    --text "xxx" # FTS5-only BM25 (debug precise keywords / dates)

# Agent-readable receipts
lorekit sync --json
lorekit sync --report                       # writes .wiki/reports/sync/<timestamp>.json
```

Swappable embedding models (any ollama-hosted model works):

| Model                | Install                         | Size   | Dim  | Best for                   |
| -------------------- | ------------------------------- | ------ | ---- | -------------------------- |
| **bge-m3** (default) | `ollama pull bge-m3`            | 1.2 GB | 1024 | Chinese+English, balanced  |
| nomic-embed-text     | `ollama pull nomic-embed-text`  | 274 MB | 768  | English-heavy, lightweight |
| mxbai-embed-large    | `ollama pull mxbai-embed-large` | 670 MB | 1024 | Strong English             |
| all-minilm           | `ollama pull all-minilm`        | 45 MB  | 384  | Ultra-lightweight          |

## Progressive Disclosure

The agent's context window is scarce. lorekit uses three-layer progressive disclosure on both the document side and the vector side, reading only what's needed.

### Document retrieval (L0 → L1 → L2)

```
L0 (auto-injected, ~2k tokens)
  CLAUDE.md + index.md
  → Agent immediately knows "what this corpus is and what each page roughly covers"

      ↓ pick the right subdirectory

L1 (on-demand, ~1k tokens/pull)
  知识库/概念/_INDEX.md
  → the full entry list for one shelf

      ↓ narrow to a specific page

L2 (targeted)
  知识库/概念/RAG.md
  → full page content

      ↓ still not enough?

L3 (semantic fallback)
  lorekit vector query --hybrid
  → BM25 + vector + RRF hybrid, only when text drill-down misses
```

Like a human looking for a book: floor directory (L0) → shelf (L1) → take the book off the shelf (L2) → ask the librarian (L3). Total budget typically < 5k tokens.

**The same archive is read by humans/LLMs (via `Read`) and embedded by vectors (via `lorekit sync`)** — one source of truth, no drift between text index and vector store.

### Vector retrieval shares the same archive as document retrieval

This is the key design: **one archive, two reading modes**. The vector side does NOT synthesize its own summaries — it reads `index.md` and each `_INDEX.md` directly. So updating `index.md` automatically updates the L0 semantics on next `lorekit sync`.

```
              Document mode (small corpora, < 100 files)         Vector mode (≥ 100 files)
              ─────────────────────────────────────────          ──────────────────────────
L0            Read corpus/index.md                               Embed each `## section` of index.md
              (LLM picks 1-3 sections semantically)              → vec_dirs + fts_dirs
                          ↓                                              ↓
L1            Read {section}/_INDEX.md                            Embed each `- [[slug]] — summary` line
              (LLM picks candidate pages)                         → vec_pages + fts_pages
                          ↓                                              ↓
L2            Read specific .md file                              Chunk every page by `## heading`
              (LLM reads full page)                               → vec_chunks + fts_chunks
```

Mode switch is automatic. `lorekit vector status` returns a `mode` field (`text` | `vector`) based on `indexed_files` vs `MODE_THRESHOLD_FILES` (default 100, defined in `src/lib/vectordb.ts`). Skills read the `mode` field and route accordingly — no numeric threshold in skill files.

### Hybrid retrieval (vector mode default)

In vector mode, `--hybrid` runs three-tier BM25 (via SQLite FTS5, `trigram` tokenizer for CJK) in parallel with three-tier vector, then merges results by **Reciprocal Rank Fusion** (`score = Σ 1/(k+rank)`, k=60).

| Signal                                        | BM25 (FTS5)       | Vector (bge-m3)                  | RRF fusion               |
| --------------------------------------------- | ----------------- | -------------------------------- | ------------------------ |
| Exact entity names                            | ✅ nails it       | ⚠️ averaged out                  | takes the BM25 winner    |
| Dates like `2026-04-15`                       | ✅ exact          | ⚠️ cosine-similar to other dates | BM25 dominates           |
| Fuzzy intent ("relationship between X and Y") | ⚠️ AND-too-strict | ✅ embeddings shine              | vector dominates         |
| Mixed (entity + intent)                       | partial           | partial                          | both contribute → stable |

LLM re-rank (the 4th stage in the qmd reference architecture) is **not yet implemented** — see `docs/IDEAS.md` for the rationale and four possible routes when the time comes.

## Corpus Layout

```
corpus/
├── CLAUDE.md           ← per-corpus schema (auto-loaded by AI agents)
├── AGENTS.md           ← mirror of CLAUDE.md for Codex / Kimi / GPT
├── index.md            ← wiki table of contents (LLM updates on each ingest)
├── log.md              ← operation timeline (append-only)
│
├── 原料/               ← Raw sources (read-only, immutable)
│   ├── 文章/           ← web articles
│   ├── 论文/           ← academic papers
│   ├── 书籍/           ← book notes
│   ├── 会议/           ← meeting notes
│   ├── 录音/           ← transcribed audio
│   ├── 剪藏/           ← WeChat / web clippings
│   └── 引用/           ← pointers to large external files
│
├── 知识库/             ← Wiki (LLM-compiled artifact layer)
│   ├── 概念/           ← mental models, methodologies
│   ├── 实体/           ← people, tools, orgs, projects
│   ├── 摘要/           ← per-source summaries
│   └── 专题/           ← cross-source thematic syntheses (optional)
│
├── 每日/               ← daily notes (YYYY-MM-DD.md)
├── 写作/               ← outgoing drafts
│
├── 反馈/               ← human-feedback loop (Obsidian plugin + CLI)
│   ├── 待处理/
│   └── 已处理/
│
├── _工作台/            ← workbench (TTL-driven)
│   ├── 收件/           ← 7 days
│   ├── 草稿/           ← 30 days
│   ├── 临时/           ← 14 days
│   └── 待整理/         ← 3 days
│
├── _归档/              ← cold storage
└── .wiki/              ← lorekit metadata
    ├── ingest-state.json   ← ingest pipeline single source of truth
    ├── vector.sqlite       ← vector index (optional)
    └── snapshots/          ← snapshot archives
```

Subdirectory layout under `知识库/` is not fixed — it's declared by `CLAUDE.md` and can be customized per use case.

## Customization

lorekit is a skeleton, not a fixed structure:

1. **Edit `CLAUDE.md` scope** — declare what the corpus covers and doesn't
2. **Adjust `知识库/` subdirectories** — interview use case adds `知识库/面经/`, reading use case swaps for `知识库/角色/章节/`, etc.
3. **Edit filing rules** — append routing rules in `系统/filing-rules.md`
4. **Swap the embedding model** — `lorekit vector sync --model <ollama-model-name>`

## Backup & Restore

```bash
# Create a snapshot
lorekit snapshot --tag before-migration

# See what would change (no mutation)
lorekit restore --from .wiki/snapshots/xxx.tar.gz --dry-run

# Restore
lorekit restore --from .wiki/snapshots/xxx.tar.gz
```

`lorekit init` also offers backup automatically when it detects pre-existing content.

## Obsidian Integration

`lorekit init` deploys the `lorekit-audit` Obsidian plugin to `corpus/.obsidian/plugins/`. Enable it in Settings → Community plugins.

### Leaving feedback (shortcut `Cmd + '`)

Open any wiki page, select some text, press `Cmd + '` (or run "Add feedback on selection" from the command palette):

![Audit feedback modal](docs/images/audit-modal.png)

Four severity levels:

| Level     | Meaning                          |
| --------- | -------------------------------- |
| `info`    | Additional context, not an error |
| `suggest` | Improvement suggestion           |
| `warn`    | Needs attention                  |
| `error`   | Must fix                         |

Click **Save feedback** → written to `反馈/待处理/<timestamp>-<slug>.md` with anchor context (resilient to page edits).

### Resolving feedback

```bash
lorekit audit --list              # list all feedback
lorekit audit --list --open       # open items only
```

Or in Claude Code say "process the feedback" → the agent triggers `wiki-audit`: read `反馈/待处理/` entries → fix by severity → move to `反馈/已处理/` with a resolution note.

### Graph filter (recommended)

`lorekit init` writes a recommended graph filter to `<corpus>/.obsidian/graph.json` that excludes non-knowledge nodes (workbench / archive / feedback / schema dirs + auto-generated indexes + root metadata files like `AGENTS.md` / `CLAUDE.md`). If the corpus already has `.obsidian/graph.json`, init leaves it untouched — copy the filter below into Obsidian's "Graph view → Filters" manually:

```
-path:"_工作台" -path:"_归档" -path:"反馈" -path:"系统" -file:"_INDEX" -file:"index" -file:"log" -file:"MEMORY" -file:"README" -file:"AGENTS" -file:"CLAUDE"
```

What stays visible: `知识库/` (compiled wiki), `原料/` (raw sources, heavily back-linked), `每日/` (daily notes — Karpathy keeps these in the graph too), `写作/` (outgoing drafts).

Toggle the graph tab off and on after editing `graph.json` for Obsidian to re-read it.

### Other niceties

- `[[wikilinks]]` are clickable in Obsidian
- Graph view visualizes the knowledge network
- Plugin writes to `反馈/待处理/` by default — no config needed

## Project Layout

```
lorekit/
├── bin/
│   └── lorekit.js           Node.js CLI entry
├── src/                     TypeScript sources
│   ├── cli.ts               command dispatch + banner
│   ├── commands/            subcommand implementations
│   ├── lib/                 core library (corpus / ollama / vectordb / chunker / fetcher / ingest-state)
│   └── utils/               logger, fs helpers
├── dist/                    tsup build output (committed so users don't need to build)
├── skills/                  Agent Skills (plain markdown, agent-agnostic)
│   ├── wiki-ingest/
│   ├── wiki-query/
│   ├── wiki-fileback/
│   ├── wiki-lint/
│   ├── wiki-enrich/
│   └── wiki-audit/
├── plugins/
│   └── obsidian-audit/      Obsidian audit plugin
├── templates/
│   └── default-corpus/      corpus scaffold template
├── docs/
│   └── QUICKSTART.md        30-minute onboarding guide
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── CLAUDE.md                auto-install instructions for Claude Code
└── AGENTS.md                auto-install instructions for Codex / Kimi / GPT
```

## Acknowledgements

lorekit would not exist without the following projects and people.

### Core inspiration

| Source                                                                             | Author              | Contribution                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) | **Andrej Karpathy** | The core idea — three-layer architecture (raw / wiki / schema), the ingest / query / lint triad, the philosophy that "the wiki is a compilation cache, not the content itself." lorekit's soul comes from this gist. |
| [llm-wiki-skill](https://github.com/lewislulu/llm-wiki-skill)                      | **Lewis Liu**       | Audit feedback system design, Obsidian audit plugin, references-doc structure. lorekit's `反馈/` directory and audit plugin directly reference this project.                                                         |

### Referenced projects

| Project                                             | Author      | Contribution                                                         |
| --------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| [OpenViking](https://github.com/nicepkg/OpenViking) | **nicepkg** | Context Database design, inspired lorekit's layered vector retrieval |

### Key dependencies

| Project                                            | Author                       | Purpose                                                                   |
| -------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| [bge-m3](https://huggingface.co/BAAI/bge-m3)       | **BAAI**                     | Default embedding model (1024-d, 100+ languages)                          |
| [sqlite-vec](https://github.com/asg017/sqlite-vec) | **Alex Garcia**              | Vector storage (single-file sqlite extension)                             |
| [ollama](https://github.com/ollama/ollama)         | **Ollama Inc.**              | Local model inference, zero-config embedding API                          |
| [qmd](https://github.com/tobi/qmd)                 | **Tobi Lütke** (Shopify CEO) | Karpathy-endorsed local markdown search — our search design references it |

### Indirect influences

| Source                                                             | Influence                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Vannevar Bush, "As We May Think" (1945)                            | The Memex concept Karpathy cites — curated personal knowledge where the links matter more than the documents |
| ByteDance RAG field guide                                          | Chunking strategies, hybrid-retrieval engineering                                                            |
| Coze Studio source                                                 | Four-step knowledge-base pipeline design                                                                     |
| [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) | Embedding-model selection                                                                                    |

### Design principles

| Principle                        | Origin                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| "Thin CLI, fat skills"           | Garry Tan (YC CEO) — latent judgment in markdown            |
| "Filesystem is all you need"     | Unix philosophy + Obsidian's plain-file design              |
| "Compiled Truth + Timeline"      | Wikipedia — editable body + append-only history             |
| Per-corpus CLAUDE.md / AGENTS.md | Karpathy's schema concept + Claude Code / Codex conventions |

## License

MIT
