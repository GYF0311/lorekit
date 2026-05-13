import type { Command } from 'commander';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import chalk from 'chalk';
import { ok, bad, warn, print, out } from '../utils/logger.js';
import { requireCorpus, collectMdFiles, hasFrontmatter } from '../lib/corpus.js';
import { isIndexExcluded, isFolderPackage } from '../lib/paths.js';
import {
  getRecommendedFilter,
  readCorpusFilter,
  isFilterComplete,
} from '../lib/obsidian.js';
import {
  doctorGbrain,
  type GbrainDoctorIssue,
  type GbrainDoctorResult,
} from '../lib/integrations/gbrain.js';

const EXPECTED_DIRS = [
  '每日',
  '知识库/实体',
  '知识库/概念',
  '知识库/专题',
  '原料',
  '原料/录音',
  '写作',
  '系统',
  '_工作台',
];

type DoctorStatus = 'ok' | 'warn' | 'error';
const PUBLIC_DOCTOR_SECTIONS = [
  'structure',
  'metadata',
  'index',
  'archive',
  'obsidian',
  'integrations',
] as const;

type PublicDoctorSection = (typeof PUBLIC_DOCTOR_SECTIONS)[number];
type DoctorSectionName =
  | 'directories'
  | 'wikiMetadata'
  | 'frontmatter'
  | 'indexFiles'
  | 'archive'
  | 'obsidian'
  | 'integrations';

interface DoctorIssue {
  section: DoctorSectionName | 'gbrain';
  severity: 'warn' | 'error';
  message: string;
  recommendation?: string;
}

interface DoctorSectionReport {
  status: DoctorStatus;
  [key: string]: unknown;
}

export interface DoctorRunReport {
  status: DoctorStatus;
  generatedAt: string;
  corpus: string;
  sections: Partial<Record<DoctorSectionName, DoctorSectionReport>>;
  issues: DoctorIssue[];
  hardIssues: number;
}

export interface DoctorOptions {
  section?: 'all' | PublicDoctorSection;
}

function validSectionList(): string {
  return PUBLIC_DOCTOR_SECTIONS.join(', ');
}

function parseDoctorSection(section: string): DoctorOptions['section'] | null {
  if (section === 'all') return 'all';
  if ((PUBLIC_DOCTOR_SECTIONS as readonly string[]).includes(section)) {
    return section as PublicDoctorSection;
  }
  return null;
}

function inspectDirs(corpus: string): { missing: string[] } {
  const missing: string[] = [];
  for (const dir of EXPECTED_DIRS) {
    const full = join(corpus, dir);
    if (!existsSync(full)) missing.push(dir);
  }
  return { missing };
}

function checkDirs(corpus: string): number {
  const { missing } = inspectDirs(corpus);
  for (const dir of EXPECTED_DIRS) {
    if (missing.includes(dir)) bad(`${dir}/ ${chalk.dim('missing')}`);
    else ok(`${dir}/`);
  }
  return missing.length;
}

function inspectWikiVersion(corpus: string): { exists: boolean; version: string | null } {
  const versionFile = join(corpus, '.wiki', 'version');
  if (existsSync(versionFile)) {
    const ver = readFileSync(versionFile, 'utf-8').trim();
    return { exists: true, version: ver };
  }
  return { exists: false, version: null };
}

function checkWikiVersion(corpus: string): number {
  const result = inspectWikiVersion(corpus);
  if (result.exists) {
    ok(`.wiki/version → ${result.version}`);
    return 0;
  }
  bad('.wiki/version missing');
  return 1;
}

function inspectFrontmatterCoverage(corpus: string) {
  const files = collectMdFiles(corpus);
  const withFm = files.filter((f) => hasFrontmatter(f)).length;
  const total = files.length;
  const pct = total === 0 ? 100 : Math.round((withFm / total) * 100);
  return { withFrontmatter: withFm, total, pct };
}

function checkFrontmatterCoverage(corpus: string) {
  const { withFrontmatter, total, pct } = inspectFrontmatterCoverage(corpus);
  const color = pct >= 90 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
  const icon = pct >= 90 ? '✓' : pct >= 60 ? '⚠' : '✗';
  print(`${color(icon)} frontmatter coverage: ${withFrontmatter}/${total} (${pct}%)`);
}

function findMissingIndexDirs(corpus: string): string[] {
  const missing: string[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (!entry.isDirectory()) continue;

      const full = join(dir, entry.name);
      const rel = relative(corpus, full);

      // 复用 index 命令的排除规则：不对这些目录要求 _INDEX.md
      if (isIndexExcluded(rel)) continue;
      // 目录包装式原料（xxx/article.md）是一个 entry，不是容器——不需要 _INDEX.md
      if (isFolderPackage(full)) continue;

      // 本目录是否应该有 _INDEX.md：
      //   有直接 .md 文件 或 有目录包装式原料子目录
      let shouldHaveIndex = false;
      for (const name of readdirSync(full)) {
        if (name.startsWith('.')) continue;
        if (name === '_INDEX.md' || name === '.gitkeep') continue;
        const childPath = join(full, name);
        let stat;
        try {
          stat = lstatSync(childPath);
        } catch {
          continue;
        }
        if (stat.isFile() && name.endsWith('.md')) {
          shouldHaveIndex = true;
          break;
        }
        if (stat.isDirectory() && isFolderPackage(childPath)) {
          shouldHaveIndex = true;
          break;
        }
      }

      if (shouldHaveIndex && !existsSync(join(full, '_INDEX.md'))) {
        missing.push(rel);
      }
      walk(full);
    }
  }

  walk(corpus);
  return missing;
}

function checkIndexFiles(corpus: string): number {
  const missing = findMissingIndexDirs(corpus);
  for (const rel of missing) warn(`_INDEX.md missing in ${rel}/`);
  if (missing.length === 0) {
    ok('all directories with .md files have _INDEX.md');
  }
  return missing.length;
}

/**
 * 检查 .obsidian/graph.json filter 是否含推荐项（批次 26 触达老用户）。
 * obsidian 是可选用途，不阻塞 doctor 整体绿 —— 故意不计入 issues 总数。
 */
function inspectObsidianGraph(corpus: string): DoctorSectionReport {
  try {
    const recommended = getRecommendedFilter();
    const cur = readCorpusFilter(corpus);
    if (!cur.exists) {
      return {
        status: 'warn',
        message: 'graph filter 不完整，运行 lorekit obsidian-tune 查看详情',
      };
    }
    if (isFilterComplete(cur.search, recommended)) {
      return { status: 'ok', message: 'graph filter 完整' };
    }
    return {
      status: 'warn',
      message: 'graph filter 不完整，运行 lorekit obsidian-tune 查看详情',
    };
  } catch (e) {
    return { status: 'warn', message: `检查 graph filter 失败: ${(e as Error).message}` };
  }
}

function checkObsidianGraph(corpus: string): void {
  const result = inspectObsidianGraph(corpus);
  if (result.status === 'ok') ok(`obsidian: ${result.message}`);
  else warn(`obsidian: ${result.message}`);
}

function inspectArchive(corpus: string): DoctorSectionReport {
  const archiveDir = join(corpus, '_归档');
  if (existsSync(archiveDir)) {
    return { status: 'ok', exists: true };
  }
  return { status: 'warn', exists: false, message: '_归档/ not found (optional)' };
}

function checkArchive(corpus: string): number {
  const result = inspectArchive(corpus);
  if (result.status === 'ok') ok('_归档/ exists');
  else warn(String(result.message));
  return 0; // not a hard failure
}

function statusFromIssues(issues: DoctorIssue[]): DoctorStatus {
  if (issues.some((issue) => issue.severity === 'error')) return 'error';
  if (issues.length > 0) return 'warn';
  return 'ok';
}

function convertGbrainIssue(issue: GbrainDoctorIssue): DoctorIssue {
  return {
    section: 'gbrain',
    severity: issue.severity,
    message: issue.message,
    recommendation: issue.recommendation,
  };
}

function gbrainSection(gbrain: GbrainDoctorResult): DoctorSectionReport {
  return {
    status: gbrain.status,
    gbrain: {
      status: gbrain.status,
      installed: gbrain.gbrain.installed,
      binary: gbrain.gbrain.binary,
      version: gbrain.gbrain.version,
      brainInitialized: gbrain.gbrain.brainInitialized,
      manifestPath: gbrain.manifestPath,
      syncReportPath: gbrain.syncReportPath,
      issues: gbrain.issues,
    },
  };
}

export async function runDoctorReport(
  corpus: string,
  opts: DoctorOptions = {},
): Promise<DoctorRunReport> {
  const section = opts.section ?? 'all';
  if (!parseDoctorSection(section)) throw new Error(`invalid section: ${section}`);

  const report: DoctorRunReport = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    corpus,
    sections: {},
    issues: [],
    hardIssues: 0,
  };

  if (section === 'all' || section === 'structure') {
    const dirs = inspectDirs(corpus);
    report.sections.directories = {
      status: dirs.missing.length > 0 ? 'error' : 'ok',
      expected: EXPECTED_DIRS,
      missing: dirs.missing,
    };
    for (const dir of dirs.missing) {
      report.issues.push({
        section: 'directories',
        severity: 'error',
        message: `${dir}/ missing`,
      });
    }
  }

  if (section === 'all' || section === 'metadata') {
    const wiki = inspectWikiVersion(corpus);
    report.sections.wikiMetadata = {
      status: wiki.exists ? 'ok' : 'error',
      version: wiki.version,
      versionFileExists: wiki.exists,
    };
    if (!wiki.exists) {
      report.issues.push({
        section: 'wikiMetadata',
        severity: 'error',
        message: '.wiki/version missing',
      });
    }

    const fm = inspectFrontmatterCoverage(corpus);
    report.sections.frontmatter = {
      status: fm.pct >= 90 ? 'ok' : fm.pct >= 60 ? 'warn' : 'error',
      ...fm,
    };
  }

  if (section === 'all' || section === 'index') {
    const missingIndexes = findMissingIndexDirs(corpus);
    report.sections.indexFiles = {
      status: missingIndexes.length > 0 ? 'warn' : 'ok',
      missing: missingIndexes,
    };
    for (const rel of missingIndexes) {
      report.issues.push({
        section: 'indexFiles',
        severity: 'warn',
        message: `_INDEX.md missing in ${rel}/`,
      });
    }
  }

  if (section === 'all' || section === 'archive') {
    report.sections.archive = inspectArchive(corpus);
  }

  if (section === 'all' || section === 'obsidian') {
    report.sections.obsidian = inspectObsidianGraph(corpus);
  }

  if (section === 'all' || section === 'integrations') {
    const gbrain = await doctorGbrain(corpus);
    report.sections.integrations = gbrainSection(gbrain);
    report.issues.push(...gbrain.issues.map(convertGbrainIssue));
  }

  report.hardIssues = report.issues.filter((issue) => issue.severity === 'error').length;
  report.status = statusFromIssues(report.issues);
  return report;
}

/**
 * 程序内复用入口：跑健康体检。
 * 返回 issue 总数。调用方自行决定要不要把退出码设成非零。
 */
export async function runDoctor(corpus: string, opts: DoctorOptions = {}): Promise<number> {
  const section = opts.section ?? 'all';
  if (!parseDoctorSection(section)) throw new Error(`invalid section: ${section}`);

  print(chalk.bold(`\nlorekit doctor — ${corpus}\n`));

  let issues = 0;
  let optionalWarnings = 0;

  if (section === 'all' || section === 'structure') {
    print(chalk.cyan('── directories ──'));
    issues += checkDirs(corpus);
    print();
  }

  if (section === 'all' || section === 'metadata') {
    print(chalk.cyan('── wiki metadata ──'));
    issues += checkWikiVersion(corpus);
    print();

    print(chalk.cyan('── frontmatter ──'));
    checkFrontmatterCoverage(corpus);
    print();
  }

  if (section === 'all' || section === 'index') {
    print(chalk.cyan('── index files ──'));
    issues += checkIndexFiles(corpus);
    print();
  }

  if (section === 'all' || section === 'archive') {
    print(chalk.cyan('── archive ──'));
    checkArchive(corpus);
    print();
  }

  if (section === 'all' || section === 'obsidian') {
    print(chalk.cyan('── obsidian ──'));
    checkObsidianGraph(corpus);
    print();
  }

  if (section === 'all' || section === 'integrations') {
    print(chalk.cyan('── integrations ──'));
    const gbrain = await doctorGbrain(corpus);
    if (gbrain.status === 'ok') {
      ok('gbrain: integration healthy');
    } else {
      for (const issue of gbrain.issues) {
        const line = `gbrain: ${issue.message}. ${issue.recommendation}`;
        if (issue.severity === 'error') bad(line);
        else warn(line);
      }
    }
    const integrationErrors = gbrain.issues.filter((issue) => issue.severity === 'error').length;
    optionalWarnings += gbrain.issues.filter((issue) => issue.severity === 'warn').length;
    issues += integrationErrors;
    print();
  }

  if (issues === 0) {
    print(chalk.green.bold('all hard checks passed ✓'));
    if (optionalWarnings > 0) {
      print(chalk.yellow.bold('optional warnings found ⚠'));
    }
  } else {
    print(chalk.yellow(`${issues} issue(s) found`));
  }
  print();

  return issues;
}

export function doctorCommand(program: Command) {
  program
    .command('doctor')
    .description('run health checks on the corpus')
    .option('--json', 'output machine-readable doctor report', false)
    .option('--section <name>', `only run one section: ${validSectionList()}`, 'all')
    .action(async (opts: { json?: boolean; section?: 'all' | 'integrations' | string }) => {
      const section = parseDoctorSection(opts.section ?? 'all');
      if (!section) {
        bad(`invalid section: ${opts.section}`);
        print(`valid: ${validSectionList()}`);
        process.exitCode = 2;
        return;
      }
      const corpus = requireCorpus();
      if (opts.json) {
        const report = await runDoctorReport(corpus, { section });
        out(JSON.stringify(report, null, 2));
        process.exitCode = report.hardIssues > 0 ? 1 : 0;
        return;
      }
      const issues = await runDoctor(corpus, { section });
      process.exitCode = issues > 0 ? 1 : 0;
    });
}
