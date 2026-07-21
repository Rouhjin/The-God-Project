// Voxelgarden — boot + game loop.
// Phase 3: walking player with collision, targeting, breaking and placing.
import * as THREE from 'three';
import { buildAtlasCanvas, buildWaterCanvas } from './world/atlas.js';
import { World, RENDER_DIST } from './world/world.js';
import { WorldGen } from './world/worldgen.js';
import { B, BLOCKS, isSolid } from './world/blocks.js';
import { Controls } from './player/controls.js';
import { Player } from './player/player.js';
import { Interact } from './player/interact.js';

const app = document.getElementById('app');
const hud = document.getElementById('hud');

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87c9ff');
const viewEdge = RENDER_DIST * 16;
scene.fog = new THREE.Fog('#a8d8ff', viewEdge * 0.55, viewEdge * 0.95);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
camera.rotation.order = 'YXZ';

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- materials from the procedural atlas ----
const atlasTex = new THREE.CanvasTexture(buildAtlasCanvas());
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.colorSpace = THREE.SRGBColorSpace;

const waterTex = new THREE.CanvasTexture(buildWaterCanvas());
waterTex.magFilter = THREE.NearestFilter;
waterTex.minFilter = THREE.NearestFilter;
waterTex.generateMipmaps = false;
waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
waterTex.colorSpace = THREE.SRGBColorSpace;

const solidMat = new THREE.MeshBasicMaterial({
  map: atlasTex, vertexColors: true, alphaTest: 0.5,
});
const waterMat = new THREE.MeshBasicMaterial({
  map: waterTex, vertexColors: true, transparent: true, opacity: 0.65,
  depthWrite: false, side: THREE.DoubleSide,
});

// ---- world & player ----
const seed = 'voxelgarden';
const world = new World(scene, solidMat, waterMat, seed);
const gen = new WorldGen(seed);

// find a dry-land spawn near the origin (deterministic per seed)
function findSpawn() {
  for (let r = 0; r <= 40; r++) {
    for (let a = 0; a < Math.max(1, r * 4); a++) {
      const ang = (a / Math.max(1, r * 4)) * Math.PI * 2;
      const x = Math.round(Math.cos(ang) * r * 8), z = Math.round(Math.sin(ang) * r * 8);
      const h = gen.heightAt(x, z);
      if (h >= 36 && h <= 60) return new THREE.Vector3(x + 0.5, h + 1.01, z + 0.5);
    }
  }
  return new THREE.Vector3(8.5, gen.heightAt(8, 8) + 1.01, 8.5);
}
const player = new Player(world, findSpawn());
let spawnSettled = false;

const controls = new Controls(renderer.domElement);
renderer.domElement.addEventListener('click', () => controls.lock());
const interact = new Interact(scene, world, player, camera, controls);

// Phase 3 building palette (replaced by real inventory in Phase 6)
const palette = [B.PLANKS, B.COBBLE, B.GLASS, B.LANTERN, B.LOG, B.LEAVES, B.SAND, B.CRAFT, B.FURNACE];
let paletteIdx = 0;
interact.getPlaceBlock = () => palette[paletteIdx];

controls.onKeyPress = (code) => {
  if (code.startsWith('Digit')) {
    const n = Number(code.slice(5));
    if (n >= 1 && n <= palette.length) { paletteIdx = n - 1; updatePaletteHud(); }
  }
  if (code === 'F4') {
    player.creative = !player.creative;
    if (!player.creative) player.flying = false;
    updatePaletteHud();
  }
};
controls.onDoubleSpace = () => {
  if (player.creative) { player.flying = !player.flying; player.vel.y = 0; }
};
controls.onWheel = (dy) => {
  paletteIdx = (paletteIdx + (dy > 0 ? 1 : -1) + palette.length) % palette.length;
  updatePaletteHud();
};

// ---- HUD ----
const hint = document.createElement('div');
hint.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  background:rgba(255,246,229,.92);color:#2e2a26;padding:14px 22px;border-radius:14px;
  font-size:15px;letter-spacing:.02em;pointer-events:none;text-align:center;line-height:1.5;`;
hint.innerHTML = 'Click to play<br><span style="font-size:12px">WASD move · Space jump · LMB break · RMB place · 1-9/wheel select · F4 creative</span>';
hud.appendChild(hint);
controls.onLockChange = (locked) => { hint.style.display = locked ? 'none' : 'block'; };

const crosshair = document.createElement('div');
crosshair.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:18px;height:18px;pointer-events:none;opacity:.85;mix-blend-mode:difference;`;
crosshair.innerHTML = `<div style="position:absolute;left:8px;top:0;width:2px;height:18px;background:#fff"></div>
  <div style="position:absolute;left:0;top:8px;width:18px;height:2px;background:#fff"></div>`;
hud.appendChild(crosshair);

const stats = document.createElement('div');
stats.style.cssText = `position:absolute;top:8px;left:8px;background:rgba(46,42,38,.6);
  color:#fff6e5;padding:6px 10px;border-radius:8px;font-size:12px;font-family:monospace;`;
hud.appendChild(stats);

const paletteHud = document.createElement('div');
paletteHud.style.cssText = `position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
  background:rgba(255,246,229,.9);color:#2e2a26;padding:8px 14px;border-radius:12px;font-size:13px;`;
hud.appendChild(paletteHud);
function updatePaletteHud() {
  paletteHud.textContent = `[${paletteIdx + 1}] ${BLOCKS[palette[paletteIdx]].name}` +
    (player.creative ? ` · CREATIVE${player.flying ? ' (flying)' : ''}` : '');
}
updatePaletteHud();

// ---- loop ----
let last = performance.now();
let frames = 0, fpsTime = 0, fps = 0;

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }

  // settle spawn once terrain exists (avoid spawning inside a tree or hill lip)
  if (!spawnSettled && world.isChunkReady(Math.floor(player.pos.x), Math.floor(player.pos.z))) {
    const bx = Math.floor(player.pos.x), bz = Math.floor(player.pos.z);
    let y = Math.floor(player.pos.y);
    while (y < 94 && (isSolid(world.getBlock(bx, y, bz)) || isSolid(world.getBlock(bx, y + 1, bz)))) y++;
    player.pos.y = y + 0.01;
    player.spawnPoint.copy(player.pos);
    spawnSettled = true;
  }

  player.update(dt, controls);

  // camera follows the player's eye; sprint eases FOV out
  player.eyePosition(camera.position);
  controls.applyLook(camera);
  const targetFov = player.sprinting ? 78 : 75;
  camera.fov += (targetFov - camera.fov) * Math.min(1, 8 * dt);
  camera.updateProjectionMatrix();

  interact.update(dt);
  world.update(player.pos.x, player.pos.z);

  waterTex.offset.x = (now / 1000) * 0.03;
  waterTex.offset.y = (now / 1000) * 0.011;

  controls.endFrame();
  renderer.render(scene, camera);
  const p = player.pos;
  stats.textContent = `${fps} fps · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} · chunk ${Math.floor(p.x) >> 4},${Math.floor(p.z) >> 4} · loaded ${world.loadedCount} · draws ${renderer.info.render.calls}${player.onGround ? ' · ground' : ''}${player.inWater ? ' · water' : ''}`;
}
requestAnimationFrame(tick);

// debug/testing handle
window.__vg = { camera, world, controls, player, interact };
