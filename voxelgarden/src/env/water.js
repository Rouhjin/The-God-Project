// Underwater presentation: blue tint overlay + short fog. The audio lowpass is
// driven from main (AudioSys.setUnderwater).
import * as THREE from 'three';

export class UnderwaterFX {
  constructor(hud) {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `position:absolute;inset:0;pointer-events:none;
      background:rgba(30,84,160,0.34);opacity:0;transition:opacity .15s;`;
    hud.appendChild(this.overlay);
    this.active = false;
    this._fogColor = new THREE.Color('#2a6ab0');
  }

  // call after sky.update so we can override fog when submerged
  update(underwater, fog, viewEdge) {
    if (underwater === this.active) {
      if (underwater) this.applyFog(fog);
      return underwater;
    }
    this.active = underwater;
    this.overlay.style.opacity = underwater ? '1' : '0';
    if (underwater) this.applyFog(fog);
    else { fog.near = viewEdge * 0.55; fog.far = viewEdge * 0.95; }
    return underwater;
  }

  applyFog(fog) {
    fog.color.copy(this._fogColor);
    fog.near = 3;
    fog.far = 26;
  }
}
