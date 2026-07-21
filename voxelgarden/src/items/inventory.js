// Player inventory: 36 slots (0-8 = hotbar), plus a cursor stack for drag & drop.
// A slot is null or { id: itemId, count }.
import { ITEMS } from './items.js';

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null);
    this.selected = 0;         // hotbar index
    this.cursor = null;        // stack held by the mouse in UI screens
    this.onChange = null;      // UI refresh hook
  }

  changed() { if (this.onChange) this.onChange(); }

  selectedItem() {
    const s = this.slots[this.selected];
    return s ? ITEMS[s.id] : null;
  }

  // add items, preferring existing stacks; returns count that didn't fit
  add(id, count = 1) {
    const max = ITEMS[id].stack;
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const n = Math.min(max - s.count, count);
        s.count += n; count -= n;
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(max, count);
        this.slots[i] = { id, count: n };
        count -= n;
      }
    }
    this.changed();
    return count;
  }

  has(id, count = 1) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n >= count;
  }

  // remove count of the selected item (placing blocks)
  consumeSelected(count = 1) {
    const s = this.slots[this.selected];
    if (!s) return false;
    s.count -= count;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.changed();
    return true;
  }

  isEmpty() { return this.slots.every((s) => !s) && !this.cursor; }

  // drag & drop actions on a slot array (works for inventory + craft grids)
  // button 0 = pick up / place all / swap; button 2 = place one / split half
  clickSlot(arr, i, button) {
    const s = arr[i];
    if (!this.cursor) {
      if (!s) return;
      if (button === 2) {
        const take = Math.ceil(s.count / 2);
        this.cursor = { id: s.id, count: take };
        s.count -= take;
        if (s.count <= 0) arr[i] = null;
      } else {
        this.cursor = s;
        arr[i] = null;
      }
    } else {
      const max = ITEMS[this.cursor.id].stack;
      if (!s) {
        if (button === 2) {
          arr[i] = { id: this.cursor.id, count: 1 };
          this.cursor.count--;
        } else {
          arr[i] = this.cursor;
          this.cursor = null;
        }
      } else if (s.id === this.cursor.id) {
        const n = button === 2 ? 1 : this.cursor.count;
        const fit = Math.min(max - s.count, n);
        s.count += fit;
        this.cursor.count -= fit;
      } else if (button === 0) {
        arr[i] = this.cursor;
        this.cursor = s;
      }
      if (this.cursor && this.cursor.count <= 0) this.cursor = null;
    }
    this.changed();
  }

  serialize() {
    return { slots: this.slots, selected: this.selected };
  }
  restore(data) {
    if (data?.slots) this.slots = data.slots.map((s) => (s && ITEMS[s.id] ? { ...s } : null));
    while (this.slots.length < 36) this.slots.push(null);
    this.selected = data?.selected ?? 0;
    this.changed();
  }
}
