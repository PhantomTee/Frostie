import { GLView } from "expo-gl";
import React, { Component } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Platform,
  Vibration,
  View,
  useColorScheme,
} from "react-native";

import GestureRecognizer, { swipeDirections } from "@/components/GestureView";
import Score from "@/components/ScoreText";
import Engine from "@/GameEngine";
import State from "@/state";
import CharacterSelectScreen from "@/screens/CharacterSelectScreen";
import GameOverScreen from "@/screens/GameOverScreen";
import HomeScreen from "@/screens/HomeScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ConnectWalletScreen from "@/screens/ConnectWalletScreen";
import DPad from "@/components/DPad";
import GameHUD from "@/components/GameHUD";
import AudioManager from "@/AudioManager";
import { logEvent } from "@/Analytics";
import MintNFTScreen from "@/screens/MintNFTScreen";
import LeaderboardScreen from "@/screens/LeaderboardScreen";
import MarketplaceScreen from "@/screens/MarketplaceScreen";
import ChallengesScreen from "@/screens/ChallengesScreen";
import GameContext from "@/context/GameContext";
import { SuiProvider, useSui } from "@/context/SuiContext";
import { isWebGLAvailable } from "@/utils/webgl";
import EnvCheck from "@/components/EnvCheck";
import WalletDebugOverlay from "@/components/WalletDebugOverlay";

const DEBUG_CAMERA_CONTROLS = false;

// Revive economy: cost grows each time within a run, capped per run.
// After the listed costs, each further revive costs 20 more than the last.
const REVIVE_COSTS = [20, 40, 50, 70];
const MAX_REVIVES_PER_RUN = 3;

// Touch devices (native, or a touch-capable browser) always get the on-screen
// D-pad. Desktop (non-touch web) hides it by default behind a HUD toggle, since
// keyboard play is the norm there.
const IS_TOUCH =
  Platform.OS !== "web" ||
  (typeof window !== "undefined" &&
    ("ontouchstart" in window || (navigator?.maxTouchPoints ?? 0) > 0));
const IS_DESKTOP = !IS_TOUCH;

// Extended game states
const AppState = {
  ...State.Game,
  wallet: "wallet",
  mint: "mint",
  leaderboard: "leaderboard",
  settings: "settings",
  marketplace: "marketplace",
  challenges: "challenges",
};

class Game extends Component {
  state = {
    ready: false,
    score: 0,
    coins: 0, // coins collected this run
    revivesThisRun: 0,
    muted: AudioManager.isMuted(),
    dpadEnabled: false, // desktop only; touch devices always show the D-pad
    viewKey: 0,
    gameState: AppState.wallet, // start with wallet connect
    showCharacterSelect: false,
  };

  toggleMute = () => {
    this.setState({ muted: AudioManager.toggleMuted() });
  };

  toggleDpad = () => {
    this.setState((s) => ({ dpadEnabled: !s.dpadEnabled }));
  };

  // Each revive in a run costs more so it can't be spammed indefinitely.
  reviveCost = () => {
    const i = this.state.revivesThisRun;
    return i < REVIVE_COSTS.length
      ? REVIVE_COSTS[i]
      : REVIVE_COSTS[REVIVE_COSTS.length - 1] + (i - REVIVE_COSTS.length + 1) * 20;
  };
  canRevive = () =>
    this.state.revivesThisRun < MAX_REVIVES_PER_RUN &&
    (this.props.coins ?? 0) >= this.reviveCost();

  // Spend coins, bring the hero back, and resume the SAME run — bypassing
  // updateWithGameState(playing), which would otherwise re-init from scratch.
  revive = () => {
    if (!this.canRevive()) return;
    const cost = this.reviveCost();
    logEvent("revive", { cost, score: this.state.score, revivesThisRun: this.state.revivesThisRun + 1 });
    this.props.addCoins?.(-cost);
    this.setState((s) => ({ revivesThisRun: s.revivesThisRun + 1 }));
    this.engine.reviveHero();
    this.engine.gameState = State.Game.playing;
    this.setState({ gameState: State.Game.playing });
  };

  transitionScreensValue = new Animated.Value(1);

  UNSAFE_componentWillReceiveProps(nextProps, nextState) {
    if (nextState.gameState && nextState.gameState !== this.state.gameState) {
      this.updateWithGameState(nextState.gameState, this.state.gameState);
    }
    if (this.engine && nextProps.character !== this.props.character) {
      this.engine._hero.setCharacter(nextProps.character);
    }
  }

  transitionToGamePlayingState = () => {
    Animated.timing(this.transitionScreensValue, {
      toValue: 0,
      useNativeDriver: true,
      duration: 200,
      onComplete: ({ finished }) => {
        this.engine.setupGame(this.props.character);
        this.engine.init();
        if (finished) {
          Animated.timing(this.transitionScreensValue, {
            toValue: 1,
            useNativeDriver: true,
            duration: 300,
          }).start();
        }
      },
    }).start();
  };

  updateWithGameState = (gameState) => {
    if (!gameState) throw new Error("gameState cannot be undefined");
    if (gameState === this.state.gameState) return;

    const lastState = this.state.gameState;
    this.setState({ gameState });

    // Non-gameplay states don't need engine updates
    if ([AppState.wallet, AppState.mint, AppState.leaderboard, AppState.settings, AppState.marketplace, AppState.challenges].includes(gameState)) return;

    this.engine.gameState = gameState;
    const { playing, gameOver, paused, none } = State.Game;
    switch (gameState) {
      case playing:
        if (lastState === paused) {
          this.engine.unpause();
        } else {
          // A genuine new run (not an unpause) -- count it toward the
          // lifetime-runs stat shown on the home screen. Revives reuse this
          // same run via revive(), so they don't hit this branch again.
          this.props.incrementGamesPlayed?.();
          logEvent("run_started", { character: this.props.character });
          if (lastState !== none) {
            this.transitionToGamePlayingState();
          } else {
            this.engine._hero.stopIdle();
            this.onSwipe(swipeDirections.SWIPE_UP);
          }
        }
        break;
      case gameOver:
        break;
      case paused:
        this.engine.pause();
        break;
      case none:
        if (lastState === gameOver) {
          this.transitionToGamePlayingState();
        }
        this.newScore();
        break;
    }
  };

  componentWillUnmount() {
    cancelAnimationFrame(this.engine.raf);
  }

  async componentDidMount() {
    Dimensions.addEventListener("change", this.onScreenResize);
  }

  onScreenResize = () => {
    this.engine.updateScale();
  };

  // No gameplay without owning the equipped Yeti NFT on-chain — route to
  // wallet connect or the mint flow instead of starting the game.
  onPlay = () => {
    const { walletAddress, character, ownedYetiTiers } = this.props;
    if (!walletAddress) {
      this.updateWithGameState(AppState.wallet);
      return;
    }
    if (!ownedYetiTiers?.[character]) {
      this.updateWithGameState(AppState.mint);
      return;
    }
    this.updateWithGameState(State.Game.playing);
  };

  UNSAFE_componentWillMount() {
    this.engine = new Engine();
    this.engine.onUpdateScore = (position) => {
      if (this.state.score < position) {
        this.setState({ score: position });
      }
    };
    this.engine.onGameInit = () => {
      this.setState({ score: 0, coins: 0, revivesThisRun: 0 });
    };
    this.engine.onCollectCoin = () => {
      this.setState((s) => ({ coins: s.coins + 1 }));
      this.props.addCoins?.(1);
    };
    this.engine._isGameStateEnded = () => {
      return this.state.gameState !== State.Game.playing;
    };
    this.engine.onGameReady = () => this.setState({ ready: true });
    this.engine.onGameEnded = () => {
      logEvent("run_ended", { score: this.state.score, revivesThisRun: this.state.revivesThisRun });
      this.setState({ gameState: State.Game.gameOver });
    };
    this.engine.setupGame(this.props.character);
    this.engine.init();
  }

  newScore = () => {
    Vibration.cancel();
    this.setState({ score: 0 });
    this.engine.init();
  };

  onSwipe = (gestureName) => this.engine.moveWithDirection(gestureName);

  // Touch D-pad: mirror the keyboard path (begin the hop, then move) so the
  // game is playable on mobile without swipe gestures.
  onDirectionPress = (direction) => {
    this.engine.beginMoveWithDirection();
    this.onSwipe(direction);
  };

  renderGame = () => {
    if (!this.state.ready) return null;
    if (!isWebGLAvailable()) return null;
    return (
      <GestureView
        pointerEvents={DEBUG_CAMERA_CONTROLS ? "none" : undefined}
        onStartGesture={this.engine.beginMoveWithDirection}
        onSwipe={this.onSwipe}
      >
        <GLView
          style={{ flex: 1, height: "100%", overflow: "hidden" }}
          onContextCreate={this.engine._onGLContextCreate}
        />
      </GestureView>
    );
  };

  render() {
    const { gameState, score } = this.state;
    const { isDarkMode } = this.props;

    const isOverlay = [
      AppState.wallet,
      AppState.mint,
      AppState.leaderboard,
      AppState.settings,
      AppState.marketplace,
      AppState.challenges,
      State.Game.gameOver,
      State.Game.none,
    ].includes(gameState);

    return (
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          { flex: 1, backgroundColor: "#0A1628" },
          Platform.select({
            web: { position: "fixed" },
            default: { position: "absolute" },
          }),
          this.props.style,
        ]}
      >
        {/* 3D Game canvas — always mounted so engine stays alive */}
        <Animated.View style={{ flex: 1, opacity: this.transitionScreensValue }}>
          {this.renderGame()}
        </Animated.View>

        {/* Score HUD */}
        {gameState === State.Game.playing && (
          <Score
            score={score}
            gameOver={false}
          />
        )}

        {/* Coins + wallet + mute + dpad-toggle HUD */}
        {gameState === State.Game.playing && (
          <GameHUD
            coins={this.state.coins}
            muted={this.state.muted}
            onToggleMute={this.toggleMute}
            walletAddress={this.props.walletAddress}
            showDpadToggle={IS_DESKTOP}
            dpadEnabled={this.state.dpadEnabled}
            onToggleDpad={this.toggleDpad}
            nextReviveCost={this.state.revivesThisRun < MAX_REVIVES_PER_RUN ? this.reviveCost() : undefined}
            canRevive={this.canRevive()}
          />
        )}

        {/* On-screen D-pad: always on touch devices; opt-in on desktop */}
        {gameState === State.Game.playing && (IS_TOUCH || this.state.dpadEnabled) && (
          <DPad onPress={this.onDirectionPress} />
        )}

        {/* === Overlay screens === */}

        {gameState === AppState.wallet && (
          <View style={StyleSheet.absoluteFillObject}>
            <ConnectWalletScreen
              onConnected={() => this.updateWithGameState(AppState.mint)}
            />
          </View>
        )}

        {gameState === AppState.mint && (
          <View style={StyleSheet.absoluteFillObject}>
            <MintNFTScreen
              walletHighestScore={this.props.walletHighestScore ?? 0}
              onDone={() => this.updateWithGameState(State.Game.none)}
            />
          </View>
        )}

        {gameState === State.Game.none && (
          <View style={StyleSheet.absoluteFillObject}>
            <HomeScreen
              onPlay={this.onPlay}
              onShowCharacterSelect={() =>
                this.setState({ showCharacterSelect: true })
              }
              onShop={() => this.updateWithGameState(AppState.marketplace)}
              onChallenges={() => this.updateWithGameState(AppState.challenges)}
              coins={this.props.coins ?? 0}
              highscore={this.props.highscore ?? 0}
              gamesPlayed={this.props.gamesPlayed ?? 0}
              streak={this.props.streak ?? 0}
            />
          </View>
        )}

        {gameState === State.Game.gameOver && (
          <View style={StyleSheet.absoluteFillObject}>
            <GameOverScreen
              score={score}
              inputLog={this.engine.inputLog}
              showSettings={() => this.updateWithGameState(AppState.settings)}
              setGameState={(s) => this.updateWithGameState(s)}
              onShowLeaderboard={() => this.updateWithGameState(AppState.leaderboard)}
              onRestart={() => this.updateWithGameState(State.Game.none)}
              canRevive={this.canRevive()}
              reviveCost={this.reviveCost()}
              onRevive={this.revive}
            />
          </View>
        )}

        {gameState === AppState.leaderboard && (
          <View style={StyleSheet.absoluteFillObject}>
            <LeaderboardScreen
              onClose={() =>
                this.updateWithGameState(
                  this.state.score > 0 ? State.Game.gameOver : State.Game.none
                )
              }
            />
          </View>
        )}

        {gameState === AppState.marketplace && (
          <View style={StyleSheet.absoluteFillObject}>
            <MarketplaceScreen onClose={() => this.updateWithGameState(State.Game.none)} />
          </View>
        )}

        {gameState === AppState.challenges && (
          <View style={StyleSheet.absoluteFillObject}>
            <ChallengesScreen onClose={() => this.updateWithGameState(State.Game.none)} />
          </View>
        )}

        {gameState === AppState.settings && (
          <View style={StyleSheet.absoluteFillObject}>
            <SettingsScreen
              goBack={() => {
                // Settings can toggle sound independently of the HUD's mute
                // button, which writes straight to AudioManager -- resync
                // so the HUD icon reflects whatever Settings left it as.
                this.setState({ muted: AudioManager.isMuted() });
                this.updateWithGameState(
                  this.state.score > 0 ? State.Game.gameOver : State.Game.none
                );
              }}
              onOpenLeaderboard={() =>
                this.updateWithGameState(AppState.leaderboard)
              }
              onOpenMint={() => this.updateWithGameState(AppState.mint)}
            />
          </View>
        )}

        {this.state.showCharacterSelect && (
          <View style={StyleSheet.absoluteFillObject}>
            <CharacterSelectScreen
              navigation={{
                goBack: () => this.setState({ showCharacterSelect: false }),
              }}
              setCharacter={this.props.setCharacter}
            />
          </View>
        )}

        {isDarkMode && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(10, 22, 40, 0.85)" },
            ]}
            pointerEvents="none"
          />
        )}

        <WalletDebugOverlay />
      </View>
    );
  }
}

const GestureView = ({ onStartGesture, onSwipe, ...props }) => {
  const config = {
    velocityThreshold: 0.2,
    directionalOffsetThreshold: 80,
  };

  return (
    <GestureRecognizer
      onResponderGrant={() => onStartGesture()}
      onSwipe={(direction) => onSwipe(direction)}
      config={config}
      onTap={() => onSwipe(swipeDirections.SWIPE_UP)}
      style={{ flex: 1 }}
      {...props}
    />
  );
};

function GameScreen(props) {
  const scheme = useColorScheme();
  const { character, setCharacter, addCoins, coins, highscore, gamesPlayed, incrementGamesPlayed, streak } =
    React.useContext(GameContext);
  const { highestScore, walletAddress, ownedYetiTiers } = useSui();

  return (
    <Game
      {...props}
      character={character}
      setCharacter={setCharacter}
      addCoins={addCoins}
      coins={coins}
      highscore={highscore}
      gamesPlayed={gamesPlayed}
      incrementGamesPlayed={incrementGamesPlayed}
      streak={streak}
      isDarkMode={scheme === "dark"}
      walletHighestScore={highestScore}
      walletAddress={walletAddress}
      ownedYetiTiers={ownedYetiTiers}
    />
  );
}

export default function App() {
  return (
    <EnvCheck>
      <SuiProvider>
        <GameScreen />
      </SuiProvider>
    </EnvCheck>
  );
}
