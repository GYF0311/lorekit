/**
 * Smoke: rrfMerge dedup (批次 23b 修，前 80 字 collision 错误合并 → sha256 前 16 hex)
 *
 * 不走 dist/cli.js 子进程：rrfMerge 是 vectordb 内部函数没有 cli 入口直接暴露，
 * 直接复制函数体 inline 跑（同 22 系列 parity 脚本模式）。**这个 inline 复制
 * 必须随 src/lib/vectordb/query-hybrid.ts 的 rrfMerge 实现保持一致**——以后改
 * 实现要同步改这里，否则 smoke 失去 lock 作用。
 *
 * 锁定的两条行为：
 * - **不同 chunk 即使前 80 字相同也保持独立**（22d B6 case 复现的 bug 已修）
 * - **完全相同的 chunk 应该被 dedup**（rrf 累加，作为 dedup 仍可用的证明）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// inline copy: src/lib/vectordb/query-hybrid.ts rrfMerge (23b 修后版本)
function rrfMerge(lists, topK, k = 60) {
  const merged = new Map();
  for (const list of lists) {
    list.forEach((item, i) => {
      const fingerprint = createHash('sha256').update(item.chunk).digest('hex').slice(0, 16);
      const key = `${item.file}::${fingerprint}`;
      const rrf = 1 / (k + i + 1);
      const prev = merged.get(key);
      if (prev) prev.rrf += rrf;
      else merged.set(key, { item, rrf });
    });
  }
  return [...merged.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK)
    .map(({ item, rrf }) => ({ ...item, score: Math.round(rrf * 10000) / 10000 }));
}

const mk = (file, chunk, section = 'X') => ({ file, chunk, score: 0, section });

test('rrfMerge: 前 80 字相同但全文不同的 chunks 不被合并 (23b 修复 22d B6)', () => {
  // 两个 chunk 前 80 字都是 80 个 X（中文长文档段首固定开场白场景），尾巴不同
  const chunk1 = 'X'.repeat(80) + ' tail-A real different content';
  const chunk2 = 'X'.repeat(80) + ' tail-B another different content';
  const r = rrfMerge([
    [mk('知识库/a.md', chunk1)],
    [mk('知识库/a.md', chunk2)],
  ], 5);
  assert.equal(r.length, 2, '两个真实不同的 chunk 应保留为独立 item');
  // 每个 rank 1 单路命中：rrf = 1/(60+0+1) = 0.0164
  assert.equal(r[0].score, 0.0164);
  assert.equal(r[1].score, 0.0164);
  // 验证两个 chunk 的内容都在结果里
  const chunks = new Set(r.map(x => x.chunk));
  assert.ok(chunks.has(chunk1), 'chunk1 应在结果');
  assert.ok(chunks.has(chunk2), 'chunk2 应在结果');
});

test('rrfMerge: 完全相同的 chunk 仍被合并 (dedup 功能未失效)', () => {
  const chunk = '同一份内容，跨两路召回应该合并 rrf 累加';
  const r = rrfMerge([
    [mk('知识库/a.md', chunk)], // 路 1 rank 1
    [mk('知识库/a.md', chunk)], // 路 2 rank 1
  ], 5);
  assert.equal(r.length, 1, '相同 chunk 应合并为 1 条');
  // 两路都 rank 1: rrf = 2 * 1/(60+0+1) ≈ 0.0328
  assert.equal(r[0].score, 0.0328);
});

test('rrfMerge: 不同 file 但相同 chunk 内容仍独立 (key 含 file)', () => {
  const chunk = '某条引言被多处引用，但归属不同文档';
  const r = rrfMerge([
    [mk('知识库/a.md', chunk), mk('知识库/b.md', chunk)],
  ], 5);
  assert.equal(r.length, 2, '不同 file 视为独立 item，即便 chunk 完全相同');
});
