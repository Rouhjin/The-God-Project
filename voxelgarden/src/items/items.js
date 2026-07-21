// Item registry. Items are identified by readable string ids (nice for saves).
// Kinds: 'block' (placeable), 'material', 'tool' (stack size 1).
import { B } from '../world/blocks.js';

export const ITEMS = {};
function item(id, def) { ITEMS[id] = { id, stack: 64, ...def }; }

// block items
item('dirt', { kind: 'block', block: B.DIRT });
item('cobblestone', { kind: 'block', block: B.COBBLE });
item('sand', { kind: 'block', block: B.SAND });
item('log', { kind: 'block', block: B.LOG });
item('planks', { kind: 'block', block: B.PLANKS });
item('glass', { kind: 'block', block: B.GLASS });
item('lantern', { kind: 'block', block: B.LANTERN });
item('cactus', { kind: 'block', block: B.CACTUS });
item('crafting table', { kind: 'block', block: B.CRAFT });
item('furnace', { kind: 'block', block: B.FURNACE });
item('iron ore', { kind: 'block', block: B.IRON_ORE });
item('gold ore', { kind: 'block', block: B.GOLD_ORE });
item('bed', { kind: 'block', block: B.BED });

// materials
item('stick', { kind: 'material' });
item('coal', { kind: 'material' });
item('iron ingot', { kind: 'material' });
item('gold ingot', { kind: 'material' });
item('diamond', { kind: 'material' });

// tools — tier: 1 wood, 2 stone, 3 iron, 4 diamond
const TIER_NAMES = ['', 'wood', 'stone', 'iron', 'diamond'];
const TIER_SPEED = [1, 2, 4, 6, 8];
const SWORD_DAMAGE = [1, 4, 5, 6, 7];
const TIER_DUR = [0, 60, 132, 250, 1500];
for (let tier = 1; tier <= 4; tier++) {
  const t = TIER_NAMES[tier];
  const dur = TIER_DUR[tier];
  item(`${t} pickaxe`, { kind: 'tool', stack: 1, tool: 'pick', tier, speed: TIER_SPEED[tier], maxDur: dur });
  item(`${t} axe`, { kind: 'tool', stack: 1, tool: 'axe', tier, speed: TIER_SPEED[tier], maxDur: dur });
  item(`${t} shovel`, { kind: 'tool', stack: 1, tool: 'shovel', tier, speed: TIER_SPEED[tier], maxDur: dur });
  item(`${t} sword`, { kind: 'tool', stack: 1, tool: 'sword', tier, damage: SWORD_DAMAGE[tier], maxDur: dur });
}

export const TIER_MATERIALS = { planks: 1, cobblestone: 2, 'iron ingot': 3, diamond: 4 };

// item id for what a block drops (null = nothing)
export function itemForBlockDrop(blockDef) {
  if (!blockDef.drops) return null;
  return ITEMS[blockDef.drops] ? blockDef.drops : null;
}
