const WALRUS_PUBLISHER_URL =
  process.env.EXPO_PUBLIC_WALRUS_PUBLISHER_URL ?? "https://publisher.walrus-testnet.walrus.space";

// Uploads `data` as a blob (kept for a handful of epochs -- this is replay
// log storage, not a permanent archive) and returns the blob id Walrus
// assigns it, or null if the publisher is unreachable. Replay storage is
// "store now, verify later": nothing on-chain depends on this succeeding,
// so a failed upload just means record_run gets an empty replay_blob_id.
export async function uploadReplayBlob(data: string): Promise<string | null> {
  try {
    const res = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=5`, {
      method: "PUT",
      body: data,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.newlyCreated?.blobObject?.blobId ?? json?.alreadyCertified?.blobId ?? null;
  } catch (e) {
    console.warn("Walrus blob upload failed", e);
    return null;
  }
}
