---
name: corpus-health
description: Use when the user wants to check central corpus health, Lorekit status, vector index status, GBrain freshness, configuration, or broken knowledge-base workflow state from any project.
---

# corpus-health

Global health-check entry for a central Lorekit corpus. It reports state and does not write knowledge.

## Config

Read `~/.config/lorekit/global-corpus.json`.

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`

Optional:

- `gbrain_bin`

Use corpus-local wrappers. Do not silently call bare global `lorekit` or `gbrain`.

## Checks

From `<default_corpus>`, run the narrow checks needed:

- `<lorekit_bin> doctor --json`
- `<lorekit_bin> vector status`
- `<lorekit_bin> ingest pending`
- `<lorekit_bin> gbrain status --json` when GBrain is configured
- `<lorekit_bin> gbrain doctor --json` when GBrain integration health is requested

Do not run `sync`, `gbrain sync`, `gbrain export`, or mutating repair commands unless the user explicitly asks.

## Output

Summarize:

- corpus path
- hard failures
- warnings
- stale indexes
- pending ingest items
- suggested next commands

Keep optional integration warnings separate from corpus hard failures.

## Safety

This skill is report-only by default.

Do not modify `知识库/`, `原料/`, `每日/`, or `.wiki/` during a health check unless the user separately requests repair.
