# AI usage

Hallmark is built by one student developer working with an AI coding agent. This file documents
the workflow, the work the AI generated and what the human decided, and it is kept from the first
commit. Every claim points at a file, a commit, a test or a transaction you can check.

**The problem it starts from:** a contract deployed on QoreChain cannot be checked against its
source. The explorer has no source verification, and the fest FAQ notes that Solidity PQC features
are checked in repositories by hand. Hallmark makes that check automatic and public.

| | |
|---|---|
| Agent | Claude Code (desktop app), model Claude Opus 5.5 |
| Agent tools | Shell, file editing, a built-in browser for reading the fest site and docs, web fetch, GitHub CLI (read-only research) |
| Skills | `modern-web-guidance` for the web app (guides applied: forms, validate-input-after-interaction, copy-button, dark-mode, responsive-table, spinner, scroll-entry-exit-effects, dynamic-sibling-animations, visually-stable-font-fallbacks, typography); `security-review` and `code-review` for the reviewer role |
| Span | From 20 Nov 2026; see [`docs/ai/log.md`](docs/ai/log.md) |
| Evidence | [`docs/ai/log.md`](docs/ai/log.md) (dated log), [`docs/ai/ledger.jsonl`](docs/ai/ledger.jsonl) (one line per change), `docs/ai/reviews/` and `docs/ai/redteam.md` (as those milestones land) |
| Tests so far | 30 Foundry tests for `HallmarkRegistry` (one fuzz); 32 verifier tests, 14 of them end-to-end on a local chain; all passing |
| Live checks | Registry live on `qorechain-diana`; Hallmark verified, recorded and claimed itself (full match, claim checked by the live `pqcKeyStatus` precompile); two other public contracts verified from source ([results](packages/verifier/README.md#live-checks-on-qorechain-diana)) |
| AI at runtime | None, by design: a verification result has to be deterministic and reproducible, so no model sits in the verification path |

## The split, in one table

| | The AI did | The human did |
|---|---|---|
| Design | Picked the logo from the owner's shortlist, chose the colour roles, built the layout from the owner's style reference | Brought the style reference and logo concepts (made with another AI tool), shortlisted the logo |
| Direction | Researched the fest rules and the QoreChain docs; confirmed the problem Hallmark solves (no source verification on QoreChain, PQC features checked by hand) against primary sources; proposed candidate ideas | Chose the category, chose Hallmark and its name, decided the product shape (web app plus CLI) |
| Code | Writes the contracts, tests, scripts, verification engine, web app and CLI | Reviews the work, makes the product decisions, tries the app with the real QoreX wallet |
| Git | Prepares each commit and runs it under the owner's identity, on the owner's instruction | Owns the repository; decides when to push and when it goes public |
| Chain | Creates throwaway testnet accounts, deploys and runs scripted checks | Signs in where an account is needed (fest site, faucet), uses QoreX for the claim flow |
| Secrets | Keeps them in gitignored `.env` files, prints addresses only, scans every commit | Holds the personal wallet; it never goes through the agent |

## Three roles for the AI

The fest names three kinds of AI-native work: a coding agent workflow, an AI security reviewer and
an autonomous testing system. Hallmark uses all three, each with its own evidence.

| Role | What it does on Hallmark | Evidence |
|---|---|---|
| **Builder** | Writes the code in small, tested steps, following [`CLAUDE.md`](CLAUDE.md) | `docs/ai/log.md`, `docs/ai/ledger.jsonl`, `git log` |
| **Reviewer** | At each milestone a separate review pass (`security-review`, `code-review`) reads the diff; every finding is fixed with a regression test or answered in writing | `docs/ai/reviews/` (from the verifier milestone) |
| **Attacker** | Tries to make the verifier say "Hallmarked" for code that does not match: edited sources, swapped compiler settings, forged metadata, changed immutables, proxies. Hallmark is a trust tool, so a false match is the failure that matters most | `docs/ai/redteam.md` (from the verifier milestone) |

## Workflow

1. **The human sets the goal and the constraints.** Constraints set at the start and kept: commits
   under the owner's name only, testnet only, secrets only in gitignored files, nothing pushed
   without the owner's go-ahead.
2. **The agent checks facts before it designs.** It reads the docs and probes the live chain rather
   than assuming. Example: the registry's precompile read follows the documented ABI of
   `pqcKeyStatus`, including the fourth return value added in v3.2.4, and treats an empty answer
   (inactive precompile) as a refusal.
3. **It builds in small pieces**, each ending in a passing test or a live check.
4. **It writes down what happened**: a log entry and ledger lines per change, mistakes included.

## Guardrails, written as code

- [`CLAUDE.md`](CLAUDE.md): the agent's working rules, committed so the workflow can be reproduced.
- [`scripts/scan-secrets.mjs`](scripts/scan-secrets.mjs) runs on every commit through
  `.githooks/pre-commit`. It blocks staged `.env` files, filled-in key, mnemonic and recovery-code
  assignments, PEM keys, and any exact value found in a local `.env` file.
- The agent does not get around a safety check: when the permission system blocked it from running
  a package's install script by hand, it found a way that needed no install script
  (see the log, 21 Nov).

## Mistakes and how they were caught

| What was wrong | How it was caught | Fix |
|---|---|---|
| Both official templates create a `.env` but ship no `.gitignore`; a plain `git add` would have staged it | Listing the scaffolded files before the first `git add` | Root `.gitignore`, confirmed with `git check-ignore`; the pre-commit scan also blocks `.env` files |
| The first plan named Next.js, but the official viem-wagmi template is Vite + React | Reading the scaffolded `package.json` | Plan changed to Vite with serverless API routes |
| `@foundry-rs/forge`'s postinstall uses Unix-only syntax and fails on Windows | The install failed | `contracts/scripts/forge.mjs` runs the packaged binary directly |
| The agent cached the solc compiler as `.js` inside an ES-module package, so Node loaded it as ESM | 10 of 11 end-to-end tests failed on the first run | Cache as `.cjs`; all tests pass |
| The PQC report pointed at a constant's declaration, not at the functions calling the precompile | Reading the first live result on diana | Follow named constants to their uses, plus a regression test; the live rerun names both functions |
| The parser rejected Foundry's short `solcLongVersion` ("0.8.28") | The first self-verification with a real Foundry build-info | Resolve to the official release through solc's `list.json`, plus tests |
| Foundry's non-standard input keys (`allowPaths` and others, holding local absolute paths) made solc-js reject the input | The same self-verification found no contract; compiling the input directly showed `Unknown key "allowPaths"` | Keep only the standard fields, plus a test that no local path survives |
| A local run would have written a `localhost` URL into a permanent on-chain record | Reviewing what `recordVerification` stores before the first local run | Recording needs `HALLMARK_PUBLIC_URL`; local runs verify and store but never write on chain |
| The planned server would have stopped recording a few hours after each manual window opening (17,280 blocks is about 5 hours on the testnet) | Reading the SDK's window notes while planning the deploy | Registry-scoped windows opened by the server when needed, tested live (see the log) |
| `window.ts` and `registry.ts` imported each other with a load-time constant | Reviewing the new module before running it | Shared constants moved to `constants.ts` |
| `.cache/` (downloaded compilers) was not gitignored | Reviewing `git status` before committing | Added to `.gitignore` |

This table grows with the project. Commit hashes are added once the commits exist.

## Owner decisions

D1 to D6 are recorded in [`docs/ai/log.md`](docs/ai/log.md). New decisions are numbered on.

## Check it yourself

```sh
git log --format='%h %ad %an %s' --date=iso   # every commit, under the owner's name
cd contracts && npm install && npm run forge-std && npm test   # 30 tests
cd packages/verifier && npm install && npm test             # 32 tests, local anvil chain
node scripts/scan-secrets.mjs                  # the secret scan, on staged files
```

## Limits

- The registry trusts one verifier account to run the comparison honestly. The planned CLI lets
  anyone rerun a verification locally and compare it with the on-chain record.
- The precompile is mocked in local tests; its behaviour on the live testnet is checked separately
  once the registry is deployed.
