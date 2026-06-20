# Frostie: Yeti in da Citi

An infinite hopper game built with Expo, React Native, and Three.js, with on-chain scores and NFT characters on Sui.

[Play it in the browser](https://frostie-yeti.vercel.app)

## Stack

- [Expo](https://expo.dev) (web, with iOS/Android support)
- [React Native for Web](https://necolas.github.io/react-native-web/) (web)
- [React Native](https://reactnative.dev/) (iOS, Android)
- [THREE.js](https://threejs.org/) for rendering
- [GSAP](https://greensock.com/) for animation
- [Sui](https://sui.io/) for on-chain leaderboard scores, character NFTs, and challenge markets
- [Walrus](https://www.walrus.xyz/) for storing each run's replay log

## Challenge markets

Frostie has a peer to peer score wager mechanic built directly on Sui Move:

1. After every run, the player's wallet signs one transaction that does two things at once: updates the on-chain leaderboard, and mints a `RunScore` receipt recording that exact run's score (see `run_score.move`).
2. From the game over screen, a player can stake SUI to open a challenge market against their own run's receipt (`challenge_market::create_market`). The market's target score is read straight off the receipt, never typed in by hand.
3. Anyone can browse open challenges and join by matching the stake (`join_market`). Joined players then play a fresh run and submit their own receipt as an attempt (`submit_attempt`).
4. The first attempt to beat the target score wins 90 percent of the pool, with 10 percent going to a protocol treasury. If nobody beats the target before the market's window closes, every participant gets a 90 percent refund of their own stake via `close_expired`.

The key design point: neither the market's target score nor a challenger's attempt score is ever a raw, client supplied number in a money moving call. Both are sourced from a `RunScore` receipt, and the only function that can mint one (`record_run`) is called right after a real run completes. This was verified end to end on Sui testnet, including a real win payout and a real expiry refund (not just unit level checks).

Run input logs (direction and timestamp per move) are uploaded to Walrus on game over and the resulting blob id is stored on the `RunScore` receipt, as groundwork for a future replay verifier. Nothing on chain depends on this yet; it is intentionally "store now, verify later."

## Credit

Originally based on Evan Bacon's [Expo Crossy Road](https://github.com/EvanBacon/Expo-Crossy-Road) template.

## License

The game's source code is made available under the [MIT license](LICENSE). Some dependencies are licensed differently (e.g. BSD).
