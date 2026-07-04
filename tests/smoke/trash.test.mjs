// `lorekit trash`：跨平台可恢复删除的边界语义。
// corpus 内工作台文件可 trash；原料/知识库/.wiki/corpus 外一律拒绝。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runLorekit, mkTmpDir, cleanupTmpDir, fmtRun } from './_util.mjs';

let corpus;

function writeAt(rel) {
  const abs = join(corpus, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, `内容 ${rel}`, 'utf-8');
  return abs;
}

beforeEach(() => {
  corpus = mkTmpDir('lorekit-trash-');
  const init = runLorekit(['init', '.'], { cwd: corpus });
  assert.equal(init.status, 0, fmtRun(init, ['init', '.'], 'init exit 0'));
});

afterEach(() => cleanupTmpDir(corpus));

test('工作台文件可 trash，文件从磁盘消失', () => {
  const abs = writeAt('_工作台/收件/废稿.md');
  const run = runLorekit(['trash', '_工作台/收件/废稿.md'], { cwd: corpus });
  assert.equal(run.status, 0, fmtRun(run, ['trash'], 'exit 0'));
  assert.equal(existsSync(abs), false, 'file should be moved off disk');
});

test('原料/ 拒绝 trash（只读红线）', () => {
  writeAt('原料/文章/来源.md');
  const run = runLorekit(['trash', '原料/文章/来源.md'], { cwd: corpus });
  assert.equal(run.status, 2, fmtRun(run, ['trash'], 'exit 2'));
  assert.equal(existsSync(join(corpus, '原料/文章/来源.md')), true);
});

test('知识库/ 拒绝并提示走 lorekit remove', () => {
  writeAt('知识库/概念/某页.md');
  const run = runLorekit(['trash', '知识库/概念/某页.md'], { cwd: corpus });
  assert.equal(run.status, 2, fmtRun(run, ['trash'], 'exit 2'));
  assert.match(String(run.stderr), /remove/);
});

test('corpus 外路径拒绝', () => {
  const run = runLorekit(['trash', '../外面的文件.md'], { cwd: corpus });
  assert.equal(run.status, 2, fmtRun(run, ['trash'], 'exit 2'));
});

test('不存在的路径 exit 2', () => {
  const run = runLorekit(['trash', '_工作台/不存在.md'], { cwd: corpus });
  assert.equal(run.status, 2, fmtRun(run, ['trash'], 'exit 2'));
});
