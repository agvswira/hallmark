# @hallmark/verifier

The Hallmark verification engine. It recompiles Solidity sources with the exact compiler and
settings, compares the result with the bytecode deployed on QoreChain, and reports which
post-quantum precompiles the contract calls.

## How a verification works

1. **Read the chain.** Confirms the RPC is on the expected chain (`qorechain-diana`, 9800) and
   fetches the deployed runtime code.
2. **Compile.** Uses the official soljson build of the requested version from
   binaries.soliditylang.org, checked against the SHA-256 published in `list.json` before use.
3. **Match.** [`@ethereum-sourcify/lib-sourcify`](https://www.npmjs.com/package/@ethereum-sourcify/lib-sourcify)
   (MIT) compares runtime and, given the deployment transaction, creation bytecode, handling
   immutables, library links and the metadata trailer.
   - **full**: a perfect match, the metadata hash (which commits to every source and setting) is identical
   - **partial**: the executable code matches, the metadata differs (for example a changed comment)
   - **none**: anything else
4. **Deployer.** Taken from the deployment transaction, and only when that transaction is matched
   to this contract. A transaction from another deployment of the same code gives no deployer.
5. **PQC report.** Scans the deployed code for pushes of `0x…0a01` (`pqcVerify`) and `0x…0a02`
   (`pqcKeyStatus`), which covers literals and immutables, and points at the source lines and
   functions that use them.

```ts
import { parseBuildInfo, verifyContract } from "@hallmark/verifier";

const build = parseBuildInfo(JSON.parse(buildInfoJson)); // forge build --build-info, or Hardhat's
const result = await verifyContract({ address, creationTxHash, build });
// result.match: "full" | "partial" | "none", result.deployer, result.pqc.flags, ...
```

## Tests

```sh
npm install
npm test        # 61 tests across 7 files: unit tests, red-team suite, and end-to-end runs on local anvil (chain id 9800)
```

The end-to-end tests deploy real compiled contracts to anvil and check: full match with the
deployer, partial match after a comment change, no match after a logic change or different
optimizer settings, no deployer without (or with someone else's) creation transaction, PQC
detection through a literal and through an immutable, picking the right contract from a build,
and refusing the wrong chain or an address without code.

## Live checks on qorechain-diana

Run with `npm run verify:live` against public contracts deployed by other fest projects, from
their public sources (21 Nov 2026):

| Contract | Settings | Result | Deployer found | PQC report |
|---|---|---|---|---|
| QuantumFlip `0x4a8de5795545fb081cb875e4ba8667290bb11c6f` | solc 0.8.24, optimizer 200 | partial (runtime and creation) | `0x32fA…eCD6`, as in the project's deployment record | none |
| RescueRun `0x2dA829D9F363d4463C529D4C2170a80D13955301` | solc 0.8.24, optimizer 200, evmVersion paris | partial (runtime and creation) | `0x6E21…D28A`, as in the project's deployment record | `pqcKeyStatus`, used in `hasPqcKey` and `_requirePqcKeyRegistered` |

Partial matches are expected here: the sources were rebuilt from the repositories rather than from
the original build-info files, so the metadata differs. A build-info file gives the exact input.

The RescueRun check also showed why build-info matters: with the compiler's default `evmVersion`
the code length differs; Hardhat 2 compiles 0.8.24 for `paris` by default.
