// Screenshot the four phases of the day/night cycle.
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
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const vg = window.__vg;
  vg.player.creative = true; vg.player.flying = true;
  vg.player.pos.set(0, 58, 0);
  vg.controls.yaw = 2.4; vg.controls.pitch = -0.12;
});
await page.waitForTimeout(4000);

// lantern test: place a lantern at night nearby
await page.evaluate(() => {
  const vg = window.__vg;
  const x = -3, z = -2;
  let y = 90; while (y > 1 && vg.world.getBlock(x, y, z) === 0) y--;
  vg.world.setBlock(x, y + 1, z, 16); // lantern
});

const phases = [[0.3, 'day'], [0.695, 'dusk'], [0.83, 'night'], [0.955, 'dawn']];
for (const [t, name] of phases) {
  await page.evaluate((tt) => { window.__vg.sky.time = tt * 720; }, t);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${shotDir}/sky-${name}.png` });
}
console.log(messages.length ? `CONSOLE ISSUES:\n` + messages.slice(0, 20).join('\n') : 'clean');
await browser.close();
