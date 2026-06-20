import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import Button from "@/components/Button";
import Carousel from "@/components/CharacterSelect/Carousel";
import Images from "@/Images";
import GameContext from "@/context/GameContext";
import { useSui } from "@/context/SuiContext";
import { LEADERBOARD_ID, MINT_REGISTRY_ID, DELEGATE_REGISTRY_ID } from "@/sui/contracts";

const CHARACTERS = [
  { id: "frostie",  tier: "COMMON",    unlockScore: 0,   unlockHint: null },
  { id: "blizzard", tier: "RARE",      unlockScore: 100, unlockHint: "Score 100 to unlock" },
  { id: "glacier",  tier: "LEGENDARY", unlockScore: 500, unlockHint: "Score 500 to unlock" },
];

const TIER_COLORS: Record<string, string> = {
  COMMON:    "#87C6FF",
  RARE:      "#3B9FE8",
  LEGENDARY: "#B8DEFF",
};

interface Props {
  onDone: () => void;
  walletHighestScore: number;
}

// Square tile size matching the other PNG buttons
const arrowImageStyle = { width: 60, height: 48 };
const playImageStyle  = { width: 90, height: 48 };
// Keep the play button from flex-growing next to the text CTA.
const playSlot = { flexGrow: 0, flexShrink: 0, width: 110, height: 48 };

// Pixel-styled text button used for the MINT / SELECT call-to-action.
function TextButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.cta, disabled && styles.ctaDisabled]}
    >
      <Text style={styles.ctaText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MintNFTScreen({ onDone, walletHighestScore }: Props) {
  const { signAndExecute, ownedYetiTiers, ownedYetiLoading, refreshOwnedTiers, walletError, clearWalletError } = useSui();
  const { character, setCharacter } = useContext(GameContext);
  const carouselRef = useRef<Carousel>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const current   = CHARACTERS[currentIndex];
  const locked    = walletHighestScore < current.unlockScore;
  const owned     = !!ownedYetiTiers[current.id];
  const isEquipped = character === current.id;
  const canPlay   = !!ownedYetiTiers[character];
  const tierColor = TIER_COLORS[current.tier];

  const canGoLeft  = currentIndex > 0;
  const canGoRight = currentIndex < CHARACTERS.length - 1;

  const mintNFT = async () => {
    if (minting || locked || owned) return;
    setMinting(true);
    setMintError(null);
    clearWalletError();
    try {
      const result = await signAndExecute({
        module: "yeti_nft",
        function: `mint_${current.id}`,
        args:
          current.id === "frostie"
            ? [
                { kind: "object", id: MINT_REGISTRY_ID },
                { kind: "object", id: DELEGATE_REGISTRY_ID },
              ]
            : [
                { kind: "object", id: MINT_REGISTRY_ID },
                { kind: "object", id: LEADERBOARD_ID },
                { kind: "object", id: DELEGATE_REGISTRY_ID },
              ],
      });
      if (result?.digest) {
        await refreshOwnedTiers();
        setCharacter(current.id);
      } else {
        setMintError("Mint failed — check your wallet and try again.");
      }
    } catch (e) {
      console.warn("Mint failed", e);
      setMintError("Mint failed — check your wallet and try again.");
    } finally {
      setMinting(false);
    }
  };

  const select = () => setCharacter(current.id);

  // The primary call-to-action: mint when the tier is unlocked but not yet
  // owned, otherwise select it. Shared by the on-screen button and Enter.
  const primaryAction = () => {
    if (locked || minting) return;
    if (!owned) mintNFT();
    else select();
  };

  // Keyboard support on web: arrow keys move the carousel (in addition to the
  // on-screen arrows) and Enter triggers the primary action. Re-registered
  // when the relevant state changes so the handler never sees stale values.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        carouselRef.current?.prev();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        carouselRef.current?.next();
      } else if (e.code === "Enter") {
        e.preventDefault();
        primaryAction();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, owned, locked, minting]);

  return (
    <View style={styles.container}>
      {/* ---- Carousel + side pixel-tile arrows ---- */}
      <View style={styles.carouselRow}>
        {/* Left arrow — same back PNG tile, normal orientation */}
        <View style={[styles.arrowWrap, !canGoLeft && styles.arrowWrapOff]}>
          <Button
            source={Images.button.back}
            imageStyle={arrowImageStyle}
            onPress={() => canGoLeft && carouselRef.current?.prev()}
          />
        </View>

        <View style={styles.carouselWrap}>
          <Carousel
            ref={carouselRef}
            onCurrentIndexChange={(i) => {
              setCurrentIndex(i);
              setMintError(null);
            }}
          />
        </View>

        {/* Right arrow — same back PNG tile, flipped 180° */}
        <View style={[styles.arrowWrap, styles.arrowWrapRight, !canGoRight && styles.arrowWrapOff]}>
          <Button
            source={Images.button.back}
            imageStyle={[arrowImageStyle, styles.flipped]}
            onPress={() => canGoRight && carouselRef.current?.next()}
          />
        </View>
      </View>

      {/* ---- Tier + lock / ready state ---- */}
      <View style={styles.infoPanel}>
        <Text style={[styles.tierLabel, { color: tierColor }]}>
          {current.tier}
        </Text>

        {locked ? (
          <View style={styles.stateRow}>
            <Feather name="lock" size={12} color="#1E6FBF" />
            <Text style={styles.lockText}>{current.unlockHint}</Text>
          </View>
        ) : isEquipped ? (
          <View style={styles.stateRow}>
            <Feather name="check-circle" size={12} color="#87C6FF" />
            <Text style={styles.mintedText}>Selected</Text>
          </View>
        ) : owned ? (
          <Text style={styles.availableText}>Owned — tap select</Text>
        ) : (
          <Text style={styles.availableText}>Ready to mint</Text>
        )}

        {(minting || ownedYetiLoading) && (
          <ActivityIndicator color="#3B9FE8" size="small" style={{ marginTop: 8 }} />
        )}

        {(walletError || mintError) && (
          <Text style={styles.errorText}>{walletError || mintError}</Text>
        )}
      </View>

      {/* ---- Bottom action buttons ---- */}
      <View style={styles.bottomRow}>
        {!locked && !owned && (
          <TextButton
            label={minting ? "MINTING…" : "MINT"}
            onPress={mintNFT}
            disabled={minting}
          />
        )}

        {!locked && owned && !isEquipped && (
          <TextButton label="SELECT" onPress={select} />
        )}

        {/* Play — only ever available once the equipped Yeti is actually
            owned on-chain. No mint, no play. */}
        {canPlay && (
          <Button
            style={playSlot}
            source={Images.button.long_play}
            imageStyle={playImageStyle}
            onPress={onDone}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    backgroundColor: "rgba(10, 22, 40, 0.92)",
  },
  carouselRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  arrowWrap: {
    // Same fixed width as the button PNG so it never overlaps the carousel
    width: 68,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 10,
  },
  arrowWrapRight: {
    // Mirror wrapper has no extra styles — flipping is on the image only
  },
  arrowWrapOff: {
    opacity: 0.3,
    pointerEvents: "none",
  },
  flipped: {
    // Rotate the back-arrow PNG to point right
    transform: [{ rotate: "180deg" }],
  },
  carouselWrap: {
    flex: 1,
  },
  infoPanel: {
    alignItems: "center",
    paddingVertical: 12,
  },
  tierLabel: {
    fontFamily: "retro",
    fontSize: 13,
    letterSpacing: 3,
    marginBottom: 8,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lockText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#1E6FBF",
    marginLeft: 6,
  },
  mintedText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#87C6FF",
    marginLeft: 6,
  },
  availableText: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#3B9FE8",
  },
  errorText: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#FF6B6B",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 260,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cta: {
    minWidth: 120,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 8,
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
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontFamily: "retro",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 2,
  },
});
