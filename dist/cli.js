#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";
import chalk8 from "chalk";

// src/lib/corpus.ts
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import matter from "gray-matter";

// src/lib/paths.ts
import { lstatSync } from "fs";
import { join as pathJoin, relative as pathRelative, isAbsolute as pathIsAbsolute } from "path";
var alwaysExcludeNames = /* @__PURE__ */ new Set([
  ".gitkeep",
  ".DS_Store",
  "_INDEX.md"
]);
var alwaysExcludeDirNames = /* @__PURE__ */ new Set(["node_modules", "skills"]);
function normalizeRelPath(rel) {
  return rel.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
}
function relParts(rel) {
  return normalizeRelPath(rel).split("/").filter(Boolean);
}
function relPosix(from, to) {
  return normalizeRelPath(pathRelative(from, to));
}
function hasAlwaysExcludedDirSegment(rel) {
  return relParts(rel).some((part) => alwaysExcludeDirNames.has(part));
}
function matchesDirPrefix(rel, prefix) {
  const normalizedRel = normalizeRelPath(rel);
  const normalizedPrefix = normalizeRelPath(prefix);
  return normalizedRel === normalizedPrefix || normalizedRel.startsWith(normalizedPrefix + "/");
}
var searchDefaultExcludePrefixes = [
  "_\u5DE5\u4F5C\u53F0",
  "_archive",
  "_\u5F52\u6863",
  "\u53CD\u9988",
  "\u7CFB\u7EDF",
  "\u8F93\u51FA",
  ".wiki",
  ".git"
];
var searchAllExcludePrefixes = [".wiki", ".git", "_\u5DE5\u4F5C\u53F0/\u8F6C\u5199"];
var workbenchTriageExcludePrefixes = [
  "_\u5DE5\u4F5C\u53F0/\u8F6C\u5199",
  "_\u5DE5\u4F5C\u53F0/\u65E5\u8BB0\u6536\u4EF6"
];
var indexExcludeDirPrefixes = [
  ".wiki",
  ".git",
  "node_modules",
  "skills",
  "_\u5F52\u6863",
  "_\u5DE5\u4F5C\u53F0",
  "\u7CFB\u7EDF",
  "\u53CD\u9988"
];
function isIndexExcluded(rel) {
  if (hasAlwaysExcludedDirSegment(rel)) return true;
  for (const prefix of indexExcludeDirPrefixes) {
    if (matchesDirPrefix(rel, prefix)) return true;
  }
  return false;
}
function isFolderPackage(dir) {
  const articlePath = pathJoin(dir, "article.md");
  try {
    return lstatSync(articlePath).isFile();
  } catch {
    return false;
  }
}
var lintSkipFrontmatterBasenames = /* @__PURE__ */ new Set([
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "MEMORY.md"
]);
var lintRootOnlySkipBasenames = /* @__PURE__ */ new Set(["index.md", "log.md"]);
var lintSkipOrphanPrefixes = [
  "_\u5DE5\u4F5C\u53F0/",
  "_\u5F52\u6863/",
  "\u7CFB\u7EDF/",
  "\u77E5\u8BC6\u5E93/\u6A21\u677F/"
];
var lintSkipFrontmatterPrefixes = ["_\u5DE5\u4F5C\u53F0/", "_\u5F52\u6863/"];
var lintSkipBrokenLinkPrefixes = ["\u77E5\u8BC6\u5E93/\u6A21\u677F/"];
var snapshotExcludeNames = /* @__PURE__ */ new Set([".wiki", ".git", ".DS_Store"]);
function isWithin(root, abs) {
  const rel = pathRelative(root, abs);
  return rel === "" || !rel.startsWith("..") && !pathIsAbsolute(rel);
}

// src/utils/logger.ts
import chalk from "chalk";
var DEBUG_ENABLED = process.env.LOREKIT_DEBUG === "1";
var ok = (msg) => console.error(`${chalk.green("\u2713")} ${msg}`);
var bad = (msg) => console.error(`${chalk.red("\u2717")} ${msg}`);
var warn = (msg) => console.error(`${chalk.yellow("lorekit:")} ${msg}`);
var err = (msg) => console.error(`${chalk.red("lorekit:")} ${msg}`);
var info = (msg) => console.error(`${chalk.cyan("\u2139")} ${msg}`);
var debug = (msg) => {
  if (DEBUG_ENABLED) console.error(`${chalk.dim("debug:")} ${msg}`);
};
var print = (msg = "") => console.error(msg);
var out = (msg) => console.log(msg);

// src/lib/corpus.ts
function findCorpus(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== "/" && dir) {
    if (existsSync(join(dir, ".wiki"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}
function requireCorpus(startDir) {
  const corpus = findCorpus(startDir);
  if (!corpus) {
    throw new Error("not inside a corpus (no .wiki/ marker found; run `lorekit init` first)");
  }
  return corpus;
}
function extractFrontmatter(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    return data;
  } catch (e) {
    debug(`extractFrontmatter(${filePath}) failed: ${e.message}`);
    return {};
  }
}
function hasFrontmatter(filePath) {
  try {
    const first = readFileSync(filePath, "utf-8").slice(0, 4);
    return first === "---\n" || first === "---\r";
  } catch (e) {
    debug(`hasFrontmatter(${filePath}) failed: ${e.message}`);
    return false;
  }
}
function findSourceByUrl(corpus, url) {
  const sourcesRoot = join(corpus, "\u539F\u6599");
  if (!existsSync(sourcesRoot)) return null;
  for (const mdPath of collectMdFiles(sourcesRoot)) {
    const fm = extractFrontmatter(mdPath);
    if (fm.source_url === url || fm.url === url) return mdPath;
  }
  return null;
}
function collectMdFiles(dir, _opts) {
  const results = [];
  if (!existsSync(dir)) return results;
  if (alwaysExcludeDirNames.has(basename(dir))) return results;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (alwaysExcludeDirNames.has(entry.name)) continue;
        walk(full);
      } else if (entry.name.endsWith(".md") && !alwaysExcludeNames.has(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results.sort();
}

// src/utils/fs.ts
import { createHash } from "crypto";
import { readFileSync as readFileSync2, statSync } from "fs";
import { join as join2, dirname as dirname2 } from "path";
import { fileURLToPath } from "url";
function sha256(filePath) {
  const content = readFileSync2(filePath);
  return createHash("sha256").update(content).digest("hex");
}
function lorekitRoot() {
  const thisFile = fileURLToPath(import.meta.url);
  return join2(dirname2(thisFile), "..");
}
function readVersion() {
  try {
    return readFileSync2(join2(lorekitRoot(), "VERSION"), "utf-8").trim();
  } catch (e) {
    warn(`VERSION file missing or unreadable: ${e.message}`);
    return "unknown";
  }
}

// src/commands/init.ts
import { existsSync as existsSync2, mkdirSync, readdirSync as readdirSync2, cpSync, writeFileSync } from "fs";
import { join as join3, resolve } from "path";
import { createInterface } from "readline";
import chalk2 from "chalk";
var MINIMAL_DIRS = ["\u539F\u6599", "\u77E5\u8BC6\u5E93/\u6982\u5FF5", "\u77E5\u8BC6\u5E93/\u5B9E\u4F53", "\u77E5\u8BC6\u5E93/\u6458\u8981", "\u6BCF\u65E5", "\u7CFB\u7EDF", ".wiki"];
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve6) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve6(answer.trim());
    });
  });
}
function isDirEmpty(dir) {
  if (!existsSync2(dir)) return true;
  const entries = readdirSync2(dir).filter((n) => n !== ".DS_Store" && n !== ".git");
  return entries.length === 0;
}
function copyTemplateFiles(src, dest, isRoot = true) {
  if (!existsSync2(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync2(src, { withFileTypes: true })) {
    if (isRoot && entry.isDirectory() && entry.name === ".obsidian") continue;
    const srcPath = join3(src, entry.name);
    const destPath = join3(dest, entry.name);
    if (entry.isDirectory()) {
      copyTemplateFiles(srcPath, destPath, false);
    } else {
      if (!existsSync2(destPath)) {
        mkdirSync(join3(destPath, ".."), { recursive: true });
        cpSync(srcPath, destPath);
      }
    }
  }
}
function deployObsidianPlugin(corpusPath) {
  const pluginSrc = join3(lorekitRoot(), "plugins", "obsidian-audit");
  const pluginDest = join3(corpusPath, ".obsidian", "plugins", "lorekit-audit");
  if (!existsSync2(pluginSrc)) {
    warn("obsidian-audit plugin not found in lorekit install, skipping");
    return;
  }
  mkdirSync(pluginDest, { recursive: true });
  for (const file of readdirSync2(pluginSrc)) {
    cpSync(join3(pluginSrc, file), join3(pluginDest, file));
  }
  ok("deployed obsidian-audit plugin \u2192 .obsidian/plugins/lorekit-audit/");
}
function deployObsidianGraphConfig(corpusPath) {
  const src = join3(lorekitRoot(), "templates", "default-corpus", ".obsidian", "graph.json");
  if (!existsSync2(src)) {
    warn("templates/default-corpus/.obsidian/graph.json not found, skipping graph config");
    return;
  }
  const destDir = join3(corpusPath, ".obsidian");
  const dest = join3(destDir, "graph.json");
  if (existsSync2(dest)) {
    warn(".obsidian/graph.json \u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7\u5199\u5165\u3002\u63A8\u8350 filter \u89C1 docs/QUICKSTART.md");
    return;
  }
  if (!existsSync2(destDir)) mkdirSync(destDir, { recursive: true });
  cpSync(src, dest);
  ok("deployed Obsidian graph filter \u2192 .obsidian/graph.json");
}
function createWikiMeta(corpusPath) {
  const wikiDir = join3(corpusPath, ".wiki");
  mkdirSync(wikiDir, { recursive: true });
  const version2 = readVersion();
  writeFileSync(join3(wikiDir, "version"), version2 + "\n");
  const configPath = join3(wikiDir, "config.yaml");
  if (!existsSync2(configPath)) {
    writeFileSync(
      configPath,
      [
        "# lorekit corpus config",
        `version: "${version2}"`,
        "lang: zh-CN",
        "frontmatter_required: true",
        ""
      ].join("\n")
    );
  }
  ok(`created .wiki/version (${version2}) + config.yaml`);
}
function initCommand(program2) {
  program2.command("init").argument("[path]", "target directory", ".").option("--in-place", "initialize in-place even if directory is non-empty").option("--minimal", "only create core directories (no template files)").description("initialize a new lorekit corpus").action(async (targetPath, opts) => {
    const resolved = resolve(targetPath);
    const templateDir = join3(lorekitRoot(), "templates", "default-corpus");
    if (opts.minimal) {
      for (const dir of MINIMAL_DIRS) {
        mkdirSync(join3(resolved, dir), { recursive: true });
      }
      createWikiMeta(resolved);
      ok(`minimal corpus initialized at ${resolved}`);
      return;
    }
    if (!isDirEmpty(resolved) && !opts.inPlace) {
      print(chalk2.yellow(`
  target directory is not empty: ${resolved}
`));
      const answer = await ask(
        "  [b] backup & init  [i] in-place (skip existing)  [c] cancel\n  > "
      );
      if (answer === "c" || answer === "C" || answer === "") {
        bad("cancelled");
        return;
      }
      if (answer === "b" || answer === "B") {
        const backupDir = resolved + ".bak." + Date.now();
        cpSync(resolved, backupDir, { recursive: true });
        ok(`backed up to ${backupDir}`);
      }
    }
    if (existsSync2(templateDir)) {
      copyTemplateFiles(templateDir, resolved);
      ok("template files copied (skipped existing)");
    } else {
      warn("template directory not found, creating minimal structure");
      for (const dir of MINIMAL_DIRS) {
        mkdirSync(join3(resolved, dir), { recursive: true });
      }
    }
    createWikiMeta(resolved);
    deployObsidianGraphConfig(resolved);
    deployObsidianPlugin(resolved);
    print();
    ok(chalk2.bold(`corpus initialized at ${resolved}`));
  });
}

// src/commands/doctor.ts
import { existsSync as existsSync4, lstatSync as lstatSync2, readFileSync as readFileSync4, readdirSync as readdirSync3 } from "fs";
import { join as join5 } from "path";
import chalk3 from "chalk";

// src/lib/obsidian.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "fs";
import { join as join4 } from "path";
function getRecommendedGraphConfig() {
  const tpl = join4(lorekitRoot(), "templates", "default-corpus", ".obsidian", "graph.json");
  const raw = readFileSync3(tpl, "utf-8");
  return JSON.parse(raw);
}
function getRecommendedFilter() {
  const cfg = getRecommendedGraphConfig();
  return cfg.search ?? "";
}
function readCorpusFilter(corpus) {
  const dest = join4(corpus, ".obsidian", "graph.json");
  if (!existsSync3(dest)) return { exists: false };
  try {
    const raw = readFileSync3(dest, "utf-8");
    const parsed = JSON.parse(raw);
    return { exists: true, search: parsed.search, raw: parsed };
  } catch {
    return { exists: true, search: void 0 };
  }
}
function tokenize(search) {
  return search.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}
function isFilterComplete(actual, recommended) {
  if (!actual) return false;
  const want = new Set(tokenize(recommended));
  const have = new Set(tokenize(actual));
  for (const t of want) {
    if (!have.has(t)) return false;
  }
  return true;
}
function missingTokens(actual, recommended) {
  const have = new Set(actual ? tokenize(actual) : []);
  return tokenize(recommended).filter((t) => !have.has(t));
}

// src/commands/doctor.ts
var EXPECTED_DIRS = [
  "\u6BCF\u65E5",
  "\u77E5\u8BC6\u5E93/\u5B9E\u4F53",
  "\u77E5\u8BC6\u5E93/\u6982\u5FF5",
  "\u77E5\u8BC6\u5E93/\u4E13\u9898",
  "\u539F\u6599",
  "\u539F\u6599/\u5F55\u97F3",
  "\u5199\u4F5C",
  "\u7CFB\u7EDF",
  "_\u5DE5\u4F5C\u53F0"
];
var PUBLIC_DOCTOR_SECTIONS = [
  "structure",
  "metadata",
  "index",
  "archive",
  "obsidian"
];
function validSectionList() {
  return PUBLIC_DOCTOR_SECTIONS.join(", ");
}
function parseDoctorSection(section) {
  if (section === "all") return "all";
  if (PUBLIC_DOCTOR_SECTIONS.includes(section)) {
    return section;
  }
  return null;
}
function inspectDirs(corpus) {
  const missing = [];
  for (const dir of EXPECTED_DIRS) {
    const full = join5(corpus, dir);
    if (!existsSync4(full)) missing.push(dir);
  }
  return { missing };
}
function checkDirs(corpus) {
  const { missing } = inspectDirs(corpus);
  for (const dir of EXPECTED_DIRS) {
    if (missing.includes(dir)) bad(`${dir}/ ${chalk3.dim("missing")}`);
    else ok(`${dir}/`);
  }
  return missing.length;
}
function inspectWikiVersion(corpus) {
  const versionFile = join5(corpus, ".wiki", "version");
  if (existsSync4(versionFile)) {
    const ver = readFileSync4(versionFile, "utf-8").trim();
    return { exists: true, version: ver };
  }
  return { exists: false, version: null };
}
function checkWikiVersion(corpus) {
  const result = inspectWikiVersion(corpus);
  if (result.exists) {
    ok(`.wiki/version \u2192 ${result.version}`);
    return 0;
  }
  bad(".wiki/version missing");
  return 1;
}
var FRONTMATTER_DURABLE_LAYERS = ["\u539F\u6599", "\u77E5\u8BC6\u5E93", "\u6BCF\u65E5", "\u5199\u4F5C"];
var FRONTMATTER_PROCESS_LAYERS = ["_\u5DE5\u4F5C\u53F0", "\u8F93\u51FA"];
function inspectFrontmatterLayer(corpus, layer) {
  const files = collectMdFiles(join5(corpus, layer));
  const withFm = files.filter((f) => hasFrontmatter(f)).length;
  const total = files.length;
  const pct = total === 0 ? 100 : Math.round(withFm / total * 100);
  return { withFrontmatter: withFm, total, pct };
}
function inspectFrontmatterCoverage(corpus) {
  const durableFiles = FRONTMATTER_DURABLE_LAYERS.flatMap(
    (layer) => collectMdFiles(join5(corpus, layer))
  );
  const withFm = durableFiles.filter((f) => hasFrontmatter(f)).length;
  const total = durableFiles.length;
  const pct = total === 0 ? 100 : Math.round(withFm / total * 100);
  const layers = {};
  for (const layer of FRONTMATTER_DURABLE_LAYERS) {
    layers[layer] = { durable: true, ...inspectFrontmatterLayer(corpus, layer) };
  }
  for (const layer of FRONTMATTER_PROCESS_LAYERS) {
    layers[layer] = { durable: false, ...inspectFrontmatterLayer(corpus, layer) };
  }
  return { withFrontmatter: withFm, total, pct, scope: "durable", layers };
}
function checkFrontmatterCoverage(corpus) {
  const { withFrontmatter, total, pct } = inspectFrontmatterCoverage(corpus);
  const color = pct >= 90 ? chalk3.green : pct >= 60 ? chalk3.yellow : chalk3.red;
  const icon = pct >= 90 ? "\u2713" : pct >= 60 ? "\u26A0" : "\u2717";
  print(`${color(icon)} frontmatter coverage (durable): ${withFrontmatter}/${total} (${pct}%)`);
}
function findMissingIndexDirs(corpus) {
  const missing = [];
  function walk(dir) {
    if (!existsSync4(dir)) return;
    for (const entry of readdirSync3(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isDirectory()) continue;
      const full = join5(dir, entry.name);
      const rel = relPosix(corpus, full);
      if (isIndexExcluded(rel)) continue;
      if (isFolderPackage(full)) continue;
      let shouldHaveIndex = false;
      for (const name of readdirSync3(full)) {
        if (name.startsWith(".")) continue;
        if (name === "_INDEX.md" || name === ".gitkeep") continue;
        const childPath = join5(full, name);
        let stat;
        try {
          stat = lstatSync2(childPath);
        } catch {
          continue;
        }
        if (stat.isFile() && name.endsWith(".md")) {
          shouldHaveIndex = true;
          break;
        }
        if (stat.isDirectory() && isFolderPackage(childPath)) {
          shouldHaveIndex = true;
          break;
        }
      }
      if (shouldHaveIndex && !existsSync4(join5(full, "_INDEX.md"))) {
        missing.push(rel);
      }
      walk(full);
    }
  }
  walk(corpus);
  return missing;
}
function checkIndexFiles(corpus) {
  const missing = findMissingIndexDirs(corpus);
  for (const rel of missing) warn(`_INDEX.md missing in ${rel}/`);
  if (missing.length === 0) {
    ok("all directories with .md files have _INDEX.md");
  }
  return missing.length;
}
function inspectObsidianGraph(corpus) {
  try {
    const recommended = getRecommendedFilter();
    const cur = readCorpusFilter(corpus);
    if (!cur.exists) {
      return {
        status: "warn",
        message: "graph filter \u4E0D\u5B8C\u6574\uFF0C\u8FD0\u884C lorekit obsidian-tune \u67E5\u770B\u8BE6\u60C5"
      };
    }
    if (isFilterComplete(cur.search, recommended)) {
      return { status: "ok", message: "graph filter \u5B8C\u6574" };
    }
    return {
      status: "warn",
      message: "graph filter \u4E0D\u5B8C\u6574\uFF0C\u8FD0\u884C lorekit obsidian-tune \u67E5\u770B\u8BE6\u60C5"
    };
  } catch (e) {
    return { status: "warn", message: `\u68C0\u67E5 graph filter \u5931\u8D25: ${e.message}` };
  }
}
function checkObsidianGraph(corpus) {
  const result = inspectObsidianGraph(corpus);
  if (result.status === "ok") ok(`obsidian: ${result.message}`);
  else warn(`obsidian: ${result.message}`);
}
function inspectArchive(corpus) {
  const archiveDir = join5(corpus, "_\u5F52\u6863");
  if (existsSync4(archiveDir)) {
    return { status: "ok", exists: true };
  }
  return { status: "warn", exists: false, message: "_\u5F52\u6863/ not found (optional)" };
}
function checkArchive(corpus) {
  const result = inspectArchive(corpus);
  if (result.status === "ok") ok("_\u5F52\u6863/ exists");
  else warn(String(result.message));
  return 0;
}
function statusFromIssues(issues) {
  if (issues.some((issue) => issue.severity === "error")) return "error";
  if (issues.length > 0) return "warn";
  return "ok";
}
async function runDoctorReport(corpus, opts = {}) {
  const section = opts.section ?? "all";
  if (!parseDoctorSection(section)) throw new Error(`invalid section: ${section}`);
  const report = {
    status: "ok",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    corpus,
    sections: {},
    issues: [],
    hardIssues: 0
  };
  if (section === "all" || section === "structure") {
    const dirs = inspectDirs(corpus);
    report.sections.directories = {
      status: dirs.missing.length > 0 ? "error" : "ok",
      expected: EXPECTED_DIRS,
      missing: dirs.missing
    };
    for (const dir of dirs.missing) {
      report.issues.push({
        section: "directories",
        severity: "error",
        message: `${dir}/ missing`
      });
    }
  }
  if (section === "all" || section === "metadata") {
    const wiki = inspectWikiVersion(corpus);
    report.sections.wikiMetadata = {
      status: wiki.exists ? "ok" : "error",
      version: wiki.version,
      versionFileExists: wiki.exists
    };
    if (!wiki.exists) {
      report.issues.push({
        section: "wikiMetadata",
        severity: "error",
        message: ".wiki/version missing"
      });
    }
    const fm = inspectFrontmatterCoverage(corpus);
    report.sections.frontmatter = {
      status: fm.pct >= 90 ? "ok" : fm.pct >= 60 ? "warn" : "error",
      ...fm
    };
  }
  if (section === "all" || section === "index") {
    const missingIndexes = findMissingIndexDirs(corpus);
    report.sections.indexFiles = {
      status: missingIndexes.length > 0 ? "warn" : "ok",
      missing: missingIndexes
    };
    for (const rel of missingIndexes) {
      report.issues.push({
        section: "indexFiles",
        severity: "warn",
        message: `_INDEX.md missing in ${rel}/`
      });
    }
  }
  if (section === "all" || section === "archive") {
    report.sections.archive = inspectArchive(corpus);
  }
  if (section === "all" || section === "obsidian") {
    report.sections.obsidian = inspectObsidianGraph(corpus);
  }
  report.hardIssues = report.issues.filter((issue) => issue.severity === "error").length;
  report.status = statusFromIssues(report.issues);
  return report;
}
async function runDoctor(corpus, opts = {}) {
  const section = opts.section ?? "all";
  if (!parseDoctorSection(section)) throw new Error(`invalid section: ${section}`);
  print(chalk3.bold(`
lorekit doctor \u2014 ${corpus}
`));
  let issues = 0;
  if (section === "all" || section === "structure") {
    print(chalk3.cyan("\u2500\u2500 directories \u2500\u2500"));
    issues += checkDirs(corpus);
    print();
  }
  if (section === "all" || section === "metadata") {
    print(chalk3.cyan("\u2500\u2500 wiki metadata \u2500\u2500"));
    issues += checkWikiVersion(corpus);
    print();
    print(chalk3.cyan("\u2500\u2500 frontmatter \u2500\u2500"));
    checkFrontmatterCoverage(corpus);
    print();
  }
  if (section === "all" || section === "index") {
    print(chalk3.cyan("\u2500\u2500 index files \u2500\u2500"));
    issues += checkIndexFiles(corpus);
    print();
  }
  if (section === "all" || section === "archive") {
    print(chalk3.cyan("\u2500\u2500 archive \u2500\u2500"));
    checkArchive(corpus);
    print();
  }
  if (section === "all" || section === "obsidian") {
    print(chalk3.cyan("\u2500\u2500 obsidian \u2500\u2500"));
    checkObsidianGraph(corpus);
    print();
  }
  if (issues === 0) {
    print(chalk3.green.bold("all hard checks passed \u2713"));
  } else {
    print(chalk3.yellow(`${issues} issue(s) found`));
  }
  print();
  return issues;
}
function doctorCommand(program2) {
  program2.command("doctor").description("run health checks on the corpus").option("--json", "output machine-readable doctor report", false).option("--section <name>", `only run one section: ${validSectionList()}`, "all").action(async (opts) => {
    const section = parseDoctorSection(opts.section ?? "all");
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

// src/commands/stats.ts
import { readFileSync as readFileSync5, statSync as statSync2 } from "fs";
function statsCommand(program2) {
  program2.command("stats").description("output corpus statistics as JSON").action(() => {
    const corpus = requireCorpus();
    const files = collectMdFiles(corpus);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1e3;
    const byType = {};
    const byDir = {};
    const inboundLinks = /* @__PURE__ */ new Set();
    let recentActive7d = 0;
    let lastUpdated = "";
    for (const file of files) {
      const fm = extractFrontmatter(file);
      const type = fm.type || "unknown";
      byType[type] = (byType[type] || 0) + 1;
      const rel = relPosix(corpus, file);
      const topDir = rel.split("/")[0] || ".";
      byDir[topDir] = (byDir[topDir] || 0) + 1;
      try {
        const mtime = statSync2(file).mtime;
        if (now - mtime.getTime() < sevenDays) {
          recentActive7d++;
        }
        const iso = mtime.toISOString();
        if (iso > lastUpdated) lastUpdated = iso;
      } catch (e) {
        debug(`stats: stat(${file}) failed: ${e.message}`);
      }
      try {
        const content = readFileSync5(file, "utf-8");
        const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
        let m;
        while ((m = linkRe.exec(content)) !== null) {
          inboundLinks.add(m[1].trim());
        }
      } catch (e) {
        debug(`stats: readFileSync(${file}) failed: ${e.message}`);
      }
    }
    const orphans = [];
    for (const file of files) {
      const rel = relPosix(corpus, file);
      const stem = rel.replace(/\.md$/, "");
      const baseName = stem.split("/").pop();
      if (!inboundLinks.has(stem) && !inboundLinks.has(baseName)) {
        orphans.push(rel);
      }
    }
    const result = {
      total_pages: files.length,
      by_type: byType,
      by_dir: byDir,
      recent_active_7d: recentActive7d,
      orphans: orphans.length,
      last_updated: lastUpdated || null
    };
    out(JSON.stringify(result, null, 2));
  });
}

// src/commands/lint.ts
import { readFileSync as readFileSync7 } from "fs";
import { basename as basename3 } from "path";
import chalk4 from "chalk";

// src/lib/wikilinks.ts
import { existsSync as existsSync5, readdirSync as readdirSync4 } from "fs";
import { join as join6, dirname as dirname3, basename as basename2 } from "path";
function buildWikiLinkIndex(corpus, mdFiles) {
  const files = mdFiles ?? collectMdFiles(corpus);
  const stems = /* @__PURE__ */ new Set();
  const baseNames = /* @__PURE__ */ new Set();
  for (const file of files) {
    const rel = relPosix(corpus, file);
    const stem = rel.replace(/\.md$/, "");
    stems.add(stem);
    baseNames.add(stem.split("/").pop());
    if (stem.endsWith("/article")) {
      const folderStem = stem.replace(/\/article$/, "");
      stems.add(folderStem);
      baseNames.add(folderStem.split("/").pop());
    }
  }
  const allRelPaths = /* @__PURE__ */ new Set();
  const allBaseNames = /* @__PURE__ */ new Set();
  if (existsSync5(corpus)) {
    const walk = (d) => {
      for (const entry of readdirSync4(d, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        if (entry.isDirectory()) {
          if (alwaysExcludeDirNames.has(entry.name)) continue;
          walk(join6(d, entry.name));
        } else {
          allRelPaths.add(relPosix(corpus, join6(d, entry.name)));
          allBaseNames.add(entry.name);
        }
      }
    };
    walk(corpus);
  }
  return { stems, baseNames, allRelPaths, allBaseNames };
}
function resolveWikiLink(fromRel, target, index) {
  if (index.stems.has(target) || index.baseNames.has(target)) return true;
  const candidates = target.endsWith(".md") ? [target] : [target, `${target}.md`];
  const fromDir = dirname3(fromRel);
  for (const cand of candidates) {
    const relToFile = fromDir === "." ? cand : join6(fromDir, cand);
    if (index.allRelPaths.has(relToFile)) return true;
    if (index.allRelPaths.has(cand)) return true;
    if (index.allBaseNames.has(basename2(cand))) return true;
  }
  return false;
}

// src/lib/missing-nodes.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync2, readFileSync as readFileSync6, writeFileSync as writeFileSync2 } from "fs";
import { join as join7, dirname as dirname4 } from "path";

// src/lib/date.ts
var SHANGHAI_TZ_OFFSET_MS = 8 * 60 * 60 * 1e3;
function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayYMDShanghai() {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}
function dateToYMDUtc(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function dateToYMDLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function tsCompact(d = /* @__PURE__ */ new Date()) {
  return [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate()),
    "-",
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds())
  ].join("");
}
function tsMinute(d = /* @__PURE__ */ new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// src/lib/missing-nodes.ts
var MISSING_NODES_REL = "\u7CFB\u7EDF/missing-nodes.md";
function missingNodesPath(corpus) {
  return join7(corpus, MISSING_NODES_REL);
}
function ensureMissingNodes(corpus) {
  const p = missingNodesPath(corpus);
  if (existsSync6(p)) return readFileSync6(p, "utf-8");
  const today2 = todayYMDShanghai();
  const header = [
    "---",
    "type: system",
    "title: Missing Nodes",
    "slug: \u7CFB\u7EDF/missing-nodes",
    `created: ${today2}`,
    `updated: ${today2}`,
    "graph-excluded: true",
    "---",
    "",
    "# Missing Nodes\uFF08\u5F85\u5EFA\u8282\u70B9 backlog\uFF09",
    "",
    "> `lorekit links backlog` \u81EA\u52A8\u7EF4\u62A4\u3002\u6BCF\u884C\u4E00\u4E2A\u300C\u8BE5\u6709\u4F46\u8FD8\u6CA1\u5EFA\u300D\u7684\u77E5\u8BC6\u8282\u70B9\u3002",
    "> \u5EFA\u9875\u540E\u8BF7\u4ECE\u672C\u8868\u5220\u9664\u5BF9\u5E94\u884C\u3002",
    "",
    "| label | type | source | reason | added |",
    "| --- | --- | --- | --- | --- |",
    ""
  ].join("\n");
  mkdirSync2(dirname4(p), { recursive: true });
  writeFileSync2(p, header, "utf-8");
  return header;
}
function parseLabels(content) {
  const labels = [];
  const re = /^\|\s*([^|]+?)\s*\|/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const cell = m[1].trim();
    if (cell === "label" || /^-+$/.test(cell)) continue;
    if (cell) labels.push(cell);
  }
  return labels;
}
function backlogHasLabel(content, label) {
  return parseLabels(content).includes(label);
}
function readBacklogLabels(corpus) {
  const p = missingNodesPath(corpus);
  if (!existsSync6(p)) return /* @__PURE__ */ new Set();
  try {
    return new Set(parseLabels(readFileSync6(p, "utf-8")));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}

// src/commands/lint.ts
var REQUIRED_FIELDS = ["type", "title", "slug", "created", "updated"];
function isRootLevel(rel) {
  return !rel.includes("/");
}
function shouldSkipFrontmatter(rel) {
  const base = basename3(rel);
  if (lintSkipFrontmatterBasenames.has(base)) return true;
  if (isRootLevel(rel) && lintRootOnlySkipBasenames.has(base)) return true;
  for (const prefix of lintSkipFrontmatterPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}
function shouldSkipOrphan(rel) {
  const base = basename3(rel);
  if (lintSkipFrontmatterBasenames.has(base)) return true;
  if (isRootLevel(rel) && lintRootOnlySkipBasenames.has(base)) return true;
  for (const prefix of lintSkipOrphanPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}
function shouldSkipBrokenLink(rel) {
  for (const prefix of lintSkipBrokenLinkPrefixes) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}
function isGraphExcluded(fm) {
  return fm["graph-excluded"] === true || fm["graph_excluded"] === true;
}
var FRONTMATTER_SOURCE_KEYS = /* @__PURE__ */ new Set([
  "source",
  "sources",
  "source_path",
  "source_paths",
  "source_file",
  "source_files",
  "source_page",
  "source_pages",
  "source_ref",
  "source_refs"
]);
function collectStringValues(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, acc);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStringValues(item, acc);
    }
  }
  return acc;
}
function normalizeSourceRef(ref) {
  const trimmed = ref.trim();
  const wikilink = trimmed.match(/^\[\[([^\]|#]+)[^\]]*\]\]$/);
  return (wikilink ? wikilink[1] : trimmed).replace(/^\.?\//, "");
}
function frontmatterWorkbenchRefs(fm) {
  const refs = [];
  for (const [key, value] of Object.entries(fm)) {
    if (!FRONTMATTER_SOURCE_KEYS.has(key)) continue;
    for (const raw of collectStringValues(value)) {
      const ref = normalizeSourceRef(raw);
      if (ref === "_\u5DE5\u4F5C\u53F0" || ref.startsWith("_\u5DE5\u4F5C\u53F0/")) refs.push(ref);
    }
  }
  return refs;
}
var CORPUS_SOURCE_PREFIXES = ["\u539F\u6599/", "\u77E5\u8BC6\u5E93/"];
function frontmatterCorpusSourceRefs(fm) {
  const refs = [];
  for (const [key, value] of Object.entries(fm)) {
    if (!FRONTMATTER_SOURCE_KEYS.has(key)) continue;
    for (const raw of collectStringValues(value)) {
      const ref = normalizeSourceRef(raw);
      if (CORPUS_SOURCE_PREFIXES.some((p) => ref.startsWith(p))) refs.push(ref);
    }
  }
  return refs;
}
function stripCodeBlocks(content) {
  content = content.replace(/```[\s\S]*?```/g, "");
  content = content.replace(/`[^`\n]+`/g, "");
  return content;
}
var SOFT_ISSUE_KINDS = /* @__PURE__ */ new Set(["backlogged-link", "stale-review"]);
function countHardLintIssues(issues) {
  return issues.filter((i) => !SOFT_ISSUE_KINDS.has(i.kind)).length;
}
var REVIEW_WINDOW_DAYS = { high: 90, medium: 180, low: 365 };
function parseFmDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const m = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
    if (m) {
      const d = new Date(m[0]);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}
function checkStaleReview(rel, fm, now) {
  const volatility = typeof fm.domain_volatility === "string" ? fm.domain_volatility.trim() : "";
  const windowDays = REVIEW_WINDOW_DAYS[volatility];
  if (!windowDays) return null;
  const reviewed = parseFmDate(fm.last_reviewed) ?? parseFmDate(fm.updated);
  if (!reviewed) return null;
  const elapsedDays = Math.floor((now.getTime() - reviewed.getTime()) / 864e5);
  if (elapsedDays <= windowDays) return null;
  return {
    file: rel,
    kind: "stale-review",
    detail: `review overdue: volatility=${volatility} window=${windowDays}d last check ${elapsedDays}d ago`
  };
}
function runLint(corpus) {
  const files = collectMdFiles(corpus);
  const issues = [];
  const now = /* @__PURE__ */ new Date();
  const linkIndex = buildWikiLinkIndex(corpus, files);
  const backlogLabels = readBacklogLabels(corpus);
  const inboundLinks = /* @__PURE__ */ new Set();
  const fileLinks = /* @__PURE__ */ new Map();
  const fileFrontmatter = /* @__PURE__ */ new Map();
  for (const file of files) {
    const rel = relPosix(corpus, file);
    let fm = {};
    try {
      fm = extractFrontmatter(file);
    } catch {
    }
    fileFrontmatter.set(rel, fm);
    if (!shouldSkipFrontmatter(rel)) {
      for (const field of REQUIRED_FIELDS) {
        if (!fm[field]) {
          issues.push({
            file: rel,
            kind: "missing-field",
            detail: `missing frontmatter field: ${field}`
          });
        }
      }
    }
    const stale = checkStaleReview(rel, fm, now);
    if (stale) issues.push(stale);
    try {
      const content = stripCodeBlocks(readFileSync7(file, "utf-8"));
      const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
      const targets = [];
      let m;
      while ((m = linkRe.exec(content)) !== null) {
        const target = m[1].trim();
        targets.push(target);
        inboundLinks.add(target);
      }
      fileLinks.set(rel, targets);
    } catch {
    }
  }
  for (const [rel, targets] of fileLinks) {
    if (rel.startsWith("\u77E5\u8BC6\u5E93/")) {
      const fm = fileFrontmatter.get(rel) ?? {};
      for (const ref of frontmatterWorkbenchRefs(fm)) {
        issues.push({
          file: rel,
          kind: "workbench-source-link",
          detail: `knowledge page frontmatter cites process workbench as source: ${ref}`
        });
      }
      for (const target of targets) {
        if (target === "_\u5DE5\u4F5C\u53F0" || target.startsWith("_\u5DE5\u4F5C\u53F0/")) {
          issues.push({
            file: rel,
            kind: "workbench-source-link",
            detail: `knowledge page links process workbench as source: [[${target}]]`
          });
        }
      }
      for (const ref of frontmatterCorpusSourceRefs(fm)) {
        if (!resolveWikiLink(rel, ref, linkIndex)) {
          issues.push({
            file: rel,
            kind: "unresolved-source",
            detail: `frontmatter source not found: ${ref}`
          });
        }
      }
    }
    if (shouldSkipBrokenLink(rel)) continue;
    for (const target of targets) {
      if (!resolveWikiLink(rel, target, linkIndex)) {
        if (backlogLabels.has(target)) {
          issues.push({
            file: rel,
            kind: "backlogged-link",
            detail: `backlogged link: [[${target}]] (recorded in ${MISSING_NODES_REL})`
          });
        } else {
          issues.push({
            file: rel,
            kind: "broken-link",
            detail: `broken link: [[${target}]]`
          });
        }
      }
    }
  }
  for (const file of files) {
    const rel = relPosix(corpus, file);
    if (shouldSkipOrphan(rel)) continue;
    const fm = fileFrontmatter.get(rel) ?? {};
    if (isGraphExcluded(fm)) continue;
    const stem = rel.replace(/\.md$/, "");
    const baseName = stem.split("/").pop();
    let hasInbound = inboundLinks.has(stem) || inboundLinks.has(baseName);
    if (!hasInbound && stem.endsWith("/article")) {
      const folderStem = stem.replace(/\/article$/, "");
      const folderName = folderStem.split("/").pop();
      hasInbound = inboundLinks.has(folderStem) || inboundLinks.has(folderName);
    }
    if (!hasInbound) {
      issues.push({
        file: rel,
        kind: "orphan",
        detail: "orphan page (no inbound links)"
      });
    }
  }
  return issues;
}
function printLintReport(corpus, issues) {
  print(chalk4.bold(`
lorekit lint \u2014 ${corpus}
`));
  if (issues.length === 0) {
    ok("no issues found");
    print();
    return;
  }
  const grouped = {};
  for (const issue of issues) {
    (grouped[issue.kind] ??= []).push(issue);
  }
  const kindLabels = {
    "missing-field": "frontmatter",
    "broken-link": "broken links",
    "backlogged-link": "backlogged links (known missing, not counted)",
    "workbench-source-link": "workbench source links",
    "stale-review": "stale reviews (review window exceeded, not counted)",
    "unresolved-source": "unresolved frontmatter sources",
    orphan: "orphan pages"
  };
  for (const [kind, items] of Object.entries(grouped)) {
    print(chalk4.cyan(`\u2500\u2500 ${kindLabels[kind] ?? kind} (${items.length}) \u2500\u2500`));
    for (const item of items) {
      if (SOFT_ISSUE_KINDS.has(kind)) print(chalk4.dim(`  ${item.file}: ${item.detail}`));
      else bad(`${item.file}: ${item.detail}`);
    }
    print();
  }
  const hard = countHardLintIssues(issues);
  const soft = issues.length - hard;
  if (hard === 0) {
    ok(`no hard issues (${soft} soft notice(s): backlogged links / stale reviews)`);
    print();
  } else {
    const suffix = soft > 0 ? ` (+${soft} soft notice(s), not counted)` : "";
    print(chalk4.yellow(`${hard} issue(s) total${suffix}
`));
  }
}
function lintCommand(program2) {
  program2.command("lint").description("check frontmatter, broken wikilinks, orphan pages, and stale reviews").option("--quick", "compatibility alias for the default lint scan", false).action(() => {
    const corpus = requireCorpus();
    const issues = runLint(corpus);
    printLintReport(corpus, issues);
    if (countHardLintIssues(issues) > 0) process.exitCode = 1;
  });
}

// src/commands/audit.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync3, readFileSync as readFileSync8, writeFileSync as writeFileSync3 } from "fs";
import { join as join8, basename as basename4 } from "path";
var SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };
function extractPreview(filePath) {
  const content = readFileSync8(filePath, "utf-8");
  const lines = content.split("\n");
  let inFm = false;
  for (const line of lines) {
    if (line.trimEnd() === "---") {
      if (!inFm) {
        inFm = true;
        continue;
      } else {
        inFm = false;
        continue;
      }
    }
    if (inFm) continue;
    if (line.trim() === "") continue;
    return line.trim();
  }
  return "";
}
function listAudit(root, filter) {
  const dirs = [];
  if (filter === "open" || filter === "all") dirs.push(join8(root, "\u53CD\u9988", "\u5F85\u5904\u7406"));
  if (filter === "resolved" || filter === "all") dirs.push(join8(root, "\u53CD\u9988", "\u5DF2\u5904\u7406"));
  const entries = [];
  for (const dir of dirs) {
    if (!existsSync7(dir)) continue;
    const files = collectMdFiles(dir);
    for (const f of files) {
      if (basename4(f) === ".gitkeep") continue;
      if (!hasFrontmatter(f)) continue;
      const fm = extractFrontmatter(f);
      const severity = fm.severity ?? "";
      const target = fm.target ?? "";
      const created = fm.created ?? "";
      const status = fm.status ?? "";
      const preview = extractPreview(f);
      entries.push({
        severity,
        sevOrder: SEVERITY_ORDER[severity] ?? 0,
        target,
        status,
        created,
        preview
      });
    }
  }
  if (entries.length === 0) {
    print("No audit entries found.");
    return;
  }
  entries.sort((a, b) => b.sevOrder - a.sevOrder);
  for (const e of entries) {
    print(`[${e.severity}] ${e.target} \u2014 ${e.preview} (${e.created}) [${e.status}]`);
  }
  print();
  print(`Total: ${entries.length} entries`);
}
function createAudit(root, target, severity, text) {
  if (!target) {
    err("audit --create requires --target");
    process.exit(2);
  }
  if (!severity) {
    err("audit --create requires --severity");
    process.exit(2);
  }
  if (!text) {
    err("audit --create requires --text");
    process.exit(2);
  }
  if (!["low", "medium", "high"].includes(severity)) {
    err(`severity must be low|medium|high, got: ${severity}`);
    process.exit(2);
  }
  const slug = basename4(target, ".md").replace(/[\s/]/g, "-").toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const filename = `${tsCompact(now)}-${slug}.md`;
  const tsFm = tsMinute(now);
  const destDir = join8(root, "\u53CD\u9988", "\u5F85\u5904\u7406");
  mkdirSync3(destDir, { recursive: true });
  const dest = join8(destDir, filename);
  const content = `---
type: audit
target: ${target}
severity: ${severity}
status: open
created: ${tsFm}
---

${text}
`;
  writeFileSync3(dest, content, "utf-8");
  ok(`created: \u53CD\u9988/\u5F85\u5904\u7406/${filename}`);
  print(`  target:   ${target}`);
  print(`  severity: ${severity}`);
}
function auditCommand(program2) {
  const cmd = program2.command("audit").description("Human feedback loop for corpus content").option("--list", "List entries (default)").option("--open", "Only show open (\u5F85\u5904\u7406) entries").option("--resolved", "Only show resolved (\u5DF2\u5904\u7406) entries").option("--create", "Create a new audit entry").option("--target <file>", "Target file path (relative to corpus root)").option("--severity <level>", "Severity: low | medium | high").option("--text <text>", "Feedback text");
  cmd.action((opts) => {
    const root = requireCorpus();
    if (opts.create) {
      createAudit(root, opts.target ?? "", opts.severity ?? "", opts.text ?? "");
    } else {
      let filter = "all";
      if (opts.open) filter = "open";
      else if (opts.resolved) filter = "resolved";
      listAudit(root, filter);
    }
  });
}

// src/commands/dir-index.ts
import { existsSync as existsSync8, readdirSync as readdirSync5, readFileSync as readFileSync9, statSync as statSync3, writeFileSync as writeFileSync4, lstatSync as lstatSync3 } from "fs";
import { join as join9, basename as basename5, resolve as resolve2 } from "path";
function extractSummary(filePath) {
  const content = readFileSync9(filePath, "utf-8");
  const lines = content.split("\n");
  let found = false;
  for (const line of lines) {
    if (/^## Compiled Truth/.test(line)) {
      found = true;
      continue;
    }
    if (!found) continue;
    if (/^---\s*$/.test(line)) break;
    if (/^## /.test(line)) break;
    if (line.trim() === "") continue;
    const text = line.trim().replace(/^\*\*[^*]*\*\*\s*/, "");
    const periodMatch = text.match(/^([^。.]*[。.])/);
    if (periodMatch && periodMatch[1].length <= 50) return periodMatch[1];
    return text.slice(0, 50);
  }
  return "";
}
function readEntryFromFile(filePath, slug) {
  let title = "";
  let updated = "";
  let summary = "";
  if (hasFrontmatter(filePath)) {
    const fm = extractFrontmatter(filePath);
    title = typeof fm.title === "string" ? fm.title : fm.title != null ? String(fm.title) : "";
    if (fm.updated instanceof Date) {
      updated = dateToYMDUtc(fm.updated);
    } else {
      updated = fm.updated != null ? String(fm.updated) : "";
    }
    summary = extractSummary(filePath);
    if (!summary) summary = "\u2014";
  } else {
    summary = "\uFF08\u7F3A\u5C11 frontmatter\uFF09";
  }
  if (!title) title = basename5(filePath, ".md");
  if (!updated) {
    try {
      updated = dateToYMDLocal(statSync3(filePath).mtime);
    } catch {
      updated = "unknown";
    }
  }
  return { slug, title, summary, updated };
}
function escapeCell(s) {
  return s.replace(/\|/g, "\\|");
}
function buildIndex(dir, root) {
  const reldir = dir === root ? "" : relPosix(root, dir);
  const dirName = reldir === "" ? basename5(root) : basename5(dir);
  const indexFile = join9(dir, "_INDEX.md");
  let names;
  try {
    names = readdirSync5(dir, { encoding: "utf-8" });
  } catch {
    return false;
  }
  const entries = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    if (name === "_INDEX.md" || name === ".gitkeep") continue;
    const full = join9(dir, name);
    let stat;
    try {
      stat = lstatSync3(full);
    } catch {
      continue;
    }
    if (stat.isFile() && name.endsWith(".md")) {
      const slug = relPosix(root, full).replace(/\.md$/, "");
      entries.push(readEntryFromFile(full, slug));
    } else if (stat.isDirectory() && isFolderPackage(full)) {
      const articlePath = join9(full, "article.md");
      const slug = relPosix(root, full);
      entries.push(readEntryFromFile(articlePath, slug));
    }
  }
  if (entries.length === 0) return false;
  entries.sort((a, b) => b.updated.localeCompare(a.updated));
  const lines = [];
  lines.push(`# ${dirName}`);
  lines.push("");
  lines.push(`> \u672C\u76EE\u5F55\u5171 ${entries.length} \u4E2A\u6761\u76EE\u3002\u7531 \`lorekit index\` \u81EA\u52A8\u751F\u6210\u3002`);
  lines.push("");
  lines.push("| \u6761\u76EE | \u6458\u8981 | \u66F4\u65B0 |");
  lines.push("|---|---|---|");
  for (const e of entries) {
    lines.push(`| [[${e.slug}]] | ${escapeCell(e.summary)} | ${e.updated} |`);
  }
  lines.push("");
  writeFileSync4(indexFile, lines.join("\n"), "utf-8");
  const display = reldir === "" ? "_INDEX.md" : `${reldir}/_INDEX.md`;
  ok(`${display} (${entries.length} entries)`);
  return true;
}
function findIndexableDirs(root) {
  const results = [];
  function walk(dir, isRoot) {
    const rel = dir === root ? "" : relPosix(root, dir);
    if (rel && isIndexExcluded(rel)) return;
    let names;
    try {
      names = readdirSync5(dir, { encoding: "utf-8" });
    } catch {
      return;
    }
    if (!isRoot) {
      let hasIndexable = false;
      for (const name of names) {
        if (name.startsWith(".")) continue;
        if (name === "_INDEX.md" || name === ".gitkeep") continue;
        const full = join9(dir, name);
        let stat;
        try {
          stat = lstatSync3(full);
        } catch {
          continue;
        }
        if (stat.isFile() && name.endsWith(".md")) {
          hasIndexable = true;
          break;
        }
        if (stat.isDirectory() && isFolderPackage(full)) {
          hasIndexable = true;
          break;
        }
      }
      if (hasIndexable) results.push(dir);
    }
    for (const name of names) {
      if (name.startsWith(".")) continue;
      const full = join9(dir, name);
      let stat;
      try {
        stat = lstatSync3(full);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (isFolderPackage(full)) continue;
      walk(full, false);
    }
  }
  walk(root, true);
  return results.sort();
}
function runIndex(root, specificDir) {
  if (specificDir) {
    const full = join9(root, specificDir);
    if (!existsSync8(full)) {
      throw new Error(`directory not found: ${specificDir}`);
    }
    if (resolve2(full) === resolve2(root)) {
      throw new Error(
        `cannot index the corpus root itself \u2014 L0 corpus/index.md already serves this role`
      );
    }
    const rel = relPosix(root, full);
    if (isIndexExcluded(rel)) {
      throw new Error(
        `directory "${rel}" is in the exclude list (${indexExcludeDirPrefixes.join(" / ")})`
      );
    }
    return buildIndex(full, root) ? 1 : 0;
  }
  const dirs = findIndexableDirs(root);
  if (dirs.length === 0) return 0;
  let generated = 0;
  for (const d of dirs) {
    if (buildIndex(d, root)) generated++;
  }
  return generated;
}
function indexCommand(program2) {
  const cmd = program2.command("index").description("Generate _INDEX.md recursively for corpus directories").option("--dir <subdir>", "Only update a specific subdirectory");
  cmd.action((opts) => {
    const root = requireCorpus();
    try {
      if (opts.dir) {
        runIndex(root, opts.dir);
      } else {
        const generated = runIndex(root);
        if (generated === 0) {
          warn("no indexable directories found");
        } else {
          ok(`generated ${generated} _INDEX.md file(s)`);
        }
      }
    } catch (e) {
      err(e.message);
      process.exit(1);
    }
  });
}

// src/commands/install-skills.ts
import {
  existsSync as existsSync9,
  mkdirSync as mkdirSync4,
  readdirSync as readdirSync6,
  symlinkSync,
  unlinkSync,
  readlinkSync,
  lstatSync as lstatSync4,
  cpSync as cpSync2
} from "fs";
import { join as join10, resolve as resolve3 } from "path";
import { homedir } from "os";
var SUPPORTED_TARGETS = ["claude-code", "codex", "project"];
var SUPPORTED_MODES = ["copy", "symlink"];
var SKILL_PREFIXES = ["wiki-", "corpus-"];
function isSymlink(path) {
  try {
    return lstatSync4(path).isSymbolicLink();
  } catch {
    return false;
  }
}
function targetSkillsDir(target, dest) {
  if (dest) return resolve3(dest);
  const home = homedir();
  if (target === "codex") return join10(home, ".agents", "skills");
  if (target === "project") return join10(process.cwd(), "skills");
  return join10(home, ".claude", "skills");
}
function parseTarget(target) {
  if (!target) return null;
  return SUPPORTED_TARGETS.includes(target) ? target : null;
}
function parseMode(mode) {
  const resolved = mode ?? (process.platform === "win32" ? "copy" : "symlink");
  return SUPPORTED_MODES.includes(resolved) ? resolved : null;
}
function parseOnlyNames(only) {
  if (!only) return null;
  return new Set(
    only.split(",").map((name) => name.trim()).filter(Boolean)
  );
}
function isLorekitSkillName(name) {
  return SKILL_PREFIXES.some((prefix) => name.startsWith(prefix));
}
function isProjectWorkflowSkillName(name) {
  return name.startsWith("wiki-") && name !== "wiki-daily";
}
function isDefaultSkill(name) {
  return isProjectWorkflowSkillName(name);
}
function supportedTargetsText() {
  return SUPPORTED_TARGETS.join(", ");
}
function targetReloadHint(target) {
  if (target === "codex") return "Restart Codex to load them.";
  if (target === "claude-code") return "Restart Claude Code to load them.";
  return "Project-local skills are ready in ./skills; route them from AGENTS.md or CLAUDE.md.";
}
function installSkillsCommand(program2) {
  const cmd = program2.command("install-skills").description("Install lorekit-managed skills into a harness or the current project").option("--target <target>", 'Target ("claude-code", "codex", or "project")').option("--only <names>", "Install only selected skill directory names, comma-separated").option("--mode <mode>", 'Install mode: "symlink" or "copy" (default: symlink; copy on Windows)').option("--dest <dir>", "Override destination directory, mainly for --target project").option("--list", "List currently installed lorekit-managed skill symlinks").option("--uninstall", "Remove installed skill symlinks");
  cmd.action((opts) => {
    const target = parseTarget(opts.target);
    if (opts.target && !target) {
      err(`target '${opts.target}' not supported; supported targets: ${supportedTargetsText()}`);
      process.exit(2);
    }
    const listTarget = target ?? "claude-code";
    const skillsDest = targetSkillsDir(listTarget, opts.dest);
    if (opts.list) {
      if (!existsSync9(skillsDest)) return;
      const names = readdirSync6(skillsDest, { encoding: "utf-8" });
      for (const name of names) {
        if (!isLorekitSkillName(name)) continue;
        const full = join10(skillsDest, name);
        if (!isSymlink(full)) continue;
        const target2 = readlinkSync(full);
        out(`${name} -> ${target2}`);
      }
      return;
    }
    if (!target) {
      if (!opts.target) {
        err("install-skills: --target required");
        process.exit(2);
      }
      err(`target '${opts.target}' not supported; supported targets: ${supportedTargetsText()}`);
      process.exit(2);
    }
    const mode = parseMode(opts.mode);
    if (!mode) {
      err(`mode '${opts.mode}' not supported; supported modes: copy, symlink`);
      process.exit(2);
    }
    if (opts.uninstall && mode === "copy") {
      err("install-skills: --uninstall only removes symlink installs");
      process.exit(2);
    }
    mkdirSync4(skillsDest, { recursive: true });
    const skillsSrc = join10(lorekitRoot(), "skills");
    if (!existsSync9(skillsSrc)) {
      err(`skills directory not found: ${skillsSrc}`);
      process.exit(1);
    }
    const onlyNames = parseOnlyNames(opts.only);
    const allNames = readdirSync6(skillsSrc, { encoding: "utf-8" });
    const skillNames = allNames.filter((name) => {
      if (!isLorekitSkillName(name)) return false;
      if (onlyNames && !onlyNames.has(name)) return false;
      if (!onlyNames && !isDefaultSkill(name)) return false;
      try {
        return lstatSync4(join10(skillsSrc, name)).isDirectory();
      } catch {
        return false;
      }
    });
    let count = 0;
    for (const name of skillNames) {
      const srcDir = join10(skillsSrc, name);
      const skillFile = join10(srcDir, "SKILL.md");
      if (!existsSync9(skillFile)) continue;
      const dest = join10(skillsDest, name);
      if (opts.uninstall) {
        if (isSymlink(dest)) {
          unlinkSync(dest);
          ok(`removed ${name}`);
          count++;
        }
      } else {
        if (mode === "symlink") {
          if (isSymlink(dest)) {
            unlinkSync(dest);
          } else if (existsSync9(dest)) {
            err(`destination already exists and is not a symlink: ${dest}`);
            process.exit(1);
          }
          symlinkSync(srcDir, dest);
          ok(`linked ${name}`);
        } else {
          if (existsSync9(dest)) {
            err(`destination already exists: ${dest}`);
            process.exit(1);
          }
          cpSync2(srcDir, dest, { recursive: true });
          ok(`copied ${name}`);
        }
        count++;
      }
    }
    if (count === 0) {
      print("No skills found to install.");
    } else if (!opts.uninstall) {
      print(`
Installed ${count} skill(s). ${targetReloadHint(target)}`);
    }
  });
}

// src/commands/snapshot.ts
import {
  existsSync as existsSync10,
  mkdirSync as mkdirSync5,
  writeFileSync as writeFileSync5,
  unlinkSync as unlinkSync2,
  readdirSync as readdirSync7,
  statSync as statSync4
} from "fs";
import { join as join11 } from "path";
import * as tar from "tar";
function collectAllFiles(dir, base) {
  const results = [];
  function walk(d) {
    for (const entry of readdirSync7(d, { withFileTypes: true })) {
      if (snapshotExcludeNames.has(entry.name)) continue;
      const full = join11(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(relPosix(base, full));
      }
    }
  }
  walk(dir);
  return results.sort();
}
async function createSnapshot(corpus, opts = {}) {
  const snapshotsDir = join11(corpus, ".wiki", "snapshots");
  mkdirSync5(snapshotsDir, { recursive: true });
  const files = collectAllFiles(corpus, corpus);
  if (files.length === 0) {
    throw new Error("no files found in corpus");
  }
  const manifest = files.map((relPath) => {
    const full = join11(corpus, relPath);
    const st = statSync4(full);
    return {
      path: relPath,
      sha256: sha256(full),
      bytes: st.size,
      mtime: st.mtime.toISOString()
    };
  });
  const manifestPath = join11(snapshotsDir, "manifest.json");
  writeFileSync5(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  try {
    const tag = opts.tag ? `-${opts.tag}` : "";
    const tarName = `${tsCompact()}${tag}.tar.gz`;
    const tarPath = join11(snapshotsDir, tarName);
    const allEntries = [...files, relPosix(corpus, manifestPath)];
    await tar.create(
      {
        gzip: true,
        file: tarPath,
        cwd: corpus,
        prefix: ""
      },
      allEntries
    );
    return tarPath;
  } finally {
    if (existsSync10(manifestPath)) unlinkSync2(manifestPath);
  }
}
function snapshotCommand(program2) {
  program2.command("snapshot").option("--tag <name>", "optional tag appended to filename").description("create a tarball snapshot of the corpus").action(async (opts) => {
    const corpus = requireCorpus();
    try {
      const tarPath = await createSnapshot(corpus, opts);
      const tarStat = statSync4(tarPath);
      const sizeMB = (tarStat.size / 1024 / 1024).toFixed(1);
      const count = collectAllFiles(corpus, corpus).length;
      ok(`snapshot saved: ${tarPath} (${count} files, ${sizeMB} MB)`);
    } catch (e) {
      const message = e.message;
      if (message === "no files found in corpus") {
        bad(message);
      } else {
        err(message);
        process.exitCode = 1;
      }
      return;
    }
  });
}

// src/commands/restore.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync6, readFileSync as readFileSync10, copyFileSync, rmSync } from "fs";
import { join as join12, dirname as dirname5, isAbsolute } from "path";
import { createInterface as createInterface2 } from "readline";
import { tmpdir } from "os";
import * as tar2 from "tar";
import chalk5 from "chalk";
function ask2(question) {
  const rl = createInterface2({ input: process.stdin, output: process.stdout });
  return new Promise((resolve6) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve6(answer.trim());
    });
  });
}
function rmDirRecursive(dir) {
  rmSync(dir, { recursive: true, force: true });
}
function restoreCommand(program2) {
  program2.command("restore").requiredOption("--from <snapshot>", "path to snapshot .tar.gz").option("--dry-run", "only list differences, do not restore").option("--file <path>", "restore only this specific file").description("restore files from a snapshot").action(async (opts) => {
    const corpus = requireCorpus();
    if (!existsSync11(opts.from)) {
      bad(`snapshot not found: ${opts.from}`);
      process.exitCode = 2;
      return;
    }
    const tmpDir = join12(tmpdir(), `lorekit-restore-${Date.now()}`);
    mkdirSync6(tmpDir, { recursive: true });
    try {
      await tar2.extract({
        file: opts.from,
        cwd: tmpDir
      });
      const manifestPath = join12(tmpDir, ".wiki", "snapshots", "manifest.json");
      if (!existsSync11(manifestPath)) {
        bad("manifest.json not found in snapshot");
        process.exitCode = 1;
        return;
      }
      const manifest = JSON.parse(readFileSync10(manifestPath, "utf-8"));
      const diffs = [];
      for (const entry of manifest) {
        if (opts.file && entry.path !== opts.file) continue;
        if (isAbsolute(entry.path) || entry.path.split(/[/\\]/).includes("..")) {
          bad(`refuse to restore outside corpus: ${entry.path}`);
          process.exitCode = 1;
          return;
        }
        const corpusPath = join12(corpus, entry.path);
        if (!isWithin(corpus, corpusPath)) {
          bad(`refuse to restore outside corpus: ${entry.path}`);
          process.exitCode = 1;
          return;
        }
        if (!existsSync11(corpusPath)) {
          diffs.push({
            kind: "MISSING",
            path: entry.path,
            snapshotSha: entry.sha256,
            currentSha: null
          });
        } else {
          const currentSha = sha256(corpusPath);
          if (currentSha !== entry.sha256) {
            diffs.push({
              kind: "CHANGED",
              path: entry.path,
              snapshotSha: entry.sha256,
              currentSha
            });
          }
        }
      }
      if (diffs.length === 0) {
        ok("corpus matches snapshot \u2014 nothing to restore");
        return;
      }
      const missing = diffs.filter((d) => d.kind === "MISSING");
      const changed = diffs.filter((d) => d.kind === "CHANGED");
      if (missing.length > 0) {
        print(chalk5.yellow(`
  MISSING (${missing.length}):`));
        for (const d of missing) {
          print(`    + ${d.path}`);
        }
      }
      if (changed.length > 0) {
        print(chalk5.cyan(`
  CHANGED (${changed.length}):`));
        for (const d of changed) {
          print(`    ~ ${d.path}`);
        }
      }
      print();
      if (opts.dryRun) {
        warn(`dry-run: ${diffs.length} file(s) would be restored`);
        return;
      }
      const answer = await ask2(`  restore ${diffs.length} file(s)? [y/N] `);
      if (answer.toLowerCase() !== "y") {
        bad("cancelled");
        return;
      }
      let restored = 0;
      for (const d of diffs) {
        const src = join12(tmpDir, d.path);
        const dest = join12(corpus, d.path);
        if (!isWithin(corpus, dest)) {
          bad(`refuse to restore outside corpus: ${d.path}`);
          process.exitCode = 1;
          return;
        }
        if (!existsSync11(src)) {
          warn(`file not in snapshot archive: ${d.path}`);
          continue;
        }
        mkdirSync6(dirname5(dest), { recursive: true });
        copyFileSync(src, dest);
        restored++;
      }
      ok(`restored ${restored} file(s) from snapshot`);
    } finally {
      rmDirRecursive(tmpDir);
    }
  });
}

// src/commands/search.ts
import { readFileSync as readFileSync11 } from "fs";
import { join as join13 } from "path";
import { spawnSync } from "child_process";
function activeExcludePrefixes(opts) {
  if (opts.dir) return [];
  return opts.all ? searchAllExcludePrefixes : searchDefaultExcludePrefixes;
}
function searchWithRipgrep(query, corpus, opts) {
  const searchDir = opts.dir ? join13(corpus, opts.dir) : corpus;
  if (opts.dir && !isWithin(corpus, searchDir)) {
    err(`search --dir must stay within corpus; got: ${opts.dir}`);
    process.exit(2);
  }
  const args = ["--json", "--no-heading", "-i"];
  if (opts.type) {
    args.push("--type", opts.type);
  }
  for (const prefix of activeExcludePrefixes(opts)) {
    args.push("--glob", `!${prefix}/**`);
  }
  args.push(query, searchDir);
  const result = spawnSync("rg", args, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) {
    return [];
  }
  const results = [];
  for (const line of (result.stdout || "").split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "match") {
        results.push({
          file: relPosix(corpus, obj.data.path.text),
          line: obj.data.line_number,
          text: obj.data.lines.text.trimEnd()
        });
      }
    } catch {
    }
  }
  return results;
}
function searchFallback(query, corpus, opts) {
  const searchDir = opts.dir ? join13(corpus, opts.dir) : corpus;
  if (opts.dir && !isWithin(corpus, searchDir)) {
    err(`search --dir must stay within corpus; got: ${opts.dir}`);
    process.exit(2);
  }
  const excludes = activeExcludePrefixes(opts);
  const files = collectMdFiles(searchDir).filter((file) => {
    if (opts.dir) return true;
    const rel = relPosix(corpus, file);
    return !excludes.some((prefix) => matchesDirPrefix(rel, prefix));
  });
  const pattern = new RegExp(query, "i");
  const results = [];
  for (const filePath of files) {
    const content = readFileSync11(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        results.push({
          file: relPosix(corpus, filePath),
          line: i + 1,
          text: lines[i].trimEnd()
        });
      }
    }
  }
  return results;
}
function hasRipgrep() {
  const result = spawnSync("rg", ["--version"], { encoding: "utf-8" });
  return !result.error && result.status === 0;
}
function searchCommand(program2) {
  program2.command("search").argument("<query>", "search query (regex supported)").option("--type <t>", "file type filter (passed to rg --type)").option("--dir <d>", "subdirectory within corpus to search").option(
    "--all",
    "include process layers (\u5DE5\u4F5C\u53F0/\u5F52\u6863/\u8F93\u51FA etc.); still skips .wiki/.git and _\u5DE5\u4F5C\u53F0/\u8F6C\u5199"
  ).description("search the corpus with ripgrep (fallback: built-in)").action((query, opts) => {
    if (opts.all && opts.dir) {
      err("search --all and --dir are mutually exclusive; --dir already searches without default excludes");
      process.exit(2);
    }
    const corpus = requireCorpus();
    let results;
    if (hasRipgrep()) {
      results = searchWithRipgrep(query, corpus, opts);
    } else {
      warn("rg (ripgrep) not found, using built-in fallback");
      results = searchFallback(query, corpus, { dir: opts.dir, all: opts.all });
    }
    for (const r of results) {
      out(JSON.stringify(r));
    }
    if (results.length === 0) {
      warn("no results");
    }
  });
}

// src/commands/fetch.ts
import { existsSync as existsSync13, mkdirSync as mkdirSync8 } from "fs";
import { join as join19 } from "path";
import { tmpdir as tmpdir2 } from "os";

// src/lib/fetcher/index.ts
import { mkdir as mkdir4, writeFile as writeFile4 } from "fs/promises";
import { join as join17 } from "path";

// src/lib/fetcher/frontmatter.ts
function escapeDoubleQuote(s) {
  return s.replace(/"/g, '\\"');
}
function buildFrontmatter(opts) {
  const { routeKind, title, today: today2, url, author, publishDate } = opts;
  const omitPublishDate = routeKind === "github";
  const lines = ["---"];
  lines.push("type: source");
  if (title) {
    lines.push(`title: "${escapeDoubleQuote(title)}"`);
  }
  lines.push(`created: ${today2}`);
  lines.push(`updated: ${today2}`);
  lines.push(`source_url: ${url}`);
  if (author) {
    lines.push(`source_author: "${escapeDoubleQuote(author)}"`);
  }
  if (!omitPublishDate && publishDate) {
    lines.push(`source_date: ${publishDate}`);
  }
  lines.push(`source_kind: ${routeKind}`);
  lines.push("---");
  return lines;
}

// src/lib/fetcher/helpers.ts
import TurndownService from "turndown";
function slugify(s) {
  const slug = s.replace(/[^\w\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 50) || "untitled";
}
function resolveUrl(src, base) {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}
function htmlToMarkdown(html) {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced"
  });
  return td.turndown(html).trim();
}
var SHANGHAI_TZ_OFFSET_MS2 = 8 * 60 * 60 * 1e3;
function tsToYMD(seconds) {
  const d = new Date(seconds * 1e3 + SHANGHAI_TZ_OFFSET_MS2);
  return d.toISOString().slice(0, 10);
}
function todayYMD() {
  const d = new Date(Date.now() + SHANGHAI_TZ_OFFSET_MS2);
  return d.toISOString().slice(0, 10);
}
function normalizeDateText(raw) {
  const s = raw.trim();
  if (!s) return void 0;
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const zh = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (zh) {
    const [, y, m, d] = zh;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return void 0;
}

// src/lib/fetcher/http.ts
var UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
var UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var HTTP_TIMEOUT_MS = 2e4;
var ANTIBOT_TRIGGERS = [
  "\u73AF\u5883\u5F02\u5E38",
  "\u8BF7\u5728\u5FAE\u4FE1\u5BA2\u6237\u7AEF\u6253\u5F00",
  "\u5B8C\u6210\u9A8C\u8BC1\u540E\u5373\u53EF\u7EE7\u7EED",
  "Just a moment",
  "cf-browser-verification"
];
function detectSite(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("mp.weixin.qq.com")) return "weixin";
  } catch {
  }
  return "generic";
}
function buildHeaders(site) {
  if (site === "weixin") {
    return {
      "User-Agent": UA_IPHONE,
      Referer: "https://mp.weixin.qq.com/",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
  }
  return {
    "User-Agent": UA_DESKTOP,
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
}
function detectAntibot(html, site) {
  if (ANTIBOT_TRIGGERS.some((t) => html.includes(t))) return true;
  if (site === "weixin" && !html.includes("js_content")) return true;
  return false;
}
async function fetchHtmlL1(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
async function fetchHtmlL2(url) {
  try {
    const pw = await import("playwright-core");
    const browser = await pw.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 6e4 });
      return await page.content();
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

// src/lib/fetcher/images.ts
import { mkdir, writeFile } from "fs/promises";
import { join as join14 } from "path";
var MAX_IMG_BYTES = 5 * 1024 * 1024;
var IMG_CONCURRENCY = 5;
var MAGIC = [
  [[255, 216, 255], ".jpg"],
  [[137, 80, 78, 71, 13, 10, 26, 10], ".png"],
  // \x89PNG\r\n\x1a\n
  [[71, 73, 70, 56, 55, 97], ".gif"],
  // GIF87a
  [[71, 73, 70, 56, 57, 97], ".gif"]
  // GIF89a
];
function sniffExt(head, contentType) {
  for (const [sig, ext] of MAGIC) {
    if (sig.every((b, i) => head[i] === b)) return ext;
  }
  if (head[0] === 82 && head[1] === 73 && head[2] === 70 && head[3] === 70 && head[8] === 87 && head[9] === 69 && head[10] === 66 && head[11] === 80) {
    return ".webp";
  }
  const ct = contentType.toLowerCase();
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return ".jpg";
  if (ct.includes("image/png")) return ".png";
  if (ct.includes("image/gif")) return ".gif";
  if (ct.includes("image/webp")) return ".webp";
  if (ct.includes("image/svg")) return ".svg";
  return null;
}
async function downloadOneImage(url, idx, imagesDir, headers, assetsRelPath) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const cl = Number(res.headers.get("content-length") || 0);
      if (cl && cl > MAX_IMG_BYTES) {
        return { originalUrl: url, localRel: null, status: "too_large" };
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_IMG_BYTES) {
        return { originalUrl: url, localRel: null, status: "too_large" };
      }
      const data = new Uint8Array(buf);
      const ext = sniffExt(data.slice(0, 16), res.headers.get("content-type") || "");
      if (!ext) continue;
      const fname = `img_${String(idx).padStart(2, "0")}${ext}`;
      await writeFile(join14(imagesDir, fname), data);
      return { originalUrl: url, localRel: `${assetsRelPath}${fname}`, status: "ok" };
    } catch {
    }
  }
  return { originalUrl: url, localRel: null, status: "failed" };
}
async function downloadImages(imgSrcs, imagesDir, headers, assetsRelPath) {
  if (imgSrcs.length === 0) return [];
  await mkdir(imagesDir, { recursive: true });
  const results = [];
  for (let i = 0; i < imgSrcs.length; i += IMG_CONCURRENCY) {
    const batch = imgSrcs.slice(i, i + IMG_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((src, j) => downloadOneImage(src, i + j + 1, imagesDir, headers, assetsRelPath))
    );
    results.push(...batchResults);
  }
  return results;
}
function rewriteMarkdownImages(md, imgResults) {
  const urlToLocal = /* @__PURE__ */ new Map();
  for (const r of imgResults) {
    if (r.status === "ok" && r.localRel) {
      urlToLocal.set(r.originalUrl, r.localRel);
    }
  }
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const local = urlToLocal.get(url);
    return local ? `![${alt}](${local})` : match;
  });
}

// src/lib/fetcher/routes/web.ts
import * as cheerio from "cheerio";
function parseGeneric(html, baseUrl) {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const titleTag = $("title").text().trim();
  const title = ogTitle || titleTag || "";
  const author = $('meta[name="author"]').attr("content")?.trim() || "";
  let publishDate;
  const dateCandidates = [
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[property="og:article:published_time"]').attr("content"),
    $('meta[name="article:published_time"]').attr("content"),
    $('meta[itemprop="datePublished"]').attr("content"),
    $('meta[name="date"]').attr("content"),
    $('meta[name="pubdate"]').attr("content"),
    $('meta[name="publishdate"]').attr("content"),
    $("time[datetime]").first().attr("datetime"),
    $("time").first().text()
  ];
  for (const cand of dateCandidates) {
    if (!cand) continue;
    const norm = normalizeDateText(cand);
    if (norm) {
      publishDate = norm;
      break;
    }
  }
  let body = $("article");
  if (!body.length) body = $("main");
  if (!body.length) body = $("body");
  if (!body.length) {
    return { title, author, publishDate, bodyHtml: "", imgSrcs: [] };
  }
  body.find("script, style, nav, footer, header, aside").remove();
  const imgSrcs = [];
  body.find("img").each((_i, el) => {
    const $el = $(el);
    const real = ($el.attr("data-src") || $el.attr("data-original") || $el.attr("src") || "").trim();
    if (!real || real.startsWith("data:")) {
      $el.remove();
      return;
    }
    const abs = resolveUrl(real, baseUrl);
    $el.attr("src", abs);
    imgSrcs.push(abs);
  });
  return { title, author, publishDate, bodyHtml: body.html() || "", imgSrcs };
}

// src/lib/fetcher/routes/weixin.ts
import * as cheerio2 from "cheerio";
function firstSrcsetUrl(srcset) {
  const s = srcset.trim();
  if (!s) return "";
  const firstCandidate = s.split(",")[0].trim();
  if (!firstCandidate) return "";
  const url = firstCandidate.split(/\s+/)[0].trim();
  return url;
}
function normalizeCodeSnippetBlocks($, body) {
  body.find("pre.code-snippet__js").each((_i, el) => {
    const $pre = $(el);
    const lines = $pre.children("code").map((_j, codeEl) => $(codeEl).text()).get();
    if (lines.length <= 1) return;
    const langRaw = ($pre.attr("data-lang") || "").trim();
    const lang = langRaw.replace(/[^\w-]/g, "");
    const $replacement = $("<pre><code></code></pre>");
    const $code = $replacement.find("code");
    if (lang) $code.attr("class", `language-${lang}`);
    $code.text(lines.join("\n"));
    $pre.replaceWith($replacement);
  });
}
function parseWeixin(html, baseUrl) {
  const $ = cheerio2.load(html);
  const title = $("h1#activity-name").text().trim() || $("h1.rich_media_title").text().trim() || $('meta[property="og:title"]').attr("content")?.trim() || "";
  const author = $("a#js_name").text().trim() || $("#js_author_name").text().trim() || "";
  let publishDate;
  const ctMatch = html.match(/var\s+ct\s*=\s*"(\d+)"/);
  if (ctMatch) {
    const ts = Number(ctMatch[1]);
    if (Number.isFinite(ts) && ts > 0) publishDate = tsToYMD(ts);
  }
  if (!publishDate) {
    const ptText = $("em#publish_time").text().trim();
    if (ptText) publishDate = normalizeDateText(ptText);
  }
  const body = $("#js_content");
  if (!body.length) {
    return { title, author, publishDate, bodyHtml: "", imgSrcs: [] };
  }
  body.find("script, style").remove();
  normalizeCodeSnippetBlocks($, body);
  body.find("picture").each((_i, el) => {
    const $picture = $(el);
    const $firstSource = $picture.find("source[srcset]").first();
    const srcsetRaw = $firstSource.attr("srcset") || "";
    const pickedUrl = firstSrcsetUrl(srcsetRaw);
    let $img = $picture.find("img").first();
    if ($img.length) {
      const existing = ($img.attr("data-src") || $img.attr("data-original") || $img.attr("data-url") || $img.attr("src") || "").trim();
      if (!existing && pickedUrl) {
        $img.attr("data-src", pickedUrl);
      }
    } else if (pickedUrl) {
      $picture.append(`<img data-src="${pickedUrl}">`);
      $img = $picture.find("img").first();
    }
    if ($img.length) {
      $picture.replaceWith($img);
    } else {
      $picture.remove();
    }
  });
  body.find("source").remove();
  const imgSrcs = [];
  body.find("img").each((_i, el) => {
    const $el = $(el);
    const real = ($el.attr("data-src") || $el.attr("data-original") || $el.attr("data-url") || $el.attr("src") || "").trim();
    if (!real || real.startsWith("data:")) {
      $el.remove();
      return;
    }
    const abs = resolveUrl(real, baseUrl);
    $el.attr("src", abs);
    for (const a of [
      "data-src",
      "data-original",
      "data-url",
      "data-w",
      "data-ratio",
      "data-type",
      "data-s",
      "srcset"
    ]) {
      $el.removeAttr(a);
    }
    imgSrcs.push(abs);
  });
  return { title, author, publishDate, bodyHtml: body.html() || "", imgSrcs };
}

// src/lib/fetcher/routes/gist.ts
import { mkdir as mkdir2, writeFile as writeFile2 } from "fs/promises";
import { join as join15 } from "path";
import * as cheerio3 from "cheerio";
function parseGistUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("gist.github.com") && !u.hostname.endsWith("gist.githubusercontent.com")) {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { user: parts[0], id: parts[1] };
  } catch {
    return null;
  }
}
async function fetchGist(url, outRoot) {
  const parsed = parseGistUrl(url);
  if (!parsed) {
    return { status: "error", route: "gist", url, reason: "invalid_gist_url" };
  }
  const headers = buildHeaders("generic");
  let html;
  try {
    html = await fetchHtmlL1(url, headers);
  } catch (e) {
    return {
      status: "error",
      route: "gist",
      url,
      reason: `fetch_failed: ${e.message}`
    };
  }
  const $ = cheerio3.load(html);
  const description = $('[itemprop="about"]').first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const title = description || ogTitle || parsed.id;
  const author = parsed.user;
  let publishDate;
  const dateRaw = $("relative-time").first().attr("datetime") || $("time-ago").first().attr("datetime") || $('meta[property="article:published_time"]').attr("content") || "";
  if (dateRaw) publishDate = normalizeDateText(dateRaw);
  const rawRe = /^\/([^/]+)\/([a-f0-9]{20,})\/raw\/([a-f0-9]{20,})\/(.+)$/i;
  const rawLinks = [];
  $("a").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(rawRe);
    if (m) {
      rawLinks.push({
        name: m[4],
        rawUrl: "https://gist.githubusercontent.com" + href
      });
    }
  });
  if (rawLinks.length === 0) {
    return { status: "error", route: "gist", url, reason: "no_raw_files_found" };
  }
  const mdLink = rawLinks.find((l) => /\.(md|markdown)$/i.test(l.name)) || rawLinks[0];
  let content;
  try {
    const res = await fetch(mdLink.rawUrl, { headers, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${mdLink.rawUrl}`);
    content = await res.text();
  } catch (e) {
    const err2 = e;
    const cause = err2.cause?.message ? ` (${err2.cause.message})` : "";
    return {
      status: "error",
      route: "gist",
      url,
      reason: `raw_fetch_failed: ${err2.message}${cause} [raw_url=${mdLink.rawUrl}]`
    };
  }
  const slug = slugify(title);
  await mkdir2(outRoot, { recursive: true });
  const today2 = todayYMD();
  const hasH1 = /^#\s+/m.test(content);
  const fmLines = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: "gist",
      title,
      today: today2,
      url,
      author,
      publishDate
    })
  );
  fmLines.push("");
  if (!hasH1) fmLines.push(`# ${title}`, "");
  fmLines.push(content.trim(), "");
  const articlePath = join15(outRoot, `${slug}.md`);
  await writeFile2(articlePath, fmLines.join("\n"), "utf-8");
  return {
    status: "ok",
    route: "gist",
    url,
    title,
    author,
    publishDate,
    sourceKind: "gist",
    sourceLayer: "L1",
    slug,
    markdown: articlePath,
    imagesOk: 0,
    imagesFailed: 0
  };
}

// src/lib/fetcher/routes/github.ts
import { mkdir as mkdir3, writeFile as writeFile3 } from "fs/promises";
import { join as join16 } from "path";
function parseGithubRepoUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, rawRepo, ...rest] = parts;
    const repo = rawRepo.replace(/\.git$/, "");
    if (rest.length === 0) {
      return { owner, repo, ref: "HEAD" };
    }
    if (rest[0] === "blob" && rest.length >= 3) {
      return { owner, repo, ref: rest[1], subpath: rest.slice(2).join("/") };
    }
    if (rest[0] === "tree" && rest.length >= 2) {
      return { owner, repo, ref: rest[1] };
    }
    return { owner, repo, ref: "HEAD" };
  } catch {
    return null;
  }
}
async function fetchGithubDoc(url, outRoot) {
  const parsed = parseGithubRepoUrl(url);
  if (!parsed) {
    return { status: "error", route: "github", url, reason: "invalid_github_url" };
  }
  const { owner, repo, ref, subpath } = parsed;
  const headers = buildHeaders("generic");
  const candidates = [];
  if (subpath) {
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${subpath}`);
  } else {
    for (const name of ["README.md", "README.MD", "Readme.md", "readme.md", "README"]) {
      candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${name}`);
    }
  }
  let content = "";
  let chosenUrl = "";
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
    }
  }
  if (!content) {
    return { status: "error", route: "github", url, reason: "no_readable_content_found" };
  }
  const fileName = subpath ? subpath.split("/").pop() : "README.md";
  const title = subpath ? fileName.replace(/\.(md|markdown)$/i, "") : `${owner}/${repo}`;
  const slug = slugify(subpath ? `${owner}-${repo}-${fileName}` : `${owner}-${repo}`);
  await mkdir3(outRoot, { recursive: true });
  const today2 = todayYMD();
  const hasH1 = /^#\s+/m.test(content);
  const fmLines = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: "github",
      title,
      today: today2,
      url,
      author: owner
    })
  );
  fmLines.push("");
  if (!hasH1) fmLines.push(`# ${title}`, "");
  fmLines.push(`> Fetched from: ${chosenUrl}`, "");
  fmLines.push(content.trim(), "");
  const articlePath = join16(outRoot, `${slug}.md`);
  await writeFile3(articlePath, fmLines.join("\n"), "utf-8");
  return {
    status: "ok",
    route: "github",
    url,
    title,
    author: owner,
    sourceKind: "github",
    sourceLayer: "L1",
    slug,
    markdown: articlePath,
    imagesOk: 0,
    imagesFailed: 0
  };
}

// src/lib/fetcher/index.ts
function looksLikeWeixinArticle(html) {
  const hasContentRoot = html.includes('id="js_content"') || html.includes("id='js_content'");
  const hasWeixinMarker = html.includes("rich_media") || html.includes("code-snippet__") || html.includes("var ct =") || html.includes("mp.weixin.qq.com");
  return hasContentRoot && hasWeixinMarker;
}
async function fetchUrl(url, opts) {
  const site = detectSite(url);
  const headers = buildHeaders(site);
  let sourceLayer = "L1";
  let html = "";
  try {
    html = await fetchHtmlL1(url, headers);
    if (detectAntibot(html, site)) {
      html = "";
    }
  } catch {
    html = "";
  }
  if (!html) {
    sourceLayer = "L2";
    const l2html = await fetchHtmlL2(url);
    if (!l2html) {
      return {
        status: "error",
        route: "rich",
        url,
        reason: "ANTIBOT_BLOCKED",
        suggest: "Install playwright-core + chromium, or paste content manually"
      };
    }
    html = l2html;
    if (detectAntibot(html, site)) {
      return {
        status: "error",
        route: "rich",
        url,
        reason: "ANTIBOT_BLOCKED",
        suggest: "Site requires login or manual intervention"
      };
    }
  }
  const parseSite = site === "weixin" || looksLikeWeixinArticle(html) ? "weixin" : "generic";
  const doc = parseSite === "weixin" ? parseWeixin(html, url) : parseGeneric(html, url);
  if (!doc.bodyHtml || doc.bodyHtml.replace(/<[^>]*>/g, "").trim().length < 50) {
    return {
      status: "error",
      route: "rich",
      url,
      reason: "empty_body"
    };
  }
  let md = htmlToMarkdown(doc.bodyHtml);
  const slug = slugify(doc.title || "untitled");
  const assetsDir = join17(opts.outRoot, `${slug}.assets`);
  await mkdir4(opts.outRoot, { recursive: true });
  let imagesOk = 0;
  let imagesFailed = 0;
  if (!opts.noImages && doc.imgSrcs.length > 0) {
    const imgResults = await downloadImages(doc.imgSrcs, assetsDir, headers, `./${slug}.assets/`);
    md = rewriteMarkdownImages(md, imgResults);
    for (const r of imgResults) {
      if (r.status === "ok") imagesOk++;
      else imagesFailed++;
    }
  }
  const sourceKind = parseSite === "weixin" ? "clipping" : "article";
  const today2 = todayYMD();
  const fmLines = [];
  fmLines.push(
    ...buildFrontmatter({
      routeKind: sourceKind,
      title: doc.title,
      today: today2,
      url,
      author: doc.author,
      publishDate: doc.publishDate
    })
  );
  fmLines.push("");
  if (doc.title) fmLines.push(`# ${doc.title}`, "");
  fmLines.push(md, "");
  const articlePath = join17(opts.outRoot, `${slug}.md`);
  await writeFile4(articlePath, fmLines.join("\n"), "utf-8");
  return {
    status: "ok",
    route: "rich",
    url,
    title: doc.title || void 0,
    author: doc.author || void 0,
    publishDate: doc.publishDate,
    sourceKind,
    sourceLayer,
    slug,
    markdown: articlePath,
    assetsDir,
    imagesOk,
    imagesFailed
  };
}

// src/lib/ingest-state.ts
import { existsSync as existsSync12, mkdirSync as mkdirSync7, readFileSync as readFileSync12, writeFileSync as writeFileSync6 } from "fs";
import { join as join18, dirname as dirname6 } from "path";
function stateFilePath(corpus) {
  return join18(corpus, ".wiki", "ingest-state.json");
}
function loadIngestState(corpus) {
  const p = stateFilePath(corpus);
  if (!existsSync12(p)) {
    return { version: 1, ingests: {} };
  }
  try {
    const raw = readFileSync12(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { version: 1, ingests: {} };
    }
    if (!parsed.ingests || typeof parsed.ingests !== "object") {
      parsed.ingests = {};
    }
    parsed.version = 1;
    return parsed;
  } catch {
    return { version: 1, ingests: {} };
  }
}
function saveIngestState(corpus, state) {
  const p = stateFilePath(corpus);
  mkdirSync7(dirname6(p), { recursive: true });
  const serialized = JSON.stringify(state, null, 2);
  writeFileSync6(p, serialized + "\n", "utf-8");
}
function getIngestRecord(corpus, url) {
  return loadIngestState(corpus).ingests[url];
}
function upsertIngestRecord(corpus, url, patch) {
  const state = loadIngestState(corpus);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = state.ingests[url];
  const merged = existing ? { ...existing, ...patch, url, updatedAt: now } : {
    url,
    startedAt: now,
    updatedAt: now,
    status: patch.status ?? "started",
    stepsDone: patch.stepsDone ?? [],
    ...patch
  };
  if (merged.stepsDone) {
    merged.stepsDone = Array.from(new Set(merged.stepsDone));
  }
  state.ingests[url] = merged;
  saveIngestState(corpus, state);
  return merged;
}
function deleteIngestRecord(corpus, url) {
  const state = loadIngestState(corpus);
  if (!(url in state.ingests)) return false;
  delete state.ingests[url];
  saveIngestState(corpus, state);
  return true;
}
function listPendingIngests(corpus) {
  const state = loadIngestState(corpus);
  return Object.values(state.ingests).filter((r) => r.status !== "completed");
}
function nextStepHint(record) {
  if (record.status === "completed") return "nothing to do";
  if (record.status === "failed") {
    return `failed: ${record.error ?? "unknown error"} \u2014 inspect and re-run with --force if you want to retry`;
  }
  const done = new Set(record.stepsDone);
  if (!done.has("fetch")) {
    return "fetch: nothing recorded yet \u2014 run `lorekit fetch <url>`";
  }
  if (!done.has("archive")) {
    return "archive: mv the workbench dir into \u539F\u6599/\uFF08\u526A\u85CF|\u6587\u7AE0|\u4E66\u7C4D|...\uFF09";
  }
  if (!done.has("wiki")) {
    return "wiki: compile wiki pages in \u77E5\u8BC6\u5E93/\uFF08\u6982\u5FF5|\u5B9E\u4F53|\u6458\u8981|\u4E13\u9898\uFF09";
  }
  if (!done.has("lint")) {
    return "lint: run `lorekit ingest-check`, fix any issues, then `lorekit ingest record <url> --complete`";
  }
  return "all steps done but status not yet completed \u2014 run `lorekit ingest record <url> --complete`";
}

// src/commands/fetch.ts
function suggestResult(route, url, suggest) {
  return { status: "unsupported", route, url, suggest };
}
function getHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
function isPdfUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return false;
  }
}
function fetchCommand(program2) {
  program2.command("fetch").argument("<url>", "URL to fetch").option("--out <dir>", "output directory").option("--force-rich", "skip host routing, always use rich fetcher").option("--no-images", "skip image downloads").option("--force", "ignore duplicate-URL check and re-fetch anyway").description("Fetch a URL into local markdown + images").action(
    async (url, opts) => {
      const corpus = findCorpus();
      let outRoot;
      if (opts.out) {
        outRoot = opts.out;
      } else {
        outRoot = corpus ? join19(corpus, "_\u5DE5\u4F5C\u53F0", "\u6536\u4EF6", "fetch") : join19(tmpdir2(), "lorekit-fetch");
      }
      if (!existsSync13(outRoot)) {
        mkdirSync8(outRoot, { recursive: true });
      }
      let duplicate;
      if (corpus && !opts.force) {
        const state = getIngestRecord(corpus, url);
        if (state && state.status !== "completed") {
          const hint = nextStepHint(state);
          err(
            `[lorekit fetch] in-progress ingest detected for ${url}
  status: ${state.status}  steps done: ${state.stepsDone.join(", ") || "(none)"}
  started: ${state.startedAt}
  next step \u2192 ${hint}
  use --force to restart from scratch`
          );
          out(
            JSON.stringify({
              status: "in_progress",
              route: "rich",
              url,
              ingestState: state,
              nextStep: hint
            })
          );
          return;
        }
        if (state && state.status === "completed") {
          duplicate = {
            path: state.archivedTo ?? "(unknown)",
            sourceDate: state.sourceDate,
            title: state.title
          };
        } else {
          const existing = findSourceByUrl(corpus, url);
          if (existing) {
            const fm = extractFrontmatter(existing);
            const sdRaw = fm.source_date;
            const sourceDate = typeof sdRaw === "string" ? sdRaw : sdRaw instanceof Date ? sdRaw.toISOString().slice(0, 10) : void 0;
            duplicate = {
              path: relPosix(corpus, existing),
              sourceDate,
              title: typeof fm.title === "string" ? fm.title : void 0
            };
          }
        }
        if (duplicate) {
          err(
            `[lorekit fetch] duplicate url: ${url} already ingested at ${duplicate.path}` + (duplicate.sourceDate ? ` (source_date: ${duplicate.sourceDate})` : "") + `. Use --force to re-fetch anyway.`
          );
          out(JSON.stringify({ status: "duplicate", route: "rich", url, duplicate }));
          return;
        }
      }
      const noImages = opts.images === false;
      let result;
      if (opts.forceRich) {
        result = await fetchUrl(url, { outRoot, noImages });
      } else {
        const host = getHost(url);
        if (host.includes("mp.weixin.qq.com")) {
          result = await fetchUrl(url, { outRoot, noImages });
        } else if (host.includes("feishu.cn") || host.includes("larkoffice.com")) {
          result = suggestResult("lark", url, "lark-cli docs +read --as user --doc <url>");
        } else if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com")) {
          result = suggestResult("x", url, "paste screenshot or text (antibot too strong)");
        } else if (host === "gist.github.com" || host === "gist.githubusercontent.com") {
          result = await fetchGist(url, outRoot);
        } else if (host === "github.com" || host === "www.github.com") {
          result = await fetchGithubDoc(url, outRoot);
        } else if (isPdfUrl(url)) {
          result = suggestResult("pdf", url, "pdf skill");
        } else {
          result = await fetchUrl(url, { outRoot, noImages });
        }
      }
      if (corpus && result.status === "ok" && result.markdown) {
        upsertIngestRecord(corpus, url, {
          title: result.title,
          sourceDate: result.publishDate,
          status: "started",
          stepsDone: ["fetch"],
          workbenchMd: result.markdown
        });
      }
      out(JSON.stringify(result));
      if (result.status === "error") {
        process.exitCode = 1;
      }
    }
  );
}

// src/commands/ingest.ts
import { existsSync as existsSync14, readFileSync as readFileSync13, writeFileSync as writeFileSync7 } from "fs";
import { join as join20 } from "path";
var VALID_STEPS = ["fetch", "archive", "wiki", "backlink", "lint"];
function today() {
  return dateToYMDLocal(/* @__PURE__ */ new Date());
}
function appendLogEntry(corpus, record, body) {
  const logPath = join20(corpus, "log.md");
  const title = record.title ?? "(untitled)";
  const wikiList = (record.wikiPages ?? []).map((p) => `  - ${p}`).join("\n");
  const archived = record.archivedTo ?? "(unrecorded)";
  const entry = [
    `## [${today()}] ingest | ${title}`,
    "",
    body.trim(),
    "",
    `- **URL**\uFF1A${record.url}`,
    `- **\u5F52\u6863**\uFF1A${archived}`,
    record.wikiPages && record.wikiPages.length > 0 ? `- **\u65B0\u5EFA/\u66F4\u65B0\u9875**\uFF1A
${wikiList}` : "- **\u65B0\u5EFA/\u66F4\u65B0\u9875**\uFF1A\uFF08\u65E0\uFF09",
    "",
    ""
  ].join("\n");
  let existing = "";
  if (existsSync14(logPath)) existing = readFileSync13(logPath, "utf-8");
  if (!existing) {
    const header = '# Log\n\n> \u64CD\u4F5C\u65F6\u95F4\u7EBF\uFF0Cappend-only\u3002\u6BCF\u6761\u683C\u5F0F\uFF1A`## [YYYY-MM-DD] \u64CD\u4F5C\u7C7B\u578B | \u6807\u9898`\n> \u53EF\u7528 `grep "^## \\[" log.md | tail -10` \u5FEB\u901F\u67E5\u6700\u8FD1\u64CD\u4F5C\u3002\n\n';
    writeFileSync7(logPath, header + entry, "utf-8");
    return;
  }
  const firstSection = existing.search(/^## \[/m);
  if (firstSection === -1) {
    const sep2 = existing.endsWith("\n") ? "" : "\n";
    writeFileSync7(logPath, existing + sep2 + entry, "utf-8");
  } else {
    const before = existing.slice(0, firstSection);
    const after = existing.slice(firstSection);
    writeFileSync7(logPath, before + entry + after, "utf-8");
  }
}
function ingestCommand(program2) {
  const group = program2.command("ingest").description("Track ingest pipeline state (record step progress, list pending, reconcile)");
  group.command("list").description("List every ingest record (completed + in-progress)").action(() => {
    const corpus = requireCorpus();
    const state = loadIngestState(corpus);
    const rows = Object.values(state.ingests);
    if (rows.length === 0) {
      print("[lorekit ingest list] no records");
      out(JSON.stringify({ ingests: [] }));
      return;
    }
    const summary = rows.map((r) => {
      const done = r.stepsDone.join(",") || "(none)";
      const dest = r.archivedTo ?? r.workbenchMd ?? r.workbenchDir ?? "-";
      return `  [${r.status.padEnd(12)}] ${r.url}
    steps: ${done}  \u2192  ${dest}`;
    });
    print(`[lorekit ingest list] ${rows.length} record(s)
${summary.join("\n")}`);
    out(JSON.stringify(state));
  });
  group.command("pending").description("List only in-progress (non-completed) ingests \u2014 what you need to resume").action(() => {
    const corpus = requireCorpus();
    const pending = listPendingIngests(corpus);
    if (pending.length === 0) {
      print("[lorekit ingest pending] all ingests are completed \u2014 nothing to resume");
      out(JSON.stringify({ pending: [] }));
      return;
    }
    const summary = pending.map((r) => {
      return `  [${r.status.padEnd(12)}] ${r.url}
    next step \u2192 ${nextStepHint(r)}`;
    });
    print(
      `[lorekit ingest pending] ${pending.length} ingest(s) need attention
${summary.join("\n")}`
    );
    out(JSON.stringify({ pending }));
    process.exitCode = 1;
  });
  group.command("record <url>").description("Record step progress for an ingest (call from wiki-ingest skill)").option(
    "--step <steps>",
    `mark step(s) as done. single: archive | multi: archive,wiki,backlink,lint. valid: ${VALID_STEPS.join(", ")}`
  ).option("--archived-to <path>", "relative path where the source was moved (e.g. \u539F\u6599/\u526A\u85CF/xxx)").option("--wiki-page <path...>", "relative path of a wiki page created (can be repeated)").option(
    "--log <body>",
    "append a one-paragraph summary to corpus/log.md (CLI auto-fills url/archive/pages)"
  ).option("--status <status>", "explicit status (started|completed|failed)").option("--complete", "shortcut: mark status=completed").option("--fail <reason>", "shortcut: mark status=failed with reason").action(
    (url, opts) => {
      const corpus = requireCorpus();
      const patch = {};
      let parsedSteps = [];
      if (opts.step) {
        parsedSteps = opts.step.split(",").map((s) => s.trim()).filter(Boolean);
        for (const s of parsedSteps) {
          if (!VALID_STEPS.includes(s)) {
            print(
              `[lorekit ingest record] invalid step: ${s}. valid: ${VALID_STEPS.join(", ")}`
            );
            process.exitCode = 2;
            return;
          }
        }
        const existing = loadIngestState(corpus).ingests[url];
        const prev = existing?.stepsDone ?? [];
        patch.stepsDone = [.../* @__PURE__ */ new Set([...prev, ...parsedSteps])];
        if (!opts.status && !opts.complete && !opts.fail) {
          if (parsedSteps.includes("lint")) patch.status = "completed";
          else patch.status = "started";
        }
      }
      if (opts.archivedTo) patch.archivedTo = opts.archivedTo;
      if (opts.wikiPage && opts.wikiPage.length > 0) {
        const existing = loadIngestState(corpus).ingests[url];
        const prev = existing?.wikiPages ?? [];
        patch.wikiPages = [.../* @__PURE__ */ new Set([...prev, ...opts.wikiPage])];
      }
      if (opts.status) {
        const validStatuses = ["started", "completed", "failed"];
        if (!validStatuses.includes(opts.status)) {
          print(
            `[lorekit ingest record] invalid --status: ${opts.status}. valid: ${validStatuses.join(", ")}`
          );
          process.exitCode = 2;
          return;
        }
        patch.status = opts.status;
      }
      if (opts.complete) patch.status = "completed";
      if (opts.fail) {
        patch.status = "failed";
        patch.error = opts.fail;
      }
      const updated = upsertIngestRecord(corpus, url, patch);
      let logAppended = false;
      if (opts.log) {
        try {
          appendLogEntry(corpus, updated, opts.log);
          logAppended = true;
        } catch (e) {
          print(`[lorekit ingest record] log append failed: ${e.message}`);
        }
      }
      print(
        `[lorekit ingest record] ${url}
  status: ${updated.status}  steps: ${updated.stepsDone.join(",") || "(none)"}` + (logAppended ? "  +log" : "")
      );
      out(JSON.stringify({ ...updated, logAppended }));
    }
  );
  group.command("check <files...>").description("Scan given wiki pages for broken [[wikilinks]] (pre-commit check)").action((files) => {
    const corpus = requireCorpus();
    const linkIndex = buildWikiLinkIndex(corpus);
    const stripCode = (s) => s.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
    const broken = [];
    const okLinks = [];
    const checked = [];
    for (const f of files) {
      const abs = f.startsWith("/") ? f : join20(process.cwd(), f);
      if (!existsSync14(abs)) {
        print(`[lorekit ingest check] file not found: ${f}`);
        process.exitCode = 2;
        continue;
      }
      const rel = relPosix(corpus, abs);
      checked.push(rel);
      let content;
      try {
        content = stripCode(readFileSync13(abs, "utf-8"));
      } catch {
        continue;
      }
      const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
      let m;
      const seen = /* @__PURE__ */ new Set();
      while ((m = linkRe.exec(content)) !== null) {
        const target = m[1].trim();
        if (seen.has(target)) continue;
        seen.add(target);
        if (resolveWikiLink(rel, target, linkIndex)) {
          okLinks.push({ file: rel, link: target });
        } else {
          broken.push({ file: rel, link: target });
        }
      }
    }
    const result = { checked, ok: okLinks, broken };
    if (broken.length === 0) {
      print(
        `[lorekit ingest check] ${checked.length} file(s), ${okLinks.length} link(s) ok, no broken links`
      );
    } else {
      print(`[lorekit ingest check] ${broken.length} broken link(s) found:`);
      for (const b of broken) {
        print(`  \u2717 ${b.file}: [[${b.link}]]`);
      }
      process.exitCode = 1;
    }
    out(JSON.stringify(result));
  });
  group.command("forget <url>").description("Remove a record from the state (e.g. after manual cleanup)").action((url) => {
    const corpus = requireCorpus();
    const removed = deleteIngestRecord(corpus, url);
    print(
      removed ? `[lorekit ingest forget] removed ${url}` : `[lorekit ingest forget] no record for ${url}`
    );
    out(JSON.stringify({ removed, url }));
  });
  group.command("reconcile").description("Back-fill state for pre-existing \u539F\u6599/ pages missing a state record").option("--dry-run", "list what would be added without writing").action((opts) => {
    const corpus = requireCorpus();
    const sourcesRoot = join20(corpus, "\u539F\u6599");
    if (!existsSync14(sourcesRoot)) {
      print("[lorekit ingest reconcile] no \u539F\u6599/ directory");
      return;
    }
    const state = loadIngestState(corpus);
    const added = [];
    for (const mdPath of collectMdFiles(sourcesRoot)) {
      const fm = extractFrontmatter(mdPath);
      const url = typeof fm.source_url === "string" && fm.source_url || typeof fm.url === "string" && fm.url || "";
      if (!url) continue;
      if (state.ingests[url]) continue;
      const rel = relPosix(corpus, mdPath);
      const archivedTo = rel.replace(/\/article\.md$/, "");
      const sdRaw = fm.source_date;
      const sourceDate = typeof sdRaw === "string" ? sdRaw : sdRaw instanceof Date ? sdRaw.toISOString().slice(0, 10) : void 0;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      state.ingests[url] = {
        url,
        title: typeof fm.title === "string" ? fm.title : void 0,
        sourceDate,
        startedAt: now,
        updatedAt: now,
        status: "completed",
        stepsDone: ["fetch", "archive", "wiki", "lint"],
        archivedTo
      };
      added.push(url);
    }
    if (!opts.dryRun && added.length > 0) saveIngestState(corpus, state);
    print(
      `[lorekit ingest reconcile] ${opts.dryRun ? "would add" : "added"} ${added.length} record(s)`
    );
    for (const u of added) print(`  + ${u}`);
    out(JSON.stringify({ dryRun: !!opts.dryRun, added }));
  });
}

// src/commands/sync.ts
import chalk6 from "chalk";
import { mkdirSync as mkdirSync9, writeFileSync as writeFileSync10 } from "fs";
import { join as join23 } from "path";

// src/lib/root-index.ts
import { existsSync as existsSync15, readFileSync as readFileSync14, readdirSync as readdirSync8, writeFileSync as writeFileSync8 } from "fs";
import { join as join21 } from "path";
var MANAGED_SECTIONS = [
  { heading: "## \u6982\u5FF5", subdir: "\u77E5\u8BC6\u5E93/\u6982\u5FF5" },
  { heading: "## \u5B9E\u4F53", subdir: "\u77E5\u8BC6\u5E93/\u5B9E\u4F53" },
  { heading: "## \u6458\u8981", subdir: "\u77E5\u8BC6\u5E93/\u6458\u8981" },
  { heading: "## \u4E13\u9898", subdir: "\u77E5\u8BC6\u5E93/\u4E13\u9898" }
];
function listEntriesInDir(corpus, subdir) {
  const dirPath = join21(corpus, subdir);
  if (!existsSync15(dirPath)) return [];
  const out2 = [];
  for (const name of readdirSync8(dirPath)) {
    if (name.startsWith(".")) continue;
    if (name === "_INDEX.md") continue;
    if (!name.endsWith(".md")) continue;
    const file = join21(dirPath, name);
    const slug = `${subdir}/${name.replace(/\.md$/, "")}`;
    out2.push({ slug, summary: extractCompiledTruthSnippet(file) });
  }
  return out2.sort((a, b) => a.slug.localeCompare(b.slug));
}
function extractCompiledTruthSnippet(filePath) {
  let content;
  try {
    content = readFileSync14(filePath, "utf-8");
  } catch (e) {
    debug(`extractCompiledTruthSnippet(${filePath}) failed: ${e.message}`);
    return "\u2014";
  }
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const sectionMatch = body.match(/##\s*Compiled Truth\s*\n+([\s\S]*?)(?=\n---|\n##\s|$)/);
  if (!sectionMatch) return "\u2014";
  const para = sectionMatch[1].split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!para) return "\u2014";
  const cleaned = para.replace(/^\*\*([^*]+)\*\*\s*/, "$1 ");
  const sentenceMatch = cleaned.match(/^(.{1,80}?[。.！？!?])/);
  if (sentenceMatch) return sentenceMatch[1];
  return cleaned.slice(0, 80) + (cleaned.length > 80 ? "\u2026" : "");
}
function mergeSection(content, heading, onDisk) {
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    return { newContent: content, result: { added: [], removed: [], kept: 0 } };
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      endIdx = i;
      break;
    }
  }
  const sectionBody = lines.slice(startIdx + 1, endIdx);
  const linkRe = /^-\s+\[\[([^\]|#]+)[^\]]*\]\]/;
  const onDiskSlugs = new Set(onDisk.map((e) => e.slug));
  const seenInIndex = /* @__PURE__ */ new Set();
  const removed = [];
  const kept = [];
  for (const line of sectionBody) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "\uFF08\u6682\u65E0\u6761\u76EE\uFF09") continue;
    const m = line.match(linkRe);
    if (m) {
      const slug = m[1].trim();
      if (onDiskSlugs.has(slug)) {
        seenInIndex.add(slug);
        kept.push(line);
      } else {
        removed.push(slug);
      }
    } else {
      kept.push(line);
    }
  }
  const added = [];
  for (const e of onDisk) {
    if (!seenInIndex.has(e.slug)) {
      kept.push(`- [[${e.slug}]] \u2014 ${e.summary}`);
      added.push(e.slug);
    }
  }
  const sectionContentLines = kept.length === 0 ? ["", "\uFF08\u6682\u65E0\u6761\u76EE\uFF09", ""] : ["", ...kept, ""];
  const newLines = [
    ...lines.slice(0, startIdx + 1),
    ...sectionContentLines,
    ...lines.slice(endIdx)
  ];
  return {
    newContent: newLines.join("\n"),
    result: { added, removed, kept: seenInIndex.size }
  };
}
function refreshRootIndex(corpus) {
  const indexPath = join21(corpus, "index.md");
  if (!existsSync15(indexPath)) {
    return { filePath: indexPath, changed: false, perSection: [] };
  }
  const before = readFileSync14(indexPath, "utf-8");
  let content = before;
  const perSection = [];
  for (const sec of MANAGED_SECTIONS) {
    const onDisk = listEntriesInDir(corpus, sec.subdir);
    const { newContent, result } = mergeSection(content, sec.heading, onDisk);
    content = newContent;
    perSection.push({ heading: sec.heading, ...result });
  }
  const changed = content !== before;
  if (changed) writeFileSync8(indexPath, content, "utf-8");
  return { filePath: indexPath, changed, perSection };
}

// src/lib/memory-index.ts
import { existsSync as existsSync16, readFileSync as readFileSync15, statSync as statSync5, writeFileSync as writeFileSync9 } from "fs";
import { join as join22 } from "path";
var TYPE_ROWS = [
  { type: "concept", dir: "\u77E5\u8BC6\u5E93/\u6982\u5FF5" },
  { type: "entity", dir: "\u77E5\u8BC6\u5E93/\u5B9E\u4F53" },
  { type: "summary", dir: "\u77E5\u8BC6\u5E93/\u6458\u8981" },
  { type: "topic", dir: "\u77E5\u8BC6\u5E93/\u4E13\u9898" },
  { type: "source", dir: "\u539F\u6599" },
  { type: "daily", dir: "\u6BCF\u65E5" },
  { type: "writing", dir: "\u5199\u4F5C" }
];
var RECENT_LIMIT = 5;
function fmDateString(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const m = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  return null;
}
function collectStats(corpus) {
  const rows = TYPE_ROWS.filter((r) => existsSync16(join22(corpus, r.dir))).map((r) => ({
    ...r,
    count: collectMdFiles(join22(corpus, r.dir)).length
  }));
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const knowledgeDir = join22(corpus, "\u77E5\u8BC6\u5E93");
  const pages = [];
  if (existsSync16(knowledgeDir)) {
    for (const file of collectMdFiles(knowledgeDir)) {
      const rel = relPosix(corpus, file);
      if (rel.startsWith("\u77E5\u8BC6\u5E93/\u6A21\u677F/")) continue;
      let updated = null;
      try {
        updated = fmDateString(extractFrontmatter(file).updated);
      } catch (e) {
        debug(`memory-index: frontmatter parse failed for ${rel}: ${e.message}`);
      }
      if (!updated) {
        try {
          updated = statSync5(file).mtime.toISOString().slice(0, 10);
        } catch {
          continue;
        }
      }
      pages.push({ slug: rel.replace(/\.md$/, ""), updated });
    }
  }
  pages.sort((a, b) => b.updated.localeCompare(a.updated) || a.slug.localeCompare(b.slug));
  return {
    rows,
    total,
    latest: pages[0]?.updated ?? null,
    recent: pages.slice(0, RECENT_LIMIT)
  };
}
function replaceSection(content, heading, bodyLines) {
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) return content;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      endIdx = i;
      break;
    }
  }
  return [...lines.slice(0, startIdx + 1), "", ...bodyLines, "", ...lines.slice(endIdx)].join("\n");
}
function refreshMemoryIndex(corpus) {
  const filePath = join22(corpus, "MEMORY.md");
  if (!existsSync16(filePath)) {
    return { filePath, exists: false, changed: false, total: 0 };
  }
  const before = readFileSync15(filePath, "utf-8");
  const stats = collectStats(corpus);
  const activeDomain = before.match(/当前活跃领域[：:]\s*(.*)/)?.[1]?.trim() || "\u2014";
  let content = before;
  content = replaceSection(content, "## \u7EDF\u8BA1\u6982\u89C8", [
    `- \u603B\u9875\u6570\uFF1A${stats.total}`,
    `- \u6700\u8FD1\u66F4\u65B0\uFF1A${stats.latest ?? "\u2014"}`,
    `- \u5F53\u524D\u6D3B\u8DC3\u9886\u57DF\uFF1A${activeDomain}`
  ]);
  content = replaceSection(content, "## \u7C7B\u578B\u5206\u5E03", [
    "| \u7C7B\u578B | \u6570\u91CF | \u5165\u53E3 |",
    "|---|---|---|",
    ...stats.rows.map((r) => `| ${r.type} | ${r.count} | \`${r.dir}/_INDEX.md\` |`)
  ]);
  content = replaceSection(
    content,
    "## \u6700\u8FD1\u6D3B\u8DC3",
    stats.recent.length === 0 ? ["- \u2014"] : stats.recent.map((e) => `- [[${e.slug}]] \u2014 ${e.updated}`)
  );
  const changed = content !== before;
  if (changed) writeFileSync9(filePath, content, "utf-8");
  return { filePath, exists: true, changed, total: stats.total };
}

// src/commands/sync.ts
function createReport(corpus) {
  return {
    status: "ok",
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    finishedAt: "",
    corpus,
    steps: {
      index: { status: "skipped" },
      rootIndex: { status: "skipped" },
      memoryIndex: { status: "skipped" },
      doctor: { status: "skipped" }
    },
    reportPath: null,
    errors: []
  };
}
function writeSyncReport(corpus, report) {
  const dir = join23(corpus, ".wiki", "reports", "sync");
  mkdirSync9(dir, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, "-");
  const path = join23(dir, `${stamp}.json`);
  report.reportPath = path;
  writeFileSync10(path, JSON.stringify(report, null, 2) + "\n", "utf-8");
  return path;
}
async function runSync(corpus, opts = {}) {
  const report = createReport(corpus);
  print(chalk6.cyan("\u2500\u2500 [1/2] index: refresh _INDEX.md \u2500\u2500"));
  try {
    const generated = runIndex(corpus);
    report.steps.index = { status: "ok", generated };
    if (generated === 0) {
      warn("no indexable directories found");
    } else {
      ok(`refreshed ${generated} _INDEX.md file(s)`);
    }
  } catch (e) {
    report.status = "error";
    report.steps.index = { status: "error", error: e.message };
    report.errors.push(`index failed: ${e.message}`);
    err(`index failed: ${e.message}`);
    throw e;
  }
  if (!opts.skipRootIndex) {
    try {
      const r = refreshRootIndex(corpus);
      const totals = r.perSection.reduce(
        (acc, s) => ({
          added: acc.added + s.added.length,
          removed: acc.removed + s.removed.length,
          kept: acc.kept + s.kept
        }),
        { added: 0, removed: 0, kept: 0 }
      );
      report.steps.rootIndex = {
        status: "ok",
        changed: r.changed,
        added: totals.added,
        removed: totals.removed,
        kept: totals.kept
      };
      if (!r.changed) {
        ok(`index.md unchanged (${totals.kept} entries across managed sections)`);
      } else {
        ok(
          `index.md merged: +${totals.added} added, -${totals.removed} removed, ${totals.kept} kept`
        );
        for (const s of r.perSection) {
          if (s.added.length === 0 && s.removed.length === 0) continue;
          for (const slug of s.added) print(`    + ${slug}`);
          for (const slug of s.removed) print(`    - ${slug} (file gone)`);
        }
      }
    } catch (e) {
      report.status = "error";
      report.steps.rootIndex = { status: "error", error: e.message };
      report.errors.push(`root index sync failed: ${e.message}`);
      err(`root index sync failed: ${e.message}`);
      throw e;
    }
  } else {
    report.steps.rootIndex = { status: "skipped", reason: "skip-root-index" };
  }
  try {
    const m = refreshMemoryIndex(corpus);
    if (!m.exists) {
      report.steps.memoryIndex = { status: "skipped", reason: "no MEMORY.md" };
    } else {
      report.steps.memoryIndex = { status: "ok", changed: m.changed, total: m.total };
      ok(m.changed ? `MEMORY.md stats refreshed (${m.total} pages)` : "MEMORY.md unchanged");
    }
  } catch (e) {
    report.steps.memoryIndex = { status: "error", error: e.message };
    report.errors.push(`memory index sync failed: ${e.message}`);
    err(`memory index sync failed: ${e.message}`);
  }
  print();
  if (!opts.skipDoctor) {
    print(chalk6.cyan("\u2500\u2500 [2/2] doctor: sanity check \u2500\u2500"));
    const issues = await runDoctor(corpus);
    report.steps.doctor = { status: "ok", issues };
  } else {
    report.steps.doctor = { status: "skipped", reason: "skip-doctor" };
  }
  report.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  return report;
}
function syncCommand(program2) {
  program2.command("sync").description("one-shot: refresh _INDEX.md \u2192 root index \u2192 doctor").option("--skip-doctor", "skip the final doctor sanity check", false).option("--skip-root-index", "skip merging corpus/index.md against disk", false).option("--json", "output machine-readable sync report", false).option("--report", "write .wiki/reports/sync/<timestamp>.json", false).action(async (opts) => {
    const corpus = requireCorpus();
    try {
      const report = await runSync(corpus, opts);
      if (opts.report) writeSyncReport(corpus, report);
      if (opts.json) out(JSON.stringify(report, null, 2));
    } catch {
      process.exit(1);
    }
  });
}

// src/commands/obsidian-tune.ts
import { cpSync as cpSync3, existsSync as existsSync17, mkdirSync as mkdirSync10, writeFileSync as writeFileSync11 } from "fs";
import { join as join24 } from "path";
function runPrint() {
  const cfg = getRecommendedGraphConfig();
  out(JSON.stringify(cfg, null, 2));
}
function runCheck(corpus) {
  const recommended = getRecommendedFilter();
  const cur = readCorpusFilter(corpus);
  if (!cur.exists) {
    warn(".obsidian/graph.json \u7F3A\u5931");
    print("");
    print("\u63A8\u8350 filter\uFF08\u8FC7\u7A0B/\u7CFB\u7EDF\u533A + \u81EA\u52A8\u7D22\u5F15\uFF09:");
    print(`  ${recommended}`);
    print("");
    print("\u5E94\u7528\uFF1Alorekit obsidian-tune --write");
    return 1;
  }
  if (isFilterComplete(cur.search, recommended)) {
    ok(".obsidian/graph.json filter \u5B8C\u6574");
    return 0;
  }
  warn(".obsidian/graph.json filter \u4E0D\u5B8C\u6574");
  print("");
  print("\u5F53\u524D filter\uFF08\u5982\u6709\uFF09:");
  print(`  ${cur.search ?? "(\u7A7A)"}`);
  print("");
  print("\u63A8\u8350 filter\uFF08\u8FC7\u7A0B/\u7CFB\u7EDF\u533A + \u81EA\u52A8\u7D22\u5F15\uFF09:");
  print(`  ${recommended}`);
  print("");
  print("\u7F3A\u5C11\u7684 token:");
  for (const t of missingTokens(cur.search, recommended)) {
    print(`  - ${t}`);
  }
  print("");
  print("\u5E94\u7528\uFF1Alorekit obsidian-tune --write");
  return 1;
}
function runWrite(corpus) {
  const dest = join24(corpus, ".obsidian", "graph.json");
  const destDir = join24(corpus, ".obsidian");
  if (!existsSync17(destDir)) mkdirSync10(destDir, { recursive: true });
  if (existsSync17(dest)) {
    const backup = `${dest}.bak.${tsCompact()}`;
    cpSync3(dest, backup);
    ok(`\u5907\u4EFD .obsidian/graph.json \u2192 ${backup}`);
  }
  const cfg = getRecommendedGraphConfig();
  writeFileSync11(dest, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  ok("\u5199\u5165\u63A8\u8350 filter");
  info("\u8BF7\u5173\u6389 Obsidian\u300C\u5173\u7CFB\u56FE\u8C31\u300D\u6807\u7B7E\u9875\u518D\u91CD\u5F00\u751F\u6548");
  return 0;
}
function obsidianTuneCommand(program2) {
  program2.command("obsidian-tune").description("check / apply recommended Obsidian graph filter for the corpus").option("--write", "apply recommended filter (backs up existing graph.json first)").option("--print", "print recommended graph.json to stdout (pipe-friendly)").action((opts) => {
    if (opts.print) {
      runPrint();
      process.exitCode = 0;
      return;
    }
    const corpus = findCorpus();
    if (!corpus) {
      err("not inside a corpus (no .wiki/ or CLAUDE.md found)");
      process.exitCode = 2;
      return;
    }
    if (opts.write) {
      process.exitCode = runWrite(corpus);
    } else {
      process.exitCode = runCheck(corpus);
    }
  });
}

// src/commands/remove.ts
import { existsSync as existsSync18, mkdirSync as mkdirSync11, readFileSync as readFileSync16, renameSync, writeFileSync as writeFileSync12 } from "fs";
import { basename as basename6, dirname as dirname7, isAbsolute as isAbsolute2, join as join25, relative, resolve as resolve4, sep } from "path";
import matter2 from "gray-matter";
import trash from "trash";
function isUrl(input) {
  return /^https?:\/\//i.test(input);
}
function toSlash(p) {
  return p.split(sep).join("/");
}
function stripMd(rel) {
  return rel.replace(/\.md$/, "");
}
function normalizeRel(rel) {
  return toSlash(rel).replace(/^\.\//, "").replace(/\/+/g, "/");
}
function resolveInputPath(corpus, input) {
  const candidates = [];
  const rawAbs = isAbsolute2(input) ? input : join25(corpus, input);
  candidates.push(rawAbs);
  if (!input.endsWith(".md")) candidates.push(`${rawAbs}.md`);
  for (const candidate of candidates) {
    const abs = resolve4(candidate);
    if (isWithin(corpus, abs) && existsSync18(abs)) return abs;
  }
  return null;
}
function relFromAbs(corpus, abs) {
  return normalizeRel(relative(corpus, abs));
}
function aliasesForRel(rel) {
  const aliases = /* @__PURE__ */ new Set();
  const normalized = normalizeRel(rel);
  aliases.add(stripMd(normalized));
  if (normalized.endsWith("/article.md")) {
    aliases.add(stripMd(normalized).replace(/\/article$/, ""));
  }
  return [...aliases];
}
function readText(abs) {
  return readFileSync16(abs, "utf-8");
}
function extractWikilinks(content) {
  const links = [];
  const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
  let m;
  while ((m = linkRe.exec(content)) !== null) links.push(m[1].trim());
  return links;
}
function addExistingTarget(corpus, targets, relOrAbs, reason) {
  const abs = isAbsolute2(relOrAbs) ? relOrAbs : join25(corpus, relOrAbs);
  if (!existsSync18(abs)) return;
  const rel = relFromAbs(corpus, abs);
  targets.set(rel, { rel, abs, reason });
}
function addSourceTarget(corpus, targets, relOrAbs) {
  const abs = isAbsolute2(relOrAbs) ? relOrAbs : join25(corpus, relOrAbs);
  if (!existsSync18(abs)) return;
  const rel = relFromAbs(corpus, abs);
  if (rel.endsWith("/article.md")) {
    addExistingTarget(corpus, targets, dirname7(abs), "source");
    return;
  }
  addExistingTarget(corpus, targets, abs, "source");
  if (rel.endsWith(".md")) {
    const assetsDir = abs.replace(/\.md$/, ".assets");
    addExistingTarget(corpus, targets, assetsDir, "source");
  }
}
function sourceCandidatesForSlug(corpus, slug) {
  return [
    join25(corpus, slug),
    join25(corpus, `${slug}.md`),
    join25(corpus, slug, "article.md")
  ];
}
function collectSourceUrls(corpus, targets) {
  const urls = /* @__PURE__ */ new Set();
  for (const target of targets.values()) {
    const files = existsSync18(target.abs) && target.rel.endsWith(".md") ? [target.abs] : collectMdFiles(target.abs);
    for (const file of files) {
      const fm = extractFrontmatter(file);
      if (typeof fm.source_url === "string") urls.add(fm.source_url);
      if (typeof fm.url === "string") urls.add(fm.url);
    }
  }
  return [...urls];
}
function addSourcesFromSummary(corpus, targets, summaryAbs) {
  const parsed = matter2(readText(summaryAbs));
  const sources = Array.isArray(parsed.data.sources) ? parsed.data.sources : [];
  for (const source of sources) {
    if (typeof source !== "string") continue;
    for (const candidate of sourceCandidatesForSlug(corpus, source)) {
      if (existsSync18(candidate)) addSourceTarget(corpus, targets, candidate);
    }
  }
  for (const link of extractWikilinks(parsed.content)) {
    if (!link.startsWith("\u539F\u6599/")) continue;
    for (const candidate of sourceCandidatesForSlug(corpus, link)) {
      if (existsSync18(candidate)) addSourceTarget(corpus, targets, candidate);
    }
  }
}
function addSummariesReferencingSources(corpus, targets, aliases) {
  for (const file of collectMdFiles(join25(corpus, "\u77E5\u8BC6\u5E93", "\u6458\u8981"))) {
    const rel = relFromAbs(corpus, file);
    if (targets.has(rel)) continue;
    const content = readText(file);
    if ([...aliases].some((alias) => content.includes(`[[${alias}`))) {
      addExistingTarget(corpus, targets, file, "summary");
      addSourcesFromSummary(corpus, targets, file);
    }
  }
}
function compiledTruthSnippets(content, aliases, input) {
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const match = body.match(/##\s*Compiled Truth\s*\n+([\s\S]*?)(?=\n##\s|$)/);
  if (!match) return [];
  return match[1].split(/\n{2,}/).map((p) => p.trim()).filter((p) => {
    if (!p) return false;
    if (isUrl(input) && p.includes(input)) return true;
    return [...aliases].some((alias) => p.includes(`[[${alias}`));
  });
}
function rewritePageForRemoval(corpus, file, aliases) {
  const rel = relFromAbs(corpus, file);
  const parsed = matter2(readText(file));
  const removedSources = [];
  let sourceCountBefore;
  let sourceCountAfter;
  if (Array.isArray(parsed.data.sources)) {
    const nextSources = parsed.data.sources.filter((source) => {
      if (typeof source !== "string") return true;
      const remove = aliases.has(stripMd(normalizeRel(source)));
      if (remove) removedSources.push(source);
      return !remove;
    });
    if (removedSources.length > 0) {
      parsed.data.sources = nextSources;
      const rawCount = parsed.data.source_count;
      const numeric = typeof rawCount === "number" ? rawCount : typeof rawCount === "string" ? Number.parseInt(rawCount, 10) : Number.NaN;
      if (Number.isFinite(numeric)) {
        sourceCountBefore = numeric;
        sourceCountAfter = Math.max(0, numeric - new Set(removedSources).size);
        parsed.data.source_count = sourceCountAfter;
      }
      parsed.data.updated = todayYMDShanghai();
    }
  }
  const removedLines = [];
  const nextLines = parsed.content.split("\n").filter((line) => {
    const trimmed = line.trim();
    const hasTargetLink = [...aliases].some((alias) => line.includes(`[[${alias}`));
    const removable = hasTargetLink && /^[-*]\s+/.test(trimmed);
    if (removable) {
      removedLines.push(line);
      return false;
    }
    return true;
  });
  if (removedLines.length > 0) parsed.data.updated = todayYMDShanghai();
  const changed = removedLines.length > 0 || removedSources.length > 0;
  const nextContent = changed ? matter2.stringify(nextLines.join("\n"), parsed.data) : readText(file);
  return {
    nextContent,
    change: changed ? {
      file: rel,
      removedLines,
      removedSources,
      sourceCountBefore,
      sourceCountAfter
    } : null
  };
}
function buildRemovalPlan(corpus, input, apply) {
  const targets = /* @__PURE__ */ new Map();
  const ingestRecords = /* @__PURE__ */ new Set();
  if (isUrl(input)) {
    const state = loadIngestState(corpus);
    const record = state.ingests[input];
    ingestRecords.add(input);
    if (record?.archivedTo) addSourceTarget(corpus, targets, record.archivedTo);
    for (const page of record?.wikiPages ?? []) {
      if (normalizeRel(page).startsWith("\u77E5\u8BC6\u5E93/\u6458\u8981/")) {
        const pageAbs = join25(corpus, page);
        addExistingTarget(corpus, targets, pageAbs, "summary");
        if (existsSync18(pageAbs)) addSourcesFromSummary(corpus, targets, pageAbs);
      }
    }
    const source = findSourceByUrl(corpus, input);
    if (source) addSourceTarget(corpus, targets, source);
  } else {
    const abs = resolveInputPath(corpus, input);
    if (!abs) throw new Error(`target not found inside corpus: ${input}`);
    const rel = relFromAbs(corpus, abs);
    if (rel.startsWith("\u539F\u6599/")) {
      addSourceTarget(corpus, targets, abs);
    } else if (rel.startsWith("\u77E5\u8BC6\u5E93/\u6458\u8981/")) {
      addExistingTarget(corpus, targets, abs, "summary");
      addSourcesFromSummary(corpus, targets, abs);
    } else {
      addExistingTarget(corpus, targets, abs, "target");
    }
  }
  let aliases = new Set([...targets.keys()].flatMap((rel) => aliasesForRel(rel)));
  addSummariesReferencingSources(corpus, targets, aliases);
  aliases = new Set([...targets.keys()].flatMap((rel) => aliasesForRel(rel)));
  for (const url of collectSourceUrls(corpus, targets)) ingestRecords.add(url);
  const trashedRels = new Set(targets.keys());
  const pageChanges = [];
  const reviewItems = [];
  for (const file of collectMdFiles(corpus)) {
    const rel = relFromAbs(corpus, file);
    if (trashedRels.has(rel)) continue;
    if ([...trashedRels].some((targetRel) => rel.startsWith(`${targetRel}/`))) continue;
    const { change } = rewritePageForRemoval(corpus, file, aliases);
    if (change) pageChanges.push(change);
    for (const text of compiledTruthSnippets(readText(file), aliases, input)) {
      reviewItems.push({ file: rel, section: "Compiled Truth", text });
    }
  }
  return {
    input,
    apply,
    trashTargets: [...targets.values()].sort((a, b) => a.rel.localeCompare(b.rel)),
    pageChanges,
    reviewItems,
    ingestRecords: [...ingestRecords],
    aliases: [...aliases].sort()
  };
}
async function moveToTrash(paths) {
  const testTrashDir = process.env.LOREKIT_TEST_TRASH_DIR;
  if (testTrashDir) {
    mkdirSync11(testTrashDir, { recursive: true });
    for (const p of paths) {
      if (!existsSync18(p)) continue;
      const dest = join25(testTrashDir, `${tsCompact()}-${basename6(p)}`);
      renameSync(p, dest);
    }
    return;
  }
  await trash(paths, { glob: false });
}
function applyPageChanges(corpus, plan) {
  const aliases = new Set(plan.aliases);
  for (const change of plan.pageChanges) {
    const file = join25(corpus, change.file);
    const { nextContent } = rewritePageForRemoval(corpus, file, aliases);
    writeFileSync12(file, nextContent, "utf-8");
  }
}
function forgetIngestRecords(corpus, urls) {
  if (urls.length === 0) return;
  const state = loadIngestState(corpus);
  let changed = false;
  for (const url of urls) {
    if (state.ingests[url]) {
      delete state.ingests[url];
      changed = true;
    }
  }
  if (changed) saveIngestState(corpus, state);
}
function printPlan(plan) {
  print(`lorekit remove \u2014 ${plan.apply ? "apply" : "dry-run"}
`);
  print(`\u5C06\u79FB\u52A8\u5230\u7CFB\u7EDF\u56DE\u6536\u7AD9 (${plan.trashTargets.length})`);
  for (const target of plan.trashTargets) {
    print(`  - ${target.rel} (${target.reason})`);
  }
  if (plan.trashTargets.length === 0) print("  - \uFF08\u65E0\uFF09");
  print();
  print(`\u5C06\u4FEE\u6539\u9875\u9762 (${plan.pageChanges.length})`);
  for (const change of plan.pageChanges) {
    print(`  - ${change.file}`);
    if (change.removedSources.length > 0) {
      print(`    sources: -${change.removedSources.length}`);
    }
    if (change.sourceCountBefore !== void 0 && change.sourceCountAfter !== void 0) {
      print(`    source_count: ${change.sourceCountBefore} -> ${change.sourceCountAfter}`);
    }
    if (change.removedLines.length > 0) {
      print(`    lines: -${change.removedLines.length}`);
    }
  }
  if (plan.pageChanges.length === 0) print("  - \uFF08\u65E0\uFF09");
  print();
  if (plan.reviewItems.length > 0) {
    print(`\u9700\u4EBA\u5DE5\u590D\u6838 Compiled Truth (${plan.reviewItems.length})`);
    for (const item of plan.reviewItems) {
      print(`  - ${item.file}: ${item.text.slice(0, 120)}`);
    }
    print();
  }
  if (!plan.apply) {
    print("dry-run only. Run again with --apply to move files to OS Trash.");
  }
}
function removeCommand(program2) {
  program2.command("remove").argument("<target>", "URL or corpus-relative path to remove").option("--apply", "execute the removal; default is dry-run", false).option("--json", "emit a machine-readable JSON report", false).description("safely remove a source/wiki page and provenance-linked references").action(async (target, opts) => {
    const corpus = requireCorpus();
    let plan;
    try {
      plan = buildRemovalPlan(corpus, target, !!opts.apply);
    } catch (e) {
      err(e.message);
      process.exitCode = 2;
      return;
    }
    if (!opts.json) printPlan(plan);
    if (opts.json && !opts.apply) out(JSON.stringify(plan));
    if (!opts.apply) return;
    if (plan.trashTargets.length === 0 && plan.pageChanges.length === 0) {
      bad("nothing to remove");
      process.exitCode = 1;
      if (opts.json) out(JSON.stringify(plan));
      return;
    }
    try {
      const snapshot = await createSnapshot(corpus, { tag: "remove" });
      plan.snapshot = snapshot;
      ok(`snapshot saved: ${snapshot}`);
      applyPageChanges(corpus, plan);
      forgetIngestRecords(corpus, plan.ingestRecords);
      await moveToTrash(plan.trashTargets.map((t) => t.abs));
      ok(`moved ${plan.trashTargets.length} item(s) to OS Trash`);
      await runSync(corpus);
      const issues = runLint(corpus);
      plan.lintIssues = countHardLintIssues(issues);
      printLintReport(corpus, issues);
    } catch (e) {
      err(e.message);
      process.exitCode = 1;
    }
    if (opts.json) out(JSON.stringify(plan));
  });
}

// src/commands/links.ts
import { existsSync as existsSync19, mkdirSync as mkdirSync12, readFileSync as readFileSync17, writeFileSync as writeFileSync13 } from "fs";
import { join as join26, dirname as dirname8 } from "path";
var TYPE_DIR = {
  concept: "\u77E5\u8BC6\u5E93/\u6982\u5FF5",
  entity: "\u77E5\u8BC6\u5E93/\u5B9E\u4F53"
};
function resolveFileArg(corpus, f) {
  const abs = f.startsWith("/") ? f : join26(process.cwd(), f);
  return { abs, rel: relPosix(corpus, abs) };
}
function guardNotRaw(rel) {
  if (rel === "\u539F\u6599" || rel.startsWith("\u539F\u6599/")) {
    bad(`refuse to edit read-only raw source: ${rel}`);
    return false;
  }
  return true;
}
var WIKILINK_RE = /(!?)\[\[([^\]|#]+)((?:#[^\]|]*)?)(\|[^\]]*)?\]\]/g;
function scanBrokenLinks(content, rel, index) {
  const stripped = content.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
  const broken = [];
  const seen = /* @__PURE__ */ new Set();
  let m;
  const re = new RegExp(WIKILINK_RE.source, "g");
  while ((m = re.exec(stripped)) !== null) {
    const target = m[2].trim();
    if (seen.has(target)) continue;
    seen.add(target);
    if (!resolveWikiLink(rel, target, index)) broken.push(target);
  }
  return broken;
}
function findCandidates(target, index) {
  const lower = target.toLowerCase();
  const tbase = (target.split("/").pop() ?? target).toLowerCase();
  const bySlug = /* @__PURE__ */ new Map();
  for (const stem of index.stems) {
    const sbase = (stem.split("/").pop() ?? stem).toLowerCase();
    let reason = "";
    if (stem.toLowerCase() === lower) reason = "case-mismatch";
    else if (sbase === tbase) reason = "path-drift / same-name";
    else if (tbase.length >= 2 && (sbase.includes(tbase) || tbase.includes(sbase)))
      reason = "near-match";
    if (reason && !bySlug.has(stem)) bySlug.set(stem, reason);
  }
  return [...bySlug.entries()].slice(0, 5).map(([slug, reason]) => ({ slug, reason }));
}
function rewriteLabel(content, label, transform) {
  let count = 0;
  const re = new RegExp(WIKILINK_RE.source, "g");
  const next = content.replace(re, (full, bang, tgt, anchor, disp) => {
    if (tgt.trim() !== label) return full;
    count++;
    return transform({ bang: bang ?? "", anchor: anchor ?? "", disp: disp ?? "" });
  });
  return { content: next, count };
}
function linksStatePath(corpus) {
  return join26(corpus, ".wiki", "links-state.json");
}
function loadLinksState(corpus) {
  const empty = { version: 1, pages: {}, plained: [] };
  const p = linksStatePath(corpus);
  if (!existsSync19(p)) return empty;
  try {
    const parsed = JSON.parse(readFileSync17(p, "utf-8"));
    if (parsed && typeof parsed === "object" && parsed.pages) {
      return { version: 1, pages: parsed.pages, plained: parsed.plained ?? [] };
    }
  } catch {
  }
  return empty;
}
function writeLinksState(corpus, state) {
  const p = linksStatePath(corpus);
  mkdirSync12(dirname8(p), { recursive: true });
  writeFileSync13(p, JSON.stringify(state, null, 2) + "\n", "utf-8");
  return p;
}
function saveLinksState(corpus, pages) {
  const state = loadLinksState(corpus);
  state.pages = { ...state.pages, ...pages };
  return writeLinksState(corpus, state);
}
function recordPlained(corpus, file, label) {
  const state = loadLinksState(corpus);
  if (state.plained.some((e) => e.file === file && e.label === label)) return;
  state.plained.push({ file, label, at: todayYMDShanghai() });
  writeLinksState(corpus, state);
}
function linksCommand(program2) {
  const group = program2.command("links").description("links closure: suggest/fix/stub/backlog/plain broken [[wikilinks]]");
  group.command("suggest").description("scan a page for broken wikilinks and list deterministic candidates (read-only)").requiredOption("--file <file...>", "wiki page(s) to scan").option("--json", "emit machine-readable JSON to stdout", false).option("--write-state", "persist results to .wiki/links-state.json", false).action((opts) => {
    const corpus = requireCorpus();
    const index = buildWikiLinkIndex(corpus);
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    const pages = {};
    const report = [];
    for (const f of opts.file) {
      const { abs, rel } = resolveFileArg(corpus, f);
      if (!existsSync19(abs)) {
        bad(`[links suggest] file not found: ${f}`);
        process.exitCode = 2;
        continue;
      }
      const content = readFileSync17(abs, "utf-8");
      const brokenTargets = scanBrokenLinks(content, rel, index);
      const broken = brokenTargets.map((link) => ({ link, candidates: findCandidates(link, index) }));
      pages[rel] = { checkedAt, broken };
      report.push({ file: rel, broken });
    }
    for (const r of report) {
      if (r.broken.length === 0) {
        ok(`${r.file}: no broken links`);
      } else {
        print(`\u2717 ${r.file}: ${r.broken.length} broken link(s)`);
        for (const b of r.broken) {
          const cands = b.candidates.length ? b.candidates.map((c) => `${c.slug} (${c.reason})`).join(", ") : "(no candidates)";
          print(`    [[${b.link}]] \u2192 ${cands}`);
        }
      }
    }
    if (opts.writeState) {
      const p = saveLinksState(corpus, pages);
      print(`state written: ${relPosix(corpus, p)}`);
    }
    if (opts.json) out(JSON.stringify({ pages: report }));
    const totalBroken = report.reduce((n, r) => n + r.broken.length, 0);
    if (totalBroken > 0) process.exitCode = 1;
  });
  group.command("fix <label>").description("repoint [[label]] to a canonical target in a file; optionally register an alias").requiredOption("--to <target>", "canonical link target (slug or bare name)").requiredOption("--file <file>", "file whose [[label]] should be repointed").option("--alias <name>", "register this alias in the canonical page frontmatter aliases").action((label, opts) => {
    const corpus = requireCorpus();
    const { abs, rel } = resolveFileArg(corpus, opts.file);
    if (!existsSync19(abs)) {
      bad(`[links fix] file not found: ${opts.file}`);
      process.exitCode = 2;
      return;
    }
    if (!guardNotRaw(rel)) {
      process.exitCode = 2;
      return;
    }
    const content = readFileSync17(abs, "utf-8");
    const { content: next, count } = rewriteLabel(content, label, ({ bang, anchor, disp }) => {
      return `${bang}[[${opts.to}${anchor}${disp}]]`;
    });
    if (count === 0) {
      warn(`[links fix] no [[${label}]] found in ${rel}`);
      process.exitCode = 1;
      return;
    }
    writeFileSync13(abs, next, "utf-8");
    ok(`[links fix] ${rel}: ${count} link(s) [[${label}]] \u2192 [[${opts.to}]]`);
    let aliasResult = "";
    if (opts.alias) {
      aliasResult = registerAlias(corpus, opts.to, opts.alias);
      if (aliasResult) print(aliasResult);
    }
    out(JSON.stringify({ file: rel, label, to: opts.to, rewritten: count, alias: opts.alias ?? null }));
  });
  group.command("stub <label>").description("create a placeholder page \u77E5\u8BC6\u5E93/<type>/<label>.md so [[label]] resolves").requiredOption("--type <type>", "concept | entity").requiredOption("--source <file>", "page that first mentioned this node (for a backref)").action((label, opts) => {
    const corpus = requireCorpus();
    const type = opts.type;
    if (type !== "concept" && type !== "entity") {
      bad(`[links stub] --type must be concept|entity, got: ${opts.type}`);
      process.exitCode = 2;
      return;
    }
    const dir = TYPE_DIR[type];
    const pageRel = `${dir}/${label}.md`;
    const pageAbs = join26(corpus, pageRel);
    if (existsSync19(pageAbs)) {
      warn(`[links stub] already exists: ${pageRel}`);
      out(JSON.stringify({ created: false, page: pageRel }));
      return;
    }
    const { rel: sourceRel } = resolveFileArg(corpus, opts.source);
    const sourceStem = sourceRel.replace(/\.md$/, "");
    const today2 = todayYMDShanghai();
    const body = [
      "---",
      `type: ${type}`,
      `title: ${label}`,
      `slug: ${dir}/${label}`,
      `created: ${today2}`,
      `updated: ${today2}`,
      `aliases: [${label}]`,
      "stub: true",
      "---",
      "",
      `> \u5360\u4F4D stub \u9875\uFF08\`lorekit links stub\` \u521B\u5EFA\uFF09\uFF0C\u7B49\u5F85\u8865\u5145\u5185\u5BB9\u3002`,
      "",
      `\u9996\u6B21\u63D0\u53CA\u6765\u6E90\uFF1A[[${sourceStem}]]`,
      ""
    ].join("\n");
    mkdirSync12(dirname8(pageAbs), { recursive: true });
    writeFileSync13(pageAbs, body, "utf-8");
    ok(`[links stub] created ${pageRel}`);
    out(JSON.stringify({ created: true, page: pageRel, type }));
  });
  group.command("backlog <label>").description("record a future node in \u7CFB\u7EDF/missing-nodes.md (does not edit the source)").requiredOption("--type <type>", "concept | entity").requiredOption("--source <file>", "page that mentioned this node").option("--reason <text>", "why it is backlogged rather than built now").action((label, opts) => {
    const corpus = requireCorpus();
    const type = opts.type;
    if (type !== "concept" && type !== "entity") {
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
    const reason = (opts.reason ?? "").replace(/\|/g, "/").trim() || "(unspecified)";
    const row = `| ${label} | ${type} | ${sourceRel} | ${reason} | ${todayYMDShanghai()} |
`;
    const next = existing.endsWith("\n") ? existing + row : existing + "\n" + row;
    writeFileSync13(missingNodesPath(corpus), next, "utf-8");
    ok(`[links backlog] recorded ${label} \u2192 ${MISSING_NODES_REL}`);
    out(JSON.stringify({ added: true, label, type, source: sourceRel }));
  });
  group.command("plain <label>").description("downgrade [[label]] to plain text in a file (drop the graph node)").requiredOption("--file <file>", "file whose [[label]] should be downgraded").action((label, opts) => {
    const corpus = requireCorpus();
    const { abs, rel } = resolveFileArg(corpus, opts.file);
    if (!existsSync19(abs)) {
      bad(`[links plain] file not found: ${opts.file}`);
      process.exitCode = 2;
      return;
    }
    if (!guardNotRaw(rel)) {
      process.exitCode = 2;
      return;
    }
    const content = readFileSync17(abs, "utf-8");
    const { content: next, count } = rewriteLabel(content, label, ({ disp }) => {
      return disp ? disp.slice(1) : label;
    });
    if (count === 0) {
      warn(`[links plain] no [[${label}]] found in ${rel}`);
      process.exitCode = 1;
      return;
    }
    writeFileSync13(abs, next, "utf-8");
    recordPlained(corpus, rel, label);
    ok(`[links plain] ${rel}: downgraded ${count} [[${label}]] to plain text (recorded)`);
    out(JSON.stringify({ file: rel, label, downgraded: count, recorded: true }));
  });
  group.command("plained").description("list plain-downgrade ledger; mark entries whose target now exists as revivable").option("--json", "emit machine-readable JSON to stdout", false).action((opts) => {
    const corpus = requireCorpus();
    const state = loadLinksState(corpus);
    const index = buildWikiLinkIndex(corpus);
    const kept = [];
    const report = [];
    for (const e of state.plained) {
      const abs = join26(corpus, e.file);
      if (!existsSync19(abs)) continue;
      const content = readFileSync17(abs, "utf-8");
      const relinkRe = new RegExp(WIKILINK_RE.source, "g");
      let relinked = false;
      let m;
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
        status: resolveWikiLink(e.file, e.label, index) ? "revivable" : "pending"
      });
    }
    if (kept.length !== state.plained.length) {
      state.plained = kept;
      writeLinksState(corpus, state);
    }
    const revivable = report.filter((r) => r.status === "revivable");
    if (report.length === 0) {
      ok("[links plained] ledger empty");
    } else {
      for (const r of report) {
        if (r.status === "revivable") {
          warn(`[links plained] ${r.file}: "${r.label}" \u76EE\u6807\u9875\u5DF2\u5B58\u5728\uFF0C\u53EF\u91CD\u8FDE\uFF08plain @ ${r.at}\uFF09`);
        } else {
          print(`  ${r.file}: "${r.label}" pending\uFF08plain @ ${r.at}\uFF09`);
        }
      }
      print(`${report.length} entr(ies), ${revivable.length} revivable`);
    }
    if (opts.json) out(JSON.stringify({ plained: report }));
  });
}
function registerAlias(corpus, canonicalTarget, alias) {
  const file = resolveCanonicalFile(corpus, canonicalTarget);
  if (!file) return `(alias \u672A\u767B\u8BB0\uFF1A\u627E\u4E0D\u5230 canonical \u9875 ${canonicalTarget})`;
  const content = readFileSync17(file, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return `(alias \u672A\u767B\u8BB0\uFF1A${relPosix(corpus, file)} \u65E0 frontmatter)`;
  const fm = fmMatch[1];
  const aliasLine = fm.match(/^aliases:\s*\[([^\]]*)\]\s*$/m);
  let nextFm;
  if (aliasLine) {
    const items = aliasLine[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (items.includes(alias)) return `(alias \u5DF2\u5B58\u5728\uFF1A${alias})`;
    items.push(alias);
    nextFm = fm.replace(aliasLine[0], `aliases: [${items.join(", ")}]`);
  } else {
    nextFm = `${fm}
aliases: [${alias}]`;
  }
  const next = content.replace(fmMatch[0], `---
${nextFm}
---`);
  writeFileSync13(file, next, "utf-8");
  return `alias registered: ${alias} \u2192 ${relPosix(corpus, file)}`;
}
function resolveCanonicalFile(corpus, target) {
  const direct = join26(corpus, `${target}.md`);
  if (existsSync19(direct)) return direct;
  for (const file of collectMdFiles(corpus)) {
    const rel = relPosix(corpus, file);
    const stem = rel.replace(/\.md$/, "");
    if (stem === target || stem.split("/").pop() === target) return file;
  }
  return null;
}

// src/commands/workbench.ts
import { statSync as statSync6 } from "fs";
import { join as join27 } from "path";
import chalk7 from "chalk";
var WORKBENCH_DIR = "_\u5DE5\u4F5C\u53F0";
var DAY_MS = 864e5;
var BUCKET_DIRS = /* @__PURE__ */ new Set(["\u6536\u4EF6", "\u8349\u7A3F", "\u4E34\u65F6", "\u5F85\u6574\u7406", "\u4E0B\u8F7D"]);
function topDirOf(rel) {
  const parts = rel.split("/");
  return parts.length >= 3 ? parts[1] : null;
}
function buildWorkbenchReport(corpus, opts) {
  const now = Date.now();
  const files = collectMdFiles(join27(corpus, WORKBENCH_DIR));
  const excludedCount = /* @__PURE__ */ new Map();
  const byTopDir = /* @__PURE__ */ new Map();
  for (const file of files) {
    const rel = relPosix(corpus, file);
    const noise = workbenchTriageExcludePrefixes.find((p) => matchesDirPrefix(rel, p));
    if (noise) {
      excludedCount.set(noise, (excludedCount.get(noise) ?? 0) + 1);
      continue;
    }
    let st;
    try {
      st = statSync6(file);
    } catch {
      continue;
    }
    const ageDays = Math.floor((now - st.mtime.getTime()) / DAY_MS);
    const top = topDirOf(rel);
    const list = byTopDir.get(top) ?? [];
    list.push({ rel, ageDays, sizeBytes: st.size, mtime: st.mtime });
    byTopDir.set(top, list);
  }
  const candidates = [];
  const activeDirs = [];
  let freshFiles = 0;
  for (const [top, list] of byTopDir) {
    const newestAgeDays = Math.min(...list.map((f) => f.ageDays));
    if (top !== null && !BUCKET_DIRS.has(top) && newestAgeDays <= opts.activeDays) {
      activeDirs.push({ dir: `${WORKBENCH_DIR}/${top}`, newestAgeDays, skippedFiles: list.length });
      continue;
    }
    for (const f of list) {
      if (f.ageDays >= opts.staleDays) {
        candidates.push({
          path: f.rel,
          topDir: top ? `${WORKBENCH_DIR}/${top}` : null,
          mtime: f.mtime.toISOString().slice(0, 10),
          ageDays: f.ageDays,
          sizeBytes: f.sizeBytes
        });
      } else {
        freshFiles++;
      }
    }
  }
  candidates.sort((a, b) => b.ageDays - a.ageDays || a.path.localeCompare(b.path));
  activeDirs.sort((a, b) => a.dir.localeCompare(b.dir));
  return {
    corpus,
    staleDays: opts.staleDays,
    activeDays: opts.activeDays,
    candidates,
    activeDirs,
    excluded: [...excludedCount.entries()].map(([prefix, count]) => ({ prefix, files: count })),
    freshFiles
  };
}
function printHumanReport(report) {
  print(chalk7.bold(`
lorekit workbench report \u2014 ${report.corpus}
`));
  print(
    chalk7.dim(
      `\u9608\u503C\uFF1A\u8D26\u9F84 \u2265 ${report.staleDays} \u5929\u8FDB\u5019\u9009\uFF1B\u76EE\u5F55\u5185 ${report.activeDays} \u5929\u5185\u6709\u6539\u52A8\u89C6\u4E3A\u6D3B\u8DC3\u9879\u76EE\u6574\u4F53\u8DF3\u8FC7
`
    )
  );
  print(chalk7.cyan(`\u2500\u2500 \u6E05\u7B97\u5019\u9009\uFF08${report.candidates.length}\uFF09\u2500\u2500`));
  for (const c of report.candidates) {
    print(`  ${c.mtime}  ${String(c.ageDays).padStart(4)}d  ${c.path}`);
  }
  if (report.candidates.length === 0) print(chalk7.dim("  \uFF08\u65E0\uFF09"));
  print();
  print(chalk7.cyan(`\u2500\u2500 \u6D3B\u8DC3\u9879\u76EE\u76EE\u5F55\uFF08\u8DF3\u8FC7\uFF0C${report.activeDirs.length}\uFF09\u2500\u2500`));
  for (const d of report.activeDirs) {
    print(chalk7.dim(`  ${d.dir}\uFF08\u6700\u8FD1 ${d.newestAgeDays}d \u5185\u6709\u6539\u52A8\uFF0C${d.skippedFiles} \u6587\u4EF6\uFF09`));
  }
  print();
  for (const e of report.excluded) {
    print(chalk7.dim(`\u56FA\u5B9A\u6392\u9664 ${e.prefix}/**\uFF1A${e.files} \u6587\u4EF6`));
  }
  print(chalk7.dim(`\u672A\u5230\u8D26\u9F84\u9608\u503C\uFF1A${report.freshFiles} \u6587\u4EF6`));
  print();
}
function workbenchCommand(program2) {
  const workbench = program2.command("workbench").description("workbench (_\u5DE5\u4F5C\u53F0) inspection helpers");
  workbench.command("report").description("read-only triage candidate report: stale files, active dirs, exclusions").option("--stale-days <n>", "age threshold in days for candidates", "45").option("--active-days <n>", "dirs touched within N days are skipped as active", "14").option("--json", "machine-readable output", false).action((opts) => {
    const corpus = requireCorpus();
    const staleDays = Number.parseInt(opts.staleDays, 10);
    const activeDays = Number.parseInt(opts.activeDays, 10);
    if (!Number.isFinite(staleDays) || staleDays < 0 || !Number.isFinite(activeDays) || activeDays < 0) {
      warn("invalid --stale-days / --active-days");
      process.exit(2);
    }
    const report = buildWorkbenchReport(corpus, { staleDays, activeDays });
    if (opts.json) out(JSON.stringify(report, null, 2));
    else printHumanReport(report);
  });
}

// src/commands/trash.ts
import { existsSync as existsSync20 } from "fs";
import { join as join28, resolve as resolve5, isAbsolute as isAbsolute3 } from "path";
import trash2 from "trash";
function trashCommand(program2) {
  program2.command("trash").description("Move corpus files/dirs to OS Trash / Recycle Bin (recoverable; never rm)").argument("<paths...>", "corpus-relative or absolute paths inside the corpus").action(async (paths) => {
    const corpus = requireCorpus();
    const targets = [];
    for (const input of paths) {
      const abs = resolve5(isAbsolute3(input) ? input : join28(corpus, input));
      if (!isWithin(corpus, abs)) {
        err(`refusing to trash outside the corpus: ${input}`);
        process.exit(2);
      }
      const rel = relPosix(corpus, abs);
      if (rel === "") {
        err("refusing to trash the corpus root");
        process.exit(2);
      }
      if (rel === "\u539F\u6599" || rel.startsWith("\u539F\u6599/")) {
        err(`\u539F\u6599/ is read-only; refusing: ${rel}`);
        process.exit(2);
      }
      if (rel === "\u77E5\u8BC6\u5E93" || rel.startsWith("\u77E5\u8BC6\u5E93/")) {
        err(`use \`lorekit remove\` for \u77E5\u8BC6\u5E93/ pages (provenance-aware cleanup): ${rel}`);
        process.exit(2);
      }
      if (rel === ".wiki" || rel.startsWith(".wiki/")) {
        err(`refusing to trash lorekit metadata: ${rel}`);
        process.exit(2);
      }
      if (!existsSync20(abs)) {
        err(`not found: ${rel}`);
        process.exit(2);
      }
      targets.push(abs);
    }
    await trash2(targets, { glob: false });
    for (const t of targets) print(`  \u{1F5D1} ${relPosix(corpus, t)}`);
    ok(`moved ${targets.length} item(s) to OS Trash`);
  });
}

// src/cli.ts
var version = readVersion();
function showBanner() {
  const corpus = findCorpus();
  let pages = "\u2014";
  if (corpus) {
    try {
      pages = String(collectMdFiles(corpus).length);
    } catch (e) {
      debug(`banner: collectMdFiles failed: ${e.message}`);
    }
  }
  const short = corpus && corpus.length > 45 ? "..." + corpus.slice(-42) : corpus ?? "\u2014";
  const B = chalk8.blue;
  const BB = chalk8.blueBright.bold;
  const C = chalk8.cyan;
  const D = chalk8.dim;
  const W = chalk8.white.bold;
  print();
  print(`  ${BB("\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}`);
  print(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551 \u2588\u2588\u2554\u255D\u2588\u2588\u2551\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D")}`);
  print(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  print(`  ${B("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  print(`  ${B("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  print(`  ${D("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D   \u255A\u2550\u255D   ")}`);
  print(`  ${D("Personal LLM Wiki Toolkit")}  ${C(`v${version}`)}`);
  print();
  print(`  ${C("corpus")}  ${short}`);
  print(`  ${C("pages")}   ${pages}`);
  print();
  print(`  ${W("$ lorekit doctor")}    \u5065\u5EB7\u68C0\u67E5`);
  print(`  ${W("$ lorekit fetch")}     \u6293\u53D6\u7F51\u9875`);
  print(`  ${W("$ lorekit search")}    \u641C\u7D22`);
  print(`  ${W("$ lorekit --help")}    \u6240\u6709\u547D\u4EE4`);
  print();
}
var program = new Command();
var ARG_ERROR_CODES = /* @__PURE__ */ new Set([
  "commander.missingArgument",
  "commander.missingMandatoryOptionValue",
  "commander.invalidArgument",
  "commander.invalidOptionArgument",
  "commander.unknownCommand",
  "commander.unknownOption",
  "commander.excessArguments"
]);
program.exitOverride((cmdErr) => {
  if (cmdErr.code === "commander.help" || cmdErr.code === "commander.version" || cmdErr.code === "commander.helpDisplayed") {
    process.exit(0);
  }
  if (ARG_ERROR_CODES.has(cmdErr.code)) {
    process.exit(2);
  }
  process.exit(cmdErr.exitCode || 1);
});
program.name("lorekit").version(version).description("Personal LLM Wiki Toolkit");
initCommand(program);
doctorCommand(program);
statsCommand(program);
lintCommand(program);
auditCommand(program);
indexCommand(program);
installSkillsCommand(program);
snapshotCommand(program);
restoreCommand(program);
searchCommand(program);
fetchCommand(program);
ingestCommand(program);
syncCommand(program);
obsidianTuneCommand(program);
removeCommand(program);
linksCommand(program);
workbenchCommand(program);
trashCommand(program);
if (process.argv.length <= 2) {
  showBanner();
} else {
  program.parse();
}
//# sourceMappingURL=cli.js.map