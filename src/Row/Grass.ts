import { Object3D } from "three";

import ModelLoader from "../ModelLoader";
import { groundLevel } from "../GameSettings";
import { createCoinMesh, COIN_Y } from "../Node/Coin";

// Chance a grass row spawns a collectible coin on one of its clear cells.
const COIN_SPAWN_CHANCE = 0.35;

export const Fill = {
  empty: "empty",
  solid: "solid",
  random: "random",
};

const HAS_WALLS = true;
const HAS_OBSTACLES = true;
const HAS_VARIETY = true;

export default class Grass extends Object3D {
  active = false;
  entities = [];

  top = 0.4;
  /*

* Build Walls

* Random Fill Center
* Solid Fill Center
* Empty Fill Center


*/

  generate = (type = Fill.random, requiredClearPositions: number[] = []) => {
    this.entities.map((val) => {
      this.floor.remove(val.mesh);
      val = null;
    });
    this.entities = [];
    this.obstacleMap = {};
    this.requiredClearPositions = new Set(requiredClearPositions);
    this.treeGen(type);
    this.spawnCoin();
  };

  // { x, mesh, collected } | null — at most one coin per row.
  coin = null;

  spawnCoin = () => {
    if (this.coin) {
      this.floor.remove(this.coin.mesh);
      this.coin = null;
    }
    if (Math.random() > COIN_SPAWN_CHANCE) return;

    // Only place on a clear, reachable cell (no obstacle, not a required path).
    const clear: number[] = [];
    for (let x = -3; x <= 3; x++) {
      if (!(`${x}` in this.obstacleMap) && !this.requiredClearPositions.has(x)) {
        clear.push(x);
      }
    }
    if (clear.length === 0) return;

    const x = clear[Math.floor(Math.random() * clear.length)];
    const mesh = createCoinMesh();
    mesh.position.set(x, COIN_Y, 0);
    this.floor.add(mesh);
    this.coin = { x, mesh, collected: false };
  };

  // Collects this row's coin if it sits on cell `x`. Returns true on a hit.
  collectCoinAt = (x: number): boolean => {
    if (this.coin && !this.coin.collected && this.coin.x === (x | 0)) {
      this.coin.collected = true;
      this.floor.remove(this.coin.mesh);
      return true;
    }
    return false;
  };

  spinCoin = () => {
    if (this.coin && !this.coin.collected) {
      this.coin.mesh.rotation.y += 0.02;
    }
  };

  obstacleMap = {};
  requiredClearPositions: Set<number> = new Set();

  addObstacle = (x) => {
    // Don't add obstacles at positions that must be clear for a winnable path
    if (this.requiredClearPositions.has(x | 0)) {
      return;
    }

    let mesh;
    if (HAS_VARIETY) {
      mesh =
        Math.random() < 0.4
          ? ModelLoader._boulder.getRandom()
          : ModelLoader._tree.getRandom();
    } else {
      mesh = ModelLoader._tree.getRandom();
    }
    this.obstacleMap[`${x | 0}`] = { index: this.entities.length };
    this.entities.push({ mesh });
    this.floor.add(mesh);
    mesh.position.set(x, groundLevel, 0);
  };

  // Returns all x positions that have obstacles
  getBlockedPositions = (): number[] => {
    return Object.keys(this.obstacleMap).map((k) => parseInt(k, 10));
  };

  treeGen = (type) => {
    // 0 - 8
    let _rowCount = 0;
    const count = Math.round(Math.random() * 2) + 1;
    for (let x = -3; x < 12; x++) {
      const _x = x - 4;
      if (type === Fill.solid) {
        this.addObstacle(_x);
        continue;
      }

      if (HAS_WALLS) {
        /// Walls
        if (x >= 9 || x <= -1) {
          this.addObstacle(_x);
          continue;
        }
      }

      if (HAS_OBSTACLES) {
        if (_rowCount < count) {
          if (_x !== 0 && Math.random() > 0.6) {
            this.addObstacle(_x);
            _rowCount++;
          }
        }
      }
    }
  };

  constructor(heroWidth, onCollide) {
    super();
    this.onCollide = onCollide;
    const { _grass } = ModelLoader;

    this.floor = _grass.getNode();
    this.add(this.floor);
  }
}
