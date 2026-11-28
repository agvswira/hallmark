# AI session log

Dated record of each working session: what the agent generated, what the owner decided, and what
was learned. Newest entries at the bottom. Agent: Claude Code (desktop app), model Claude Opus 5.5.

Section dates are the owner's local time (UTC+8); some headings also give the UTC time, which is what
`git log` shows.

## 2026-11-20: the problem and choosing the project

**The problem.** A contract deployed on QoreChain cannot be checked against its source. The fest
FAQ states that the explorer has no source verification and no Etherscan-compatible API, and that
the Solidity PQC features (`pqcVerify`, `pqcKeyStatus`) cannot be verified automatically, so jurors
check them in repositories by hand. Sourcify, the open verification service, has no entry for chain
9800 or 9801.

**Agent (research):**
- Read the fest rules, prizes and kits, and the QoreChain docs, including the EVM precompile
  reference and the Build Before Q-Day guides.
- Confirmed the problem above against those primary sources and Sourcify's chain list.
- Proposed candidate ideas for the Quantum Pass category, among them a source-verification tool
  that addresses this problem.

**Owner decided:**
- D1: enter the Quantum Pass category; register as students (Quantum Campus) and as AI-native.
- D2: build Hallmark, a source-verification tool for QoreChain contracts, from the candidates.
- D3: the name "Hallmark" (from a shortlist), and a web app plus CLI as the product shape.
- D4: commits under the owner's name only, with no AI attribution line; AI use is documented here
  from the first commit instead.

**Agent (planning the disclosure):** proposed a disclosure built on checkable evidence (this log, a
machine-readable ledger, review and red-team reports) rather than narrative alone. The owner
approved the plan.

## 2026-11-21: repository, registry contract, guardrails

**Agent (builder):**
- Initialised the repository with the owner's git identity (repo-level config).
- Scaffolded `contracts/` with `create-qorechain-dapp` (foundry template) and `web/` (viem-wagmi
  template), both 0.14, testnet preset.
- Wrote `HallmarkRegistry.sol`, a precompile mock, 30 Foundry tests (one fuzz) and a deploy script;
  removed the template's Counter contract.
- Wrote `contracts/scripts/new-account.ts` and created a fresh verifier account for testnet; the
  mnemonic and key were written to the gitignored `contracts/.env` and only the addresses were printed.
- Added the guardrails: root `.gitignore`, `CLAUDE.md` working rules, and a pre-commit secret scan
  (`scripts/scan-secrets.mjs` via `.githooks/pre-commit`).
- Wrote README, LICENSE (MIT), this log, the ledger and the first version of AI_USAGE.md.

**Design choices made by the agent, open to the owner's review:**
- The registry stores `target.codehash` read on chain instead of trusting a hash sent by the verifier.
- Claims require the recorded deployer and a registered ML-DSA-87 key (algorithm id 1) through the
  `pqcKeyStatus` precompile; proof of possession is recorded, not required, because a QoreX-registered
  key may not carry it. A missing or short precompile answer fails closed.
- A Full match cannot be replaced by a Partial match for the same code.

**Learned / went wrong:**
- Neither template ships a `.gitignore`, while both scaffolds create a `.env`. The agent wrote a root
  `.gitignore` before the first `git add` and confirmed with `git check-ignore` that `.env` is ignored.
- The `@foundry-rs/forge` npm package's postinstall uses Unix-only `VAR=value` syntax and fails on
  Windows. The agent's attempt to run that install script by hand was blocked by the permission
  system; instead of working around the block, it installed with `--ignore-scripts` and wrote
  `contracts/scripts/forge.mjs`, which runs the packaged platform binary directly.
- The project page's "How it's made" text named Next.js; the official viem-wagmi template is Vite +
  React, so the plan changed to Vite with serverless API routes. The project page text needs the
  same correction.

**Checked:** `npm test` in `contracts/`: 30 passed, 0 failed (fuzz: 256 runs).

## 2026-11-21 (later): the verification engine

**Agent (builder):**
- Created `packages/verifier` on `@ethereum-sourcify/lib-sourcify` (MIT) with a compiler adapter
  that downloads official soljson builds, checks them against the SHA-256 in `list.json`, and caches them.
- Wrote the verification flow: chain id check, candidate selection by code length, full / partial /
  none levels, and the deployer taken only from a creation transaction that matches this contract.
- Wrote the PQC detector: PUSH values in the deployed code (so literals and immutables are both
  seen), excluding the metadata trailer, plus source references with the enclosing function.
- Wrote 25 tests; 13 of them deploy real compiled contracts to a local anvil chain (chain id 9800).
- Wrote `scripts/verify-live.ts` and ran it against two public contracts on diana
  (results in `packages/verifier/README.md`).

**Learned / went wrong:**
- The first test run failed 10 of 11 end-to-end tests: the agent cached soljson as `.js` inside an
  ES-module package, so Node loaded the CommonJS compiler as ESM (`__dirname is not defined`). Fixed
  by caching as `.cjs`; all tests passed after.
- The first live run on a contract that calls `pqcKeyStatus` pointed only at the constant's
  declaration, not at the functions that call it. The detector now follows a named constant to its
  uses; the live run then named `hasPqcKey` and `_requirePqcKeyRegistered`. A regression test covers it.
- A live run with the compiler's default `evmVersion` gave no match; the contract was built with
  Hardhat 2, whose default for 0.8.24 is `paris`. With `paris` it matched. This is why the web app
  will ask for the build-info file rather than loose sources.
- `.cache/` (compiler downloads) was not covered by the root `.gitignore`; added before committing.

**Checked:** `npm test` in `packages/verifier`: 25 passed. `npm test` in `contracts`: 30 passed.
`tsc --noEmit` clean. Live: two diana contracts, partial matches, both deployers equal to the
projects' own deployment records.

## 2026-11-21 (night): registry live on diana, first hallmark

**Owner:** funded the verifier account from the faucet.

**Agent (builder):**
- Registered the verifier account's ML-DSA-87 key, opened an EVM window (17,280 blocks, the maximum),
  and deployed HallmarkRegistry: `0xa901ee7138266abc456c8d717fa94b043078b8c4`.
- Verified the registry from its own Foundry build-info: full match (runtime and creation perfect),
  deployer found, `pqcKeyStatus` detected in `_requireMlDsaKey`.
- Recorded that result in the registry and claimed it from the deployer. The claim went through the
  live `pqcKeyStatus` precompile and stored `possessionProven: true`.

**Learned / went wrong:**
- Foundry 1.7 writes `solcLongVersion: "0.8.28"` without the commit, which the agent's parser
  rejected. Now resolved to the official release through solc's `list.json`.
- Foundry's build-info input carries `allowPaths`, `basePath` and `includePaths`; solc-js
  refused them ("Unknown key"), so the first self-verification found no contract. They also hold the
  builder's absolute local paths. The parser now keeps only the standard fields; a test checks that
  no local path survives.
- The build-info file is 17 MB, above Vercel's 4.5 MB request limit: the web app has to strip the
  compiler output in the browser and send only the input.

**Checked:** `npm test` (verifier): 27 passed. Self-verification, record and claim on diana with
the transaction hashes in the ledger (L-0013 to L-0015).

**Owner decided (D5):** the owner's own wallet becomes the registry owner, so it can replace the
verifier with `setVerifier` if the server key is ever exposed; the verifier key stays a separate
throwaway account, because it has to sign automatically on the server and the owner's personal
wallet must never go through the agent or the server.

**Agent:** transferred ownership (`0x9fc9f88e50befcdd4dbcf1a44604b6e3261c436ee3f6a2a8f6d06fe42b295d12`)
and read it back: owner `0xdd8874f79Ec76375B463FAF4AA49f37474173325`, verifier unchanged.

## 2026-11-21 (night, later): API and web app

**Agent (builder):**
- Wrote the API as Vercel Functions (`web/api/`) and a small Vite plugin that runs them in development.
- Wrote the web app: registry home, verify form, contract page with the PQC report, claim with QoreX,
  README badge and verified source.
- Before writing any UI code, consulted the `modern-web-guidance` skill and applied these guides:
  `forms`, `validate-input-after-interaction`, `copy-button`, `dark-mode`, `responsive-table`,
  `spinner`. Searched `tabs` too and chose plain sections instead.

**Design choices made by the agent, open to the owner's review:**
- The browser strips the compiler output from the build-info file (17 MB for this repository) and sends
  only sources and settings (901 KB), under Vercel's 4.5 MB request limit.
- Local runs never write on chain: the on-chain record stores the page URL, and a development server
  would have written a permanent `localhost` address. Recording needs `HALLMARK_PUBLIC_URL`.

**Learned / went wrong:**
- The first contract page opened the deploy script first instead of the verified contract; sources are
  now ordered verified file, project, tests and scripts, libraries.
- The copy button reported "Copy failed" in the agent's browser pane: the pane denies clipboard write
  permission (`NotAllowedError`). The failure path behaved as designed; copying itself still has to
  be checked in a normal browser.
- Not tested yet: uploading a file through the page (the agent's browser cannot pick files; the same
  request was sent to the API directly), and the claim flow with a real QoreX wallet.

**Checked:** typecheck clean in `web/` and `packages/verifier`; the pages above in the browser pane
at desktop and phone width.

## 2026-11-21 (night, last): visual redesign

**Owner decided (D6):** brought a written style reference (a dark, minimal developer-tool look) and
four geometric logo concepts, prepared with another AI tool; shortlisted concepts 1 (H-Seal) and
4 (Proof Vault), and asked the agent to pick one and the colours, using the reference as a guide
rather than a copy.

**Agent (builder):**
- Picked the H-Seal: it still reads as an H at favicon size, and its parts map to the product (left
  pillar the repository, right pillar the chain, the punched seal the verification).
- Kept the logo's palette with one job per colour: assay gold for actions and focus, verified mint for
  full matches only, cobalt for the brand and post-quantum tags (lightened for text contrast), apricot
  for partial matches, red for errors and changed code.
- Rebuilt the home page: hero with lookup, a proof diagram drawn from the newest real record, registry
  numbers read from the chain, the five steps as ruled rows, and two closing cards (dark and gold).
- Self-hosted Manrope (OFL, via Fontsource) with `font-size-adjust: from-font`; the site is dark-only
  and declares `color-scheme: dark`.
- Consulted `modern-web-guidance` again: `scroll-entry-exit-effects` (section reveal, decorative, so
  no script fallback), `dynamic-sibling-animations` (hero stagger with `sibling-index()` and an
  `:nth-child` fallback), `visually-stable-font-fallbacks`, `typography` (clamp() maximum within
  2.5 times the minimum).

**Learned / went wrong:**
- The hero's full-bleed grid made the page scroll sideways (`100vw` includes the scrollbar); fixed
  with `overflow-x: clip` on `main`, which keeps the sticky header working.
- Five step cards wrapped as four and one; replaced with ruled rows that read in order at any width.
- The proof diagram's connectors stacked vertically; moved them into the grid between the cards.

**Checked:** typecheck clean; home, verify and record pages in the browser pane at desktop and phone
width with no horizontal overflow.

## 2026-11-21 (morning UTC): verifier window kept open, but only for the registry

**Agent (builder):**
- Found while planning the deploy that 17,280 blocks, the longest window the chain allows, is about
  five hours on the testnet, so recording on chain would silently stop a few hours after each manual
  opening.
- The SDK deliberately ships no auto-open helper ("the window exists so that spending is authorised on
  purpose"). The agent kept that intent by scoping every window the server opens: `allowedTargets`
  is HallmarkRegistry only, 200 transactions, 30 QOR including fees. The server reopens only when the
  window is missing, expiring, nearly used, or not scoped that way.
- The API now takes the verifier's mnemonic instead of a bare key, because opening a window needs the
  account's ML-DSA-87 key, which is derived from the mnemonic.

**Learned / went wrong:**
- The first version made `window.ts` and `registry.ts` import each other, with a constant used at load
  time: an ESM cycle that can fail depending on load order. Shared constants moved to `constants.ts`.

**Checked (live on diana):** the old unscoped window was replaced by a registry-scoped one; a second
run kept it; a record and a claim went through it (200 to 198 transactions left); a 1 wei transfer to
another address from the same account was refused and used none of the window.

## 2026-11-21 (morning UTC): the hallmark CLI

**Agent (builder):**
- Wrote `compareWithRecord`, which checks a local run against the on-chain record (code matches, code
  unchanged, match level, source hash, post-quantum report, deployer) and gives a verdict.
- Wrote the `hallmark` CLI: `status`, `check` (recompile here, from a local build-info or from the
  sources a Hallmark server stores; the server only supplies input, the verdict is computed locally),
  and `verify` (submit a build). Bundled with esbuild.

**Checked live:** the registry's own build-info confirmed every field; three tampered copies of it gave
the expected verdicts (a comment change: differs; a logic change and a redirected `pqcKeyStatus` call:
contradicted); sources fetched from the dev server and recompiled locally confirmed.

**Learned / went wrong:**
- With no source match, the report said the contract used no precompile, which was wrong: precompile use
  is a fact of the deployed code. It is now always read from the deployed code; a test covers it.
- On Windows, `process.exit()` right after the last request aborted with a libuv assertion (exit 127
  instead of 3). The CLI now sets the exit code and exits on a short timer.
- Each run took about 7 s, almost all of it starting tsx and loading the SDKs; the esbuild bundle starts
  in about 1 s.
- A one-line shell command for these doc updates failed on nested quotes before running anything; it was
  split into files.

## 2026-11-21 (UTC evening of 20 Nov): deployed to Vercel

**Owner decided (D7):** deploy now, and store the testnet verifier mnemonic in Vercel. The owner was
signed in to the Vercel CLI; the agent did the rest from the terminal.

**Agent (builder):**
- Tested the install and build from a fresh clone before touching Vercel.
- Created the project (root directory `web`, Fluid compute, Node 24), a public Blob store for the verified
  sources, and the production variables; the mnemonic went in as a sensitive variable, piped from the
  local file so it never appeared in the terminal or the chat. Added `.vercelignore` so no `.env` file or
  local state is uploaded.
- Live: https://hallmark-jade.vercel.app. A verification through the production API compiled in the function, stored the sources
  in Blob, checked the scoped window and recorded on chain in 11 s; the record's source link now points to
  the public page. `hallmark check --api https://hallmark-jade.vercel.app` recompiled those sources locally and confirmed all six checks.

**Learned / went wrong (each found from a failed deploy or a failed request, then fixed):**
1. The functions could not load the verifier: the package exported TypeScript source, which Vercel does
   not compile inside `node_modules`. The verifier now builds to `dist/`.
2. The function runtime refused `@cosmjs/crypto` (CommonJS) requiring the ESM-only `@noble/hashes`
   (`ERR_REQUIRE_ESM`), which Node 24 on the owner's machine allows. The verifier is now one esbuild bundle,
   which settles that at build time; solc's wrapper is imported statically so it is bundled too.
3. npm 11 on Vercel skips install scripts that are not allowed, so the verifier's `prepare` build never
   ran. The build is now an explicit step of the install command.
4. The browser build failed because the ABI entry carried the Node `createRequire` banner; the ABI is now a
   separate, plain bundle.
5. The CLI bundle then declared the banner's names twice; the CLI no longer adds one.
6. Newly connected Blob stores use OIDC credentials; storage now detects `BLOB_STORE_ID` as well as a token
   and reads with `get()` without the CDN cache.
7. Right after a verification the contract API served the old record from the CDN for up to 15 s; the cache
   is now 3 s.

**Not checked by the agent:** the production pages in a browser (its browser pane refused the domain), and
the claim flow with a real QoreX wallet.

## 2026-11-21: red team and review

**Owner decided (D8):** checked the production site in their own browser after the deploy ("Sudah, aman"), which
covers the browser check the agent could not do. Then asked for the red-team and review milestone.

**Agent (attacker):** tried 13 attacks on the verifier, API, web app, CLI and window; results and
fixes in [`redteam.md`](redteam.md). Source attacks (no metadata, `bytecodeHash: none`, another compiler,
renamed contract, fake PQC verifier) all held. Gaps found and fixed: proxies shown as plain matches (A5),
stored sources poisoned by a partial submission, shown live on the local server (B10), a `javascript:`
repository link (B1), raw terminal escapes in the CLI (B1b), repeated verifications spending the
verifier's window (B2), unbounded candidate compilations (B4). The in-memory rate limit (B3) is
documented; a Vercel Firewall rule is the real fix and needs the owner's dashboard.

**Agent (builder):** `detectProxy` and `planRecording` in the verifier; the verify API reads the existing
record first and stores only after recording; the record page warns about proxies, partial matches and
stored sources that differ from the record; the badge marks proxies; the CLI cleans strings and prints
proxies. Frontend guides applied (modern-web-guidance): the record notices reuse the existing notice
styles, no new patterns.

**Agent (reviewer):** a separate `code-review` pass at high effort found 5 issues, 2 important: the B10
fix still let an unrecorded contract's stored sources be downgraded, and the CLI missed check details.
All 5 fixed; report in [`reviews/2026-11-21-redteam-fixes.md`](reviews/2026-11-21-redteam-fixes.md).

**Learned / went wrong:**
- Writing source through a shell heredoc turned Unicode escapes into raw control and bidi characters
  inside a regex, twice. Caught by reading the line back; such edits now go through the file editor and
  are checked for control bytes.

**Checked:** 58 verifier tests and 30 Foundry tests pass; web typecheck and production build pass; the
record page in the local preview renders the claim as an http(s) link with `rel="nofollow noopener noreferrer"`.

## 2026-11-21: red-team fixes deployed; rate limit in Vercel Firewall

**Owner decided (D9):** deploy and push the red-team fixes; then added a Vercel Firewall rule in the
dashboard for B3 (path equals `/api/verify`, 60 s fixed window, 6 requests per IP, 429), with the values
the agent suggested.

**Agent (builder):** deployed to production and pushed `ade4e88` and `40fa8d4`.

**Checked (production):** `/api/contract` returns the new `proxy` field; resubmitting the registry's build
without the deployment transaction was refused, and with it returned "unchanged" with no new transaction;
of 8 quick requests to `/api/verify`, 7 and 8 were answered 429 by the firewall (`X-Vercel-Mitigated: deny`)
before reaching the function.

## 2026-11-21: Try it page, and the first claim with a real QoreX wallet

**Agent (builder):** `QuantumGuestbook`, a sample only accounts with a registered ML-DSA-87 key can sign
(checked through `pqcKeyStatus`, failing closed), with 6 Foundry tests; its build-info is generated by
`scripts/build-sample.ts` and a test verifies it as a full, PQ-guarded match on a local chain. A `/try`
page deploys it from the connected wallet, verifies it with one click and links to the claim. Frontend
guide applied (modern-web-guidance): `accessibility` (one polite status region for step outcomes,
`role="alert"` for failures, `<progress>` for waiting).

**Owner decided (D10):** tested the whole flow with their own QoreX wallet.

**What happened in the test:**
1. QoreX connected `0x3eb4…034f`, not the `0x` form of the owner's `qor1mky8…` account. QoreX's help
   explains it: the `qor1` account is a coin-118 key that cannot send EVM transactions; EVM goes through a
   separate Ethereum (coin 60) account. The owner funded that account and used it.
2. Deploy `0xbeed843930cc7d65b62e1abd94bb478cf117172f4c00fa042a3865c29679a970` (contract
   `0xf5340e357e16da6b9ded7ad9c86148df2ec5f992`); QoreX opened a one-transaction window for it.
3. Verify: full match, pqcKeyStatus, recorded in `0xd944c3eabf2c1423bf965df40825f3e9c39030389eea06aa387f9590f0ba1c6e`.
4. Claim with QoreX: `0x2ff0b2befc1a258cf46cb2a1dd1650c582853427ff049938e7f1080f5cdd65aa`, accepted with an
   ML-DSA-87 key with proof of possession (`hallmark status` confirms).

**Learned / went wrong:**
- Ownership of HallmarkRegistry had been transferred to the `0x` form of the owner's coin-118 account,
  which cannot send EVM transactions, so the owner-only functions are out of reach from QoreX for now.
  Recorded as open in AI_USAGE.
- The step-list CSS leaked into the status bullets; scoped to direct children.
- The page told users to open a window first and never refreshed the key status; corrected after comparing
  the page with the chain.

**Checked:** 36 Foundry tests, 59 verifier tests, web build; the claim read back from the registry.

## 2026-11-22: the CLI on npm

**Agent (builder):** packaged the CLI as `@agvswira/hallmark`: one minified, self-contained file
(1.1 MB packed, 4 files, no runtime dependencies), with a shebang for the npm bin; `--api` defaults to the
public server, which only supplies the sources (the compilation and the verdict stay local). Tested by
installing the packed tarball into an empty folder: the sample's record was reproduced (CONFIRMED, six
checks) and an unrecorded address exited with 3.

**Owner decided (D11):** publish to npm under their own account. The first `npm publish` was refused
because publishing requires two-factor authentication; the owner enabled 2FA and published. The agent
advised against a token that bypasses 2FA.

**Checked from npm:** about 4 minutes after publishing, `npx -y @agvswira/hallmark@0.1.0 check
0xa901ee7138266abc456c8d717fa94b043078b8c4` in an empty folder recompiled the registry locally and
confirmed all six checks (exit 0).

## 2026-11-22: Home and README

**Agent (builder):** the Home page links Try it from the hero and shows the `npx @agvswira/hallmark check`
command, with a copy button, to reviewers (`f84eae6`). Rewrote the README after reading GitHub's README
guidance, the standard-readme spec, awesome-readme and Sourcify's README: one-line pitch, badges (Hallmark's
own record badge first), why, a how-it-works diagram, quick starts by reader, the trust model, live records,
development, credits and licence (`3d57f11`). Added the fest's "Built on QoreChain" badge at the owner's
request (`e107eda`).

**Checked:** every relative link in the README resolves; the external badges and pages answer; GitHub's
Markdown API renders the alert, tables, logo and diagram. The copy button could not be tested in the
agent's browser (clipboard permission denied there); the owner was asked to try it in Chrome.

## 2026-11-23: the demo video, made with unveo

**Owner decided (D12):** make the demo video with unveo; an AI voice; show the QoreX deploy and claim through
their result (the claimed sample's record) rather than recording the wallet; approved the script, voice and
the "candy" background on unveo's review page; chose one more round of fixes after the frame review.

**Agent:**
- Inspected the unveo npm package before installing it (installer, scripts, network calls): it installs a
  skill folder, uses edge-tts or offline Kokoro for the voice, and serves its review page from unveo.dev
  against a local server. Installed without logging in.
- Scouted the live app, wrote the pitch and tour, recorded the tour in one automated take (read-only: no form
  submitted, no wallet connected), captured a real `npx @agvswira/hallmark check` run, and wrote the narration
  to the footage with a source tag on every claim (`script.py check`: every number said is on screen).
- Patched two Windows bugs in the local unveo copy (an unescaped font path in an ffmpeg filter; a negative audio
  delay in the per-scene previews) and worked around a third (the page zoom is read only at the top level of
  steps.json). The Hallmark repository was not changed by any of this.
- Graded every sampled frame against unveo's critique (8/10 to pass) over three rounds of fixes: faster
  entrances, card transitions, a warmed API so the record page loads off camera, a larger page zoom, larger
  terminal and explainer type.

**Result:** `unveo-out/demo-video.mp4` (gitignored), 2:43, 2560×1440, −14.1 LUFS, captions burned in. QA passes
34 of 35 blocking gates; the frames gate fails because 35 of 63 frames were graded 6 or 7, mostly the app's own
small text at full-page scale and frames in mid-transition. The video was published with unveo's own publish
step and that gate noted in `quality-check.md`.

**Not true of the video:** the four agvswira/attenua records in the registry are from the owner's own account;
the narration does not present them as other teams'. The opening line about other chains is general context,
not from the repo, and was shown as such on the review page.

## 2026-11-27: submission hardening, Foundry invariants, QoreScan CBOM, and keyless juror UX

**Owner decided (D13):** asked to fortify Hallmark for Build Before Q-Day submission and maximize award readiness (`Quantum Pass`, `Quantum Campus`, `Best AI-Native Build`, `People's Choice`). Agent: Antigravity IDE (Gemini 4 Neon (High)).

**Agent (reviewer + attacker + builder):**
- Conducted a full submission and security audit ([`reviews/2026-11-27-submission-hardening.md`](reviews/2026-11-27-submission-hardening.md)) against the fest rubrics and live portal state (`build.qorechain.io/p/hallmark`).
- **Attack A7 (`060c101`):** found that `detectPqc` checked all `PUSH` values without requiring a call opcode or filtering `JUMP`/`JUMPI` targets; replaced with `scanCallTargets` in `packages/verifier/src/pqc.ts`, filtered `sourceRefs` to detected precompiles, and added unit + live-anvil regression tests (`61/61` verifier tests passing).
- **RPC, API & secret scan hardening (`060c101`):** added `{ retryCount: 3, retryDelay: 400, timeout: 15_000 }` in `registryReader`/`recordOnchain`, bounded `/api/contracts` to batches of 3 concurrent `r.get()` reads, added `Access-Control-Allow-Origin: *` on public GET routes, and fixed `scripts/scan-secrets.mjs` to match `*_MNEMONIC` and `.env.local`.
- **Foundry fuzz & stateful invariants (`060c101`):** added 2 boundary/auth fuzz tests in `HallmarkRegistry.t.sol` and 5 stateful invariants (`256 × 32 = 8,192` calls per invariant) in `HallmarkRegistry.invariant.t.sol` (`43/43` Foundry tests passing).
- **Keyless juror UX (`060c101`):** updated `Home.tsx` so the hero diagram picks a live full-match, claimed, PQ-guarded record; added a 1-click keyless `QuantumGuestbook` sample loader on `/verify` (`Verify.tsx` + `buildInfo.ts`); added a per-contract `npx` check box and Standard JSON Input download on `/c/<address>` (`Contract.tsx`).
- **QoreScan CBOM & submission pack (`9d88633`):** added root `package.json`, generated CycloneDX 1.6 CBOM (`docs/cbom.json`) via `@qorechain/qorescan`, wrote `scripts/verify-submission.mjs` (`16/16` live keyless checks), `JUDGES.md`, and `docs/SUBMISSION_PACK.md`, and flagged that the demo video (`unveo-out/demo-video.mp4`) is not yet linked on `build.qorechain.io/p/hallmark`.

**Learned / went wrong:**
- First run of `testFuzz_TextLengthBoundary` failed because `registry.MAX_TEXT_LENGTH()` consumed `vm.prank(verifier)`, and `invariant_FullNeverDowngradedForSameCode` failed on an artificial `codeA → codeB → codeA` swap in the handler; both fixed in `060c101`.
- Vitest on Windows failed when invoked from a lowercase `d:\` shell path via `cmd /c` (`Cannot read properties of undefined (reading 'config')`); running from `D:\hallmark\packages\verifier` succeeded cleanly (`61/61`).

**Checked:** `npm run test:all` (`43/43` Foundry, `61/61` verifier, CLI/web typecheck & build), `npm run verify` (`16/16`), live `hallmark check 0xa901ee7138266abc456c8d717fa94b043078b8c4` (`CONFIRMED`), and `node scripts/scan-secrets.mjs`.

**Shipped (same day):**
- Pushed hardening commits to `origin/main` and deployed to Vercel production (`https://hallmark-jade.vercel.app`, live 1-click sample `POST /api/verify` returned `200`, `full`, `pqcFlags: 2`, `unchanged: true`).
- Bumped `@hallmark/verifier` and `@agvswira/hallmark` to `0.1.1` (`940463e`), verified `npm pack --dry-run` (4 files, 1.1 MB), and the owner published `0.1.1` to npm with 2FA (`npx -y @agvswira/hallmark@0.1.1 check` confirmed exit `0`).
- Owner uploaded `unveo-out/demo-video.mp4` to [`https://youtu.be/bQ6GsjzvASY`](https://youtu.be/bQ6GsjzvASY) and updated `https://build.qorechain.io/p/hallmark` (`QoreScan`, `QoreX integrations`, `QoreChain SDK`, and `AI-Native` all showing **Verified**).

## 2026-11-29: the AI record made machine-checkable

Agent: Claude Code (desktop app), model Claude Opus 5.5, in a fresh session that had first judged the
fest's AI_USAGE files blind and found that this one cited commits for only 4 of its 27 mistakes.

**Owner decided (D14):** make this record machine-checkable: build a command that checks it against git
and the code, run it in CI, and fix whatever it finds.

**Agent (reviewer + builder):**
- Wrote `scripts/ai-verify.mjs` (`npm run ai:verify`): the ledger against `git log` (commit on HEAD's
  history, files touched, date), when each ledger line was written (`git blame`), every commit and test
  named in the mistakes table, the owner decisions here against AI_USAGE.md, the git rules of CLAUDE.md,
  the claimed test and attack counts against the code, and the links in the AI documents.
- Added a Proof column to the mistakes table: for each of the 27 rows, the commit that carries the fix
  (found with `git log -S` and the ledger) and the test that guards it, or why there is none.
- Added the owner decisions table (D1–D14) and the five most important catches to AI_USAGE.md.
- Added `.github/workflows/ci.yml`: `ai:verify` with full history, and `npm run test:all` (`c49e261`,
  together with the script).

**Learned / went wrong:**
- The first run of `ai:verify` failed 34 checks. Most were the missing commit and test references. Two
  were real errors in the ledger: its schema said dates were UTC while every entry used local time
  (UTC+8), and three entries (L-0026, L-0028, L-0034) listed report files that were committed one
  commit later, in `40fa8d4` and `196bc57`. The schema now says UTC+8 and the three lists match git.
- Two failures were the script's own: it skipped the red-team row `W`, and it treated text after
  "no test" as test names. Both fixed before relying on its result.
- After the ledger corrections were committed, `ai:verify` reported entries "written 177 hours" after
  their change: it timed each entry by `git blame`, which gives the last edit, so the three corrected
  lines looked late. It now times each entry by the first commit that contains its id (median 0 hours,
  longest 39.2 hours).
- The audit also found that the 26 Nov hardening went in as two batch commits, against CLAUDE.md's
  "one commit per logical change". History is not rewritten, because the ledger cites those hashes.

**Checked:** `npm run ai:verify` passes all 13 checks; with a wrong hash, an invented test name or a
wrong test count put into AI_USAGE.md on purpose, it fails on exactly those rows (then restored).
