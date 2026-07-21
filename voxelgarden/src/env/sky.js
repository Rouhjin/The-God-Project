// Day/night cycle: gradient sky dome, sun/moon billboards, stars, drifting clouds.
// Also computes the global light tint that main.js feeds to the chunk materials
// (all block lighting is baked vertex color x this tint).
import * as THREE from 'three';

export const CYCLE_SECONDS = 720; // 12 minutes: 8 day / 1 dusk / 2 night / 1 dawn
const DAY_END = 8 / 12, DUSK_END = 9 / 12, NIGHT_END = 11 / 12;

// keyframes across the cycle: [time, topColor, horizonColor, tint]
const KEYS = [
  [0.00, '#87c9ff', '#dff2ff', [1.00, 0.99, 0.94]],           // morning
  [DAY_END - 0.04, '#87c9ff', '#dff2ff', [1.00, 0.99, 0.94]], // late day
  [DAY_END + 0.045, '#5b4a8a', '#ff9e64', [0.82, 0.62, 0.52]],// dusk
  [DUSK_END + 0.02, '#0c1030', '#1a2150', [0.30, 0.34, 0.52]],// night start
  [NIGHT_END - 0.02, '#0c1030', '#1a2150', [0.30, 0.34, 0.52]],// night end
  [NIGHT_END + 0.045, '#9ad0ff', '#ffc38a', [0.95, 0.82, 0.72]],// dawn
  [1.00, '#87c9ff', '#dff2ff', [1.00, 0.99, 0.94]],
];

function discTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.04 * CYCLE_SECONDS; // start mid-morning
    this.group = new THREE.Group();
    scene.add(this.group);

    // gradient dome
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color('#87c9ff') },
        horizon: { value: new THREE.Color('#dff2ff') },
      },
      vertexShader: `varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 horizon;
        void main() {
          float h = clamp(normalize(vPos).y, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.75));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(460, 24, 14), this.domeMat);
    dome.renderOrder = -30;
    dome.frustumCulled = false;
    this.group.add(dome);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(300 * 3);
    const rng = () => Math.random();
    for (let i = 0; i < 300; i++) {
      // random directions, biased above the horizon
      const u = rng() * 2 - 1, a = rng() * Math.PI * 2;
      const y = Math.abs(u) * 0.9 + 0.08;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      starPos[i * 3] = Math.cos(a) * r * 430;
      starPos[i * 3 + 1] = y * 430;
      starPos[i * 3 + 2] = Math.sin(a) * r * 430;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: '#fff6e5', size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.renderOrder = -20;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    // sun & moon
    const sunTex = discTexture(64, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,247,214,1)');
      g.addColorStop(0.55, 'rgba(255,217,119,1)');
      g.addColorStop(0.8, 'rgba(255,190,90,0.5)');
      g.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    const moonTex = discTexture(64, (ctx, s) => {
      ctx.fillStyle = 'rgba(238,244,255,1)';
      ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(196,208,232,0.9)';
      ctx.beginPath(); ctx.arc(s * 0.42, s * 0.44, s * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.6, s * 0.58, s * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.52, s * 0.66, s * 0.035, 0, Math.PI * 2); ctx.fill();
    });
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, fog: false, transparent: true, depthWrite: false,
    }));
    this.sun.scale.setScalar(90);
    this.sun.renderOrder = -10;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex, fog: false, transparent: true, depthWrite: false,
    }));
    this.moon.scale.setScalar(70);
    this.moon.renderOrder = -10;
    this.group.add(this.sun, this.moon);

    // clouds
    const cloudTex = discTexture(64, (ctx, s) => {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const blob = (x, y, rx, ry) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      };
      blob(s * 0.35, s * 0.55, s * 0.24, s * 0.16);
      blob(s * 0.58, s * 0.48, s * 0.28, s * 0.19);
      blob(s * 0.72, s * 0.6, s * 0.18, s * 0.12);
      blob(s * 0.45, s * 0.42, s * 0.2, s * 0.14);
    });
    this.cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    });
    this.clouds = [];
    this.cloudGroup = new THREE.Group();
    scene.add(this.cloudGroup);
    const cloudGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(cloudGeo, this.cloudMat);
      m.rotation.x = -Math.PI / 2;
      const sx = 24 + Math.random() * 34;
      m.scale.set(sx, sx * (0.5 + Math.random() * 0.3), 1);
      m.renderOrder = 3;
      m.userData.ox = (Math.random() - 0.5) * 560;
      m.userData.oz = (Math.random() - 0.5) * 560;
      m.position.y = 90 + Math.random() * 4;
      this.clouds.push(m);
      this.cloudGroup.add(m);
    }

    this.tint = new THREE.Color(1, 1, 1);
    this.topColor = new THREE.Color();
    this.horizonColor = new THREE.Color();
    this._ca = new THREE.Color(); this._cb = new THREE.Color();
    this.drift = 0;
  }

  get t() { return (this.time / CYCLE_SECONDS) % 1; }
  get isNight() { const t = this.t; return t > DUSK_END && t < NIGHT_END; }
  // 0 at day, 1 deep night (for ambience / mob spawns)
  get nightness() {
    const t = this.t;
    if (t < DAY_END) return 0;
    if (t < DUSK_END) return (t - DAY_END) / (DUSK_END - DAY_END);
    if (t < NIGHT_END) return 1;
    return 1 - (t - NIGHT_END) / (1 - NIGHT_END);
  }

  update(dt, playerPos, fog) {
    this.time += dt;
    const t = this.t;

    // interpolate keyframes
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] < t) i++;
    const [t0, top0, hor0, tint0] = KEYS[i];
    const [t1, top1, hor1, tint1] = KEYS[i + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / Math.max(1e-6, t1 - t0)));

    this.topColor.set(top0).lerp(this._ca.set(top1), f);
    this.horizonColor.set(hor0).lerp(this._ca.set(hor1), f);
    // keyframe tints are authored as sRGB "perceived brightness"; the shader
    // multiplies in linear space, so convert or night barely darkens
    this.tint.setRGB(
      tint0[0] + (tint1[0] - tint0[0]) * f,
      tint0[1] + (tint1[1] - tint0[1]) * f,
      tint0[2] + (tint1[2] - tint0[2]) * f,
    ).convertSRGBToLinear();
    this.domeMat.uniforms.top.value.copy(this.topColor);
    this.domeMat.uniforms.horizon.value.copy(this.horizonColor);
    if (fog) fog.color.copy(this.horizonColor);

    // sun path: rises at dawn midpoint, sets at dusk midpoint
    const dawnMid = NIGHT_END + (1 - NIGHT_END) / 2;
    const duskMid = DAY_END + (DUSK_END - DAY_END) / 2;
    const dayLen = (duskMid - dawnMid + 1) % 1;
    const sunProg = ((t - dawnMid + 1) % 1) / dayLen; // 0 rise -> 1 set (over the day)
    const sunAng = sunProg * Math.PI;
    const R = 400;
    this.sun.position.set(Math.cos(sunAng) * R, Math.sin(sunAng) * R * 0.85 + 6, -120);
    const moonProg = ((t - duskMid + 1) % 1) / ((dawnMid - duskMid + 1) % 1);
    const moonAng = moonProg * Math.PI;
    this.moon.position.set(Math.cos(moonAng) * R, Math.sin(moonAng) * R * 0.85 + 6, 120);
    this.sun.material.opacity = Math.max(0, Math.min(1, Math.sin(sunAng) * 4 + 0.4));
    this.moon.material.opacity = Math.max(0, Math.min(1, Math.sin(moonAng) * 4 + 0.4));

    // stars
    this.starMat.opacity = this.nightness * 0.9;
    this.stars.rotation.y = t * Math.PI * 2 * 0.25;

    // sky follows the camera
    this.group.position.copy(playerPos);

    // clouds drift and wrap around the player
    this.drift += dt * 1.4;
    const wrap = 560;
    for (const c of this.clouds) {
      const rx = c.userData.ox + this.drift - playerPos.x;
      const rz = c.userData.oz - playerPos.z;
      c.position.x = playerPos.x + (((rx % wrap) + wrap * 1.5) % wrap - wrap / 2);
      c.position.z = playerPos.z + (((rz % wrap) + wrap * 1.5) % wrap - wrap / 2);
    }
    // night clouds go dim
    const nf = 1 - this.nightness * 0.75;
    this.cloudMat.opacity = 0.55 * nf;
  }
}
