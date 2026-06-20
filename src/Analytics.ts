// Minimal event log: always console.logs, and additionally POSTs to an
// endpoint if EXPO_PUBLIC_ANALYTICS_URL is set, so the coin/revive economy
// can be tuned later from real usage data without standing up anything yet.
type EventPayload = Record<string, string | number | boolean | null | undefined>;

const ENDPOINT = process.env.EXPO_PUBLIC_ANALYTICS_URL;

export function logEvent(name: string, payload: EventPayload = {}) {
  const event = { name, payload, ts: Date.now() };
  console.log("[analytics]", name, payload);

  if (!ENDPOINT) return;
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {});
  } catch {}
}
