# Hallmark

**Proof that the contract on QoreChain is the code in your repo.**

QoreChain's explorer has no source verification and no Etherscan-compatible API, so nobody can
prove that a contract deployed on the `qorechain-diana` testnet was built from the code in a
GitHub repository. Hallmark recompiles your sources with the exact compiler settings, compares the
result with the bytecode on chain, and records the match in an on-chain registry, together with
a report of the QoreChain post-quantum precompiles the contract calls.

Built for [Build Before Q-Day](https://build.qorechain.io), Quantum Pass category.

> Status: early build (21 Nov 2026). The registry contract and its tests are done; the
> verification engine, web app and CLI are in progress. This README is updated as parts land.

## What is in the repository

| Path | What |
|---|---|
| `contracts/` | `HallmarkRegistry`: the on-chain record of verified contracts, with Foundry tests |
| `web/` | The Hallmark web app (Vite + React + wagmi, QoreX wallet) |
| `docs/ai/` | The log, ledger and reports behind [AI_USAGE.md](AI_USAGE.md) |
| `scripts/` | Repository tooling (pre-commit secret scan) |

## HallmarkRegistry

- **The registry reads the code hash itself.** When the verifier records a result, the contract
  stores `target.codehash` read on chain, so a record can only describe the code that is deployed.
  `isCurrent(target)` tells you whether that code is still the same.
- **Full or partial match.** Full: bytecode and metadata hash match. Partial: the bytecode
  matches but the metadata hash differs. A full record cannot be downgraded to partial for the same code.
- **PQC report.** `pqcFlags` records whether the verified code calls `pqcVerify` (0x…0a01) or
  `pqcKeyStatus` (0x…0a02).
- **Claims need a post-quantum key.** Only the recorded deployer can claim a contract and link its
  repository, and only from an account whose ML-DSA-87 key is registered, checked in the contract
  through the `pqcKeyStatus` precompile. If the precompile answers with no data (inactive), the claim
  is refused rather than accepted.

```sh
cd contracts
npm install
npm run forge-std   # clones forge-std into lib/
npm test            # 30 tests
```

`forge` comes from the `@foundry-rs/forge` npm package through `scripts/forge.mjs`, so no global
Foundry install is needed (its npm postinstall step does not run on Windows).

## Network

| | |
|---|---|
| Chain | `qorechain-diana` (testnet), EVM chain id 9800 |
| EVM RPC | `https://evm-testnet.qore.host` |
| REST | `https://api-testnet.qore.host` |

## Credits

- Scaffolded with [`create-qorechain-dapp`](https://www.npmjs.com/package/create-qorechain-dapp)
  0.14 (`foundry` and `viem-wagmi` templates), including the template's `scripts/window.ts` EVM window helper.
- [`@qorechain/sdk`](https://www.npmjs.com/package/@qorechain/sdk),
  [`@qorechain/evm`](https://www.npmjs.com/package/@qorechain/evm),
  [`@qorechain/qorex-rainbowkit`](https://www.npmjs.com/package/@qorechain/qorex-rainbowkit).
- [forge-std](https://github.com/foundry-rs/forge-std) (MIT/Apache-2.0) and
  [Foundry](https://github.com/foundry-rs/foundry) via `@foundry-rs/forge`.

## AI use

Built with an AI coding agent. The workflow, what the AI generated and what the owner decided are
documented in [AI_USAGE.md](AI_USAGE.md) from the first commit.

## Licence

[MIT](LICENSE)
