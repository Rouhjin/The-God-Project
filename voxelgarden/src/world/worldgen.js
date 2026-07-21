// Seeded terrain generation. Pure module — runs in the worker (and on the main
// thread for spawn-height queries). Everything derives from the world seed, so a
// chunk can be regenerated identically at any time; only edited chunks are stored.
//
// Chunks are generated fully independently: structures (trees, cacti) are decided
// per-column by seeded hash, and generation scans a margin of neighboring columns
// so structures that overhang chunk borders are written consistently by every
// chunk they touch. Ore veins are seeded per source-chunk and re-walked by each
// neighboring chunk, clipping writes to itself.

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { B } from './blocks.js';
import { CY } from './chunk.js';

export const SEA_LEVEL = 34;

// string -> 32-bit hash (xmur3)
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOW: 3, MOUNTAIN: 4 };

export class WorldGen {
  constructor(seedStr) {
    this.seedStr = String(seedStr);
    this.seed = hashSeed(this.seedStr);
    const mk = (salt) => createNoise2D(mulberry32(this.seed ^ salt));
    this.nContinent = mk(0x11111111);
    this.nHills = mk(0x22222222);
    this.nDetail = mk(0x33333333);
    this.nTemp = mk(0x44444444);
    this.nMoist = mk(0x55555555);
    this.nCave = createNoise3D(mulberry32(this.seed ^ 0x66666666));
  }

  // integer hash of a position + salt, folded with the world seed
  hash(x, z, salt) {
    let h = this.seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^= h >>> 16) >>> 0;
  }

  heightAt(x, z) {
    const h = SEA_LEVEL
      + this.nContinent(x / 512, z / 512) * 24
      + this.nHills(x / 128, z / 128) * 12
      + this.nDetail(x / 32, z / 32) * 3;
    return Math.max(4, Math.min(88, Math.round(h)));
  }

  biomeAt(x, z, h) {
    if (h > 66) return BIOME.MOUNTAIN;
    const t = this.nTemp(x / 384, z / 384);
    const m = this.nMoist(x / 384, z / 384);
    if (t < -0.35) return BIOME.SNOW;
    if (t > 0.35 && m < 0.05) return BIOME.DESERT;
    if (m > 0.1) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(16 * 16 * CY);
    const bx = cx * 16, bz = cz * 16;

    // pass 1: base terrain + caves per column
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const wx = bx + x, wz = bz + z;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz, h);
        const beach = h >= SEA_LEVEL - 2 && h <= SEA_LEVEL + 2;
        const ci = x + z * 16;

        for (let y = 0; y <= h; y++) {
          let id;
          if (y <= 1) id = B.BEDROCK;
          else if (y <= h - 4) id = B.STONE;
          else {
            // top 4 layers: biome filler + surface
            if (biome === BIOME.DESERT || beach) id = B.SAND;
            else if (biome === BIOME.MOUNTAIN) id = y === h && h >= 74 ? B.SNOW : B.STONE;
            else if (y < h) id = B.DIRT;
            else id = biome === BIOME.SNOW ? B.SNOW : B.GRASS;
          }
          data[ci + y * 256] = id;
        }
        // water fill
        for (let y = h + 1; y <= SEA_LEVEL; y++) data[ci + y * 256] = B.WATER;

        // caves: winding tunnels from a 3D noise shell; never open a floor
        // directly beneath the water table
        const caveTop = h <= SEA_LEVEL + 1 ? h - 2 : Math.min(60, h);
        for (let y = 4; y <= caveTop; y++) {
          const n = this.nCave(wx / 48, y / 48, wz / 48);
          if (n > -0.08 && n < 0.08) data[ci + y * 256] = B.AIR;
        }
      }
    }

    // pass 2: ore veins (seeded random walks; every neighboring chunk re-walks the
    // same veins and clips writes to itself, so veins cross borders seamlessly)
    const ORES = [
      { id: B.COAL_ORE, salt: 0x0c0a1, attempts: 8, chance: 1.0, lo: 10, hi: 60, min: 6, max: 10 },
      { id: B.IRON_ORE, salt: 0x11203, attempts: 5, chance: 1.0, lo: 5, hi: 40, min: 4, max: 8 },
      { id: B.GOLD_ORE, salt: 0x60111, attempts: 2, chance: 0.7, lo: 5, hi: 20, min: 3, max: 6 },
      { id: B.DIAMOND_ORE, salt: 0xd1a05, attempts: 1, chance: 0.55, lo: 2, hi: 12, min: 2, max: 5 },
    ];
    for (let vcz = cz - 1; vcz <= cz + 1; vcz++) {
      for (let vcx = cx - 1; vcx <= cx + 1; vcx++) {
        for (const ore of ORES) {
          for (let a = 0; a < ore.attempts; a++) {
            const rng = mulberry32(this.hash(vcx, vcz, ore.salt + a * 7919));
            if (rng() > ore.chance) continue;
            let x = vcx * 16 + ((rng() * 16) | 0);
            let z = vcz * 16 + ((rng() * 16) | 0);
            let y = ore.lo + ((rng() * (ore.hi - ore.lo + 1)) | 0);
            const len = ore.min + ((rng() * (ore.max - ore.min + 1)) | 0);
            for (let s = 0; s < len; s++) {
              const lx = x - bx, lz = z - bz;
              if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && y >= 2 && y < CY) {
                const di = lx + lz * 16 + y * 256;
                if (data[di] === B.STONE) data[di] = ore.id;
              }
              const r = rng();
              if (r < 0.34) x += rng() < 0.5 ? 1 : -1;
              else if (r < 0.67) z += rng() < 0.5 ? 1 : -1;
              else y += rng() < 0.5 ? 1 : -1;
            }
          }
        }
      }
    }

    // pass 3: structures (trees, cacti) — per-column seeded decisions, scanned with
    // a 2-block margin so structures overhanging this chunk get written too
    const setLocal = (wx2, y, wz2, id, onlyAir) => {
      const lx = wx2 - bx, lz = wz2 - bz;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= CY) return;
      const di = lx + lz * 16 + y * 256;
      if (onlyAir && data[di] !== B.AIR) return;
      data[di] = id;
    };

    for (let wz = bz - 2; wz < bz + 18; wz++) {
      for (let wx = bx - 2; wx < bx + 18; wx++) {
        const h = this.heightAt(wx, wz);
        if (h <= SEA_LEVEL || h > 84) continue;
        const biome = this.biomeAt(wx, wz, h);
        const r = this.hash(wx, wz, 0x7ee5);

        if (biome === BIOME.DESERT) {
          if (r % 89 === 0) {
            const ch = 1 + (this.hash(wx, wz, 0xcac71) % 3);
            for (let y = h + 1; y <= h + ch; y++) setLocal(wx, y, wz, B.CACTUS, true);
          }
          continue;
        }

        const density = biome === BIOME.FOREST ? 28 : biome === BIOME.PLAINS ? 220 : biome === BIOME.SNOW ? 90 : 0;
        if (!density || r % density !== 0) continue;
        // don't grow trees on beaches
        if (h <= SEA_LEVEL + 2) continue;

        const th = 4 + (this.hash(wx, wz, 0x71ee) % 3); // trunk 4-6
        const yTop = h + th;
        // leaf cap: 5x5 minus corners, two layers
        for (let ly = yTop - 1; ly <= yTop; ly++) {
          for (let dz = -2; dz <= 2; dz++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
              setLocal(wx + dx, ly, wz + dz, B.LEAVES, true);
            }
          }
        }
        // 3x3 crown + snow dusting in snowfields
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            setLocal(wx + dx, yTop + 1, wz + dz, B.LEAVES, true);
            if (biome === BIOME.SNOW && (dx + dz) % 2 === 0) setLocal(wx + dx, yTop + 2, wz + dz, B.SNOW, true);
          }
        }
        // trunk last so it punches through leaves
        for (let y = h + 1; y <= yTop; y++) setLocal(wx, y, wz, B.LOG, false);
      }
    }

    return data;
  }
}
