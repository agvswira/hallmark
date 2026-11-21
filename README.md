# Hallmark

**Proof that the contract on QoreChain is the code in your repo.**

QoreChain's explorer has no source verification and no Etherscan-compatible API, so nobody can
prove that a contract deployed on the `qorechain-diana` testnet was built from the code in a
GitHub repository. Hallmark recompiles your sources with the exact compiler settings, compares the
result with the bytecode on chain, and records the match in an on-chain registry, together with
a report of the QoreChain post-quantum precompiles the contract calls.

Built for [Build Before Q-Day](https://build.qorechain.io), Quantum Pass category.

> **Live: https://hallmark-jade.vercel.app** · Status (22 Nov 2026): registry on diana, web app and API on Vercel.
> Hallmark verified, recorded and claimed itself; a sample was deployed, verified and claimed with a real QoreX
> wallet from the [Try it](https://hallmark-jade.vercel.app/try) page. Recheck any record on your own machine:
>
> ```sh
> npx @agvswira/hallmark check 0xf5340e357e16da6b9ded7ad9c86148df2ec5f992
> ```

## What is in the repository

| Path | What |
|---|---|
| `contracts/` | `HallmarkRegistry`: the on-chain record of verified contracts, with Foundry tests |
| `packages/verifier/` | The verification engine: recompile, match against diana, PQC report ([details](packages/verifier/README.md)) |
| `packages/cli/` | `hallmark check`: recompile on your own machine and compare with the on-chain record ([details](packages/cli/README.md)) |
| `web/` | The web app and API: verify, registry, contract pages with the PQC report, claim with QoreX, README badge ([details](web/README.md)) |
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

## Live on qorechain-diana

| | |
|---|---|
| HallmarkRegistry | [`0xa901ee7138266abc456c8d717fa94b043078b8c4`](https://explore.qore.network/address/0xa901ee7138266abc456c8d717fa94b043078b8c4) |
| Deploy | `0x16edaac41bf40c264eb2be154034e16312c062c3484cbb1aa44e3fd26bc292e7` (block 10446802) |
| First hallmark: the registry itself | full match, `pqcKeyStatus` detected; record `0x6767d7de80f984c4b46ddee197fe159670d49b95f82c01bff46909d0bb092562` |
| Recorded through the production API | `0x4d8786716bf2d62c9c4dc710f19efd5ff429cbaf4a324d6457e09b8ad16b36b1`, source page [https://hallmark-jade.vercel.app/c/0xa901…b8c4](https://hallmark-jade.vercel.app/c/0xa901ee7138266abc456c8d717fa94b043078b8c4) |
| First claim | checked by the live `pqcKeyStatus` precompile, proof of possession: yes; `0x4e1855c255a629751cb6299e4279086c4b8d44b134c12f81d876b1e15d91d887` |
| Owner (can replace the verifier) | `0xdd8874f79Ec76375B463FAF4AA49f37474173325`, the project owner's wallet; transfer `0x9fc9f88e50befcdd4dbcf1a44604b6e3261c436ee3f6a2a8f6d06fe42b295d12` |
| Verifier account (server key) | `qor1vjvnfsgzyhw768g45k0yxgsmzanmsxkjgw8yjl` (`0x649934C10225DDeD1d15a59e43221b1767b81ad2`) |

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
- [`@ethereum-sourcify/lib-sourcify`](https://github.com/argotorg/sourcify) (MIT) for bytecode matching, and
  [solc-js](https://github.com/ethereum/solc-js) (MIT) with the official soljson builds.
- [Manrope](https://github.com/sharanda/manrope) (SIL Open Font License) via [Fontsource](https://fontsource.org), self-hosted.
- [forge-std](https://github.com/foundry-rs/forge-std) (MIT/Apache-2.0) and
  [Foundry](https://github.com/foundry-rs/foundry) via `@foundry-rs/forge`.

## AI use

Built with an AI coding agent. The workflow, what the AI generated and what the owner decided are
documented in [AI_USAGE.md](AI_USAGE.md) from the first commit.

## Licence

[MIT](LICENSE)
