// expo-gl's web GLView throws a synchronous, uncaught Invariant Violation
// from inside a ref callback when the browser can't produce a WebGL
// context (disabled hardware acceleration, some mobile browsers, locked-
// down environments). That throw isn't catchable with try/catch since it
// happens inside React's commit phase — the only reliable way to avoid a
// hard crash is to never mount GLView when WebGL isn't actually available.
let cached: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return true;
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    cached = !!gl;
  } catch {
    cached = false;
  }
  return cached;
}
