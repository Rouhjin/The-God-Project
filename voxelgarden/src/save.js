// IndexedDB persistence. Two stores:
//   meta   — single 'world' record: seed, time, player state, inventory, furnaces, drops
//   chunks — key "cx,cz" -> raw Uint8Array, only for edited chunks (rest regenerates)
const DB_NAME = 'voxelgarden';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}
function done(t) {
  return new Promise((resolve, reject) => {
    t.transaction.oncomplete = () => resolve();
    t.transaction.onerror = () => reject(t.transaction.error);
    t.transaction.onabort = () => reject(t.transaction.error);
  });
}

export class SaveManager {
  constructor() {
    this.db = null;
    this.ready = openDB().then((db) => { this.db = db; }).catch((e) => {
      console.warn('Voxelgarden: IndexedDB unavailable, saving disabled', e);
    });
  }

  async hasSave() {
    await this.ready;
    if (!this.db) return false;
    return new Promise((resolve) => {
      const req = tx(this.db, 'meta', 'readonly').get('world');
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  }

  async loadMeta() {
    await this.ready;
    if (!this.db) return null;
    return new Promise((resolve) => {
      const req = tx(this.db, 'meta', 'readonly').get('world');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async loadChunks() {
    await this.ready;
    if (!this.db) return [];
    return new Promise((resolve) => {
      const store = tx(this.db, 'chunks', 'readonly');
      const out = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const [cx, cz] = cur.key.split(',').map(Number);
          out.push({ cx, cz, data: cur.value });
          cur.continue();
        } else resolve(out);
      };
      req.onerror = () => resolve(out);
    });
  }

  // meta: plain object; chunks: [{cx,cz,data:Uint8Array}]
  async save(meta, chunks) {
    await this.ready;
    if (!this.db) return;
    const mstore = tx(this.db, 'meta', 'readwrite');
    mstore.put(meta, 'world');
    await done(mstore);
    if (chunks && chunks.length) {
      const cstore = tx(this.db, 'chunks', 'readwrite');
      for (const c of chunks) {
        // store a copy so the live array isn't detached
        cstore.put(c.data.slice(), c.cx + ',' + c.cz);
      }
      await done(cstore);
    }
  }

  async wipe() {
    await this.ready;
    if (!this.db) return;
    const m = tx(this.db, 'meta', 'readwrite'); m.clear(); await done(m);
    const c = tx(this.db, 'chunks', 'readwrite'); c.clear(); await done(c);
  }
}
