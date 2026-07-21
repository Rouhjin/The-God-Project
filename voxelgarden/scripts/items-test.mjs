// Phase 6 test: inventory UI crafting via real DOM clicks, furnace smelting,
// drop gating, pickup magnetism.
import { chromium } from 'playwright-core';

const shotDir = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-The-God-Project/7637e2ac-0462-5079-b193-ff3c255963ce/scratchpad';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const messages = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) messages.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/?seed=meadow1', { waitUntil: 'load' });
await page.waitForTimeout(4000);

// give logs, open inventory
await page.evaluate(() => { window.__vg.inventory.add('log', 3); });
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
await page.screenshot({ path: `${shotDir}/inv-open.png` });

// craft: pick up logs from hotbar slot 0 (last 9 slots start at index 4+1+27=32),
// drop into craft cell 0, take result 3x
const slot = (i) => page.locator('.vg-panel .vg-uislot').nth(i);
await slot(32).dispatchEvent('mousedown', { button: 0 });   // pick up 3 logs
await slot(0).dispatchEvent('mousedown', { button: 0 });    // into craft cell
for (let i = 0; i < 3; i++) await slot(4).dispatchEvent('mousedown', { button: 0 }); // take planks x3
await slot(6).dispatchEvent('mousedown', { button: 0 });    // put 12 planks into inv slot (idx 6 = inv27 first cell -> inventory slot 9... actually index 5=first inv slot)
await page.waitForTimeout(200);
await page.screenshot({ path: `${shotDir}/inv-crafted.png` });
const afterCraft = await page.evaluate(() => JSON.stringify(window.__vg.inventory.slots.filter(Boolean)));
await page.keyboard.press('KeyE');

// furnace logic: simulate a furnace at a position, tick it manually
const furnaceOut = await page.evaluate(() => {
  const vg = window.__vg;
  const f = vg.furnaces.get(10, 40, 10);
  f.slots[0] = { id: 'iron ore', count: 2 };
  f.slots[1] = { id: 'coal', count: 1 };
  vg.furnaces.update(10.05);
  vg.furnaces.update(10.05);
  return JSON.stringify(f.slots);
});

// drop gating: stone broken by hand -> nothing; with wood pickaxe -> cobblestone
const gating = await page.evaluate(() => {
  const vg = window.__vg;
  const before = vg.drops.list.length;
  vg.inventory.slots[8] = null; vg.inventory.selected = 8; // empty hand
  vg.interact.onBreak(0, 30, 0, 3);
  const noPick = vg.drops.list.length - before;
  vg.inventory.slots[8] = { id: 'wood pickaxe', count: 1 };
  vg.interact.onBreak(0, 30, 0, 3);
  const withPick = vg.drops.list.length - before - noPick;
  const speedHand = (vg.inventory.selected = 7, vg.interact.speedMultiplier(3));
  const speedPick = (vg.inventory.selected = 8, vg.interact.speedMultiplier(3));
  return { noPick, withPick, speedHand, speedPick };
});

// pickup magnetism: spawn a drop right next to the player
const pickup = await page.evaluate(() => {
  const vg = window.__vg;
  const p = vg.player.pos;
  vg.drops.spawn(p.x + 0.8, p.y + 1, p.z, 'diamond', 2);
  return vg.drops.list.length;
});
await page.waitForTimeout(1000);
// walk over to the landed drop (magnet only reaches 1.5 blocks)
await page.evaluate(() => {
  const vg = window.__vg;
  const d = vg.drops.list.find((x) => x.itemId === 'diamond');
  if (d) vg.player.pos.set(d.pos.x + 0.4, d.pos.y + 0.1, d.pos.z);
});
await page.waitForTimeout(1200);
const pickedUp = await page.evaluate(() => ({
  dropsLeft: window.__vg.drops.list.filter((d) => d.itemId === 'diamond').length,
  hasDiamond: window.__vg.inventory.has('diamond', 2),
}));

console.log(JSON.stringify({ afterCraft: JSON.parse(afterCraft), furnaceOut: JSON.parse(furnaceOut), gating, pickup, pickedUp }, null, 1));
console.log(messages.length ? `CONSOLE ISSUES:\n` + messages.slice(0, 20).join('\n') : 'No console errors/warnings.');
await browser.close();
