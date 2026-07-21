// Phase 8 test: title -> new world -> edit/inventory -> save -> reload -> continue
// restores position, inventory, time, and edited blocks.
import { chromium } from 'playwright-core';

const shotDir = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-The-God-Project/7637e2ac-0462-5079-b193-ff3c255963ce/scratchpad';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
const messages = [];
const hook = (p) => {
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) messages.push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`));
};
hook(page);

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(4500);

// start a new world with a fixed seed
await page.evaluate(async () => {
  await window.__vg.saveManager.wipe();
  window.__vg.loadWorld('save-test-seed');
  window.__vg.enterPlaying();
});
await page.waitForTimeout(3500);

// make edits + give inventory + set time, then save
const saved = await page.evaluate(async () => {
  const vg = window.__vg;
  // edit a few blocks near the player
  const p = vg.player.pos;
  const bx = Math.floor(p.x), bz = Math.floor(p.z);
  let gy = Math.floor(p.y);
  while (gy > 2 && !vg.world.isSolidAt(bx, gy - 1, bz)) gy--;
  vg.world.setBlock(bx + 1, gy, bz, 4);      // cobblestone
  vg.world.setBlock(bx + 1, gy + 1, bz, 16); // lantern
  vg.world.setBlock(bx + 2, gy, bz, 7);      // planks
  vg.inventory.add('diamond', 7);
  vg.inventory.add('iron ingot', 12);
  vg.sky.time = 0.5 * 720;
  vg.player.pos.set(bx + 0.5, gy + 1.5, bz + 0.5);
  vg.player.spawnPoint.set(bx + 0.5, gy + 1, bz + 0.5);
  await vg.doSave();
  return {
    pos: [Math.round(vg.player.pos.x), Math.round(vg.player.pos.y), Math.round(vg.player.pos.z)],
    editedChunks: vg.world.getEditedChunks().length,
    b1: vg.world.getBlock(bx + 1, gy, bz),
    b2: vg.world.getBlock(bx + 1, gy + 1, bz),
    diamonds: vg.inventory.has('diamond', 7),
    time: vg.sky.time,
    bx, gy, bz,
  };
});

// reload the page (fresh container, same IndexedDB) and Continue
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4500);
const hasSave = await page.evaluate(() => window.__vg.saveManager.hasSave());
// click Continue
await page.evaluate(async () => {
  const meta = await window.__vg.saveManager.loadMeta();
  const chunks = await window.__vg.saveManager.loadChunks();
  if (meta && meta.seed !== undefined) window.__vg.loadWorld(meta.seed);
  window.__vg.applySave(meta, chunks);
  window.__vg.enterPlaying();
});
await page.waitForTimeout(3500);

const restored = await page.evaluate(() => {
  const vg = window.__vg;
  const { bx, gy, bz } = window.__lastEdit || {};
  return {
    pos: [Math.round(vg.player.pos.x), Math.round(vg.player.pos.y), Math.round(vg.player.pos.z)],
    diamonds: vg.inventory.has('diamond', 7),
    iron: vg.inventory.has('iron ingot', 12),
    time: vg.sky.time,
    seed: vg.world.seed,
  };
});
// verify edited blocks came back
const blocksBack = await page.evaluate((e) => {
  const vg = window.__vg;
  return {
    cobble: vg.world.getBlock(e.bx + 1, e.gy, e.bz),
    lantern: vg.world.getBlock(e.bx + 1, e.gy + 1, e.bz),
    planks: vg.world.getBlock(e.bx + 2, e.gy, e.bz),
  };
}, { bx: saved.bx, gy: saved.gy, bz: saved.bz });

console.log(JSON.stringify({ saved, hasSave, restored, blocksBack }, null, 1));
console.log(messages.length ? `CONSOLE ISSUES:\n` + messages.slice(0, 20).join('\n') : 'No console errors/warnings.');
await browser.close();
