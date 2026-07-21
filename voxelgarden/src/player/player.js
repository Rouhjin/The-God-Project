// Player: movement physics, health/air state, creative fly.
import * as THREE from 'three';
import { stepEntity, feetInWater, eyesInWater } from '../world/physics.js';

const GRAVITY = -25;
const WATER_GRAVITY = -4;
const JUMP_VEL = 8.2;
const WALK = 4.3, SPRINT = 5.6, SNEAK = 1.6;
const SWIM_MAX = 2.5;
const FLY_SPEED = 12, FLY_FAST = 28;

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.pos = spawn.clone();          // feet center
    this.vel = new THREE.Vector3();
    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.sprinting = false;
    this.sneaking = false;

    this.health = 20;                  // half-hearts
    this.air = 10;                     // seconds of breath
    this.dead = false;
    this.timeSinceDamage = 999;
    this.regenTimer = 0;

    this.creative = false;
    this.flying = false;
    this.spawnPoint = spawn.clone();
    this.fallStartY = this.pos.y;

    this.onFall = null;                // (blocks) -> void, wired in Phase 7
    this.onDamaged = null;
  }

  eyePosition(out) {
    return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  update(dt, controls) {
    const world = this.world;
    // don't simulate until the ground under us exists
    if (!world.isChunkReady(Math.floor(this.pos.x), Math.floor(this.pos.z))) return;

    this.inWater = feetInWater(world, this);
    this.headInWater = eyesInWater(world, this);

    // --- input to desired horizontal velocity ---
    const yaw = controls.yaw;
    let ix = 0, iz = 0;
    if (controls.has('KeyW')) iz += 1;
    if (controls.has('KeyS')) iz -= 1;
    if (controls.has('KeyD')) ix += 1;
    if (controls.has('KeyA')) ix -= 1;
    this.sneaking = controls.has('ShiftLeft') && !this.flying;
    this.sprinting = controls.has('ControlLeft') && iz > 0 && !this.sneaking;

    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = -fwdZ, rightZ = fwdX;
    let dx = fwdX * iz + rightX * ix;
    let dz = fwdZ * iz + rightZ * ix;
    const dlen = Math.hypot(dx, dz);
    if (dlen > 0) { dx /= dlen; dz /= dlen; }

    if (this.flying) {
      const spd = controls.has('ControlLeft') ? FLY_FAST : FLY_SPEED;
      this.vel.x = dx * spd;
      this.vel.z = dz * spd;
      this.vel.y = (controls.has('Space') ? spd : 0) + (controls.has('ShiftLeft') ? -spd : 0);
      const r = stepEntity(world, this, dt);
      if (r.hitY) this.vel.y = 0;
      this.fallStartY = this.pos.y;
      return;
    }

    const speed = this.inWater ? SWIM_MAX
      : this.sneaking ? SNEAK
      : this.sprinting ? SPRINT
      : WALK;
    // responsive ground control, slightly floatier in air
    const control = this.onGround || this.inWater ? 14 : 4;
    this.vel.x += (dx * speed - this.vel.x) * Math.min(1, control * dt);
    this.vel.z += (dz * speed - this.vel.z) * Math.min(1, control * dt);

    // --- vertical ---
    if (this.inWater) {
      this.vel.y += WATER_GRAVITY * dt;
      if (controls.has('Space')) this.vel.y = Math.min(this.vel.y + 18 * dt, 3.2);
      this.vel.y = Math.max(this.vel.y, -1.6); // sink slowly
    } else {
      if ((controls.has('Space') || controls.wasPressed('Space')) && this.onGround) this.vel.y = JUMP_VEL;
      this.vel.y += GRAVITY * dt;
      this.vel.y = Math.max(this.vel.y, -50);
    }

    const wasAirborne = !this.onGround;
    const res = stepEntity(world, this, dt);

    // fall tracking
    if (this.onGround || this.inWater) {
      if (res.landed && wasAirborne && !this.inWater) {
        const fall = this.fallStartY - this.pos.y;
        if (fall > 3 && this.onFall) this.onFall(fall);
      }
      this.fallStartY = this.pos.y;
    } else if (this.pos.y > this.fallStartY) {
      this.fallStartY = this.pos.y;
    }
  }

  aabbIntersects(minX, minY, minZ, maxX, maxY, maxZ) {
    const half = this.width / 2;
    return this.pos.x + half > minX && this.pos.x - half < maxX &&
      this.pos.y + this.height > minY && this.pos.y < maxY &&
      this.pos.z + half > minZ && this.pos.z - half < maxZ;
  }
}
