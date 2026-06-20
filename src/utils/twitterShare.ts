// Centralized Twitter/X share helper. Builds a web "intent" URL that opens a
// compose window with a prewritten message pre-filled. A small pool of
// messages is rotated so repeated shares aren't identical tweets.

const SITE = "frostie-yeti.vercel.app";

function intentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Score brag text, shared from the game-over screen. `address`, when
// present, is shortened into a small on-chain flex. Shared by both the
// Twitter intent link and the generic native/web share sheet.
export function scoreShareText(score: number, address?: string | null): string {
  const addrPart = address ? ` | ${address.slice(0, 8)}…` : "";
  const messages = [
    `Just scored ${score} in Yeti in da Citi 🧊 hopping on-chain with @SuiNetwork${addrPart}\n\nCan you beat me? ${SITE} #YetiInDaCiti`,
    `${score} points and still hopping in Yeti in da Citi ❄️${addrPart}\n\nThink you can out-hop me? ${SITE} #YetiInDaCiti`,
    `Frozen in the zone with ${score} in Yeti in da Citi 🥶 Built on @SuiNetwork${addrPart}\n\n${SITE} #YetiInDaCiti`,
  ];
  return pick(messages);
}

export function scoreShareUrl(score: number, address?: string | null): string {
  return intentUrl(scoreShareText(score, address));
}

export const SHARE_SITE_URL = `https://${SITE}`;

// Character flex, shared from the character-select screen.
export function characterShareUrl(character: string): string {
  const messages = [
    `Repping ${character} in Yeti in da Citi ❄️ Hopping on-chain with @SuiNetwork.\n\nJoin me 👉 ${SITE} #YetiInDaCiti`,
    `${character} is my Yeti of choice in Yeti in da Citi 🧊 Built on @SuiNetwork.\n\n${SITE} #YetiInDaCiti`,
    `Picked ${character} and hopping into Yeti in da Citi 🐾 Can you keep up? ${SITE} #YetiInDaCiti`,
  ];
  return intentUrl(pick(messages));
}
