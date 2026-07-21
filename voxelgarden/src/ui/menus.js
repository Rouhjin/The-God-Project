// Title screen, pause menu, controls panel, F3 debug overlay.
// Storybook cream/ink/apricot styling, rounded chunky buttons.
const STYLE = `
.vg-menu { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:18px; z-index:25; pointer-events:auto; }
.vg-menu.title { background:linear-gradient(rgba(255,246,229,.08), rgba(46,42,38,.32)); }
.vg-menu.pause { background:rgba(46,42,38,.5); }
.vg-title { font-size:66px; letter-spacing:.04em; color:#fff6e5;
  text-shadow:0 3px 0 #ff9e64, 0 6px 20px rgba(30,18,6,.55); font-weight:800; }
.vg-subtitle { font-size:15px; color:#fff6e5; opacity:.9; margin-top:-10px;
  letter-spacing:.14em; text-transform:uppercase; }
.vg-card { background:#fff6e5; color:#2e2a26; border-radius:20px; padding:22px 26px;
  box-shadow:0 14px 44px rgba(20,12,4,.4); display:flex; flex-direction:column; gap:12px;
  min-width:300px; }
.vg-btn { font:inherit; font-size:17px; padding:13px 22px; border:none; border-radius:14px;
  background:#ff9e64; color:#2e2a26; cursor:pointer; letter-spacing:.03em; font-weight:700;
  transition:transform .08s, background .15s; }
.vg-btn:hover { background:#ffb07f; transform:translateY(-1px); }
.vg-btn.sec { background:#efe0c4; }
.vg-btn.sec:hover { background:#f6ebd6; }
.vg-btn:disabled { opacity:.4; cursor:default; transform:none; }
.vg-seedrow { display:flex; gap:8px; }
.vg-seedrow input { flex:1; font:inherit; font-size:15px; padding:11px 14px; border-radius:12px;
  border:2px solid #e0cda6; background:#fffdf7; color:#2e2a26; min-width:0; }
.vg-warn { font-size:12px; color:#b5652c; text-align:center; }
.vg-howto { position:absolute; bottom:22px; left:50%; transform:translateX(-50%);
  background:rgba(255,246,229,.9); color:#2e2a26; border-radius:14px; padding:12px 20px;
  font-size:13px; max-width:560px; text-align:center; line-height:1.6; }
.vg-controls-list { display:grid; grid-template-columns:auto 1fr; gap:6px 18px; font-size:14px; }
.vg-controls-list b { color:#b5652c; }
.vg-debug { position:absolute; top:8px; left:8px; background:rgba(46,42,38,.72);
  color:#c8f0a8; padding:8px 12px; border-radius:8px; font:12px/1.5 monospace;
  white-space:pre; pointer-events:none; z-index:15; }
`;

const CONTROLS = [
  ['WASD', 'Move'], ['Mouse', 'Look around'], ['Space', 'Jump / swim up'],
  ['Ctrl', 'Sprint'], ['Shift', 'Sneak'], ['Left click', 'Break / attack'],
  ['Right click', 'Place / use'], ['E', 'Inventory'], ['1–9 / Wheel', 'Hotbar'],
  ['Esc', 'Pause'], ['F3', 'Debug info'], ['F4', 'Creative mode'],
];

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.appendChild(s);
  styleInjected = true;
}

function controlsCard(onBack) {
  const card = document.createElement('div');
  card.className = 'vg-card';
  card.style.maxWidth = '420px';
  const h = document.createElement('div');
  h.style.cssText = 'font-size:20px;font-weight:800;letter-spacing:.04em;margin-bottom:4px;';
  h.textContent = 'Controls';
  card.appendChild(h);
  const list = document.createElement('div');
  list.className = 'vg-controls-list';
  for (const [k, v] of CONTROLS) {
    const b = document.createElement('b'); b.textContent = k;
    const d = document.createElement('span'); d.textContent = v;
    list.append(b, d);
  }
  card.appendChild(list);
  const back = document.createElement('button');
  back.className = 'vg-btn sec';
  back.textContent = 'Back';
  back.onclick = onBack;
  card.appendChild(back);
  return card;
}

export class TitleScreen {
  constructor(hudRoot, { onContinue, onNewWorld, hasSave }) {
    injectStyle();
    this.root = document.createElement('div');
    this.root.className = 'vg-menu title';
    hudRoot.appendChild(this.root);
    this.onContinue = onContinue;
    this.onNewWorld = onNewWorld;
    this.hasSave = hasSave;
    this.buildMain();
  }

  clear() { this.root.innerHTML = ''; }

  buildMain() {
    this.clear();
    const title = document.createElement('div');
    title.className = 'vg-title';
    title.textContent = 'Voxelgarden';
    const sub = document.createElement('div');
    sub.className = 'vg-subtitle';
    sub.textContent = 'a storybook meadow';
    this.root.append(title, sub);

    const card = document.createElement('div');
    card.className = 'vg-card';
    if (this.hasSave) {
      const cont = document.createElement('button');
      cont.className = 'vg-btn';
      cont.textContent = 'Continue';
      cont.onclick = () => this.onContinue();
      card.appendChild(cont);
    }
    const nw = document.createElement('button');
    nw.className = this.hasSave ? 'vg-btn sec' : 'vg-btn';
    nw.textContent = 'New World';
    nw.onclick = () => this.buildNewWorld();
    card.appendChild(nw);

    const ctrl = document.createElement('button');
    ctrl.className = 'vg-btn sec';
    ctrl.textContent = 'Controls';
    ctrl.onclick = () => this.buildControls();
    card.appendChild(ctrl);
    this.root.appendChild(card);

    const howto = document.createElement('div');
    howto.className = 'vg-howto';
    howto.innerHTML = '<b>How to play:</b> Punch trees for wood, craft tools at a table, ' +
      'dig for stone and ore, smelt iron in a furnace. Build a shelter and light a lantern ' +
      'before night — when the shamblers come out.';
    this.root.appendChild(howto);
  }

  buildNewWorld() {
    this.clear();
    const title = document.createElement('div');
    title.className = 'vg-title';
    title.style.fontSize = '48px';
    title.textContent = 'New World';
    this.root.appendChild(title);

    const card = document.createElement('div');
    card.className = 'vg-card';
    const row = document.createElement('div');
    row.className = 'vg-seedrow';
    const input = document.createElement('input');
    input.placeholder = 'Seed';
    input.value = 'meadow-' + Math.random().toString(36).slice(2, 7);
    const rand = document.createElement('button');
    rand.className = 'vg-btn sec';
    rand.style.padding = '11px 16px';
    rand.textContent = '🎲';
    rand.onclick = () => { input.value = 'meadow-' + Math.random().toString(36).slice(2, 7); };
    row.append(input, rand);
    card.appendChild(row);

    if (this.hasSave) {
      const warn = document.createElement('div');
      warn.className = 'vg-warn';
      warn.textContent = '⚠ This erases your current world.';
      card.appendChild(warn);
    }

    const go = document.createElement('button');
    go.className = 'vg-btn';
    go.textContent = 'Create';
    go.onclick = () => this.onNewWorld((input.value || 'voxelgarden').trim());
    card.appendChild(go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });

    const back = document.createElement('button');
    back.className = 'vg-btn sec';
    back.textContent = 'Back';
    back.onclick = () => this.buildMain();
    card.appendChild(back);
    this.root.appendChild(card);
    setTimeout(() => input.focus(), 50);
  }

  buildControls() {
    this.clear();
    this.root.appendChild(controlsCard(() => this.buildMain()));
  }

  hide() { this.root.style.display = 'none'; }
  show() { this.root.style.display = 'flex'; this.buildMain(); }
  destroy() { this.root.remove(); }
}

export class PauseMenu {
  constructor(hudRoot, { onResume, onSaveQuit }) {
    injectStyle();
    this.root = document.createElement('div');
    this.root.className = 'vg-menu pause';
    this.root.style.display = 'none';
    hudRoot.appendChild(this.root);
    this.onResume = onResume;
    this.onSaveQuit = onSaveQuit;
  }

  buildMain() {
    this.root.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'vg-title';
    title.style.fontSize = '40px';
    title.textContent = 'Paused';
    this.root.appendChild(title);
    const card = document.createElement('div');
    card.className = 'vg-card';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'vg-btn ' + cls;
      b.textContent = label;
      b.onclick = fn;
      card.appendChild(b);
    };
    mk('Resume', '', () => this.onResume());
    mk('Controls', 'sec', () => this.buildControls());
    mk('Save & Quit to Title', 'sec', () => this.onSaveQuit());
    this.root.appendChild(card);
  }

  buildControls() {
    this.root.innerHTML = '';
    this.root.appendChild(controlsCard(() => this.buildMain()));
  }

  get isOpen() { return this.root.style.display !== 'none'; }
  open() { this.root.style.display = 'flex'; this.buildMain(); }
  close() { this.root.style.display = 'none'; }
}

export class DebugOverlay {
  constructor(hudRoot) {
    injectStyle();
    this.el = document.createElement('div');
    this.el.className = 'vg-debug';
    this.el.style.display = 'none';
    hudRoot.appendChild(this.el);
    this.visible = false;
  }
  toggle() { this.visible = !this.visible; this.el.style.display = this.visible ? 'block' : 'none'; }
  set(text) { if (this.visible) this.el.textContent = text; }
}
