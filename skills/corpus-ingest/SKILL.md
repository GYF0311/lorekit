---
name: corpus-ingest
description: 用于显式配置目标 corpus 后，把跨项目 URL、文件、粘贴来源、文章、文档或外部资料摄入、归档、保存到该 LoreKit corpus。
---

# corpus-ingest

Optional ingest gateway for a configured Lorekit corpus. It brings external material into the target corpus while delegating filing rules to that corpus itself.

## Config

Read `~/.config/lorekit/global-corpus.json`.

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`
- `raw_dir` (default `原料`)
- `knowledge_dir` (default `知识库`)

Use the configured corpus-local wrapper for ingest writes.

## Boundary

Optional cross-project skill = entry and routing.

Target corpus rules = execution authority.

If the current working directory is already the intended corpus, prefer its local `wiki-ingest` route directly. Use this skill when the request starts outside the target corpus and needs configured cross-project routing.

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
- project-local evidence only when the user explicitly wants it promoted into the selected corpus

Do not use for:

- quick rough notes: use `corpus-capture`
- conversation insights without external material: use `corpus-fileback`
- daily journal: use `wiki-daily`
- deletion: use corpus-local `wiki-remove` or the `lorekit remove` dry-run path

## Action

1. Read config and corpus rules.
2. `cd <default_corpus>`.
3. For URL input, run `<lorekit_bin> fetch <url>`.
4. Follow the corpus-local `wiki-ingest` process for archive, wiki compilation, backlinks, ingest state, lint, sync, and cleanup of consumed `_工作台/收件/` originals.
5. Keep `原料/` immutable after archive.
6. Preserve fetched slugs unless corpus rules explicitly say otherwise.
7. Use `<lorekit_bin> sync` and `<lorekit_bin> lint --quick` when the local ingest skill requires them; workbench-only evidence does not trigger sync until it is promoted.

## Safety

Never delete source material.

After a confirmed ingest, cleaning the consumed workbench handoff original is allowed only when the target corpus `wiki-ingest` rules say the canonical `原料/` source, wiki pages, ingest state/log, and verification are complete. Use `lorekit trash`, never `rm`.

Never bypass duplicate or in-progress states reported by `lorekit fetch`.

If the current session cannot write to the corpus, report the intended actions and stop.

Do not write private or sensitive material into `知识库/` unless the user explicitly asked to ingest it.
