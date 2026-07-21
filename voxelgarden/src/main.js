// Voxelgarden — boot + game loop.
// Phase 2: infinite worker-generated terrain streamed around a fly camera.
import * as THREE from 'three';
import { buildAtlasCanvas, buildWaterCanvas } from './world/atlas.js';
import { World, RENDER_DIST } from './world/world.js';
import { WorldGen } from './world/worldgen.js';
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

// ---- world ----
const seed = 'voxelgarden';
const world = new World(scene, solidMat, waterMat, seed);
const gen = new WorldGen(seed); // main-thread twin, used for spawn placement
camera.position.set(8.5, gen.heightAt(8, 8) + 12, 8.5);

// ---- controls: debug fly camera ----
const controls = new Controls(renderer.domElement);
renderer.domElement.addEventListener('click', () => controls.lock());

const hint = document.createElement('div');
hint.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  background:rgba(255,246,229,.92);color:#2e2a26;padding:14px 22px;border-radius:14px;
  font-size:15px;letter-spacing:.02em;pointer-events:none;`;
hint.textContent = 'Click to look around — WASD fly, Space/Shift up/down, Ctrl fast';
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
  const speed = controls.has('ControlLeft') ? 60 : 16;
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

  world.update(camera.position.x, camera.position.z);

  waterTex.offset.x = (now / 1000) * 0.03;
  waterTex.offset.y = (now / 1000) * 0.011;

  renderer.render(scene, camera);
  const p = camera.position;
  stats.textContent = `${fps} fps · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} · chunk ${Math.floor(p.x) >> 4},${Math.floor(p.z) >> 4} · loaded ${world.loadedCount} · draws ${renderer.info.render.calls}`;
}
requestAnimationFrame(tick);

// debug/testing handle
window.__vg = { camera, world, controls };
