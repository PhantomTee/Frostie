import React, { useEffect, useRef } from "react";
import { Animated, Linking, StyleSheet, Text, TouchableOpacity } from "react-native";

interface Props {
  visible: boolean;
  message: string;
  linkLabel?: string;
  linkUrl?: string;
  onHide: () => void;
  duration?: number;
}

export default function Toast({
  visible,
  message,
  linkLabel,
  linkUrl,
  onHide,
  duration = 4000,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        onHide
      );
    }, duration);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="box-none">
      <Text style={styles.message}>{message}</Text>
      {linkUrl && (
        <TouchableOpacity onPress={() => Linking.openURL(linkUrl)}>
          <Text style={styles.link}>{linkLabel ?? "View transaction"}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: 6,
  },
  message: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#FFFFFF",
    textAlign: "center",
  },
  link: {
    fontFamily: "retro",
    fontSize: 10,
    color: "#7FD4FF",
    textAlign: "center",
    marginTop: 4,
    textDecorationLine: "underline",
  },
});
