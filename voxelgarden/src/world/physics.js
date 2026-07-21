// Axis-separated AABB vs voxel collision, shared by the player and mobs.
// Entities have: pos (THREE.Vector3, feet center), vel, width, height,
// onGround, inWater flags.
import { B, BLOCKS, isSolid } from './blocks.js';

const EPS = 0.001;

export function boxOverlapsSolid(world, minX, minY, minZ, maxX, maxY, maxZ) {
  const x0 = Math.floor(minX), x1 = Math.floor(maxX - EPS);
  const y0 = Math.floor(minY), y1 = Math.floor(maxY - EPS);
  const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - EPS);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (isSolid(world.getBlock(x, y, z))) return true;
      }
    }
  }
  return false;
}

// Move one axis, resolving against solid voxels. Returns true if a collision
// clamped the move. axis: 0=x, 1=y, 2=z.
function moveAxis(world, ent, axis, delta) {
  if (delta === 0) return false;
  const half = ent.width / 2;
  const p = ent.pos;
  if (axis === 0) p.x += delta;
  else if (axis === 1) p.y += delta;
  else p.z += delta;

  const minX = p.x - half, maxX = p.x + half;
  const minY = p.y, maxY = p.y + ent.height;
  const minZ = p.z - half, maxZ = p.z + half;
  const x0 = Math.floor(minX), x1 = Math.floor(maxX - EPS);
  const y0 = Math.floor(minY), y1 = Math.floor(maxY - EPS);
  const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - EPS);

  let hit = false;
  let boundary = delta > 0 ? Infinity : -Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!isSolid(world.getBlock(x, y, z))) continue;
        hit = true;
        const cell = axis === 0 ? x : axis === 1 ? y : z;
        boundary = delta > 0 ? Math.min(boundary, cell) : Math.max(boundary, cell + 1);
      }
    }
  }
  if (hit) {
    if (axis === 0) p.x = delta > 0 ? boundary - half - EPS : boundary + half + EPS;
    else if (axis === 1) p.y = delta > 0 ? boundary - ent.height - EPS : boundary + EPS;
    else p.z = delta > 0 ? boundary - half - EPS : boundary + half + EPS;
  }
  return hit;
}

// Integrate one frame of entity movement. Substeps so fast motion can't tunnel.
// Returns flags { hitX, hitY, hitZ, landed }.
export function stepEntity(world, ent, dt) {
  const res = { hitX: false, hitY: false, hitZ: false, landed: false };
  const steps = Math.max(1, Math.ceil(
    Math.max(Math.abs(ent.vel.x), Math.abs(ent.vel.y), Math.abs(ent.vel.z)) * dt / 0.4));
  const sdt = dt / steps;
  const wasOnGround = ent.onGround;
  ent.onGround = false;

  for (let i = 0; i < steps; i++) {
    if (moveAxis(world, ent, 0, ent.vel.x * sdt)) { ent.vel.x = 0; res.hitX = true; }
    if (moveAxis(world, ent, 2, ent.vel.z * sdt)) { ent.vel.z = 0; res.hitZ = true; }
    const down = ent.vel.y < 0;
    if (moveAxis(world, ent, 1, ent.vel.y * sdt)) {
      res.hitY = true;
      if (down) {
        ent.onGround = true;
        if (!wasOnGround) res.landed = true;
      }
      ent.vel.y = 0;
    }
  }
  return res;
}

// Medium checks
export function feetInWater(world, ent) {
  return world.getBlock(Math.floor(ent.pos.x), Math.floor(ent.pos.y + 0.4), Math.floor(ent.pos.z)) === B.WATER;
}
export function eyesInWater(world, ent) {
  const eyeY = ent.pos.y + (ent.eyeHeight ?? ent.height * 0.9);
  return world.getBlock(Math.floor(ent.pos.x), Math.floor(eyeY), Math.floor(ent.pos.z)) === B.WATER;
}

// Is the entity's AABB touching a block of the given id (used for cactus damage)?
export function touchesBlock(world, ent, id) {
  const half = ent.width / 2 + 0.05;
  const x0 = Math.floor(ent.pos.x - half), x1 = Math.floor(ent.pos.x + half);
  const y0 = Math.floor(ent.pos.y - 0.05), y1 = Math.floor(ent.pos.y + ent.height + 0.05);
  const z0 = Math.floor(ent.pos.z - half), z1 = Math.floor(ent.pos.z + half);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (world.getBlock(x, y, z) === id) return true;
      }
    }
  }
  return false;
}
