import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import Images from "@/Images";
import { swipeDirections } from "@/components/GestureView";

// On-screen WASD/D-pad for touch devices, mirroring the keyboard arrows so the
// game is playable without a swipe gesture or a physical keyboard. Reuses the
// existing pixel arrow art (back.png points left) rotated per direction.
const ROTATION: Record<string, string> = {
  [swipeDirections.SWIPE_UP]: "90deg",
  [swipeDirections.SWIPE_DOWN]: "-90deg",
  [swipeDirections.SWIPE_LEFT]: "0deg",
  [swipeDirections.SWIPE_RIGHT]: "180deg",
};

function DButton({
  direction,
  onPress,
}: {
  direction: string;
  onPress: (direction: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(direction)}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Image
        source={Images.button.back}
        style={[styles.arrow, { transform: [{ rotate: ROTATION[direction] }] }]}
      />
    </Pressable>
  );
}

export default function DPad({
  onPress,
}: {
  onPress: (direction: string) => void;
}) {
  const { SWIPE_UP, SWIPE_DOWN, SWIPE_LEFT, SWIPE_RIGHT } = swipeDirections;
  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.row}>
        <DButton direction={SWIPE_UP} onPress={onPress} />
      </View>
      <View style={styles.row}>
        <DButton direction={SWIPE_LEFT} onPress={onPress} />
        <View style={styles.spacer} />
        <DButton direction={SWIPE_RIGHT} onPress={onPress} />
      </View>
      <View style={styles.row}>
        <DButton direction={SWIPE_DOWN} onPress={onPress} />
      </View>
    </View>
  );
}

const SIZE = 52;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    alignItems: "center",
    opacity: 0.9,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: {
    width: SIZE,
    height: SIZE,
  },
  button: {
    width: SIZE,
    height: SIZE,
    margin: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.92 }],
  },
  arrow: {
    width: SIZE,
    height: SIZE,
    resizeMode: "contain",
  },
});
