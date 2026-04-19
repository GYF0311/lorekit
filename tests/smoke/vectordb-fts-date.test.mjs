/**
 * Smoke: sanitizeFtsQuery 日期保留 (批次 23b 修，`-` 拆 token 让 ISO 日期退化为 `2026`)
 *
 * 同 vectordb-rrf-dedup smoke：sanitizeFtsQuery 是 vectordb 内部 helper 没有 cli
 * 入口直接暴露，inline copy 函数体 lock 行为。修 src/lib/vectordb/query-bm25.ts
 * 时记得同步改这里。
 *
 * 锁定的两条行为：
 * - **完整 ISO 日期 `\d{4}-\d{2}-\d{2}` 保留为 quoted phrase token**（不再退化为 `2026`）
 * - **行内 hyphenated 词如 `self-hosted` 仍按原 sanitize 拆**（不被误识别为日期）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// inline copy: src/lib/vectordb/query-bm25.ts sanitizeFtsQuery (23b 修后版本)
function sanitizeFtsQuery(q) {
  // 1. protect ISO dates
  const dates = [];
  let protectedQ = q.replace(/\d{4}-\d{2}-\d{2}/g, (m) => {
    const i = dates.length;
    dates.push(m);
    return ` __DATE${i}__ `;
  });

  // 2. 现有 sanitize 流程
  let s = protectedQ.replace(/["*:^()\-+]/g, ' ');
  s = s.replace(/\b(OR|AND|NOT|NEAR)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const tokens = s.split(' ').filter((t) => t.length >= 3);
  if (tokens.length === 0) return '';

  // 3. 还原占位符为 quoted 完整日期
  const restored = tokens.map((t) => {
    const m = t.match(/^__DATE(\d+)__$/);
    return m ? `"${dates[Number(m[1])]}"` : t;
  });
  return restored.join(' ');
}

test('sanitizeFtsQuery: ISO 日期 \\d{4}-\\d{2}-\\d{2} 保留为 quoted phrase (23b 修复)', () => {
  const result = sanitizeFtsQuery('重要事件 2026-04-15 发生了');
  // 验证完整日期出现，且被双引号包裹
  assert.ok(result.includes('"2026-04-15"'),
    `期望含 quoted "2026-04-15"，实际: ${result}`);
  // 不应出现裸的 2026 / 04 / 15 token（被占位符吞了）
  assert.ok(!/\b2026\b/.test(result.replace(/"2026-04-15"/g, '')),
    `不应有裸 2026 token，实际: ${result}`);
});

test('sanitizeFtsQuery: 行内 hyphenated 词 self-hosted 不被识别为日期，按原 sanitize 拆', () => {
  const result = sanitizeFtsQuery('self-hosted server setup');
  // self-hosted 不匹配 \d{4}-\d{2}-\d{2}，按原 - 拆字符流程：
  //   `self hosted server setup` → tokens = [self(< 3? no, 4 字符), hosted, server, setup]
  // self / hosted / server / setup 都 ≥ 3 字符全保留
  assert.equal(result, 'self hosted server setup',
    `期望 'self hosted server setup'，实际: ${result}`);
  // 关键：不应出现 quoted phrase（因为不是日期）
  assert.ok(!result.includes('"'),
    `非日期不应被 quote，实际: ${result}`);
});

test('sanitizeFtsQuery: 多日期 + 普通文本混合', () => {
  const result = sanitizeFtsQuery('2026-04-15 与 2026-05-20 之间发生');
  assert.ok(result.includes('"2026-04-15"'), `应含第一日期，实际: ${result}`);
  assert.ok(result.includes('"2026-05-20"'), `应含第二日期，实际: ${result}`);
});

test('sanitizeFtsQuery: 非标准日期 2026-4-15 不识别（不补 0）', () => {
  // \d{4}-\d{2}-\d{2} 严格 4-2-2 位数字，单数月日不算
  const result = sanitizeFtsQuery('日期 2026-4-15 测试');
  // 不被识别为日期 → 走原 sanitize: - 替换为空格 → tokens [日期, 2026, 测试]（4/15 < 3 字符过滤）
  // 关键：不出现 quoted phrase
  assert.ok(!result.includes('"2026-4-15"'),
    `不应识别为日期被 quote，实际: ${result}`);
  assert.ok(result.includes('2026'),
    `应含 2026 散 token，实际: ${result}`);
});
