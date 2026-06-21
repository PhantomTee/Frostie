import React, { Component } from "react";
import { LayoutAnimation, Animated, StyleSheet, View } from "react-native";

import Images from "@/Images";
import Button from "../Button";
import CharacterPicker from "../CharacterPicker";
import HoverTooltip from "../HoverTooltip";

const imageStyle = { width: 60, height: 48 };

export default function Footer(props) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const collapse = React.useCallback(
    (onPress) => () => {
      setMenuOpen(false);
      onPress();
    },
    [setMenuOpen]
  );

  const renderMenu = React.useMemo(() => {
    return (
      <View style={{ flexDirection: "column" }}>
        <HoverTooltip label="Leaderboard">
          <Button
            onPress={collapse(props.onShowLeaderboard)}
            style={[{ marginBottom: 8 }, imageStyle]}
            imageStyle={imageStyle}
            source={Images.button.rank}
          />
        </HoverTooltip>
        <HoverTooltip label="Challenges">
          <Button
            onPress={collapse(props.onChallenges)}
            style={[{ marginBottom: 8 }, imageStyle]}
            imageStyle={imageStyle}
            source={Images.button.controller}
          />
        </HoverTooltip>
        <HoverTooltip label="Shop">
          <Button
            onPress={collapse(props.onShop)}
            style={[{ marginBottom: 8 }, imageStyle]}
            imageStyle={imageStyle}
            source={Images.button.shop}
          />
        </HoverTooltip>
      </View>
    );
  }, [collapse]);

  return (
    <Animated.View style={[styles.container, props.style]}>
      <HoverTooltip label="Character">
        <Button
          style={{ maxHeight: 48 }}
          onPress={props.onCharacterSelect}
          imageStyle={imageStyle}
          source={Images.button.character}
        />
      </HoverTooltip>

      {false && <CharacterPicker />}

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: "column-reverse" }}>
        <HoverTooltip label="Menu">
          <Button
            onPress={() => {
              setMenuOpen(!menuOpen);
            }}
            style={[{ opacity: menuOpen ? 0.8 : 1.0 }, imageStyle]}
            imageStyle={imageStyle}
            source={Images.button.menu}
          />
        </HoverTooltip>

        {menuOpen && renderMenu}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    justifyContent: "center",
    flexDirection: "row",
    // maxHeight: 48,
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#34495e",
  },
  button: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
