---
name: wiki-daily
description: today journal, todo, programming decision, daily compile, rolling synthesis, weekly synthesis, fileback, candidate notification, Lark or Feishu reminder; global personal diary gateway for inbox-first daily notes and confirmed knowledge writeback.
---

# wiki-daily

个人日记入口 skill。用于把当天想法、待办、编程决策、复盘素材先写成 inbox fragments，再按确认程度进入日编译、滚动综合、周综合或 fileback。

这是 instruction-only skill：不依赖脚本，不提供额外 references，不创建额外 skill docs。

## Central config

读取 `~/.config/lorekit/daily.json`。建议字段：

```json
{
  "default_corpus": "/ABSOLUTE/PATH/TO/CORPUS",
  "daily_inbox_dir": "_工作台/日记收件",
  "daily_archive_dir": "_归档/日记收件",
  "daily_dir": "每日",
  "knowledge_dir": "知识库",
  "output_dir": "输出/复盘",
  "journal_day_boundary": "04:00",
  "timezone": "Asia/Shanghai",
  "notifications": {
    "enabled": false,
    "channel": "lark",
    "lark_user_id": "ou_xxx",
    "send_on": [
      "daily_compile_candidates",
      "rolling_synthesis_candidates",
      "weekly_synthesis_candidates"
    ]
  }
}
```

若配置缺失，先让用户确认 `default_corpus`，不要猜测写入位置。其他字段可按上面默认值解释，但写入前仍要明确目标路径。

## Date rule

- `captured_at`：真实捕获时间，使用 `timezone` 中的本地时间，精确到分钟或秒。
- `journal_date`：归属日，按 `journal_day_boundary` 计算。
- 默认边界是 04:00；`00:00` 到 `03:59` 捕获的内容属于前一个 `journal_date`。
- 如果用户明确说"算新的一天"、"写到今天"，按用户指定覆盖边界规则。

## Fragment path

append / plan / review 都只创建 inbox fragment：

```text
<default_corpus>/<daily_inbox_dir>/<journal_date>/<captured_at>-<slug>.md
```

fragment frontmatter 至少包含：

```yaml
type: daily-entry
journal_date: YYYY-MM-DD
captured_at: YYYY-MM-DDTHH:mm:ss+08:00
source_project: <repo-or-project-name-or-null>
source_context: <short-context-or-null>
source_git_branch: <branch-or-null>
source_git_commit: <commit-or-null>
entry_type: append | plan | evening_review | project_decision | daily_compile | rolling_synthesis | weekly_synthesis
status: inbox
privacy: normal
related:
  - <optional-topic>
```

`source_project` / `source_context` / `source_git_branch` / `source_git_commit` 用来保留当时上下文。能从当前 repo 读到就填；读不到就写 `null`，不要为填字段而扩大读取范围。

## Concept linking and fileback threshold

- 日记和综合报告应该轻量链接已有 `知识库/` 页面，例如项目、概念、人物、工具和长期决策页。
- 只出现一次的内容先留在 `每日/` 或 `output_dir`，不要急着入库。
- 最近 3 天或 7 天反复出现、影响项目决策、解释稳定行为模式、或能连接已有知识页的内容，应进入 `Suggested fileback candidates`。
- 高重复、高价值候选可以在交互式会话里继续进入 Fileback；无人值守 automation 只生成候选，等待用户确认。

## Candidate notifications

如果 `notifications.enabled` 为 `true`，daily compile / rolling synthesis / weekly synthesis 发现 `Suggested fileback candidates` 后，应发送一条提醒，而不是静默等待用户翻 Obsidian。

提醒规则：

- 只在存在候选时发送；无候选不打扰。
- 默认使用飞书 / Lark bot 私聊；命令形态为 `lark-cli im +messages-send --as bot --user-id <lark_user_id> --markdown <message>`。
- 不使用 user 身份发送。
- 提醒只包含来源路径、候选编号、候选短摘要和可复制到 Codex 的确认句；不要发送整段日记原文。
- 飞书回复本身不触发 fileback。用户会把提醒复制回 Codex 新对话，再明确确认第几条候选写入 `知识库/`。
- 如果 `lark-cli` 不存在、发送失败或缺少 `lark_user_id`，不要阻塞 compile / synthesis；在最终报告里说明提醒未发送。

提醒模板：

```markdown
wiki-daily 有候选需要确认

来源：<report-or-daily-path>
候选：
1. <candidate summary>
2. <candidate summary>

复制到 Codex 确认：
使用 $wiki-daily，确认把 <source path> 里的第 1、2 条候选写入知识库。
```

## Modes

### Append

触发：今天记一下、journal、随手记、灵感、事实、情绪、观察。

动作：

1. 计算 `journal_date` 和 `captured_at`。
2. 生成短 slug。
3. 在 inbox fragment 里保留用户原话和必要的轻量整理。
4. 不写 `每日/`，不写 `知识库/`，不删除旧 fragment。

### Plan

触发：todo、计划、明天要做、今天安排、morning plan。

动作：

1. 只创建 `entry_type: plan` 的 inbox fragment。
2. 用简短 checklist 表达任务、约束和优先级。
3. 不自动改项目 TODO、issue、日记正式页或知识库。

### Review

触发：复盘、晚间回顾、今天怎么样、decision log、programming decision。

动作：

1. 只创建 `entry_type: evening_review` 或 `entry_type: project_decision` 的 inbox fragment。
2. 区分事实、判断、情绪、待验证问题和后续动作。
3. 编程决策要记录项目、分支、commit、为什么这么定、替代方案和风险。

### Compile

触发：daily compile、整理今天、生成今日复盘。

动作：

1. 读取指定 `journal_date` 的 inbox fragments。
2. 生成或更新 `daily_dir` 下的日记草稿或日记页。
3. 可把已纳入的 fragment 标记为 `status: merged` 或移动到 `daily_archive_dir`。
4. **compile 不写 `知识库/`**；它只整理每日材料。
5. 如果生成 Fileback candidates 且通知已启用，发送候选提醒。
6. 永远不删除 fragments；只能 archive 或 mark merged。

### Rolling synthesis

触发：rolling synthesis、滚动综合、最近几天总结、连续复盘。

动作：

1. 汇总多个 `journal_date` 的 daily pages 或 fragments。
2. 读取并链接相关 `知识库/` 页面，区分已有知识、重复信号和新候选。
3. 输出到 `output_dir` 或 `daily_dir` 中的滚动总结草稿。
4. 标注哪些结论只是趋势、哪些需要继续观察。
5. 对最近 3 天反复出现且有长期价值的内容生成 `Suggested fileback candidates`。
6. 如果生成候选且通知已启用，发送候选提醒。
7. 无人值守运行不写 `知识库/`；交互式会话里，用户明确确认后可以继续 Fileback。

### Weekly synthesis

触发：weekly synthesis、周总结、这周复盘。

动作：

1. 汇总本周 daily pages、fragments 和 rolling synthesis。
2. 读取并链接相关 `知识库/` 页面，把本周行动和已有项目、职业、概念、决策页连接起来。
3. 输出周总结草稿到 `output_dir` 或 `daily_dir`。
4. 明确列出关键决策、完成事项、未完成事项、模式变化和下周候选重点。
5. 对最近 7 天反复出现且能复用的判断生成 `Suggested fileback candidates`。
6. 如果生成候选且通知已启用，发送候选提醒。
7. 无人值守运行不写 `知识库/`；交互式会话里，用户明确确认后可以继续 Fileback。

### Fileback

触发：fileback、写回知识库、沉淀到知识库、把这个变成长期知识。

动作：

1. 先明确要写回的具体结论、目标页或主语。
2. 向用户确认：`确认把这些内容写入 <knowledge_dir> 吗？`
3. 只有得到明确确认后，才走 `wiki-fileback` 或相同的 Timeline / synthesis 写回规则。
4. 写回后保留 fragment；只能标记 `status: filed_back` 或归档，不能删除。

## Safety rules

- append / plan / review 只能创建 inbox fragments。
- compile / rolling synthesis / weekly synthesis 不在无人值守时写 `知识库/`；它们应生成链接和候选，用户确认后再进入 Fileback。
- fileback 必须有用户明确确认。
- candidate notification 只是提醒；不能把飞书发送或飞书回复视为写库确认。
- 永远不要删除 fragments；只允许 archive 或 mark merged / filed_back。
- 不确定日期、corpus 或写回目标时先问用户。
- 不要把日记草稿冒充成长期知识；长期知识必须经过 fileback 确认。
