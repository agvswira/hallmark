# AI session log

Dated record of each working session: what the agent generated, what the owner decided, and what
was learned. Newest entries at the bottom. Agent: Claude Code (desktop app), model Claude Opus 5.5.

## 2026-11-20: research and choosing the project

**Agent (research):**
- Read the fest site (home, prizes, rules, start, FAQ, kits) and the QoreChain docs sitemap,
  including the EVM precompile reference and the Build Before Q-Day guides.
- Read the project pages of all 104 registered projects and grouped the 20 Quantum Pass entries by
  type (account checkers, notaries and certificates, chance games, education games, tools).
- Proposed candidate ideas, each with the gap it fills and the competing projects it would face.
- For the source-verification candidate, checked the gap against primary sources: the fest FAQ states
  that the explorer has no source verification and no Etherscan-compatible API, and that jurors check
  Solidity PQC features in repositories by hand; Sourcify's chain list has no entry for chain 9800 or
  9801; a keyword scan of all 104 project pages found no project doing source verification.

**Owner decided:**
- D1: enter the Quantum Pass category; register as students (Quantum Campus) and as AI-native.
- D2: build Hallmark, a source-verification tool for QoreChain contracts, from the candidates.
- D3: the name "Hallmark" (from a shortlist), and a web app plus CLI as the product shape.
- D4: commits under the owner's name only, with no AI attribution line; AI use is documented here
  from the first commit instead.

**Agent (planning the disclosure):** read the 73 `AI_USAGE.md` files published by other fest
projects to see what is already common, and proposed a disclosure built on checkable evidence
(this log, a machine-readable ledger, review and red-team reports) rather than narrative alone.
The owner approved the plan.

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
