---
name: corpus-query
description: 用于显式配置目标 corpus 后，从任意项目搜索、查询、回忆或综合该 LoreKit corpus 的已有知识。
---

# corpus-query

Optional read-only query gateway for a configured Lorekit corpus. It routes a cross-project question back to that corpus, then follows the target corpus rules.

## Config

Read:

`~/.config/lorekit/global-corpus.json`

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`
- `knowledge_dir` (default `知识库`)

Optional:

- `output_dir`

If the config is missing, ask for it. Do not guess the corpus path.

Use the configured corpus-local wrapper (`lorekit_bin`) for CLI calls; fall back only to `<default_corpus>/bin/lorekit` when that path exists.

## Boundary

This skill is an optional cross-project gateway. Target corpus rules remain authoritative.

Before answering, read the relevant local rules when available:

- `<default_corpus>/AGENTS.md`
- `<default_corpus>/CLAUDE.md`
- `<default_corpus>/index.md`
- `<default_corpus>/skills/wiki-query/SKILL.md`

Read only what is needed. Do not bulk-load the corpus.

## Query Route

1. `cd <default_corpus>`.
2. For exact terms, run `<lorekit_bin> search "<q>"`.
3. Read `<default_corpus>/index.md`, then the relevant `_INDEX.md` files.
4. Read canonical pages under `知识库/` before answering.

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
