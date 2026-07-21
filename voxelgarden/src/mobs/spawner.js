// Mob manager + spawn rules.
// Puffs: daylight, on grass, 24-48 blocks out, cap 12, despawn beyond 64.
// Shamblers: night only, solid ground, 24-48 blocks out, cap 10, despawn
// beyond 64 or at sunrise (poof).
import { Puff } from './puff.js';
import { Shambler } from './shambler.js';
import { B, isSolid } from '../world/blocks.js';

export class MobManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mobs = [];
    this.spawnTimer = 0;
    this.onPoof = null; // (x, y, z, kind) for particles/sound
  }

  count(kind) { return this.mobs.reduce((n, m) => n + (m.kind === kind ? 1 : 0), 0); }

  groundAt(x, z) {
    for (let y = 88; y > 2; y--) {
      if (isSolid(this.world.getBlock(x, y, z))) return y;
    }
    return -1;
  }

  trySpawn(kind, player) {
    const a = Math.random() * Math.PI * 2;
    const r = 24 + Math.random() * 24;
    const x = Math.floor(player.pos.x + Math.cos(a) * r);
    const z = Math.floor(player.pos.z + Math.sin(a) * r);
    if (!this.world.isChunkReady(x, z)) return;
    const y = this.groundAt(x, z);
    if (y < 0) return;
    const ground = this.world.getBlock(x, y, z);
    if (this.world.getBlock(x, y + 1, z) !== B.AIR || this.world.getBlock(x, y + 2, z) !== B.AIR) return;
    if (kind === 'puff') {
      if (ground !== B.GRASS) return;
      this.mobs.push(new Puff(this.scene, this.world, x + 0.5, y + 1.01, z + 0.5));
    } else {
      this.mobs.push(new Shambler(this.scene, this.world, x + 0.5, y + 1.01, z + 0.5));
    }
  }

  update(dt, ctx) {
    const { player, sky, tint } = ctx;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      if (sky.nightness < 0.25 && this.count('puff') < 12) this.trySpawn('puff', player);
      if (sky.nightness > 0.75 && this.count('shambler') < 10) this.trySpawn('shambler', player);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dist = Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      // despawn rules
      if (dist > 64 || (m.kind === 'shambler' && !m.dead && sky.nightness < 0.2)) {
        if (m.kind === 'shambler' && this.onPoof) this.onPoof(m.pos.x, m.pos.y + 1, m.pos.z, 'shambler');
        m.remove();
        this.mobs.splice(i, 1);
        continue;
      }
      // freeze mobs standing on unloaded ground
      if (!this.world.isChunkReady(Math.floor(m.pos.x), Math.floor(m.pos.z))) continue;
      m.update(dt, ctx);
      m.applyTint(tint);
      if (m.gone) {
        if (this.onPoof) this.onPoof(m.pos.x, m.pos.y + 0.6, m.pos.z, m.kind + '-death');
        m.remove();
        this.mobs.splice(i, 1);
      }
    }
  }

  // melee attack from the camera; returns the mob hit or null
  attackFrom(origin, dir, reach) {
    let best = null, bestT = reach;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const t = m.rayHit(origin, dir, reach);
      if (t < bestT) { bestT = t; best = m; }
    }
    return best;
  }

  anyIntersecting(minX, minY, minZ, maxX, maxY, maxZ) {
    return this.mobs.some((m) => !m.dead && m.aabbIntersects(minX, minY, minZ, maxX, maxY, maxZ));
  }

  clearAll() {
    for (const m of this.mobs) m.remove();
    this.mobs.length = 0;
  }
}
