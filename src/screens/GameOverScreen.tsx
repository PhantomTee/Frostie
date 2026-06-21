import React from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Banner from "@/components/GameOver/Banner";
import Footer from "@/components/GameOver/Footer";
import AudioManager from "@/AudioManager";
import Characters from "@/Characters";
import GameContext from "@/context/GameContext";

// import { setGameState } from '../src/actions/game';

//TODO: Make this dynamic
const banner = [
  {
    color: "#0D2347",
    title: "Play Again, Beat Your Score",
  },
  {
    color: "#1A4E8F",
    title: "Connect Wallet to Save Score",
  },
  {
    color: "#3B9FE8",
    title: "Collect Coins, Keep Hopping",
  },
];

// const AnimatedBanner = Animated.createAnimatedComponent(Banner);

function GameOver({ ...props }) {
  const { width } = useWindowDimensions();
  const { setCharacter } = React.useContext(GameContext);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [characters, setCharacters] = React.useState(
    Object.keys(Characters).map((val) => Characters[val])
  );
  const [animations, setAnimations] = React.useState(
    banner.map((val) => new Animated.Value(0))
  );

  const dismiss = () => {
    // props.navigation.goBack();
    props.onRestart();
  };

  const pickRandom = () => {
    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomCharacter = characters[randomIndex];
    setCharacter(randomCharacter.id);
    dismiss();
  };

  React.useEffect(() => {
    setTimeout(() => {
      _animateBanners();

      const playBannerSound = async () => {
        await AudioManager.playAsync(AudioManager.sounds.banner);
        // const soundObject = new Audio.Sound();
        // try {
        //   await soundObject.loadAsync(AudioFiles.banner);
        //   await soundObject.playAsync();
        // } catch (error) {
        //   console.warn('sound error', { error });
        // }
      };
      playBannerSound();
      setTimeout(() => playBannerSound(), 300);
      setTimeout(() => playBannerSound(), 600);
    }, 600);
  });

  const _animateBanners = () => {
    const _animations = animations.map((animation) =>
      Animated.timing(animation, {
        useNativeDriver: true,
        toValue: 1,
        duration: 1000,
        easing: Easing.elastic(),
      })
    );
    Animated.stagger(300, _animations).start();
  };

  const _showResult = (result) => {
    // if (result.action === Share.sharedAction) {
    //   if (result.activityType) {
    //     this.setState({result: 'shared with an activityType: ' + result.activityType});
    //   } else {
    //     this.setState({result: 'shared'});
    //   }
    // } else if (result.action === Share.dismissedAction) {
    //   this.setState({result: 'dismissed'});
    // }
  };

  const select = () => {
    setCharacter(characters[currentIndex].id);
    dismiss();
  };

  const { top, bottom, left, right } = useSafeAreaInsets();

  const imageStyle = { width: 60, height: 48 };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top || 12, paddingBottom: bottom || 8 },
        props.style,
      ]}
    >
      <View key="content" style={{ flex: 1, justifyContent: "center" }}>
        {banner.map((val, index) => (
          <Banner
            animatedValue={animations[index].interpolate({
              inputRange: [0.2, 1],
              outputRange: [-width, 0],
              extrapolate: "clamp",
            })}
            key={index}
            style={{
              backgroundColor: val.color,
              transform: [
                {
                  scaleY: animations[index].interpolate({
                    inputRange: [0, 0.2],
                    outputRange: [0, 1],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
            title={val.title}
            button={val.button}
          />
        ))}
      </View>

      {props.canRevive && (
        <TouchableOpacity
          onPress={props.onRevive}
          activeOpacity={0.85}
          style={styles.reviveBtn}
        >
          <Text style={styles.reviveText}>REVIVE</Text>
          <View style={styles.reviveCostRow}>
            <View style={styles.coinDot} />
            <Text style={styles.reviveCost}>{props.reviveCost}</Text>
          </View>
        </TouchableOpacity>
      )}

      <Footer
        style={{ paddingLeft: left || 4, paddingRight: right || 4 }}
        score={props.score ?? 0}
        inputLog={props.inputLog}
        setGameState={props.setGameState}
        onShowLeaderboard={props.onShowLeaderboard}
        onShowChallenges={props.onShowChallenges}
        canRevive={props.canRevive}
      />
    </View>
  );
}

export default GameOver;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#34495e",
  },
  reviveBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E6FBF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 12,
    borderBottomWidth: 4,
    borderBottomColor: "#0A1628",
    borderRightWidth: 3,
    borderRightColor: "#0A1628",
    borderTopWidth: 2,
    borderTopColor: "#5BB8FF",
    borderLeftWidth: 2,
    borderLeftColor: "#5BB8FF",
  },
  reviveText: {
    fontFamily: "retro",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  reviveCostRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  coinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFD700",
    borderWidth: 2,
    borderColor: "#B8860B",
    marginRight: 6,
  },
  reviveCost: {
    fontFamily: "retro",
    fontSize: 14,
    color: "#FFD700",
  },
});
