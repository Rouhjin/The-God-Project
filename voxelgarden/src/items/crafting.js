// Crafting: shaped + shapeless recipes matched against a 2x2 or 3x3 grid.
const RECIPES = [];

function shapeless(result, count, inputs) {
  RECIPES.push({ result, count, shapeless: inputs });
}
function shaped(result, count, pattern, key) {
  RECIPES.push({ result, count, pattern, key });
}

shapeless('planks', 4, ['log']);
shapeless('lantern', 2, ['coal', 'planks', 'planks']); // Voxelgarden house rule — see NOTES
shaped('stick', 4, ['P', 'P'], { P: 'planks' });
shaped('crafting table', 1, ['PP', 'PP'], { P: 'planks' });
shaped('furnace', 1, ['CCC', 'C C', 'CCC'], { C: 'cobblestone' });

const TIERS = [['wood', 'planks'], ['stone', 'cobblestone'], ['iron', 'iron ingot'], ['diamond', 'diamond']];
for (const [tier, mat] of TIERS) {
  shaped(`${tier} pickaxe`, 1, ['XXX', ' S ', ' S '], { X: mat, S: 'stick' });
  shaped(`${tier} axe`, 1, ['XX', 'XS', ' S'], { X: mat, S: 'stick' });
  shaped(`${tier} shovel`, 1, ['X', 'S', 'S'], { X: mat, S: 'stick' });
  shaped(`${tier} sword`, 1, ['X', 'X', 'S'], { X: mat, S: 'stick' });
}

// grid: array of (itemId | null), size*size. Returns { result, count } or null.
export function matchRecipe(grid, size) {
  // shapeless: multiset compare
  const present = grid.filter(Boolean);
  outer:
  for (const r of RECIPES) {
    if (!r.shapeless) continue;
    if (present.length !== r.shapeless.length) continue;
    const need = [...r.shapeless];
    for (const id of present) {
      const i = need.indexOf(id);
      if (i === -1) continue outer;
      need.splice(i, 1);
    }
    return { result: r.result, count: r.count };
  }

  // shaped: trim the grid to its bounding box, compare with patterns (+mirror)
  let x0 = size, x1 = -1, y0 = size, y1 = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[x + y * size]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;

  for (const r of RECIPES) {
    if (!r.pattern) continue;
    const ph = r.pattern.length, pw = Math.max(...r.pattern.map((row) => row.length));
    if (pw !== w || ph !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) {
        for (let x = 0; x < w && ok; x++) {
          const px = mirror ? w - 1 - x : x;
          const ch = (r.pattern[y][px] || ' ');
          const want = ch === ' ' ? null : r.key[ch];
          const got = grid[(x0 + x) + (y0 + y) * size];
          if (want !== got) ok = false;
        }
      }
      if (ok) return { result: r.result, count: r.count };
    }
  }
  return null;
}
