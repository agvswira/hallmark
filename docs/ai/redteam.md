# Red team: trying to make Hallmark say more than the chain supports

Run on 21 Nov 2026 by the AI agent in the **attacker** role, at the owner's request. Hallmark is a
trust tool, so the failure that matters most is a false "Hallmarked": a full match, a PQ-guarded
label, or displayed sources that the deployed code does not support. Each attack below was tried
against real compiled code (a local anvil chain with chain id 9800, the local dev server pointed at
qorechain-diana, or diana itself). The outcome is what actually happened.

Attacks that became tests live in
[`packages/verifier/test/redteam.test.ts`](../../packages/verifier/test/redteam.test.ts) and
[`packages/verifier/test/plan.test.ts`](../../packages/verifier/test/plan.test.ts); each asserts the
safe outcome, so a regression fails the suite.

## Summary

| ID | Attack | Outcome | Fix |
|---|---|---|---|
| A1 | Deploy code built without a metadata trailer, then verify edited sources | **Held**: partial, never full | None needed; the page now explains what partial does not prove |
| A2 | Same, with `bytecodeHash: none` | **Held**: partial | As A1 |
| A3 | No metadata, and claim another compiler version | **Held**: partial | As A1 |
| A4 | Source calls `pqcVerify` through an immutable address; deploy with a fake verifier | **Held**: flags 0, not PQ-guarded | None needed |
| A5 | Verify an EIP-1967 proxy, then upgrade it | **Gap**: full match with no word about the proxy; the upgrade left the record and code hash unchanged | Proxy detection, read live on every page, badge and CLI run |
| A6 | Identical code under another contract name | **Held**: partial | None needed |
| B1 | Claim a contract with `javascript:…` as the repository | **Gap**: the page put the string in `href` | Links only for http(s) URLs; control and bidi characters stripped |
| B1b | Put ANSI escapes or bidi overrides in on-chain strings, read with the CLI | **Gap**: the CLI printed them raw | CLI strips them, JSON output escapes bidi characters |
| B2 | Submit the same verification again and again | **Gap**: each one sent a registry transaction, spending the verifier's window (200 transactions) | Exact repeats write nothing ("unchanged") |
| B3 | Flood `/api/verify` | **Partly held**: an in-memory limit of 6 per minute per IP, per function instance | Documented below; a platform rule is the real fix |
| B4 | Submit a large build with no contract named, so every candidate compiles | **Gap**: unbounded compilations per request | At most 3 candidates when no contract is named |
| B10 | Submit a partial build of a fully hallmarked contract, with edited sources | **Gap, shown live**: the page showed the attacker's sources under a full on-chain record | Sources are stored only after recording, never over a stronger result |
| W | Spend the verifier's window on something other than the registry | **Held** (live on diana): a 1 wei transfer was refused | None needed (window scoped with `allowedTargets`) |

## Source attacks (A1–A6)

Without a metadata trailer, the bytecode no longer commits to the sources, so the question is
whether Hallmark lets an attacker attach any source that compiles to the same code and call it a
full match. It did not: lib-sourcify reports a perfect match only when the metadata hash matches,
and every one of these came back **partial**. A3 also shows the subtlety: for a partial match, the
compiler version and settings are not proven either. The record page and the "How it works" text now
say exactly that.

A4 checks the post-quantum report. Hallmark reads precompile use from the deployed code (PUSH
values outside the metadata trailer), not from the source. A contract whose source calls
`pqcVerify` through an immutable, deployed with another address, is correctly reported as calling
neither precompile.

## Proxies (A5)

A minimal EIP-1967 proxy verified as a full match, which is true of the proxy's own code, but the
code that runs is the implementation, and `upgrade()` replaced it without changing the proxy's code
hash. Hallmark said nothing about this.

Fix: `detectProxy` (EIP-1167 clones, EIP-1967 implementation and beacon slots, EIP-1822). The
implementation is read **live**, so an upgrade after verification shows up:

- the record page warns that an upgradeable proxy's hallmark does not cover the code it runs, and
  links the current implementation;
- the badge reads "· proxy";
- `hallmark status` and `hallmark check` print the proxy and its implementation.

Tests: A5 (detected with its implementation), A5b (plain contract: none), A5c (upgrade after
verification: code unchanged, new implementation reported), A5d (EIP-1167 clone).

## Display and terminal injection (B1, B1b)

`claim(target, repo)` accepts any non-empty string up to the length limit from the deployer, and
the page rendered it as `<a href={repo}>`. A `javascript:` repository would run in the page of anyone
who clicked it. Now a repository is a link only when it parses as an http(s) URL; anything else is
shown as text, and control and bidirectional characters are removed first so one URL cannot be
disguised as another.

The CLI printed the same strings (and server error messages) straight to the terminal, where an
ANSI escape can rewrite earlier lines, for example to show CONFIRMED. It now strips control and
bidi characters from every string that comes from the chain or a server.

## Recording abuse (B2, B4, B10)

**B10, shown live on the local server.** The old flow stored the submitted sources first and then
tried to record. A build-info with one comment changed matched the registry as **partial**; the
registry refused to downgrade the full record, as designed, but the sources were already stored,
so the record page showed the attacker's sources under the full on-chain record. The fix is
`planRecording`: the existing record is read first, and sources are stored only after the result is
recorded, or when there is no record at all. A partial never touches a full record of the same code.
Retest on the local server: an honest verification restored the original sources, and two repeats of
the attack were refused.

**B2.** Every submission of an identical result sent a new registry transaction. Anyone could have
used up the verifier's window (200 transactions, scoped to the registry) and stopped recording for
everyone until it reopened. An exact repeat is now "unchanged": nothing is written, and the stored
sources are restored if they differ from the record.

**B4.** Without a contract name, the verifier tried every candidate in the build, each a full
compilation. The API now stops at 3.

## Rate limiting (B3)

`/api/verify` allows 6 requests per minute per IP, counted in memory. On Vercel each function
instance has its own memory, so the limit is per instance, and `x-forwarded-for` is the only key.
This slows a casual flood but does not stop a determined one. The real fix is a rate-limit rule in
Vercel Firewall on `/api/verify`, which needs the owner's dashboard. B2 and B4 bound what each
request can cost in the meantime.

## The verifier's window (W)

From the window milestone (log, 21 Nov): the server opens EVM windows scoped to HallmarkRegistry
only (`allowedTargets`), 200 transactions and 30 QOR. Live on diana, a 1 wei transfer to another
address from the verifier account was refused and used none of the window. A leaked server key
could therefore write registry records (which the CLI lets anyone recheck) but could not move the
account's funds through the EVM.

## What was not attacked

- The `HallmarkRegistry` contract beyond its 30 Foundry tests: no formal verification, no fuzzing
  beyond the one fuzz test.
- lib-sourcify and solc themselves: Hallmark relies on them for the match.
- The QoreX claim flow with a real wallet.
