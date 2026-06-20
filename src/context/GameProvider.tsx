import AsyncStorage from "@react-native-async-storage/async-storage";
import * as React from "react";

import GameContext from "./GameContext";

const STORAGE_KEY = "@Frostie:Character";
const SHOULD_REHYDRATE = true;

const defaultState = {
  character: "frostie",
  highscore: 0,
  coins: 0,
  gamesPlayed: 0,
  streak: 0,
  lastPlayedDate: null as string | null,
  reduceMotion: false,
};

// Bonus coins awarded for keeping a daily streak alive, capped at 5 days.
const DAILY_STREAK_BONUS_STEP = 10;
const DAILY_STREAK_BONUS_CAP_DAYS = 5;

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function cacheAsync(value) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

async function rehydrateAsync() {
  if (!SHOULD_REHYDRATE || !AsyncStorage) {
    return defaultState;
  }
  try {
    const item = await AsyncStorage.getItem(STORAGE_KEY);
    const data = JSON.parse(item);
    return data;
  } catch {
    return defaultState;
  }
}

export default function GameProvider({ children }) {
  const [character, setCharacter] = React.useState(defaultState.character);
  const [highscore, setHighscore] = React.useState(defaultState.highscore);
  const [coins, setCoins] = React.useState(defaultState.coins);
  const [gamesPlayed, setGamesPlayed] = React.useState(defaultState.gamesPlayed);
  const [streak, setStreak] = React.useState(defaultState.streak);
  const [reduceMotion, setReduceMotionState] = React.useState(defaultState.reduceMotion);
  const lastPlayedDateRef = React.useRef<string | null>(defaultState.lastPlayedDate);

  React.useEffect(() => {
    const parseModulesAsync = async () => {
      try {
        const data = await rehydrateAsync();
        setHighscore(data.highscore ?? 0);
        setCoins(data.coins ?? 0);
        setGamesPlayed(data.gamesPlayed ?? 0);
        setReduceMotionState(data.reduceMotion ?? false);

        // Daily streak: bump it the first time the player shows up on a new
        // calendar day, reset it if a day was skipped, and toss in a small
        // coin bonus so it pairs with the existing coin/revive economy.
        const today = todayString();
        const lastPlayedDate = data.lastPlayedDate ?? null;
        let nextStreak = data.streak ?? 0;
        let bonusCoins = 0;
        if (lastPlayedDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const wasYesterday = lastPlayedDate === yesterday.toISOString().slice(0, 10);
          nextStreak = wasYesterday ? nextStreak + 1 : 1;
          bonusCoins = Math.min(nextStreak, DAILY_STREAK_BONUS_CAP_DAYS) * DAILY_STREAK_BONUS_STEP;
        }
        lastPlayedDateRef.current = today;
        setStreak(nextStreak);
        const nextCoins = (data.coins ?? 0) + bonusCoins;
        setCoins(nextCoins);
        cacheAsync({
          character: data.character ?? defaultState.character,
          highscore: data.highscore ?? 0,
          coins: nextCoins,
          gamesPlayed: data.gamesPlayed ?? 0,
          streak: nextStreak,
          lastPlayedDate: today,
          reduceMotion: data.reduceMotion ?? false,
        });
      } catch (ignored) {}
    };

    parseModulesAsync();
  }, []);

  return (
    <GameContext
      value={{
        character,
        setCharacter: (character) => {
          setCharacter(character);
          cacheAsync({ character, highscore, coins, gamesPlayed, streak, lastPlayedDate: lastPlayedDateRef.current, reduceMotion });
        },
        highscore,
        setHighscore: (highscore) => {
          setHighscore(highscore);
          cacheAsync({ character, highscore, coins, gamesPlayed, streak, lastPlayedDate: lastPlayedDateRef.current, reduceMotion });
        },
        coins,
        // Add to the persisted coin balance (n coins collected this hop/run).
        addCoins: (n) => {
          setCoins((prev) => {
            const next = prev + n;
            cacheAsync({ character, highscore, coins: next, gamesPlayed, streak, lastPlayedDate: lastPlayedDateRef.current, reduceMotion });
            return next;
          });
        },
        gamesPlayed,
        // Lifetime runs counter — bumped once per genuine run start (not
        // revives, which continue the same run).
        incrementGamesPlayed: () => {
          setGamesPlayed((prev) => {
            const next = prev + 1;
            cacheAsync({ character, highscore, coins, gamesPlayed: next, streak, lastPlayedDate: lastPlayedDateRef.current, reduceMotion });
            return next;
          });
        },
        streak,
        reduceMotion,
        setReduceMotion: (value: boolean) => {
          setReduceMotionState(value);
          cacheAsync({ character, highscore, coins, gamesPlayed, streak, lastPlayedDate: lastPlayedDateRef.current, reduceMotion: value });
        },
      }}
    >
      {children}
    </GameContext>
  );
}
