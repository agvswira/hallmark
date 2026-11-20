# AI session log

Dated record of each working session: what the agent generated, what the owner decided, and what
was learned. Newest entries at the bottom. Agent: Claude Code (desktop app), model Claude Opus 5.5.

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
