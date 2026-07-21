// Voxelgarden — boot, game loop, and state machine (title / playing / paused / dead).
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
import { TitleScreen, PauseMenu, DebugOverlay } from './ui/menus.js';
import { SaveManager } from './save.js';
import { CYCLE_SECONDS } from './env/sky.js';

const app = document.getElementById('app');
const hud = document.getElementById('hud');

// ---- renderer / scene (persist across worlds) ----
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

// ---- procedural textures / materials ----
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

// Flood-fill lighting: skyLight (dimmed by time of day via uSkyColor) + blockLight
// (warm, time-independent) are combined per fragment. uSkyColor carries the day/night
// horizon tint AND its brightness, so night surfaces go dim-blue and unlit caves fall
// to uAmbient — genuinely dark until you place a lantern.
const skyColorUniform = { value: new THREE.Color(1, 1, 1) };   // = sky.tint each frame
const blockColorUniform = { value: new THREE.Color(1.0, 0.82, 0.5) }; // warm lantern light
const ambientUniform = { value: 0.05 };
function patchLighting(shader) {
  shader.uniforms.uSkyColor = skyColorUniform;
  shader.uniforms.uBlockColor = blockColorUniform;
  shader.uniforms.uAmbient = ambientUniform;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float skyLight;\nattribute float blockLight;\nvarying float vSky;\nvarying float vBlock;')
    .replace('#include <color_vertex>', '#include <color_vertex>\nvSky = skyLight;\nvBlock = blockLight;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uSkyColor;\nuniform vec3 uBlockColor;\nuniform float uAmbient;\nvarying float vSky;\nvarying float vBlock;')
    .replace('#include <color_fragment>',
      '#include <color_fragment>\n' +
      '  vec3 vgLight = uSkyColor * vSky + uBlockColor * vBlock;\n' +
      '  vgLight = clamp(vgLight, vec3(uAmbient), vec3(1.0));\n' +
      '  diffuseColor.rgb *= vgLight;');
}
const solidMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
solidMat.onBeforeCompile = patchLighting;
const waterMat = new THREE.MeshBasicMaterial({
  map: waterTex, vertexColors: true, transparent: true, opacity: 0.65,
  depthWrite: false, side: THREE.DoubleSide,
});
waterMat.onBeforeCompile = patchLighting;

// representative break-burst colors per block
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

// ---- persistent systems ----
const sky = new Sky(scene);
const audio = new AudioSys();
const underwaterFX = new UnderwaterFX(hud);
const particles = new Particles(scene);
const saveManager = new SaveManager();

const world = new World(scene, solidMat, waterMat, 'voxelgarden');
const player = new Player(world, new THREE.Vector3(8, 60, 8));
const controls = new Controls(renderer.domElement);
const interact = new Interact(scene, world, player, camera, controls);
const inventory = new Inventory();
const furnaces = new Furnaces();
const { icons, canvases: iconCanvases } = buildIcons(atlasTex);
const drops = new Drops(scene, world, atlasTex, iconCanvases);
const hudUI = new Hud(hud, inventory, icons);
const screens = new Screens(hud, inventory, furnaces, icons, audio, drops);
const mobs = new MobManager(scene, world);

// red damage flash overlay
const flashEl = document.createElement('div');
flashEl.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:8;
  background:radial-gradient(ellipse at center, rgba(160,10,8,0) 40%, rgba(160,10,8,.5) 100%);
  opacity:0;transition:opacity .35s;`;
hud.appendChild(flashEl);
function damageFlash() {
  flashEl.style.transition = 'none';
  flashEl.style.opacity = '1';
  requestAnimationFrame(() => { flashEl.style.transition = 'opacity .4s'; flashEl.style.opacity = '0'; });
}

// ---- state machine ----
let state = 'title';            // 'title' | 'playing' | 'paused' | 'dead'
let currentSeed = 'voxelgarden';
let gen = new WorldGen(currentSeed);
let spawnSettled = false;
let titleAngle = 0;

function findSpawn(g) {
  for (let r = 0; r <= 40; r++) {
    for (let a = 0; a < Math.max(1, r * 4); a++) {
      const ang = (a / Math.max(1, r * 4)) * Math.PI * 2;
      const x = Math.round(Math.cos(ang) * r * 8), z = Math.round(Math.sin(ang) * r * 8);
      const h = g.heightAt(x, z);
      if (h >= 36 && h <= 60) return new THREE.Vector3(x + 0.5, h + 1.01, z + 0.5);
    }
  }
  return new THREE.Vector3(8.5, g.heightAt(8, 8) + 1.01, 8.5);
}

// ---- world lifecycle ----
function loadWorld(seed) {
  currentSeed = seed;
  gen = new WorldGen(seed);
  world.reset(seed);
  inventory.clear();
  furnaces.map.clear();
  drops.clearAll();
  mobs.clearAll();
  const spawn = findSpawn(gen);
  player.pos.copy(spawn);
  player.spawnPoint.copy(spawn);
  player.vel.set(0, 0, 0);
  player.health = 20; player.air = 10; player.dead = false;
  player.timeSinceDamage = 999; player.creative = false; player.flying = false;
  player.fallStartY = player.pos.y; // avoid a phantom fall on the first grounded frame
  spawnSettled = false;
  sky.time = 0.04 * CYCLE_SECONDS;
}

function applySave(meta, chunks) {
  if (chunks && chunks.length) world.restoreEditedChunks(chunks);
  if (meta) {
    sky.time = meta.time ?? sky.time;
    if (meta.player) {
      const p = meta.player;
      if (p.pos) player.pos.set(p.pos[0], p.pos[1], p.pos[2]);
      if (p.spawn) player.spawnPoint.set(p.spawn[0], p.spawn[1], p.spawn[2]);
      if (p.rot) { controls.yaw = p.rot[0]; controls.pitch = p.rot[1]; }
      player.health = p.health ?? 20;
      player.air = p.air ?? 10;
      player.vel.set(0, 0, 0);
      player.fallStartY = player.pos.y;
      player.dead = false;
      spawnSettled = true; // trust the saved position
    }
    if (meta.inventory) inventory.restore(meta.inventory);
    if (meta.furnaces) furnaces.restore(meta.furnaces);
    if (meta.drops) drops.restore(meta.drops);
  }
  hudUI.render();
}

function collectSave() {
  return {
    meta: {
      seed: currentSeed,
      time: sky.time,
      player: {
        pos: [player.pos.x, player.pos.y, player.pos.z],
        rot: [controls.yaw, controls.pitch],
        spawn: [player.spawnPoint.x, player.spawnPoint.y, player.spawnPoint.z],
        health: player.health, air: player.air,
      },
      inventory: inventory.serialize(),
      furnaces: furnaces.serialize(),
      drops: drops.serialize(),
    },
    chunks: world.getEditedChunks(),
  };
}

async function doSave() {
  if (state === 'title') return;
  const { meta, chunks } = collectSave();
  try { await saveManager.save(meta, chunks); } catch (e) { console.warn('save failed', e); }
}

// ---- state transitions ----
function enterPlaying() {
  state = 'playing';
  titleScreen.hide();
  pauseMenu.close();
  deathScreen.hide();
  hint.style.display = 'block';
  controls.enabled = true;
}
function enterTitle() {
  state = 'title';
  controls.unlock();
  controls.enabled = false;
  hint.style.display = 'none';
  pauseMenu.close();
  deathScreen.hide();
  if (screens.isOpen) screens.close();
  titleScreen.show();
  updateTitleHasSave();
}
function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    controls.unlock();
    controls.enabled = false;
    pauseMenu.open();
  } else if (state === 'paused') {
    state = 'playing';
    pauseMenu.close();
    controls.enabled = true;
    controls.lock();
  }
}

// ---- UI shells ----
const titleScreen = new TitleScreen(hud, {
  hasSave: false,
  onContinue: async () => {
    const meta = await saveManager.loadMeta();
    const chunks = await saveManager.loadChunks();
    audio.ensure();
    if (meta && meta.seed !== currentSeed) loadWorld(meta.seed);
    applySave(meta, chunks);
    enterPlaying();
    controls.lock();
  },
  onNewWorld: async (seed) => {
    await saveManager.wipe();
    audio.ensure();
    loadWorld(seed);
    enterPlaying();
    controls.lock();
  },
});
async function updateTitleHasSave() {
  titleScreen.hasSave = await saveManager.hasSave();
  if (state === 'title') titleScreen.buildMain();
}

const pauseMenu = new PauseMenu(hud, {
  onResume: () => togglePause(),
  onSaveQuit: async () => { await doSave(); enterTitle(); },
});
const debugOverlay = new DebugOverlay(hud);
const deathScreen = new DeathScreen(hud, () => { player.respawn(); enterPlaying(); controls.lock(); });

// ---- HUD elements ----
const hint = document.createElement('div');
hint.style.cssText = `position:absolute;top:calc(50% + 40px);left:50%;transform:translate(-50%,-50%);
  background:rgba(255,246,229,.92);color:#2e2a26;padding:10px 18px;border-radius:12px;
  font-size:13px;letter-spacing:.02em;pointer-events:none;text-align:center;display:none;`;
hint.textContent = 'Click to lock the mouse';
hud.appendChild(hint);

const crosshair = document.createElement('div');
crosshair.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:18px;height:18px;pointer-events:none;opacity:.85;mix-blend-mode:difference;display:none;`;
crosshair.innerHTML = `<div style="position:absolute;left:8px;top:0;width:2px;height:18px;background:#fff"></div>
  <div style="position:absolute;left:0;top:8px;width:18px;height:2px;background:#fff"></div>`;
hud.appendChild(crosshair);

// ---- input wiring ----
renderer.domElement.addEventListener('click', () => {
  audio.ensure();
  if (state === 'playing') controls.lock();
});
controls.onLockChange = (locked) => {
  hint.style.display = (state === 'playing' && !locked) ? 'block' : 'none';
  crosshair.style.display = (state === 'playing' && locked) ? 'block' : 'none';
};

// item/tool interaction hooks
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
  if (player.creative) return;
  const b = BLOCKS[id];
  const held = inventory.selectedItem();
  // decide the drop with the tool as it is now (before wear)
  const itemId = b.drops && ITEMS[b.drops] ? b.drops : null;
  const tierOk = b.tier === 0 || (held && held.tool === 'pick' && held.tier >= b.tier);
  // wear down a tool used on this block
  if (held && held.kind === 'tool' && b.hardness > 0.1) {
    if (inventory.damageSelectedTool() === 'broke') { audio.hurt(); hudUI.showToast(held.id + ' broke'); }
  }
  if (itemId && tierOk) drops.spawn(x + 0.5, y + 0.25, z + 0.5, itemId);
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
  if (id === B.BED) { useBed(x, y, z); return true; }
  return false;
};
function useBed(x, y, z) {
  // set spawn on top of the bed
  player.spawnPoint.set(x + 0.5, y + 1.01, z + 0.5);
  hudUI.showToast('spawn point set');
  audio.click();
  if (sky.nightness > 0.4) {
    // skip to the next morning
    const day = Math.floor(sky.time / CYCLE_SECONDS);
    sky.time = (day + 1) * CYCLE_SECONDS + 0.03 * CYCLE_SECONDS;
    player.health = Math.min(20, player.health + 4); // a good night's rest
    hudUI.showToast('good morning');
    doSave();
  }
}
interact.entityAt = (a, b, c, d, e, f) => mobs.anyIntersecting(a, b, c, d, e, f);

const _atkDir = new THREE.Vector3();
const _atkOrigin = new THREE.Vector3();
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
  if (!player.creative && held && held.tool === 'sword') {
    if (inventory.damageSelectedTool() === 'broke') { audio.hurt(); hudUI.showToast(held.id + ' broke'); }
  }
  return true;
};

mobs.onPoof = (x, y, z, kind) => { particles.burstPoof(x, y, z, kind); audio.poof(); };

inventory.onChange = () => { hudUI.render(); if (screens.isOpen) screens.render(); };
screens.spillAt = () => [player.pos.x, player.pos.y + 0.6, player.pos.z];
screens.onOpenChange = (open) => {
  controls.enabled = !open && state === 'playing';
  if (open) controls.unlock();
  else if (state === 'playing') controls.lock();
};

player.onFall = (blocks) => {
  const hh = Math.floor(blocks) - 3;
  if (hh > 0) { player.damage(hh); audio.hurt(); damageFlash(); }
};
player.onDamaged = () => { audio.hurt(); damageFlash(); };
player.onDeath = () => {
  drops.spawnInventory(inventory, player.pos.x, player.pos.y + 0.6, player.pos.z);
  hudUI.render();
  audio.death();
  controls.unlock();
  controls.enabled = false;
  if (screens.isOpen) screens.close();
  state = 'dead';
  deathScreen.show();
};

function selectSlot(i) {
  inventory.selected = i;
  hudUI.render();
  const s = inventory.slots[i];
  if (s) hudUI.showToast(ITEMS[s.id].id);
}
controls.onKeyPress = (code) => {
  if (state !== 'playing' && state !== 'paused') return;
  if (code === 'Escape') {
    if (screens.isOpen) screens.close();
    else togglePause();
    return;
  }
  if (state !== 'playing') return;
  if (code.startsWith('Digit') && !screens.isOpen) {
    const n = Number(code.slice(5));
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  }
  if (code === 'KeyE') { if (screens.isOpen) screens.close(); else screens.open('inventory'); }
  if (code === 'F3') debugOverlay.toggle();
  if (code === 'F4') {
    player.creative = !player.creative;
    if (!player.creative) player.flying = false;
    hudUI.showToast(player.creative ? 'creative mode' : 'survival mode');
  }
};
controls.onDoubleSpace = () => { if (player.creative && state === 'playing') { player.flying = !player.flying; player.vel.y = 0; } };
controls.onWheel = (dy) => {
  if (state !== 'playing' || screens.isOpen) return;
  selectSlot((inventory.selected + (dy > 0 ? 1 : -1) + 9) % 9);
};

// ---- autosave ----
setInterval(() => { if (state === 'playing' || state === 'paused') doSave(); }, 20000);
document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });
window.addEventListener('beforeunload', () => { if (state !== 'title') doSave(); });

// ---- loop ----
let last = performance.now();
let frames = 0, fpsTime = 0, fps = 0;
let wasUnderwater = false, wasInWater = false, stepAcc = 0;
const perf = { player: 0, interact: 0, world: 0, sky: 0, render: 0, frames: 0 };
window.__perf = perf;
function mark() { return performance.now(); }

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }
  const t0 = mark();

  const simulate = state === 'playing' || state === 'dead';

  if (simulate) {
    if (!spawnSettled && world.isChunkReady(Math.floor(player.pos.x), Math.floor(player.pos.z))) {
      const bx = Math.floor(player.pos.x), bz = Math.floor(player.pos.z);
      let y = Math.floor(player.pos.y);
      while (y < 94 && (isSolid(world.getBlock(bx, y, bz)) || isSolid(world.getBlock(bx, y + 1, bz)))) y++;
      player.pos.y = y + 0.01;
      player.fallStartY = player.pos.y;
      if (player.spawnPoint.y < 1) player.spawnPoint.copy(player.pos);
      spawnSettled = true;
    }
    player.update(dt, controls);
    attackCooldown = Math.max(0, attackCooldown - dt);
    player.updateVitals(dt);
  }
  const t1 = mark(); perf.player += t1 - t0;

  if (state === 'title') {
    // slow orbit over the spawn area for the live backdrop
    titleAngle += dt * 0.06;
    const cx = player.spawnPoint.x, cz = player.spawnPoint.z, cy = player.spawnPoint.y;
    camera.position.set(cx + Math.cos(titleAngle) * 26, cy + 16, cz + Math.sin(titleAngle) * 26);
    camera.lookAt(cx, cy + 2, cz);
  } else {
    player.eyePosition(camera.position);
    controls.applyLook(camera);
    const targetFov = player.sprinting ? 78 : 75;
    camera.fov += (targetFov - camera.fov) * Math.min(1, 8 * dt);
    camera.updateProjectionMatrix();
  }

  if (simulate) interact.update(dt);
  else { interact.highlight.visible = false; interact.crackMesh.visible = false; }
  const t2 = mark(); perf.interact += t2 - t1;

  world.update(state === 'title' ? player.spawnPoint.x : player.pos.x,
               state === 'title' ? player.spawnPoint.z : player.pos.z);

  if (simulate) {
    drops.update(dt, player, inventory, () => audio.pickup());
    furnaces.update(dt, () => audio.smeltPop());
    mobs.update(dt, { player, sky, tint: sky.tint, damagePlayer: (a, d) => player.damage(a, d) });
  }
  particles.update(dt);
  screens.update(dt);
  hudUI.updateVitals(player);
  const t3 = mark(); perf.world += t3 - t2;

  // environment
  sky.update(dt, camera.position, scene.fog);
  skyColorUniform.value.copy(sky.tint);
  underwaterFX.update(simulate && player.headInWater, scene.fog, viewEdge);
  if (simulate) {
    if (player.headInWater !== wasUnderwater) { audio.setUnderwater(player.headInWater); wasUnderwater = player.headInWater; }
    if (player.inWater && !wasInWater && player.vel.y < -3) {
      audio.splash();
      particles.splash(player.pos.x, Math.floor(player.pos.y) + 1, player.pos.z);
    }
    wasInWater = player.inWater;
    audio.update(dt, { nightness: sky.nightness, underwater: player.headInWater });

    const hSpeed = Math.hypot(player.vel.x, player.vel.z);
    if (player.onGround && hSpeed > 0.8) {
      stepAcc += hSpeed * dt;
      if (stepAcc > 2.2) {
        stepAcc = 0;
        const under = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.3), Math.floor(player.pos.z));
        if (under) audio.footstep(blockFamily(BLOCKS[under].name));
      }
    } else stepAcc = 0;
  } else {
    audio.update(dt, { nightness: sky.nightness, underwater: false });
  }

  waterTex.offset.x = (now / 1000) * 0.03;
  waterTex.offset.y = (now / 1000) * 0.011;

  const t4 = mark(); perf.sky += t4 - t3;
  controls.endFrame();
  renderer.render(scene, camera);
  perf.render += mark() - t4;
  perf.frames++;

  if (debugOverlay.visible) {
    const p = player.pos;
    debugOverlay.set(
      `Voxelgarden  ${fps} fps\n` +
      `xyz  ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
      `chunk  ${Math.floor(p.x) >> 4}, ${Math.floor(p.z) >> 4}\n` +
      `loaded  ${world.loadedCount} chunks\n` +
      `draws  ${renderer.info.render.calls}   tris ${renderer.info.render.triangles}\n` +
      `mobs  ${mobs.mobs.length}   drops ${drops.list.length}\n` +
      `time  ${(sky.t * 24).toFixed(1)}h   ${sky.isNight ? 'night' : 'day'}   hp ${player.health}/20`);
  }
}
requestAnimationFrame(tick);

// ---- boot: pick the backdrop seed, then show the title ----
(async () => {
  const meta = await saveManager.loadMeta();
  const seed = meta?.seed || 'voxelgarden';
  loadWorld(seed);
  if (meta && meta.player && meta.player.spawn) {
    player.spawnPoint.set(meta.player.spawn[0], meta.player.spawn[1], meta.player.spawn[2]);
  }
  enterTitle();
})();

// debug/testing handle
window.__vg = {
  camera, world, controls, player, interact, sky, audio, renderer, skyColorUniform, solidMat,
  inventory, drops, furnaces, screens, mobs, particles, saveManager,
  get state() { return state; },
  enterPlaying, loadWorld, applySave, collectSave, doSave,
};
