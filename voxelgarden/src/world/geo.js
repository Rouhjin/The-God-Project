// Turn mesher output arrays into a THREE.BufferGeometry (main thread only).
import * as THREE from 'three';

export function geometryFromArrays(a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(a.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(a.colors, 3));
  if (a.skyLight && a.skyLight.length) {
    g.setAttribute('skyLight', new THREE.BufferAttribute(a.skyLight, 1));
    g.setAttribute('blockLight', new THREE.BufferAttribute(a.blockLight, 1));
  }
  g.setIndex(new THREE.BufferAttribute(a.indices, 1));
  return g;
}
