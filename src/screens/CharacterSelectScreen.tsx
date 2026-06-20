import { Component } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import Characters from "@/Characters";
import Button from "@/components/Button";
import Carousel from "@/components/CharacterSelect/Carousel";
import Images from "@/Images";
import { characterShareUrl } from "@/utils/twitterShare";

// import connectCharacter from '../../utils/connectCharacter';
class CharacterSelect extends Component {
  state = {
    currentIndex: 0,
    characters: Object.keys(Characters).map((val) => Characters[val]),
  };
  dismiss = () => {
    this.props.navigation.goBack();
  };

  pickRandom = () => {
    const { characters } = this.state;

    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomCharacter = characters[randomIndex];
    this.props.setCharacter(randomCharacter.id);
    this.dismiss();
  };
  share = () => {
    const { characters, currentIndex } = this.state;
    const character = characters[currentIndex].name;
    // Open a Twitter/X compose window with a prewritten Frostie message.
    Linking.openURL(characterShareUrl(character));
  };

  select = () => {
    const { characters, currentIndex } = this.state;

    this.props.setCharacter(characters[currentIndex].id);
    this.dismiss();
  };

  render() {
    const imageStyle = { width: 60, height: 48 };

    return (
      <View style={[styles.container, this.props.style]}>
        <View
          style={{ flexDirection: "row", marginTop: 8, paddingHorizontal: 4 }}
        >
          <Button
            source={Images.button.back}
            imageStyle={imageStyle}
            onPress={(_) => {
              this.dismiss();
            }}
          />
        </View>

        <Carousel
          onCurrentIndexChange={(index) => {
            this.setState({ currentIndex: index });
          }}
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <Button
            source={Images.button.random}
            imageStyle={imageStyle}
            onPress={(_) => {
              this.pickRandom();
            }}
          />
          <Button
            source={Images.button.long_play}
            imageStyle={{ width: 90, height: 48 }}
            onPress={(_) => {
              this.select();
            }}
          />
          <Button
            source={Images.button.social}
            imageStyle={imageStyle}
            onPress={(_) => {
              this.share();
            }}
          />
        </View>
        {false && (
          <Text
            style={{
              fontFamily: "retro",
              position: "absolute",
              fontSize: 24,
              color: "white",
              bottom: 4,
              left: 8,
            }}
          >
            4/ 8
          </Text>
        )}
      </View>
    );
  }
}

export default CharacterSelect;
// export default connect(
//   state => ({}),
//   {},
// )(connectCharacter(CharacterSelect));

CharacterSelect.defaultProps = {
  coins: 0,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    backgroundColor: "rgba(10, 22, 40, 0.92)",
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#34495e",
  },
});
