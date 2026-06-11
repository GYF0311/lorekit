/**
 * `系统/missing-nodes.md` —「待建节点 backlog」的 SSOT helper。
 *
 * 写入方：`lorekit links backlog`（登记）；
 * 读取方：`lorekit lint`（已登记 label 的断链降级为 backlogged，不计入失败）。
 * 建页后从表里删行，lint 恢复正常检测 —— 这就是 backlog 的闭环语义。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { todayYMDShanghai } from './date.js';

export const MISSING_NODES_REL = '系统/missing-nodes.md';

export function missingNodesPath(corpus: string): string {
  return join(corpus, MISSING_NODES_REL);
}

export function ensureMissingNodes(corpus: string): string {
  const p = missingNodesPath(corpus);
  if (existsSync(p)) return readFileSync(p, 'utf-8');
  const today = todayYMDShanghai();
  const header = [
    '---',
    'type: system',
    'title: Missing Nodes',
    'slug: 系统/missing-nodes',
    `created: ${today}`,
    `updated: ${today}`,
    'graph-excluded: true',
    '---',
    '',
    '# Missing Nodes（待建节点 backlog）',
    '',
    '> `lorekit links backlog` 自动维护。每行一个「该有但还没建」的知识节点。',
    '> 建页后请从本表删除对应行。',
    '',
    '| label | type | source | reason | added |',
    '| --- | --- | --- | --- | --- |',
    '',
  ].join('\n');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, header, 'utf-8');
  return header;
}

// 表格第一列的全部 label（跳过表头和分隔行）。
function parseLabels(content: string): string[] {
  const labels: string[] = [];
  const re = /^\|\s*([^|]+?)\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const cell = m[1].trim();
    if (cell === 'label' || /^-+$/.test(cell)) continue;
    if (cell) labels.push(cell);
  }
  return labels;
}

// missing-nodes.md 里是否已登记该 label（避免重复）。
export function backlogHasLabel(content: string, label: string): boolean {
  return parseLabels(content).includes(label);
}

// 读出全部已登记 label；文件不存在时返回空集。
export function readBacklogLabels(corpus: string): Set<string> {
  const p = missingNodesPath(corpus);
  if (!existsSync(p)) return new Set();
  try {
    return new Set(parseLabels(readFileSync(p, 'utf-8')));
  } catch {
    return new Set();
  }
}
