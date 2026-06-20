// The latest published version of the package -- this is what every
// moveCall target should use, since it's the only address with every
// module (marketplace was added in a later upgrade).
export const PACKAGE_ID = process.env.EXPO_PUBLIC_FROSTIE_PACKAGE_ID ?? "";

// Struct type tags for types that existed before the upgrade (like
// YetiNFT) keep referencing the package's original publish address, not
// the latest version -- only types newly added in an upgrade (like
// marketplace::Listing) get tagged with the new address. Needed for
// StructType filters in getOwnedObjects, never for moveCall targets.
export const ORIGINAL_PACKAGE_ID =
  process.env.EXPO_PUBLIC_FROSTIE_ORIGINAL_PACKAGE_ID ?? "";
export const LEADERBOARD_ID = process.env.EXPO_PUBLIC_LEADERBOARD_ID ?? "";
export const MINT_REGISTRY_ID = process.env.EXPO_PUBLIC_MINT_REGISTRY_ID ?? "";
export const DELEGATE_REGISTRY_ID = process.env.EXPO_PUBLIC_DELEGATE_REGISTRY_ID ?? "";
export const MARKETPLACE_ID = process.env.EXPO_PUBLIC_MARKETPLACE_ID ?? "";
export const CHALLENGE_CONFIG_ID = process.env.EXPO_PUBLIC_CHALLENGE_CONFIG_ID ?? "";
// Shared system Clock object, fixed at this address on every Sui network.
export const CLOCK_ID = "0x6";

// Checked once at app startup (see EnvCheck) — a missing object/package ID
// would otherwise surface as a cryptic Move call failure deep in gameplay
// instead of a clear message before anything renders.
export function findMissingEnvVars(): string[] {
  const required: Record<string, string> = {
    EXPO_PUBLIC_FROSTIE_PACKAGE_ID: PACKAGE_ID,
    EXPO_PUBLIC_FROSTIE_ORIGINAL_PACKAGE_ID: ORIGINAL_PACKAGE_ID,
    EXPO_PUBLIC_LEADERBOARD_ID: LEADERBOARD_ID,
    EXPO_PUBLIC_MINT_REGISTRY_ID: MINT_REGISTRY_ID,
    EXPO_PUBLIC_DELEGATE_REGISTRY_ID: DELEGATE_REGISTRY_ID,
    EXPO_PUBLIC_MARKETPLACE_ID: MARKETPLACE_ID,
  };
  return Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

// Index here must match the `tier: u8` constants in yeti_nft.move
// (TIER_COMMON = 0, TIER_RARE = 1, TIER_LEGENDARY = 2).
export const YETI_TIERS = ["frostie", "blizzard", "glacier"] as const;
