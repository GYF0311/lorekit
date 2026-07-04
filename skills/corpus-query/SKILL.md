---
name: corpus-query
description: 从任意项目跨库查询已注册的 LoreKit corpus：点名哪个库（总知识库/某个项目库）就路由哪个库，不点名默认总库。触发词：查总知识库、查我XX库、去XX知识库找。
---

# corpus-query

Optional read-only query gateway for registered Lorekit corpora. It routes a cross-project question to the named (or default) corpus, then follows that corpus's own rules.

## Config

Read:

`~/.config/lorekit/global-corpus.json`

Required:

- `default_corpus`
- `lorekit_bin` or `<default_corpus>/bin/lorekit`
- `knowledge_dir` (default `知识库`)

Optional:

- `output_dir`
- `corpora` — multi-corpus registry, enables querying **any** registered corpus by name:

```json
"corpora": {
  "总库":  { "path": "/path/to/corpus",       "aliases": ["总知识库", "主库"] },
  "AI产品": { "path": "/path/to/ai-corpus",    "aliases": ["AI产品工作集"] }
}
```

If the config is missing, ask for it. Do not guess the corpus path.

## Target resolution（先定库，再查询）

1. 用户**点名**了库（名称 / alias / 路径片段命中 `corpora` 注册表）→ 路由该库。
2. 用户没点名（"查总知识库"、"查我的知识库"）→ 用 `default_corpus`。
3. 点名了但注册表对不上 → 列出已注册库名让用户选，**不要猜路径**。
4. 问题其实属于**当前所在** corpus → 不走本 gateway，直接用当前库的 `wiki-query`。

CLI 一律优先目标库自带的 `<corpus>/bin/lorekit`；不存在时才用全局 `lorekit`（或配置里的 `lorekit_bin`，仅对 default_corpus 有效）。

## Boundary

This skill is an optional cross-project gateway. Target corpus rules remain authoritative.

Before answering, read the relevant local rules when available (`<corpus>` = the resolved target corpus):

- `<corpus>/AGENTS.md`
- `<corpus>/CLAUDE.md`
- `<corpus>/index.md`
- `<corpus>/skills/wiki-query/SKILL.md`

Read only what is needed. Do not bulk-load the corpus.

## Query Route

1. `cd <corpus>`（按 Target resolution 定出的库）.
2. For exact terms, run `<corpus>/bin/lorekit search "<q>"`.
3. Read `<corpus>/index.md`, then the relevant `_INDEX.md` files.
4. Read canonical pages under `知识库/` before answering.
5. 目标库没有相关内容时诚实说明；再按需提议：换另一个注册库查 / 联网检索 / 记一条 capture。

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
