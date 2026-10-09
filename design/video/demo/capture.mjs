// design/video/demo/capture.mjs — captures each film state of the live site as a still (1280 css wide at 1.5x = 1920 px)
// plus the exact box of every [data-film] element in that still, measured from the DOM at the same instant. The film
// (film.html) does all motion itself, deterministically, so nothing drops frames and boxes never drift.
// Usage: node capture.mjs <base-url> [chapter ...]
import pw from '/Users/mujeeb/.claude/surface/node_modules/playwright-core/index.js';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = pw;
const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = new URL('./states/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1280, VH = 720, DPR = 1.5;

/** One state: scroll so `top` (css px from page top, or a selector) is at the viewport top, settle, then capture `h` css px tall. */
async function shoot(p, name, { top = 0, h = VH, settle = 1500 } = {}) {
  const y = typeof top === 'string'
    ? await p.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY - 40 : 0; }, top)
    : top;
  await p.evaluate((y) => window.scrollTo(0, y), y); await sleep(settle);
  const sy = await p.evaluate(() => scrollY);
  const boxes = await p.evaluate(([sy]) => {
    const by = {};
    for (const el of document.querySelectorAll('[data-film]')) {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const k = el.getAttribute('data-film'), u = by[k], b = { x0: r.left, y0: r.top + scrollY - sy, x1: r.right, y1: r.bottom + scrollY - sy };
      by[k] = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
    }
    return by;
  }, [sy]);
  // For a tall state, capture below the fold without scrolling (the page is static by now).
  const buf = await p.screenshot({ type: 'jpeg', quality: 92, fullPage: h > VH, clip: { x: 0, y: h > VH ? sy : 0, width: W, height: h } });
  writeFileSync(OUT + name + '.jpg', buf);
  const px = {}; for (const [k, b] of Object.entries(boxes)) px[k] = { x: b.x0 * DPR, y: b.y0 * DPR, w: (b.x1 - b.x0) * DPR, h: (b.y1 - b.y0) * DPR };
  writeFileSync(OUT + name + '.json', JSON.stringify({ w: W * DPR, h: h * DPR, boxes: px }));
  console.log(name, h * DPR, Object.keys(px).join(','));
}

const CH = {
  async stages(p) {
    await p.goto(BASE + '/'); await sleep(1500);
    const y0 = await p.evaluate(() => { const e = document.querySelector('section[aria-label="Four ways a program can change"]'); return e.getBoundingClientRect().top + scrollY; });
    // story height 460vh, scroll span 3.6 screens: scene i fully played at 80% of its quarter
    for (let i = 0; i < 4; i++) await shoot(p, `stages-${i}`, { top: y0 + .9 * VH * (i + .8), settle: 2600 });
  },
  async map(p) {
    await p.goto(BASE + '/'); await sleep(1200);
    await p.evaluate(() => document.querySelector('[aria-label^="Stage map"]').scrollIntoView({ block: 'start' })); await sleep(3500);
    const y = await p.evaluate(() => scrollY);
    await shoot(p, 'map-0', { top: y, settle: 300 });
    await p.evaluate(() => dispatchEvent(new CustomEvent('kh-pick', { detail: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' }))); await sleep(4500);
    await shoot(p, 'map-1', { top: y, settle: 300 });
  },
  async program(p) { await p.goto(BASE + '/programs/KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD'); await sleep(2500); await shoot(p, 'program-0', { h: 1200, settle: 600 }); },
  async signer(p) { await p.goto(BASE + '/signers/5ggs2vd1csz74YMCzxesmcUEd3ycYFKAW6kfyttVYwBv'); await sleep(3000); await shoot(p, 'signer-0', { h: 1100, settle: 600 }); },
  async votes(p) { await p.goto(BASE + '/stories/open-votes'); await sleep(3500); await shoot(p, 'votes-0', { h: 1300, settle: 600 }); },
  async ask(p) {
    await p.goto(BASE + '/'); await sleep(1500);
    await shoot(p, 'ask-0', { settle: 200 });
    await p.click('#ask-q'); await p.keyboard.type('Kamino Lend'); await p.keyboard.press('Enter'); await sleep(2500);
    await shoot(p, 'ask-1', { top: 'section, main', h: 900, settle: 600 });
  },
  async drift(p) {
    await p.goto(BASE + '/replay/drift'); await sleep(4500);
    const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const pts = [0.18, 0.32, 0.46, 0.93];
    for (let i = 0; i < pts.length; i++) await shoot(p, `drift-${i}`, { top: Math.round(H * pts[i]), settle: 2800 });
  },
  async build(p) {
    await p.goto(BASE + '/policy'); await sleep(1500);
    await shoot(p, 'build-0', { top: '[data-device="require-stage-sim"]', settle: 1800 });
    await shoot(p, 'build-1', { top: '[data-film="refusal"]', settle: 1200 });
  },
  async self(p) { await p.goto(BASE + '/policy'); await sleep(1500); await shoot(p, 'self-0', { top: '[data-film="selfline"]', settle: 1200 }); },
};

const only = process.argv.slice(3);
const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--hide-scrollbars'] });
for (const [name, run] of Object.entries(CH)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await b.newContext({ viewport: { width: W, height: VH }, deviceScaleFactor: DPR, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(s); }));
  await run(p); await ctx.close();
}
await b.close();
