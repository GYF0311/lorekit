import { existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { alwaysExcludeDirNames, relPosix } from './paths.js';
import { collectMdFiles } from './corpus.js';

// 共享的 wikilink 解析层。lint、ingest check、links suggest 三处必须用同一套
// 解析语义，否则各造一套会出现 bug 漂移（见 issue #18：相对/嵌入图片被误报 broken）。
//
// 解析对齐 Obsidian：
//   1. 已有 markdown 语义：无扩展名 `[[Page]]` 按 vault 根 stem 或裸 basename（shortest-path）匹配，
//      并保留 `原料/.../xxx/article.md → [[原料/.../xxx]]` 文件夹包装。
//   2. Obsidian 相对 / 嵌入 / 素材语义：`![[feishu-assets/img.png]]` 这类链接优先按
//      **源文件所在目录**解析相对路径，再退回 vault 根，再退回 shortest-path basename，
//      并覆盖图片等非 .md 素材文件。
export interface WikiLinkIndex {
  // markdown stems（vault-root 相对、去 .md）+ 文件夹包装 stem
  stems: Set<string>;
  // markdown 裸 basename（去 .md）+ 文件夹包装 basename
  baseNames: Set<string>;
  // vault 内所有文件（含素材）的 vault-root 相对路径（含扩展名）
  allRelPaths: Set<string>;
  // vault 内所有文件的裸 basename（含扩展名），用于 shortest-path 素材匹配
  allBaseNames: Set<string>;
}

export function buildWikiLinkIndex(corpus: string, mdFiles?: string[]): WikiLinkIndex {
  const files = mdFiles ?? collectMdFiles(corpus);

  const stems = new Set<string>();
  const baseNames = new Set<string>();
  for (const file of files) {
    const rel = relPosix(corpus, file);
    const stem = rel.replace(/\.md$/, '');
    stems.add(stem);
    baseNames.add(stem.split('/').pop()!);
    // 文件夹包装式原料：`原料/文章/xxx/article.md` 的规范引用是 `[[原料/文章/xxx]]`
    if (stem.endsWith('/article')) {
      const folderStem = stem.replace(/\/article$/, '');
      stems.add(folderStem);
      baseNames.add(folderStem.split('/').pop()!);
    }
  }

  // 收集 vault 内全部文件（含 .png/.pdf 等素材），供相对路径 / 素材解析使用。
  const allRelPaths = new Set<string>();
  const allBaseNames = new Set<string>();
  if (existsSync(corpus)) {
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory()) {
          if (alwaysExcludeDirNames.has(entry.name)) continue;
          walk(join(d, entry.name));
        } else {
          allRelPaths.add(relPosix(corpus, join(d, entry.name)));
          allBaseNames.add(entry.name);
        }
      }
    };
    walk(corpus);
  }

  return { stems, baseNames, allRelPaths, allBaseNames };
}

// target：已剥掉 `#anchor` 与 `|alias` 的链接目标（如 `feishu-assets/img.png` 或 `张三`）。
// fromRel：源文件相对 vault 根的路径（含 .md）。返回 true 表示链接可解析（非 broken）。
export function resolveWikiLink(fromRel: string, target: string, index: WikiLinkIndex): boolean {
  // 1. 已有 markdown 语义（保持向后兼容）
  if (index.stems.has(target) || index.baseNames.has(target)) return true;

  // 2. Obsidian 相对 / 嵌入 / 素材语义
  const candidates = target.endsWith('.md') ? [target] : [target, `${target}.md`];
  const fromDir = dirname(fromRel);
  for (const cand of candidates) {
    // a. 相对源文件所在目录（join 会规范化 `./` 与 `../`；越界路径自然落空）
    const relToFile = fromDir === '.' ? cand : join(fromDir, cand);
    if (index.allRelPaths.has(relToFile)) return true;
    // b. vault 根（绝对式路径）
    if (index.allRelPaths.has(cand)) return true;
    // c. shortest-path：vault 内任意同名文件
    if (index.allBaseNames.has(basename(cand))) return true;
  }
  return false;
}
