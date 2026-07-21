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

    // pass 1: base terrain per column
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
      }
    }

    return data;
  }
}
