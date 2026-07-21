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

## Phase 3 — Player

- **Physics:** axis order X → Z → Y per spec, substepped so a fast fall can't tunnel.
  Horizontal control is exponential-approach (14/s on ground, 4/s airborne) — instant
  enough to feel snappy, keeps a little air momentum.
- **Sub-frame key taps:** a keydown+keyup inside one frame (fast tap) was invisible to
  the per-frame key set, eating jumps. Controls now also records edge-triggered
  `pressed` keys, cleared at frame end; jump consumes either.
- **Spawn:** deterministic spiral search for a column with height 36–60 so the player
  starts on dry land, then a snap-up pass once the chunk is loaded (in case of trees).
- **No auto-step:** climbing 1-block steps needs a jump (classic behavior).
- **Hold RMB** re-places every 0.25s; breaking resets progress when the target block
  changes or the button is released.
- Phase 3 uses a temporary 9-slot palette (planks/cobble/glass/...) until real
  inventory arrives in Phase 6; placing is free for now.

## Phase 4 — Living landscape

- **Chunk-independent structures:** every chunk scans a 2-column margin and re-derives
  tree/cactus decisions from per-column seeded hashes, writing only its own cells —
  trees crossing borders are generated identically by all chunks involved, no second
  pass needed. Ore veins likewise: each chunk re-walks the veins seeded in its 3x3
  chunk neighborhood and clips writes to itself.
- **Cave flood guard:** columns at/below sea level+1 only carve up to h-2, keeping a
  2-block floor under the water table. Horizontal water-vs-cave faces can still exist
  (static water, like classic alpha) — real spreading is a Phase 9 stretch item.
- **Ore rates** (9x9 chunk sample): coal .066%, iron .054%, gold .017%, diamond .006%
  of all blocks — correct rarity ordering, diamonds only y2-12.
- **Snow dusting:** snowfield trees get a checkered snow layer above the crown.
- **Trees skip beaches** (h <= sea+2) so shorelines stay open.
- `?seed=` URL param selects the world seed until the Phase 8 title screen arrives.
- `scripts/gen-stats.mjs` validates block distributions straight in Node (the
  generator is pure ESM — no browser needed).
