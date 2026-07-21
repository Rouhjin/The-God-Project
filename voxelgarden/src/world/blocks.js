// Block registry. Ids are stable — they are written into chunk Uint8Arrays and saves.
import { TILE } from './atlas.js';

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  LOG: 6,
  PLANKS: 7,
  LEAVES: 8,
  GLASS: 9,
  WATER: 10,
  BEDROCK: 11,
  COAL_ORE: 12,
  IRON_ORE: 13,
  GOLD_ORE: 14,
  DIAMOND_ORE: 15,
  LANTERN: 16,
  SNOW: 17,
  CACTUS: 18,
  CRAFT: 19,
  FURNACE: 20,
  TALLGRASS: 21,
  FLOWER_A: 22,
  FLOWER_B: 23,
  BED: 24,
};

// tool: which tool class speeds this block up. tier: minimum pickaxe tier for drops
// (0 none, 1 wood, 2 stone, 3 iron, 4 diamond). drops: item name or null.
// tiles: [top, bottom, side].
export const BLOCKS = [];
function def(id, name, o) {
  BLOCKS[id] = {
    id, name,
    solid: o.solid !== false,
    opaque: o.opaque !== false,
    hardness: o.hardness ?? 1,
    tool: o.tool ?? null,
    tier: o.tier ?? 0,
    drops: o.drops === undefined ? name : o.drops,
    tiles: o.tiles ?? [TILE.STONE, TILE.STONE, TILE.STONE],
    glow: o.glow ?? false,
    cross: o.cross ?? false,   // rendered as crossed billboard quads (plants)
    replaceable: o.replaceable ?? false, // blocks can be placed into this cell
  };
}

def(B.AIR, 'air', { solid: false, opaque: false, drops: null });
def(B.GRASS, 'grass', { hardness: 0.9, tool: 'shovel', drops: 'dirt', tiles: [TILE.GRASS_TOP, TILE.DIRT, TILE.GRASS_SIDE] });
def(B.DIRT, 'dirt', { hardness: 0.75, tool: 'shovel', tiles: [TILE.DIRT, TILE.DIRT, TILE.DIRT] });
def(B.STONE, 'stone', { hardness: 2.5, tool: 'pick', tier: 1, drops: 'cobblestone', tiles: [TILE.STONE, TILE.STONE, TILE.STONE] });
def(B.COBBLE, 'cobblestone', { hardness: 3.0, tool: 'pick', tier: 1, tiles: [TILE.COBBLE, TILE.COBBLE, TILE.COBBLE] });
def(B.SAND, 'sand', { hardness: 0.75, tool: 'shovel', tiles: [TILE.SAND, TILE.SAND, TILE.SAND] });
def(B.LOG, 'log', { hardness: 1.5, tool: 'axe', tiles: [TILE.LOG_TOP, TILE.LOG_TOP, TILE.LOG_SIDE] });
def(B.PLANKS, 'planks', { hardness: 1.5, tool: 'axe', tiles: [TILE.PLANKS, TILE.PLANKS, TILE.PLANKS] });
def(B.LEAVES, 'leaves', { hardness: 0.3, opaque: false, drops: null, tiles: [TILE.LEAVES, TILE.LEAVES, TILE.LEAVES] });
def(B.GLASS, 'glass', { hardness: 0.4, opaque: false, drops: null, tiles: [TILE.GLASS, TILE.GLASS, TILE.GLASS] });
def(B.WATER, 'water', { solid: false, opaque: false, drops: null, tiles: [TILE.WATER, TILE.WATER, TILE.WATER] });
def(B.BEDROCK, 'bedrock', { hardness: Infinity, drops: null, tiles: [TILE.BEDROCK, TILE.BEDROCK, TILE.BEDROCK] });
def(B.COAL_ORE, 'coal ore', { hardness: 3.5, tool: 'pick', tier: 1, drops: 'coal', tiles: [TILE.COAL_ORE, TILE.COAL_ORE, TILE.COAL_ORE] });
def(B.IRON_ORE, 'iron ore', { hardness: 4.0, tool: 'pick', tier: 2, tiles: [TILE.IRON_ORE, TILE.IRON_ORE, TILE.IRON_ORE] });
def(B.GOLD_ORE, 'gold ore', { hardness: 4.0, tool: 'pick', tier: 3, tiles: [TILE.GOLD_ORE, TILE.GOLD_ORE, TILE.GOLD_ORE] });
def(B.DIAMOND_ORE, 'diamond ore', { hardness: 4.5, tool: 'pick', tier: 3, drops: 'diamond', tiles: [TILE.DIAMOND_ORE, TILE.DIAMOND_ORE, TILE.DIAMOND_ORE] });
def(B.LANTERN, 'lantern', { hardness: 0.5, glow: true, tiles: [TILE.LANTERN, TILE.LANTERN, TILE.LANTERN] });
def(B.SNOW, 'snow', { hardness: 0.8, tool: 'shovel', drops: 'dirt', tiles: [TILE.SNOW, TILE.SNOW, TILE.SNOW] });
def(B.CACTUS, 'cactus', { hardness: 0.6, tiles: [TILE.CACTUS_TOP, TILE.CACTUS_TOP, TILE.CACTUS_SIDE] });
def(B.CRAFT, 'crafting table', { hardness: 1.5, tool: 'axe', tiles: [TILE.CRAFT_TOP, TILE.PLANKS, TILE.CRAFT_SIDE] });
def(B.FURNACE, 'furnace', { hardness: 3.0, tool: 'pick', tier: 1, tiles: [TILE.FURNACE_TOP, TILE.FURNACE_TOP, TILE.FURNACE_FRONT] });
def(B.TALLGRASS, 'tall grass', { solid: false, opaque: false, cross: true, replaceable: true, hardness: 0.05, drops: null, tiles: [TILE.TALLGRASS, TILE.TALLGRASS, TILE.TALLGRASS] });
def(B.FLOWER_A, 'pink flower', { solid: false, opaque: false, cross: true, replaceable: true, hardness: 0.05, drops: null, tiles: [TILE.FLOWER_A, TILE.FLOWER_A, TILE.FLOWER_A] });
def(B.FLOWER_B, 'yellow flower', { solid: false, opaque: false, cross: true, replaceable: true, hardness: 0.05, drops: null, tiles: [TILE.FLOWER_B, TILE.FLOWER_B, TILE.FLOWER_B] });
def(B.BED, 'bed', { hardness: 0.5, tool: 'axe', tiles: [TILE.BED_TOP, TILE.PLANKS, TILE.BED_SIDE] });

export function isOpaque(id) { return BLOCKS[id] ? BLOCKS[id].opaque : false; }
export function isSolid(id) { return BLOCKS[id] ? BLOCKS[id].solid : false; }
