---
name: corpus-query
description: Use when the user wants to search, query, recall, or synthesize existing knowledge from a central Lorekit corpus while working in any project.
---

# corpus-query

Global read-only query entry for a central Lorekit corpus. It routes a cross-project question back to canonical corpus pages.

## Config

Read:

`~/.config/lorekit/global-corpus.json`

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`
- `knowledge_dir` (default `知识库`)

Optional:

- `gbrain_bin`
- `output_dir`

If the config is missing, ask for it. Do not guess the corpus path.

Use the corpus-local wrapper (`lorekit_bin`) for CLI calls. Do not silently call a bare global `lorekit`.

## Boundary

This skill is a global entrypoint. Corpus-local rules remain authoritative.

Before answering, read the relevant local rules when available:

- `<default_corpus>/AGENTS.md`
- `<default_corpus>/CLAUDE.md`
- `<default_corpus>/index.md`
- `<default_corpus>/skills/wiki-query/SKILL.md`

Read only what is needed. Do not bulk-load the corpus.

## Query Route

1. `cd <default_corpus>`.
2. Run `<lorekit_bin> vector status`.
3. For exact terms, run `<lorekit_bin> search "<q>"`.
4. For semantic recall, run `<lorekit_bin> vector query --hybrid --text "<q>"`.
5. If recall is weak and GBrain is configured, use `corpus-gbrain-query` as a candidate recall layer.
6. Read canonical pages under `知识库/` before answering.

GBrain candidates are not sources of truth. Always map them back to canonical `知识库/` pages.

## Output

Answer with:

- concise synthesis
- citations to real corpus pages
- confidence notes when source confidence is low or medium
- query path summary when useful

If the corpus does not contain relevant information, say so. Offer to run web research or create an inbox note only if useful.

## Writes

Default is read-only.

Do not modify `知识库/`, `原料/`, or `每日/` during query.

If the answer has reusable value, ask whether the user wants fileback. Only `corpus-fileback` performs the write.
