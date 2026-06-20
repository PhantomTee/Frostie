import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useSui } from "@/context/SuiContext";
import { PACKAGE_ID, ORIGINAL_PACKAGE_ID, MARKETPLACE_ID, YETI_TIERS } from "@/sui/contracts";
import { suiClient } from "@/sui/client";
import { txExplorerUrl } from "@/utils/explorer";

const MIST_PER_SUI = 1_000_000_000;

interface Listing {
  listingId: string;
  nftId: string;
  seller: string;
  price: number; // MIST
  tier: number;
}

interface OwnedYeti {
  objectId: string;
  tier: number;
}

const TIER_COLORS: Record<number, string> = {
  0: "#87C6FF",
  1: "#3B9FE8",
  2: "#B8DEFF",
};

function tierName(tier: number): string {
  return (YETI_TIERS[tier] ?? "yeti").toUpperCase();
}

function shortAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function suiToMist(sui: string): number | null {
  const n = Number(sui);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * MIST_PER_SUI);
}

// Active listings aren't tracked in an on-chain index -- they're
// reconstructed from the Listed/Sold/Cancelled event log, since every
// Listed event already carries the price/tier/seller needed to render a
// card with no follow-up object fetch.
async function fetchActiveListings(): Promise<Listing[]> {
  async function allEvents(eventName: string) {
    const out: any[] = [];
    let cursor: any = null;
    do {
      const page = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::marketplace::${eventName}` },
        cursor,
        limit: 50,
      });
      out.push(...page.data);
      cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor);
    return out;
  }

  const [listed, sold, cancelled] = await Promise.all([
    allEvents("Listed"),
    allEvents("Sold"),
    allEvents("Cancelled"),
  ]);

  const closed = new Set<string>([
    ...sold.map((e) => e.parsedJson.listing_id),
    ...cancelled.map((e) => e.parsedJson.listing_id),
  ]);

  return listed
    .filter((e) => !closed.has(e.parsedJson.listing_id))
    .map((e) => ({
      listingId: e.parsedJson.listing_id,
      nftId: e.parsedJson.nft_id,
      seller: e.parsedJson.seller,
      price: Number(e.parsedJson.price),
      tier: Number(e.parsedJson.tier),
    }));
}

async function fetchOwnedYetis(owner: string): Promise<OwnedYeti[]> {
  const res = await suiClient.getOwnedObjects({
    owner,
    filter: { StructType: `${ORIGINAL_PACKAGE_ID}::yeti_nft::YetiNFT` },
    options: { showContent: true },
  });
  return res.data.map((obj) => ({
    objectId: obj.data!.objectId,
    tier: Number((obj.data?.content as any)?.fields?.tier),
  }));
}

interface Props {
  onClose: () => void;
}

export default function MarketplaceScreen({ onClose }: Props) {
  const { walletAddress, signAndExecute, walletError, clearWalletError } = useSui();
  const [tab, setTab] = useState<"browse" | "sell">("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [ownedYetis, setOwnedYetis] = useState<OwnedYeti[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [lastDigest, setLastDigest] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [active, owned] = await Promise.all([
        fetchActiveListings(),
        walletAddress ? fetchOwnedYetis(walletAddress) : Promise.resolve([]),
      ]);
      setListings(active);
      setOwnedYetis(owned);
    } catch (e) {
      console.warn("Failed to load marketplace", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (listing: Listing) => {
    if (busyId) return;
    setBusyId(listing.listingId);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "marketplace",
        function: "buy_nft",
        args: [
          { kind: "object", id: MARKETPLACE_ID },
          { kind: "object", id: listing.listingId },
          { kind: "splitCoin", amount: listing.price },
        ],
      });
      if (result?.digest) {
        setLastDigest(result.digest);
        await load();
      }
    } catch (e) {
      console.warn("Buy failed", e);
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (listing: Listing) => {
    if (busyId) return;
    setBusyId(listing.listingId);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "marketplace",
        function: "cancel_listing",
        args: [{ kind: "object", id: listing.listingId }],
      });
      if (result?.digest) await load();
    } catch (e) {
      console.warn("Cancel failed", e);
    } finally {
      setBusyId(null);
    }
  };

  const listForSale = async (yeti: OwnedYeti) => {
    const mist = suiToMist(priceDrafts[yeti.objectId] ?? "");
    if (!mist || busyId) return;
    setBusyId(yeti.objectId);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "marketplace",
        function: "list_nft",
        args: [
          { kind: "pure", type: "u64", value: mist },
          { kind: "object", id: yeti.objectId },
        ],
      });
      if (result?.digest) {
        setLastDigest(result.digest);
        setPriceDrafts((d) => ({ ...d, [yeti.objectId]: "" }));
        await load();
      }
    } catch (e) {
      console.warn("List failed", e);
    } finally {
      setBusyId(null);
    }
  };

  const myListings = listings.filter(
    (l) => walletAddress && l.seller.toLowerCase() === walletAddress.toLowerCase()
  );
  const browseListings = listings.filter(
    (l) => !walletAddress || l.seller.toLowerCase() !== walletAddress.toLowerCase()
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#3B9FE8" />
        </TouchableOpacity>
        <Text style={styles.title}>Marketplace</Text>
        <TouchableOpacity onPress={load} style={styles.iconBtn} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={18} color="#3B9FE8" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "browse" && styles.tabActive]}
          onPress={() => setTab("browse")}
        >
          <Text style={[styles.tabText, tab === "browse" && styles.tabTextActive]}>BROWSE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "sell" && styles.tabActive]}
          onPress={() => setTab("sell")}
        >
          <Text style={[styles.tabText, tab === "sell" && styles.tabTextActive]}>MY YETIS</Text>
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
          <Text style={styles.emptyText}>Couldn't load the marketplace.</Text>
        </View>
      ) : tab === "browse" ? (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {myListings.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>YOUR LISTINGS</Text>
              {myListings.map((l) => (
                <View key={l.listingId} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.tierText, { color: TIER_COLORS[l.tier] }]}>
                      {tierName(l.tier)}
                    </Text>
                    <Text style={styles.priceText}>{l.price / MIST_PER_SUI} SUI</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => cancel(l)}
                    disabled={busyId === l.listingId}
                  >
                    {busyId === l.listingId ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.actionTextSecondary}>CANCEL</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 8 }} />
              <Text style={styles.sectionLabel}>FOR SALE</Text>
            </>
          )}
          {browseListings.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>No Yetis for sale right now.</Text>
            </View>
          ) : (
            browseListings.map((l) => (
              <View key={l.listingId} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.tierText, { color: TIER_COLORS[l.tier] }]}>
                    {tierName(l.tier)}
                  </Text>
                  <Text style={styles.sellerText}>{shortAddress(l.seller)}</Text>
                  <Text style={styles.priceText}>{l.price / MIST_PER_SUI} SUI</Text>
                </View>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => buy(l)}
                  disabled={!walletAddress || busyId === l.listingId}
                >
                  {busyId === l.listingId ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.actionText}>BUY</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {!walletAddress ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>Connect your wallet to list a Yeti.</Text>
            </View>
          ) : ownedYetis.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>You don't own any Yetis to sell yet.</Text>
            </View>
          ) : (
            ownedYetis.map((yeti) => (
              <View key={yeti.objectId} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.tierText, { color: TIER_COLORS[yeti.tier] }]}>
                    {tierName(yeti.tier)}
                  </Text>
                </View>
                <TextInput
                  style={styles.priceInput}
                  placeholder="SUI"
                  placeholderTextColor="#7FB8E8"
                  keyboardType="decimal-pad"
                  value={priceDrafts[yeti.objectId] ?? ""}
                  onChangeText={(t) =>
                    setPriceDrafts((d) => ({ ...d, [yeti.objectId]: t }))
                  }
                />
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => listForSale(yeti)}
                  disabled={
                    busyId === yeti.objectId || !suiToMist(priceDrafts[yeti.objectId] ?? "")
                  }
                >
                  {busyId === yeti.objectId ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.actionText}>LIST</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
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
  tabs: {
    flexDirection: "row",
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: "#2A8FD8",
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: "#1E6FBF",
  },
  tabText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#B8DEFF",
    letterSpacing: 1,
  },
  tabTextActive: {
    color: "#FFFFFF",
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
  tierText: {
    fontFamily: "retro",
    fontSize: 12,
    letterSpacing: 1,
  },
  sellerText: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#FFFFFF",
    opacity: 0.8,
    marginTop: 4,
  },
  priceText: {
    fontFamily: "retro",
    fontSize: 11,
    color: "#FFFFFF",
    marginTop: 4,
  },
  priceInput: {
    fontFamily: "retro",
    fontSize: 11,
    color: "#FFFFFF",
    backgroundColor: "#1E6FBF",
    borderRadius: 6,
    width: 70,
    paddingVertical: 8,
    paddingHorizontal: 8,
    textAlign: "center",
    marginRight: 10,
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
