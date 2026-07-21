// Targeting (DDA), hold-to-break with crack overlay, block placing.
// Later phases plug in via hooks: item consumption, drops, sounds, mob blocking.
import * as THREE from 'three';
import { raycastVoxels } from '../world/raycast.js';
import { B, BLOCKS } from '../world/blocks.js';
import { buildCrackCanvases } from '../world/atlas.js';

const REACH = 5;
const PLACE_REPEAT = 0.25;

export class Interact {
  constructor(scene, world, player, camera, controls) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.camera = camera;
    this.controls = controls;

    this.target = null;          // { x,y,z,id,nx,ny,nz }
    this.breakKey = null;        // "x,y,z" being broken
    this.breakProgress = 0;      // seconds accumulated
    this.placeTimer = 0;

    // hooks (Phase 5/6/7 fill these in)
    this.getPlaceBlock = () => B.PLANKS;      // -> block id or 0 for none
    this.consumePlaced = () => true;          // -> false blocks placement (no items)
    this.speedMultiplier = () => 1;           // (blockId) -> tool speed factor
    this.onBreak = null;                      // (x, y, z, id)
    this.onPlace = null;                      // (x, y, z, id)
    this.onUseBlock = null;                   // (x, y, z, id) -> true if handled (UIs)
    this.onAttack = null;                     // () -> true if an entity was hit
    this.onBreakTick = null;                  // (x, y, z, id, progress01) crack sounds
    this.entityAt = null;                     // (minX..maxZ box) -> true if a mob overlaps

    // targeted-block highlight
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x2e2a26, transparent: true, opacity: 0.6 }),
    );
    this.highlight.visible = false;
    scene.add(this.highlight);

    // crack decal
    this.crackTextures = buildCrackCanvases().map((c) => {
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      return t;
    });
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0], transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.008, 1.008, 1.008), this.crackMat);
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 2;
    scene.add(this.crackMesh);

    this._origin = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    controls.onMouseButton = (button, pressed) => {
      if (!pressed) return;
      if (button === 0 && this.onAttack) this.onAttack();
      if (button === 2) { this.tryPlaceOrUse(); this.placeTimer = PLACE_REPEAT * 1.6; }
    };
  }

  update(dt) {
    // aim
    this.camera.getWorldDirection(this._dir);
    this._origin.copy(this.camera.position);
    const hit = raycastVoxels(this.world, this._origin, this._dir, REACH);
    this.target = hit;

    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }

    // hold-to-break
    if (this.controls.mouseDown[0] && this.controls.enabled && hit) {
      const key = hit.x + ',' + hit.y + ',' + hit.z;
      if (key !== this.breakKey) { this.breakKey = key; this.breakProgress = 0; }
      const block = BLOCKS[hit.id];
      const duration = this.player.creative ? 0.05
        : block.hardness / Math.max(this.speedMultiplier(hit.id), 0.001);
      if (isFinite(duration)) {
        this.breakProgress += dt;
        if (this.onBreakTick) this.onBreakTick(hit.x, hit.y, hit.z, hit.id, this.breakProgress / duration);
        if (this.breakProgress >= duration) {
          this.world.setBlock(hit.x, hit.y, hit.z, B.AIR);
          if (this.onBreak) this.onBreak(hit.x, hit.y, hit.z, hit.id);
          this.breakKey = null;
          this.breakProgress = 0;
        }
      }
      const stage = Math.min(4, Math.floor((this.breakProgress / (isFinite(duration) ? duration : 1)) * 5));
      this.crackMesh.visible = this.breakProgress > 0.03 && isFinite(duration);
      if (this.crackMesh.visible) {
        this.crackMesh.position.copy(this.highlight.position);
        this.crackMat.map = this.crackTextures[stage];
      }
    } else {
      this.breakKey = null;
      this.breakProgress = 0;
      this.crackMesh.visible = false;
    }

    // hold-to-place repeat
    if (this.controls.mouseDown[2] && this.controls.enabled) {
      this.placeTimer -= dt;
      if (this.placeTimer <= 0) { this.tryPlaceOrUse(); this.placeTimer = PLACE_REPEAT; }
    }
  }

  tryPlaceOrUse() {
    const hit = this.target;
    if (!hit) return;

    // right-click on an interactive block opens its UI instead
    if (this.onUseBlock && (hit.id === B.CRAFT || hit.id === B.FURNACE)) {
      if (this.onUseBlock(hit.x, hit.y, hit.z, hit.id)) return;
    }

    const id = this.getPlaceBlock();
    if (!id) return;
    const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (y < 0 || y >= 96) return;
    const existing = this.world.getBlock(x, y, z);
    if (existing !== B.AIR && existing !== B.WATER && !BLOCKS[existing].replaceable) return;

    // never place inside the player or a mob
    if (BLOCKS[id].solid) {
      if (this.player.aabbIntersects(x, y, z, x + 1, y + 1, z + 1)) return;
      if (this.entityAt && this.entityAt(x, y, z, x + 1, y + 1, z + 1)) return;
    }
    if (!this.consumePlaced()) return;
    this.world.setBlock(x, y, z, id);
    if (this.onPlace) this.onPlace(x, y, z, id);
  }
}
