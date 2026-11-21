/**
 * Proxy detection. A verified proxy proves only the proxy's own code: the code that actually
 * runs is the implementation it delegates to, which an admin may be able to swap at any time
 * without the proxy's code hash changing. Hallmark therefore reports proxies and their current
 * implementation, read from the chain, next to every match.
 */
import { getAddress, type Address, type Hex, type PublicClient } from "viem";

export interface ProxyInfo {
  kind: "eip1967" | "eip1967-beacon" | "eip1822" | "eip1167";
  /** The implementation the proxy delegates to right now. */
  implementation?: Address;
  beacon?: Address;
  /** False only for EIP-1167 clones, whose implementation is part of their code. */
  upgradeable: boolean;
}

// keccak256("eip1967.proxy.implementation") - 1, and so on (EIP-1967, EIP-1822).
export const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
export const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
export const EIP1822_PROXIABLE_SLOT = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7";

const EIP1167 = /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i;

const slotAddress = (word: Hex | undefined): Address | undefined => {
  if (!word || /^0x0*$/.test(word)) return undefined;
  const hex = word.slice(-40);
  return /^0+$/.test(hex) ? undefined : getAddress(`0x${hex}`);
};

export async function detectProxy(client: PublicClient, address: Address, code?: Hex): Promise<ProxyInfo | undefined> {
  const runtime = code ?? (await client.getCode({ address }));
  const clone = runtime?.match(EIP1167);
  if (clone) return { kind: "eip1167", implementation: getAddress(`0x${clone[1]}`), upgradeable: false };

  const [impl, beacon, proxiable] = await Promise.all(
    [EIP1967_IMPLEMENTATION_SLOT, EIP1967_BEACON_SLOT, EIP1822_PROXIABLE_SLOT].map((slot) =>
      client.getStorageAt({ address, slot: slot as Hex }).then(slotAddress),
    ),
  );
  if (impl) return { kind: "eip1967", implementation: impl, upgradeable: true };
  if (beacon) {
    const implementation = await client
      .readContract({
        address: beacon,
        abi: [{ type: "function", name: "implementation", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
        functionName: "implementation",
      })
      .then((a) => getAddress(a as string))
      .catch(() => undefined);
    return { kind: "eip1967-beacon", beacon, implementation, upgradeable: true };
  }
  if (proxiable) return { kind: "eip1822", implementation: proxiable, upgradeable: true };
  return undefined;
}
