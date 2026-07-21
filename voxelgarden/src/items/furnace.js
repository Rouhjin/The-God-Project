// Furnace block entities: keyed by position, keep smelting while UIs are closed.
import { ITEMS } from './items.js';

export const SMELT = { 'iron ore': 'iron ingot', 'gold ore': 'gold ingot', sand: 'glass', log: 'coal' };
export const FUEL = { coal: 8, planks: 1.5 };
export const SMELT_TIME = 10;

export class Furnaces {
  constructor() {
    this.map = new Map(); // "x,y,z" -> { slots: [input, fuel, output], progress, fuelLeft, fuelMax }
  }

  key(x, y, z) { return x + ',' + y + ',' + z; }

  get(x, y, z) {
    const k = this.key(x, y, z);
    let f = this.map.get(k);
    if (!f) {
      f = { slots: [null, null, null], progress: 0, fuelLeft: 0, fuelMax: 1 };
      this.map.set(k, f);
    }
    return f;
  }

  update(dt, onPop) {
    for (const [, f] of this.map) {
      const [input, fuel] = f.slots;
      const smeltable = input && SMELT[input.id];
      const out = f.slots[2];
      const outputOk = smeltable &&
        (!out || (out.id === SMELT[input.id] && out.count < ITEMS[out.id].stack));

      if (!smeltable || !outputOk) { f.progress = 0; continue; }

      // light new fuel if needed
      if (f.fuelLeft <= 0) {
        if (fuel && FUEL[fuel.id]) {
          f.fuelLeft += FUEL[fuel.id];
          f.fuelMax = FUEL[fuel.id];
          fuel.count--;
          if (fuel.count <= 0) f.slots[1] = null;
        } else {
          f.progress = Math.max(0, f.progress - dt); // dying embers
          continue;
        }
      }

      f.progress += dt;
      if (f.progress >= SMELT_TIME) {
        f.progress = 0;
        f.fuelLeft = Math.max(0, f.fuelLeft - 1);
        const result = SMELT[input.id];
        input.count--;
        if (input.count <= 0) f.slots[0] = null;
        if (out) out.count++;
        else f.slots[2] = { id: result, count: 1 };
        if (onPop) onPop();
      }
    }
  }

  // returns items to scatter when the furnace block is broken
  breakAt(x, y, z) {
    const k = this.key(x, y, z);
    const f = this.map.get(k);
    if (!f) return [];
    this.map.delete(k);
    return f.slots.filter(Boolean);
  }

  serialize() {
    const out = {};
    for (const [k, f] of this.map) {
      if (f.slots.some(Boolean) || f.fuelLeft > 0) {
        out[k] = { slots: f.slots, progress: f.progress, fuelLeft: f.fuelLeft, fuelMax: f.fuelMax };
      }
    }
    return out;
  }
  restore(data) {
    this.map.clear();
    for (const [k, f] of Object.entries(data || {})) {
      this.map.set(k, { slots: f.slots.map((s) => (s && ITEMS[s.id] ? { ...s } : null)), progress: f.progress || 0, fuelLeft: f.fuelLeft || 0, fuelMax: f.fuelMax || 1 });
    }
  }
}
