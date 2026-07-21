// Puff: a passive, round-ish pastel grazer. Wanders, grazes, flees when hit.
import { Mob } from './mob.js';

const PASTELS = ['#fff1dc', '#ffd9e8', '#d9f5e0', '#e6ddff', '#fdf3c0', '#d7ecff'];

export class Puff extends Mob {
  constructor(scene, world, x, y, z) {
    super(scene, world, x, y, z);
    this.width = 0.9;
    this.height = 0.9;
    this.hp = 6;
    this.kind = 'puff';

    const c = PASTELS[(Math.random() * PASTELS.length) | 0];
    const dark = '#b9a58f';
    this.body = this.box(0.9, 0.62, 1.05, c, 0, 0.5, 0);
    this.box(0.62, 0.2, 0.72, c, 0, 0.86, 0.06); // fluff hump
    this.head = this.box(0.42, 0.4, 0.42, c, 0, 0.72, 0.62);
    this.box(0.08, 0.1, 0.02, '#2e2a26', -0.1, 0.76, 0.84, true); // eyes
    this.box(0.08, 0.1, 0.02, '#2e2a26', 0.1, 0.76, 0.84, true);
    this.legs = [
      this.box(0.18, 0.26, 0.18, dark, -0.26, 0.13, 0.34),
      this.box(0.18, 0.26, 0.18, dark, 0.26, 0.13, 0.34),
      this.box(0.18, 0.26, 0.18, dark, -0.26, 0.13, -0.34),
      this.box(0.18, 0.26, 0.18, dark, 0.26, 0.13, -0.34),
    ];

    this.state = 'idle';
    this.stateTimer = 1 + Math.random() * 3;
    this.target = null;
    this.fleeFrom = null;
    this.grazePhase = 0;
  }

  hurt(dmg, dir) {
    super.hurt(dmg, dir);
    this.state = 'flee';
    this.stateTimer = 5;
  }

  update(dt, ctx) {
    if (this.dead) { this.integrate(dt); return; }
    this.stateTimer -= dt;

    if (this.state === 'flee') {
      const p = ctx.player.pos;
      const dx = this.pos.x - p.x, dz = this.pos.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      this.steerToward(this.pos.x + (dx / d) * 8, this.pos.z + (dz / d) * 8, 4.2, dt, true);
      if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 2; }
    } else if (this.state === 'walk') {
      const d = this.steerToward(this.target[0], this.target[1], 1.6, dt, true);
      if (d < 0.6 || this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 1.5 + Math.random() * 3; }
    } else if (this.state === 'graze') {
      this.grazePhase += dt * 6;
      this.head.position.y = 0.72 - Math.max(0, Math.sin(this.grazePhase)) * 0.28;
      if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 1 + Math.random() * 2; this.head.position.y = 0.72; }
    } else if (this.stateTimer <= 0) {
      // pick next activity
      if (Math.random() < 0.35) {
        this.state = 'graze';
        this.stateTimer = 1.5 + Math.random() * 2;
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 7;
        this.target = [this.pos.x + Math.cos(a) * r, this.pos.z + Math.sin(a) * r];
        this.state = 'walk';
        this.stateTimer = 4 + Math.random() * 4;
      }
    }
    this.integrate(dt);
  }

  animate(hSpeed) {
    const sw = Math.sin(this.walkPhase) * Math.min(0.7, hSpeed);
    this.legs[0].rotation.x = sw;
    this.legs[3].rotation.x = sw;
    this.legs[1].rotation.x = -sw;
    this.legs[2].rotation.x = -sw;
  }
}
