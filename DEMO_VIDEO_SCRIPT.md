# Frostie demo video script (CLAY Hackathon)

Target length: 4 minutes. Screen-record at frostie-yeti.vercel.app, narrate live or voice over afterward.

## 0:00-0:20 — Hook + what this is
Show the home screen and title art on screen.

Say: "This is Frostie, an infinite hopper game built on Sui. It's not just an on-chain leaderboard, it's a peer to peer betting game where players stake SUI against each other's actual scores."

## 0:20-1:00 — Core gameplay
Play a short run live (15-20 seconds is enough). Show the coin counter resetting each run, a revive, and a death.

Say: "The game itself is a straightforward hopper, built with Expo, React Native, and Three.js. Coins and score are per run, no grinding a stockpile across attempts."

## 1:00-1:40 — On-chain run receipt
On the game over screen, connect/show the wallet, sign the score transaction.

Say: "When a run ends, one signature does two things on-chain: it updates the leaderboard, and it mints a RunScore receipt, a Move object that records that exact run's score. That receipt is the only thing that can ever prove what a player scored. Nothing downstream trusts a number typed by the client."

Cut to the Sui Explorer (or a terminal `sui client object <id>`) showing the actual RunScore object fields.

## 1:40-2:40 — Challenge markets (the novel part)
Walk through the full loop:
1. From game over, stake SUI to open a challenge market — show the modal, point out the target score is read directly off the RunScore object, not typed in.
2. Switch to a second wallet (or narrate "from another player's perspective"), open the Challenges tab, join the market by matching the stake.
3. Show that joining doesn't force the next run — go to Challenges, hit PLAY, then play a run.
4. Land back on game over, let the attempt auto-submit (no button, just the spinner/status text), and show the win payout (90% of pool) or, if it's a miss, that the player can keep retrying without re-staking.

Say while this plays: "Anyone can challenge anyone's run. The first attempt to beat the target wins ninety percent of the pool, ten percent goes to a treasury. If the market expires with no winner, everyone gets a ninety percent refund. The attempt score going into that payout call is sourced from the same RunScore receipt mechanism, so there's no way to fake a winning number."

## 2:40-3:10 — NFT characters
Open the shop/mint screen, mint or show an owned Yeti tier NFT, switch characters.

Say: "Players can also mint character NFTs that change who they're playing as in the run itself."

## 3:10-3:40 — Walrus replay logs
Briefly mention/show the blob id stored on the RunScore receipt (can just point at the field in the explorer view from earlier).

Say: "Every run's input log, every swipe and timestamp, gets uploaded to Walrus, and the blob id is stored right on the receipt. Nothing reads it yet, it's groundwork for a future replay verifier that can check a winning run wasn't scripted."

## 3:40-4:00 — Close
Show the GitHub repo page and the live URL on screen.

Say: "Frostie is live at frostie-yeti.vercel.app, code's open on GitHub. Built solo on the Sui Stack for CLAY."

---

## Recording checklist
- [ ] Two funded testnet wallets ready (one to create the market, one to join/attempt)
- [ ] Sui Explorer tab open to the RunScore object ahead of time so the cut isn't dead air
- [ ] Practice the join -> PLAY -> auto-submit loop once off-camera so the timing in 1:40-2:40 is tight
- [ ] Record at 1080p, no webcam needed, voiceover can be added in post
- [ ] Upload to YouTube (unlisted is fine, just needs to be viewable via link) before filling out the submission form
