// Dropped item entities: spinning bobbing mini-cubes (block items) or sprites
// (tools/materials) with gravity + collision, merging, and pickup magnetism.
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { BLOCKS, B } from '../world/blocks.js';
import { uvRect } from '../world/atlas.js';
import { stepEntity } from '../world/physics.js';

const MAX_DROPS = 240;
const PICKUP_DELAY = 0.5;
const MAGNET_RANGE = 1.5;
const DESPAWN = 300;

export class Drops {
  constructor(scene, world, atlasTex, iconCanvases) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.blockGeoCache = new Map();
    this.spriteMatCache = new Map();
    this.blockMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.4 });
    this.iconCanvases = iconCanvases;
    this.mergeTimer = 0;
  }

  blockGeometry(blockId) {
    let g = this.blockGeoCache.get(blockId);
    if (g) return g;
    g = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const b = BLOCKS[blockId];
    const uv = g.attributes.uv;
    const FACE_SHADE = [0.74, 0.74, 1.0, 0.5, 0.88, 0.88];
    const colors = new Float32Array(24 * 3);
    for (let f = 0; f < 6; f++) {
      const tile = f === 2 ? b.tiles[0] : f === 3 ? b.tiles[1] : b.tiles[2];
      const [u0, v0, u1, v1] = uvRect(tile);
      uv.setXY(f * 4 + 0, u0, v1);
      uv.setXY(f * 4 + 1, u1, v1);
      uv.setXY(f * 4 + 2, u0, v0);
      uv.setXY(f * 4 + 3, u1, v0);
      for (let v = 0; v < 4; v++) colors.set([FACE_SHADE[f], FACE_SHADE[f], FACE_SHADE[f]], (f * 4 + v) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.blockGeoCache.set(blockId, g);
    return g;
  }

  makeMesh(itemId) {
    const it = ITEMS[itemId];
    if (it.kind === 'block') {
      return new THREE.Mesh(this.blockGeometry(it.block), this.blockMat);
    }
    let mat = this.spriteMatCache.get(itemId);
    if (!mat) {
      const tex = new THREE.CanvasTexture(this.iconCanvases.get(itemId));
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      this.spriteMatCache.set(itemId, mat);
    }
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.32);
    return s;
  }

  spawn(x, y, z, itemId, count = 1, vel = null) {
    if (!ITEMS[itemId]) return;
    if (this.list.length >= MAX_DROPS) this.remove(this.list[0]);
    const mesh = this.makeMesh(itemId);
    const d = {
      itemId, count,
      pos: new THREE.Vector3(x, y, z),
      vel: vel || new THREE.Vector3((Math.random() - 0.5) * 2.4, 3.2 + Math.random(), (Math.random() - 0.5) * 2.4),
      width: 0.25, height: 0.25,
      onGround: false, age: 0, phase: Math.random() * Math.PI * 2,
      mesh,
    };
    mesh.position.copy(d.pos);
    this.scene.add(mesh);
    this.list.push(d);
  }

  remove(d) {
    this.scene.remove(d.mesh);
    const i = this.list.indexOf(d);
    if (i >= 0) this.list.splice(i, 1);
  }

  update(dt, player, inventory, onPickup) {
    this.mergeTimer -= dt;
    const doMerge = this.mergeTimer <= 0;
    if (doMerge) this.mergeTimer = 0.4;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.age += dt;
      if (d.age > DESPAWN) { this.remove(d); continue; }

      // physics (skip once resting to stay cheap)
      const inWater = this.world.getBlock(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(d.pos.z)) === B.WATER;
      d.vel.y += (inWater ? -2 : -18) * dt;
      if (inWater) d.vel.y = Math.max(d.vel.y, -0.8);
      if (d.onGround) {
        d.vel.x *= Math.max(0, 1 - 10 * dt);
        d.vel.z *= Math.max(0, 1 - 10 * dt);
      }
      stepEntity(this.world, d, dt);

      // magnetism + pickup
      if (d.age > PICKUP_DELAY && !player.dead) {
        const px = player.pos.x - d.pos.x;
        const py = player.pos.y + 0.9 - d.pos.y;
        const pz = player.pos.z - d.pos.z;
        const dist = Math.hypot(px, py, pz);
        if (dist < 0.8) {
          const leftover = inventory.add(d.itemId, d.count);
          if (leftover === 0) { this.remove(d); if (onPickup) onPickup(d.itemId); continue; }
          d.count = leftover;
        } else if (dist < MAGNET_RANGE) {
          // steer directly (no force accumulation — it overshoots at low fps)
          const speed = 6;
          d.vel.x = (px / dist) * speed;
          d.vel.y = (py / dist) * speed;
          d.vel.z = (pz / dist) * speed;
        }
      }

      // visuals
      d.mesh.position.set(d.pos.x, d.pos.y + 0.1 + Math.sin(d.age * 3 + d.phase) * 0.06, d.pos.z);
      if (d.mesh.isMesh) d.mesh.rotation.y = d.age * 1.8 + d.phase;

      // merge nearby identical stacks
      if (doMerge) {
        for (let j = i - 1; j >= 0; j--) {
          const o = this.list[j];
          if (o.itemId !== d.itemId) continue;
          const max = ITEMS[d.itemId].stack;
          if (o.count + d.count > max) continue;
          if (o.pos.distanceToSquared(d.pos) < 0.55) {
            o.count += d.count;
            this.remove(d);
            break;
          }
        }
      }
    }
  }

  // drop everything in an inventory at a position (death)
  spawnInventory(inv, x, y, z) {
    for (let i = 0; i < inv.slots.length; i++) {
      const s = inv.slots[i];
      if (s) this.spawn(x, y, z, s.id, s.count);
      inv.slots[i] = null;
    }
    if (inv.cursor) { this.spawn(x, y, z, inv.cursor.id, inv.cursor.count); inv.cursor = null; }
    inv.changed();
  }

  serialize() {
    return this.list.map((d) => ({ id: d.itemId, count: d.count, x: d.pos.x, y: d.pos.y, z: d.pos.z }));
  }
  restore(arr) {
    for (const e of arr || []) {
      if (ITEMS[e.id]) this.spawn(e.x, e.y, e.z, e.id, e.count, new THREE.Vector3());
    }
  }
}
