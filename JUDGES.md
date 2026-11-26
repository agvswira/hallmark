# 5-Minute Keyless Judge Walkthrough — Hallmark

No wallet extension, private keys, or API keys are required to verify every claim in **Hallmark** against live `qorechain-diana` (Chain ID `9800`) and [`https://hallmark-jade.vercel.app`](https://hallmark-jade.vercel.app).

---

## 0:00 — Live Registry & Proof Diagram
Open [`https://hallmark-jade.vercel.app/`](https://hallmark-jade.vercel.app/):
- The hero proof diagram shows a live verified, PQ-guarded, claimed contract (`source hash` ↔ `HallmarkRegistry` seal ↔ `code hash` on `qorechain-diana`).
- Scroll to **Verified contracts** (`#registry`): 6 live contracts on `qorechain-diana`, including `HallmarkRegistry` itself (`0xa901ee7138266abc456c8d717fa94b043078b8c4`), the QoreX-claimed `QuantumGuestbook` sample (`0xf5340e357e16da6b9ded7ad9c86148df2ec5f992`), and all 4 contracts of `Attenua` (including `AttenuaVault` at `0xf585fc6e1e43446f353830e0d11ff44ce747af58`).

## 0:45 — Keyless Live Recompilation (`/verify`)
Open [`https://hallmark-jade.vercel.app/verify`](https://hallmark-jade.vercel.app/verify):
- Click **"Load live QuantumGuestbook sample"** (zero wallet, zero gas). It loads the stripped Standard JSON Input from `/samples/quantum-guestbook.build-info.json` and pre-fills the live `QuantumGuestbook` address (`0xf5340e357e16da6b9ded7ad9c86148df2ec5f992`) and deployment tx (`0xbeed8439...a970`).
- Click **"Verify contract"**: the serverless verifier compiles with official `solc 0.8.28`, matches both runtime and creation bytecode against `qorechain-diana`, detects `pqcKeyStatus (0x...0a02)`, and detects that an identical record already exists on chain (writing nothing to waste zero gas).

## 1:45 — On-Chain Record, PQC Report & Source Inspection
Open [`https://hallmark-jade.vercel.app/c/0xf585fc6e1e43446f353830e0d11ff44ce747af58`](https://hallmark-jade.vercel.app/c/0xf585fc6e1e43446f353830e0d11ff44ce747af58) (`AttenuaVault`) or [`/c/0xa901ee7138266abc456c8d717fa94b043078b8c4`](https://hallmark-jade.vercel.app/c/0xa901ee7138266abc456c8d717fa94b043078b8c4) (`HallmarkRegistry`):
- Inspect the **Post-quantum report** (bytecode `PUSH` + call-opcode scan excluding CBOR metadata and `JUMP`/`JUMPI` targets, mapped to exact source lines and enclosing functions).
- Inspect the **Repository** claim (accepted on chain only from the contract deployer with a registered `ML-DSA-87` key via `pqcKeyStatus`) and the live **README badge** (`/api/badge?address=...`).
- Under **Recheck independently**, copy the `npx @agvswira/hallmark check ...` command or download the exact Standard JSON Input.

## 2:30 — Trustless Local CLI Recompilation (Zero Server Trust)
Run on your own machine (Node >= 20, no repo clone required):

```sh
npx @agvswira/hallmark check 0xa901ee7138266abc456c8d717fa94b043078b8c4
```

The CLI downloads the official `solc` build (verified by SHA-256 against `binaries.soliditylang.org/bin/list.json`), recompiles locally, and checks 6 invariants against `HallmarkRegistry` on `qorechain-diana`. Exit code `0` prints `CONFIRMED: this machine reproduces the on-chain record.`

## 3:30 — Optional QoreX End-to-End Flow (`/try`)
If you have QoreX connected to `qorechain-diana` (with an Ethereum coin-60 account), open [`https://hallmark-jade.vercel.app/try`](https://hallmark-jade.vercel.app/try) to deploy `QuantumGuestbook`, verify it on chain, and claim it with your `ML-DSA-87` key in three steps.

## 4:00 — Single-Command Terminal Audit

From the repository root (`d:\hallmark` or a fresh clone):

```sh
# 1. Keyless 16-check live chain, API, CLI, CBOM & AI-Native verification
npm install && npm run verify

# 2. Full automated test & build suite (contracts + verifier + CLI + web)
npm run test:all
```

> **PQC Mock Disclosure:** Local Foundry tests (`contracts/test/HallmarkRegistry.t.sol`, `HallmarkRegistry.invariant.t.sol`, `QuantumGuestbook.t.sol`) etch `MockPqcKeyStatus` at `0x...0a02` because Forge's local EVM does not run QoreChain's Go FIPS 204 precompiles. Live `pqcKeyStatus` behavior on `qorechain-diana` is verified on chain in `HallmarkRegistry.claim()` (`0x4e1855c2...`, `0x2ff0b2be...`) and checked live by `npm run verify`.
