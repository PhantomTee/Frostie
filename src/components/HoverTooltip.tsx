import React, { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

interface Props {
  label: string;
  children: React.ReactNode;
}

// Hover-only label for icon-only buttons, web desktop only -- touch devices
// have no hover state, and native apps have no mouse to hover with.
export default function HoverTooltip({ label, children }: Props) {
  const [hovered, setHovered] = useState(false);

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View
      style={styles.wrap}
      // @ts-ignore -- web-only mouse events, passed through by react-native-web
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 6,
    backgroundColor: "#0D2347",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3B9FE8",
    // @ts-ignore -- web-only, stops the label wrapping to a second line
    whiteSpace: "nowrap",
  },
  tooltipText: {
    fontFamily: "retro",
    fontSize: 9,
    color: "#FFFFFF",
  },
});
