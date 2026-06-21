import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

export const network = (process.env.EXPO_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "mainnet"
  | "testnet"
  | "devnet"
  | "localnet";

export const suiClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl(network),
  network,
});

// MIST balance of the wallet's SUI coins, for guarding a stake input against
// a balance the wallet doesn't actually have before firing a transaction.
export async function getSuiBalanceMist(address: string): Promise<number> {
  const { totalBalance } = await suiClient.getBalance({ owner: address });
  return Number(totalBalance);
}
