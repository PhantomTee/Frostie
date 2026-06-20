import { CylinderGeometry, Mesh, MeshLambertMaterial } from "three";

import { groundLevel } from "../GameSettings";

// A simple gold coin: a thin cylinder stood up to face the player and spun on
// its vertical axis for the classic coin-flip shimmer. Geometry and material
// are shared across every coin since they're identical — cheap to reuse.
const GEOMETRY = new CylinderGeometry(0.3, 0.3, 0.08, 20);
const MATERIAL = new MeshLambertMaterial({ color: 0xffd700, emissive: 0x6b4e00 });

// Float the coin a little above the ground so it reads at the player's height.
export const COIN_Y = groundLevel + 0.55;

export function createCoinMesh(): Mesh {
  const mesh = new Mesh(GEOMETRY, MATERIAL);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
