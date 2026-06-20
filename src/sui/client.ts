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
