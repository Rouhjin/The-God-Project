// Phase 7 test: mob spawn/AI, combat, player damage (fall/cactus/mob), death+respawn.
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
await page.waitForTimeout(3500);
await page.evaluate(() => { window.__vg.loadWorld('meadow1'); window.__vg.enterPlaying(); });
await page.waitForTimeout(3000);

// spawn mobs manually next to the player
const spawned = await page.evaluate(async () => {
  const vg = window.__vg;
  const { Puff } = await import('/src/mobs/puff.js');
  const { Shambler } = await import('/src/mobs/shambler.js');
  const p = vg.player.pos;
  // find ground under a nearby spot
  const gy = (x, z) => { for (let y = 88; y > 2; y--) if (vg.world.isSolidAt(x, y, z)) return y; return 34; };
  const px = Math.floor(p.x), pz = Math.floor(p.z);
  const puff = new Puff(vg.mobs.scene, vg.world, px + 2.5, gy(px + 2, pz) + 1.01, pz + 0.5);
  const sh = new Shambler(vg.mobs.scene, vg.world, px + 3.5, gy(px + 3, pz) + 1.01, pz + 0.5);
  vg.mobs.mobs.push(puff, sh);
  return { count: vg.mobs.mobs.length, puffHp: puff.hp, shHp: sh.hp };
});

// combat: attack the shambler along +x
const combat = await page.evaluate(() => {
  const vg = window.__vg;
  const sh = vg.mobs.mobs.find((m) => m.kind === 'shambler');
  const origin = sh.pos.clone(); origin.x -= 3; origin.y += 1;
  const dir = { x: 1, y: 0, z: 0 };
  const before = sh.hp;
  const hit = vg.mobs.attackFrom(origin, dir, 5);
  if (hit) hit.hurt(4, { x: 1, z: 0 });
  return { hitKind: hit && hit.kind, hpBefore: before, hpAfter: sh.hp, flashing: sh.hurtTimer > 0 };
});

// mob damage to player
const mobDmg = await page.evaluate(() => {
  const vg = window.__vg;
  const before = vg.player.health;
  vg.player.damage(4, { x: 1, z: 0 });
  return { before, after: vg.player.health };
});

// fall damage
const fall = await page.evaluate(() => {
  const vg = window.__vg;
  vg.player.health = 20;
  vg.player.onFall(10); // 10-block fall -> 7 half-hearts
  return { after: vg.player.health };
});

// cactus damage via touchesBlock: place cactus at player feet
const cactus = await page.evaluate(async () => {
  const vg = window.__vg;
  vg.player.health = 20;
  const p = vg.player.pos;
  const fx = Math.floor(p.x) + 1;
  vg.world.setBlock(fx, Math.floor(p.y), Math.floor(p.z), 18); // cactus next to feet
  vg.player.pos.x = fx - 0.35; // touch it
  let dmg = 0;
  for (let i = 0; i < 70; i++) { vg.player.updateVitals(0.05); } // ~3.5s -> ~3 ticks
  return { health: vg.player.health };
});

// death + respawn round-trip
const death = await page.evaluate(() => {
  const vg = window.__vg;
  const spawn = vg.player.spawnPoint.clone();
  vg.player.pos.set(spawn.x + 20, spawn.y + 5, spawn.z + 20);
  vg.inventory.add('diamond', 5);
  const hadItems = vg.inventory.has('diamond', 5);
  vg.player.health = 2;
  vg.player.damage(4); // kill
  const dead = vg.player.dead;
  const dropsAfterDeath = vg.drops.list.length;
  // respawn
  const btn = document.getElementById('vg-respawn');
  btn.click();
  return {
    hadItems, dead, dropsAfterDeath,
    respawnedAt: [Math.round(vg.player.pos.x), Math.round(vg.player.pos.z)],
    spawnAt: [Math.round(spawn.x), Math.round(spawn.z)],
    healthAfter: vg.player.health, deadAfter: vg.player.dead,
  };
});

await page.waitForTimeout(500);
console.log(JSON.stringify({ spawned, combat, mobDmg, fall, cactus, death }, null, 1));
console.log(messages.length ? `CONSOLE ISSUES:\n` + messages.slice(0, 20).join('\n') : 'No console errors/warnings.');
await browser.close();
