import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import Button from "@/components/Button";
import Toast from "@/components/Toast";
import Images from "@/Images";
import State from "@/state";
import { useSui } from "@/context/SuiContext";
import { LEADERBOARD_ID, DELEGATE_REGISTRY_ID } from "@/sui/contracts";
import { scoreShareUrl, scoreShareText, SHARE_SITE_URL } from "@/utils/twitterShare";
import { txExplorerUrl } from "@/utils/explorer";

interface Props {
  style?: any;
  score: number;
  showSettings: () => void;
  setGameState: (state: any) => void;
  onShowLeaderboard: () => void;
}

const btnStyle  = { width: 60, height: 48 };
const btnStyleNarrow  = { width: 46, height: 40 };

export default function Footer({
  style,
  score,
  showSettings,
  setGameState,
  onShowLeaderboard,
}: Props) {
  const {
    walletAddress,
    signAndExecute,
    walletError,
    clearWalletError,
    submittedScore,
    setSubmittedScore,
  } = useSui();
  const submitted = submittedScore === score;
  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 380;
  const btnImageStyle = isNarrow ? btnStyleNarrow : btnStyle;
  // Fixed, non-stretching slots so the row spaces the buttons evenly (via
  // space-evenly) and fits a single row on narrow/mobile widths instead of
  // each button flex-growing or wrapping.
  const btnSlot = { flexGrow: 0, flexShrink: 0, ...btnImageStyle };
  const [submitting, setSubmitting] = useState(false);
  const [savedDigest, setSavedDigest] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Generic share sheet (distinct from the X-specific button below): native
  // OS share sheet on mobile, Web Share API where supported, and a clipboard
  // copy as the universal fallback (desktop browsers mostly lack Web Share).
  const onShare = async () => {
    const text = scoreShareText(score, walletAddress);
    if (Platform.OS !== "web") {
      try {
        await Share.share({ message: `${text}\n\n${SHARE_SITE_URL}` });
      } catch {}
      return;
    }
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (nav?.share) {
      try {
        await nav.share({ text, url: SHARE_SITE_URL });
        return;
      } catch {
        // user cancelled or share failed -- fall through to clipboard
      }
    }
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(`${text}\n\n${SHARE_SITE_URL}`);
        setLinkCopied(true);
      } catch {}
    }
  };

  useEffect(() => {
    if (walletAddress && score > 0 && !submitted && !submitting) {
      submitScore();
    }
  }, [walletAddress, score, submitted, submitting]);

  const submitScore = async () => {
    if (submitted || submitting || !walletAddress) return;
    setSubmitting(true);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "leaderboard",
        function: "submit_score",
        args: [
          { kind: "object", id: LEADERBOARD_ID },
          { kind: "object", id: DELEGATE_REGISTRY_ID },
          { kind: "pure", type: "u64", value: score },
        ],
      });
      if (result?.digest) {
        setSubmittedScore(score);
        setSavedDigest(result.digest);
      }
    } catch (e) {
      console.warn("Score submit failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {submitting && (
        <View style={styles.statusRow}>
          <ActivityIndicator color="#3B9FE8" size="small" />
          <Text style={styles.statusText}>Saving score on-chain…</Text>
        </View>
      )}
      <Toast
        visible={!!savedDigest}
        message="Score saved on-chain"
        linkLabel="View transaction"
        linkUrl={savedDigest ? txExplorerUrl(savedDigest) : undefined}
        onHide={() => setSavedDigest(null)}
      />
      <Toast
        visible={linkCopied}
        message="Share text copied to clipboard"
        onHide={() => setLinkCopied(false)}
      />
      {walletError && <Text style={styles.errorText}>{walletError}</Text>}
      <View style={[styles.container, style]}>
      {/* Settings */}
      <Button
        style={btnSlot}
        source={Images.button.settings}
        imageStyle={btnImageStyle}
        onPress={showSettings}
      />

      {/* Leaderboard */}
      <Button
        style={btnSlot}
        source={Images.button.rank}
        imageStyle={btnImageStyle}
        onPress={onShowLeaderboard}
      />

      {/* Home — back to the title screen. Score still auto-saves above. */}
      <Button
        style={btnSlot}
        source={Images.button.home}
        imageStyle={btnImageStyle}
        onPress={() => setGameState(State.Game.none)}
      />

      {/* Play Again — refresh icon reads as "restart", not "start" */}
      <Button
        style={btnSlot}
        source={Images.button.refresh}
        imageStyle={btnImageStyle}
        onPress={() => setGameState(State.Game.none)}
      />

      {/* Twitter / X share */}
      <Button
        style={btnSlot}
        source={Images.button.social}
        imageStyle={btnImageStyle}
        onPress={() => Linking.openURL(scoreShareUrl(score, walletAddress))}
      />

      {/* Generic share sheet / clipboard copy */}
      <Button
        style={btnSlot}
        source={Images.button.share}
        imageStyle={btnImageStyle}
        onPress={onShare}
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "space-evenly",
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  errorText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFD2D2",
    textAlign: "center",
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  statusText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#A0D8FF",
    textAlign: "center",
    marginBottom: 4,
  },
});
