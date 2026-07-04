# lorekit QUICKSTART

30 minutes from zero to a local LLM Wiki managed by the `lorekit` CLI.

Default setup is CLI-only: install the global `lorekit` command and initialize a corpus. Research corpora, project-local skills, and central-corpus entrypoints are optional modules; see [`INSTALLATION.md`](INSTALLATION.md). If an AI agent is installing lorekit for a user, it should recommend CLI-only first and ask before adding any optional module.

---

## 0. What lorekit is

lorekit is a personal knowledge-base toolkit based on [Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The core idea: skip RAG, let the LLM incrementally compile and maintain a persistent wiki — raw sources come in, the LLM compiles them into structured, cross-linked pages, and the knowledge is compiled once and continuously updated.

Pure TypeScript, Node.js-only, usable from any AI coding agent (Claude Code / Codex / Cursor / Kimi CLI / Aider / Windsurf).

---

## 1. Prerequisites

### Required

| Tool         | Purpose        | Install             | Verify           |
| ------------ | -------------- | ------------------- | ---------------- |
| Node.js ≥ 18 | JS runtime     | `brew install node` / [nodejs.org](https://nodejs.org) | `node --version` |
| git          | Clone the repo | ships with macOS/Linux; [git-scm.com](https://git-scm.com) on Windows | `git --version`  |

### Optional (recommended)

| Tool         | Purpose                    | Install                                                                                    | Verify             |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| ripgrep      | Faster text search         | `brew install ripgrep`                                                                     | `rg --version`     |
| Claude Code  | Best end-to-end experience | [download](https://claude.com/claude-code)                                                 | `claude --version` |
| Obsidian     | Visual wiki browsing       | [download](https://obsidian.md)                                                            | —                  |

**No bash / Python / uv / pip needed.** lorekit is a pure Node.js project and runs on macOS / Linux / Windows.

---

## 2. Install lorekit

From npm (simplest, recommended):

```bash
npm install -g @xiaowuovo/lorekit
# the CLI command is `lorekit`
```

Or from source (for development / hacking on lorekit itself):

```bash
git clone https://github.com/GYF0311/lorekit.git ~/code/lorekit
cd ~/code/lorekit
npm install
npm run build
npm link   # puts the `lorekit` command on your global PATH
```

Either way, verify:

```bash
lorekit --version
# → 0.5.0

lorekit
# → prints the blue ASCII banner (no-arg invocation shows status)
```

---

## 3. Initialize a corpus

```bash
lorekit init ~/Desktop/my-corpus
cd ~/Desktop/my-corpus
lorekit doctor
```

If the target directory already has content, lorekit prompts:

```
⚠️  Detected 352 existing files in ~/Desktop/my-corpus

Choose:
  [1] Snapshot then init (recommended) — runs lorekit snapshot first
  [2] Init in place                   — keep existing files
  [3] Cancel
```

After init you have the full corpus skeleton (see README for layout), and `doctor` confirms the base CLI route is healthy.

---

## 4. Optional: add AI agent skills

The base corpus works without installing skills. Add them only when the user chooses a specific skill module; each one adds triggers and config the user must understand.

Keep the paths separate:

| Choice | Install command | Notes |
| --- | --- | --- |
| Default CLI-only | none | Stop after `lorekit doctor`; no skills installed |
| Claude Code workflow skills | `lorekit install-skills --target claude-code` | Installs project `wiki-*` workflows for Claude Code |
| Codex project workflows | `lorekit install-skills --target codex --mode copy` | Installs project `wiki-*`; no `corpus-*` or `wiki-daily` by default |
| Project-local research corpus | `lorekit install-skills --target project --mode copy` | Installs `wiki-*` into current `./skills/` and routes from `AGENTS.md` |
| Codex diary only | `lorekit install-skills --target codex --only wiki-daily --mode copy` | Requires `~/.config/lorekit/daily.json` |
| Central corpus entrypoints | `lorekit install-skills --target codex --only corpus-query,corpus-capture --mode copy` | Requires `global-corpus.json`; explicit cross-project topology |

### Agent workflow skills

Claude Code / Codex project workflows:

```bash
lorekit install-skills --target claude-code
lorekit install-skills --target codex --mode copy
# → installs wiki-* project workflows, not central corpus entrypoints
```

Restart the agent to pick skills up. These skills act on the current corpus/project: the agent should first read that project's `AGENTS.md` and then use native `wiki-*` workflows for durable writes.

Project-local research corpus:

```bash
cd ~/Desktop/my-research-corpus
lorekit install-skills --target project --mode copy
```

This writes `skills/wiki-*` into the current project. Add a short `AGENTS.md` route table for project/domain phrases, and delegate durable ingest/fileback to `wiki-ingest` / `wiki-fileback`.

Codex personal diary gateway:

```bash
lorekit install-skills --target codex --only wiki-daily --mode copy
```

Then create `~/.config/lorekit/daily.json` with your `default_corpus` and daily directory names. Use it in Codex with the shortest trigger:

```text
$wiki-daily 今天记一下：完成了一个重要的编程决策，原因是……
```

If you enable `notifications.channel: "lark"` in `daily.json`, scheduled compile / synthesis runs can send a bot DM only when fileback candidates need review. Copy the suggested confirmation sentence from Feishu / Lark back into a Codex conversation to approve specific candidates.

Central corpus entrypoints:

```bash
lorekit install-skills --target codex --only corpus-query,corpus-capture,corpus-ingest,corpus-fileback --mode copy
```

Then create `~/.config/lorekit/global-corpus.json`:

```json
{
  "default_corpus": "/ABSOLUTE/PATH/TO/CORPUS",
  "lorekit_bin": "/ABSOLUTE/PATH/TO/CORPUS/bin/lorekit",
  "workbench_inbox_dir": "_工作台/收件",
  "daily_inbox_dir": "_工作台/日记收件",
  "knowledge_dir": "知识库",
  "raw_dir": "原料",
  "output_dir": "输出",
  "corpora": {
    "总库": { "path": "/ABSOLUTE/PATH/TO/CORPUS", "aliases": ["总知识库", "主库"] },
    "项目库A": { "path": "/ABSOLUTE/PATH/TO/PROJECT-CORPUS", "aliases": ["A库"] }
  }
}
```

`corpora` is an optional multi-corpus registry: name any registered corpus in a query
("查一下 AI产品 库里的 …") and `corpus-query` routes to it; without a name it uses
`default_corpus`. Unregistered names are never guessed — the agent lists registered
corpora and asks.

Shortest use from any Codex project:

```text
$corpus-query 查一下我知识库里关于 agent skill 分层的内容。
$corpus-capture 先记到工作台：这个项目里出现了一个新的设计约束……
$corpus-fileback 确认把刚才第 2 条候选写入知识库。
```

Choose this module only when you intentionally maintain one configured corpus across projects. `corpus-*` skills are optional routers; corpus-local `wiki-*` skills remain the execution rules inside the target corpus.

Other agents should point their skill / rule system at `~/code/lorekit/skills/` or the current project's `skills/` directory.

### Project-local skills for research corpora

If you are building a research corpus for a course, product study, interview set, market scan, or client project, keep the skills local to that corpus:

```text
~/Desktop/my-corpus/skills/
```

Then keep only a short route table in `AGENTS.md` / `CLAUDE.md`. In Codex, these project-local skills usually do not appear in the `/` skill preview; Codex reads `AGENTS.md` first and loads `skills/<name>/SKILL.md` on demand.

Project/domain skills may add vocabulary, filing hints, acceptance checks, and route selection. They should not define a parallel ingest/fileback pipeline. Finished research packages flow through:

```text
_工作台/finished package -> 原料/ -> 知识库/ -> optional central corpus promotion
```

---

## 5. Sync and query the corpus

```bash
cd ~/Desktop/my-corpus
lorekit sync          # closeout: _INDEX.md → root index.md → doctor
lorekit search "…"    # exact text/entity search (durable layers)
lorekit search "…" --all  # second-tier recall: also 工作台/归档 (skips .wiki and 转写 noise)
```

`lorekit sync` is the standard entry point after durable corpus changes: new `原料/` imports, `知识库/` fileback, route/index changes, stage closeout, or commit/push verification. Do not run it after every `_工作台/` note, daily fragment, or temporary display artifact. It:

1. Recursively refreshes every `_INDEX.md` (via `lorekit index`)
2. Merges root `index.md` against disk while preserving human-written summaries
3. Runs `doctor` as a non-blocking sanity check

To close broken wikilinks, run `lorekit links suggest --file <page>` to scan a page for deterministic candidates, then apply each finding with `links fix`, `links stub`, `links backlog`, or `links plain` as the AI judges appropriate. Labels registered via `links backlog` are downgraded by lint and not counted as failures until the node is created.

Query route:

```bash
lorekit sync --json                         # machine-readable step report
lorekit sync --report                       # writes .wiki/reports/sync/<timestamp>.json
```

For answers, the agent uses `lorekit search`, `index.md`, relevant `_INDEX.md` files, then canonical pages under `知识库/`.

---

## 6. What Success Looks Like

The CLI-only default is ready once the same corpus can complete this loop:

```bash
lorekit init ~/Desktop/my-corpus
lorekit fetch <url>
# AI ingest compiles the fetched source into 知识库/
lorekit sync --json
lorekit snapshot
```

---

## 7. First conversation

```bash
cd ~/Desktop/my-corpus
claude  # or codex / cursor / kimi …
```

**Ingest an article:**

> Ingest this article: https://mp.weixin.qq.com/s/xxx

The agent triggers `wiki-ingest`: fetch → archive under `原料/文章/` → compile into `知识库/` → update `index.md` + `log.md` → trash the consumed `_工作台/收件/` original after verification.

**Query:**

> What's the difference between RAG and an LLM wiki?

Triggers `wiki-query`: run `lorekit search`, walk `index.md` → relevant `_INDEX.md` → specific files, then synthesize with citations.

**File back an insight:**

> Save that analysis into the knowledge base.

**Lint:**

> Check the corpus health.

**Backup:**

> Back up the corpus.

**Remove an outdated source:**

> Delete this article from the knowledge base.

The agent triggers `wiki-remove`. It must first run a dry-run:

```bash
lorekit remove "知识库/摘要/<slug>.md"
```

Review the impact report. If it looks right, apply:

```bash
lorekit remove "知识库/摘要/<slug>.md" --apply
```

`remove` creates a snapshot, moves the selected files to OS Trash / Recycle Bin, cleans only provenance-linked references, refreshes indexes, and runs lint. It does **not** delete other pages just because they share the same topic keyword.

---

## 8. Ingest pipeline cheat sheet

Every `lorekit fetch` writes a record to `<corpus>/.wiki/ingest-state.json` with `status: started, stepsDone: ['fetch']`. As the skill advances through the pipeline, it records each step:

```bash
lorekit ingest record <url> --step archive --archived-to 原料/文章/<slug>
lorekit ingest record <url> --step wiki --wiki-page 知识库/概念/<slug>.md
lorekit ingest record <url> --step lint     # auto-promotes to status=completed
```

Check what's in flight:

```bash
lorekit ingest pending      # non-completed records
lorekit ingest list         # everything
```

Re-fetching the same URL is a no-op by default:

```bash
lorekit fetch <url>
# → status: duplicate       (already completed)
# → status: in_progress     (was interrupted, shows next step to resume)

lorekit fetch <url> --force # ignore the check and re-fetch anyway
```

For corpora that predate this state store, back-fill once:

```bash
lorekit ingest reconcile --dry-run   # preview
lorekit ingest reconcile             # commit
```

---

## 9. Write three anchor cards

Give the agent some initial context:

### `知识库/实体/me.md`

Who you are, what you're working on, how you like to communicate.

### `知识库/实体/<current project>.md`

The project taking most of your time.

### `知识库/概念/<a concept>.md`

Something you've been thinking about. The agent mirrors this style when it generates new cards.

All three need frontmatter:

```yaml
---
type: entity
title: xxx
slug: 知识库/实体/xxx
created: 2026-04-17
updated: 2026-04-17
---
```

---

## 10. Obsidian graph filter (recommended)

If you plan to browse the corpus in Obsidian, `lorekit init` has already dropped a recommended filter into `.obsidian/graph.json`. It hides non-knowledge nodes so the graph actually looks like your knowledge, not your scaffolding:

- **excluded dirs**: `_工作台/` `_归档/` `反馈/` `系统/` `模板/`
- **excluded files**: `_INDEX` `index` `log`
- **kept root context**: `README` `AGENTS` `CLAUDE` `MEMORY`
- **kept**: `知识库/` (wiki) `原料/` (raw, heavily back-linked) `每日/` (daily notes) `写作/` (outgoing drafts)

If you initialized into a directory that already had `.obsidian/graph.json`, `lorekit init` left it untouched (to preserve your custom `colorGroups` / `forceGravity` / etc.). Copy this filter into **Graph view → Filters** manually:

```
-path:"_工作台" -path:"_归档" -path:"反馈" -path:"系统" -path:"模板" -file:"_INDEX" -file:"index" -file:"log"
```

Toggle the graph tab off/on after editing `graph.json` so Obsidian re-reads the file.

---

## 11. FAQ

**Skill didn't trigger?**
Check that `~/.claude/skills/wiki-*` exist. If they do, restart the Claude Code session.

**Where should I put the corpus?**
Prefer `~/Desktop/` or `~/Documents/`. Avoid cloud-synced folders when large snapshots or frequent generated files make the syncer noisy.

**Multiple corpora?**
The CLI follows `cwd`. `cd` into whichever corpus you want to operate on.

**Migrate existing notes?**

```bash
lorekit init ~/existing-notes
# → detects existing content and offers backup
```

**Update lorekit?**

npm install:

```bash
npm update -g @xiaowuovo/lorekit
```

Source install:

```bash
cd ~/code/lorekit
git pull
npm install
npm run build
# npm link is still valid — the symlink picks up the new build
```
