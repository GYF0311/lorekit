// 边界守卫 smoke：gbrain export --out 必须留在 .wiki/integrations/ 内。
// AGENTS.md L6 + DESIGN-NOTES §10 承诺"GBrain 只写 .wiki/integrations/"，
// 没边界校验则 `--out 知识库` 或绝对路径就能写穿 corpus。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

test('gbrain export --out 知识库 被拒（试图写出 .wiki/integrations 边界）', () => {
  const corpus = mkTmpDir('lorekit-smoke-gbrain-out-boundary-');
  try {
    const init = runLorekit(['init', '.'], { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

    const args = ['gbrain', 'export', '--out', '知识库'];
    const r = runLorekit(args, { cwd: corpus });

    assert.notEqual(r.status, 0, fmtRun(r, args, '越界 --out 必须拒'));
    const combined = r.stdout + r.stderr;
    assert.match(
      combined,
      /stay within \.wiki\/integrations/,
      fmtRun(r, args, '错误消息应解释边界'),
    );
    // 不应在 知识库/ 下出现 gbrain-export 子目录。
    assert.equal(
      existsSync(join(corpus, '知识库', 'gbrain-export')),
      false,
      fmtRun(r, args, '知识库/gbrain-export 不应被创建'),
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});

test('gbrain export --out /tmp/evil 绝对路径被拒', () => {
  const corpus = mkTmpDir('lorekit-smoke-gbrain-out-boundary-abs-');
  try {
    const init = runLorekit(['init', '.'], { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));

    const evilOut = '/tmp/lorekit-evil-' + Date.now();
    const args = ['gbrain', 'export', '--out', evilOut];
    const r = runLorekit(args, { cwd: corpus });

    assert.notEqual(r.status, 0, fmtRun(r, args, '绝对路径 --out 必须拒'));
    const combined = r.stdout + r.stderr;
    assert.match(
      combined,
      /stay within \.wiki\/integrations/,
      fmtRun(r, args, '错误消息应解释边界'),
    );
    assert.equal(
      existsSync(evilOut),
      false,
      fmtRun(r, args, '`/tmp/lorekit-evil-*` 不应被创建'),
    );
  } finally {
    cleanupTmpDir(corpus);
  }
});
