---
name: wiki-audit
description: 【知识库审阅】处理人类反馈，修正 wiki 内容 | Process human feedback on wiki content, apply corrections
---

# wiki-audit

处理 corpus 中的人类反馈条目（`反馈/待处理/*.md`），逐条审阅、修正目标页面、归档已处理反馈。

## When to trigger

- 用户说"处理反馈"、"review audit"、"check feedback"
- `lorekit audit --list --open` 显示有待处理条目
- 用户说"看看有什么需要改的"、"审阅知识库"

**不要触发**：

- 用户只是提一个新反馈 → 直接 `lorekit audit --create ...`
- 查询已有内容 → `wiki-query`

## Tools to use

- `lorekit audit --list --open` — 列出待处理反馈
- `lorekit audit --list --resolved` — 列出已处理反馈
- `lorekit audit --create --target <file> --severity <info|suggest|warn|error> --text "..."` — 新建反馈
- `lorekit lint --quick` — 修改后自检
- 底层：Read / Edit / `mv`

## Workflow

### 列出待处理

1. 运行 `lorekit audit --list --open`
2. 展示给用户，按 severity 排序（error → warn → suggest → info）
3. 问用户要处理哪条，或逐条处理

### 处理单条反馈

1. **读 audit 文件**：`Read` 反馈/待处理/xxx.md，理解反馈内容
2. **读 target 文件**：`Read` audit frontmatter 里 `target` 指向的 wiki 页面
3. **理解反馈意图**：对照反馈文本和 target 内容，确定修改方案
4. **修改 target**：
   - 事实性修正 → 改 `## Compiled Truth`
   - 补充信息 → 追加 `## Timeline` 条目
   - 结构调整 → 按 filing-rules 重组
5. **刷新 target 的 `updated` 字段**：frontmatter 中 `updated: YYYY-MM-DD`
6. **移动 audit 文件**：`mv 反馈/待处理/xxx.md 反馈/已处理/xxx.md`
7. **追加 resolution**：在 audit 文件末尾追加：
   ```
   ---
   ## Resolution
   - 处理时间：YYYY-MM-DD HH:mm
   - 操作：修改了 xxx
   - 结果：已修正/已驳回/部分采纳
   ```
8. **自检**：`lorekit lint --quick`
9. **汇报**（见 Output format）

### 批量处理

1. `lorekit audit --list --open` 获取全部待处理
2. 逐条按上述流程处理
3. **每条处理完展示差异让用户确认**，再进行下一条
4. 全部完成后汇总报告

### 驳回反馈

如果反馈不合理或已过时：

1. 移动到 `反馈/已处理/`
2. Resolution 中标注"已驳回"并说明原因
3. **不修改 target 文件**

## Output format

```
审阅反馈：反馈/待处理/20260416-100000-xxx.md
  severity: error
  target:   知识库/实体/xxx.md
  反馈内容：xxx
  处理方式：修正了 Compiled Truth 中的 xxx
  结果：已修正
  lint：PASS
```

批量处理完后汇总：

```
本轮处理 N 条反馈：
  - 已修正：X 条
  - 已驳回：Y 条
  - 部分采纳：Z 条
```
