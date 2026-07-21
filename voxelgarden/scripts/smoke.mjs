// Headless smoke test: loads the game, collects console errors/warnings,
// measures fps, takes screenshots. Usage: node scripts/smoke.mjs [seconds] [--click]
import { chromium } from 'playwright-core';

const secs = Number(process.argv[2] || 6);
const doClick = process.argv.includes('--click');
const shotDir = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-The-God-Project/7637e2ac-0462-5079-b193-ff3c255963ce/scratchpad';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const messages = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) messages.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(1200);

if (doClick) {
  await page.mouse.click(640, 360);
  await page.waitForTimeout(500);
}

// measure fps over 2s
const fps = await page.evaluate(() => new Promise((resolve) => {
  let n = 0;
  const t0 = performance.now();
  function f() {
    n++;
    if (performance.now() - t0 < 2000) requestAnimationFrame(f);
    else resolve(Math.round(n / ((performance.now() - t0) / 1000)));
  }
  requestAnimationFrame(f);
}));

await page.screenshot({ path: `${shotDir}/shot-1.png` });
await page.waitForTimeout(Math.max(0, secs - 3) * 1000);
await page.screenshot({ path: `${shotDir}/shot-2.png` });

console.log(`FPS(headless swiftshader): ${fps}`);
console.log(messages.length ? `CONSOLE ISSUES (${messages.length}):\n` + messages.slice(0, 30).join('\n') : 'No console errors/warnings.');
await browser.close();
