# Review: submission hardening & second security pass (27 Nov 2026)

**Reviewer:** AI coding agent, full-repo audit comparing Hallmark against the Build Before Q-Day rubrics (`Quantum Pass`, `Quantum Campus`, `Best AI-Native Build`, `People's Choice`).

**Scope:** `packages/verifier/src/{pqc,registry}.ts`, `web/api/{contracts,contract,badge}.ts`, `web/src/pages/{Home,Contract,Verify}.tsx`, `contracts/test/`, `scripts/scan-secrets.mjs`, and submission documentation (`README.md`, `JUDGES.md`, `AI_USAGE.md`, `docs/`).

## Findings

| # | Severity | Finding | Outcome |
|---|---|---|---|
| S1 | important | `detectPqc` checked `pushedValues()` across the entire runtime bytecode without checking for any call opcode (`CALL`/`STATICCALL`/`DELEGATECALL`/`CALLCODE`) or excluding `JUMP`/`JUMPI` targets. A contract returning `0x0a01` as a constant or jumping to offset `0x0a01` could be flagged PQ-guarded (**Attack A7**). | **Fixed.** Added `scanCallTargets` in `packages/verifier/src/pqc.ts`, filtering `JUMP`/`JUMPI` targets and requiring a call opcode; filtered `sourceRefs` to detected precompiles. Added unit test and live-anvil red-team test A7. |
| S2 | important | `scripts/scan-secrets.mjs` matched `QORE_MNEMONIC` in `SECRET_KEYS` but not `*_MNEMONIC` (missing `HALLMARK_VERIFIER_MNEMONIC` in `web/.env`), and skipped `.env.local`. | **Fixed.** Updated `SECRET_KEYS` to `.*_MNEMONIC` and added `.env.local` to the checked `.env` files. |
| S3 | important | `web/api/contracts.ts` fired `Promise.all(targets.map(...))` (`3 × N` concurrent `eth_call`s) with no viem HTTP retry config, risking `qorechain-diana` RPC 503 bursts as the registry grows. | **Fixed.** Added bounded batches of 3 in `web/api/contracts.ts`, `{ retryCount: 3, retryDelay: 400, timeout: 15_000 }` in `registryReader`/`recordOnchain`, and `Access-Control-Allow-Origin: *` on public GET endpoints. |
| S4 | medium | `HallmarkRegistry` had only 1 fuzz test and no stateful invariant suite (`docs/ai/redteam.md` explicitly flagged this gap). | **Fixed.** Added 2 fuzz tests in `HallmarkRegistry.t.sol` and a 5-invariant `256 × 32` stateful suite in `HallmarkRegistry.invariant.t.sol`. |
| S5 | medium | `Home.tsx` selected `items[0]` for the hero `ProofDiagram`, showing a `pqcFlags = 0` vault instead of a live PQ-guarded claimed contract; `/verify` required uploading a local file with no keyless sample for jurors; `/c/<address>` lacked a per-contract `npx` check box and JSON input download. | **Fixed.** Updated `Home.tsx`, `Verify.tsx` (1-click `QuantumGuestbook` sample), and `Contract.tsx` (recheck section + standard JSON download). |
| S6 | minor | `README.md` line 23 referred to "The first badge above" for the Hallmark badge (after "Built on QoreChain" became first); `packages/verifier/README.md` still said `25 tests`; `docs/ai/ledger.jsonl` line `L-0038` had `"commit": null`; no `JUDGES.md`, `docs/SUBMISSION_PACK.md`, `docs/cbom.json`, or `npm run verify` existed. | **Fixed.** Corrected docs, generated CycloneDX 1.6 CBOM via `@qorechain/qorescan`, and added `JUDGES.md`, `docs/SUBMISSION_PACK.md`, and `scripts/verify-submission.mjs`. |
| S7 | critical (portal) | `https://build.qorechain.io/p/hallmark` has no demo video linked yet (`unveo-out/demo-video.mp4` is ready locally, 2:42.9). | **Resolved.** Owner uploaded [`https://youtu.be/bQ6GsjzvASY`](https://youtu.be/bQ6GsjzvASY) and linked it on `build.qorechain.io/p/hallmark` alongside the live Vercel deploy and `@agvswira/hallmark@0.1.1`. |

## Checks after the fixes

- Contracts: `43/43` Foundry tests passing (6 `QuantumGuestbook`, 32 `HallmarkRegistry` unit + fuzz, 5 stateful invariants × 8,192 calls).
- Verifier: `61/61` Vitest tests passing across 7 files, `tsc --noEmit` clean, bundle built.
- CLI: `tsc --noEmit` clean, rebuilt, `hallmark check 0xa901ee7138266abc456c8d717fa94b043078b8c4` confirmed (exit 0).
- Web: `tsc --noEmit && vite build` clean.
- Keyless verifier: `npm run verify` passed `16/16`.
