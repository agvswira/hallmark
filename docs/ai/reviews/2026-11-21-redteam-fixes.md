# Review: red-team fixes (21 Nov 2026)

**Reviewer:** the AI agent in the reviewer role, using the `code-review` skill at high effort. It
was run as a separate pass over the uncommitted diff of the red-team fixes (see
[`../redteam.md`](../redteam.md)). It used four angles: a line-by-line scan, removed behaviour,
call sites across files, and the rules in `CLAUDE.md`.

**Scope:** `packages/verifier/src/{plan,proxy,verify,index}.ts`, `packages/cli/src/main.ts`,
`web/api/{verify,contract,badge}.ts` and the web pages that show records.

## Findings

| # | Severity | Finding | Outcome |
|---|---|---|---|
| R1 | important | An unrecorded contract's stored sources could still be downgraded. With no on-chain record, every matching submission was "store-only" and replaced the stored doc. A partial build with edited sources and no deployment transaction could therefore replace an earlier full result. This is B10 again, for contracts not yet on chain. | **Fixed.** `planRecording` now takes the stored result and refuses an unrecordable result that is weaker, or equally strong with other sources. Test: "an unrecorded result never replaces stronger or different stored sources". |
| R2 | important | `hallmark check` printed each check's detail raw. With `--api`, that detail can quote solc errors on server-supplied sources, so the B1b fix missed it. `--json` output also kept bidi characters, since `JSON.stringify` escapes only control characters. | **Fixed.** Details are cleaned, and JSON output escapes bidi characters. |
| R3 | nit | "unchanged" did not compare the compiler version. For a partial match the compiler is not proven, so a resubmission built with another solc counted as the same result and could be stored with a compiler that disagrees with the record. | **Fixed.** Compiler compared. Test: "a different compiler version is not the same result". |
| R4 | nit | The rewrite dropped the friendly message for the registry's `Downgrade` revert. That revert can still happen if two verifications race. | **Fixed.** Message restored. |
| R5 | nit | `/api/contract` ran proxy detection (4–5 RPC calls) before its 404 check, so unknown addresses cost RPC calls. | **Fixed.** Proxy detection runs only when a record or stored result exists. |

No `CLAUDE.md` violations were found in the diff.

## Checks after the fixes

- Verifier: 58 tests passing (`npm test` in `packages/verifier`), including the red-team and plan suites.
- Contracts: 30 Foundry tests passing.
- Web: `tsc --noEmit` and the production build pass; the record page renders the claim as a safe link
  (checked in the local preview).
- CLI: rebuilt; `hallmark status` on the registry prints the record, and `--json` output is unchanged for
  ordinary strings.
