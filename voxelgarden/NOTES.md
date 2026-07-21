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

## Phase 5 — Sky & sound

- **Two real bugs found by testing:**
  1. *sRGB vs linear tint:* the day/night tint uniform multiplies in linear space, so
     an "0.3 brightness" night tint rendered as ~0.58 perceived — night barely looked
     dark. Keyframe tints are now converted with `convertSRGBToLinear()`.
  2. *Edit-remesh starvation:* block-edit remeshes were queued behind the initial
     ~289-chunk geometry upload flood (2/frame), so placing a block could take
     seconds to appear. Edit remeshes now bypass the streaming queue and upload
     the same frame; the streaming budget briefly raises to 4/frame during floods.
- **Lantern fullbright** is a per-vertex `glow` attribute + `onBeforeCompile` patch on
  the basic material: `diffuseColor.rgb *= mix(uTint, vec3(1), glow)`. Verified at
  night: lantern + immediate neighbors stay warm-bright while the world sleeps.
- **Sun path** rises at dawn-mid, sets at dusk-mid; moon runs the counter-schedule.
  Stars fade with `nightness`; clouds dim at night and wrap in a 560-block window.
- **Headless perf note:** SwiftShader (software GL) caps the harness at ~5-10 fps from
  rasterization alone — JS frame cost measured at ~3.6 ms (window.__perf). Real-GPU
  budget tracking uses draw calls (~120 after frustum culling) + JS ms, not headless fps.
- Audio: master -> lowpass graph, family-pitched place/break/step blips, wind pad,
  night crickets; underwater flips the lowpass to 620 Hz. Started on first click.

## Phase 6 — Items, inventory, crafting, furnace

- **Lantern recipe (house rule):** the spec's recipe list has no lantern, but the
  definition-of-done requires lighting a shelter on day one. Added: 1 coal + 2 planks
  (shapeless) -> 2 lanterns.
- **Icons:** block items are snapshotted from an offscreen orthographic Three scene
  (per spec); tools/materials are painted 16x16 pixel art instead of 3D-modeled —
  looks crisper at HUD size (deviation noted).
- **Creative breaking drops nothing** (avoids trivial item duplication in debug mode).
- **Furnace output slot is take-only**; the furnace UI re-renders 4x/s since smelting
  continues while the screen is open or closed. Furnace contents drop when broken.
- **Drop magnetism steers velocity directly** — force accumulation overshot and
  orbited the player at low frame rates.
- **Bug fixed by test:** the craft result never matched because the grid holds stack
  objects, not id strings — matchRecipe now gets a mapped id grid.
- Tests: crafting matcher unit-tested in Node (13 cases incl. mirrored shapes);
  browser test crafts through real DOM clicks, smelts, checks tier gating + pickup.

## Phase 7 — Mobs, combat, health, death

- **Mob bodies** are Three box groups (no models): puffs = round fluffy body + head +
  4 stubby legs in a random pastel; shamblers = indigo humanoid with fullbright yellow
  eyes (eyes/lanterns use `noTint` materials so night lighting doesn't dim them).
- **Shared physics:** mobs reuse `stepEntity` from the player's collision module.
  Steering is velocity-approach with auto-jump when a 1-block obstacle sits directly
  ahead and there's headroom.
- **Combat:** LMB attacks via mob-AABB ray test (mob nearer than the block target wins,
  reach 4); 0.4s cooldown; hand=1, sword=4/5/6/7. Hits flash red, knock back + up,
  thump + spark particles. Mobs shrink-fade on death.
- **Damage plumbing** (all half-heart units, 20 = 10 hearts): fall = floor(blocks)-3
  half-hearts past 3; drown = 10s air then 1/s; cactus = 1/s of contact; shambler
  melee = 4 with knockback. Regen 1 per 4s after 8s undamaged. Creative is immune.
- **Death:** red fade + Respawn button; the whole inventory drops as entities at the
  death spot; respawn restores full health at the world spawn.
- **Spawning:** puffs in daylight on grass, cap 12; shamblers at night on solid ground,
  cap 10, despawn at sunrise with a dark poof (verified: a shambler placed in daylight
  self-despawns immediately).
- **Particles:** added the pooled `Points` system now (needed for hits/poof/splash/
  break-burst) rather than waiting for Phase 8; block-break bursts use per-block colors.
- **Test-harness gotcha (not a game bug):** the camera yaw convention is
  `fwd = (-sin yaw, ·, -cos yaw)`, so `yaw = atan2(-dx, -dz)` to aim at a point — my
  first screenshot attempts pointed 180° away. Documented so future shots aim right.

## Phase 8 — Persistence & polish

- **State machine** (`title / playing / paused / dead`): the loop always renders; the
  title state runs a slow camera orbit over the spawn area as a live backdrop, and
  simulation (player/mobs/drops/furnaces) only runs while playing or dead.
- **World reuse:** rather than tearing down and rebuilding every per-world object on
  New World / Continue, all systems persist and expose `reset`/`clear` — the World just
  terminates and restarts its worker with the new seed.
- **Save format (IndexedDB):** `meta` store holds seed, time, player (pos/rot/spawn/
  health/air), inventory, furnace states, and dropped items; `chunks` store holds only
  edited chunks as raw Uint8Arrays. Loading regenerates from the seed then overlays
  saved chunks via a `chunkData` worker message. Autosave every 20s + on
  visibilitychange/beforeunload.
- **Bug fixed by the save round-trip test:** on Continue, the player instantly died.
  `fallStartY` (from the module-load spawn at y=60) was never reset when the world
  reloaded, so the first grounded frame registered a phantom 22-block fall (~19 dmg) and
  death dropped the whole inventory. Now every teleport (loadWorld/applySave/spawn-
  settle/respawn) resets `fallStartY`.
- **F3 debug overlay:** fps, xyz, chunk, loaded count, draws + triangles, mob/drop
  counts, time-of-day, hp. Vignette is the CSS radial in index.html.
- Particles and icon rendering already landed in Phases 6-7; this phase adds the menus,
  save system, and the debug overlay.
- **Test note:** the earlier items/mobs test scripts now call
  `__vg.loadWorld(seed); __vg.enterPlaying()` after load since the game boots to the
  title screen instead of straight into play.
