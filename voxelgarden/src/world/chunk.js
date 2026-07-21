// Chunk data: 16x16 columns, 96 tall, one Uint8Array, indexed x + z*16 + y*256.
export const CX = 16, CY = 96, CZ = 16;
export const CHUNK_VOLUME = CX * CY * CZ;

export function blockIndex(x, y, z) {
  return x + z * 16 + y * 256;
}

export function chunkKey(cx, cz) { return cx + ',' + cz; }

export class Chunk {
  constructor(cx, cz, data) {
    this.cx = cx;
    this.cz = cz;
    this.data = data || new Uint8Array(CHUNK_VOLUME);
    this.mesh = null;       // opaque/cutout mesh
    this.waterMesh = null;
    this.edited = false;    // needs saving
  }
  get(x, y, z) {
    if (y < 0 || y >= CY) return 0;
    return this.data[x + z * 16 + y * 256];
  }
  set(x, y, z, v) {
    if (y < 0 || y >= CY) return;
    this.data[x + z * 16 + y * 256] = v;
  }
}
