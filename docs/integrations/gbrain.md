# GBrain Integration

GBrain is an optional read-only retrieval layer for a lorekit corpus.

```text
lorekit = source of truth / Markdown Wiki compiler
GBrain  = graph + hybrid retrieval index
```

## Boundary

- Do not vendor GBrain source into lorekit.
- Do not add GBrain to `package.json` dependencies.
- Do not let GBrain write `知识库/` or `原料/`.
- Persisting new knowledge still goes through wiki-fileback / audit / snapshot.
- All integration outputs live under `.wiki/integrations/gbrain-export/` or `.wiki/integrations/gbrain/`.

## Commands

```bash
lorekit gbrain status
lorekit gbrain export --dry-run
lorekit gbrain export
lorekit gbrain sync --dry-run
lorekit gbrain sync
lorekit gbrain sync --export-even-if-missing
lorekit gbrain doctor
lorekit gbrain query "..."
lorekit gbrain query "..." --no-stale-check
```

`status` checks the external `gbrain` binary. Use `LOREKIT_GBRAIN_BIN=/path/to/gbrain` to test another binary.

`export` reads `知识库/**/*.md`, skips `_INDEX.md`, local `index.md`, and `知识库/模板/`, then writes GBrain-safe Markdown under:

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

`sync` first checks that the external GBrain binary is installed, then exports and runs:

```bash
gbrain import .wiki/integrations/gbrain-export/pages
```

and writes:

```text
.wiki/integrations/gbrain/sync-report.json
```

If GBrain is missing, `sync` writes a failure report without refreshing `.wiki/integrations/gbrain-export/`. Use `--export-even-if-missing` only when you explicitly want to refresh staging despite the missing binary.

`doctor` checks binary availability, export manifest presence, stale hashes, and last sync status. Main `lorekit doctor` also exposes this optional integration section via:

```bash
lorekit doctor --section integrations
lorekit doctor --json
```

GBrain is optional: missing binary is a warning, not a hard corpus failure. Unreadable integration state, such as a broken sync report JSON, is a hard error.

`query` requires running inside a lorekit corpus. By default it checks the export manifest and last sync report before calling `gbrain query`, so users do not accidentally trust a stale external index. Use `--no-stale-check` only for intentional debugging or recovery.

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
