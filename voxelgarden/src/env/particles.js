// Pooled particle system: one THREE.Points cloud, additive-ish soft quads.
// Used for block-break bursts, hit sparks, water splash, and shambler poof.
import * as THREE from 'three';

const MAX = 600;

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.gravity = new Float32Array(MAX);
    this.head = 0;
    this.active = 0;

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setDrawRange(0, 0);
    this.geo = geo;

    this.mat = new THREE.PointsMaterial({
      size: 0.16, map: softDot(), vertexColors: true, transparent: true,
      depthWrite: false, sizeAttenuation: true, opacity: 0.95, fog: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);

    // move dead particles far off-screen so they don't render
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -9999;
  }

  emit(x, y, z, vx, vy, vz, r, g, b, life, grav) {
    const i = this.head;
    this.head = (this.head + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.maxLife[i] = life;
    this.gravity[i] = grav;
  }

  burstBlock(x, y, z, colors) {
    // colors: array of [r,g,b] in 0..1
    for (let i = 0; i < 14; i++) {
      const c = colors[(Math.random() * colors.length) | 0];
      this.emit(
        x + Math.random(), y + Math.random() * 0.6, z + Math.random(),
        (Math.random() - 0.5) * 2.4, Math.random() * 3 + 1, (Math.random() - 0.5) * 2.4,
        c[0], c[1], c[2], 0.5 + Math.random() * 0.4, 14,
      );
    }
  }

  burstHit(x, y, z) {
    for (let i = 0; i < 8; i++) {
      this.emit(x, y, z,
        (Math.random() - 0.5) * 3, Math.random() * 2 + 1, (Math.random() - 0.5) * 3,
        1, 0.85, 0.3, 0.3 + Math.random() * 0.2, 10);
    }
  }

  burstPoof(x, y, z, kind) {
    const dark = (kind || '').startsWith('shambler');
    for (let i = 0; i < 18; i++) {
      const c = dark ? [0.18, 0.18, 0.37] : [0.7, 0.7, 0.8];
      this.emit(x + (Math.random() - 0.5), y + Math.random() * 1.4, z + (Math.random() - 0.5),
        (Math.random() - 0.5) * 1.6, Math.random() * 1.6, (Math.random() - 0.5) * 1.6,
        c[0], c[1], c[2], 0.6 + Math.random() * 0.5, 2);
    }
  }

  splash(x, y, z) {
    for (let i = 0; i < 12; i++) {
      this.emit(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 2.5, Math.random() * 4 + 2, (Math.random() - 0.5) * 2.5,
        0.55, 0.75, 0.95, 0.5 + Math.random() * 0.3, 16);
    }
  }

  update(dt) {
    let maxIdx = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -9999; continue; }
      this.vel[i * 3 + 1] -= this.gravity[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      maxIdx = Math.max(maxIdx, i + 1);
    }
    this.geo.setDrawRange(0, MAX);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}
