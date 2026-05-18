---
name: corpus-capture
description: 用于在任意项目中把随手记录、想法、观察、决策或临时信息捕获到中央 Lorekit corpus 的工作台收件箱。
---

# corpus-capture

Global entry skill for cross-project capture. It collects fragments into the configured corpus workbench; it does not compile long-term knowledge.

## Config

Read:

`~/.config/lorekit/global-corpus.json`

Expected fields:

```json
{
  "default_corpus": "/ABSOLUTE/PATH/TO/CORPUS",
  "lorekit_bin": "/ABSOLUTE/PATH/TO/CORPUS/bin/lorekit",
  "gbrain_bin": "/ABSOLUTE/PATH/TO/CORPUS/bin/gbrain",
  "workbench_inbox_dir": "_工作台/收件",
  "daily_inbox_dir": "_工作台/日记收件",
  "knowledge_dir": "知识库",
  "raw_dir": "原料",
  "output_dir": "输出"
}
```

If the config does not exist, ask the user to configure it. Do not guess the corpus path.

Use an absolute `lorekit_bin` from config, or `<default_corpus>/bin/lorekit` if it exists. Do not silently call a bare global `lorekit` for writes.

## When To Use

Use for:

- "记一下", "先存一下", "放到工作台", "收件箱"
- unresolved ideas, observations, rough notes, external clues
- cross-project programming decisions that are not a daily journal entry

Do not use for:

- daily journal, todo, daily compile, rolling/weekly synthesis: use `wiki-daily`
- confirmed long-term knowledge: use `corpus-fileback`
- URL/file ingest that should become `原料/` + `知识库/`: use `corpus-ingest`
- deletion or cleanup

## Action

1. Read `global-corpus.json`.
2. Detect current project name, cwd, git branch, and commit when available.
3. Create one append-only Markdown fragment under:

   `<default_corpus>/<workbench_inbox_dir>/<YYYY-MM-DD>/<timestamp>-<slug>.md`

4. Use frontmatter:

```yaml
---
type: inbox-note
status: inbox
captured_at: 2026-05-18T10:30:00+08:00
source_project:
source_context:
source_git_branch:
source_git_commit:
privacy: normal
related: []
---
```

5. Preserve the user's meaning. Lightly structure only when it helps.
6. Do not modify `知识库/`.
7. Do not modify `每日/`.
8. Do not run `lorekit sync` for workbench-only capture.

## Workbench Injection

If the user asks to inject content into the workbench, write to `_工作台/收件/` by default.

If the user names a different workbench folder, only write under `_工作台/`. Do not write outside the configured corpus.

## Failure Handling

If the current Codex session cannot write to the configured corpus, report:

- intended target path
- proposed Markdown content
- the permission or sandbox issue

Do not attempt to bypass workspace permissions.
