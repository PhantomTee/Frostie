import React from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Hand from "@/components/HandCTA";
import Footer from "@/components/Home/Footer";
import GameContext from "@/context/GameContext";

let hasShownTitle = false;

function Screen(props) {
  const { setCharacter, character } = React.useContext(GameContext);
  const animation = new Animated.Value(0);

  React.useEffect(() => {
    function onKeyUp({ keyCode }) {
      // Space, up-arrow
      if ([32, 38].includes(keyCode)) {
        props.onPlay();
      }
    }

    window.addEventListener("keyup", onKeyUp, false);
    return () => {
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  React.useEffect(() => {
    if (hasShownTitle) {
      // Component remounts every time the player returns to the home
      // screen (e.g. via the game-over Home button), but `animation` is a
      // fresh Animated.Value(0) each time -- without this, the title would
      // stay parked off-screen since the one-time slide-in never replays.
      animation.setValue(1);
      return;
    }
    hasShownTitle = true;

    Animated.timing(animation, {
      useNativeDriver: process.env.EXPO_OS !== "web",
      toValue: 1,
      duration: 800,
      delay: 0,
    }).start();
  }, []);

  const { top, bottom, left, right } = useSafeAreaInsets();

  const animatedTitleStyle = {
    transform: [
      {
        translateX: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [-Dimensions.get("window").width, 0],
        }),
      },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [-100, 0],
        }),
      },
    ],
  };
  // console.log(props);
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: top,
          paddingBottom: bottom,
          paddingLeft: left,
          paddingRight: right,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1.0}
        style={[
          StyleSheet.absoluteFill,
          { justifyContent: "center", alignItems: "center" },
        ]}
        onPressIn={() => {
          Animated.timing(animation, {
            toValue: 0,
            duration: 400,
            useNativeDriver: process.env.EXPO_OS !== "web",
            easing: Easing.in(Easing.qubic),
            onComplete: ({ finished }) => {
              if (finished) {
                props.onPlay();
              }
            },
          }).start();
        }}
      >
        <Animated.Image
          source={require("../../assets/images/title.png")}
          style={[styles.title, animatedTitleStyle]}
        />

        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Best: {props.highscore ?? 0}</Text>
          <Text style={styles.statsText}>Runs: {props.gamesPlayed ?? 0}</Text>
          {(props.streak ?? 0) > 1 && (
            <Text style={styles.statsText}>🔥 {props.streak} day streak</Text>
          )}
        </View>

        <View
          style={{
            justifyContent: "center",
            alignItems: "stretch",
            position: "absolute",
            bottom: Math.max(bottom, 8),
            left: Math.max(left, 8),
            right: Math.max(right, 8),
          }}
        >
          <View style={{ height: 64, marginBottom: 48, alignItems: "center" }}>
            {/* {!__DEV__ && <Hand style={{ width: 36 }} />} */}
          </View>
          <Footer
            onCharacterSelect={() => {
              props.onShowCharacterSelect?.();
            }}
            onShop={() => props.onShop?.()}
            onChallenges={() => props.onChallenges?.()}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default Screen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  title: {
    resizeMode: "contain",
    maxWidth: 600,
    width: "80%",
    // Matches the source image's 800x464 ratio so it scales cleanly on
    // narrow screens instead of a fixed height distorting/clipping it.
    aspectRatio: 800 / 464,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    marginTop: 12,
  },
  statsText: {
    fontFamily: "retro",
    fontSize: 12,
    color: "#B8DEFF",
    backgroundColor: "transparent",
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#B8DEFF",
  },
});
