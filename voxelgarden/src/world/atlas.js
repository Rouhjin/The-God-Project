// Procedural texture atlas — every texture in the game is painted here at startup.
// "Storybook Meadow" recipe: flat base color, two layers of speckles in lighter/darker
// siblings, then a 1px darker edge on the bottom+right for a chunky sticker feel.
//
// The TILE table and uvRect() are pure data/math so the mesher worker can import them;
// canvas work only happens inside build functions (main thread only).

export const ATLAS_SIZE = 256;
export const TILE_PX = 16;
export const TILES_PER_ROW = 16;

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5,
  LOG_SIDE: 6, LOG_TOP: 7, PLANKS: 8, LEAVES: 9, GLASS: 10, WATER: 11,
  BEDROCK: 12, COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15,
  DIAMOND_ORE: 16, LANTERN: 17, SNOW: 18, CACTUS_SIDE: 19, CACTUS_TOP: 20,
  CRAFT_TOP: 21, CRAFT_SIDE: 22, FURNACE_FRONT: 23, FURNACE_TOP: 24,
};

// Half-texel inset so filtering never bleeds neighboring tiles.
const INSET = 0.5 / ATLAS_SIZE;
const TS = TILE_PX / ATLAS_SIZE; // 1/16

// [u0, v0, u1, v1] with v measured OpenGL-style (v=1 at canvas top, flipY texture).
export function uvRect(tile) {
  const c = tile % TILES_PER_ROW;
  const r = (tile / TILES_PER_ROW) | 0;
  return [
    c * TS + INSET,
    1 - (r + 1) * TS + INSET,
    (c + 1) * TS - INSET,
    1 - r * TS - INSET,
  ];
}

// ---- deterministic little RNG so the atlas looks identical every boot ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToCss([r, g, b]) { return `rgb(${r | 0},${g | 0},${b | 0})`; }
export function shade(hex, f) {
  // f > 1 lightens toward white, f < 1 darkens.
  const [r, g, b] = hexToRgb(hex);
  if (f >= 1) {
    const t = f - 1;
    return rgbToCss([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]);
  }
  return rgbToCss([r * f, g * f, b * f]);
}

// ---- tile painters ----------------------------------------------------------

function makeCtx(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

class TilePainter {
  constructor(ctx, tx, ty, rng) {
    this.ctx = ctx; this.x = tx * TILE_PX; this.y = ty * TILE_PX; this.rng = rng;
  }
  fill(color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.x, this.y, TILE_PX, TILE_PX);
  }
  px(x, y, color, w = 1, h = 1) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.x + x, this.y + y, w, h);
  }
  clearPx(x, y, w = 1, h = 1) {
    this.ctx.clearRect(this.x + x, this.y + y, w, h);
  }
  speckle(color, count, maxSize = 2) {
    for (let i = 0; i < count; i++) {
      const s = 1 + ((this.rng() * maxSize) | 0) * 0 + (this.rng() < 0.4 ? 1 : 0);
      this.px((this.rng() * 16) | 0, (this.rng() * 16) | 0, color, s, s);
    }
  }
  stickerEdge(base, f = 0.72) {
    const c = shade(base, f);
    this.px(0, 15, c, 16, 1);
    this.px(15, 0, c, 1, 16);
  }
  // standard storybook tile: base + light speckles + dark speckles + edge
  storybook(base, light, dark, n = 22) {
    this.fill(base);
    this.speckle(light, n);
    this.speckle(dark, n);
    this.stickerEdge(base);
  }
}

function drawTiles(ctx, rng) {
  const P = (tile) => new TilePainter(ctx, tile % 16, (tile / 16) | 0, rng);

  // grass top
  {
    const p = P(TILE.GRASS_TOP);
    p.storybook('#6cc551', '#8fdd6a', '#57a83f', 26);
  }
  // grass side: dirt with a scalloped grass fringe on top
  {
    const p = P(TILE.GRASS_SIDE);
    p.fill('#a97b50');
    p.speckle('#c1946a', 16); p.speckle('#8a6240', 16);
    p.px(0, 0, '#6cc551', 16, 3);
    for (let x = 0; x < 16; x++) {
      const d = 3 + ((rng() * 3) | 0);
      p.px(x, 3, '#6cc551', 1, d - 3);
      if (rng() < 0.5) p.px(x, 0, '#8fdd6a', 1, 1);
      p.px(x, d, '#57a83f', 1, 1);
    }
    p.stickerEdge('#a97b50');
  }
  // dirt
  P(TILE.DIRT).storybook('#a97b50', '#c1946a', '#8a6240', 24);
  // stone: blotchy
  {
    const p = P(TILE.STONE);
    p.fill('#9aa0a8');
    for (let i = 0; i < 7; i++) {
      const w = 2 + ((rng() * 4) | 0), h = 2 + ((rng() * 3) | 0);
      p.px((rng() * 14) | 0, (rng() * 14) | 0, rng() < 0.5 ? '#a9afb8' : '#878d96', w, h);
    }
    p.speckle('#b4bac2', 12); p.speckle('#7e848d', 12);
    p.stickerEdge('#9aa0a8');
  }
  // cobblestone: rounded stones with mortar
  {
    const p = P(TILE.COBBLE);
    p.fill('#6f757d');
    const stones = [[0, 0, 6, 5], [7, 0, 8, 6], [0, 6, 5, 6], [6, 7, 6, 5], [12, 7, 4, 4], [0, 12, 7, 4], [8, 12, 7, 4]];
    for (const [sx, sy, w, h] of stones) {
      p.px(sx, sy, '#99a0a9', w, h);
      p.px(sx + 1, sy + 1, '#a9afb8', w - 2, 1);
      p.px(sx + 1, sy + h - 1, '#868c95', w - 2, 1);
    }
    p.speckle('#b4bac2', 8); p.speckle('#5d636b', 8);
    p.stickerEdge('#8b9199');
  }
  // sand
  P(TILE.SAND).storybook('#ecd9a0', '#f7e9bd', '#d9c184', 30);
  // log side: vertical bark grain
  {
    const p = P(TILE.LOG_SIDE);
    p.fill('#7a5a3a');
    for (let x = 0; x < 16; x++) {
      const t = rng();
      if (t < 0.28) p.px(x, 0, '#8d6b47', 1, 16);
      else if (t < 0.5) p.px(x, 0, '#684a2e', 1, 16);
      if (rng() < 0.35) p.px(x, (rng() * 14) | 0, '#5c3f26', 1, 2 + ((rng() * 3) | 0));
    }
    p.stickerEdge('#7a5a3a');
  }
  // log top: rings
  {
    const p = P(TILE.LOG_TOP);
    p.fill('#7a5a3a');
    p.px(2, 2, '#c9a06a', 12, 12);
    p.px(4, 4, '#a97f50', 8, 8);
    p.px(6, 6, '#c9a06a', 4, 4);
    p.px(7, 7, '#8d6b47', 2, 2);
    p.speckle('#b58d5c', 8);
    p.stickerEdge('#7a5a3a');
  }
  // planks: horizontal boards
  {
    const p = P(TILE.PLANKS);
    p.fill('#c9a06a');
    p.speckle('#dcb67f', 14); p.speckle('#b58a55', 14);
    p.px(0, 3, '#9c7443', 16, 1);
    p.px(0, 7, '#9c7443', 16, 1);
    p.px(0, 11, '#9c7443', 16, 1);
    p.px(4, 0, '#9c7443', 1, 3); p.px(11, 4, '#9c7443', 1, 3);
    p.px(6, 8, '#9c7443', 1, 3); p.px(13, 12, '#9c7443', 1, 4);
    p.stickerEdge('#c9a06a');
  }
  // leaves: cutout holes
  {
    const p = P(TILE.LEAVES);
    p.fill('#4f9e4f');
    p.speckle('#68bb63', 24); p.speckle('#3c823e', 24);
    for (let i = 0; i < 38; i++) {
      if (rng() < 0.55) p.clearPx((rng() * 16) | 0, (rng() * 16) | 0);
    }
    p.stickerEdge('#4f9e4f');
  }
  // glass: transparent center, pale frame + sparkle
  {
    const p = P(TILE.GLASS);
    p.clearPx(0, 0, 16, 16);
    p.px(0, 0, '#f2fbff', 16, 1); p.px(0, 15, '#dceef7', 16, 1);
    p.px(0, 0, '#f2fbff', 1, 16); p.px(15, 0, '#dceef7', 1, 16);
    p.px(2, 2, '#ffffff', 2, 2); p.px(4, 4, '#ffffff', 1, 1);
    p.px(11, 10, '#eaf7ff', 1, 3); p.px(12, 9, '#eaf7ff', 1, 1);
  }
  // water tile in the atlas (the live water mesh uses its own scrolling texture)
  {
    const p = P(TILE.WATER);
    p.fill('#3f8fd6');
    p.speckle('#5fa8e6', 16); p.speckle('#2f78bd', 14);
    for (let i = 0; i < 4; i++) p.px((rng() * 12) | 0, (rng() * 15) | 0, '#a8d4f2', 2 + ((rng() * 3) | 0), 1);
  }
  // bedrock: heavy dark noise
  {
    const p = P(TILE.BEDROCK);
    p.fill('#3a3a3f');
    p.speckle('#55555c', 34); p.speckle('#232327', 34); p.speckle('#6a6a72', 10);
    p.stickerEdge('#3a3a3f');
  }
  // ores: stone base + clustered nuggets
  const ore = (tile, color, hi) => {
    const p = P(tile);
    p.fill('#9aa0a8');
    p.speckle('#b4bac2', 10); p.speckle('#7e848d', 10);
    const cx = 4 + ((rng() * 6) | 0), cy = 4 + ((rng() * 6) | 0);
    const n = 5 + ((rng() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const nx = Math.max(1, Math.min(13, cx + ((rng() * 9) | 0) - 4));
      const ny = Math.max(1, Math.min(13, cy + ((rng() * 9) | 0) - 4));
      const s = 1 + (rng() < 0.5 ? 1 : 0);
      p.px(nx, ny, color, s, s);
      p.px(nx, ny, hi, 1, 1);
    }
    p.stickerEdge('#9aa0a8');
  };
  ore(TILE.COAL_ORE, '#2b2b2b', '#4a4a4a');
  ore(TILE.IRON_ORE, '#d8a37b', '#f0c39a');
  ore(TILE.GOLD_ORE, '#ffd447', '#ffe98f');
  ore(TILE.DIAMOND_ORE, '#7fe7e0', '#c2fbf7');
  // lantern: glowing checker in a dark frame
  {
    const p = P(TILE.LANTERN);
    p.fill('#5c4a33');
    p.px(1, 1, '#ffd977', 14, 14);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      if (((x >> 1) + (y >> 1)) % 2 === 0) p.px(x, y, '#ffbf49');
      if (rng() < 0.06) p.px(x, y, '#fff3c9');
    }
    p.px(0, 7, '#5c4a33', 16, 2); p.px(7, 0, '#5c4a33', 2, 16);
    p.stickerEdge('#8a6f4d');
  }
  // snow
  P(TILE.SNOW).storybook('#f4f8ff', '#ffffff', '#dfe8f5', 20);
  // cactus side: vertical ribs + spines
  {
    const p = P(TILE.CACTUS_SIDE);
    p.fill('#3f8f4f');
    for (let x = 1; x < 16; x += 3) p.px(x, 0, '#2f7340', 1, 16);
    for (let x = 2; x < 16; x += 3) p.px(x, 0, '#57ab68', 1, 16);
    for (let i = 0; i < 6; i++) p.px((rng() * 15) | 0, (rng() * 15) | 0, '#e8f5d9');
    p.stickerEdge('#3f8f4f');
  }
  // cactus top
  {
    const p = P(TILE.CACTUS_TOP);
    p.fill('#3f8f4f');
    p.px(2, 2, '#57ab68', 12, 12);
    p.px(4, 4, '#3f8f4f', 8, 8);
    p.speckle('#2f7340', 10);
    p.stickerEdge('#3f8f4f');
  }
  // crafting table top: planks + work grid
  {
    const p = P(TILE.CRAFT_TOP);
    p.fill('#c9a06a');
    p.speckle('#dcb67f', 10); p.speckle('#b58a55', 10);
    p.px(0, 0, '#8a6240', 16, 1); p.px(0, 15, '#8a6240', 16, 1);
    p.px(0, 0, '#8a6240', 1, 16); p.px(15, 0, '#8a6240', 1, 16);
    p.px(3, 3, '#6e4e2f', 10, 1); p.px(3, 7, '#6e4e2f', 10, 1); p.px(3, 11, '#6e4e2f', 10, 1);
    p.px(3, 3, '#6e4e2f', 1, 9); p.px(7, 3, '#6e4e2f', 1, 9); p.px(12, 3, '#6e4e2f', 1, 9);
    p.stickerEdge('#c9a06a');
  }
  // crafting table side: planks + tools silhouette band
  {
    const p = P(TILE.CRAFT_SIDE);
    p.fill('#c9a06a');
    p.speckle('#dcb67f', 10); p.speckle('#b58a55', 10);
    p.px(0, 0, '#a97f50', 16, 3);
    p.px(2, 5, '#6e4e2f', 3, 4); p.px(3, 9, '#8a6240', 1, 4);
    p.px(10, 5, '#9aa0a8', 4, 2); p.px(11, 7, '#8a6240', 1, 6);
    p.px(0, 13, '#9c7443', 16, 1);
    p.stickerEdge('#c9a06a');
  }
  // furnace front: cobble + glowing mouth
  {
    const p = P(TILE.FURNACE_FRONT);
    p.fill('#8b9199');
    p.speckle('#a2a8b1', 14); p.speckle('#6f757d', 14);
    p.px(3, 7, '#2c2c30', 10, 7);
    p.px(4, 9, '#ff9e3d', 8, 4);
    p.px(5, 10, '#ffd447', 6, 2);
    p.px(6, 8, '#ff7b2e', 2, 1); p.px(10, 8, '#ff7b2e', 1, 1);
    p.px(3, 2, '#6f757d', 10, 2);
    p.stickerEdge('#8b9199');
  }
  // furnace top/side: plain cobble-ish
  {
    const p = P(TILE.FURNACE_TOP);
    p.fill('#8b9199');
    p.speckle('#a2a8b1', 16); p.speckle('#6f757d', 16);
    p.px(4, 4, '#75797f', 8, 8);
    p.px(5, 5, '#606468', 6, 6);
    p.stickerEdge('#8b9199');
  }
}

// Builds the atlas canvas. Returns { canvas }. Call once at startup on the main thread.
export function buildAtlasCanvas() {
  const { canvas, ctx } = makeCtx(ATLAS_SIZE, ATLAS_SIZE);
  const rng = mulberry32(0x9e3779b9);
  drawTiles(ctx, rng);
  return canvas;
}

// Standalone scrolling water texture (RepeatWrapping) for the water pass.
export function buildWaterCanvas() {
  const { canvas, ctx } = makeCtx(32, 32);
  const rng = mulberry32(0x1234abcd);
  ctx.fillStyle = '#3f8fd6';
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rng() < 0.5 ? '#4f9de2' : '#3781c4';
    ctx.fillRect((rng() * 32) | 0, (rng() * 32) | 0, 1 + ((rng() * 2) | 0), 1);
  }
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = '#8ec4ec';
    ctx.fillRect((rng() * 28) | 0, (rng() * 32) | 0, 2 + ((rng() * 4) | 0), 1);
  }
  return canvas;
}

// Five crack-stage overlay textures for the breaking decal.
export function buildCrackCanvases() {
  const out = [];
  for (let stage = 0; stage < 5; stage++) {
    const { canvas, ctx } = makeCtx(16, 16);
    const rng = mulberry32(0xc0ffee + stage * 977);
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = 'rgba(20,14,10,0.85)';
    const cracks = 2 + stage * 2;
    for (let c = 0; c < cracks; c++) {
      let x = 4 + ((rng() * 8) | 0), y = 4 + ((rng() * 8) | 0);
      const len = 3 + stage * 2 + ((rng() * 3) | 0);
      for (let i = 0; i < len; i++) {
        ctx.fillRect(x, y, 1, 1);
        if (stage >= 3 && rng() < 0.3) ctx.fillRect(x + 1, y, 1, 1);
        const d = rng();
        if (d < 0.25) x++; else if (d < 0.5) x--; else if (d < 0.75) y++; else y--;
        x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
      }
    }
    out.push(canvas);
  }
  return out;
}
