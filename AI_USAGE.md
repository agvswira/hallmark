# AI usage

Hallmark is built by one student developer working with an AI coding agent. This file documents
the workflow, the work the AI generated and what the human decided, and it is kept from the first
commit. Every claim points at a file, a commit, a test or a transaction you can check.

**The problem it starts from:** a contract deployed on QoreChain cannot be checked against its
source. The explorer has no source verification, and the fest FAQ notes that Solidity PQC features
are checked in repositories by hand. Hallmark makes that check automatic and public.

| | |
|---|---|
| Agent | Claude Code (desktop app), model Claude Opus 5.5 (20–23 Nov); Antigravity IDE, Gemini 4 Neon (High) (27 Nov submission hardening) |
| Agent tools | Shell, file editing, a built-in browser for reading the fest site and docs, web fetch, GitHub CLI (read-only research) |
| Skills | `modern-web-guidance` for the web app (guides applied: forms, validate-input-after-interaction, copy-button, dark-mode, responsive-table, spinner, scroll-entry-exit-effects, dynamic-sibling-animations, visually-stable-font-fallbacks, typography); `security-review` and `code-review` for the reviewer role; `unveo` (a free, MIT-licensed skill, version 0.1.1) for the demo video |
| Span | From 20 Nov 2026; see [`docs/ai/log.md`](docs/ai/log.md) |
| Evidence | [`docs/ai/log.md`](docs/ai/log.md) (dated log), [`docs/ai/ledger.jsonl`](docs/ai/ledger.jsonl) (one line per change), [`docs/ai/redteam.md`](docs/ai/redteam.md) (attacks and outcomes), [`docs/ai/reviews/`](docs/ai/reviews/) (2 review reports), [`docs/cbom.json`](docs/cbom.json) (QoreScan CBOM), [`JUDGES.md`](JUDGES.md) |
| Tests so far | 43 Foundry tests (32 for `HallmarkRegistry` including 3 fuzz tests, 5 stateful invariants across 256×32 = 8,192 calls each, and 6 for the `QuantumGuestbook` sample); 61 verifier tests across 7 files, 24 of them end-to-end on a local chain, including 10 red-team tests that each assert the safe outcome of an attack; all passing |
| Live | https://hallmark-jade.vercel.app; registry on `qorechain-diana` (6 contracts full-matched and ML-DSA-87 claimed: `HallmarkRegistry`, `QuantumGuestbook`, and 4 `Attenua` contracts built by the same owner); `@agvswira/hallmark@0.1.1` on npm confirms the record from a local recompile; `npm run verify` passes 16/16 keyless live checks |
| Demo video | [`https://youtu.be/bQ6GsjzvASY`](https://youtu.be/bQ6GsjzvASY) — made with the `unveo` skill (22–23 Nov): the agent scouted the live app, recorded it in an automated browser, wrote the narration from the repo with a source on every claim, and built the animated scenes. The voiceover is an AI voice (Kokoro, offline), the music is synthesised. The owner chose the voice and the background and approved every scene on unveo's review page. See the log, 23 Nov |
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
| **Reviewer** | At each milestone a separate review pass reads the diff (`security-review`, `code-review`, and a full submission-readiness audit); every finding is fixed with a regression test or answered in writing | [`docs/ai/reviews/`](docs/ai/reviews/): first review found 5 issues in the red-team fixes; second review (27 Nov) found 7 security, UX and doc gaps, all fixed or flagged |
| **Attacker** | Tries to make the verifier say "Hallmarked" for code that does not match: edited sources, swapped compiler settings, forged metadata, changed immutables, non-call/jump-target PQC constants, proxies. Hallmark is a trust tool, so a false match is the failure that matters most | [`docs/ai/redteam.md`](docs/ai/redteam.md): 14 attacks; source attacks held, 8 gaps found and fixed (non-call/jump-target PQC constants A7, proxies, stored-source poisoning shown live, link and terminal injection, gas drain, compile cost, and the rate limit, set by the owner in Vercel Firewall) |

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
| With no source match, the precompile report said "none", although precompile use is read from the deployed code | A tampered build-info in the first CLI run | Always read from the deployed code, plus a test |
| The CLI exited with a libuv assertion on Windows (exit 127 instead of 3) | Checking exit codes in the CLI test run | Set the exit code and exit on a short timer |
| Seven deployment problems: TypeScript in node_modules, a CommonJS package requiring an ES module, skipped install scripts, a Node banner in a browser bundle, a duplicated banner, Blob credentials, a stale CDN cache | Each from a failed deploy or request, read in the Vercel logs | Bundled verifier, explicit build step, separate ABI bundle, OIDC-aware storage, shorter cache (log, 21 Nov) |
| `.cache/` (downloaded compilers) was not gitignored | Reviewing `git status` before committing | Added to `.gitignore` |
| The verify API stored submitted sources before recording, so a partial build with edited sources replaced the sources shown under a full on-chain record | The agent's own red-team run (B10), shown live on the local server | Store only after recording, never over a stronger result, plus tests ([redteam.md](docs/ai/redteam.md)) |
| A verified proxy was shown as a plain full match, although its code can be swapped | Red-team attack A5 | Live proxy detection on the page, badge and CLI, plus tests |
| The first B10 fix still let an unrecorded contract's stored sources be downgraded, and the CLI sanitizing missed check details | The separate `code-review` pass ([review](docs/ai/reviews/2026-11-21-redteam-fixes.md)) | Both fixed, with a regression test for the first |
| The agent transferred registry ownership to the `0x` form of the owner's QoreX address, assuming it could send EVM transactions. It is a coin-118 account, which cannot; QoreX sends EVM transactions from a separate Ethereum (coin 60) account | The owner's first QoreX test connected a different `0x` address; QoreX's own help and the SDK README explained the two key types | Open (see Limits): the owner-only functions are out of reach from QoreX for now; verification, recording and claims are unaffected |
| The Try it page's step-list styles also matched the status bullets inside each step, so they rendered as wide grid rows | The owner's screenshot from the first QoreX test | Step styles scoped to direct children (`483a1a2`) |
| The status lines told users to open an EVM window and register a key first, and never refreshed the key status. In the owner's test QoreX opened a one-transaction window itself when the deploy was approved | Comparing the page with the chain after the owner's deploy (key registered, window of 1 transaction already used) | Key status refreshes every 15 s; the text says QoreX opens a window on approval; a hint explains the coin-60 account |
| For the demo video, the agent drew the two explainers without their backdrop to stop a ghosting effect; that left black frames at their start and pushed a heading off frame | unveo's QA framing gate on the master | Backdrops restored; the framing gate passes |
| unveo's generated `chapters.txt` labelled the Verify section with the record step's name, cut mid-word | Reading the published kit before the hand-off | Rewritten from the timeline's real scene start times |
| Twice, a script the agent wrote through a shell heredoc turned Unicode escapes into raw control and bidi characters inside a regex | Reading the edited line back (once as a broken regex, once as a file flagged binary) | Rewritten with escapes and checked for control bytes |
| `detectPqc` checked all `PUSH` values without requiring a call opcode or skipping `JUMP`/`JUMPI` targets (**A7**) | Submission hardening audit (`2026-11-27`) | `scanCallTargets` requires a call opcode and skips `JUMP`/`JUMPI` targets; unit + anvil test A7 (`060c101`) |
| `scripts/scan-secrets.mjs` checked `QORE_MNEMONIC` but missed `HALLMARK_VERIFIER_MNEMONIC` (`*_MNEMONIC`) and `.env.local` | Reading `scan-secrets.mjs` during the hardening audit | Updated pattern to `.*_MNEMONIC` and added `.env.local` (`060c101`; checked 4 local secrets vs 3) |
| New Foundry boundary fuzz test consumed `vm.prank(verifier)` on `registry.MAX_TEXT_LENGTH()` and invariant ghost state tracked oscillating `codeA → codeB → codeA` swaps | First `forge test` run on the new tests | Hoisted `maxLen` read above `vm.prank`; tracked `activeFullCodeHash` per target (`060c101`) |
| `README.md` badge note pointed to "The first badge" after the fest badge became first, and `packages/verifier/README.md` still stated `25 tests` | Submission audit against live files (`9d88633`) | Corrected both documents and added `JUDGES.md`, `docs/cbom.json`, and `npm run verify` (`9d88633`) |

This table grows with the project. Commit hashes are added once the commits exist.

## Owner decisions

D1 to D7 are recorded in [`docs/ai/log.md`](docs/ai/log.md). New decisions are numbered on.

## Check it yourself

```sh
git log --format='%h %ad %an %s' --date=iso   # every commit, under the owner's name
npm install && npm run verify                 # 16 keyless live checks (chain, API, CLI, CBOM, docs)
npm run test:all                              # 43 Foundry + 61 Verifier tests + CLI/Web builds
node scripts/scan-secrets.mjs                 # the secret scan, on staged files
npx @agvswira/hallmark check 0xa901ee7138266abc456c8d717fa94b043078b8c4   # recompile locally and compare with the record
```

## Limits

- The registry trusts one verifier account to run the comparison honestly. The `hallmark check` CLI
  lets anyone rerun a verification on their own machine and compare it with the on-chain record.
- Registry ownership sits with the owner's coin-118 QoreX address, which cannot send EVM transactions
  directly, so `setVerifier` and `transferOwnership` cannot be called from QoreX today. QoreChain's
  authenticator lanes (a linked key executing EVM calls for a native account) may reach it; not yet tried.
- The precompile is mocked in local tests; its behaviour on the live testnet is checked separately
  once the registry is deployed.
