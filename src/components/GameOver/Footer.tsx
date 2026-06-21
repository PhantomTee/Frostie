import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";

import Button from "@/components/Button";
import Toast from "@/components/Toast";
import Images from "@/Images";
import State from "@/state";
import { useSui } from "@/context/SuiContext";
import { LEADERBOARD_ID, DELEGATE_REGISTRY_ID, CHALLENGE_CONFIG_ID, CLOCK_ID } from "@/sui/contracts";
import { scoreShareText, SHARE_SITE_URL } from "@/utils/twitterShare";
import { txExplorerUrl } from "@/utils/explorer";
import { suiClient, getSuiBalanceMist } from "@/sui/client";
import { uploadReplayBlob } from "@/utils/walrus";

// Leaves room for gas so a stake that exactly equals the wallet's balance
// doesn't fail at sign time with a confusing insufficient-gas error.
const GAS_BUFFER_MIST = 10_000_000;

// While a revive is still affordable, score submission waits this long
// before firing, so a player who taps REVIVE doesn't have a wallet popup
// already in flight for a score that's about to keep climbing.
const REVIVE_GRACE_SECONDS = 5;

interface Props {
  style?: any;
  score: number;
  inputLog?: Array<{ d: string; t: number }>;
  setGameState: (state: any) => void;
  onShowLeaderboard: () => void;
  onShowChallenges: () => void;
  canRevive?: boolean;
}

const btnStyle  = { width: 60, height: 48 };
const btnStyleNarrow  = { width: 46, height: 40 };

export default function Footer({
  style,
  score,
  inputLog,
  setGameState,
  onShowLeaderboard,
  onShowChallenges,
  canRevive,
}: Props) {
  const {
    walletAddress,
    signAndExecute,
    walletError,
    clearWalletError,
    submittedScore,
    setSubmittedScore,
    pendingChallenge,
    setPendingChallenge,
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
  // Id of the RunScore receipt minted alongside this run's leaderboard
  // submit, set once that PTB lands. Backs the optional "Create Challenge"
  // step below -- only a receipt from record_run can become a market's
  // target score, never a raw number typed into this screen.
  const [runScoreId, setRunScoreId] = useState<string | null>(null);
  const [stakeInput, setStakeInput] = useState("1");
  const [creatingMarket, setCreatingMarket] = useState(false);
  const [marketDigest, setMarketDigest] = useState<string | null>(null);
  const [marketCreated, setMarketCreated] = useState(false);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [attemptResult, setAttemptResult] = useState<"won" | "missed" | null>(null);
  const [attemptDigest, setAttemptDigest] = useState<string | null>(null);
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [reviveGraceLeft, setReviveGraceLeft] = useState<number | null>(null);
  const [showStakeModal, setShowStakeModal] = useState(false);

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
    if (!walletAddress || score <= 0 || submitted || submitting) return;

    if (!canRevive) {
      submitScore();
      return;
    }

    setReviveGraceLeft(REVIVE_GRACE_SECONDS);
    const interval = setInterval(() => {
      setReviveGraceLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    const timeout = setTimeout(() => {
      submitScore();
    }, REVIVE_GRACE_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setReviveGraceLeft(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, score, submitted, submitting, canRevive]);

  const submitScore = async () => {
    if (submitted || submitting || !walletAddress) return;
    setSubmitting(true);
    clearWalletError();
    try {
      // Best-effort: a failed/slow upload shouldn't block saving the score,
      // so record_run just gets an empty replay_blob_id in that case.
      let replayBlobId = "";
      if (inputLog && inputLog.length > 0) {
        replayBlobId = (await uploadReplayBlob(JSON.stringify(inputLog))) ?? "";
      }

      // One signature, two calls: the leaderboard best-score update and a
      // fresh RunScore receipt for *this* run, so a challenge market can
      // later be created off a score that's provably backed by an
      // on-chain-recorded run rather than a client-supplied number.
      const result = await signAndExecute([
        {
          module: "leaderboard",
          function: "submit_score",
          args: [
            { kind: "object", id: LEADERBOARD_ID },
            { kind: "object", id: DELEGATE_REGISTRY_ID },
            { kind: "pure", type: "u64", value: score },
          ],
        },
        {
          module: "run_score",
          function: "record_run",
          args: [
            { kind: "pure", type: "u64", value: score },
            { kind: "pure", type: "string", value: replayBlobId },
            { kind: "object", id: CLOCK_ID },
          ],
        },
      ]);
      if (result?.digest) {
        setSubmittedScore(score);
        setSavedDigest(result.digest);
        const minted = result.objectChanges?.find(
          (c: any) => c.type === "created" && c.objectType?.endsWith("::run_score::RunScore")
        );
        if (minted) setRunScoreId(minted.objectId);
      }
    } catch (e) {
      console.warn("Score submit failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  const createMarket = async () => {
    if (!runScoreId || creatingMarket || marketCreated || !walletAddress) return;
    const stakeSui = parseFloat(stakeInput);
    if (!stakeSui || stakeSui <= 0) return;
    const stakeMist = Math.round(stakeSui * 1_000_000_000);
    setStakeError(null);
    setCreatingMarket(true);
    clearWalletError();
    try {
      const balance = await getSuiBalanceMist(walletAddress);
      if (stakeMist + GAS_BUFFER_MIST > balance) {
        setStakeError("Not enough SUI for that stake plus gas.");
        return;
      }
      const result = await signAndExecute({
        module: "challenge_market",
        function: "create_market",
        args: [
          { kind: "object", id: runScoreId },
          { kind: "splitCoin", amount: stakeMist },
          { kind: "object", id: CLOCK_ID },
        ],
      });
      if (result?.digest) {
        setMarketDigest(result.digest);
        setMarketCreated(true);
        setShowStakeModal(false);
      }
    } catch (e) {
      console.warn("Create market failed", e);
    } finally {
      setCreatingMarket(false);
    }
  };

  const cancelStakeModal = () => {
    if (creatingMarket) return;
    setShowStakeModal(false);
    setStakeError(null);
  };

  const submitAttempt = async () => {
    if (!runScoreId || !pendingChallenge || submittingAttempt) return;
    setSubmittingAttempt(true);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "challenge_market",
        function: "submit_attempt",
        args: [
          { kind: "object", id: pendingChallenge.marketId },
          { kind: "object", id: CHALLENGE_CONFIG_ID },
          { kind: "object", id: runScoreId },
          { kind: "object", id: CLOCK_ID },
        ],
      });
      if (result?.digest) {
        setAttemptDigest(result.digest);
        // submit_attempt is a silent no-op on a miss, so the only way to
        // tell win from miss is to read the market's settled/winner fields
        // back after the call lands.
        const market = await suiClient.getObject({
          id: pendingChallenge.marketId,
          options: { showContent: true },
        });
        const fields = (market.data?.content as any)?.fields;
        const won =
          fields?.settled === true &&
          fields?.winner?.toLowerCase?.() === walletAddress?.toLowerCase();
        setAttemptResult(won ? "won" : "missed");
        if (won) setPendingChallenge(null);
      }
    } catch (e) {
      console.warn("Submit attempt failed", e);
    } finally {
      setSubmittingAttempt(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {reviveGraceLeft !== null && reviveGraceLeft > 0 && (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            Saving score in {reviveGraceLeft}s, revive to cancel
          </Text>
        </View>
      )}
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
      <Toast
        visible={!!marketDigest}
        message="Challenge market created"
        linkLabel="View transaction"
        linkUrl={marketDigest ? txExplorerUrl(marketDigest) : undefined}
        onHide={() => setMarketDigest(null)}
      />
      <Toast
        visible={!!attemptDigest}
        message={
          attemptResult === "won"
            ? "You beat the target, payout sent!"
            : "Submitted, didn't beat the target this time"
        }
        linkLabel="View transaction"
        linkUrl={attemptDigest ? txExplorerUrl(attemptDigest) : undefined}
        onHide={() => {
          setAttemptDigest(null);
          setAttemptResult(null);
        }}
      />
      {walletError && <Text style={styles.errorText}>{walletError}</Text>}
      {runScoreId && pendingChallenge ? (
        <View style={styles.marketRow}>
          <Text style={styles.marketLabel}>You're in a challenge, submit this run?</Text>
          <TouchableOpacity
            style={[styles.createMarketBtn, submittingAttempt && styles.createMarketBtnDisabled]}
            onPress={submitAttempt}
            disabled={submittingAttempt}
          >
            {submittingAttempt ? (
              <ActivityIndicator color="#0D2347" size="small" />
            ) : (
              <Text style={styles.createMarketBtnText}>Submit Attempt</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : runScoreId && !marketCreated && (
        <View style={styles.marketRow}>
          <TouchableOpacity
            style={styles.wagerBtn}
            onPress={() => setShowStakeModal(true)}
          >
            <Text style={styles.createMarketBtnText}>Wager on This Score</Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal
        visible={showStakeModal}
        transparent
        animationType="fade"
        onRequestClose={cancelStakeModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableWithoutFeedback onPress={cancelStakeModal}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={cancelStakeModal}
              hitSlop={12}
            >
              <Text style={styles.modalCloseText}>X</Text>
            </TouchableOpacity>
            <Text style={styles.marketLabel}>Stake (SUI) to challenge this score:</Text>
            <View style={styles.marketControls}>
              <TextInput
                style={styles.stakeInput}
                value={stakeInput}
                onChangeText={(t) => {
                  setStakeInput(t);
                  setStakeError(null);
                }}
                keyboardType="decimal-pad"
                returnKeyType="done"
                editable={!creatingMarket}
              />
              <TouchableOpacity
                style={[styles.createMarketBtn, creatingMarket && styles.createMarketBtnDisabled]}
                onPress={createMarket}
                disabled={creatingMarket}
                hitSlop={6}
              >
                {creatingMarket ? (
                  <ActivityIndicator color="#0D2347" size="small" />
                ) : (
                  <Text style={styles.createMarketBtnText}>Create Challenge</Text>
                )}
              </TouchableOpacity>
            </View>
            {stakeError && <Text style={styles.errorText}>{stakeError}</Text>}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={cancelStakeModal}
              disabled={creatingMarket}
              hitSlop={10}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <View style={[styles.container, style]}>
      {/* Leaderboard */}
      <Button
        style={btnSlot}
        source={Images.button.rank}
        imageStyle={btnImageStyle}
        onPress={onShowLeaderboard}
      />

      {/* Home, back to the title screen. Score still auto-saves above. */}
      <Button
        style={btnSlot}
        source={Images.button.home}
        imageStyle={btnImageStyle}
        onPress={() => setGameState(State.Game.none)}
      />

      {/* Challenges, browse/join other players' score wagers */}
      <Button
        style={btnSlot}
        source={Images.button.controller}
        imageStyle={btnImageStyle}
        onPress={onShowChallenges}
      />

      {/* Single share action: native share sheet on mobile, Web Share API
          or clipboard copy on web (most desktop browsers lack Web Share) */}
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
  marketRow: {
    alignItems: "center",
    marginBottom: 6,
  },
  marketLabel: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#A0D8FF",
    textAlign: "center",
    marginBottom: 4,
  },
  marketControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stakeInput: {
    width: 72,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#0D2347",
    borderWidth: 1,
    borderColor: "#3B9FE8",
    color: "#FFFFFF",
    fontFamily: "retro",
    fontSize: 13,
    textAlign: "center",
  },
  createMarketBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  createMarketBtnDisabled: {
    opacity: 0.6,
  },
  createMarketBtnText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#0D2347",
  },
  wagerBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 15, 35, 0.75)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#1A4E8F",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#3B9FE8",
    padding: 20,
    paddingTop: 28,
    alignItems: "center",
  },
  modalCloseBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0D2347",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontFamily: "retro",
    fontSize: 11,
    color: "#FFFFFF",
  },
  modalCancelBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#A0D8FF",
  },
});
