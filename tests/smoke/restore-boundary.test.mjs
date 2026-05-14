// 边界守卫 smoke：恶意 snapshot 的 manifest entry.path 含 `..`，
// `lorekit restore` 必须拒绝，不能写出 corpus 父目录。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tar from 'tar';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

async function buildMaliciousSnapshot(stageDir, tarPath) {
  // 1) 在 stage 内造一个含 `..` 的 manifest，并放上一个对应的 payload 文件。
  //    payload 用 `..\/EVIL.md` 表示在 tar 解压时落到 stageDir 父级（攻击意图）。
  mkdirSync(join(stageDir, '.wiki', 'snapshots'), { recursive: true });
  const manifest = [
    {
      path: '../EVIL.md',
      sha256: 'deadbeef'.repeat(8),
      bytes: 5,
      mtime: '2026-05-14T00:00:00.000Z',
    },
  ];
  writeFileSync(
    join(stageDir, '.wiki', 'snapshots', 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );

  // 2) 打 tar.gz。注意：故意只把 manifest.json 放进去，
  //    EVIL.md 我们不放——本测试只需验证 lorekit 读 manifest 后拒绝越界，
  //    不需要 tar 自身的 `..` 解压行为（tar 包默认会被拒绝放父目录）。
  await tar.create(
    {
      gzip: true,
      file: tarPath,
      cwd: stageDir,
    },
    ['.wiki/snapshots/manifest.json'],
  );
}

test('restore 拒绝含 `..` 路径的 manifest entry', async () => {
  const corpus = mkTmpDir('lorekit-smoke-restore-boundary-');
  try {
    const initArgs = ['init', '.'];
    const init = runLorekit(initArgs, { cwd: corpus });
    assert.equal(init.status, 0, fmtRun(init, initArgs, 'init exit 0'));

    const stageDir = mkTmpDir('lorekit-smoke-restore-stage-');
    const tarPath = join(stageDir, 'evil.tar.gz');
    try {
      await buildMaliciousSnapshot(stageDir, tarPath);

      const args = ['restore', '--from', tarPath, '--dry-run'];
      const r = runLorekit(args, { cwd: corpus });
      // 边界违规走 exitCode = 1（runtime error），不是 0。
      assert.notEqual(r.status, 0, fmtRun(r, args, 'malicious manifest 必须被拒'));
      const combined = r.stdout + r.stderr;
      assert.match(
        combined,
        /outside corpus|EVIL\.md|\.\./,
        fmtRun(r, args, '错误消息应解释拒绝原因'),
      );
      // 父目录绝对不能出现 EVIL.md。
      // corpus 父就是 stageDir 同级的 tmpdir 兄弟之一——为稳妥起见用 path.dirname。
      const parent = join(corpus, '..');
      assert.equal(
        existsSync(join(parent, 'EVIL.md')),
        false,
        fmtRun(r, args, 'EVIL.md 不应写到 corpus 父目录'),
      );
    } finally {
      cleanupTmpDir(stageDir);
    }
  } finally {
    cleanupTmpDir(corpus);
  }
});
