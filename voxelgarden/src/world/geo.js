// Turn mesher output arrays into a THREE.BufferGeometry (main thread only).
import * as THREE from 'three';

export function geometryFromArrays(a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(a.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(a.colors, 3));
  if (a.glows && a.glows.length) g.setAttribute('glow', new THREE.BufferAttribute(a.glows, 1));
  g.setIndex(new THREE.BufferAttribute(a.indices, 1));
  return g;
}
