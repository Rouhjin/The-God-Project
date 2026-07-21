// Phase 3 test: pointer lock, walking with collision, breaking, placing.
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

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(3500);

// lock pointer
await page.mouse.click(480, 270);
await page.waitForTimeout(400);
const locked = await page.evaluate(() => window.__vg.controls.locked);

const p0 = await page.evaluate(() => ({ ...window.__vg.player.pos }));

// walk backward 1.5s (spawn may face an uphill step)
await page.keyboard.down('KeyS');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyS');
await page.waitForTimeout(600);
const p1 = await page.evaluate(() => ({ ...window.__vg.player.pos, ground: window.__vg.player.onGround }));

// jump
await page.keyboard.press('Space');
await page.waitForTimeout(250);
const midJumpY = await page.evaluate(() => window.__vg.player.pos.y);
await page.waitForTimeout(900);

// look down at the block in front and break it (grass: 0.9s)
await page.evaluate(() => { window.__vg.controls.pitch = -0.9; });
await page.waitForTimeout(200);
const target0 = await page.evaluate(() => window.__vg.interact.target && { ...window.__vg.interact.target });
await page.mouse.down({ button: 'left' });
await page.waitForTimeout(2600);
await page.mouse.up({ button: 'left' });
const afterBreak = await page.evaluate((t) => t ? window.__vg.world.getBlock(t.x, t.y, t.z) : -1, target0);

// place a block on whatever is now targeted
const target1 = await page.evaluate(() => window.__vg.interact.target && { ...window.__vg.interact.target });
await page.mouse.click(480, 270, { button: 'right' });
await page.waitForTimeout(300);
const placed = await page.evaluate((t) => t ? window.__vg.world.getBlock(t.x + t.nx, t.y + t.ny, t.z + t.nz) : -1, target1);

await page.screenshot({ path: `${shotDir}/player.png` });
console.log(JSON.stringify({
  locked,
  start: { x: +p0.x.toFixed(2), y: +p0.y.toFixed(2), z: +p0.z.toFixed(2) },
  afterWalk: { x: +p1.x.toFixed(2), y: +p1.y.toFixed(2), z: +p1.z.toFixed(2), ground: p1.ground },
  midJumpY: +midJumpY.toFixed(2),
  brokeTarget: target0 && `${target0.x},${target0.y},${target0.z} id=${target0.id}`,
  blockAfterBreak: afterBreak,
  placeTarget: target1 && `${target1.x + target1.nx},${target1.y + target1.ny},${target1.z + target1.nz}`,
  blockAfterPlace: placed,
}, null, 1));
console.log(messages.length ? `CONSOLE ISSUES:\n` + messages.slice(0, 20).join('\n') : 'No console errors/warnings.');
await browser.close();
