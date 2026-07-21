// In-game HUD: hotbar, hearts, air bubbles, item-name toast. Plain DOM.
import { ITEMS } from '../items/items.js';

const STYLE = `
.vg-hotbar { position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
  display:flex; gap:5px; padding:6px; background:rgba(46,42,38,.55);
  border-radius:14px; pointer-events:none; }
.vg-slot { width:46px; height:46px; background:rgba(255,246,229,.16); border-radius:9px;
  position:relative; border:2px solid rgba(255,246,229,.25); box-sizing:border-box; }
.vg-slot.sel { border-color:#ff9e64; background:rgba(255,246,229,.3);
  box-shadow:0 0 8px rgba(255,158,100,.6); }
.vg-slot img { width:100%; height:100%; image-rendering:pixelated; display:block; }
.vg-slot .ct { position:absolute; right:3px; bottom:1px; color:#fff6e5; font-size:13px;
  font-weight:700; text-shadow:0 1px 2px rgba(0,0,0,.8); }
.vg-hearts { position:absolute; bottom:70px; left:50%; transform:translateX(-50%);
  display:flex; gap:2px; pointer-events:none; }
.vg-heart { width:18px; height:18px; }
.vg-bubbles { position:absolute; bottom:92px; left:50%; transform:translateX(-50%);
  display:flex; gap:2px; pointer-events:none; }
.vg-bubble { width:16px; height:16px; }
.vg-toast { position:absolute; bottom:104px; left:50%; transform:translateX(-50%);
  background:rgba(255,246,229,.92); color:#2e2a26; padding:6px 14px; border-radius:10px;
  font-size:14px; letter-spacing:.02em; pointer-events:none; opacity:0;
  transition:opacity .25s; white-space:nowrap; }
`;

function heartSVG(fill) {
  // fill: 0 empty, 1 half, 2 full
  const base = '#3a2e28', red = '#ff5a54', hi = '#ffb3ac';
  const heart = 'M9 16 C4 12 1 9 1 5.5 C1 3 3 1.5 5 1.5 C6.6 1.5 8.2 2.4 9 4 C9.8 2.4 11.4 1.5 13 1.5 C15 1.5 17 3 17 5.5 C17 9 14 12 9 16 Z';
  let inner = `<path d="${heart}" fill="${base}" opacity=".35"/>`;
  if (fill === 2) inner += `<path d="${heart}" fill="${red}"/><circle cx="6" cy="5.4" r="1.3" fill="${hi}"/>`;
  else if (fill === 1) inner += `<clipPath id="h"><rect x="0" y="0" width="9" height="18"/></clipPath><path d="${heart}" fill="${red}" clip-path="url(#h)"/><circle cx="6" cy="5.4" r="1.3" fill="${hi}"/>`;
  return `<svg viewBox="0 0 18 18" class="vg-heart">${inner}</svg>`;
}
function bubbleSVG(on) {
  return `<svg viewBox="0 0 16 16" class="vg-bubble"><circle cx="8" cy="8" r="6" fill="${on ? '#9ad0ff' : 'rgba(154,208,255,.2)'}" stroke="#dff2ff" stroke-width="1.5"/><circle cx="6" cy="6" r="1.6" fill="#ffffff" opacity="${on ? .8 : .15}"/></svg>`;
}

export class Hud {
  constructor(hudRoot, inventory, icons) {
    this.inventory = inventory;
    this.icons = icons;

    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    this.hotbar = document.createElement('div');
    this.hotbar.className = 'vg-hotbar';
    this.slotEls = [];
    for (let i = 0; i < 9; i++) {
      const el = document.createElement('div');
      el.className = 'vg-slot';
      el.innerHTML = '<img style="display:none"><span class="ct"></span>';
      this.hotbar.appendChild(el);
      this.slotEls.push(el);
    }
    hudRoot.appendChild(this.hotbar);

    this.hearts = document.createElement('div');
    this.hearts.className = 'vg-hearts';
    hudRoot.appendChild(this.hearts);

    this.bubbles = document.createElement('div');
    this.bubbles.className = 'vg-bubbles';
    this.bubbles.style.display = 'none';
    hudRoot.appendChild(this.bubbles);

    this.toast = document.createElement('div');
    this.toast.className = 'vg-toast';
    hudRoot.appendChild(this.toast);
    this.toastTimer = null;

    this._lastHealth = -1;
    this._lastAir = -1;
    this.render();
  }

  render() {
    const inv = this.inventory;
    for (let i = 0; i < 9; i++) {
      const el = this.slotEls[i];
      const s = inv.slots[i];
      el.classList.toggle('sel', i === inv.selected);
      const img = el.querySelector('img');
      const ct = el.querySelector('.ct');
      if (s) {
        img.src = this.icons.get(s.id);
        img.style.display = 'block';
        ct.textContent = s.count > 1 ? s.count : '';
      } else {
        img.style.display = 'none';
        ct.textContent = '';
      }
    }
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toast.style.opacity = '0'; }, 1200);
  }

  updateVitals(player) {
    const h = Math.max(0, Math.round(player.health));
    if (h !== this._lastHealth) {
      this._lastHealth = h;
      let html = '';
      for (let i = 0; i < 10; i++) {
        html += heartSVG(h >= i * 2 + 2 ? 2 : h === i * 2 + 1 ? 1 : 0);
      }
      this.hearts.innerHTML = html;
    }
    const airOn = player.headInWater;
    const a = airOn ? Math.ceil(player.air) : -1;
    if (a !== this._lastAir) {
      this._lastAir = a;
      this.bubbles.style.display = airOn ? 'flex' : 'none';
      if (airOn) {
        let html = '';
        for (let i = 0; i < 10; i++) html += bubbleSVG(a > i);
        this.bubbles.innerHTML = html;
      }
    }
  }
}
