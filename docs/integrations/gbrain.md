# GBrain Integration

GBrain is an optional read-only retrieval layer for a lorekit corpus.

```text
lorekit = source of truth / Markdown Wiki compiler
GBrain  = graph + hybrid retrieval index
```

## Boundary

- Do not vendor GBrain runtime / engine into lorekit. Small MIT-attributed pure projection helpers are allowed when they keep the bridge file-first and dependency-light.
- Do not add GBrain to `package.json` dependencies.
- Do not let GBrain write `知识库/` or `原料/`.
- Persisting new knowledge still goes through wiki-fileback / audit / snapshot.
- All integration outputs live under `.wiki/integrations/gbrain-export/` or `.wiki/integrations/gbrain/`.

## Commands

```bash
lorekit gbrain status
lorekit gbrain export --dry-run
lorekit gbrain export
lorekit gbrain export --out .wiki/integrations/custom-gbrain-export
lorekit gbrain export --out /tmp/gbrain-export --allow-outside-corpus
lorekit gbrain sync --dry-run
lorekit gbrain sync
lorekit gbrain sync --export-even-if-missing
lorekit gbrain doctor
lorekit gbrain query "..."
lorekit gbrain query "..." --no-stale-check
```

`status` checks the external `gbrain` binary. Use `LOREKIT_GBRAIN_BIN=/path/to/gbrain` to test another binary.

`export` reads `知识库/**/*.md`, skips `_INDEX.md`, local `index.md`, and `知识库/模板/`, then compiles a GBrain-native staging copy under:

```text
.wiki/integrations/gbrain-export/
├── manifest.json
├── pages/
└── README.md
```

The exported frontmatter removes `slug` and injects:

```yaml
lorekit_source_path:
lorekit_layer: artifact
lorekit_hash:
lorekit_exported_at:
```

It also projects canonical paths into GBrain-friendly slugs, for example `知识库/概念/Anthropic-Harness.md` becomes `concepts/anthropic-harness` and `知识库/实体/Anthropic.md` becomes `entities/anthropic`. The manifest records both directions: each page has `sourcePath`, `exportPath`, `gbrainSlug`, `kind`, `hash`, and `updatedAt`; `manifest.reverseMap` maps GBrain slugs back to canonical `知识库/` paths.

During staging only, lorekit rewrites canonical wikilinks and common frontmatter relation fields to projected slugs. It also maps Lorekit page types into GBrain `PageType` values where needed, for example `gbrain.kind: company` becomes staged `type: company`. Timeline bullets such as `- 2026-04-13 | event` are normalized to GBrain's bold-date form. Month-precision timeline lines are preserved and recorded in `gbrain_low_precision_timeline` for review.

Custom `--out` paths are intentionally constrained: by default they must stay under `.wiki/integrations/`. Use `--allow-outside-corpus` only for an explicit unsafe export target.

`sync` first checks that the external GBrain binary is installed, then exports and runs:

```bash
gbrain import .wiki/integrations/gbrain-export/pages --fresh
gbrain extract all --source db --include-frontmatter --json
```

and writes:

```text
.wiki/integrations/gbrain/sync-report.json
```

If GBrain is missing, `sync` writes a failure report without refreshing `.wiki/integrations/gbrain-export/`. Use `--export-even-if-missing` only when you explicitly want to refresh staging despite the missing binary.

`doctor` checks binary availability, export manifest presence, reverse manifest completeness, stale hashes, last sync status, and the suspicious case where exported wikilinks exist but GBrain extraction keeps producing 0 links. Main `lorekit doctor` also exposes this optional integration section via:

```bash
lorekit doctor --section integrations
lorekit doctor --json
```

GBrain is optional: missing binary is a warning, not a hard corpus failure. Unreadable integration state or a manifest without reverse mapping is a hard error.

`query` requires running inside a lorekit corpus. By default it checks the export manifest and last sync report before calling `gbrain query --no-expand`. If that state looks stale, it warns with `GBrain index may be stale. Run lorekit gbrain sync.` but still queries the external index. Candidates are mapped through `manifest.reverseMap` so final context points back to canonical `知识库/` pages, never `.wiki/integrations/gbrain-export/`. If the external GBrain CLI prints candidates but then times out or exits non-zero, Lorekit preserves those mapped candidates and reports a warning instead of losing a usable recall result. Use `--no-stale-check` only for intentional debugging or recovery.

## Install GBrain

GBrain currently recommends source install:

```bash
git clone https://github.com/garrytan/gbrain.git ~/code/gbrain
cd ~/code/gbrain
bun install
bun link
gbrain init
```

This is intentionally separate from lorekit install.

## Project-local bridge

This bridge is optional. lorekit is complete without GBrain; use GBrain only when you want graph / hybrid retrieval or multi-hop candidate discovery.

If you choose project-local isolation for a corpus, prefer project-local wrappers over relying on global PATH:

```text
my-corpus/
├── bin/
│   ├── lorekit
│   └── gbrain
├── skills/
│   ├── lorekit-gbrain-query/
│   ├── lorekit-gbrain-sync-check/
│   └── lorekit-fileback-after-gbrain/
└── .wiki/integrations/
    ├── gbrain-export/
    └── gbrain/
```

`bin/lorekit` should set `LOREKIT_GBRAIN_BIN` to the project-local `bin/gbrain`.

`bin/gbrain` should set `GBRAIN_HOME` to `.wiki/integrations/gbrain/`.

This prevents a normal coding project from accidentally using corpus-specific GBrain behavior, and prevents this corpus from writing into a different GBrain home. If you do not need that isolation, a global `gbrain` binary can still be used by `lorekit gbrain ...`; the read/write boundary remains the same.

## Skill mapping

Do not install GBrain's full native skill pack into a lorekit corpus by default.

Recommended mapping:

| Need                             | Use                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Read-only graph/hybrid lookup    | `lorekit-gbrain-query` wrapping `lorekit gbrain query`                              |
| Bridge status/freshness          | `lorekit-gbrain-sync-check` wrapping `status`, `export --dry-run`, `doctor`, `sync` |
| Save an insight found via GBrain | `lorekit-fileback-after-gbrain`, then lorekit writes canonical wiki                 |
| Source-level product research    | `lorekit-gbrain-research`                                                           |

GBrain native mutating skills such as `brain-ops`, `ingest`, `enrich`, `maintain`, and `reports` are useful design references, but should stay disabled for a lorekit corpus unless the user explicitly wants a separate GBrain-native brain.

## Codex note

Project-local skills usually do not appear in Codex's `/` skill preview. Put short trigger descriptions in `AGENTS.md`; Codex will read the project-local `skills/<name>/SKILL.md` when that route is relevant.
