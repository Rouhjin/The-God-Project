// Take a screenshot at a given URL/position/look direction.
// Usage: node scripts/shot.mjs "<url>" <x> <y> <z> <yaw> <pitch> <outname> [creative]
import { chromium } from 'playwright-core';

const [, , url, x, y, z, yaw, pitch, out, creative] = process.argv;
const shotDir = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-The-God-Project/7637e2ac-0462-5079-b193-ff3c255963ce/scratchpad';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const messages = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) messages.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`));

await page.goto(url || 'http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(([px, py, pz, cy, cp, cr]) => {
  const vg = window.__vg;
  vg.player.creative = true;
  if (cr) vg.player.flying = true;
  vg.player.pos.set(px, py, pz);
  vg.controls.yaw = cy; vg.controls.pitch = cp;
}, [+x, +y, +z, +yaw, +pitch, creative === 'fly' ? 1 : 0]);
await page.waitForTimeout(6000);
await page.screenshot({ path: `${shotDir}/${out || 'shot'}.png` });
console.log(messages.length ? `CONSOLE ISSUES:\n` + messages.slice(0, 15).join('\n') : 'clean');
await browser.close();
