# Voxelgarden — build notes & decisions

Running log of decisions made during development, newest at the bottom.

## Phase 1 — Skeleton

- **Project location:** the repo root already contained an unrelated single-file game
  (`index.html`, "Chromopunk"). To avoid clobbering it, Voxelgarden lives in
  `voxelgarden/` — run `npm install && npm run dev` from there.
- **Lighting model:** using `MeshBasicMaterial` (unlit) with ALL lighting baked into
  vertex colors (per-face directional shade × 4-level ambient occlusion), plus a global
  day/night tint applied via `material.color` in Phase 5. This is the classic voxel-game
  look, costs nothing per frame, and makes lantern fullbright trivial. `normal`
  attributes are still emitted per spec in case a lit material is wanted later.
- **Draw passes:** spec says "opaque" + "transparent (water/leaves/glass)" meshes, but
  also (correctly) demands cutout leaves via `alphaTest`. Blended leaves + water in one
  material can't do both, so the split is: **solid pass** = opaque + cutout
  (leaves/glass) with `alphaTest: 0.5`, **water pass** = blended, `depthWrite: false`,
  drawn after. Still exactly 2 draw calls per chunk.
- **Water:** has its own small repeating canvas texture (not the atlas) so the whole
  water pass can scroll via `texture.offset`; water UVs are world-space. Water surface
  blocks render their top at y+0.85 for a shoreline lip.
- **Face culling rules:** opaque blocks cull against opaque neighbors; cutout blocks
  (leaves/glass) also cull faces against the *same* block id (no internal faces in a
  leaf blob / glass wall); water culls against water and opaque.
- **AO:** classic side1/side2/corner rule, 4 levels [0.42, 0.62, 0.8, 1.0], quad
  diagonal flipped toward the brighter pair to avoid seams.
- **Furnace faces:** the furnace shows its "mouth" texture on all 4 sides (blocks don't
  store facing — keeps chunk data at 1 byte per block). Reads fine in practice.
- **Snow drops dirt** per the spec table (a bit odd, but following spec).
- **Testing:** `scripts/smoke.mjs` drives headless Chromium (SwiftShader) against the
  dev server: console errors, fps sample, screenshots. Software rendering caps around
  30–40 fps in the harness; on any real GPU this scene is far past 60 — treating the
  headless number as a regression signal only.

## Phase 1 acceptance

- Textured flat chunk with tree, pool, ore/utility sample blocks: ✅ (screenshot)
- Pointer lock + fly camera: ✅
- Console: clean (fixed a favicon 404 with an inline SVG icon).

## Phase 2 — Real world

- **Worker protocol:** the worker is authoritative for *generated* data (regenerates
  unedited chunks on demand, keeps edited ones); the main thread owns edits and streams
  them to the worker (`edits` messages) before requesting remeshes. Chunk loads reply
  with data + both geometry array sets, all as transferables.
- **Cross-chunk correctness:** meshing always materializes the 3x3 chunk neighborhood
  in the worker first, then meshes from an 18x98x18 padded snapshot — AO and culling
  are seam-correct, including diagonal chunks.
- **Streaming:** requests are queued nearest-first, max 10 in flight, re-sorted when
  the player crosses a chunk border; 2 geometry uploads/frame on the main thread.
  Unload beyond distance 10 (worker drops unedited copies too).
- **Testing:** `scripts/stream-test.mjs` teleports the camera 400 blocks and checks
  load/unload counts and console cleanliness (289 loaded at rest, settles fully,
  no errors).
