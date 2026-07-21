// Base mob: box-built body, shared voxel physics, hurt flash, knockback, death shrink.
import * as THREE from 'three';
import { stepEntity, feetInWater } from '../world/physics.js';

export class Mob {
  constructor(scene, world, x, y, z) {
    this.scene = scene;
    this.world = world;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.width = 0.8;
    this.height = 1.0;
    this.onGround = false;
    this.hp = 10;
    this.dead = false;        // dying animation in progress
    this.gone = false;        // ready for removal
    this.hurtTimer = 0;
    this.dieTimer = 0;
    this.yaw = 0;
    this.walkPhase = 0;
    this.mats = [];           // tintable materials [{ mat, base: Color }]
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  box(w, h, d, color, x, y, z, noTint = false) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.group.add(m);
    if (!noTint) this.mats.push({ mat, base: new THREE.Color(color) });
    return m;
  }

  applyTint(tint) {
    const t = this.hurtTimer > 0 ? null : tint;
    for (const { mat, base } of this.mats) {
      if (this.hurtTimer > 0) mat.color.setRGB(1, 0.25, 0.2);
      else mat.color.copy(base).multiply(t);
    }
  }

  hurt(dmg, knockDir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hurtTimer = 0.25;
    if (knockDir) {
      this.vel.x += knockDir.x * 6;
      this.vel.z += knockDir.z * 6;
      this.vel.y = 4.5;
    }
    if (this.hp <= 0) this.dead = true;
  }

  aabbIntersects(minX, minY, minZ, maxX, maxY, maxZ) {
    const half = this.width / 2;
    return this.pos.x + half > minX && this.pos.x - half < maxX &&
      this.pos.y + this.height > minY && this.pos.y < maxY &&
      this.pos.z + half > minZ && this.pos.z - half < maxZ;
  }

  // ray vs this mob's AABB; returns distance or Infinity
  rayHit(origin, dir, maxDist) {
    const half = this.width / 2;
    const min = [this.pos.x - half, this.pos.y, this.pos.z - half];
    const max = [this.pos.x + half, this.pos.y + this.height, this.pos.z + half];
    let t0 = 0, t1 = maxDist;
    const o = [origin.x, origin.y, origin.z];
    const d = [dir.x, dir.y, dir.z];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < min[i] || o[i] > max[i]) return Infinity;
      } else {
        let a = (min[i] - o[i]) / d[i];
        let b = (max[i] - o[i]) / d[i];
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1) return Infinity;
      }
    }
    return t0;
  }

  // physics + shared visual state; call after subclass AI sets vel/yaw
  integrate(dt) {
    if (this.dead) {
      this.dieTimer += dt;
      const s = Math.max(0.01, 1 - this.dieTimer / 0.4);
      this.group.scale.setScalar(s);
      this.group.position.y += dt * 0.4;
      if (this.dieTimer > 0.45) this.gone = true;
      return;
    }
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    const inWater = feetInWater(this.world, this);
    this.vel.y += (inWater ? -5 : -25) * dt;
    if (inWater) {
      this.vel.y = Math.max(this.vel.y, -1.2);
      if (this.swims) this.vel.y = Math.min(this.vel.y + 14 * dt, 2.0);
    }
    stepEntity(this.world, this, dt);
    // friction
    const f = Math.max(0, 1 - (this.onGround ? 8 : 1.5) * dt);
    this.vel.x *= f;
    this.vel.z *= f;

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += hSpeed * dt * 5;
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.y = this.yaw;
    this.animate(hSpeed);
  }

  animate() {} // subclass leg swings etc.

  remove() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  // steer horizontally toward a target at speed, with optional auto-jump
  steerToward(tx, tz, speed, dt, autoJump) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return dist;
    this.yaw = Math.atan2(dx, dz);
    const ax = (dx / dist) * speed, az = (dz / dist) * speed;
    this.vel.x += (ax - this.vel.x) * Math.min(1, 8 * dt);
    this.vel.z += (az - this.vel.z) * Math.min(1, 8 * dt);
    if (autoJump && this.onGround) {
      // 1-block obstacle right in front?
      const fx = Math.floor(this.pos.x + (dx / dist) * (this.width / 2 + 0.35));
      const fz = Math.floor(this.pos.z + (dz / dist) * (this.width / 2 + 0.35));
      const fy = Math.floor(this.pos.y);
      const solid = (yy) => this.world.isSolidAt(fx, yy, fz);
      if (solid(fy) && !solid(fy + 1) && !solid(fy + 2)) this.vel.y = 7.6;
    }
    return dist;
  }
}
