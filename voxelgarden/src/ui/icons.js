// Item icons, generated once at startup.
// Block items: snapshotted from a tiny offscreen orthographic Three scene.
// Tools/materials: crisp 16x16 pixel art painted with the palette.
import * as THREE from 'three';
import { BLOCKS } from '../world/blocks.js';
import { uvRect } from '../world/atlas.js';
import { ITEMS } from '../items/items.js';

const SIZE = 48;

function blockIconRenderer(atlasTex) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-0.82, 0.82, 0.82, -0.82, 0.1, 10);
  cam.position.set(1.6, 1.35, 1.6);
  cam.lookAt(0, -0.04, 0);
  const mat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.4 });

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const colors = new Float32Array(24 * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const FACE_SHADE = [0.74, 0.74, 1.0, 0.5, 0.88, 0.88];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const s = FACE_SHADE[f];
      colors.set([s, s, s], (f * 4 + v) * 3);
    }
  }

  return {
    snapshot(blockId) {
      const b = BLOCKS[blockId];
      const uv = geo.attributes.uv;
      for (let f = 0; f < 6; f++) {
        const tile = f === 2 ? b.tiles[0] : f === 3 ? b.tiles[1] : b.tiles[2];
        const [u0, v0, u1, v1] = uvRect(tile);
        // BoxGeometry uv order per face: (0,1),(1,1),(0,0),(1,0)
        uv.setXY(f * 4 + 0, u0, v1);
        uv.setXY(f * 4 + 1, u1, v1);
        uv.setXY(f * 4 + 2, u0, v0);
        uv.setXY(f * 4 + 3, u1, v0);
      }
      uv.needsUpdate = true;
      renderer.render(scene, cam);
      return renderer.domElement.toDataURL();
    },
    dispose() { renderer.dispose(); geo.dispose(); },
  };
}

// ---- 2D pixel icons ---------------------------------------------------------
const TIER_COLORS = {
  wood: ['#c9a06a', '#a97f50'], stone: ['#9aa0a8', '#7e848d'],
  iron: ['#e3dbd2', '#c9bfb4'], diamond: ['#7fe7e0', '#4fc4bc'],
};
const STICK = ['#a97f50', '#8a6240'];

function px(ctx, x, y, c, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function drawTool(ctx, type, tier) {
  const [main, dark] = TIER_COLORS[tier];
  if (type === 'pick') {
    for (let i = 0; i < 8; i++) px(ctx, 4 + i, 11 - i, STICK[0]);
    for (let i = 0; i < 8; i++) px(ctx, 5 + i, 11 - i, STICK[1]);
    px(ctx, 2, 3, main, 5, 2); px(ctx, 6, 2, main, 5, 2); px(ctx, 10, 3, main, 4, 2);
    px(ctx, 13, 4, main, 2, 3); px(ctx, 1, 4, main, 2, 3);
    px(ctx, 2, 5, dark, 1, 2); px(ctx, 14, 6, dark, 1, 2);
  } else if (type === 'axe') {
    for (let i = 0; i < 9; i++) px(ctx, 4 + i, 12 - i, STICK[0]);
    for (let i = 0; i < 9; i++) px(ctx, 5 + i, 12 - i, STICK[1]);
    px(ctx, 7, 1, main, 6, 3); px(ctx, 5, 2, main, 4, 5); px(ctx, 4, 4, main, 3, 3);
    px(ctx, 5, 6, dark, 2, 1); px(ctx, 12, 1, dark, 1, 3);
  } else if (type === 'shovel') {
    px(ctx, 7, 5, STICK[0], 2, 8);
    px(ctx, 8, 5, STICK[1], 1, 8);
    px(ctx, 5, 1, main, 6, 4); px(ctx, 6, 5, main, 4, 1);
    px(ctx, 9, 1, dark, 2, 4);
  } else if (type === 'sword') {
    for (let i = 0; i < 9; i++) { px(ctx, 4 + i, 10 - i, main, 2, 1); }
    for (let i = 0; i < 9; i++) { px(ctx, 5 + i, 10 - i, dark, 1, 1); }
    px(ctx, 4, 10, '#5c4a33', 4, 1); px(ctx, 6, 8, '#5c4a33', 1, 4);
    px(ctx, 3, 12, STICK[1], 3, 3);
  }
}

function drawMaterial(ctx, id) {
  if (id === 'stick') {
    for (let i = 0; i < 9; i++) px(ctx, 4 + i, 12 - i, STICK[0], 2, 1);
    for (let i = 0; i < 9; i++) px(ctx, 5 + i, 12 - i, STICK[1], 1, 1);
  } else if (id === 'coal') {
    px(ctx, 4, 5, '#2b2b2b', 8, 7); px(ctx, 6, 3, '#2b2b2b', 5, 3); px(ctx, 3, 7, '#2b2b2b', 2, 4);
    px(ctx, 5, 5, '#4a4a4a', 3, 2); px(ctx, 9, 8, '#111111', 2, 3);
  } else if (id === 'iron ingot' || id === 'gold ingot') {
    const [main, hi, dark] = id === 'gold ingot'
      ? ['#ffd447', '#ffe98f', '#c9a020'] : ['#d8a37b', '#f0c39a', '#a87c5a'];
    px(ctx, 3, 7, main, 10, 5);
    px(ctx, 4, 5, main, 10, 2);
    px(ctx, 4, 5, hi, 10, 1);
    px(ctx, 3, 11, dark, 10, 1);
    px(ctx, 13, 6, dark, 1, 5);
  } else if (id === 'diamond') {
    px(ctx, 6, 3, '#7fe7e0', 4, 2); px(ctx, 4, 5, '#7fe7e0', 8, 3);
    px(ctx, 5, 8, '#7fe7e0', 6, 2); px(ctx, 6, 10, '#7fe7e0', 4, 1); px(ctx, 7, 11, '#7fe7e0', 2, 1);
    px(ctx, 6, 4, '#c2fbf7', 2, 2); px(ctx, 5, 7, '#4fc4bc', 6, 1); px(ctx, 7, 9, '#4fc4bc', 3, 1);
  }
}

// Builds { icons: Map<id, dataURL>, canvases: Map<id, canvas> }
export function buildIcons(atlasTex) {
  const icons = new Map();
  const canvases = new Map();
  const blockSnap = blockIconRenderer(atlasTex);

  for (const id of Object.keys(ITEMS)) {
    const it = ITEMS[id];
    if (it.kind === 'block') {
      icons.set(id, blockSnap.snapshot(it.block));
    } else {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const ctx = c.getContext('2d');
      if (it.kind === 'tool') drawTool(ctx, it.tool, id.split(' ')[0]);
      else drawMaterial(ctx, id);
      canvases.set(id, c);
      icons.set(id, c.toDataURL());
    }
  }
  blockSnap.dispose();
  return { icons, canvases };
}
