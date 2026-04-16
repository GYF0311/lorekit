#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/corpus.ts
var corpus_exports = {};
__export(corpus_exports, {
  collectMdFiles: () => collectMdFiles,
  extractFrontmatter: () => extractFrontmatter,
  extractFrontmatterField: () => extractFrontmatterField,
  findCorpus: () => findCorpus,
  hasFrontmatter: () => hasFrontmatter,
  requireCorpus: () => requireCorpus
});
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import matter from "gray-matter";
function findCorpus(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== "/" && dir) {
    if (existsSync(join(dir, ".wiki")) || existsSync(join(dir, "CLAUDE.md"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}
function requireCorpus(startDir) {
  const corpus = findCorpus(startDir);
  if (!corpus) {
    throw new Error("not inside a corpus (no .wiki/ or CLAUDE.md found)");
  }
  return corpus;
}
function extractFrontmatter(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    return data;
  } catch {
    return {};
  }
}
function hasFrontmatter(filePath) {
  try {
    const first = readFileSync(filePath, "utf-8").slice(0, 4);
    return first === "---\n" || first === "---\r";
  } catch {
    return false;
  }
}
function extractFrontmatterField(filePath, key) {
  const fm = extractFrontmatter(filePath);
  const val = fm[key];
  return typeof val === "string" ? val : void 0;
}
function collectMdFiles(dir, opts) {
  const results = [];
  if (!existsSync(dir)) return results;
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md") && !EXCLUDE_NAMES.has(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results.sort();
}
var EXCLUDE_NAMES;
var init_corpus = __esm({
  "src/lib/corpus.ts"() {
    "use strict";
    EXCLUDE_NAMES = /* @__PURE__ */ new Set([".gitkeep", ".DS_Store", "_INDEX.md"]);
  }
});

// src/cli.ts
init_corpus();
import { Command } from "commander";
import chalk6 from "chalk";

// src/utils/fs.ts
import { createHash } from "crypto";
import { readFileSync as readFileSync2, statSync as statSync2 } from "fs";
import { join as join2, dirname as dirname2 } from "path";
import { fileURLToPath } from "url";
function sha256(filePath) {
  const content = readFileSync2(filePath);
  return createHash("sha256").update(content).digest("hex");
}
function lorekitRoot() {
  const thisFile = fileURLToPath(import.meta.url);
  return join2(dirname2(thisFile), "..", "..");
}
function readVersion() {
  try {
    return readFileSync2(join2(lorekitRoot(), "VERSION"), "utf-8").trim();
  } catch {
    return "0.2.0";
  }
}

// src/commands/init.ts
import { existsSync as existsSync2, mkdirSync, readdirSync as readdirSync2, cpSync, writeFileSync } from "fs";
import { join as join3 } from "path";
import { createInterface } from "readline";
import chalk2 from "chalk";

// src/utils/logger.ts
import chalk from "chalk";
var ok = (msg) => console.log(`${chalk.green("\u2713")} ${msg}`);
var bad = (msg) => console.log(`${chalk.red("\u2717")} ${msg}`);
var warn = (msg) => console.error(`${chalk.yellow("lorekit:")} ${msg}`);
var err = (msg) => console.error(`${chalk.red("lorekit:")} ${msg}`);

// src/commands/init.ts
var MINIMAL_DIRS = [
  "\u539F\u6599",
  "\u77E5\u8BC6\u5E93/\u6982\u5FF5",
  "\u77E5\u8BC6\u5E93/\u5B9E\u4F53",
  "\u77E5\u8BC6\u5E93/\u6458\u8981",
  "\u6BCF\u65E5",
  "\u7CFB\u7EDF",
  ".wiki"
];
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
function isDirEmpty(dir) {
  if (!existsSync2(dir)) return true;
  const entries = readdirSync2(dir).filter((n) => n !== ".DS_Store" && n !== ".git");
  return entries.length === 0;
}
function copyTemplateFiles(src, dest) {
  if (!existsSync2(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync2(src, { withFileTypes: true })) {
    const srcPath = join3(src, entry.name);
    const destPath = join3(dest, entry.name);
    if (entry.isDirectory()) {
      copyTemplateFiles(srcPath, destPath);
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
    const resolved = join3(process.cwd(), targetPath);
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
      console.log(chalk2.yellow(`
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
    deployObsidianPlugin(resolved);
    console.log();
    ok(chalk2.bold(`corpus initialized at ${resolved}`));
  });
}

// src/commands/doctor.ts
import { existsSync as existsSync3, readFileSync as readFileSync4, readdirSync as readdirSync3 } from "fs";
import { join as join4, relative as relative2 } from "path";
import chalk3 from "chalk";
init_corpus();
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
function checkDirs(corpus) {
  let issues = 0;
  for (const dir of EXPECTED_DIRS) {
    const full = join4(corpus, dir);
    if (existsSync3(full)) {
      ok(`${dir}/`);
    } else {
      bad(`${dir}/ ${chalk3.dim("missing")}`);
      issues++;
    }
  }
  return issues;
}
function checkWikiVersion(corpus) {
  const versionFile = join4(corpus, ".wiki", "version");
  if (existsSync3(versionFile)) {
    const ver = readFileSync4(versionFile, "utf-8").trim();
    ok(`.wiki/version \u2192 ${ver}`);
    return 0;
  }
  bad(".wiki/version missing");
  return 1;
}
function checkFrontmatterCoverage(corpus) {
  const files = collectMdFiles(corpus);
  const withFm = files.filter((f) => hasFrontmatter(f)).length;
  const total = files.length;
  const pct = total === 0 ? 100 : Math.round(withFm / total * 100);
  const color = pct >= 90 ? chalk3.green : pct >= 60 ? chalk3.yellow : chalk3.red;
  const icon = pct >= 90 ? "\u2713" : pct >= 60 ? "\u26A0" : "\u2717";
  console.log(`${color(icon)} frontmatter coverage: ${withFm}/${total} (${pct}%)`);
}
function checkIndexFiles(corpus) {
  let missing = 0;
  function walk(dir) {
    if (!existsSync3(dir)) return;
    for (const entry of readdirSync3(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join4(dir, entry.name);
      if (entry.isDirectory()) {
        const hasMd = readdirSync3(full).some(
          (f) => f.endsWith(".md") && f !== "_INDEX.md"
        );
        if (hasMd && !existsSync3(join4(full, "_INDEX.md"))) {
          const rel = relative2(corpus, full);
          warn(`_INDEX.md missing in ${rel}/`);
          missing++;
        }
        walk(full);
      }
    }
  }
  walk(corpus);
  if (missing === 0) {
    ok("all directories with .md files have _INDEX.md");
  }
  return missing;
}
function checkArchive(corpus) {
  const archiveDir = join4(corpus, "_\u5F52\u6863");
  if (existsSync3(archiveDir)) {
    ok("_\u5F52\u6863/ exists");
    return 0;
  }
  warn("_\u5F52\u6863/ not found (optional)");
  return 0;
}
function doctorCommand(program2) {
  program2.command("doctor").description("run health checks on the corpus").action(() => {
    const corpus = requireCorpus();
    console.log(chalk3.bold(`
lorekit doctor \u2014 ${corpus}
`));
    let issues = 0;
    console.log(chalk3.cyan("\u2500\u2500 directories \u2500\u2500"));
    issues += checkDirs(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 wiki metadata \u2500\u2500"));
    issues += checkWikiVersion(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 frontmatter \u2500\u2500"));
    checkFrontmatterCoverage(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 index files \u2500\u2500"));
    issues += checkIndexFiles(corpus);
    console.log();
    console.log(chalk3.cyan("\u2500\u2500 archive \u2500\u2500"));
    checkArchive(corpus);
    console.log();
    if (issues === 0) {
      console.log(chalk3.green.bold("all checks passed \u2713"));
    } else {
      console.log(chalk3.yellow(`${issues} issue(s) found`));
    }
    console.log();
    process.exitCode = issues > 0 ? 1 : 0;
  });
}

// src/commands/stats.ts
init_corpus();
import { readFileSync as readFileSync5, statSync as statSync4 } from "fs";
import { relative as relative3 } from "path";
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
      const rel = relative3(corpus, file);
      const topDir = rel.split("/")[0] || ".";
      byDir[topDir] = (byDir[topDir] || 0) + 1;
      try {
        const mtime = statSync4(file).mtime;
        if (now - mtime.getTime() < sevenDays) {
          recentActive7d++;
        }
        const iso = mtime.toISOString();
        if (iso > lastUpdated) lastUpdated = iso;
      } catch {
      }
      try {
        const content = readFileSync5(file, "utf-8");
        const linkRe = /\[\[([^\]|#]+)[^\]]*\]\]/g;
        let m;
        while ((m = linkRe.exec(content)) !== null) {
          inboundLinks.add(m[1].trim());
        }
      } catch {
      }
    }
    const orphans = [];
    for (const file of files) {
      const rel = relative3(corpus, file);
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
    console.log(JSON.stringify(result, null, 2));
  });
}

// src/commands/lint.ts
init_corpus();
import { readFileSync as readFileSync6 } from "fs";
import { relative as relative4 } from "path";
import chalk4 from "chalk";
var REQUIRED_FIELDS = ["type", "title", "slug", "created", "updated"];
function lintCommand(program2) {
  program2.command("lint").description("check frontmatter, broken wikilinks, and orphan pages").action(() => {
    const corpus = requireCorpus();
    const files = collectMdFiles(corpus);
    const issues = [];
    const stemSet = /* @__PURE__ */ new Set();
    const baseNameSet = /* @__PURE__ */ new Set();
    const inboundLinks = /* @__PURE__ */ new Set();
    for (const file of files) {
      const rel = relative4(corpus, file);
      const stem = rel.replace(/\.md$/, "");
      stemSet.add(stem);
      baseNameSet.add(stem.split("/").pop());
    }
    const fileLinks = /* @__PURE__ */ new Map();
    for (const file of files) {
      const rel = relative4(corpus, file);
      const fm = extractFrontmatter(file);
      for (const field of REQUIRED_FIELDS) {
        if (!fm[field]) {
          issues.push({
            file: rel,
            kind: "missing-field",
            detail: `missing frontmatter field: ${field}`
          });
        }
      }
      try {
        const content = readFileSync6(file, "utf-8");
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
      for (const target of targets) {
        if (!stemSet.has(target) && !baseNameSet.has(target)) {
          issues.push({
            file: rel,
            kind: "broken-link",
            detail: `broken link: [[${target}]]`
          });
        }
      }
    }
    for (const file of files) {
      const rel = relative4(corpus, file);
      const stem = rel.replace(/\.md$/, "");
      const baseName = stem.split("/").pop();
      if (!inboundLinks.has(stem) && !inboundLinks.has(baseName)) {
        issues.push({
          file: rel,
          kind: "orphan",
          detail: "orphan page (no inbound links)"
        });
      }
    }
    console.log(chalk4.bold(`
lorekit lint \u2014 ${corpus}
`));
    if (issues.length === 0) {
      ok("no issues found");
      console.log();
      return;
    }
    const grouped = {};
    for (const issue of issues) {
      (grouped[issue.kind] ??= []).push(issue);
    }
    const kindLabels = {
      "missing-field": "frontmatter",
      "broken-link": "broken links",
      orphan: "orphan pages"
    };
    for (const [kind, items] of Object.entries(grouped)) {
      console.log(chalk4.cyan(`\u2500\u2500 ${kindLabels[kind] ?? kind} (${items.length}) \u2500\u2500`));
      for (const item of items) {
        bad(`${item.file}: ${item.detail}`);
      }
      console.log();
    }
    console.log(chalk4.yellow(`${issues.length} issue(s) total
`));
    process.exitCode = 1;
  });
}

// src/commands/audit.ts
init_corpus();
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readFileSync as readFileSync7, writeFileSync as writeFileSync2 } from "fs";
import { join as join6, basename as basename2 } from "path";
var SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };
function extractPreview(filePath) {
  const content = readFileSync7(filePath, "utf-8");
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
  if (filter === "open" || filter === "all") dirs.push(join6(root, "\u53CD\u9988", "\u5F85\u5904\u7406"));
  if (filter === "resolved" || filter === "all") dirs.push(join6(root, "\u53CD\u9988", "\u5DF2\u5904\u7406"));
  const entries = [];
  for (const dir of dirs) {
    if (!existsSync4(dir)) continue;
    const files = collectMdFiles(dir);
    for (const f of files) {
      if (basename2(f) === ".gitkeep") continue;
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
    console.log("No audit entries found.");
    return;
  }
  entries.sort((a, b) => b.sevOrder - a.sevOrder);
  for (const e of entries) {
    console.log(`[${e.severity}] ${e.target} \u2014 ${e.preview} (${e.created}) [${e.status}]`);
  }
  console.log();
  console.log(`Total: ${entries.length} entries`);
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
  const slug = basename2(target, ".md").replace(/[\s/]/g, "-").toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tsFile = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const tsFm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const filename = `${tsFile}-${slug}.md`;
  const destDir = join6(root, "\u53CD\u9988", "\u5F85\u5904\u7406");
  mkdirSync2(destDir, { recursive: true });
  const dest = join6(destDir, filename);
  const content = `---
type: audit
target: ${target}
severity: ${severity}
status: open
created: ${tsFm}
---

${text}
`;
  writeFileSync2(dest, content, "utf-8");
  ok(`created: \u53CD\u9988/\u5F85\u5904\u7406/${filename}`);
  console.log(`  target:   ${target}`);
  console.log(`  severity: ${severity}`);
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

// src/commands/index.ts
init_corpus();
import { existsSync as existsSync5, readdirSync as readdirSync4, readFileSync as readFileSync8, statSync as statSync5, writeFileSync as writeFileSync3, lstatSync } from "fs";
import { join as join7, basename as basename3 } from "path";
var INDEX_DIRS = [
  "\u77E5\u8BC6\u5E93/\u6982\u5FF5",
  "\u77E5\u8BC6\u5E93/\u5B9E\u4F53",
  "\u77E5\u8BC6\u5E93/\u6458\u8981",
  "\u77E5\u8BC6\u5E93/\u4E13\u9898",
  "\u6BCF\u65E5",
  "\u5199\u4F5C",
  "\u539F\u6599/\u6587\u7AE0",
  "\u539F\u6599/\u4E66\u7C4D",
  "\u539F\u6599/\u4F1A\u8BAE",
  "\u539F\u6599/\u5F55\u97F3",
  "\u539F\u6599/\u526A\u85CF"
];
function extractSummary(filePath) {
  const content = readFileSync8(filePath, "utf-8");
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
    let text = line.trim().replace(/^\*\*[^*]*\*\*\s*/, "");
    const periodMatch = text.match(/^([^。.]*[。.])/);
    if (periodMatch && periodMatch[1].length <= 50) {
      return periodMatch[1];
    }
    return text.slice(0, 50);
  }
  return "";
}
function buildIndex(dir, root) {
  const reldir = dir.slice(root.length + 1);
  const dirName = basename3(dir);
  const indexFile = join7(dir, "_INDEX.md");
  const mdFiles = [];
  let names;
  try {
    names = readdirSync4(dir, { encoding: "utf-8" });
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith(".")) continue;
    if (!name.endsWith(".md")) continue;
    if (name === "_INDEX.md" || name === ".gitkeep") continue;
    const full = join7(dir, name);
    try {
      if (lstatSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    mdFiles.push(full);
  }
  if (mdFiles.length === 0) return;
  const entries = [];
  for (const f of mdFiles) {
    let title = "";
    let updated = "";
    let summary = "";
    if (hasFrontmatter(f)) {
      const fm = extractFrontmatter(f);
      title = fm.title ?? "";
      updated = fm.updated ?? "";
      summary = extractSummary(f);
      if (!summary) summary = "\u2014";
    } else {
      summary = "\uFF08\u7F3A\u5C11 frontmatter\uFF09";
    }
    if (!title) title = basename3(f, ".md");
    if (!updated) {
      try {
        const mtime = statSync5(f).mtime;
        const pad = (n) => String(n).padStart(2, "0");
        updated = `${mtime.getFullYear()}-${pad(mtime.getMonth() + 1)}-${pad(mtime.getDate())}`;
      } catch {
        updated = "unknown";
      }
    }
    entries.push({ title, summary, updated });
  }
  entries.sort((a, b) => b.updated.localeCompare(a.updated));
  const lines = [];
  lines.push(`# ${dirName}`);
  lines.push("");
  lines.push(`> \u672C\u76EE\u5F55\u5171 ${entries.length} \u4E2A\u6761\u76EE\u3002\u7531 \`lorekit index\` \u81EA\u52A8\u751F\u6210\u3002`);
  lines.push("");
  lines.push("| \u6761\u76EE | \u6458\u8981 | \u66F4\u65B0 |");
  lines.push("|---|---|---|");
  for (const e of entries) {
    lines.push(`| [[${e.title}]] | ${e.summary} | ${e.updated} |`);
  }
  lines.push("");
  writeFileSync3(indexFile, lines.join("\n"), "utf-8");
  ok(`${reldir}/_INDEX.md (${entries.length} entries)`);
}
function indexCommand(program2) {
  const cmd = program2.command("index").description("Generate _INDEX.md for corpus directories").option("--dir <subdir>", "Only update a specific subdirectory");
  cmd.action((opts) => {
    const root = requireCorpus();
    if (opts.dir) {
      const full = join7(root, opts.dir);
      if (!existsSync5(full)) {
        err(`directory not found: ${opts.dir}`);
        process.exit(1);
      }
      buildIndex(full, root);
    } else {
      let generated = 0;
      for (const d of INDEX_DIRS) {
        const full = join7(root, d);
        if (!existsSync5(full)) continue;
        buildIndex(full, root);
        generated++;
      }
      if (generated === 0) {
        warn("no indexable directories found");
      }
    }
  });
}

// src/commands/install-skills.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync3, readdirSync as readdirSync5, symlinkSync, unlinkSync, readlinkSync, lstatSync as lstatSync2 } from "fs";
import { join as join8 } from "path";
function isSymlink(path) {
  try {
    return lstatSync2(path).isSymbolicLink();
  } catch {
    return false;
  }
}
function installSkillsCommand(program2) {
  const cmd = program2.command("install-skills").description("Install lorekit skills into a harness (e.g. Claude Code)").option("--target <harness>", 'Target harness (currently only "claude-code")').option("--list", "List currently installed wiki-* skill symlinks").option("--uninstall", "Remove installed skill symlinks");
  cmd.action((opts) => {
    const skillsDest = join8(process.env.HOME ?? "", ".claude", "skills");
    if (opts.list) {
      if (!existsSync6(skillsDest)) return;
      const names = readdirSync5(skillsDest, { encoding: "utf-8" });
      for (const name of names) {
        if (!name.startsWith("wiki-")) continue;
        const full = join8(skillsDest, name);
        if (!isSymlink(full)) continue;
        const target = readlinkSync(full);
        console.log(`${name} -> ${target}`);
      }
      return;
    }
    if (!opts.target) {
      err("install-skills: --target required");
      process.exit(2);
    }
    if (opts.target !== "claude-code") {
      err(`target '${opts.target}' not supported; only 'claude-code' is available`);
      process.exit(2);
    }
    mkdirSync3(skillsDest, { recursive: true });
    const skillsSrc = join8(lorekitRoot(), "skills");
    if (!existsSync6(skillsSrc)) {
      err(`skills directory not found: ${skillsSrc}`);
      process.exit(1);
    }
    const allNames = readdirSync5(skillsSrc, { encoding: "utf-8" });
    const skillNames = allNames.filter((name) => {
      if (!name.startsWith("wiki-")) return false;
      try {
        return lstatSync2(join8(skillsSrc, name)).isDirectory();
      } catch {
        return false;
      }
    });
    let count = 0;
    for (const name of skillNames) {
      const srcDir = join8(skillsSrc, name);
      const skillFile = join8(srcDir, "SKILL.md");
      if (!existsSync6(skillFile)) continue;
      const dest = join8(skillsDest, name);
      if (opts.uninstall) {
        if (isSymlink(dest)) {
          unlinkSync(dest);
          ok(`removed ${name}`);
          count++;
        }
      } else {
        if (isSymlink(dest)) unlinkSync(dest);
        symlinkSync(srcDir, dest);
        ok(`linked ${name}`);
        count++;
      }
    }
    if (count === 0) {
      console.log("No skills found to install.");
    } else if (!opts.uninstall) {
      console.log(`
Installed ${count} skill(s). Restart Claude Code to load them.`);
    }
  });
}

// src/commands/snapshot.ts
import { mkdirSync as mkdirSync4, writeFileSync as writeFileSync4, unlinkSync as unlinkSync2, readdirSync as readdirSync6, statSync as statSync6 } from "fs";
import { join as join9, relative as relative5 } from "path";
import * as tar from "tar";
init_corpus();
function collectAllFiles(dir, base) {
  const results = [];
  const EXCLUDE = /* @__PURE__ */ new Set([".wiki", ".git", ".DS_Store"]);
  function walk(d) {
    for (const entry of readdirSync6(d, { withFileTypes: true })) {
      if (EXCLUDE.has(entry.name)) continue;
      const full = join9(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(relative5(base, full));
      }
    }
  }
  walk(dir);
  return results.sort();
}
function snapshotCommand(program2) {
  program2.command("snapshot").option("--tag <name>", "optional tag appended to filename").description("create a tarball snapshot of the corpus").action(async (opts) => {
    const corpus = requireCorpus();
    const snapshotsDir = join9(corpus, ".wiki", "snapshots");
    mkdirSync4(snapshotsDir, { recursive: true });
    const files = collectAllFiles(corpus, corpus);
    if (files.length === 0) {
      bad("no files found in corpus");
      return;
    }
    const manifest = files.map((relPath) => {
      const full = join9(corpus, relPath);
      const st = statSync6(full);
      return {
        path: relPath,
        sha256: sha256(full),
        bytes: st.size,
        mtime: st.mtime.toISOString()
      };
    });
    const manifestPath = join9(snapshotsDir, "manifest.json");
    writeFileSync4(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join("");
    const tag = opts.tag ? `-${opts.tag}` : "";
    const tarName = `${stamp}${tag}.tar.gz`;
    const tarPath = join9(snapshotsDir, tarName);
    const allEntries = [
      ...files,
      relative5(corpus, manifestPath)
    ];
    await tar.create(
      {
        gzip: true,
        file: tarPath,
        cwd: corpus,
        prefix: ""
      },
      allEntries
    );
    unlinkSync2(manifestPath);
    const tarStat = statSync6(tarPath);
    const sizeMB = (tarStat.size / 1024 / 1024).toFixed(1);
    ok(`snapshot saved: ${tarPath} (${files.length} files, ${sizeMB} MB)`);
  });
}

// src/commands/restore.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync5, readFileSync as readFileSync10, copyFileSync, rmSync } from "fs";
import { join as join10, dirname as dirname3 } from "path";
import { createInterface as createInterface2 } from "readline";
import { tmpdir } from "os";
import * as tar2 from "tar";
import chalk5 from "chalk";
init_corpus();
function ask2(question) {
  const rl = createInterface2({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
function rmDirRecursive(dir) {
  rmSync(dir, { recursive: true, force: true });
}
function restoreCommand(program2) {
  program2.command("restore").requiredOption("--from <snapshot>", "path to snapshot .tar.gz").option("--dry-run", "only list differences, do not restore").option("--file <path>", "restore only this specific file").description("restore files from a snapshot").action(async (opts) => {
    const corpus = requireCorpus();
    if (!existsSync8(opts.from)) {
      bad(`snapshot not found: ${opts.from}`);
      process.exitCode = 1;
      return;
    }
    const tmpDir = join10(tmpdir(), `lorekit-restore-${Date.now()}`);
    mkdirSync5(tmpDir, { recursive: true });
    try {
      await tar2.extract({
        file: opts.from,
        cwd: tmpDir
      });
      const manifestPath = join10(tmpDir, ".wiki", "snapshots", "manifest.json");
      if (!existsSync8(manifestPath)) {
        bad("manifest.json not found in snapshot");
        process.exitCode = 1;
        return;
      }
      const manifest = JSON.parse(readFileSync10(manifestPath, "utf-8"));
      const diffs = [];
      for (const entry of manifest) {
        if (opts.file && entry.path !== opts.file) continue;
        const corpusPath = join10(corpus, entry.path);
        if (!existsSync8(corpusPath)) {
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
        console.log(chalk5.yellow(`
  MISSING (${missing.length}):`));
        for (const d of missing) {
          console.log(`    + ${d.path}`);
        }
      }
      if (changed.length > 0) {
        console.log(chalk5.cyan(`
  CHANGED (${changed.length}):`));
        for (const d of changed) {
          console.log(`    ~ ${d.path}`);
        }
      }
      console.log();
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
        const src = join10(tmpDir, d.path);
        const dest = join10(corpus, d.path);
        if (!existsSync8(src)) {
          warn(`file not in snapshot archive: ${d.path}`);
          continue;
        }
        mkdirSync5(dirname3(dest), { recursive: true });
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
import { join as join11, relative as relative7 } from "path";
import { spawnSync } from "child_process";
init_corpus();
function searchWithRipgrep(query, corpus, opts) {
  const searchDir = opts.dir ? join11(corpus, opts.dir) : corpus;
  const args = [
    "--json",
    "--no-heading",
    "-i"
  ];
  if (opts.type) {
    args.push("--type", opts.type);
  }
  args.push("--glob", "!.wiki/**", "--glob", "!.git/**");
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
          file: relative7(corpus, obj.data.path.text),
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
  const searchDir = opts.dir ? join11(corpus, opts.dir) : corpus;
  const files = collectMdFiles(searchDir);
  const pattern = new RegExp(query, "i");
  const results = [];
  for (const filePath of files) {
    const content = readFileSync11(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        results.push({
          file: relative7(corpus, filePath),
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
  program2.command("search").argument("<query>", "search query (regex supported)").option("--type <t>", "file type filter (passed to rg --type)").option("--dir <d>", "subdirectory within corpus to search").description("search the corpus with ripgrep (fallback: built-in)").action((query, opts) => {
    const corpus = requireCorpus();
    let results;
    if (hasRipgrep()) {
      results = searchWithRipgrep(query, corpus, opts);
    } else {
      warn("rg (ripgrep) not found, using built-in fallback");
      results = searchFallback(query, corpus, { dir: opts.dir });
    }
    for (const r of results) {
      console.log(JSON.stringify(r));
    }
    if (results.length === 0) {
      warn("no results");
    }
  });
}

// src/commands/vector.ts
function vectorCommand(program2) {
  program2.command("vector").argument("<action>", "sync | query | status").description("vector search engine (Phase 3 stub)").action((action) => {
    warn(
      `vector engine not yet migrated to TypeScript, use: wiki vector ${action}`
    );
  });
}

// src/commands/fetch.ts
function fetchCommand(program2) {
  program2.command("fetch").argument("<url>", "URL to fetch").option("--out <dir>", "output directory").option("--force-rich", "force rich mode (images + full content)").option("--no-images", "skip image downloads").description("fetch a URL into the corpus (Phase 4 stub)").action((url, opts) => {
    warn(
      `fetch engine not yet migrated to TypeScript, use: wiki fetch ${url}`
    );
  });
}

// src/cli.ts
var version = readVersion();
function showBanner() {
  const corpus = findCorpus();
  let pages = "\u2014";
  let indexed = "0";
  let model = "\u2014";
  if (corpus) {
    const { collectMdFiles: collectMdFiles2 } = (init_corpus(), __toCommonJS(corpus_exports));
    try {
      pages = String(collectMdFiles2(corpus).length);
    } catch {
    }
    try {
      const dbPath = `${corpus}/.wiki/vector.sqlite`;
      const { existsSync: existsSync9 } = __require("fs");
      if (existsSync9(dbPath)) {
        const Database = __require("better-sqlite3");
        const db = new Database(dbPath, { readonly: true });
        indexed = String(db.prepare("SELECT COUNT(*) as c FROM documents").get()?.c ?? 0);
        const row = db.prepare("SELECT value FROM meta WHERE key='model'").get();
        model = row?.value ?? "\u2014";
        db.close();
      }
    } catch {
    }
  }
  const short = corpus && corpus.length > 45 ? "..." + corpus.slice(-42) : corpus ?? "\u2014";
  const B = chalk6.blue;
  const BB = chalk6.blueBright.bold;
  const C = chalk6.cyan;
  const D = chalk6.dim;
  const W = chalk6.white.bold;
  console.log();
  console.log(`  ${BB("\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}`);
  console.log(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551 \u2588\u2588\u2554\u255D\u2588\u2588\u2551\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D")}`);
  console.log(`  ${BB("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  console.log(`  ${B("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  console.log(`  ${B("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551   ")}`);
  console.log(`  ${D("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D   \u255A\u2550\u255D   ")}`);
  console.log(`  ${D("Personal LLM Wiki Toolkit")}  ${C(`v${version}`)}`);
  console.log();
  console.log(`  ${C("corpus")}  ${short}`);
  console.log(`  ${C("pages")}   ${pages.padEnd(10)} ${C("indexed")} ${indexed}`);
  if (model !== "\u2014") console.log(`  ${C("model")}   ${model}`);
  console.log();
  console.log(`  ${W("$ lorekit doctor")}    \u5065\u5EB7\u68C0\u67E5`);
  console.log(`  ${W("$ lorekit fetch")}     \u6293\u53D6\u7F51\u9875`);
  console.log(`  ${W("$ lorekit search")}    \u641C\u7D22`);
  console.log(`  ${W("$ lorekit --help")}    \u6240\u6709\u547D\u4EE4`);
  console.log();
}
var program = new Command();
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
vectorCommand(program);
fetchCommand(program);
if (process.argv.length <= 2) {
  showBanner();
} else {
  program.parse();
}
//# sourceMappingURL=cli.js.map