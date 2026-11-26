# Hallmark — Build Before Q-Day Submission Pack

> Ready-to-copy fields and pre-submission checklist for [`https://build.qorechain.io/p/hallmark`](https://build.qorechain.io/p/hallmark).
> **Submission deadline:** 2 December 2026 at 23:59 UTC.

---

## Submission Status: COMPLETE & LIVE

- [x] **Demo Video Linked on Portal**: [`https://youtu.be/bQ6GsjzvASY`](https://youtu.be/bQ6GsjzvASY) (`unveo-out/demo-video.mp4`, `2:42.9`, `2560×1440`, `-14.1 LUFS`).
- [x] **GitHub Pushed & Clean**: [`https://github.com/agvswira/hallmark`](https://github.com/agvswira/hallmark) (`main`).
- [x] **Vercel Production Live**: [`https://hallmark-jade.vercel.app`](https://hallmark-jade.vercel.app) (`/verify` 1-click keyless sample, `/c/` independent recheck, CORS `*` on public read endpoints).
- [x] **npm CLI Published (`0.1.1`)**: [`@agvswira/hallmark@0.1.1`](https://www.npmjs.com/package/@agvswira/hallmark) (`npx -y @agvswira/hallmark@0.1.1 check 0xa901ee7138266abc456c8d717fa94b043078b8c4` confirmed).
- [x] **Portal Verified Signals**: `QoreScan` Verified, `QoreX integrations` Verified, `QoreChain SDK` Verified, `AI-Native` Verified, `Quantum Campus` & `Regional (ID, Asia-Pacific)` selected.

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

```text
qor1vjvnfsgzyhw768g45k0yxgsmzanmsxkjgw8yjl
qor1866wh676a00t78edc9x40wnq6xgcjq60x25mrl
qor1mky8fau7ca3htdrrlt625j0nw36pwve9hv7k5t
qor14yq7uufcye4tc3tv34chl22tqsc83wxycjz4x8
qor1756qudt7zmdxh80d0tvusc2gmuhvt7vjddycwk
```

- Verifier Server Account: `qor1vjvnfsgzyhw768g45k0yxgsmzanmsxkjgw8yjl` (`0x649934C10225DDeD1d15a59e43221b1767b81ad2`)
- QoreX Coin-60 Account (`QuantumGuestbook` deployer/claimant): `qor1866wh676a00t78edc9x40wnq6xgcjq60x25mrl` (`0x3eb4EBEBDAEBDebF1f2dC14d57BA60D19189034f`)
- Owner Coin-118 Account (Registry owner): `qor1mky8fau7ca3htdrrlt625j0nw36pwve9hv7k5t` (`0xdd8874f79Ec76375B463FAF4AA49f37474173325`)
- `HallmarkRegistry` Contract (EVM): `qor14yq7uufcye4tc3tv34chl22tqsc83wxycjz4x8` (`0xa901ee7138266abc456c8d717fa94b043078b8c4`)
- `QuantumGuestbook` Sample Contract (EVM): `qor1756qudt7zmdxh80d0tvusc2gmuhvt7vjddycwk` (`0xf5340e357e16da6b9ded7ad9c86148df2ec5f992`)

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
