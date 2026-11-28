#!/usr/bin/env node
// Checks the AI-usage record against git and the repository, so AI_USAGE.md can be falsified with
// one command instead of being taken on trust. No dependencies: Node 18+ and git with full history.
//
//   npm run ai:verify            human-readable report, exit 1 on any failed check
//   npm run ai:verify -- --json  machine-readable report on stdout
//
// What it checks:
//   1. ledger.jsonl: schema, ids in order, every cited commit exists on HEAD's history, the files
//      it lists were touched by that commit, and the entry date matches the commit date (UTC+8).
//   2. ledger contemporaneity: the commit that added each ledger line, and how long after the cited
//      change it was written (backfilled records would show up here).
//   3. AI_USAGE.md mistakes table: every commit hash resolves, every named test exists in a test file.
//   4. Owner decisions: the D-numbers in AI_USAGE.md and docs/ai/log.md are the same, with no gaps.
//   5. Git rules from CLAUDE.md: every commit is under the owner's identity, none carries an AI
//      attribution trailer.
//   6. Claimed numbers: Foundry and verifier test counts and red-team attack count match the code.
//   7. Relative links in the AI documents point at files that exist.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");
const LOCAL_TZ_HOURS = 8; // the owner's local time zone; dates in the ledger and log are UTC+8
const OWNER_NAME = "Komang Agus Wira Adnyana";

const results = [];
const metrics = {};

function check(group, name, ok, detail = "") {
  results.push({ group, name, ok, detail });
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitOk(...args) {
  try {
    git(...args);
    return true;
  } catch {
    return false;
  }
}

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function localDate(isoUtc) {
  const t = new Date(isoUtc).getTime() + LOCAL_TZ_HOURS * 3600 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

function walk(dir, filter, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, filter, out);
    else if (filter(name)) out.push(rel);
  }
  return out;
}

const commitCache = new Map();
function commitInfo(hash) {
  if (commitCache.has(hash)) return commitCache.get(hash);
  let info = null;
  if (/^[0-9a-f]{7,40}$/.test(hash) && gitOk("cat-file", "-e", `${hash}^{commit}`)) {
    const [full, date, author] = git("show", "-s", "--format=%H%n%cI%n%an", hash).split("\n");
    const onHead = gitOk("merge-base", "--is-ancestor", full, "HEAD");
    const files = git("show", "--name-only", "--format=", full).split("\n").filter(Boolean);
    info = { full, date, author, onHead, files };
  }
  commitCache.set(hash, info);
  return info;
}

// ---------------------------------------------------------------------------------------------
// 0. History is complete (a shallow clone cannot prove anything)
// ---------------------------------------------------------------------------------------------
const shallow = git("rev-parse", "--is-shallow-repository") === "true";
check("setup", "full git history available", !shallow, shallow ? "run `git fetch --unshallow` first" : "");
if (shallow) finish();

// ---------------------------------------------------------------------------------------------
// 1 + 2. Ledger
// ---------------------------------------------------------------------------------------------
const ROLES = new Set(["research", "builder", "reviewer", "attacker"]);
const ledgerRel = "docs/ai/ledger.jsonl";
const ledgerLines = read(ledgerRel).split("\n").filter((l) => l.trim());
const ledger = [];
ledgerLines.forEach((line, i) => {
  try {
    ledger.push({ ...JSON.parse(line), _line: i + 1 });
  } catch (e) {
    check("ledger", `line ${i + 1} is valid JSON`, false, e.message);
  }
});

// Which commit added each ledger line (git blame), to show the record was kept as the work went on.
const blame = new Map();
for (const row of git("blame", "--line-porcelain", "--", ledgerRel).split("\n")) {
  // porcelain: a header line "<sha> <orig> <final> [n]" precedes each line's metadata
  const m = /^([0-9a-f]{40}) \d+ (\d+)/.exec(row);
  if (m) blame.set(Number(m[2]), m[1]);
}

let ledgerOk = 0;
const lagHours = [];
const roleCount = {};
let ownerEntries = 0;
ledger.forEach((e, i) => {
  const where = `${e.id ?? `line ${e._line}`}`;
  const problems = [];
  const expectId = `L-${String(i + 1).padStart(4, "0")}`;
  if (e.id !== expectId) problems.push(`id should be ${expectId}`);
  for (const f of ["date", "role", "files", "ai", "owner", "checked"]) if (!(f in e)) problems.push(`missing ${f}`);
  if (!ROLES.has(e.role)) problems.push(`unknown role ${e.role}`);
  roleCount[e.role] = (roleCount[e.role] ?? 0) + 1;
  if (e.owner) ownerEntries++;

  const addedBy = blame.get(e._line);
  let cited = e.commit;
  if (cited === null) {
    // Schema: null means "written in the same commit"; that commit is the one that added the line.
    // A line not committed yet has nothing to check against; in a clean checkout (CI) blame always
    // resolves, so this only passes locally, before the commit.
    cited = addedBy && addedBy !== "0".repeat(40) ? addedBy.slice(0, 7) : null;
    if (!cited) {
      metrics.uncommittedLedgerEntries = (metrics.uncommittedLedgerEntries ?? 0) + 1;
      ledgerOk++;
      return;
    }
  }
  const c = cited ? commitInfo(cited) : null;
  if (cited && !c) problems.push(`commit ${cited} not found`);
  if (c && !c.onHead) problems.push(`commit ${cited} is not on HEAD's history`);
  if (c) {
    const missing = (e.files ?? []).filter((f) =>
      f.endsWith("/") ? !c.files.some((t) => t.startsWith(f)) : !c.files.includes(f),
    );
    if (missing.length) problems.push(`files not touched by ${cited}: ${missing.join(", ")}`);
    // Work is logged on the day it was done; its commit can land just after midnight (UTC+8).
    const commitDay = localDate(c.date);
    const dayBefore = localDate(new Date(new Date(c.date).getTime() - 864e5).toISOString());
    if (e.date !== commitDay && e.date !== dayBefore) {
      problems.push(`date ${e.date} but ${cited} is ${commitDay} (UTC+8)`);
    }
    // How long after the change the entry was first written. Blame would give the last edit, so a
    // later correction of a line would look like a late entry; the first commit containing the id is
    // when it was written.
    const first = git("log", "--format=%H", "--reverse", "-S", `"id":"${e.id}"`, "--", ledgerRel).split("\n")[0];
    if (first) {
      const added = commitInfo(first.slice(0, 12));
      if (added) lagHours.push((new Date(added.date) - new Date(c.date)) / 3.6e6);
    }
  }
  if (problems.length) check("ledger", `${where} matches git`, false, problems.join("; "));
  else ledgerOk++;
});
check("ledger", `${ledgerOk}/${ledger.length} ledger entries match git (commit, files, date)`, ledgerOk === ledger.length);
lagHours.sort((a, b) => a - b);
metrics.ledger = {
  entries: ledger.length,
  distinctCommits: new Set(ledger.map((e) => e.commit).filter(Boolean)).size,
  roles: roleCount,
  entriesWithOwnerAction: ownerEntries,
  writtenWithinHoursMedian: lagHours.length ? Number(lagHours[Math.floor(lagHours.length / 2)].toFixed(1)) : null,
  writtenWithinHoursMax: lagHours.length ? Number(lagHours.at(-1).toFixed(1)) : null,
};

// ---------------------------------------------------------------------------------------------
// 3. AI_USAGE.md mistakes table
// ---------------------------------------------------------------------------------------------
const usage = read("AI_USAGE.md");
const testFiles = [
  ...walk("contracts/test", (n) => n.endsWith(".sol")),
  ...walk("packages/verifier/test", (n) => n.endsWith(".ts")),
];
const testCorpus = testFiles.map((f) => read(f)).join("\n");

function section(md, heading) {
  const start = md.indexOf(`\n## ${heading}`);
  if (start < 0) return null;
  const rest = md.slice(start + 1);
  const end = rest.indexOf("\n## ", 3);
  return end < 0 ? rest : rest.slice(0, end);
}

function tableRows(md) {
  return md
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l))
    .slice(1) // header
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

const mistakes = section(usage, "Mistakes and how they were caught");
check("mistakes", "AI_USAGE.md has a mistakes table", Boolean(mistakes));
if (mistakes) {
  const rows = tableRows(mistakes);
  let withCommit = 0;
  let withTest = 0;
  let noTestExplained = 0;
  // A row written before its commit exists may say `pending-commit`, but only while AI_USAGE.md has
  // uncommitted changes; in a clean checkout (CI) the hash must be filled in.
  const usageDirty = git("status", "--porcelain", "--", "AI_USAGE.md") !== "";
  let pending = 0;
  rows.forEach((cells, i) => {
    const proof = cells[cells.length - 1] ?? "";
    // Only the tokens before "no test" are evidence; anything after it is the explanation.
    const evidence = proof.split(/no test/i)[0];
    const tokens = [...evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const isPending = tokens.includes("pending-commit");
    if (isPending) pending++;
    const hashes = tokens.filter((t) => /^[0-9a-f]{7,40}$/.test(t));
    const tests = tokens.filter((t) => !/^[0-9a-f]{7,40}$/.test(t) && t !== "pending-commit");
    const bad = [];
    if (isPending && !usageDirty) bad.push("still says pending-commit in a committed file: fill in the hash");
    if (isPending && usageDirty) hashes.push("HEAD"); // counted as cited; checked again once committed
    for (const h of hashes) {
      if (h === "HEAD") continue;
      const c = commitInfo(h);
      if (!c) bad.push(`commit ${h} not found`);
      else if (!c.onHead) bad.push(`commit ${h} not on HEAD`);
    }
    for (const t of tests) if (!testCorpus.includes(t)) bad.push(`test "${t}" not found in any test file`);
    const hashesValid = hashes.length > 0 && hashes.every((h) => h === "HEAD" || commitInfo(h)?.onHead);
    if (hashesValid) withCommit++;
    if (tests.length) withTest++;
    else if (/no test/i.test(proof)) noTestExplained++;
    if (!hashes.length) bad.push("no commit hash");
    if (!tests.length && !/no test/i.test(proof)) bad.push('no test named and no "no test: <reason>"');
    if (bad.length) check("mistakes", `row ${i + 1}: ${cells[0].slice(0, 60)}`, false, bad.join("; "));
  });
  check("mistakes", `${withCommit}/${rows.length} mistakes cite a commit that exists`, withCommit === rows.length);
  check(
    "mistakes",
    `${withTest + noTestExplained}/${rows.length} mistakes name a test that exists or say why there is none`,
    withTest + noTestExplained === rows.length,
  );
  metrics.mistakes = { rows: rows.length, withCommit, withNamedTest: withTest, noTestExplained, pendingCommit: pending };
}

// ---------------------------------------------------------------------------------------------
// 4. Owner decisions
// ---------------------------------------------------------------------------------------------
const log = read("docs/ai/log.md");
const logDecisions = new Set([...log.matchAll(/\bD(\d+)\b/g)].map((m) => Number(m[1])));
const usageDecisions = section(usage, "Owner decisions");
const usageD = new Set(
  usageDecisions ? tableRows(usageDecisions).map((c) => Number((/^D(\d+)$/.exec(c[0]) ?? [])[1])).filter(Boolean) : [],
);
const maxD = Math.max(0, ...logDecisions);
const gaps = [];
for (let d = 1; d <= maxD; d++) if (!logDecisions.has(d)) gaps.push(`D${d}`);
check("decisions", `log.md numbers decisions D1–D${maxD} with no gaps`, gaps.length === 0, gaps.join(", "));
const onlyLog = [...logDecisions].filter((d) => !usageD.has(d)).map((d) => `D${d}`);
const onlyUsage = [...usageD].filter((d) => !logDecisions.has(d)).map((d) => `D${d}`);
check(
  "decisions",
  `AI_USAGE.md lists the same ${maxD} owner decisions as the log`,
  onlyLog.length === 0 && onlyUsage.length === 0,
  [onlyLog.length && `missing in AI_USAGE: ${onlyLog.join(", ")}`, onlyUsage.length && `not in log: ${onlyUsage.join(", ")}`]
    .filter(Boolean)
    .join("; "),
);
metrics.ownerDecisions = maxD;

// ---------------------------------------------------------------------------------------------
// 5. Git rules from CLAUDE.md
// ---------------------------------------------------------------------------------------------
const commits = git("log", "--format=%h%x1f%an%x1f%B%x1e").split("\x1e").map((s) => s.trim()).filter(Boolean);
const otherAuthors = [];
const aiTrailers = [];
for (const c of commits) {
  const [h, author, body] = c.split("\x1f");
  if (author !== OWNER_NAME) otherAuthors.push(`${h} (${author})`);
  if (/^co-authored-by:/im.test(body ?? "")) aiTrailers.push(h);
}
check("git", `${commits.length}/${commits.length} commits under the owner's identity`, otherAuthors.length === 0, otherAuthors.join(", "));
check("git", "no AI attribution trailers (CLAUDE.md, D4)", aiTrailers.length === 0, aiTrailers.join(", "));
metrics.commits = commits.length;

// ---------------------------------------------------------------------------------------------
// 6. Claimed numbers
// ---------------------------------------------------------------------------------------------
const foundry = walk("contracts/test", (n) => n.endsWith(".t.sol"))
  .map((f) => (read(f).match(/function\s+(test|invariant)\w*\s*\(/g) ?? []).length)
  .reduce((a, b) => a + b, 0);
const verifier = walk("packages/verifier/test", (n) => n.endsWith(".test.ts"))
  .map((f) => (read(f).match(/^\s*(it|test)(\.each\([^)]*\))?\(/gm) ?? []).length)
  .reduce((a, b) => a + b, 0);
const claimFoundry = Number((/(\d+) Foundry tests/.exec(usage) ?? [])[1]);
const claimVerifier = Number((/(\d+) verifier tests/.exec(usage) ?? [])[1]);
check("numbers", `Foundry tests: ${foundry} in code, ${claimFoundry} claimed`, foundry === claimFoundry);
check("numbers", `verifier tests: ${verifier} in code, ${claimVerifier} claimed`, verifier === claimVerifier);

const redteam = read("docs/ai/redteam.md");
const attackRows = tableRows(section(redteam, "Summary") ?? "").filter((c) => /^[A-Z]\d*[a-z]?$/.test(c[0]));
const claimAttacks = Number((/(\d+) attacks/.exec(usage) ?? [])[1]);
check("numbers", `red-team attacks: ${attackRows.length} in redteam.md, ${claimAttacks} claimed`, attackRows.length === claimAttacks);
metrics.tests = { foundry, verifier };
metrics.redteam = {
  attacks: attackRows.length,
  held: attackRows.filter((c) => /held/i.test(c[2] ?? "")).length,
  gaps: attackRows.filter((c) => /gap/i.test(c[2] ?? "")).length,
};

// ---------------------------------------------------------------------------------------------
// 7. Links in the AI documents
// ---------------------------------------------------------------------------------------------
const docs = ["AI_USAGE.md", "JUDGES.md", "CLAUDE.md", ...walk("docs/ai", (n) => n.endsWith(".md"))];
const broken = [];
for (const d of docs) {
  if (!existsSync(join(ROOT, d))) continue;
  for (const m of read(d).matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const abs = resolve(ROOT, dirname(d), target);
    if (!existsSync(abs)) broken.push(`${d} -> ${m[1]}`);
  }
}
check("links", `relative links in ${docs.length} AI documents resolve`, broken.length === 0, broken.join("; "));

finish();

function finish() {
  const failed = results.filter((r) => !r.ok);
  if (JSON_OUT) {
    process.stdout.write(JSON.stringify({ ok: failed.length === 0, results, metrics }, null, 2) + "\n");
  } else {
    let group = "";
    for (const r of results) {
      if (r.group !== group) {
        group = r.group;
        console.log(`\n${group}`);
      }
      console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? `\n      ${r.detail}` : ""}`);
    }
    console.log(`\nmetrics ${JSON.stringify(metrics)}`);
    console.log(failed.length ? `\n${failed.length} check(s) failed` : `\nall ${results.length} checks passed`);
  }
  process.exit(failed.length ? 1 : 0);
}

