// Shambler: hostile night humanoid. Deep indigo, glowing yellow eyes.
// Idles until the player is within 20 blocks, then chases, auto-jumping
// 1-block steps; attacks for 2 hearts with knockback on a 1s cooldown.
import { Mob } from './mob.js';

export class Shambler extends Mob {
  constructor(scene, world, x, y, z) {
    super(scene, world, x, y, z);
    this.width = 0.6;
    this.height = 1.9;
    this.hp = 10;
    this.kind = 'shambler';
    this.swims = true;

    const c = '#2e2f5e';
    const dark = '#22234a';
    this.box(0.55, 0.7, 0.32, c, 0, 1.05, 0);                 // torso
    this.head = this.box(0.44, 0.44, 0.44, dark, 0, 1.62, 0);
    this.box(0.1, 0.09, 0.03, '#ffd447', -0.11, 1.66, 0.23, true); // glowing eyes
    this.box(0.1, 0.09, 0.03, '#ffd447', 0.11, 1.66, 0.23, true);
    this.armL = this.box(0.16, 0.62, 0.18, dark, -0.36, 1.32, 0);
    this.armR = this.box(0.16, 0.62, 0.18, dark, 0.36, 1.32, 0);
    this.armL.geometry.translate(0, -0.24, 0);
    this.armR.geometry.translate(0, -0.24, 0);
    this.legL = this.box(0.2, 0.7, 0.22, dark, -0.14, 0.7, 0);
    this.legR = this.box(0.2, 0.7, 0.22, dark, 0.14, 0.7, 0);
    this.legL.geometry.translate(0, -0.35, 0);
    this.legR.geometry.translate(0, -0.35, 0);
    // zombie arms forward
    this.armL.rotation.x = -1.2;
    this.armR.rotation.x = -1.2;

    this.state = 'idle';
    this.stateTimer = 1 + Math.random() * 2;
    this.target = null;
    this.attackCooldown = 0;
  }

  update(dt, ctx) {
    if (this.dead) { this.integrate(dt); return; }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.stateTimer -= dt;

    const p = ctx.player;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const distToPlayer = Math.hypot(dx, dz);
    const vertGap = Math.abs(p.pos.y - this.pos.y);

    if (!p.dead && distToPlayer < 20) {
      this.state = 'chase';
    } else if (this.state === 'chase') {
      this.state = 'idle';
      this.stateTimer = 1;
    }

    if (this.state === 'chase' && !p.dead) {
      this.steerToward(p.pos.x, p.pos.z, 2.6, dt, true);
      if (distToPlayer < 1.5 && vertGap < 2 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.0;
        const d = distToPlayer || 1;
        ctx.damagePlayer(4, { x: dx / d, z: dz / d });
      }
    } else if (this.state === 'walk') {
      const d = this.steerToward(this.target[0], this.target[1], 1.2, dt, true);
      if (d < 0.6 || this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 2 + Math.random() * 3; }
    } else if (this.stateTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 8;
      this.target = [this.pos.x + Math.cos(a) * r, this.pos.z + Math.sin(a) * r];
      this.state = 'walk';
      this.stateTimer = 5 + Math.random() * 4;
    }
    this.integrate(dt);
  }

  animate(hSpeed) {
    const sw = Math.sin(this.walkPhase) * Math.min(0.5, hSpeed * 0.6);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -1.2 + Math.sin(this.walkPhase * 0.7) * 0.12;
    this.armR.rotation.x = -1.2 - Math.sin(this.walkPhase * 0.7) * 0.12;
  }
}
