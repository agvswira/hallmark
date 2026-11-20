/**
 * Detects calls to QoreChain's post-quantum precompiles.
 *
 * The authoritative signal is the deployed bytecode: a contract that calls a precompile
 * must push its address, either as a literal (PUSHn) or as an immutable, which the
 * deployed code also holds as a PUSH32 value. This mirrors how the fest's own checker
 * decides. Source references are reported alongside, to show where in the code it happens.
 */

export const PQC_VERIFY = 0xa01n;
export const PQC_KEY_STATUS = 0xa02n;

export interface SourceRef {
  file: string;
  line: number;
  /** Enclosing function, modifier or constructor, if one is found above the line. */
  scope?: string;
  precompile: "pqcVerify" | "pqcKeyStatus";
  text: string;
}

export interface PqcReport {
  usesVerify: boolean;
  usesKeyStatus: boolean;
  /** Bit flags as stored in HallmarkRegistry: 1 = pqcVerify, 2 = pqcKeyStatus. */
  flags: number;
  sourceRefs: SourceRef[];
}

/** Values pushed by PUSH1..PUSH32 in the code section (metadata trailer excluded). */
export function pushedValues(runtimeHex: string): bigint[] {
  const code = stripMetadata(hexToBytes(runtimeHex));
  const values: bigint[] = [];
  for (let i = 0; i < code.length; i++) {
    const op = code[i];
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      let v = 0n;
      for (let j = 1; j <= n && i + j < code.length; j++) v = (v << 8n) | BigInt(code[i + j]);
      values.push(v);
      i += n;
    }
  }
  return values;
}

export function detectPqc(runtimeHex: string, sources: Record<string, { content?: string }> = {}): PqcReport {
  const pushed = new Set(pushedValues(runtimeHex));
  const usesVerify = pushed.has(PQC_VERIFY);
  const usesKeyStatus = pushed.has(PQC_KEY_STATUS);
  return {
    usesVerify,
    usesKeyStatus,
    flags: (usesVerify ? 1 : 0) | (usesKeyStatus ? 2 : 0),
    sourceRefs: findSourceRefs(sources),
  };
}

const ADDRESS_LITERAL = /0x0*a0([12])(?![0-9a-f])/gi;
const SCOPE = /\b(function\s+(\w+)|constructor\b|modifier\s+(\w+)|fallback\b|receive\b)/;

/** `NAME =` of a constant/immutable declaration on the same line or the one or two above. */
const DECLARED_NAME = /\b(?:constant|immutable)\s+(\w+)\s*=?\s*$|\b(?:constant|immutable)\s+(\w+)\s*=/;

export function findSourceRefs(sources: Record<string, { content?: string }>): SourceRef[] {
  const refs: SourceRef[] = [];
  for (const [file, { content }] of Object.entries(sources)) {
    if (!content) continue;
    const lines = content.split(/\r?\n/);
    const code = lines.map((l) => l.replace(/\/\/.*$/, ""));
    code.forEach((text, idx) => {
      for (const m of text.matchAll(ADDRESS_LITERAL)) {
        const precompile = m[1] === "1" ? "pqcVerify" : "pqcKeyStatus";
        const scope = enclosingScope(lines, idx);
        refs.push({ file, line: idx + 1, scope, precompile, text: lines[idx].trim() });

        // A named constant at contract level: also report the functions that use it.
        const name = scope ? undefined : declaredName(code, idx);
        if (!name) continue;
        const use = new RegExp(`\\b${name}\\b`);
        code.forEach((other, j) => {
          if (j === idx || !use.test(other) || DECLARED_NAME.test(other)) return;
          const s = enclosingScope(lines, j);
          if (s) refs.push({ file, line: j + 1, scope: s, precompile, text: lines[j].trim() });
        });
      }
    });
  }
  return refs;
}

function declaredName(code: string[], idx: number): string | undefined {
  for (let i = idx; i >= Math.max(0, idx - 2); i--) {
    const m = code[i].match(DECLARED_NAME);
    if (m) return m[1] ?? m[2];
  }
  return undefined;
}

function enclosingScope(lines: string[], idx: number): string | undefined {
  for (let i = idx; i >= 0; i--) {
    const m = lines[i].match(SCOPE);
    if (m) return m[2] ?? m[3] ?? m[1].split(/\s/)[0];
    if (/^\s*(contract|library|interface|abstract\s+contract)\s/.test(lines[i])) return undefined;
  }
  return undefined;
}

/** Drops the CBOR metadata trailer whose length is encoded in the last two bytes. */
export function stripMetadata(code: Uint8Array): Uint8Array {
  if (code.length < 2) return code;
  const len = (code[code.length - 2] << 8) | code[code.length - 1];
  if (len === 0 || len + 2 > code.length) return code;
  // CBOR metadata starts with a map header (0xa1..0xa5 for 1..5 entries).
  const start = code.length - 2 - len;
  if (code[start] < 0xa1 || code[start] > 0xa5) return code;
  return code.subarray(0, start);
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, "");
  if (h.length % 2 !== 0 || /[^0-9a-f]/i.test(h)) throw new Error("Invalid hex bytecode");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
