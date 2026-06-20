import React from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Images from "@/Images";

// Hard black pixel outline (web) so HUD text matches the chunky score look.
const pixelShadow = Platform.select({
  web: {
    textShadow:
      "-3px 0px 0px #000, 3px 0px 0px #000, 0px -3px 0px #000, 0px 3px 0px #000",
  },
  default: {},
}) as any;

function shortAddress(addr?: string | null): string {
  if (!addr) return "";
  return addr.length <= 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// In-game overlay: centered coin counter (top), and a right column with the
// connected wallet address, a mute toggle, and (desktop only) a D-pad toggle.
export default function GameHUD({
  coins,
  muted,
  onToggleMute,
  walletAddress,
  showDpadToggle,
  dpadEnabled,
  onToggleDpad,
  nextReviveCost,
  canRevive,
  challengeTargetScore,
}: {
  coins: number;
  muted: boolean;
  onToggleMute: () => void;
  walletAddress?: string | null;
  showDpadToggle?: boolean;
  dpadEnabled?: boolean;
  onToggleDpad?: () => void;
  nextReviveCost?: number;
  canRevive?: boolean;
  challengeTargetScore?: number;
}) {
  const { top, right } = useSafeAreaInsets();
  return (
    <>
      {/* Reminder of the score being chased, for a joined challenge market */}
      {challengeTargetScore != null && (
        <View
          pointerEvents="none"
          style={[styles.challengeWrap, { top: Math.max(top, 14) }]}
        >
          <Text style={[styles.challengeText, pixelShadow]}>
            Beat {challengeTargetScore} to win
          </Text>
        </View>
      )}

      {/* Centered, pixelated coin counter */}
      <View
        pointerEvents="none"
        style={[
          styles.coinWrap,
          { top: Math.max(top, 14) + (challengeTargetScore != null ? 26 : 0) },
        ]}
      >
        <View style={styles.coinDot} />
        <Text style={[styles.coinText, pixelShadow]}>{coins}</Text>
      </View>

      {/* Next revive cost, so the escalating price isn't a surprise on death */}
      {nextReviveCost != null && (
        <View
          pointerEvents="none"
          style={[
            styles.reviveWrap,
            { top: Math.max(top, 14) + 38 + (challengeTargetScore != null ? 26 : 0) },
          ]}
        >
          <Text
            style={[
              styles.reviveText,
              pixelShadow,
              canRevive ? styles.reviveTextAffordable : styles.reviveTextExpensive,
            ]}
          >
            Revive: {nextReviveCost}
          </Text>
        </View>
      )}

      {/* Right column */}
      <View
        pointerEvents="box-none"
        style={[styles.rightCol, { top: Math.max(top, 12), right: Math.max(right, 12) }]}
      >
        {!!walletAddress && (
          <Text style={[styles.addr, pixelShadow]}>{shortAddress(walletAddress)}</Text>
        )}

        <TouchableOpacity onPress={onToggleMute} activeOpacity={0.7} hitSlop={8} style={styles.iconBtn}>
          <Image source={Images.button.mute} style={[styles.icon, muted && styles.iconOff]} />
        </TouchableOpacity>

        {showDpadToggle && (
          <TouchableOpacity onPress={onToggleDpad} activeOpacity={0.7} hitSlop={8} style={styles.iconBtn}>
            <Image source={Images.button.controller} style={[styles.icon, !dpadEnabled && styles.iconOff]} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  challengeWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  challengeText: {
    fontFamily: "retro",
    fontSize: 12,
    color: "#FFD700",
    backgroundColor: "transparent",
  },
  coinWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  coinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFD700",
    borderWidth: 3,
    borderColor: "#B8860B",
    marginRight: 9,
  },
  coinText: {
    fontFamily: "retro",
    fontSize: 32,
    color: "#FFFFFF",
    backgroundColor: "transparent",
  },
  reviveWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  reviveText: {
    fontFamily: "retro",
    fontSize: 12,
    backgroundColor: "transparent",
  },
  reviveTextAffordable: {
    color: "#9CFFA0",
  },
  reviveTextExpensive: {
    color: "#FFD2D2",
  },
  rightCol: {
    position: "absolute",
    alignItems: "flex-end",
    gap: 8,
  },
  addr: {
    fontFamily: "retro",
    fontSize: 12,
    color: "#FFFFFF",
    backgroundColor: "transparent",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  iconOff: {
    opacity: 0.4,
  },
});
