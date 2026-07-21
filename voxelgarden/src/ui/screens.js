// Full-screen UI panels: inventory (with 2x2 craft), crafting table (3x3),
// furnace. Drag & drop via a cursor stack. Cream/ink/apricot storybook styling.
import { ITEMS } from '../items/items.js';
import { matchRecipe } from '../items/crafting.js';
import { SMELT, FUEL, SMELT_TIME } from '../items/furnace.js';

const STYLE = `
.vg-screen { position:absolute; inset:0; background:rgba(46,42,38,.45); display:flex;
  align-items:center; justify-content:center; pointer-events:auto; z-index:20; }
.vg-panel { background:#fff6e5; color:#2e2a26; border-radius:20px; padding:20px 24px;
  box-shadow:0 12px 40px rgba(20,12,4,.45); min-width:440px; }
.vg-panel h2 { font-size:18px; letter-spacing:.06em; margin-bottom:14px; }
.vg-grid { display:grid; gap:6px; }
.vg-uislot { width:48px; height:48px; background:#f0e2c8; border-radius:10px; position:relative;
  border:2px solid #e0cda6; box-sizing:border-box; cursor:pointer; }
.vg-uislot:hover { border-color:#ff9e64; }
.vg-uislot img { width:100%; height:100%; image-rendering:pixelated; display:block; pointer-events:none; }
.vg-uislot .ct { position:absolute; right:4px; bottom:2px; font-size:13px; font-weight:700;
  color:#2e2a26; text-shadow:0 1px 0 #fff6e5; pointer-events:none; }
.vg-uislot.result { border-color:#ff9e64; background:#ffe9d2; }
.vg-row { display:flex; align-items:center; gap:18px; margin-bottom:16px; }
.vg-arrow { font-size:26px; color:#ff9e64; font-weight:700; }
.vg-cursorstack { position:fixed; width:44px; height:44px; pointer-events:none; z-index:50;
  transform:translate(-22px,-22px); }
.vg-cursorstack img { width:100%; height:100%; image-rendering:pixelated; }
.vg-cursorstack .ct { position:absolute; right:2px; bottom:0; font-size:13px; font-weight:700;
  color:#fff6e5; text-shadow:0 1px 2px rgba(0,0,0,.7); }
.vg-flame { width:20px; height:26px; position:relative; }
.vg-flame .bg, .vg-flame .fg { position:absolute; inset:0;
  clip-path:polygon(50% 0, 78% 30%, 100% 60%, 84% 100%, 16% 100%, 0 60%, 24% 30%); }
.vg-flame .bg { background:#e0cda6; }
.vg-flame .fg { background:linear-gradient(#ffd447,#ff7b2e); transform-origin:bottom; }
.vg-bar { width:70px; height:12px; background:#e0cda6; border-radius:6px; overflow:hidden; }
.vg-bar .fill { height:100%; width:0; background:#ff9e64; border-radius:6px; }
.vg-sep { margin:14px 0 10px; font-size:13px; opacity:.6; letter-spacing:.05em; }
`;

export class Screens {
  constructor(hudRoot, inventory, furnaces, icons, audio, drops) {
    this.inventory = inventory;
    this.furnaces = furnaces;
    this.icons = icons;
    this.audio = audio;
    this.drops = drops;
    this.mode = null;             // null | 'inventory' | 'craft' | 'furnace'
    this.craftGrid = new Array(4).fill(null);
    this.tableGrid = new Array(9).fill(null);
    this.furnacePos = null;
    this.onOpenChange = null;
    this.spillAt = null;          // () => [x,y,z] where leftovers drop

    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'vg-screen';
    this.root.style.display = 'none';
    hudRoot.appendChild(this.root);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    this.cursorEl = document.createElement('div');
    this.cursorEl.className = 'vg-cursorstack';
    this.cursorEl.style.display = 'none';
    document.body.appendChild(this.cursorEl);
    document.addEventListener('mousemove', (e) => {
      this.cursorEl.style.left = e.clientX + 'px';
      this.cursorEl.style.top = e.clientY + 'px';
    });

  }

  get isOpen() { return this.mode !== null; }

  open(mode, furnacePos = null) {
    this.mode = mode;
    this.furnacePos = furnacePos;
    this.root.style.display = 'flex';
    this.build();
    if (this.onOpenChange) this.onOpenChange(true);
  }

  close() {
    if (!this.mode) return;
    // return crafting-grid contents
    for (const grid of [this.craftGrid, this.tableGrid]) {
      for (let i = 0; i < grid.length; i++) {
        if (grid[i]) {
          const left = this.inventory.add(grid[i].id, grid[i].count);
          if (left > 0 && this.spillAt && this.drops) {
            const [x, y, z] = this.spillAt();
            this.drops.spawn(x, y, z, grid[i].id, left);
          }
          grid[i] = null;
        }
      }
    }
    if (this.inventory.cursor) {
      const c = this.inventory.cursor;
      const left = this.inventory.add(c.id, c.count);
      if (left > 0 && this.spillAt && this.drops) {
        const [x, y, z] = this.spillAt();
        this.drops.spawn(x, y, z, c.id, left);
      }
      this.inventory.cursor = null;
    }
    this.mode = null;
    this.root.style.display = 'none';
    this.cursorEl.style.display = 'none';
    if (this.onOpenChange) this.onOpenChange(false);
  }

  // ---- DOM building ----
  slotEl(arr, i, opts = {}) {
    const el = document.createElement('div');
    el.className = 'vg-uislot' + (opts.result ? ' result' : '');
    el.innerHTML = '<img style="display:none"><span class="ct"></span>';
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (opts.result) this.takeResult(e.button);
      else if (opts.takeOnly) {
        const s = arr[i];
        const inv = this.inventory;
        if (!s) return;
        if (!inv.cursor) { inv.cursor = s; arr[i] = null; }
        else if (inv.cursor.id === s.id && inv.cursor.count + s.count <= ITEMS[s.id].stack) {
          inv.cursor.count += s.count; arr[i] = null;
        } else return;
        this.audio.click();
        this.render();
      } else {
        this.inventory.clickSlot(arr, i, e.button);
        this.audio.click();
        this.render();
      }
    });
    el._bind = { arr, i, result: opts.result };
    this.slotEls.push(el);
    return el;
  }

  grid(arr, cols, start, count, opts) {
    const g = document.createElement('div');
    g.className = 'vg-grid';
    g.style.gridTemplateColumns = `repeat(${cols}, 48px)`;
    for (let i = start; i < start + count; i++) g.appendChild(this.slotEl(arr, i, opts));
    return g;
  }

  build() {
    this.slotEls = [];
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'vg-panel';
    this.root.appendChild(panel);

    const title = document.createElement('h2');
    panel.appendChild(title);

    if (this.mode === 'inventory' || this.mode === 'craft') {
      const isTable = this.mode === 'craft';
      title.textContent = isTable ? 'Crafting table' : 'Inventory';
      const grid = isTable ? this.tableGrid : this.craftGrid;
      const size = isTable ? 3 : 2;
      const row = document.createElement('div');
      row.className = 'vg-row';
      row.appendChild(this.grid(grid, size, 0, size * size));
      const arrow = document.createElement('div');
      arrow.className = 'vg-arrow';
      arrow.textContent = '→';
      row.appendChild(arrow);
      this.resultArr = [null];
      row.appendChild(this.grid(this.resultArr, 1, 0, 1, { result: true }));
      panel.appendChild(row);
    } else if (this.mode === 'furnace') {
      title.textContent = 'Furnace';
      const f = this.furnaces.get(...this.furnacePos);
      const row = document.createElement('div');
      row.className = 'vg-row';
      const col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center;';
      col.appendChild(this.grid(f.slots, 1, 0, 1));       // input
      const flame = document.createElement('div');
      flame.className = 'vg-flame';
      flame.innerHTML = '<div class="bg"></div><div class="fg"></div>';
      this.flameEl = flame.querySelector('.fg');
      col.appendChild(flame);
      col.appendChild(this.grid(f.slots, 1, 1, 1));       // fuel
      row.appendChild(col);
      const bar = document.createElement('div');
      bar.className = 'vg-bar';
      bar.innerHTML = '<div class="fill"></div>';
      this.barEl = bar.querySelector('.fill');
      row.appendChild(bar);
      row.appendChild(this.grid(f.slots, 1, 2, 1, { takeOnly: true })); // output
      panel.appendChild(row);
    }

    const sep = document.createElement('div');
    sep.className = 'vg-sep';
    sep.textContent = '· · ·';
    panel.appendChild(sep);
    panel.appendChild(this.grid(this.inventory.slots, 9, 9, 27));
    const sep2 = document.createElement('div');
    sep2.style.height = '8px';
    panel.appendChild(sep2);
    panel.appendChild(this.grid(this.inventory.slots, 9, 0, 9));

    this.render();
  }

  activeCraft() {
    if (this.mode === 'inventory') return { grid: this.craftGrid, size: 2 };
    if (this.mode === 'craft') return { grid: this.tableGrid, size: 3 };
    return null;
  }

  matchFor(c) {
    return matchRecipe(c.grid.map((s) => (s ? s.id : null)), c.size);
  }

  takeResult(button) {
    const c = this.activeCraft();
    if (!c) return;
    const match = this.matchFor(c);
    if (!match) return;
    const inv = this.inventory;
    const max = ITEMS[match.result].stack;
    if (inv.cursor && (inv.cursor.id !== match.result || inv.cursor.count + match.count > max)) return;
    if (!inv.cursor) inv.cursor = { id: match.result, count: match.count };
    else inv.cursor.count += match.count;
    for (let i = 0; i < c.grid.length; i++) {
      if (c.grid[i]) {
        c.grid[i].count--;
        if (c.grid[i].count <= 0) c.grid[i] = null;
      }
    }
    this.audio.craft();
    this.render();
  }

  renderSlot(el) {
    const { arr, i, result } = el._bind;
    let s;
    if (result) {
      const c = this.activeCraft();
      const m = c && this.matchFor(c);
      s = m ? { id: m.result, count: m.count } : null;
    } else s = arr[i];
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

  render() {
    if (!this.mode) return;
    for (const el of this.slotEls) this.renderSlot(el);
    // cursor stack
    const c = this.inventory.cursor;
    if (c) {
      this.cursorEl.style.display = 'block';
      this.cursorEl.innerHTML = `<img src="${this.icons.get(c.id)}"><span class="ct">${c.count > 1 ? c.count : ''}</span>`;
    } else this.cursorEl.style.display = 'none';
  }

  // live furnace bars + periodic slot refresh (smelting continues in background)
  update(dt) {
    if (this.mode !== 'furnace' || !this.furnacePos) return;
    const f = this.furnaces.get(...this.furnacePos);
    if (this.flameEl) this.flameEl.style.transform = `scaleY(${Math.min(1, f.fuelLeft / (f.fuelMax || 1))})`;
    if (this.barEl) this.barEl.style.width = `${(f.progress / SMELT_TIME) * 100}%`;
    this._refresh = (this._refresh || 0) - (dt || 0.016);
    if (this._refresh <= 0) { this._refresh = 0.25; this.render(); }
  }
}
