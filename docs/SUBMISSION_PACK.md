# Hallmark — Build Before Q-Day Submission Pack

> Ready-to-copy fields and pre-submission checklist for [`https://build.qorechain.io/p/hallmark`](https://build.qorechain.io/p/hallmark).
> **Submission deadline:** 2 December 2026 at 23:59 UTC.

---

## CRITICAL ACTION REQUIRED BEFORE DEADLINE

- [ ] **Upload Demo Video to YouTube & Link on Portal**: `https://build.qorechain.io/p/hallmark` currently has **no video linked**! The rendered master video (`unveo-out/demo-video.mp4`, `2:42.9`, `2560×1440`, `-14.1 LUFS`) is ready on disk, within the strict `≤ 3 minutes` rule, and must be uploaded to YouTube and pasted into the project form.
- [ ] **Approve & Push Local Hardening Commits + Redeploy Vercel**: Run `git push`, `vercel --prod` (from `web/`), and optionally `npm publish` (`0.1.1` for `@agvswira/hallmark`) once reviewed.

---

## 1. Project Form Fields

- **Project Name**: `Hallmark`
- **Tagline**: `Proof that the contract on QoreChain is the code in your repo.`
- **Category**: `Quantum Pass` (Solo / Student, eligible for Top 10 × `$150` + `$500` **Quantum Campus** + `$500` **Best AI-Native Build** + **People's Choice**)
- **Public GitHub Repository**: `https://github.com/agvswira/hallmark` (Public, MIT)
- **Live Demo URL**: `https://hallmark-jade.vercel.app`
- **Try-It URL**: `https://hallmark-jade.vercel.app/try`
- **npm Package**: `https://www.npmjs.com/package/@agvswira/hallmark` (`npx @agvswira/hallmark check 0xa901ee7138266abc456c8d717fa94b043078b8c4`)
- **Special Awards Selected**:
  - `Quantum Campus` (enrolled student)
  - `AI-Native` (`AI_USAGE.md` + `docs/ai/log.md` + `docs/ai/ledger.jsonl` + `docs/ai/redteam.md` + `docs/ai/reviews/`)
  - `Regional`: `Indonesia` (`Asia-Pacific`)

---

## 2. Testnet Addresses on `qorechain-diana`

- `HallmarkRegistry` (EVM): `0xa901ee7138266abc456c8d717fa94b043078b8c4`
- `QuantumGuestbook` sample (EVM, QoreX deployed & claimed): `0xf5340e357e16da6b9ded7ad9c86148df2ec5f992`
- Verifier Server Account (Native): `qor1vjvnfsgzyhw768g45k0yxgsmzanmsxkjgw8yjl` (`0x649934C10225DDeD1d15a59e43221b1767b81ad2`)
- Owner Account (Native): `0xdd8874f79Ec76375B463FAF4AA49f37474173325`

---

## 3. Kits & Network Features Checklist

**Kits present in repo (`package.json` files):**
- `@qorechain/sdk` (`^0.14.0`) — `contracts/`, `packages/verifier/`
- `@qorechain/evm` (`^0.14.0`) — `contracts/`, `packages/verifier/`, `web/`
- `@qorechain/qorex-rainbowkit` (`^0.1.0`) — `web/`
- `create-qorechain-dapp` (`0.14` foundry & viem-wagmi templates)
- `@qorechain/qorescan` (`^0.1.0`) — CycloneDX 1.6 CBOM (`docs/cbom.json`, `npm run cbom`)

**Network features used & proven live on `qorechain-diana`:**
- Hybrid `secp256k1 + ML-DSA-87` transactions (verifier account opens scoped EVM windows)
- PQC key registration with proof of possession (`possessionProven: true` on both verifier and sample claims)
- Scoped EVM windows (`allowedTargets: [HallmarkRegistry]`, 200 txs, 30 QOR, 17,280 blocks; out-of-scope transfer refused on diana)
- Solidity PQC Key Status precompile (`0x...0a02`) inside `HallmarkRegistry.claim()` and `QuantumGuestbook` (plus detection of `pqcVerify` `0x...0a01`)
- QoreX wallet integration (`Deploy with QoreX` on `/try` and `Claim with QoreX` on `/c/<address>`)

---

## 4. Updated "How it's made" Text (Optional Portal Refresh)

> **Architecture:**
> - **Verification engine (`packages/verifier`, TypeScript):** `@ethereum-sourcify/lib-sourcify` (MIT) with `solc-js`, fetching official compiler releases verified by SHA-256. PQC precompile usage (`0x...0a01` `pqcVerify`, `0x...0a02` `pqcKeyStatus`) is scanned from deployed bytecode (`PUSH` + call-opcode analysis excluding metadata and `JUMP`/`JUMPI` targets) and mapped to source functions. Live EIP-1167/1967/1822 proxy detection runs on every read.
> - **`HallmarkRegistry` (`contracts/`, Solidity 0.8.28, Foundry):** 43 tests (35 unit/fuzz + 5 stateful invariants at 256×32 = 8,192 calls each). Reads `target.codehash` on chain, blocks Full → Partial downgrades, and gates `claim()` to the deployer with a registered ML-DSA-87 key via `pqcKeyStatus` (failing closed).
> - **Web & API (`web/`, Vite + React on Vercel):** `verify` API checks existing on-chain records first via `planRecording` before storing sources in Vercel Blob, with Vercel Firewall rate limiting (6 req/min/IP). Includes `/try` (deploy, verify, claim with QoreX) and 1-click keyless verification on `/verify`.
> - **Trustless CLI (`@agvswira/hallmark` on npm):** `npx @agvswira/hallmark check <address>` recompiles locally and compares 6 invariants with the on-chain record (exit 0 = `CONFIRMED`).
> - **Security & AI-Native Evidence:** 14 red-team attacks documented in `docs/ai/redteam.md`, 2 independent code/security review passes in `docs/ai/reviews/`, CycloneDX 1.6 CBOM (`docs/cbom.json`), and a single-command keyless check (`npm run verify`, 16/16 passing).
