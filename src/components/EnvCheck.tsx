import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { findMissingEnvVars } from "@/sui/contracts";

interface Props {
  children: React.ReactNode;
}

// Catches a missing EXPO_PUBLIC_* contract ID at startup instead of letting
// it fail deep inside a Move call once the player is already mid-game.
export default function EnvCheck({ children }: Props) {
  const missing = findMissingEnvVars();

  if (missing.length > 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Configuration Error</Text>
        <Text style={styles.body}>
          Missing required environment variable{missing.length > 1 ? "s" : ""}:
        </Text>
        {missing.map((name) => (
          <Text key={name} style={styles.varName}>
            {name}
          </Text>
        ))}
        <Text style={styles.hint}>
          Set these in .env (local) or your Vercel project settings, then rebuild.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#FFD2D2",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  body: {
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  varName: {
    color: "#FFD2D2",
    fontSize: 13,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  hint: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
    maxWidth: 320,
  },
});
