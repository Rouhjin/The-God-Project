// Pointer lock, mouse look, key state. Owns raw input; game code reads state
// or subscribes to the discrete callbacks.
const TAU = Math.PI * 2;

export class Controls {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();       // currently held KeyboardEvent.code values
    this.yaw = 0;                // radians, 0 = looking toward -z
    this.pitch = 0;
    this.sensitivity = 0.0022;
    this.locked = false;
    this.mouseDown = [false, false, false];
    this.enabled = true;         // false while a UI screen is open

    // discrete event hooks, assigned by game systems
    this.onKeyPress = null;      // (code, event) -> void
    this.onMouseButton = null;   // (button, pressed) -> void
    this.onWheel = null;         // (deltaY) -> void
    this.onLockChange = null;    // (locked) -> void
    this.onDoubleSpace = null;   // creative fly toggle
    this._lastSpace = 0;

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.keys.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      const lim = Math.PI / 2 - 0.02; // +/- ~89 degrees
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
      this.yaw = ((this.yaw % TAU) + TAU) % TAU;
    });

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        const now = performance.now();
        if (now - this._lastSpace < 280 && this.onDoubleSpace) this.onDoubleSpace();
        this._lastSpace = now;
      }
      if (this.onKeyPress) this.onKeyPress(e.code, e);
      if (['Space', 'Tab', 'F3', 'F4'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.dom.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.mouseDown[e.button] = true;
      if (this.enabled && this.onMouseButton) this.onMouseButton(e.button, true);
    });
    document.addEventListener('mouseup', (e) => {
      this.mouseDown[e.button] = false;
      if (this.locked && this.enabled && this.onMouseButton) this.onMouseButton(e.button, false);
    });
    document.addEventListener('wheel', (e) => {
      if (this.locked && this.enabled && this.onWheel) this.onWheel(e.deltaY);
    }, { passive: true });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  lock() {
    if (!this.locked) this.dom.requestPointerLock();
  }
  unlock() {
    if (this.locked) document.exitPointerLock();
  }
  has(code) { return this.enabled && this.keys.has(code); }

  // apply yaw/pitch to a THREE camera
  applyLook(camera) {
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);
  }
}
