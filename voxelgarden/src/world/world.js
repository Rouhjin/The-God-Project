// Chunk manager: streams chunks in/out around the player, owns the worker,
// applies block edits, and budgets geometry uploads so frames never hitch.
import * as THREE from 'three';
import { Chunk, chunkKey, CY } from './chunk.js';
import { geometryFromArrays } from './geo.js';
import { B, BLOCKS, isSolid } from './blocks.js';

export const RENDER_DIST = 8;
export const UNLOAD_DIST = 10;
const MAX_OUTSTANDING = 10;  // worker requests in flight
const UPLOADS_PER_FRAME = 2;

export class World {
  constructor(scene, solidMat, waterMat, seed) {
    this.scene = scene;
    this.solidMat = solidMat;
    this.waterMat = waterMat;
    this.seed = seed;
    this.chunks = new Map();     // key -> Chunk (data present once loaded)
    this.pending = new Set();    // keys with an outstanding load request
    this.queue = [];             // [cx, cz] load requests sorted near->far
    this.uploadQueue = [];       // worker replies awaiting geometry upload
    this.outstanding = 0;
    this.centerCx = null;
    this.centerCz = null;
    this.onFirstReady = null;    // fired once when the spawn chunk has data
    this.onChunkEdited = null;   // (chunk) -> void, for the save system

    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.handleMessage(e.data);
    this.worker.postMessage({ type: 'init', seed });
  }

  // ---- queries -------------------------------------------------------------

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CY) return B.AIR;
    const c = this.chunks.get(chunkKey(wx >> 4, wz >> 4));
    if (!c || !c.data) return B.AIR;
    return c.data[(wx & 15) + (wz & 15) * 16 + (wy << 8)];
  }

  isChunkReady(wx, wz) {
    const c = this.chunks.get(chunkKey(wx >> 4, wz >> 4));
    return !!(c && c.data);
  }

  isSolidAt(wx, wy, wz) {
    return isSolid(this.getBlock(wx, wy, wz));
  }

  // ---- edits ---------------------------------------------------------------

  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= CY) return false;
    const cx = wx >> 4, cz = wz >> 4;
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c || !c.data) return false;
    const lx = wx & 15, lz = wz & 15;
    const idx = lx + lz * 16 + (wy << 8);
    if (c.data[idx] === id) return false;
    c.data[idx] = id;
    c.edited = true;
    if (this.onChunkEdited) this.onChunkEdited(c);

    this.worker.postMessage({ type: 'edits', edits: [[cx, cz, idx, id]] });

    // remesh this chunk plus any neighbors that can see the change (incl. diagonals for AO)
    const cxs = [cx]; const czs = [cz];
    if (lx === 0) cxs.push(cx - 1); else if (lx === 15) cxs.push(cx + 1);
    if (lz === 0) czs.push(cz - 1); else if (lz === 15) czs.push(cz + 1);
    for (const rx of cxs) for (const rz of czs) this.requestRemesh(rx, rz);
    return true;
  }

  requestRemesh(cx, cz) {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c || !c.data) return;
    this.worker.postMessage({ type: 'remesh', cx, cz });
  }

  // ---- streaming -----------------------------------------------------------

  update(px, pz) {
    const cx = Math.floor(px) >> 4;
    const cz = Math.floor(pz) >> 4;
    if (cx !== this.centerCx || cz !== this.centerCz) {
      this.centerCx = cx;
      this.centerCz = cz;
      this.rebuildQueue();
    }

    // keep the worker fed, nearest chunks first
    while (this.outstanding < MAX_OUTSTANDING && this.queue.length) {
      const [qx, qz] = this.queue.shift();
      const k = chunkKey(qx, qz);
      if (this.chunks.has(k) || this.pending.has(k)) continue;
      if (Math.max(Math.abs(qx - cx), Math.abs(qz - cz)) > RENDER_DIST) continue;
      this.pending.add(k);
      this.outstanding++;
      this.worker.postMessage({ type: 'load', cx: qx, cz: qz });
    }

    // budgeted geometry uploads
    for (let i = 0; i < UPLOADS_PER_FRAME && this.uploadQueue.length; i++) {
      this.applyMeshReply(this.uploadQueue.shift());
    }
  }

  rebuildQueue() {
    const cx = this.centerCx, cz = this.centerCz;

    // unload far chunks
    for (const [k, c] of this.chunks) {
      const d = Math.max(Math.abs(c.cx - cx), Math.abs(c.cz - cz));
      if (d > UNLOAD_DIST) {
        this.disposeChunk(c);
        this.chunks.delete(k);
        this.worker.postMessage({ type: 'unload', cx: c.cx, cz: c.cz });
      }
    }

    // wanted chunks, sorted by distance
    const wanted = [];
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
        const k = chunkKey(cx + dx, cz + dz);
        if (this.chunks.has(k) || this.pending.has(k)) continue;
        wanted.push([cx + dx, cz + dz, dx * dx + dz * dz]);
      }
    }
    wanted.sort((a, b) => a[2] - b[2]);
    this.queue = wanted;

    // drop queued uploads for chunks that left the window
    this.uploadQueue = this.uploadQueue.filter((m) =>
      Math.max(Math.abs(m.cx - cx), Math.abs(m.cz - cz)) <= UNLOAD_DIST);
  }

  handleMessage(msg) {
    if (msg.type === 'chunk') {
      this.outstanding--;
      this.pending.delete(chunkKey(msg.cx, msg.cz));
      const d = Math.max(Math.abs(msg.cx - (this.centerCx ?? msg.cx)), Math.abs(msg.cz - (this.centerCz ?? msg.cz)));
      if (d > UNLOAD_DIST) {
        this.worker.postMessage({ type: 'unload', cx: msg.cx, cz: msg.cz });
        return;
      }
      const c = new Chunk(msg.cx, msg.cz, msg.data);
      this.chunks.set(chunkKey(msg.cx, msg.cz), c);
      this.uploadQueue.push(msg);
      if (this.onFirstReady && msg.cx === (this.centerCx ?? 0) && msg.cz === (this.centerCz ?? 0)) {
        const cb = this.onFirstReady;
        this.onFirstReady = null;
        cb();
      }
    } else if (msg.type === 'mesh') {
      this.uploadQueue.push(msg);
    }
  }

  applyMeshReply(msg) {
    const c = this.chunks.get(chunkKey(msg.cx, msg.cz));
    if (!c) return;
    this.setChunkMeshes(c, msg.solid, msg.water);
  }

  setChunkMeshes(c, solidArrays, waterArrays) {
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.waterMesh) { this.scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); c.waterMesh = null; }
    if (solidArrays.indices.length) {
      c.mesh = new THREE.Mesh(geometryFromArrays(solidArrays), this.solidMat);
      c.mesh.position.set(c.cx * 16, 0, c.cz * 16);
      this.scene.add(c.mesh);
    }
    if (waterArrays.indices.length) {
      c.waterMesh = new THREE.Mesh(geometryFromArrays(waterArrays), this.waterMat);
      c.waterMesh.position.set(c.cx * 16, 0, c.cz * 16);
      c.waterMesh.renderOrder = 1;
      this.scene.add(c.waterMesh);
    }
  }

  disposeChunk(c) {
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    if (c.waterMesh) { this.scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); }
    c.mesh = c.waterMesh = null;
  }

  get loadedCount() { return this.chunks.size; }

  dispose() {
    for (const [, c] of this.chunks) this.disposeChunk(c);
    this.chunks.clear();
    this.worker.terminate();
  }
}
