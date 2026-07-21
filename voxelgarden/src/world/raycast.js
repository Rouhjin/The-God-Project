// DDA voxel raycast (Amanatides & Woo). Never uses mesh raycasting.
import { isSolid } from './blocks.js';

// Returns { x, y, z, id, nx, ny, nz, dist } for the first solid block hit,
// or null. origin/dir are plain {x,y,z}; dir need not be normalized (it is here).
export function raycastVoxels(world, origin, dir, maxDist) {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len === 0) return null;
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;

  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  const distTo = (p, o, d, step) => d !== 0 ? ((step > 0 ? p + 1 - o : o - p) / Math.abs(d)) : Infinity;
  let tMaxX = distTo(x, origin.x, dx, stepX);
  let tMaxY = distTo(y, origin.y, dy, stepY);
  let tMaxZ = distTo(z, origin.z, dz, stepZ);

  let nx = 0, ny = 0, nz = 0;
  let t = 0;
  for (let i = 0; i < 256; i++) {
    const id = world.getBlock(x, y, z);
    if (i > 0 && isSolid(id)) {
      return { x, y, z, id, nx, ny, nz, dist: t };
    }
    if (i === 0 && isSolid(id)) {
      // eye inside a block (e.g. head in leaves) — still targetable
      return { x, y, z, id, nx: 0, ny: 1, nz: 0, dist: 0 };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      t = tMaxX; tMaxX += tDeltaX; x += stepX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      t = tMaxY; tMaxY += tDeltaY; y += stepY; ny = -stepY; nx = 0; nz = 0;
    } else {
      t = tMaxZ; tMaxZ += tDeltaZ; z += stepZ; nz = -stepZ; nx = 0; ny = 0;
    }
    if (t > maxDist) return null;
  }
  return null;
}
