import { defineChain, type Address } from "viem";

/** HallmarkRegistry on qorechain-diana (deployed 21 Nov 2026, block 10446802). */
export const REGISTRY_ADDRESS: Address = "0xa901ee7138266abc456c8d717fa94b043078b8c4";

export const diana = defineChain({
  id: 9800,
  name: "QoreChain Diana",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: ["https://evm-testnet.qore.host"] } },
  blockExplorers: { default: { name: "QoreChain Explorer", url: "https://explore.qore.network" } },
  testnet: true,
});
