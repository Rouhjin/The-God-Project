// Death screen: red fade, "You died", respawn button.
export class DeathScreen {
  constructor(hudRoot, onRespawn) {
    this.el = document.createElement('div');
    this.el.style.cssText = `position:absolute;inset:0;display:none;flex-direction:column;
      align-items:center;justify-content:center;gap:26px;z-index:30;pointer-events:auto;
      background:radial-gradient(ellipse at center, rgba(120,10,8,.55), rgba(60,4,4,.82));
      opacity:0;transition:opacity .8s;`;
    this.el.innerHTML = `
      <div style="font-size:52px;color:#fff6e5;letter-spacing:.08em;text-shadow:0 4px 18px rgba(0,0,0,.6)">You died</div>
      <button id="vg-respawn" style="font:inherit;font-size:19px;padding:14px 40px;border:none;
        border-radius:16px;background:#ff9e64;color:#2e2a26;cursor:pointer;letter-spacing:.04em;
        box-shadow:0 6px 20px rgba(0,0,0,.4);">Respawn</button>`;
    hudRoot.appendChild(this.el);
    this.el.querySelector('#vg-respawn').addEventListener('click', onRespawn);
  }
  show() {
    this.el.style.display = 'flex';
    requestAnimationFrame(() => { this.el.style.opacity = '1'; });
  }
  hide() {
    this.el.style.opacity = '0';
    setTimeout(() => { this.el.style.display = 'none'; }, 350);
  }
}
