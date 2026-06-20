import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useSui } from "@/context/SuiContext";
import { PACKAGE_ID, CHALLENGE_CONFIG_ID, CLOCK_ID } from "@/sui/contracts";
import { suiClient } from "@/sui/client";
import { txExplorerUrl } from "@/utils/explorer";

const MIST_PER_SUI = 1_000_000_000;

interface Market {
  marketId: string;
  creator: string;
  targetScore: number;
  stakeAmount: number; // MIST
  closesMs: number;
  poolTotal: number; // MIST, from the most recent ChallengerJoined event (or the creator's own stake if nobody's joined yet)
  participantCount: number;
}

function shortAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeLeft(closesMs: number): string {
  const remaining = closesMs - Date.now();
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

// Markets aren't tracked in an on-chain index -- they're reconstructed from
// the MarketCreated/MarketWon/MarketExpired event log, same pattern as
// MarketplaceScreen's Listed/Sold/Cancelled reconstruction. ChallengerJoined
// events fill in the live pool total without a separate object fetch per
// market.
async function fetchOpenMarkets(): Promise<Market[]> {
  async function allEvents(eventName: string) {
    const out: any[] = [];
    let cursor: any = null;
    do {
      const page = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::challenge_market::${eventName}` },
        cursor,
        limit: 50,
      });
      out.push(...page.data);
      cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor);
    return out;
  }

  const [created, joined, won, expired] = await Promise.all([
    allEvents("MarketCreated"),
    allEvents("ChallengerJoined"),
    allEvents("MarketWon"),
    allEvents("MarketExpired"),
  ]);

  const closedIds = new Set<string>([
    ...won.map((e) => e.parsedJson.market_id),
    ...expired.map((e) => e.parsedJson.market_id),
  ]);

  const latestPoolByMarket = new Map<string, { pool: number; count: number }>();
  for (const e of joined) {
    const id = e.parsedJson.market_id;
    const existing = latestPoolByMarket.get(id);
    latestPoolByMarket.set(id, {
      pool: Number(e.parsedJson.pool_total),
      count: (existing?.count ?? 1) + 1,
    });
  }

  return created
    .filter((e) => !closedIds.has(e.parsedJson.market_id))
    .map((e) => {
      const id = e.parsedJson.market_id;
      const joinedInfo = latestPoolByMarket.get(id);
      return {
        marketId: id,
        creator: e.parsedJson.creator,
        targetScore: Number(e.parsedJson.target_score),
        stakeAmount: Number(e.parsedJson.stake_amount),
        closesMs: Number(e.parsedJson.closes_ms),
        poolTotal: joinedInfo?.pool ?? Number(e.parsedJson.stake_amount),
        participantCount: joinedInfo?.count ?? 1,
      };
    })
    .sort((a, b) => b.closesMs - a.closesMs);
}

interface Props {
  onClose: () => void;
}

export default function ChallengesScreen({ onClose }: Props) {
  const {
    walletAddress,
    signAndExecute,
    walletError,
    clearWalletError,
    setPendingChallengeMarketId,
  } = useSui();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setMarkets(await fetchOpenMarkets());
    } catch (e) {
      console.warn("Failed to load challenges", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const join = async (market: Market) => {
    if (busyId) return;
    setBusyId(market.marketId);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "challenge_market",
        function: "join_market",
        args: [
          { kind: "object", id: market.marketId },
          { kind: "splitCoin", amount: market.stakeAmount },
          { kind: "object", id: CLOCK_ID },
        ],
      });
      if (result?.digest) {
        setLastDigest(result.digest);
        setPendingChallengeMarketId(market.marketId);
        await load();
      }
    } catch (e) {
      console.warn("Join failed", e);
    } finally {
      setBusyId(null);
    }
  };

  const claimExpired = async (market: Market) => {
    if (busyId) return;
    setBusyId(market.marketId);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "challenge_market",
        function: "close_expired",
        args: [
          { kind: "object", id: market.marketId },
          { kind: "object", id: CHALLENGE_CONFIG_ID },
          { kind: "object", id: CLOCK_ID },
        ],
      });
      if (result?.digest) {
        setLastDigest(result.digest);
        await load();
      }
    } catch (e) {
      console.warn("Claim refund failed", e);
    } finally {
      setBusyId(null);
    }
  };

  const myMarkets = markets.filter(
    (m) => walletAddress && m.creator.toLowerCase() === walletAddress.toLowerCase()
  );
  const openMarkets = markets.filter(
    (m) => !walletAddress || m.creator.toLowerCase() !== walletAddress.toLowerCase()
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#3B9FE8" />
        </TouchableOpacity>
        <Text style={styles.title}>Challenges</Text>
        <TouchableOpacity onPress={load} style={styles.iconBtn} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={18} color="#3B9FE8" />
        </TouchableOpacity>
      </View>

      {walletError && <Text style={styles.errorText}>{walletError}</Text>}
      {lastDigest && (
        <TouchableOpacity
          style={styles.txRow}
          onPress={() => Linking.openURL(txExplorerUrl(lastDigest))}
        >
          <Text style={styles.txLink}>View last transaction</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#3B9FE8" size="large" />
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Couldn't load challenges.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {myMarkets.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>YOUR CHALLENGES</Text>
              {myMarkets.map((m) => {
                const expired = m.closesMs <= Date.now();
                return (
                  <View key={m.marketId} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.scoreText}>Beat {m.targetScore}</Text>
                      <Text style={styles.poolText}>
                        Pool: {m.poolTotal / MIST_PER_SUI} SUI · {m.participantCount} in
                      </Text>
                      <Text style={styles.timeText}>{timeLeft(m.closesMs)}</Text>
                    </View>
                    {expired && (
                      <TouchableOpacity
                        style={styles.actionBtnSecondary}
                        onPress={() => claimExpired(m)}
                        disabled={busyId === m.marketId}
                      >
                        {busyId === m.marketId ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.actionTextSecondary}>CLAIM</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <View style={{ height: 8 }} />
              <Text style={styles.sectionLabel}>OPEN CHALLENGES</Text>
            </>
          )}
          {openMarkets.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>No open challenges right now.</Text>
            </View>
          ) : (
            openMarkets.map((m) => {
              const expired = m.closesMs <= Date.now();
              return (
                <View key={m.marketId} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.scoreText}>Beat {m.targetScore}</Text>
                    <Text style={styles.sellerText}>{shortAddress(m.creator)}</Text>
                    <Text style={styles.poolText}>
                      Stake {m.stakeAmount / MIST_PER_SUI} SUI · Pool{" "}
                      {m.poolTotal / MIST_PER_SUI} SUI
                    </Text>
                    <Text style={styles.timeText}>{timeLeft(m.closesMs)}</Text>
                  </View>
                  {!expired && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => join(m)}
                      disabled={!walletAddress || busyId === m.marketId}
                    >
                      {busyId === m.marketId ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.actionText}>JOIN</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3B9FE8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#2A8FD8",
    borderBottomWidth: 5,
    borderBottomColor: "#1A5FA8",
    borderTopWidth: 2,
    borderTopColor: "#5BB8FF",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E6FBF",
    borderRadius: 8,
    borderBottomWidth: 4,
    borderBottomColor: "#0A1628",
    borderRightWidth: 3,
    borderRightColor: "#0A1628",
    borderTopWidth: 2,
    borderTopColor: "#5BB8FF",
    borderLeftWidth: 2,
    borderLeftColor: "#5BB8FF",
  },
  title: {
    fontFamily: "retro",
    fontSize: 18,
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  errorText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFD2D2",
    textAlign: "center",
    marginTop: 8,
  },
  txRow: {
    alignItems: "center",
    marginTop: 6,
  },
  txLink: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#0A3D6B",
    textDecorationLine: "underline",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: "retro",
    fontSize: 11,
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.85,
  },
  sectionLabel: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#0A3D6B",
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#2A8FD8",
    borderBottomWidth: 5,
    borderBottomColor: "#1A5FA8",
    borderRightWidth: 3,
    borderRightColor: "#1A5FA8",
    borderTopWidth: 2,
    borderTopColor: "#5BB8FF",
    borderLeftWidth: 2,
    borderLeftColor: "#5BB8FF",
  },
  rowInfo: {
    flex: 1,
  },
  scoreText: {
    fontFamily: "retro",
    fontSize: 12,
    color: "#FFD700",
    letterSpacing: 1,
  },
  sellerText: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#FFFFFF",
    opacity: 0.8,
    marginTop: 4,
  },
  poolText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFFFFF",
    marginTop: 4,
  },
  timeText: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#B8DEFF",
    marginTop: 4,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#1E6FBF",
    borderRadius: 8,
    borderBottomWidth: 4,
    borderBottomColor: "#0A1628",
    borderRightWidth: 3,
    borderRightColor: "#0A1628",
    borderTopWidth: 2,
    borderTopColor: "#5BB8FF",
    borderLeftWidth: 2,
    borderLeftColor: "#5BB8FF",
    minWidth: 64,
    alignItems: "center",
  },
  actionBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#0A3D6B",
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  actionText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFFFFF",
  },
  actionTextSecondary: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFD2D2",
  },
});
