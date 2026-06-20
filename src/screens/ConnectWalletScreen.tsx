import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSui } from "@/context/SuiContext";
import CharacterCard from "@/components/CharacterSelect/CharacterCard";

interface Props {
  onConnected: () => void;
}

export default function ConnectWalletScreen({ onConnected }: Props) {
  const { walletState, connect, availableWallets } = useSui();
  const [failed, setFailed] = useState(false);
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;
  const yetiSize = isNarrow ? 110 : 150;

  const handleConnect = async (walletName?: string) => {
    setFailed(false);
    const connected = await connect(walletName);
    if (connected) {
      onConnected();
    } else {
      setFailed(true);
    }
  };

  const showPicker = availableWallets.length > 1;

  return (
    <View style={styles.overlay}>
      {/* Big pixel-art tile — same look as the game's button tiles */}
      <View style={[styles.tile, isNarrow && styles.tileNarrow]}>
        {/* Spinning yeti */}
        <View style={[styles.yetiWrap, { width: yetiSize, height: yetiSize }]}>
          <CharacterCard id="frostie" style={{ width: yetiSize, height: yetiSize }} />
        </View>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.title, isNarrow && styles.titleNarrow]}
        >
          YETI IN DA CITI
        </Text>
        <Text style={styles.subtitle}>Hop on-chain. Every move counts.</Text>

        <View style={styles.divider} />

        <Text style={styles.body}>
          Connect your Sui wallet to mint your Yeti NFT and start playing.
          Your score gets recorded on-chain after every run.
        </Text>

        {/* Connect button(s) — white tile(s) on blue, inverted style.
            More than one Sui wallet installed: let the player pick which
            one, instead of silently preferring any particular wallet. */}
        {showPicker ? (
          <View style={{ width: "100%" }}>
            {availableWallets.map((w) => (
              <TouchableOpacity
                key={w.name}
                style={[styles.btn, walletState === "connecting" && styles.btnDisabled]}
                onPress={() => handleConnect(w.name)}
                disabled={walletState === "connecting"}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btn, walletState === "connecting" && styles.btnDisabled]}
            onPress={() => handleConnect()}
            disabled={walletState === "connecting"}
            activeOpacity={0.85}
          >
            {walletState === "connecting" ? (
              <ActivityIndicator color="#1E6FBF" />
            ) : (
              <Text style={styles.btnText}>
                {availableWallets[0] ? `Connect ${availableWallets[0].name}` : "Connect Wallet"}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>
          Supports Sui Wallet, Suiet, Martian and more
        </Text>

        {failed && (
          <Text style={styles.errorText}>
            Couldn't connect — make sure a Sui wallet is installed and try again.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(59, 159, 232, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  // Pixel-art tile: sky blue face + hard darker-blue pixel shadow on bottom/right
  tile: {
    backgroundColor: "#3B9FE8",
    borderRadius: 10,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    maxWidth: 500,
    width: "100%",
    // Pixel shadow — darker blue, no blur, offset down-right like the game tiles
    borderBottomWidth: 6,
    borderBottomColor: "#1A5FA8",
    borderRightWidth: 4,
    borderRightColor: "#1A5FA8",
    borderTopWidth: 2,
    borderTopColor: "#5BB8FF",
    borderLeftWidth: 2,
    borderLeftColor: "#5BB8FF",
  },
  tileNarrow: {
    paddingVertical: 24,
    paddingHorizontal: 12,
  },

  yetiWrap: {
    overflow: "hidden",
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "#1A5FA8",
    backgroundColor: "#2A8FD8",
  },

  title: {
    fontFamily: "retro",
    fontSize: 24,
    color: "#FFFFFF",
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: "center",
  },
  titleNarrow: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 1,
    marginBottom: 24,
    opacity: 0.85,
  },
  divider: {
    width: "80%",
    height: 4,
    backgroundColor: "#2A8FD8",
    marginBottom: 24,
    borderRadius: 2,
    borderTopWidth: 1,
    borderTopColor: "#1A5FA8",
    borderBottomWidth: 1,
    borderBottomColor: "#5BB8FF",
  },
  body: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
    maxWidth: 300,
    opacity: 0.9,
  },

  // White tile button — same pixel-art border treatment, inverted colors
  btn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 5,
    borderBottomColor: "#C8E0F0",
    borderRightWidth: 3,
    borderRightColor: "#C8E0F0",
    borderTopWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftWidth: 2,
    borderLeftColor: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontFamily: "retro",
    fontSize: 13,
    color: "#1E6FBF",
    letterSpacing: 2,
  },
  hint: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.6,
  },
  errorText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFD2D2",
    textAlign: "center",
    marginTop: 16,
  },
});
