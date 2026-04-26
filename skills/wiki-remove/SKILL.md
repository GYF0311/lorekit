---
name: wiki-remove
description: 安全移除过时或不想保留的知识来源/页面，先 dry-run 影响报告，再确认 apply 移入系统回收站。触发词：删除这篇、移除知识、过时不要了、remove、trash、丢到回收站。
---

# wiki-remove

安全移除 corpus 中的一篇来源或知识页。删除语义是**移动到系统回收站**，不是永久删除；级联范围只按来源归因清理，不按关键词删除同主题其他知识。

## When to trigger

- 用户说"删除这篇"、"移除这个知识"、"这篇过时了不要了"
- 用户说"remove"、"trash"、"丢到回收站"
- 用户给出 URL、`原料/...`、`知识库/摘要/...` 或其他 wiki 页路径并要求删除

**不要触发**：

- 只是标记过时、不想删除文件 → 建议改 `status: archived`
- 要整理/合并重复页 → 先 `wiki-lint` 或 `wiki-audit`
- 要删除外部网站内容 → lorekit 只能移除本地 corpus 内容

## Workflow

### 1. 先生成影响报告

永远先跑 dry-run：

```bash
lorekit remove "<target>"
```

报告会列出：

- 将移动到系统回收站的文件/目录
- 将修改的页面（Timeline 行、frontmatter `sources`、`source_count`）
- `Compiled Truth` 中疑似依赖该来源、需要人工复核的段落

### 2. 向用户确认

把报告摘要给用户，明确说明：

- 删除会进入系统回收站，可恢复
- 只会移除这篇来源贡献的信息
- 同主题其他来源（例如其他 harness 文章）不会被删除
- `Compiled Truth` 不会自动改写，只报告疑似影响

### 3. 用户确认后执行

```bash
lorekit remove "<target>" --apply
```

`--apply` 会：

1. 先创建 snapshot
2. 移除明确来源贡献的登记
3. 把目标文件/目录移动到系统回收站
4. 刷新 `index.md` / `_INDEX.md`
5. 同步向量库（若已存在）
6. 跑 lint 报告

## Output format

```
remove 影响报告：
  - 回收站：N 项
  - 修改页面：N 页
  - 人工复核：N 段 Compiled Truth

确认后我再执行：
  lorekit remove "<target>" --apply
```

执行后：

```
已移入系统回收站：
  - <path>

snapshot：<path>
sync：完成
lint：<N> issue(s)
```

## 铁律

1. 不用 `rm`，不做永久删除。
2. 不按关键词级联删除，只按明确来源 wikilink / `sources` 归因清理。
3. 删除某篇 harness 文章时，不能删除其他 harness 来源支撑的 `harness` 概念页。
4. `Compiled Truth` 缺少精确来源标记时，只报告疑似影响，不自动改写。
