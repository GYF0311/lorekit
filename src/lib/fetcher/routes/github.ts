/**
 * fetcher/routes/github.ts — GitHub repo / blob 抓取（README.md 或具体文件）
 *
 * 批次 21f strangler fig 第六步：从 src/lib/fetcher.ts copy 出 parseGithubRepoUrl
 * + fetchGithubDoc。原 fetcher.ts 同名函数仍保留，commands/*.ts 暂未切换；
 * 本文件目前未被任何调用方 import，仅作旁路。21g 才切换 dispatcher 并删旧。
 *
 * 集成 21b 的 buildFrontmatter，routeKind='github'：
 * - 21b 已验证 github routeKind 强制忽略 publishDate（即使传入也不输出）
 * - 原 fetchGithubDoc 本来就不抽 publishDate，调用时不传该字段，行为等价
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildFrontmatter } from '../frontmatter.js';
import { slugify, todayYMD } from '../helpers.js';
import { buildHeaders } from '../http.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * inline 定义，与 fetcher.ts:16-46 FetchResult 字段、可选性、注释完全一致。
 * 21g 收尾时再决定是否上提到共享 types 模块。
 */
export interface FetchResult {
  status: 'ok' | 'error' | 'unsupported' | 'duplicate';
  route: string;
  url: string;
  title?: string;
  author?: string;
  publishDate?: string; // YYYY-MM-DD, Asia/Shanghai
  sourceKind?: string; // clipping | article | ...
  sourceLayer?: string;
  slug?: string;
  markdown?: string;
  assetsDir?: string;
  imagesOk?: number;
  imagesFailed?: number;
  suggest?: string;
  reason?: string;
  duplicate?: {
    path: string;
    sourceDate?: string;
    title?: string;
  };
}

interface GithubRepoRef {
  owner: string;
  repo: string;
  ref: string; // HEAD / branch / commit
  subpath?: string; // 具体文件路径，如 "docs/foo.md"
}

// ---------------------------------------------------------------------------
// parseGithubRepoUrl
// ---------------------------------------------------------------------------

/**
 * 校验并解析 github URL。仅接受 `github.com` / `www.github.com`，
 * 路径需含 `/<owner>/<repo>` 至少两段。支持 `/blob/<ref>/<subpath>` 与 `/tree/<ref>`。
 * 其余返回 null。
 */
export function parseGithubRepoUrl(url: string): GithubRepoRef | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, rawRepo, ...rest] = parts;
    const repo = rawRepo.replace(/\.git$/, '');

    if (rest.length === 0) {
      return { owner, repo, ref: 'HEAD' };
    }
    if (rest[0] === 'blob' && rest.length >= 3) {
      return { owner, repo, ref: rest[1], subpath: rest.slice(2).join('/') };
    }
    if (rest[0] === 'tree' && rest.length >= 2) {
      return { owner, repo, ref: rest[1] };
    }
    return { owner, repo, ref: 'HEAD' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchGithubDoc 主流程
// ---------------------------------------------------------------------------

/**
 * github 抓取流程：
 * 1. 校验 URL
 * 2. 子路径模式：直接拼 raw URL；仓库根模式：循环试 5 个常见 README 文件名
 * 3. 第一个 HTTP 200 + 正文 > 20 字符 的胜出
 * 4. 拼 frontmatter（用 21b buildFrontmatter）+ 可选 H1 + `> Fetched from:` 注解 + 正文
 * 5. 写到 outRoot/<slug>.md
 *
 * 失败路径返回 `{status:'error', reason:...}`，由调用方决定是否兜底。
 */
export async function fetchGithubDoc(url: string, outRoot: string): Promise<FetchResult> {
  const parsed = parseGithubRepoUrl(url);
  if (!parsed) {
    return { status: 'error', route: 'github', url, reason: 'invalid_github_url' };
  }

  const { owner, repo, ref, subpath } = parsed;
  const headers = buildHeaders('generic');

  // 确定候选 raw URL 列表
  const candidates: string[] = [];
  if (subpath) {
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${subpath}`);
  } else {
    // 仓库根：尝试常见 README 文件名
    for (const name of ['README.md', 'README.MD', 'Readme.md', 'readme.md', 'README']) {
      candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${name}`);
    }
  }

  let content = '';
  let chosenUrl = '';
  for (const candUrl of candidates) {
    try {
      const res = await fetch(candUrl, { headers });
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.trim().length > 20) {
        content = text;
        chosenUrl = candUrl;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!content) {
    return { status: 'error', route: 'github', url, reason: 'no_readable_content_found' };
  }

  const fileName = subpath ? subpath.split('/').pop()! : 'README.md';
  const title = subpath ? fileName.replace(/\.(md|markdown)$/i, '') : `${owner}/${repo}`;

  const slug = slugify(subpath ? `${owner}-${repo}-${fileName}` : `${owner}-${repo}`);
  await mkdir(outRoot, { recursive: true });

  const today = todayYMD();
  const hasH1 = /^#\s+/m.test(content);
  // 21b buildFrontmatter routeKind='github' 强制忽略 publishDate（21b parity case 6 已验证），
  // 不传该字段即可。返回行数组与原 fetcher.ts:826-834 内嵌 fmLines 块 byte-level 等价。
  const fmLines: string[] = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: 'github',
      title,
      today,
      url,
      author: owner,
    }),
  );
  fmLines.push('');
  if (!hasH1) fmLines.push(`# ${title}`, '');
  fmLines.push(`> Fetched from: ${chosenUrl}`, '');
  fmLines.push(content.trim(), '');

  const articlePath = join(outRoot, `${slug}.md`);
  await writeFile(articlePath, fmLines.join('\n'), 'utf-8');

  return {
    status: 'ok',
    route: 'github',
    url,
    title,
    author: owner,
    sourceKind: 'github',
    sourceLayer: 'L1',
    slug,
    markdown: articlePath,
    imagesOk: 0,
    imagesFailed: 0,
  };
}
