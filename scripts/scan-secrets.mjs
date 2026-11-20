#!/usr/bin/env node
// Pre-commit secret scan. Blocks a commit when a staged file contains:
//  - any secret value found in a local .env file (exact match), or
//  - a filled-in private key, mnemonic or PQC recovery code assignment, or a PEM private key.
// Run by .githooks/pre-commit; also usable by hand: node scripts/scan-secrets.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

const SECRET_KEYS = /^(PRIVATE_KEY|QORE_MNEMONIC|QORE_PQC_RECOVERY_CODE|.*_SECRET|.*_TOKEN|.*API_KEY)$/;
const ZERO_KEY = /^0x0{64}$/;

const localSecrets = new Set();
for (const envFile of ["contracts/.env", "web/.env", ".env"]) {
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && SECRET_KEYS.test(m[1]) && m[2].trim().length >= 16 && !ZERO_KEY.test(m[2].trim())) {
      localSecrets.add(m[2].trim());
    }
  }
}

const PATTERNS = [
  [/PRIVATE_KEY\s*=\s*(?!0x0{64}\b)0x[0-9a-fA-F]{64}/, "private key assignment"],
  [/MNEMONIC\s*=\s*([a-z]+\s+){11,23}[a-z]+/, "mnemonic assignment"],
  [/QRC1-[A-Za-z0-9-]{20,}/, "PQC recovery code"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "PEM private key"],
];

const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACM").split("\n").filter(Boolean);
const findings = [];

for (const file of staged) {
  if (/(^|\/)\.env(\..*)?$/.test(file) && !file.endsWith(".env.example")) {
    findings.push(`${file}: .env files must not be committed`);
    continue;
  }
  let content;
  try {
    content = git("show", `:${file}`);
  } catch {
    continue; // binary or unreadable
  }
  for (const secret of localSecrets) {
    if (content.includes(secret)) findings.push(`${file}: contains a value from a local .env file`);
  }
  for (const [re, label] of PATTERNS) {
    if (re.test(content)) findings.push(`${file}: looks like a ${label}`);
  }
}

if (findings.length) {
  console.error("Secret scan blocked this commit:\n  " + [...new Set(findings)].join("\n  "));
  process.exit(1);
}
console.log(`Secret scan: ${staged.length} staged file(s), ${localSecrets.size} local secret(s) checked, nothing found.`);
