"use client";
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { getWallets } from "@mysten/wallet-standard";
import type { Wallet, WalletAccount } from "@mysten/wallet-standard";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, ORIGINAL_PACKAGE_ID, LEADERBOARD_ID, YETI_TIERS } from "@/sui/contracts";
import { suiClient } from "@/sui/client";

export type WalletState = "disconnected" | "connecting" | "connected";

const SUI_NETWORK = process.env.EXPO_PUBLIC_SUI_NETWORK ?? "testnet";
const SUI_CHAIN = `sui:${SUI_NETWORK}` as const;

export type TxArg =
  | { kind: "object"; id: string }
  | { kind: "pure"; type: "u64" | "address" | "bool" | "string"; value: string | number | boolean }
  // Splits a fresh coin of `amount` MIST off the sender's gas coin, for
  // calls (like marketplace purchases) that need a Coin<SUI> argument.
  | { kind: "splitCoin"; amount: string | number };

export interface MoveCallParams {
  module: string;
  function: string;
  args?: TxArg[];
}

export interface AvailableWallet {
  name: string;
  icon?: string;
}

interface SuiContextType {
  walletAddress: string | null;
  walletState: WalletState;
  availableWallets: AvailableWallet[];
  connect: (walletName?: string) => Promise<boolean>;
  disconnect: () => void;
  signAndExecute: (
    call: MoveCallParams | MoveCallParams[]
  ) => Promise<{ digest: string; objectChanges?: any[] } | null>;
  hasNFT: boolean | null;
  highestScore: number;
  setHighestScore: (score: number) => void;
  setHasNFT: (val: boolean) => void;
  ownedYetiTiers: Record<string, boolean>;
  ownedYetiLoading: boolean;
  refreshOwnedTiers: () => Promise<void>;
  walletError: string | null;
  clearWalletError: () => void;
  // Score already saved on-chain this run. Lives here (not in the GameOver
  // Footer) because Footer unmounts when the player opens the leaderboard
  // and remounts on close, which would otherwise forget it was submitted.
  submittedScore: number | null;
  setSubmittedScore: (score: number | null) => void;
  // Id of a ChallengeMarket the player has joined but not yet attempted.
  // Lives here (not in ChallengesScreen) so the next GameOver screen --
  // reached by leaving Challenges and playing a fresh run -- can still see
  // it and offer a "Submit Attempt" action off that run's new RunScore.
  pendingChallengeMarketId: string | null;
  setPendingChallengeMarketId: (id: string | null) => void;
}

const SuiContext = createContext<SuiContextType>({
  walletAddress: null,
  walletState: "disconnected",
  availableWallets: [],
  connect: async () => false,
  disconnect: () => {},
  signAndExecute: async () => null,
  hasNFT: null,
  highestScore: 0,
  setHighestScore: () => {},
  setHasNFT: () => {},
  ownedYetiTiers: {},
  ownedYetiLoading: false,
  refreshOwnedTiers: async () => {},
  walletError: null,
  clearWalletError: () => {},
  submittedScore: null,
  setSubmittedScore: () => {},
  pendingChallengeMarketId: null,
  setPendingChallengeMarketId: () => {},
});

export const useSui = () => useContext(SuiContext);

function listSuiWallets(): Wallet[] {
  if (typeof window === "undefined") return [];
  return getWallets().get().filter(
    (w) =>
      w.chains.some((c) => c.startsWith("sui:")) &&
      "standard:connect" in w.features &&
      "sui:signAndExecuteTransaction" in w.features
  );
}

function findSuiWallet(name?: string): Wallet | null {
  const candidates = listSuiWallets();
  if (candidates.length === 0) return null;
  if (name) return candidates.find((w) => w.name === name) ?? null;
  // No explicit choice (e.g. only one wallet installed) — use it.
  return candidates[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(e: any): string {
  return e?.message ?? String(e ?? "");
}

// The wallet's vault is actually locked — retrying the same request just
// fires the same doomed call again. The user needs to unlock it themselves.
export function isWalletLockedError(e: any): boolean {
  return /incorrect password|locked|wallet is locked/i.test(errMessage(e));
}

// The user explicitly said no in the wallet popup — retrying would just
// pop the prompt again, which is not what a rejection means.
function isUserRejectedError(e: any): boolean {
  return /reject|denied|cancel/i.test(errMessage(e));
}

// Some wallet extensions (observed with Slush) reject the very first
// sign request right after standard:connect resolves, with a spurious
// "Incorrect password" — their background keyring hasn't settled the new
// session yet. That error string is indistinguishable from a genuinely
// locked wallet, so we can't skip the retry for it: one delayed retry
// clears the spurious case, and a truly locked wallet will just fail the
// same way again, which the caller then surfaces to the player. Only a
// user rejection is unambiguous and skips the retry.
async function withWalletRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isUserRejectedError(e)) throw e;
    await sleep(500);
    return await fn();
  }
}

// The Leaderboard's scores live in a nested `Table<address,u64>`, so the
// per-player rows are dynamic fields of the *table* object, not of the
// Leaderboard itself. Resolve (and cache) that inner table id once.
let leaderboardTableIdCache: string | null = null;
async function getLeaderboardTableId(): Promise<string | null> {
  if (leaderboardTableIdCache) return leaderboardTableIdCache;
  const lb = await suiClient.getObject({ id: LEADERBOARD_ID, options: { showContent: true } });
  leaderboardTableIdCache = (lb.data?.content as any)?.fields?.scores?.fields?.id?.id ?? null;
  return leaderboardTableIdCache;
}

function buildArgs(tx: Transaction, args: TxArg[] = []) {
  return args.map((arg) => {
    if (arg.kind === "object") return tx.object(arg.id);
    if (arg.kind === "splitCoin") {
      return tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(arg.amount))])[0];
    }
    switch (arg.type) {
      case "u64":
        return tx.pure.u64(BigInt(arg.value as string | number));
      case "address":
        return tx.pure.address(String(arg.value));
      case "bool":
        return tx.pure.bool(Boolean(arg.value));
      case "string":
        return tx.pure.string(String(arg.value));
    }
  });
}

export function SuiProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletState, setWalletState] = useState<WalletState>("disconnected");
  const [hasNFT, setHasNFT] = useState<boolean | null>(null);
  const [highestScore, setHighestScore] = useState(0);
  const [ownedYetiTiers, setOwnedYetiTiers] = useState<Record<string, boolean>>({});
  const [ownedYetiLoading, setOwnedYetiLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const clearWalletError = useCallback(() => setWalletError(null), []);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const [pendingChallengeMarketId, setPendingChallengeMarketId] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<AvailableWallet[]>([]);
  const walletRef = useRef<Wallet | null>(null);
  const accountRef = useRef<WalletAccount | null>(null);

  // Wallet-Standard registration can happen after this component mounts
  // (extensions inject asynchronously), so refresh the list on mount and
  // whenever the registry announces a change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () =>
      setAvailableWallets(listSuiWallets().map((w) => ({ name: w.name, icon: w.icon })));
    refresh();
    const wallets = getWallets();
    const offRegister = wallets.on("register", refresh);
    const offUnregister = wallets.on("unregister", refresh);
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  // The player only ever truly "has" a Yeti if the YetiNFT object for that
  // tier is actually owned on-chain — local/optimistic flags don't survive
  // reloads and can't reflect wallets that minted from another device.
  const refreshOwnedTiers = useCallback(async () => {
    if (!walletAddress) {
      setOwnedYetiTiers({});
      setHighestScore(0);
      return;
    }
    setOwnedYetiLoading(true);
    try {
      const res = await suiClient.getOwnedObjects({
        owner: walletAddress,
        filter: { StructType: `${ORIGINAL_PACKAGE_ID}::yeti_nft::YetiNFT` },
        options: { showContent: true },
      });
      const owned: Record<string, boolean> = {};
      for (const obj of res.data) {
        const fields = (obj.data?.content as any)?.fields;
        const tierId = YETI_TIERS[Number(fields?.tier)];
        if (tierId) owned[tierId] = true;
      }
      setOwnedYetiTiers(owned);
    } catch (e) {
      console.warn("Failed to load owned Yeti NFTs", e);
    } finally {
      setOwnedYetiLoading(false);
    }

    // The player's best score is their row in the scores Table, read as a
    // dynamic field of the inner table object keyed by their address.
    // Without this the score-gated tiers (Blizzard >=100, Glacier >=500)
    // would stay locked in the UI even after the score is recorded on-chain.
    try {
      const tableId = await getLeaderboardTableId();
      if (tableId) {
        const field = await suiClient.getDynamicFieldObject({
          parentId: tableId,
          name: { type: "address", value: walletAddress },
        });
        const value = (field.data?.content as any)?.fields?.value;
        setHighestScore(value !== undefined && value !== null ? Number(value) : 0);
      } else {
        setHighestScore(0);
      }
    } catch (e) {
      // A missing row just means the player has no recorded score yet.
      setHighestScore(0);
    }
  }, [walletAddress]);

  useEffect(() => {
    refreshOwnedTiers();
  }, [refreshOwnedTiers]);

  const connect = useCallback(async (walletName?: string): Promise<boolean> => {
    setWalletState("connecting");
    try {
      const wallet = findSuiWallet(walletName);
      if (!wallet) {
        // No wallet extension — open Sui Wallet install page
        if (typeof window !== "undefined") {
          window.open(
            "https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil",
            "_blank"
          );
        }
        setWalletState("disconnected");
        return false;
      }
      const connectFeature = wallet.features["standard:connect"] as any;
      const { accounts } = await connectFeature.connect();
      const account = accounts?.[0];
      if (account) {
        walletRef.current = wallet;
        accountRef.current = account;
        setWalletAddress(account.address);
        setWalletState("connected");
        return true;
      }
      setWalletState("disconnected");
      return false;
    } catch (e) {
      console.warn("Wallet connect failed", e);
      setWalletState("disconnected");
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      const wallet = walletRef.current;
      const disconnectFeature = wallet?.features["standard:disconnect"] as any;
      disconnectFeature?.disconnect?.();
    } catch (e) {
      console.warn("Wallet disconnect failed", e);
    }
    walletRef.current = null;
    accountRef.current = null;
    setWalletAddress(null);
    setWalletState("disconnected");
    setHasNFT(null);
    setOwnedYetiTiers({});
    setSubmittedScore(null);
  }, []);

  // Every action is signed directly by the connected wallet -- one popup
  // per transaction, every time. No burner/session key, no delegate
  // registration step, nothing to keep funded.
  const signAndExecute = useCallback(
    async (
      calls: MoveCallParams | MoveCallParams[]
    ): Promise<{ digest: string; objectChanges?: any[] } | null> => {
      const wallet = walletRef.current;
      const account = accountRef.current;
      if (!wallet || !account) return null;
      const callList = Array.isArray(calls) ? calls : [calls];
      try {
        const tx = new Transaction();
        for (const call of callList) {
          tx.moveCall({
            target: `${PACKAGE_ID}::${call.module}::${call.function}`,
            arguments: buildArgs(tx, call.args),
          });
        }
        const executeFeature = wallet.features["sui:signAndExecuteTransaction"] as any;
        const result = await withWalletRetry<any>(() =>
          executeFeature.signAndExecuteTransaction({
            transaction: tx,
            account,
            chain: SUI_CHAIN,
          })
        );
        if (!result?.digest) return null;
        // showObjectChanges lets callers that mint an object in this PTB
        // (e.g. run_score::record_run) find the new object's id without a
        // separate query.
        const finalized = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showObjectChanges: true },
        });
        return { digest: result.digest, objectChanges: finalized.objectChanges ?? undefined };
      } catch (e) {
        console.warn("Transaction failed", e);
        setWalletError(
          isWalletLockedError(e)
            ? "Your wallet is locked. Unlock it and try again."
            : "Transaction failed. Check your wallet and try again."
        );
        return null;
      }
    },
    []
  );

  return (
    <SuiContext.Provider
      value={{
        walletAddress,
        walletState,
        availableWallets,
        connect,
        disconnect,
        signAndExecute,
        hasNFT,
        setHasNFT,
        highestScore,
        setHighestScore,
        ownedYetiTiers,
        ownedYetiLoading,
        refreshOwnedTiers,
        walletError,
        clearWalletError,
        pendingChallengeMarketId,
        setPendingChallengeMarketId,
        submittedScore,
        setSubmittedScore,
      }}
    >
      {children}
    </SuiContext.Provider>
  );
}
