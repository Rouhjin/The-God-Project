// Web worker: terrain generation + meshing. The worker is authoritative for
// generated chunk data (it regenerates unedited chunks on demand and keeps
// edited ones); the main thread pushes edits here so meshes stay correct.
import { WorldGen } from './worldgen.js';
import { meshChunk, makePadded } from './mesher.js';
import { CY } from './chunk.js';

let gen = null;
const store = new Map(); // "cx,cz" -> { data: Uint8Array, edited: bool }
const scratchPadded = new Uint8Array(18 * (CY + 2) * 18);

const key = (cx, cz) => cx + ',' + cz;

function ensure(cx, cz) {
  const k = key(cx, cz);
  let e = store.get(k);
  if (!e) {
    e = { data: gen.generateChunk(cx, cz), edited: false };
    store.set(k, e);
  }
  return e;
}

function buildMesh(cx, cz) {
  const grid = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) grid.push(ensure(cx + dx, cz + dz).data);
  }
  const getWorld = (wx, wy, wz) => {
    const gx = (wx >> 4) - cx + 1;
    const gz = (wz >> 4) - cz + 1;
    return grid[gx + gz * 3][(wx & 15) + (wz & 15) * 16 + (wy << 8)];
  };
  makePadded(getWorld, cx, cz, scratchPadded);
  return meshChunk(scratchPadded, cx * 16, cz * 16);
}

function meshTransfers(m) {
  return [
    m.solid.positions.buffer, m.solid.normals.buffer, m.solid.uvs.buffer,
    m.solid.colors.buffer, m.solid.skyLight.buffer, m.solid.blockLight.buffer, m.solid.indices.buffer,
    m.water.positions.buffer, m.water.normals.buffer, m.water.uvs.buffer,
    m.water.colors.buffer, m.water.skyLight.buffer, m.water.blockLight.buffer, m.water.indices.buffer,
  ];
}

self.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init': {
      gen = new WorldGen(msg.seed);
      store.clear();
      break;
    }
    case 'load': {
      const { cx, cz } = msg;
      const entry = ensure(cx, cz);
      const m = buildMesh(cx, cz);
      const data = entry.data.slice();
      self.postMessage(
        { type: 'chunk', cx, cz, data, solid: m.solid, water: m.water },
        [data.buffer, ...meshTransfers(m)],
      );
      break;
    }
    case 'remesh': {
      const { cx, cz } = msg;
      const m = buildMesh(cx, cz);
      self.postMessage(
        { type: 'mesh', cx, cz, solid: m.solid, water: m.water },
        meshTransfers(m),
      );
      break;
    }
    case 'edits': {
      // msg.edits: array of [cx, cz, index, value]
      for (const [cx, cz, i, v] of msg.edits) {
        const entry = ensure(cx, cz);
        entry.data[i] = v;
        entry.edited = true;
      }
      break;
    }
    case 'chunkData': {
      // restored-from-save chunk data
      store.set(key(msg.cx, msg.cz), { data: msg.data, edited: true });
      break;
    }
    case 'unload': {
      const k = key(msg.cx, msg.cz);
      const entry = store.get(k);
      if (entry && !entry.edited) store.delete(k);
      break;
    }
  }
};
