---
name: corpus-fileback
description: 用于用户明确确认后，把可复用结论、决策、综合判断或选定候选写回中央 Lorekit corpus 的知识库。
---

# corpus-fileback

Global fileback entry for a central Lorekit corpus. It writes only confirmed long-term knowledge, using corpus-local rules.

## Confirmation Gate

Only write to `知识库/` when the user explicitly says one of:

- "确认写入知识库"
- "确认第 1、3 条 fileback"
- "把这个沉淀到知识库"
- "写回 corpus"
- "注入知识库"

Notifications, candidate lists, or Feishu/Lark messages are reminders only. They are not confirmation unless the user copies the confirmation back into this Codex conversation.

## Config

Read `~/.config/lorekit/global-corpus.json`.

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`
- `knowledge_dir` (default `知识库`)

Use the corpus-local wrapper. Do not silently call a bare global `lorekit` for writes.

## Before Writing

Read:

- `<default_corpus>/AGENTS.md`
- `<default_corpus>/CLAUDE.md`
- `<default_corpus>/系统/filing-rules.md`
- `<default_corpus>/系统/frontmatter-spec.md`
- `<default_corpus>/index.md`
- `<default_corpus>/skills/wiki-fileback/SKILL.md` when present

## What To Write

Write reusable conclusions, decisions, and stable synthesis.

Do not write:

- ordinary todo items
- one-off emotions
- temporary complaints
- unverified guesses
- private content unless explicitly approved
- full diary prose

When fileback comes from `wiki-daily` candidates, preserve backlinks to the source daily page and candidate report.

## Action

1. Identify exactly which candidate or conclusion the user confirmed.
2. Resolve the subject using corpus filing rules.
3. Search existing pages with `<lorekit_bin> search "<subject>"`.
4. Append to existing pages or create new pages according to local rules.
5. Preserve source backlinks.
6. Run the local verification required by `wiki-fileback`, usually `<lorekit_bin> sync` and `<lorekit_bin> lint --quick`.
7. Report changed paths and verification.

## Safety

Do not auto-fileback from automation.

Do not let GBrain write canonical pages.

If confirmation is ambiguous, ask which candidate numbers or conclusion should be written.
