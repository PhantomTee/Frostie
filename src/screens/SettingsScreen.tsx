import React, { useState } from "react";
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSui } from "@/context/SuiContext";
import AudioManager from "@/AudioManager";
import GameContext from "@/context/GameContext";

interface RowProps {
  label: string;
  description?: string;
  value?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
  icon?: keyof typeof Feather.glyphMap;
}

function SettingRow({ label, description, value, onToggle, onPress, danger, icon }: RowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && onToggle === undefined}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {icon && (
        <View style={styles.rowIcon}>
          <Feather name={icon} size={14} color={danger ? "#FF6B6B" : "#3B9FE8"} />
        </View>
      )}
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
          {label}
        </Text>
        {description ? (
          <Text style={styles.rowDesc}>{description}</Text>
        ) : null}
      </View>
      {onToggle !== undefined && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: "#0D2347", true: "#3B9FE8" }}
          thumbColor="#FFFFFF"
        />
      )}
      {onPress && onToggle === undefined && (
        <Feather
          name="chevron-right"
          size={16}
          color={danger ? "#FF6B6B" : "#3B9FE8"}
        />
      )}
    </TouchableOpacity>
  );
}

interface Props {
  goBack: () => void;
  onOpenLeaderboard: () => void;
  onOpenMint: () => void;
}

export default function SettingsScreen({ goBack, onOpenLeaderboard, onOpenMint }: Props) {
  const { walletAddress, disconnect } = useSui();
  const { reduceMotion, setReduceMotion } = React.useContext(GameContext);
  // Reads AudioManager's current value on open so this stays in sync with
  // the in-game HUD mute toggle, which writes straight to the same module.
  const [soundOn, setSoundOn] = useState(!AudioManager.isMuted());
  const [shadowsOn, setShadowsOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);

  const toggleSound = (val: boolean) => {
    AudioManager.setMuted(!val);
    setSoundOn(val);
  };

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-4)}`
    : "Not connected";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#3B9FE8" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Wallet */}
        <Text style={styles.sectionTitle}>WALLET</Text>
        <View style={styles.section}>
          <SettingRow
            label="Connected Wallet"
            description={shortAddr}
            icon="link"
          />
          <SettingRow
            label="Mint Yeti NFT"
            description="Get your Yeti character NFT"
            onPress={onOpenMint}
            icon="cpu"
          />
          <SettingRow
            label="Leaderboard"
            description="View 24h and 7d rankings"
            onPress={onOpenLeaderboard}
            icon="bar-chart-2"
          />
          {walletAddress && (
            <SettingRow
              label="Disconnect Wallet"
              onPress={disconnect}
              danger
              icon="log-out"
            />
          )}
        </View>

        {/* Game */}
        <Text style={styles.sectionTitle}>GAME</Text>
        <View style={styles.section}>
          <SettingRow
            label="Sound"
            value={soundOn}
            onToggle={toggleSound}
            icon="volume-2"
          />
          <SettingRow
            label="Shadows"
            description="Disable for better performance"
            value={shadowsOn}
            onToggle={setShadowsOn}
            icon="sun"
          />
          <SettingRow
            label="Haptics"
            value={hapticOn}
            onToggle={setHapticOn}
            icon="activity"
          />
          <SettingRow
            label="Reduce Motion"
            description="Simplify character-select animations"
            value={reduceMotion}
            onToggle={setReduceMotion}
            icon="minimize-2"
          />
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.section}>
          <SettingRow label="Version" description="0.1.0, Sui Testnet" icon="info" />
          <SettingRow
            label="Built on Sui"
            description="Your score is recorded on-chain after every run"
            icon="layers"
          />
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
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
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#0A3D6B",
    letterSpacing: 3,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    backgroundColor: "#2A8FD8",
    borderRadius: 10,
    overflow: "hidden",
    borderBottomWidth: 5,
    borderBottomColor: "#1A5FA8",
    borderRightWidth: 3,
    borderRightColor: "#1A5FA8",
    borderTopWidth: 2,
    borderTopColor: "#5BB8FF",
    borderLeftWidth: 2,
    borderLeftColor: "#5BB8FF",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#1A5FA8",
  },
  rowIcon: {
    width: 28,
    alignItems: "center",
    marginRight: 4,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontFamily: "retro",
    fontSize: 12,
    color: "#FFFFFF",
  },
  rowLabelDanger: {
    color: "#FF6B6B",
  },
  rowDesc: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#FFFFFF",
    opacity: 0.8,
    marginTop: 3,
  },
});
