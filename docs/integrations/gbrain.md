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
lorekit gbrain doctor
lorekit gbrain query "..."
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

`sync` runs:

```bash
gbrain import .wiki/integrations/gbrain-export/pages
```

and writes:

```text
.wiki/integrations/gbrain/sync-report.json
```

`doctor` checks binary availability, export manifest presence, stale hashes, and last sync status.

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
