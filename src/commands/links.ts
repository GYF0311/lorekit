/**
 * `lorekit links` — links closure（断链闭环）子命令组。
 *
 * 知识库靠 `[[wikilink]]` 织成图谱。新建 / 改 wiki 页后，指向「还不存在节点」的
 * 链接需要逐条「了结」，否则死链漏到 sync / lint 阶段污染健康信号（见 issue #18）。
 *
 * 产品边界（AGENTS Rule 5）：CLI 只做**确定性、可重复**的文件 / 状态动作；
 * 「某条断链该 fix / stub / backlog / plain」的语义判断留给 skill 层 AI。
 *
 *   suggest  只读：扫一个页的断链 + 给确定性候选（不替 AI 决策处置方式）
 *   fix      改写 `[[label]]` → `[[canonical]]`，可选把别名登记进 canonical 页 frontmatter
 *   stub     建占位页 `知识库/<type>/<label>.md`，让 `[[label]]` 立即可解析
 *   backlog  把「待建节点」登记进 `系统/missing-nodes.md`（lint 对已登记 label 降噪）
 *   plain    把 `[[label]]` 降级为纯文本（记台账，目标页建好后 `plained` 提醒重连）
 *   plained  只读：列 plain 台账；目标页已存在的标 revivable，已重连的自动清出
 */
import type { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { requireCorpus, collectMdFiles } from '../lib/corpus.js';
import { buildWikiLinkIndex, resolveWikiLink, type WikiLinkIndex } from '../lib/wikilinks.js';
import {
  MISSING_NODES_REL,
  ensureMissingNodes,
  missingNodesPath,
  backlogHasLabel,
} from '../lib/missing-nodes.js';
import { todayYMDShanghai } from '../lib/date.js';
import { out, print, ok, bad, warn } from '../utils/logger.js';

type NodeType = 'concept' | 'entity';

// type → 知识库目录（见 templates/default-corpus/系统/frontmatter-spec.md）
const TYPE_DIR: Record<NodeType, string> = {
  concept: '知识库/概念',
  entity: '知识库/实体',
};

// 把 `--file` / `--source` 参数解析为绝对路径（相对 cwd）+ 相对 corpus 路径。
function resolveFileArg(corpus: string, f: string): { abs: string; rel: string } {
  const abs = f.startsWith('/') ? f : join(process.cwd(), f);
  return { abs, rel: relative(corpus, abs) };
}

// 数据安全：`原料/` 是只读原料，links 的写操作不得改它（AGENTS 数据安全 #5）。
function guardNotRaw(rel: string): boolean {
  if (rel === '原料' || rel.startsWith('原料/')) {
    bad(`refuse to edit read-only raw source: ${rel}`);
    return false;
  }
  return true;
}

// 匹配 wikilink：可选嵌入 `!`、目标、可选 `#anchor`、可选 `|display`。
const WIKILINK_RE = /(!?)\[\[([^\]|#]+)((?:#[^\]|]*)?)(\|[^\]]*)?\]\]/g;

// 扫一个页里所有 broken wikilink target（去重，跳过代码块）。
function scanBrokenLinks(content: string, rel: string, index: WikiLinkIndex): string[] {
  const stripped = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
  const broken: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(WIKILINK_RE.source, 'g');
  while ((m = re.exec(stripped)) !== null) {
    const target = m[2].trim();
    if (seen.has(target)) continue;
    seen.add(target);
    if (!resolveWikiLink(rel, target, index)) broken.push(target);
  }
  return broken;
}

// 对一个 broken target 给确定性候选（case 差异 / 路径漂移 / 近似 basename）。AI 决定取舍。
function findCandidates(target: string, index: WikiLinkIndex): { slug: string; reason: string }[] {
  const lower = target.toLowerCase();
  const tbase = (target.split('/').pop() ?? target).toLowerCase();
  const bySlug = new Map<string, string>();
  for (const stem of index.stems) {
    const sbase = (stem.split('/').pop() ?? stem).toLowerCase();
    let reason = '';
    if (stem.toLowerCase() === lower) reason = 'case-mismatch';
    else if (sbase === tbase) reason = 'path-drift / same-name';
    else if (tbase.length >= 2 && (sbase.includes(tbase) || tbase.includes(sbase)))
      reason = 'near-match';
    if (reason && !bySlug.has(stem)) bySlug.set(stem, reason);
  }
  return [...bySlug.entries()].slice(0, 5).map(([slug, reason]) => ({ slug, reason }));
}

// 改写文件里所有 `[[label]]` 形态，transform 返回替换串；返回改写次数。
function rewriteLabel(
  content: string,
  label: string,
  transform: (p: { bang: string; anchor: string; disp: string }) => string,
): { content: string; count: number } {
  let count = 0;
  const re = new RegExp(WIKILINK_RE.source, 'g');
  const next = content.replace(re, (full, bang: string, tgt: string, anchor: string, disp: string) => {
    if (tgt.trim() !== label) return full;
    count++;
    return transform({ bang: bang ?? '', anchor: anchor ?? '', disp: disp ?? '' });
  });
  return { content: next, count };
}

// ---------- state ----------

interface LinksStatePage {
  checkedAt: string;
  broken: { link: string; candidates: { slug: string; reason: string }[] }[];
}

// plain 降级台账：记录哪个文件的哪个 label 被降级过，目标页建好后可提醒重连。
interface PlainedEntry {
  file: string;
  label: string;
  at: string;
}

interface LinksState {
  version: 1;
  pages: Record<string, LinksStatePage>;
  plained: PlainedEntry[];
}

function linksStatePath(corpus: string): string {
  return join(corpus, '.wiki', 'links-state.json');
}

function loadLinksState(corpus: string): LinksState {
  const empty: LinksState = { version: 1, pages: {}, plained: [] };
  const p = linksStatePath(corpus);
  if (!existsSync(p)) return empty;
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.pages) {
      return { version: 1, pages: parsed.pages, plained: parsed.plained ?? [] };
    }
  } catch {
    /* 损坏就重置 */
  }
  return empty;
}

function writeLinksState(corpus: string, state: LinksState): string {
  const p = linksStatePath(corpus);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  return p;
}

function saveLinksState(corpus: string, pages: Record<string, LinksStatePage>): string {
  const state = loadLinksState(corpus);
  state.pages = { ...state.pages, ...pages };
  return writeLinksState(corpus, state);
}

// 幂等登记一条 plain 降级记录。
function recordPlained(corpus: string, file: string, label: string): void {
  const state = loadLinksState(corpus);
  if (state.plained.some((e) => e.file === file && e.label === label)) return;
  state.plained.push({ file, label, at: todayYMDShanghai() });
  writeLinksState(corpus, state);
}

export function linksCommand(program: Command): void {
  const group = program
    .command('links')
    .description('links closure: suggest/fix/stub/backlog/plain broken [[wikilinks]]');

  // ---------- suggest ----------
  group
    .command('suggest')
    .description('scan a page for broken wikilinks and list deterministic candidates (read-only)')
    .requiredOption('--file <file...>', 'wiki page(s) to scan')
    .option('--json', 'emit machine-readable JSON to stdout', false)
    .option('--write-state', 'persist results to .wiki/links-state.json', false)
    .action((opts: { file: string[]; json?: boolean; writeState?: boolean }) => {
      const corpus = requireCorpus();
      const index = buildWikiLinkIndex(corpus);
      const checkedAt = new Date().toISOString();

      const pages: Record<string, LinksStatePage> = {};
      const report: { file: string; broken: { link: string; candidates: { slug: string; reason: string }[] }[] }[] = [];

      for (const f of opts.file) {
        const { abs, rel } = resolveFileArg(corpus, f);
        if (!existsSync(abs)) {
          bad(`[links suggest] file not found: ${f}`);
          process.exitCode = 2;
          continue;
        }
        const content = readFileSync(abs, 'utf-8');
        const brokenTargets = scanBrokenLinks(content, rel, index);
        const broken = brokenTargets.map((link) => ({ link, candidates: findCandidates(link, index) }));
        pages[rel] = { checkedAt, broken };
        report.push({ file: rel, broken });
      }

      // 人类摘要 → stderr
      for (const r of report) {
        if (r.broken.length === 0) {
          ok(`${r.file}: no broken links`);
        } else {
          print(`✗ ${r.file}: ${r.broken.length} broken link(s)`);
          for (const b of r.broken) {
            const cands = b.candidates.length
              ? b.candidates.map((c) => `${c.slug} (${c.reason})`).join(', ')
              : '(no candidates)';
            print(`    [[${b.link}]] → ${cands}`);
          }
        }
      }

      if (opts.writeState) {
        const p = saveLinksState(corpus, pages);
        print(`state written: ${relative(corpus, p)}`);
      }
      if (opts.json) out(JSON.stringify({ pages: report }));

      const totalBroken = report.reduce((n, r) => n + r.broken.length, 0);
      if (totalBroken > 0) process.exitCode = 1;
    });

  // ---------- fix ----------
  group
    .command('fix <label>')
    .description('repoint [[label]] to a canonical target in a file; optionally register an alias')
    .requiredOption('--to <target>', 'canonical link target (slug or bare name)')
    .requiredOption('--file <file>', 'file whose [[label]] should be repointed')
    .option('--alias <name>', 'register this alias in the canonical page frontmatter aliases')
    .action((label: string, opts: { to: string; file: string; alias?: string }) => {
      const corpus = requireCorpus();
      const { abs, rel } = resolveFileArg(corpus, opts.file);
      if (!existsSync(abs)) {
        bad(`[links fix] file not found: ${opts.file}`);
        process.exitCode = 2;
        return;
      }
      if (!guardNotRaw(rel)) {
        process.exitCode = 2;
        return;
      }
      const content = readFileSync(abs, 'utf-8');
      const { content: next, count } = rewriteLabel(content, label, ({ bang, anchor, disp }) => {
        return `${bang}[[${opts.to}${anchor}${disp}]]`;
      });
      if (count === 0) {
        warn(`[links fix] no [[${label}]] found in ${rel}`);
        process.exitCode = 1;
        return;
      }
      writeFileSync(abs, next, 'utf-8');
      ok(`[links fix] ${rel}: ${count} link(s) [[${label}]] → [[${opts.to}]]`);

      // 别名登记：把 alias 写进 canonical 页 frontmatter 的 aliases 列表（幂等）。
      let aliasResult = '';
      if (opts.alias) {
        aliasResult = registerAlias(corpus, opts.to, opts.alias);
        if (aliasResult) print(aliasResult);
      }
      out(JSON.stringify({ file: rel, label, to: opts.to, rewritten: count, alias: opts.alias ?? null }));
    });

  // ---------- stub ----------
  group
    .command('stub <label>')
    .description('create a placeholder page 知识库/<type>/<label>.md so [[label]] resolves')
    .requiredOption('--type <type>', 'concept | entity')
    .requiredOption('--source <file>', 'page that first mentioned this node (for a backref)')
    .action((label: string, opts: { type: string; source: string }) => {
      const corpus = requireCorpus();
      const type = opts.type as NodeType;
      if (type !== 'concept' && type !== 'entity') {
        bad(`[links stub] --type must be concept|entity, got: ${opts.type}`);
        process.exitCode = 2;
        return;
      }
      const dir = TYPE_DIR[type];
      const pageRel = `${dir}/${label}.md`;
      const pageAbs = join(corpus, pageRel);
      if (existsSync(pageAbs)) {
        warn(`[links stub] already exists: ${pageRel}`);
        out(JSON.stringify({ created: false, page: pageRel }));
        return;
      }
      const { rel: sourceRel } = resolveFileArg(corpus, opts.source);
      const sourceStem = sourceRel.replace(/\.md$/, '');
      const today = todayYMDShanghai();
      const body = [
        '---',
        `type: ${type}`,
        `title: ${label}`,
        `slug: ${dir}/${label}`,
        `created: ${today}`,
        `updated: ${today}`,
        `aliases: [${label}]`,
        'stub: true',
        '---',
        '',
        `> 占位 stub 页（\`lorekit links stub\` 创建），等待补充内容。`,
        '',
        `首次提及来源：[[${sourceStem}]]`,
        '',
      ].join('\n');
      mkdirSync(dirname(pageAbs), { recursive: true });
      writeFileSync(pageAbs, body, 'utf-8');
      ok(`[links stub] created ${pageRel}`);
      out(JSON.stringify({ created: true, page: pageRel, type }));
    });

  // ---------- backlog ----------
  group
    .command('backlog <label>')
    .description('record a future node in 系统/missing-nodes.md (does not edit the source)')
    .requiredOption('--type <type>', 'concept | entity')
    .requiredOption('--source <file>', 'page that mentioned this node')
    .option('--reason <text>', 'why it is backlogged rather than built now')
    .action((label: string, opts: { type: string; source: string; reason?: string }) => {
      const corpus = requireCorpus();
      const type = opts.type as NodeType;
      if (type !== 'concept' && type !== 'entity') {
        bad(`[links backlog] --type must be concept|entity, got: ${opts.type}`);
        process.exitCode = 2;
        return;
      }
      const existing = ensureMissingNodes(corpus);
      if (backlogHasLabel(existing, label)) {
        warn(`[links backlog] already backlogged: ${label}`);
        out(JSON.stringify({ added: false, label }));
        return;
      }
      const { rel: sourceRel } = resolveFileArg(corpus, opts.source);
      const reason = (opts.reason ?? '').replace(/\|/g, '/').trim() || '(unspecified)';
      const row = `| ${label} | ${type} | ${sourceRel} | ${reason} | ${todayYMDShanghai()} |\n`;
      const next = existing.endsWith('\n') ? existing + row : existing + '\n' + row;
      writeFileSync(missingNodesPath(corpus), next, 'utf-8');
      ok(`[links backlog] recorded ${label} → ${MISSING_NODES_REL}`);
      out(JSON.stringify({ added: true, label, type, source: sourceRel }));
    });

  // ---------- plain ----------
  group
    .command('plain <label>')
    .description('downgrade [[label]] to plain text in a file (drop the graph node)')
    .requiredOption('--file <file>', 'file whose [[label]] should be downgraded')
    .action((label: string, opts: { file: string }) => {
      const corpus = requireCorpus();
      const { abs, rel } = resolveFileArg(corpus, opts.file);
      if (!existsSync(abs)) {
        bad(`[links plain] file not found: ${opts.file}`);
        process.exitCode = 2;
        return;
      }
      if (!guardNotRaw(rel)) {
        process.exitCode = 2;
        return;
      }
      const content = readFileSync(abs, 'utf-8');
      // 降级：保留可见文字（有 `|display` 用 display，否则用 label），摘掉 `[[ ]]` 与嵌入 `!`。
      const { content: next, count } = rewriteLabel(content, label, ({ disp }) => {
        return disp ? disp.slice(1) : label;
      });
      if (count === 0) {
        warn(`[links plain] no [[${label}]] found in ${rel}`);
        process.exitCode = 1;
        return;
      }
      writeFileSync(abs, next, 'utf-8');
      // 可恢复性：登记台账，目标页将来建好后 `links plained` 会提醒重连。
      recordPlained(corpus, rel, label);
      ok(`[links plain] ${rel}: downgraded ${count} [[${label}]] to plain text (recorded)`);
      out(JSON.stringify({ file: rel, label, downgraded: count, recorded: true }));
    });

  // ---------- plained ----------
  group
    .command('plained')
    .description('list plain-downgrade ledger; mark entries whose target now exists as revivable')
    .option('--json', 'emit machine-readable JSON to stdout', false)
    .action((opts: { json?: boolean }) => {
      const corpus = requireCorpus();
      const state = loadLinksState(corpus);
      const index = buildWikiLinkIndex(corpus);

      const kept: PlainedEntry[] = [];
      const report: (PlainedEntry & { status: 'revivable' | 'pending' })[] = [];
      for (const e of state.plained) {
        const abs = join(corpus, e.file);
        // 文件已重新出现 `[[label]]`（已重连）或文件已删 → 台账条目了结，自动清出。
        if (!existsSync(abs)) continue;
        const content = readFileSync(abs, 'utf-8');
        const relinkRe = new RegExp(WIKILINK_RE.source, 'g');
        let relinked = false;
        let m: RegExpExecArray | null;
        while ((m = relinkRe.exec(content)) !== null) {
          if (m[2].trim() === e.label) {
            relinked = true;
            break;
          }
        }
        if (relinked) continue;
        kept.push(e);
        report.push({
          ...e,
          status: resolveWikiLink(e.file, e.label, index) ? 'revivable' : 'pending',
        });
      }
      if (kept.length !== state.plained.length) {
        state.plained = kept;
        writeLinksState(corpus, state);
      }

      const revivable = report.filter((r) => r.status === 'revivable');
      if (report.length === 0) {
        ok('[links plained] ledger empty');
      } else {
        for (const r of report) {
          if (r.status === 'revivable') {
            warn(`[links plained] ${r.file}: "${r.label}" 目标页已存在，可重连（plain @ ${r.at}）`);
          } else {
            print(`  ${r.file}: "${r.label}" pending（plain @ ${r.at}）`);
          }
        }
        print(`${report.length} entr(ies), ${revivable.length} revivable`);
      }
      if (opts.json) out(JSON.stringify({ plained: report }));
    });
}

// 把 alias 追加进 canonical 页 frontmatter 的 aliases 列表（幂等、不引第三方序列化以免动既有格式）。
// canonicalTarget 可能是 slug（含路径）或裸名；解析到实际文件后操作。
function registerAlias(corpus: string, canonicalTarget: string, alias: string): string {
  const file = resolveCanonicalFile(corpus, canonicalTarget);
  if (!file) return `(alias 未登记：找不到 canonical 页 ${canonicalTarget})`;
  const content = readFileSync(file, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return `(alias 未登记：${relative(corpus, file)} 无 frontmatter)`;
  const fm = fmMatch[1];

  const aliasLine = fm.match(/^aliases:\s*\[([^\]]*)\]\s*$/m);
  let nextFm: string;
  if (aliasLine) {
    const items = aliasLine[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.includes(alias)) return `(alias 已存在：${alias})`;
    items.push(alias);
    nextFm = fm.replace(aliasLine[0], `aliases: [${items.join(', ')}]`);
  } else {
    nextFm = `${fm}\naliases: [${alias}]`;
  }
  const next = content.replace(fmMatch[0], `---\n${nextFm}\n---`);
  writeFileSync(file, next, 'utf-8');
  return `alias registered: ${alias} → ${relative(corpus, file)}`;
}

// 把 canonical 目标（slug 或裸名）解析到实际 .md 文件绝对路径。
function resolveCanonicalFile(corpus: string, target: string): string | null {
  const direct = join(corpus, `${target}.md`);
  if (existsSync(direct)) return direct;
  // 裸名 → 在 corpus 内找 basename 匹配的第一个页
  for (const file of collectMdFiles(corpus)) {
    const rel = relative(corpus, file);
    const stem = rel.replace(/\.md$/, '');
    if (stem === target || stem.split('/').pop() === target) return file;
  }
  return null;
}
