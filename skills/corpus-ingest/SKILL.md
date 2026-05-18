---
name: corpus-ingest
description: Use when the user wants to ingest, archive, save, or organize a URL, file, pasted source, article, document, or external material into a central Lorekit corpus from any project.
---

# corpus-ingest

Global ingest entry for a central Lorekit corpus. It brings external material into the corpus while delegating filing rules to the corpus itself.

## Config

Read `~/.config/lorekit/global-corpus.json`.

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`
- `raw_dir` (default `原料`)
- `knowledge_dir` (default `知识库`)

Use the corpus-local wrapper. Do not silently call a bare global `lorekit` for ingest writes.

## Boundary

Global skill = entry and routing.

Project-local corpus rules = execution authority.

Before writing, read:

- `<default_corpus>/AGENTS.md`
- `<default_corpus>/CLAUDE.md`
- `<default_corpus>/系统/filing-rules.md`
- `<default_corpus>/系统/frontmatter-spec.md`
- `<default_corpus>/skills/wiki-ingest/SKILL.md` when present

## When To Use

Use for:

- URLs, articles, PDFs or files the user wants saved
- "ingest", "归档", "整理进知识库", "收藏"
- external evidence that should become `原料/` and compiled wiki pages

Do not use for:

- quick rough notes: use `corpus-capture`
- conversation insights without external material: use `corpus-fileback`
- daily journal: use `wiki-daily`
- deletion: do not route deletion through a global skill

## Action

1. Read config and corpus rules.
2. `cd <default_corpus>`.
3. For URL input, run `<lorekit_bin> fetch <url>`.
4. Follow the corpus-local `wiki-ingest` process for archive, wiki compilation, backlinks, ingest state, lint, and sync.
5. Keep `原料/` immutable after archive.
6. Preserve fetched slugs unless corpus rules explicitly say otherwise.
7. Use `<lorekit_bin> sync` and `<lorekit_bin> lint --quick` when the local ingest skill requires them.

## Safety

Never delete source material.

Never bypass duplicate or in-progress states reported by `lorekit fetch`.

If the current session cannot write to the corpus, report the intended actions and stop.

Do not write private or sensitive material into `知识库/` unless the user explicitly asked to ingest it.
