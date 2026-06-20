import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSui } from "@/context/SuiContext";
import { LEADERBOARD_ID } from "@/sui/contracts";
import { suiClient } from "@/sui/client";

interface Entry {
  rank: number;
  address: string;
  score: number;
  isYou?: boolean;
}

const MAX_ENTRIES = 50;

// The on-chain Leaderboard only tracks each player's all-time best score —
// there's no timestamp to slice into 24h/7d windows, so this reads the
// Table's dynamic fields directly and ranks everyone by their best score.
async function fetchLeaderboard(myAddress: string | null): Promise<Entry[]> {
  const rows: { address: string; score: number }[] = [];
  let cursor: string | null | undefined = undefined;

  // Scores are dynamic fields of the inner `scores` Table object, not of the
  // Leaderboard itself — resolve that table id before paging its entries.
  const lb = await suiClient.getObject({ id: LEADERBOARD_ID, options: { showContent: true } });
  const tableId = (lb.data?.content as any)?.fields?.scores?.fields?.id?.id;
  if (!tableId) return [];

  do {
    const page = await suiClient.getDynamicFields({
      parentId: tableId,
      cursor,
    });
    if (page.data.length) {
      const objs = await suiClient.multiGetObjects({
        ids: page.data.map((d) => d.objectId),
        options: { showContent: true },
      });
      page.data.forEach((field, i) => {
        const value = (objs[i]?.data?.content as any)?.fields?.value;
        const address = (field.name as any)?.value as string | undefined;
        if (address && value !== undefined) {
          rows.push({ address, score: Number(value) });
        }
      });
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, MAX_ENTRIES).map((row, i) => ({
    rank: i + 1,
    address: row.address,
    score: row.score,
    isYou: !!myAddress && row.address.toLowerCase() === myAddress.toLowerCase(),
  }));
}

function shortAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const RANK_ICONS: Record<number, { name: "award" | "star" | "zap"; color: string }> = {
  1: { name: "award", color: "#FFD700" },
  2: { name: "star",  color: "#C0C0C0" },
  3: { name: "zap",   color: "#CD7F32" },
};

interface Props {
  onClose: () => void;
}

export default function LeaderboardScreen({ onClose }: Props) {
  const { walletAddress } = useSui();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setEntries(await fetchLeaderboard(walletAddress));
    } catch (e) {
      console.warn("Failed to load leaderboard", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#3B9FE8" />
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={18} color="#3B9FE8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>ALL-TIME BEST</Text>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#3B9FE8" size="large" />
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Couldn't load the leaderboard.</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>No scores submitted yet — be the first!</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {entries.map((entry) => {
            const iconDef = RANK_ICONS[entry.rank];
            return (
              <View
                key={entry.address}
                style={[styles.row, entry.isYou && styles.rowYou]}
              >
                <View style={styles.rankWrap}>
                  {iconDef ? (
                    <Feather name={iconDef.name} size={16} color={iconDef.color} />
                  ) : (
                    <Text style={styles.rank}>{entry.rank}</Text>
                  )}
                </View>
                <Text style={[styles.address, entry.isYou && styles.addressYou]}>
                  {entry.isYou ? "You" : shortAddress(entry.address)}
                </Text>
                <Text style={[styles.score, entry.isYou && styles.scoreYou]}>
                  {entry.score}
                </Text>
              </View>
            );
          })}
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
  backBtn: {
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
  subtitle: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#0A3D6B",
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
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
  list: {
    flex: 1,
    paddingHorizontal: 16,
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
  rowYou: {
    backgroundColor: "#1E6FBF",
    borderBottomColor: "#0A3D6B",
    borderRightColor: "#0A3D6B",
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
  },
  rankWrap: {
    width: 36,
    alignItems: "center",
  },
  rank: {
    fontFamily: "retro",
    fontSize: 14,
    color: "#FFFFFF",
  },
  address: {
    flex: 1,
    fontFamily: "retro",
    fontSize: 11,
    color: "#FFFFFF",
    marginLeft: 12,
    opacity: 0.9,
  },
  addressYou: {
    opacity: 1,
  },
  score: {
    fontFamily: "retro",
    fontSize: 16,
    color: "#FFFFFF",
  },
  scoreYou: {
    color: "#FFFFFF",
  },
});
