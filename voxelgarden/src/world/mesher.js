// Chunk -> merged geometry arrays. Pure module (no THREE, no DOM) so it runs in the worker.
//
// Works on a padded 18x98x18 snapshot of the chunk plus a 1-block border from its
// neighbors, so face culling and ambient occlusion are correct across chunk seams.
// Emits two vertex streams: solid (opaque + cutout leaves/glass, one draw call) and
// water (blended, drawn after opaque with depthWrite off).

import { BLOCKS, B, isOpaque } from './blocks.js';
import { uvRect } from './atlas.js';
import { CX, CY, CZ } from './chunk.js';

const PX = CX + 2, PY = CY + 2, PZ = CZ + 2;
const PSTRIDE_Z = PX, PSTRIDE_Y = PX * PZ;

export function paddedIndex(x, y, z) {
  return (x + 1) + (z + 1) * PSTRIDE_Z + (y + 1) * PSTRIDE_Y;
}

// Fill a padded snapshot from a world-space block getter.
// getWorld(wx, wy, wz) must return a block id for any coordinate (0 outside loaded area).
export function makePadded(getWorld, cx, cz, out) {
  const padded = out || new Uint8Array(PX * PY * PZ);
  const bx = cx * 16, bz = cz * 16;
  for (let y = -1; y <= CY; y++) {
    for (let z = -1; z <= CZ; z++) {
      let i = paddedIndex(-1, y, z);
      for (let x = -1; x <= CX; x++, i++) {
        padded[i] = y < 0 ? B.BEDROCK : y >= CY ? B.AIR : getWorld(bx + x, y, bz + z);
      }
    }
  }
  return padded;
}

// Face table (winding verified CCW from outside). Corners are listed in "strip" order:
// triangles (0,1,2) and (2,1,3) share the c1-c2 diagonal.
const FACES = [
  { axis: 0, sign: -1, dir: [-1, 0, 0], shade: 0.68,
    corners: [{ pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] }] },
  { axis: 0, sign: 1, dir: [1, 0, 0], shade: 0.68,
    corners: [{ pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] }] },
  { axis: 1, sign: -1, dir: [0, -1, 0], shade: 0.52,
    corners: [{ pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] }] },
  { axis: 1, sign: 1, dir: [0, 1, 0], shade: 1.0,
    corners: [{ pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] }] },
  { axis: 2, sign: -1, dir: [0, 0, -1], shade: 0.82,
    corners: [{ pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] }] },
  { axis: 2, sign: 1, dir: [0, 0, 1], shade: 0.82,
    corners: [{ pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] }] },
];

const AO_LEVELS = [0.42, 0.62, 0.8, 1.0];

class GeoBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.glows = [];   // 1 = fullbright (ignores day/night tint), e.g. lantern light
    this.indices = [];
    this.vertCount = 0;
  }
  toArrays() {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      glows: new Float32Array(this.glows),
      indices: new Uint32Array(this.indices),
    };
  }
}

// faceIndex -> which of the block's [top, bottom, side] tiles to use
function tileFor(block, faceIndex) {
  const t = block.tiles;
  if (faceIndex === 3) return t[0];
  if (faceIndex === 2) return t[1];
  return t[2];
}

const WATER_UV_SCALE = 0.5; // water texture repeats every 2 blocks, in world space

export function meshChunk(padded, bx = 0, bz = 0) {
  const solid = new GeoBuilder();
  const water = new GeoBuilder();

  const at = (x, y, z) => padded[(x + 1) + (z + 1) * PSTRIDE_Z + (y + 1) * PSTRIDE_Y];
  const opaqueAt = (x, y, z) => isOpaque(at(x, y, z));
  const glowTouches = (x, y, z) =>
    at(x, y, z) === B.LANTERN ||
    at(x + 1, y, z) === B.LANTERN || at(x - 1, y, z) === B.LANTERN ||
    at(x, y + 1, z) === B.LANTERN || at(x, y - 1, z) === B.LANTERN ||
    at(x, y, z + 1) === B.LANTERN || at(x, y, z - 1) === B.LANTERN;

  for (let y = 0; y < CY; y++) {
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const id = at(x, y, z);
        if (id === B.AIR) continue;
        const block = BLOCKS[id];
        const isWater = id === B.WATER;
        const surfaceWater = isWater && at(x, y + 1, z) !== B.WATER;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [dx, dy, dz] = face.dir;
          const n = at(x + dx, y + dy, z + dz);

          // culling rules
          if (isWater) {
            if (n === B.WATER || isOpaque(n)) continue;
          } else if (block.opaque) {
            if (isOpaque(n)) continue;
          } else {
            // cutout (leaves/glass): skip faces against opaque and against same block
            if (isOpaque(n) || n === id) continue;
          }

          const builder = isWater ? water : solid;
          const [u0, v0, u1, v1] = uvRect(tileFor(block, f));

          // per-corner AO (solid only) + brightness
          const glow = block.glow || glowTouches(x + dx, y + dy, z + dz);
          const ao = [1, 1, 1, 1];
          if (!isWater && !glow) {
            const a = face.axis;
            const ua = a === 0 ? 1 : 0;           // first non-face axis
            const va = a === 2 ? 1 : 2;           // second non-face axis
            const nb = [x + dx, y + dy, z + dz];
            for (let ci = 0; ci < 4; ci++) {
              const pos = face.corners[ci].pos;
              const du = pos[ua] ? 1 : -1;
              const dv = pos[va] ? 1 : -1;
              const s1p = [nb[0], nb[1], nb[2]]; s1p[ua] += du;
              const s2p = [nb[0], nb[1], nb[2]]; s2p[va] += dv;
              const cp = [s1p[0], s1p[1], s1p[2]]; cp[va] += dv;
              const s1 = opaqueAt(s1p[0], s1p[1], s1p[2]) ? 1 : 0;
              const s2 = opaqueAt(s2p[0], s2p[1], s2p[2]) ? 1 : 0;
              const co = opaqueAt(cp[0], cp[1], cp[2]) ? 1 : 0;
              ao[ci] = AO_LEVELS[s1 && s2 ? 0 : 3 - (s1 + s2 + co)];
            }
          }

          const base = builder.vertCount;
          for (let ci = 0; ci < 4; ci++) {
            const c = face.corners[ci];
            let px = x + c.pos[0], py = y + c.pos[1], pz = z + c.pos[2];
            // sunken water surface
            if (isWater && surfaceWater && c.pos[1] === 1) py = y + 0.85;
            builder.positions.push(px, py, pz);
            builder.normals.push(dx, dy, dz);
            if (isWater) {
              // world-space UVs so the standalone repeating water texture tiles seamlessly
              if (face.axis === 1) builder.uvs.push((bx + px) * WATER_UV_SCALE, (bz + pz) * WATER_UV_SCALE);
              else if (face.axis === 0) builder.uvs.push((bz + pz) * WATER_UV_SCALE, py * WATER_UV_SCALE);
              else builder.uvs.push((bx + px) * WATER_UV_SCALE, py * WATER_UV_SCALE);
            } else {
              builder.uvs.push(
                u0 + (u1 - u0) * c.uv[0],
                v0 + (v1 - v0) * c.uv[1],
              );
            }
            const br = (glow ? 1.0 : face.shade) * ao[ci];
            builder.colors.push(br, br, br);
            builder.glows.push(glow ? 1 : 0);
          }
          // flip the quad diagonal toward the brighter pair to avoid AO seams
          if (ao[0] + ao[3] > ao[1] + ao[2]) {
            builder.indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
          } else {
            builder.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
          builder.vertCount += 4;
        }
      }
    }
  }

  return { solid: solid.toArrays(), water: water.toArrays() };
}
