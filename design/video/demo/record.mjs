// design/video/demo/record.mjs — records each demo scene of the live product as its own 1920x1080 clip (Playwright,
// real Chrome). Scenes are scripted: scrolls, clicks and waits only; no data is staged. Usage: node record.mjs <base-url>
import pw from '/Users/mujeeb/.claude/surface/node_modules/playwright-core/index.js';
const { chromium } = pw;
const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = new URL('./raw/', import.meta.url).pathname;
const W = 1280, H = 720; // viewport; recorded at 1.5x into 1920x1080
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Eased scroll driven in the page (the site's smooth-scroll library amplifies synthetic wheel events).
async function glide(p, dy, ms) {
  await p.evaluate(([dy, ms]) => new Promise((done) => {
    const y0 = scrollY, t0 = performance.now();
    const f = (t) => { const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.scrollTo(0, y0 + dy * e); k < 1 ? requestAnimationFrame(f) : done(); };
    requestAnimationFrame(f);
  }), [dy, ms]);
}
async function scrollTo(p, sel, ms = 1200, offset = 0) {
  const y = await p.evaluate(([s, o]) => {
    const e = s.startsWith('text=') ? [...document.querySelectorAll('h1,h2,h3')].find((x) => x.textContent.includes(s.slice(5))) : document.querySelector(s);
    return e ? e.getBoundingClientRect().top + o : 0;
  }, [sel, offset]);
  await glide(p, y, ms);
}

const SCENES = {
  async home(p) { await p.goto(BASE + '/'); await sleep(4500); },
  async stages(p) {
    await p.goto(BASE + '/'); await sleep(800);
    await scrollTo(p, 'section[aria-label="Four ways a program can change"]', 900);
    // The story is 4 scenes x 110vh; step one scene at a time and hold so each animation completes.
    for (let i = 0; i < 4; i++) { await sleep(2600); if (i < 3) await glide(p, H * 1.1, 1300); }
    await sleep(1200);
  },
  async map(p) {
    await p.goto(BASE + '/'); await sleep(800);
    await p.evaluate(() => document.querySelector('[aria-label^="Stage map"]').scrollIntoView({ block: 'start' })); await sleep(3200);
    await p.evaluate(() => dispatchEvent(new CustomEvent('kh-pick', { detail: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' }))); await sleep(5200);
  },
  async program(p) { await p.goto(BASE + '/programs/KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD'); await sleep(3500); await glide(p, 520, 1600); await sleep(3000); },
  async signer(p) { await p.goto(BASE + '/signers/5ggs2vd1csz74YMCzxesmcUEd3ycYFKAW6kfyttVYwBv'); await sleep(1500); await glide(p, 420, 1200); await sleep(4500); },
  async votes(p) { await p.goto(BASE + '/stories/open-votes'); await sleep(3500); await glide(p, 600, 2400); await sleep(3500); },
  async ask(p) {
    await p.goto(BASE + '/'); await sleep(1500);
    await p.click('#ask-q'); await p.keyboard.type('Kamino Lend', { delay: 90 }); await sleep(300);
    await p.keyboard.press('Enter'); await sleep(1500);
    await p.evaluate(() => document.getElementById('ask-answers').scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(4500);
  },
  async drift(p) {
    await p.goto(BASE + '/replay/drift'); await sleep(4000);
    for (let i = 0; i < 5; i++) { await glide(p, 680, 1500); await sleep(2300); }
  },
  async build(p) {
    await p.goto(BASE + '/policy'); await sleep(1200);
    await scrollTo(p, '[data-device="require-stage-sim"]', 1200, -24); await sleep(2000);
    await p.getByRole('radio', { name: 'Minimum stage' }).count().catch(() => 0);
    const seg = p.locator('[aria-label="Minimum stage"] button'); await seg.nth(1).click(); await sleep(1600); await seg.nth(2).click(); await sleep(1600);
    await scrollTo(p, 'text=It already refused', 1400, -60); await sleep(4500);
  },
  async self(p) { await p.goto(BASE + '/policy'); await sleep(800); await scrollTo(p, 'text=Keyholder follows its own rule', 1200, -80); await sleep(5000); },
  async changes(p) { await p.goto(BASE + '/changes'); await sleep(4000); await glide(p, 500, 1600); await sleep(2000); },
};

const only = process.argv.slice(3);
const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--hide-scrollbars'] });
for (const [name, run] of Object.entries(SCENES)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5, recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } }, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.addInitScript(() => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s)); });
  const t = Date.now();
  await run(p);
  const v = p.video(); await ctx.close();
  const { renameSync } = await import('node:fs'); renameSync(await v.path(), OUT + name + '.webm');
  console.log(name, Date.now() - t, 'ms');
}
await b.close();
