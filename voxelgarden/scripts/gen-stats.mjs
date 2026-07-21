// Worldgen sanity check, no browser needed: block-type distribution over an area.
import { WorldGen, SEA_LEVEL } from '../src/world/worldgen.js';
import { B, BLOCKS } from '../src/world/blocks.js';

const seed = process.argv[2] || 'voxelgarden';
const R = Number(process.argv[3] || 4); // chunks in each direction

const gen = new WorldGen(seed);
const counts = new Map();
let caveAir = 0, columns = 0, treeCols = 0;

for (let cz = -R; cz <= R; cz++) {
  for (let cx = -R; cx <= R; cx++) {
    const d = gen.generateChunk(cx, cz);
    for (let i = 0; i < d.length; i++) counts.set(d[i], (counts.get(d[i]) || 0) + 1);
    // cave air: air cells below y=30 that sit under solid ground
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      columns++;
      let hasLog = false;
      for (let y = 5; y < 30; y++) if (d[x + z * 16 + y * 256] === B.AIR) caveAir++;
      for (let y = 30; y < 90; y++) if (d[x + z * 16 + y * 256] === B.LOG) { hasLog = true; break; }
      if (hasLog) treeCols++;
    }
  }
}

const total = [...counts.values()].reduce((a, b) => a + b, 0);
const rows = [...counts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([id, n]) => `${(BLOCKS[id]?.name || id).padEnd(14)} ${String(n).padStart(9)}  ${(100 * n / total).toFixed(3)}%`);
console.log(`seed="${seed}" area=${(2 * R + 1)}x${(2 * R + 1)} chunks`);
console.log(rows.join('\n'));
console.log(`cave-air cells (y5-30): ${caveAir}`);
console.log(`tree columns: ${treeCols} / ${columns}`);
