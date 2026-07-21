// Voxelgarden — boot + game loop.
// Phase 7: mobs, combat, health/damage, death & respawn.
import * as THREE from 'three';
import { buildAtlasCanvas, buildWaterCanvas } from './world/atlas.js';
import { World, RENDER_DIST } from './world/world.js';
import { WorldGen } from './world/worldgen.js';
import { B, BLOCKS, isSolid } from './world/blocks.js';
import { Controls } from './player/controls.js';
import { Player } from './player/player.js';
import { Interact } from './player/interact.js';
import { Sky } from './env/sky.js';
import { UnderwaterFX } from './env/water.js';
import { AudioSys, blockFamily } from './audio.js';
import { ITEMS } from './items/items.js';
import { Inventory } from './items/inventory.js';
import { Drops } from './items/drops.js';
import { Furnaces } from './items/furnace.js';
import { buildIcons } from './ui/icons.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { MobManager } from './mobs/spawner.js';
import { DeathScreen } from './ui/death.js';
import { Particles } from './env/particles.js';

const app = document.getElementById('app');
const hud = document.getElementById('hud');

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
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

// day/night tint is injected as a uniform so glow (lantern) vertices can skip it
const tintUniform = { value: new THREE.Color(1, 1, 1) };
const solidMat = new THREE.MeshBasicMaterial({
  map: atlasTex, vertexColors: true, alphaTest: 0.5,
});
solidMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTint = tintUniform;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
    .replace('#include <color_vertex>', '#include <color_vertex>\nvGlow = glow;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uTint;\nvarying float vGlow;')
    .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(uTint, vec3(1.0), vGlow);');
};
const waterMat = new THREE.MeshBasicMaterial({
  map: waterTex, vertexColors: true, transparent: true, opacity: 0.65,
  depthWrite: false, side: THREE.DoubleSide,
});

// representative colors per block for break-burst particles
const BREAK_COLORS = {
  [B.GRASS]: [[0.42, 0.77, 0.32], [0.34, 0.66, 0.25], [0.66, 0.48, 0.31]],
  [B.DIRT]: [[0.66, 0.48, 0.31], [0.54, 0.38, 0.25]],
  [B.STONE]: [[0.6, 0.63, 0.66], [0.5, 0.53, 0.56]],
  [B.COBBLE]: [[0.55, 0.58, 0.6], [0.43, 0.46, 0.49]],
  [B.SAND]: [[0.93, 0.85, 0.63], [0.85, 0.76, 0.52]],
  [B.LOG]: [[0.48, 0.35, 0.23], [0.55, 0.42, 0.28]],
  [B.PLANKS]: [[0.79, 0.63, 0.42], [0.71, 0.55, 0.33]],
  [B.LEAVES]: [[0.31, 0.62, 0.31], [0.24, 0.51, 0.24]],
  [B.SNOW]: [[0.96, 0.97, 1.0], [0.87, 0.91, 0.96]],
  [B.CACTUS]: [[0.25, 0.56, 0.31], [0.18, 0.45, 0.25]],
};
const DEFAULT_BREAK = [[0.6, 0.6, 0.6], [0.45, 0.45, 0.45]];
function breakColors(id) { return BREAK_COLORS[id] || DEFAULT_BREAK; }

// ---- world & player ----
const seed = new URLSearchParams(location.search).get('seed') || 'voxelgarden';
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

const sky = new Sky(scene);
const audio = new AudioSys();
const underwaterFX = new UnderwaterFX(hud);
const particles = new Particles(scene);

// red damage flash overlay
const flashEl = document.createElement('div');
flashEl.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:8;
  background:radial-gradient(ellipse at center, rgba(160,10,8,0) 40%, rgba(160,10,8,.5) 100%);
  opacity:0;transition:opacity .35s;`;
hud.appendChild(flashEl);
function damageFlash() {
  flashEl.style.transition = 'none';
  flashEl.style.opacity = '1';
  requestAnimationFrame(() => {
    flashEl.style.transition = 'opacity .4s';
    flashEl.style.opacity = '0';
  });
}

const controls = new Controls(renderer.domElement);
renderer.domElement.addEventListener('click', () => { controls.lock(); audio.ensure(); });
const interact = new Interact(scene, world, player, camera, controls);

// ---- items, inventory, crafting, furnace ----
const inventory = new Inventory();
const furnaces = new Furnaces();
const { icons, canvases: iconCanvases } = buildIcons(atlasTex);
const drops = new Drops(scene, world, atlasTex, iconCanvases);
const hudUI = new Hud(hud, inventory, icons);
const screens = new Screens(hud, inventory, furnaces, icons, audio, drops);
screens.spillAt = () => [player.pos.x, player.pos.y + 0.6, player.pos.z];
inventory.onChange = () => { hudUI.render(); if (screens.isOpen) screens.render(); };
screens.onOpenChange = (open) => {
  controls.enabled = !open;
  if (open) controls.unlock();
  else controls.lock();
};

// what the selected hotbar item can do
interact.getPlaceBlock = () => {
  const it = inventory.selectedItem();
  return it && it.kind === 'block' ? it.block : 0;
};
interact.consumePlaced = () => player.creative ? true : inventory.consumeSelected(1);
interact.speedMultiplier = (blockId) => {
  const held = inventory.selectedItem();
  const b = BLOCKS[blockId];
  if (held && held.kind === 'tool' && b.tool && held.tool === b.tool) return held.speed;
  return 1;
};

interact.onBreak = (x, y, z, id) => {
  audio.breakBlock(blockFamily(BLOCKS[id].name));
  particles.burstBlock(x, y, z, breakColors(id));
  if (id === B.FURNACE) {
    for (const s of furnaces.breakAt(x, y, z)) drops.spawn(x + 0.5, y + 0.3, z + 0.5, s.id, s.count);
  }
  if (player.creative) return; // creative breaking yields no drops
  const b = BLOCKS[id];
  const itemId = b.drops && ITEMS[b.drops] ? b.drops : null;
  if (!itemId) return;
  if (b.tier > 0) {
    const held = inventory.selectedItem();
    if (!held || held.tool !== 'pick' || held.tier < b.tier) return; // wrong pick tier: no drop
  }
  drops.spawn(x + 0.5, y + 0.25, z + 0.5, itemId);
};
interact.onPlace = (x, y, z, id) => audio.place(blockFamily(BLOCKS[id].name));
let breakTickAcc = 0;
interact.onBreakTick = (x, y, z, id) => {
  breakTickAcc += 1;
  if (breakTickAcc % 12 === 0) audio.breakTick(blockFamily(BLOCKS[id].name));
};
interact.onUseBlock = (x, y, z, id) => {
  if (id === B.CRAFT) { screens.open('craft'); return true; }
  if (id === B.FURNACE) { screens.open('furnace', [x, y, z]); return true; }
  return false;
};

// ---- mobs & combat ----
const mobs = new MobManager(scene, world);
mobs.onPoof = (x, y, z, kind) => {
  particles.burstPoof(x, y, z, kind);
  audio.poof();
};
// reject placing a block that would intersect a mob
interact.entityAt = (minX, minY, minZ, maxX, maxY, maxZ) =>
  mobs.anyIntersecting(minX, minY, minZ, maxX, maxY, maxZ);

const _atkOrigin = new THREE.Vector3();
const _atkDir = new THREE.Vector3();
let attackCooldown = 0;
interact.onAttack = () => {
  if (attackCooldown > 0 || screens.isOpen) return false;
  camera.getWorldDirection(_atkDir);
  _atkOrigin.copy(camera.position);
  const mob = mobs.attackFrom(_atkOrigin, _atkDir, 4);
  if (!mob) return false;
  attackCooldown = 0.4;
  const held = inventory.selectedItem();
  const dmg = held && held.tool === 'sword' ? held.damage : 1;
  mob.hurt(dmg, { x: _atkDir.x, z: _atkDir.z });
  particles.burstHit(mob.pos.x, mob.pos.y + mob.height * 0.6, mob.pos.z);
  audio.thump();
  return true;
};

// ---- player damage plumbing ----
player.onFall = (blocks) => {
  const halfHearts = Math.floor(blocks) - 3;
  if (halfHearts > 0) { player.damage(halfHearts); audio.hurt(); }
};
player.onDamaged = () => { audio.hurt(); damageFlash(); };
const deathScreen = new DeathScreen(hud, () => respawn());
player.onDeath = () => {
  drops.spawnInventory(inventory, player.pos.x, player.pos.y + 0.6, player.pos.z);
  hudUI.render();
  audio.death();
  controls.unlock();
  controls.enabled = false;
  if (screens.isOpen) screens.close();
  deathScreen.show();
};
function respawn() {
  player.respawn();
  deathScreen.hide();
  controls.enabled = true;
  controls.lock();
}

function selectSlot(i) {
  inventory.selected = i;
  hudUI.render();
  const s = inventory.slots[i];
  if (s) hudUI.showToast(ITEMS[s.id].id);
}

controls.onKeyPress = (code, e) => {
  if (code.startsWith('Digit') && !screens.isOpen) {
    const n = Number(code.slice(5));
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  }
  if (code === 'KeyE') {
    if (screens.isOpen) screens.close();
    else screens.open('inventory');
  }
  if (code === 'Escape' && screens.isOpen) screens.close();
  if (code === 'F4') {
    player.creative = !player.creative;
    if (!player.creative) player.flying = false;
    hudUI.showToast(player.creative ? 'creative mode' : 'survival mode');
  }
};
controls.onDoubleSpace = () => {
  if (player.creative) { player.flying = !player.flying; player.vel.y = 0; }
};
controls.onWheel = (dy) => {
  if (screens.isOpen) return;
  selectSlot((inventory.selected + (dy > 0 ? 1 : -1) + 9) % 9);
};

// ---- HUD ----
const hint = document.createElement('div');
hint.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  background:rgba(255,246,229,.92);color:#2e2a26;padding:14px 22px;border-radius:14px;
  font-size:15px;letter-spacing:.02em;pointer-events:none;text-align:center;line-height:1.5;`;
hint.innerHTML = 'Click to play<br><span style="font-size:12px">WASD move · Space jump · LMB break · RMB place · E inventory · 1-9/wheel hotbar</span>';
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


// ---- loop ----
let last = performance.now();
let frames = 0, fpsTime = 0, fps = 0;
let wasUnderwater = false, wasInWater = false, stepAcc = 0;

const perf = { player: 0, interact: 0, world: 0, sky: 0, render: 0, other: 0, frames: 0 };
window.__perf = perf;
function mark() { return performance.now(); }

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }
  const t0 = mark();

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
  const t1 = mark(); perf.player += t1 - t0;

  // camera follows the player's eye; sprint eases FOV out
  player.eyePosition(camera.position);
  controls.applyLook(camera);
  const targetFov = player.sprinting ? 78 : 75;
  camera.fov += (targetFov - camera.fov) * Math.min(1, 8 * dt);
  camera.updateProjectionMatrix();

  attackCooldown = Math.max(0, attackCooldown - dt);
  player.updateVitals(dt);

  interact.update(dt);
  const t2 = mark(); perf.interact += t2 - t1;
  world.update(player.pos.x, player.pos.z);
  drops.update(dt, player, inventory, () => audio.pickup());
  furnaces.update(dt, () => audio.smeltPop());
  mobs.update(dt, {
    player, sky, tint: sky.tint,
    damagePlayer: (amt, dir) => player.damage(amt, dir),
  });
  particles.update(dt);
  screens.update(dt);
  hudUI.updateVitals(player);
  const t3 = mark(); perf.world += t3 - t2;

  // environment
  sky.update(dt, camera.position, scene.fog);
  tintUniform.value.copy(sky.tint);
  waterMat.color.copy(sky.tint);
  underwaterFX.update(player.headInWater, scene.fog, viewEdge);
  if (player.headInWater !== wasUnderwater) {
    audio.setUnderwater(player.headInWater);
    wasUnderwater = player.headInWater;
  }
  if (player.inWater && !wasInWater && player.vel.y < -3) {
    audio.splash();
    particles.splash(player.pos.x, Math.floor(player.pos.y) + 1, player.pos.z);
  }
  wasInWater = player.inWater;
  audio.update(dt, { nightness: sky.nightness, underwater: player.headInWater });

  // footsteps timed to movement
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && hSpeed > 0.8) {
    stepAcc += hSpeed * dt;
    if (stepAcc > 2.2) {
      stepAcc = 0;
      const under = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.3), Math.floor(player.pos.z));
      if (under) audio.footstep(blockFamily(BLOCKS[under].name));
    }
  } else stepAcc = 0;

  waterTex.offset.x = (now / 1000) * 0.03;
  waterTex.offset.y = (now / 1000) * 0.011;

  const t4 = mark(); perf.sky += t4 - t3;
  controls.endFrame();
  renderer.render(scene, camera);
  perf.render += mark() - t4;
  perf.frames++;
  const p = player.pos;
  stats.textContent = `${fps} fps · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} · chunk ${Math.floor(p.x) >> 4},${Math.floor(p.z) >> 4} · loaded ${world.loadedCount} · draws ${renderer.info.render.calls}${player.onGround ? ' · ground' : ''}${player.inWater ? ' · water' : ''}`;
}
requestAnimationFrame(tick);

// debug/testing handle
window.__vg = { camera, world, controls, player, interact, sky, audio, renderer, tintUniform, solidMat, inventory, drops, furnaces, screens, mobs, particles };
