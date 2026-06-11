# IDEAS.md — future ideas / backlog

> 这里放尚未承诺的想法。能进当前产品路线的，再拆成 issue / plan。

## Query UX

- 给 `lorekit search` 增加 `--json-array`，方便 agent 一次解析所有命中。
- 给 `lorekit search` 增加 `--dir <path>` 的 smoke 覆盖，确保跨平台路径边界稳定。
- 给 `wiki-query` 增加更明确的 query path summary 模板：search terms、读过的 `_INDEX.md`、最终引用页。

## Sync / Index

- `lorekit sync --json` 的 report 可补充 root index 每个受控区的 changed summary，便于 agent 做 closeout。
- `lorekit index` 可增加 `--check`，只报告哪些 `_INDEX.md` 会变化，不写文件。
- 为 root `index.md` 的受控区增加更清晰的 conflict warning：人类摘要保留，机器只增删条目。

## Doctor / Lint

- `doctor --json` 可增加 `severity` 字段，区分 hard failure、warning、optional integration warning。
- `lint --quick` 可输出更短的一行 summary，适合 fileback 后自检。
- 重复页检测先从标题/slug 相似度做起，避免引入额外运行时依赖。

## Fetch / Ingest

- fetch 的 duplicate report 可以显示对应 ingest state 和已归档路径，方便 agent 决定 resume 还是 force。
- ingest `record --complete` 可在缺关键 step 时给出具体缺口，而不是只失败。
- 微信 rich fetch fixture 继续积累，不把站点解析经验散落在聊天记录里。

## Remove / Safety

- `remove --apply --json` 的 report 可增加 `syncReportPath`，把安全删除和 closeout 证据串起来。
- 删除前的 dry-run 可以把 `Compiled Truth` 疑似影响按 confidence 排序，优先提醒最可能需要人工改写的段落。
- restore 可增加更友好的 "nothing changed" JSON 输出。

## Documentation

- README 保持产品介绍，INSTALLATION 负责安装组合，QUICKSTART 负责 30 分钟上手。
- 新增 docs 前先检查 `docs/CONVENTIONS.md` 的文档架构，避免两份永久文档回答同一个问题。
- 历史实现记录放 `docs/history/`，不要混进当前能力说明。
