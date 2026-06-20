import { createContext } from "react";

export default createContext({
  character: "chicken",
  setCharacter(character: string) {},
  highscore: 0,
  setHighscore(highscore: number) {},
  coins: 0,
  addCoins(n: number) {},
  gamesPlayed: 0,
  incrementGamesPlayed() {},
  streak: 0,
  reduceMotion: false,
  setReduceMotion(value: boolean) {},
});
