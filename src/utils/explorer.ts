import { network } from "@/sui/client";

// Suiscan only has dedicated mainnet/testnet sections; devnet/localnet fall
// back to testnet since there's nowhere else useful to send the player.
export function txExplorerUrl(digest: string): string {
  const suiscanNetwork = network === "mainnet" ? "mainnet" : "testnet";
  return `https://suiscan.xyz/${suiscanNetwork}/tx/${digest}`;
}
