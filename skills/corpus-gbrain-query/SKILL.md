---
name: corpus-gbrain-query
description: 用于从中央 Lorekit corpus 进行图谱、多跳关系或 GBrain 增强候选检索，并保持 Lorekit 知识库为事实源。
---

# corpus-gbrain-query

Global read-only GBrain query entry for a central Lorekit corpus.

## Config

Read `~/.config/lorekit/global-corpus.json`.

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`

Optional:

- `gbrain_bin`

Prefer `<lorekit_bin> gbrain query` over direct `gbrain query`, because Lorekit maps candidates back to canonical corpus pages.

## Boundary

Lorekit `知识库/` is the only source of truth.

GBrain is a derived candidate recall layer. It must not write `知识库/`, `原料/`, or `输出/`.

Do not run native GBrain mutating commands from this skill.

## When To Use

Use when:

- ordinary `corpus-query` recall is weak
- the user asks for multi-hop relationships
- the question is about graph connections, adjacent concepts, or indirect links
- the user explicitly asks for GBrain

Do not use for:

- first-pass exact keyword search
- writes or fileback
- ingest

## Action

1. Read config.
2. `cd <default_corpus>`.
3. Run `<lorekit_bin> gbrain status --json` when freshness or setup is unclear.
4. Run `<lorekit_bin> gbrain query "<q>" --json`.
5. Map every candidate back to canonical `知识库/` pages using Lorekit output.
6. Read the canonical pages before answering.

If the GBrain index is stale, report the stale warning. Do not auto-sync unless the user asks.

## Output

Return:

- candidate pages
- relationship or multi-hop explanation
- freshness warning if present
- next step: run `corpus-query` synthesis or `corpus-fileback` only after user confirmation
