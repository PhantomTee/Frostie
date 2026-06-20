import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSui } from "@/context/SuiContext";

// Dev-only diagnostic for wallet-flow reports — shows the state that's
// hardest to see from console logs alone while reproducing a connect bug.
export default function WalletDebugOverlay() {
  if (!__DEV__) return null;

  const { walletState, walletAddress, walletError } = useSui();

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.line}>wallet: {walletState}</Text>
      <Text style={styles.line}>address: {short(walletAddress)}</Text>
      {walletError && <Text style={styles.error}>error: {walletError}</Text>}
    </View>
  );
}

function short(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 6,
    padding: 6,
    zIndex: 9999,
  },
  line: {
    color: "#A0D8FF",
    fontSize: 10,
    fontFamily: "monospace",
  },
  error: {
    color: "#FFD2D2",
    fontSize: 10,
    fontFamily: "monospace",
    maxWidth: 220,
  },
});
