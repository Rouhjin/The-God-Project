// Voxelgarden — boot + game loop.
// Phase 1: one hardcoded flat chunk, fly-around debug camera, pointer lock.
import * as THREE from 'three';
import { buildAtlasCanvas, buildWaterCanvas } from './world/atlas.js';
import { B } from './world/blocks.js';
import { Chunk, CY } from './world/chunk.js';
import { makePadded, meshChunk } from './world/mesher.js';
import { geometryFromArrays } from './world/geo.js';
import { Controls } from './player/controls.js';

const app = document.getElementById('app');
const hud = document.getElementById('hud');

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87c9ff');
scene.fog = new THREE.Fog('#a8d8ff', 60, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
camera.rotation.order = 'YXZ';
camera.position.set(8, 16, 24);

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

// ---- demo chunk: flat ground with a few featured blocks ----
function buildDemoChunk() {
  const chunk = new Chunk(0, 0);
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      chunk.set(x, 0, z, B.BEDROCK);
      chunk.set(x, 1, z, B.BEDROCK);
      for (let y = 2; y < 8; y++) chunk.set(x, y, z, B.STONE);
      chunk.set(x, 8, z, B.DIRT);
      chunk.set(x, 9, z, B.DIRT);
      chunk.set(x, 10, z, B.GRASS);
    }
  }
  // a little tree
  for (let y = 11; y < 15; y++) chunk.set(3, y, 3, B.LOG);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
    for (let y = 13; y < 15; y++) if (!(dx === 0 && dz === 0 && y < 15)) chunk.set(3 + dx, y, 3 + dz, B.LEAVES);
  }
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) chunk.set(3 + dx, 15, 3 + dz, B.LEAVES);
  // sample blocks
  const samples = [B.COBBLE, B.SAND, B.PLANKS, B.GLASS, B.LANTERN, B.SNOW, B.CACTUS,
    B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.CRAFT, B.FURNACE];
  samples.forEach((id, i) => chunk.set(7 + (i % 5), 11, 7 + ((i / 5) | 0) * 2, id));
  // small water pool
  for (let z = 11; z < 15; z++) for (let x = 1; x < 5; x++) {
    chunk.set(x, 10, z, B.WATER);
    chunk.set(x, 9, z, B.SAND);
  }
  return chunk;
}

const chunk = buildDemoChunk();
const getWorld = (x, y, z) => {
  if (x < 0 || x > 15 || z < 0 || z > 15) return B.AIR;
  return chunk.get(x, y, z);
};
const { solid, water } = meshChunk(makePadded(getWorld, 0, 0), 0, 0);
const solidMesh = new THREE.Mesh(geometryFromArrays(solid), solidMat);
const waterMesh = new THREE.Mesh(geometryFromArrays(water), waterMat);
waterMesh.renderOrder = 1;
scene.add(solidMesh, waterMesh);

// ---- controls: debug fly camera ----
const controls = new Controls(renderer.domElement);
renderer.domElement.addEventListener('click', () => controls.lock());

const hint = document.createElement('div');
hint.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  background:rgba(255,246,229,.92);color:#2e2a26;padding:14px 22px;border-radius:14px;
  font-size:15px;letter-spacing:.02em;pointer-events:none;`;
hint.textContent = 'Click to look around — WASD fly, Space/Shift up/down';
hud.appendChild(hint);
controls.onLockChange = (locked) => { hint.style.display = locked ? 'none' : 'block'; };

const stats = document.createElement('div');
stats.style.cssText = `position:absolute;top:8px;left:8px;background:rgba(46,42,38,.6);
  color:#fff6e5;padding:6px 10px;border-radius:8px;font-size:12px;font-family:monospace;`;
hud.appendChild(stats);

// ---- loop ----
const vel = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
let last = performance.now();
let frames = 0, fpsTime = 0, fps = 0;

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }

  // fly movement
  const speed = controls.has('ControlLeft') ? 40 : 14;
  fwd.set(-Math.sin(controls.yaw), 0, -Math.cos(controls.yaw));
  right.set(-fwd.z, 0, fwd.x);
  vel.set(0, 0, 0);
  if (controls.has('KeyW')) vel.add(fwd);
  if (controls.has('KeyS')) vel.sub(fwd);
  if (controls.has('KeyD')) vel.add(right);
  if (controls.has('KeyA')) vel.sub(right);
  if (controls.has('Space')) vel.y += 1;
  if (controls.has('ShiftLeft')) vel.y -= 1;
  if (vel.lengthSq() > 0) vel.normalize().multiplyScalar(speed * dt);
  camera.position.add(vel);
  controls.applyLook(camera);

  waterTex.offset.x = (now / 1000) * 0.03;
  waterTex.offset.y = (now / 1000) * 0.011;

  renderer.render(scene, camera);
  const p = camera.position;
  stats.textContent = `${fps} fps · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} · draws ${renderer.info.render.calls}`;
}
requestAnimationFrame(tick);
