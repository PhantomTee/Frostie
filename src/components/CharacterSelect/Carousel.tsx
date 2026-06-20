import React, { Component } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";

import Characters from "@/Characters";
import GameContext from "@/context/GameContext";
import ViewPager from "../ViewPager";
import CharacterCard from "./CharacterCard";

const DESKTOP_WIDTH = 150;
const AnimatedText = Animated.createAnimatedComponent(Text);

const keys = Object.keys(Characters);
export default class Carousel extends Component {
  static contextType = GameContext;

  scroll = new Animated.Value(0);

  state = {
    index: 0,
    windowWidth: Dimensions.get("window").width,
  };

  componentDidMount() {
    this.dimensionsSub = Dimensions.addEventListener("change", ({ window }) => {
      this.setState({ windowWidth: window.width });
    });
  }

  componentWillUnmount() {
    this.dimensionsSub?.remove?.();
  }

  // Shrinks the card slot on narrow phones instead of using a fixed desktop
  // size that would crowd or clip the side-card peek.
  get itemWidth() {
    return this.state.windowWidth < 400
      ? Math.max(100, Math.round(this.state.windowWidth * 0.38))
      : DESKTOP_WIDTH;
  }

  _goToIndex = (newIndex: number) => {
    const width = this.itemWidth;
    const clamped = Math.max(0, Math.min(newIndex, keys.length - 1));
    // Animate the scroll value that drives scale/translate on the cards
    Animated.timing(this.scroll, {
      toValue: clamped * width,
      duration: 300,
      useNativeDriver: false,
    }).start();
    // Also try to scroll the underlying FlatList (may silently fail on web)
    try {
      if (this.viewPager) this.viewPager.scrollToIndex({ index: clamped, animated: true });
    } catch (_) {}
    // Always update state and fire the callback — selection must register
    this.setState({ index: clamped }, () => {
      if (this.props.onCurrentIndexChange) {
        this.props.onCurrentIndexChange(clamped);
      }
    });
  };

  next = () => this._goToIndex(this.state.index + 1);
  prev = () => this._goToIndex(this.state.index - 1);

  renderItem = ({ item, index }) => {
    const width = this.itemWidth;
    const inset = width * 0.75;
    const offset = index * width;
    const inputRange = [offset - width, offset, offset + width];

    // Reduce Motion (Settings): skip the scale/translate/opacity interpolations
    // -- just show the selected card at full size and hide the rest, with no
    // animated peek/fan effect, for users sensitive to motion or on weak GPUs.
    if ((this.context as any)?.reduceMotion) {
      const isSelected = index === this.state.index;
      return (
        <View
          style={{
            width,
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            opacity: isSelected ? 1 : 0,
          }}
        >
          <CharacterCard opacity={1} {...Characters[item]} />
        </View>
      );
    }

    return (
      <Animated.View
        style={{
          // Explicit slot width (not flex:1, which lets the cell size to the
          // over-wide card) so alignItems can center the card on the slot;
          // otherwise the card is left-aligned and pushed right of center.
          width,
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          // CharacterCard renders a fixed 200x200 box, wider than this slot
          // on narrow/mobile widths -- without clipping, the oversized card
          // bleeds into and overlaps the neighboring cards.
          overflow: "hidden",
          transform: [
            {
              scale: this.scroll.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: "clamp",
              }),
            },
            {
              translateX: this.scroll.interpolate({
                inputRange: [
                  offset - width * 2,
                  offset - width,
                  offset,
                  offset + width,
                  offset + width * 2,
                ],
                outputRange: [-inset * 3, -inset, 0, inset, inset * 3],
              }),
            },
          ],
        }}
      >
        <CharacterCard
          opacity={this.scroll.interpolate({
            inputRange: [
              index * width - width,
              index * width,
              index * width + width,
            ],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          })}
          {...Characters[item]}
        />
      </Animated.View>
    );
  };

  render() {
    const { index, windowWidth } = this.state;
    const width = this.itemWidth;

    let key = keys[index];
    let character;

    if (key) {
      character = Characters[key].name;
    }

    return (
      <View style={{ flex: 1 }}>
        <AnimatedText
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.text, windowWidth < 400 && styles.textNarrow]}
        >
          {character || "null l0l"}
        </AnimatedText>
        <ViewPager
          ref={(ref) => (this.viewPager = ref)}
          style={styles.container}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Don't override padding from the full window width — the carousel
          // is inset by the side arrows, so ViewPager must center against its
          // own measured width (it does this in its contentContainerStyle).
          snapToInterval={width}
          onMomentumScrollEnd={this.momentumScrollEnd}
          onScroll={({ value }) => {
            if (!this.viewPager) {
              return;
            }
            const { index } = this.viewPager;
            if (this.state.index !== index) {
              this.setState({ index }, () => {
                if (this.props.onCurrentIndexChange) {
                  this.props.onCurrentIndexChange(index);
                }
              });
            }
          }}
          scroll={this.scroll}
          keyExtractor={(item, index) => `-${index}`}
          data={keys}
          size={width}
          renderItem={this.renderItem}
          scrollEventThrottle={1}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    opacity: 1,
    fontFamily: "retro",
    backgroundColor: "transparent",
    textAlign: "center",
    color: "white",
    fontSize: 36,
  },
  textNarrow: {
    fontSize: 26,
  },
});
