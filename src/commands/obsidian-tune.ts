/**
 * obsidian-tune.ts — 老用户升级触达 + 维护 .obsidian/graph.json filter（批次 26）
 *
 * 三种模式：
 * - 默认：检查 filter 完整性，diff 输出到 stderr，exit 0/1 便于脚本判断
 * - --write：备份原文件后应用推荐 filter（先 cp .bak.<ts> 再覆盖）
 * - --print：把推荐 filter JSON 打到 stdout，便于 `lorekit obsidian-tune --print > .obsidian/graph.json`
 *
 * 推荐 filter SSOT 在 `templates/default-corpus/.obsidian/graph.json`，
 * 由 `lib/obsidian.ts` 统一读取（避免和模板漂移）。
 */
import type { Command } from 'commander';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ok, info, warn, err, print, out } from '../utils/logger.js';
import { findCorpus } from '../lib/corpus.js';
import {
  getRecommendedFilter,
  getRecommendedGraphConfig,
  readCorpusFilter,
  isFilterComplete,
  missingTokens,
} from '../lib/obsidian.js';
import { tsCompact } from '../lib/date.js';

interface TuneOpts {
  write?: boolean;
  print?: boolean;
}

function runPrint(): void {
  // 推荐 graph.json 完整体走 stdout（管道友好）
  const cfg = getRecommendedGraphConfig();
  out(JSON.stringify(cfg, null, 2));
}

function runCheck(corpus: string): number {
  const recommended = getRecommendedFilter();
  const cur = readCorpusFilter(corpus);

  if (!cur.exists) {
    warn('.obsidian/graph.json 缺失');
    print('');
    print('推荐 filter（含 _归档 / 反馈 + 完整根元数据）:');
    print(`  ${recommended}`);
    print('');
    print('应用：lorekit obsidian-tune --write');
    return 1;
  }

  if (isFilterComplete(cur.search, recommended)) {
    ok('.obsidian/graph.json filter 完整');
    return 0;
  }

  warn('.obsidian/graph.json filter 不完整');
  print('');
  print('当前 filter（如有）:');
  print(`  ${cur.search ?? '(空)'}`);
  print('');
  print('推荐 filter（含 _归档 / 反馈 + 完整根元数据）:');
  print(`  ${recommended}`);
  print('');
  print('缺少的 token:');
  for (const t of missingTokens(cur.search, recommended)) {
    print(`  - ${t}`);
  }
  print('');
  print('应用：lorekit obsidian-tune --write');
  return 1;
}

function runWrite(corpus: string): number {
  const dest = join(corpus, '.obsidian', 'graph.json');
  const destDir = join(corpus, '.obsidian');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  if (existsSync(dest)) {
    // 先备份再写 —— 红线：绝不许覆盖用户文件无备份
    const backup = `${dest}.bak.${tsCompact()}`;
    cpSync(dest, backup);
    ok(`备份 .obsidian/graph.json → ${backup}`);
  }

  // 直接落盘推荐配置（完整对象，不只是 search 字段）
  const cfg = getRecommendedGraphConfig();
  writeFileSync(dest, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
  ok('写入推荐 filter');
  info('请关掉 Obsidian「关系图谱」标签页再重开生效');
  return 0;
}

export function obsidianTuneCommand(program: Command) {
  program
    .command('obsidian-tune')
    .description('check / apply recommended Obsidian graph filter for the corpus')
    .option('--write', 'apply recommended filter (backs up existing graph.json first)')
    .option('--print', 'print recommended graph.json to stdout (pipe-friendly)')
    .action((opts: TuneOpts) => {
      // --print 不依赖 corpus，纯打印模板
      if (opts.print) {
        runPrint();
        process.exitCode = 0;
        return;
      }

      const corpus = findCorpus();
      if (!corpus) {
        err('not inside a corpus (no .wiki/ or CLAUDE.md found)');
        process.exitCode = 2;
        return;
      }

      if (opts.write) {
        process.exitCode = runWrite(corpus);
      } else {
        process.exitCode = runCheck(corpus);
      }
    });
}
