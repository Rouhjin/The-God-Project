// Streaming test: teleport the camera far away, verify chunks load/unload and
// nothing errors while the world streams.
import { chromium } from 'playwright-core';

const shotDir = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-The-God-Project/7637e2ac-0462-5079-b193-ff3c255963ce/scratchpad';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const messages = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) messages.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(4000);

const before = await page.evaluate(() => window.__vg.world.loadedCount);
// fly east in steps, as if sprint-flying
for (let i = 1; i <= 10; i++) {
  await page.evaluate((x) => { window.__vg.camera.position.x = x; }, i * 40);
  await page.waitForTimeout(700);
}
await page.waitForTimeout(4000);
const after = await page.evaluate(() => ({
  loaded: window.__vg.world.loadedCount,
  pos: window.__vg.camera.position.x,
  pending: window.__vg.world.pending.size,
  queue: window.__vg.world.queue.length,
}));
await page.screenshot({ path: `${shotDir}/stream.png` });
console.log('before:', before, 'after:', JSON.stringify(after));
console.log(messages.length ? `CONSOLE ISSUES:\n` + messages.slice(0, 20).join('\n') : 'No console errors/warnings.');
await browser.close();
