# CONTEXT for Keyholder is the control standard for Solana: for any money on Solana it shows who can move it, how fast, whether that changed, and whether it matches what the team promised; any program can refuse money where control is weak.
Assembled 2026-10-08T13:05Z by context.mjs. Read this before writing any route. Cite it: every colour,
face, radius, duration and technique in the build comes from a line here or from design/TOKENS.css, never from memory.

## The one moment (charter.wonder)
583 Solana programs fall onto a four-rung ladder of who can move their money; $769M settles on the rung that needs no waiting, and one orange mark pulses: a multisig with a pending vote to change who controls it.
Hero technique: instanced-grid · device: the Stage map: every covered program (583) as one instanced mark on a four-rung ladder (Stage 0 one key, 1 no delay, 2 delayed, 3 exit window), sized by dollars traced; marks fall onto their rung as the day's record loads, a pending control action pulses its mark orange, and a stage change moves a mark one rung with the transaction that caused it (state)

## Tokens (design/TOKENS.css)
```css
/* design/TOKENS.css -- extracted by spec.mjs from design/proto/A.html on 2026-09-26.
   Exact values. The shipped :root is diffed against this file (drift.mjs). Edit here first, then the code. */
:root {
  --bg: #E6E2D9;
  --panel: #F4F1EA;
  --ink: #1B1A17;
  --ink-2: #5A564E;
  --signal: #FF5A1F;
  --signal-text: #A32F06;
  --verified: #1F6B4A;
  --hair: rgba(27,26,23,.14);

  /* derived from computed styles; names the prototype already declares above are not repeated. The build declares all of these. */
  --ground: rgb(230, 226, 217);
  --ink-3: rgb(163, 47, 6);
  --signal-control-weakened: #FF5A1F;   /* painted as rgb(255, 90, 31) */
  --signal-verified-on: #1F6B4A;   /* declared in CHARTER; not painted on this prototype */
  --hairline: rgba(27, 26, 23, 0.14);
  --radius: 50px;   /* others seen: 50px */
  --font-display: Geist;   /* the largest text, 46.08px/400 */
  --font-body: Geist Mono;   /* most common */
  --weight-body: 400;
  --display-1280: 46.08px;
  --display-390: 30px;
  --ease-1: cubic-bezier(0.2, 0.7, 0.2, 1);
  --d-tick: 90ms;
  --d-element: 240ms;
  --d-data: 320ms;
  --d-count: 1400ms;
  --cap: 1600ms;
}

/* The dark theme (P38) lives in TOKENS-DARK.css; drift.mjs compares this :root only. */
```

## Faces
display: Geist · text: Geist · mono: Geist Mono
Fetch: node ~/.claude/surface/bin/fetch-part.mjs font "<Family>@400,700" [--from fontshare]

## Parts to compose from (8)
### instanced-grid
# instanced-grid

A 40x40 field of drei `Instances` in a single `InstancedMesh`. One `useFrame` in the parent walks the
array and writes each tile's height from its distance to the pointer; the easing stops when it settles.

- Source: https://github.com/pmndrs/examples/blob/main/examples/instances/src/App.tsx
  — `examples/instances/src/App.tsx:54-75` (laying instances out in a loop and writing their matrices
  in one pass). The `<Instances>` / `<Instance>` component form follows
  `examples/monitors/src/Computers.tsx`.
- Licence: MIT (pmndrs/examples).
- When to use: hundreds of identical marks have to react individually without hundreds of draw calls.
- Props on `<GridTiles>`: `reduced`. Internals worth moving: `GRID` (40), `GAP` (0.075), the box
  geometry size, the falloff radius (0.75) and the height multiplier (`1 + v * 3.4`).
- Shape of the solution worth keeping: no per-instance hook. 1600 `useFrame` subscriptions would cost
  more than the render; one parent loop over an array of refs plus a `Float32Array` of eased values
  is the whole thing, and it calls `invalidate()` only while a tile is still moving.
- Measured (390 and 1280, dpr 1, headless software GL, --motion): no layout findings at either width.
  390: `5 long tasks, longest 770ms, 1 after load`. 1280: `5 long tasks, longest 775ms`. First-frame
  instance setup and shader compile; no frame-time finding, the canvas is idle until the pointer moves.
- Phone (390): the caption stacks under the canvas and the camera lifts to [0, 8.4, 12.2] looking at
  (0, 1.2, 0) so the whole 2.9-unit field fits the narrow viewport.
- Reduced motion: every tile's target height is forced to 0, so the grid renders flat and the loop
  settles immediately; combined with `frameloop="demand"` the page draws one static field.
cost: 2090 KB, p95 33 ms on the floor
```jsx
function InstancedGrid() {
  const reduced = useReduced();
  const phone = usePhone();
  return (
    <Frame
      kicker="Instanced grid"
      title="Sixteen hundred tiles, one draw call"
      lede="A 40 by 40 grid of drei Instances. One useFrame in the parent walks the array and writes position and scale; the pointer's distance to each tile is the only input, and the easing stops when it settles."
      foot="Move the pointer across the field. Instances batches the whole grid into a single InstancedMesh, so the cost is the array walk, not the draw."
    >
      <Canvas
        key={phone ? "phone" : "wide"}
        data-device="instanced-grid"
        style={S.fill}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={phone ? { position: [0, 8.4, 12.2], fov: 26 } : { position: [-1.5, 3.4, 5.6], fov: 26 }}
        onCreated={({ camera }) => camera.lookAt(phone ? 0 : -0.95, phone ? 1.2 : -0.55, 0)}
      >
        <color attach="background" args={[T.ground]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 3]} intensity={2.3} />
        <directionalLight position={[-4, 2, -3]} intensity={0.6} />
        <GridTiles reduced={reduced} />
      </Canvas>
    </Frame>
  );
}
```

### scroll-controls-3d
# scroll-controls-3d

drei `ScrollControls` puts a real scroll container over the canvas; `useScroll().offset` drives one
block between three fixed poses, and `<Scroll html>` carries the copy that scrolls with it.

- Source: https://github.com/pmndrs/examples/blob/main/examples/useintersect-and-scrollcontrols/src/App.tsx
  — `examples/useintersect-and-scrollcontrols/src/App.tsx:123-160` (`ScrollControls damping/pages`,
  `<Scroll html>` with absolutely positioned headings at `top: Nvh`).
- Licence: MIT (pmndrs/examples).
- When to use: the scrollbar should move a 3D object and HTML copy in the same gesture.
- Props: none. Internals worth moving: `pages` (3), `damping` (4), the `POSES` array (position,
  rotation, scale per pose) and the `top` values on the three html blocks.
- Measured (390 and 1280, dpr 1, headless software GL, --motion): 390 `pass: true`, findings empty,
  including after the harness scrolls the container to 33/66/100 per cent. 1280: `frame time p95 67ms
  (budget 34), 61 dropped`, `40 long tasks, longest 294ms` — software-GL floor, no layout findings.
- Phone (390): `<Scroll html>` is not mounted. At 390 the damped offset keeps a scrolling label mid-flight
  across the header and the lab's fixed label, so the three poses are listed once in a static block and
  the caption is dropped; the canvas still runs ScrollControls and the block still changes pose.
- Reduced motion: `damping` drops to 0, so the offset tracks the scrollbar with no easing and nothing
  moves on its own. The canvas is `frameloop="demand"` and ScrollControls only requests a frame while
  the offset is still changing, so an unscrolled page renders once in pose one and stops.
cost: 2090 KB, p95 17 ms on the floor
(component source not found in the lab)

### number-odometer
# number-odometer

A currency figure that steps forward once a second, with only the digits that change animating,
rendered by @number-flow/react.

- Source: https://github.com/barvian/number-flow — the React wrapper's props read at
  `node_modules/@number-flow/react/dist/index.d.mts:18-35` (`value`, `format`, `locales`) and
  `:44-46` (`usePrefersReducedMotion`, `useCanAnimate`, which the element applies itself).
- Licence: MIT.
- When: reach for it when a figure changes while the reader is looking at it and the change is the point.
- Props: none on the part; the odometer takes `value` and a `format` of
  `{ style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }`.
- Measured (dpr 1, software GL, `--width 390,1280 --motion --budget-kb 3000`): no findings at either width. 1280: load 124 ms, frame p50 17 ms, p95 17 ms, longest task 60 ms. 390: load 136 ms, p50 17 ms, p95 17 ms, longest task 61 ms. 2087 KB transferred is the shared lab bundle, not this part's own cost. At 390 the figure starts at 30px and the three stats stay on one row, so nothing runs past the edge.
- Reduced motion: the interval is never started, the figure is printed once and left alone, and
  number-flow's own reduced-motion gate stops the digit animation as well (93 words in both poses).
cost: 2090 KB, p95 17 ms on the floor
```jsx
function NumberOdometer() {
  const reduced = useReducedMotion();
  const root = useRef(null);
  const inView = useInView(root);
  const [value, setValue] = useState(ODO_BASE);
  useEffect(() => {
    if (reduced || !inView) return;
    const id = setInterval(() => setValue((v) => v + ODO_RATE), 1000);
    return () => clearInterval(id);
  }, [reduced, inView]);
  return (
    <main className="pg wrap" ref={root} data-device="number-odometer">
      <Style>{BASE_CSS + `
        .odo{font:400 clamp(30px,8vw,104px)/1 var(--font-mono);letter-spacing:-.03em;margin:32px 0 8px;display:block;--number-flow-char-height:.85em}
        .odo-screen{min-height:100vh;padding-bottom:12vh;display:grid;align-content:start}
        .odo-row{display:flex;gap:64px;flex-wrap:wrap;margin:56px 0 44px}
        .odo-row div{min-width:180px}
        .odo-row b{display:block;font:400 28px/1 var(--font-mono);color:var(--ink);margin-bottom:8px}
        .odo-row span{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}
        @media (max-width:600px){
          .odo-row{gap:14px;margin:28px 0 24px;flex-wrap:nowrap}
          .odo-row div{min-width:0;flex:1}
          .odo-row b{font-size:19px;margin-bottom:6px}
          .odo-row span{font-size:9px;letter-spacing:.1em}
        }
      `}</Style>
      <div className="odo-screen">
      <p className="kicker">Counter · LEDGE</p>
      <h1>Graduated liquidity, counted forward</h1>
      <NumberFlow
        className="odo"
        value={value}
        format={{ style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2 }}
      />
      <p className="lede">The figure moves at 37.18 dollars a second, the mean rate of the last twenty-four hours (n=41 graduations). It is a projection from that mean, not a reading: the true figure lands when the next crawl does.</p>
      <div className="odo-row">
        <div><b>4,124</b><span>graduations</span></div>
        <div><b>1.56%</b><span>of all launches</span></div>
        <div><b>3 min</b><span>median time</span></div>
      </div>
      </div>
      <p>Only the digits that change are animated, and the element stops counting when it scrolls out of view. Under a reduced-motion preference the figure is printed once and left alone.</p>
    </main>
  );
}
```

### mono-address
# mono-address

Addresses and 32-byte hashes set in the mono face, chunked in fours, never truncated, copied
in full on click. The trust state is printed by the stylesheet from a data attribute, so the
content cannot spoof it away: `[data-verified="false"] .ma-name::before { content: "UNVERIFIED · " }`.

- Sources: leekwallet (ETHOnline 2026 finalist), torn into this kit at
  `~/.claude/surface/refs/leekwallet/STEAL.md:7-8`, which cites the original repo
  https://github.com/0xOucan/LeekWallet —
  - `app/src/styles.css:281` — mono for addresses as a security property: "proportional fonts
    make l/1 and 0/O ambiguous"; hashes in mono, chunked in 4s, never truncated.
  - `app/src/styles.css:411` — `.unverified-desc .kv dt::before { content: "UNVERIFIED · " }`:
    a warning the content cannot spoof away, injected by CSS from a data attribute rather than
    written into the copy.
  - The "colour is never the only carrier" constraint on that warning:
    `~/.claude/surface/principles.md` (Sara Soueidan). The prefix is a word, and the hue only
    reinforces it.
- Licence: LeekWallet MIT.

When to use it: anywhere a reader is expected to check a hash or an address before trusting it.

Props: `rows` — `[{ name, addr, verified, note }]`. The third demo row is an attacker's name
containing the word "Verified", to show the stylesheet prefix winning over the content.

Measured: `measure.mjs --width 1280 --motion --dpr 1 --budget-kb 3000` → findings [], pass true.
Frame time p50 17 ms, p95 17 ms; no animations. Copy verified by hand in Chromium: clicking the
first row put `0x7A1fD3c9B04e58aA2c6E91Df4b0aC7135E92Dc48` (unbroken, no chunk spaces) on the
clipboard and the live region read "copied in full". When the Clipboard API is refused the part
falls back to a selection copy and says so in the same live region.

Reduced motion: nothing animates in either state; word count is identical.

## Phone pass (390)

Re-measured with `--width 390,1280 --motion --dpr 1 --budget-kb 3000`: findings [] at both
widths, pass true. Frame time p50 17 ms / p95 17 ms at 390 and at 1280 (1/284 dropped frames at 390,
1/301 at 1280). At 390 the two-column body stacks, the row footer goes vertical, and the masthead takes `min-height:100vh`.
cost: 2090 KB, p95 17 ms on the floor
```jsx
function MonoAddress({ rows = MA_ROWS }) {
  const [copied, setCopied] = React.useState("");
  const timer = React.useRef(0);

  const copy = async (addr) => {
    let ok = false;
    try { await navigator.clipboard.writeText(addr); ok = true; } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = addr; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
    }
    setCopied(ok ? addr : `fail:${addr}`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(""), 1600);
  };

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <main className="ma-page">
      <style>{`
.ma-page{min-height:100vh;padding:40px 40px 72px;display:flex;flex-direction:column;gap:22px}
.ma-head{display:flex;justify-content:space-between;align-items:baseline;gap:24px;border-bottom:1px solid var(--hairline);padding-bottom:12px}
.ma-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2);margin:0}
.ma-h1{font:400 clamp(26px,3.4vw,42px)/1.06 var(--font-display);margin:8px 0 0}
.ma-body{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:44px;align-items:start}
.ma-list{display:flex;flex-direction:column;gap:0}
.ma-item{border-bottom:1px solid var(--hairline);padding:14px 0}
.ma-item:first-child{border-top:1px solid var(--hairline)}
.ma-name{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);margin:0 0 8px}
.ma-item[data-verified="false"] .ma-name::before{content:"UNVERIFIED · ";color:var(--signal);letter-spacing:.14em}
.ma-item[data-verified="true"] .ma-name::before{content:"VERIFIED · ";color:var(--ink-2);letter-spacing:.14em}
.ma-copy{display:block;width:100%;text-align:left;background:transparent;border:0;padding:0;cursor:copy;
  font-family:var(--font-mono);font-size:15px;line-height:1.5;color:var(--ink);letter-spacing:.02em}
.ma-copy:focus-visible{outline:2px solid var(--signal);outline-offset:3px}
.ma-copy span{display:inline-block;margin-right:.55ch}
.ma-foot{display:flex;justify-content:space-between;gap:16px;margin-top:8px;font-size:11.5px;color:var(--ink-2)}
.ma-note{font-size:13px;line-height:1.62;color:var(--ink-2);margin:0 0 14px;max-width:48ch}
.ma-note b{color:var(--ink);font-weight:400}
.ma-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ma-live{min-height:1.2em;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--signal)}
@media (max-width:700px){
  .ma-page{padding:22px 16px 96px;gap:26px}
  .ma-head{display:block;min-height:100vh;padding-bottom:112px;border-bottom:0}
  .ma-head>p.ma-kicker:last-child{margin-top:14px}
  .ma-body{display:block}
  .ma-note{max-width:none;font-size:14px}
  .ma-list{margin-bottom:26px}
  .ma-copy{font-size:14px}
  .ma-foot{flex-direction:column;gap:4px}
  .ma-foot span:last-child{color:var(--ink-2)}
}
```

### live-ticker
# live-ticker

A six-cell horizontal strip of live numbers over a feed whose rows enter as prints arrive.
Direction is a caret and a sign; the one hue is spent on recency and decays from the signal
colour to the body ink over six seconds. Every number, in the strip and in the feed, prints
its own age.

- Sources:
  - Digit animation: `@number-flow/react` — value + `locales` + `format`, `trend` to force
    direction, `plugins={[continuous]}`, and `animated` off for reduced motion. Usage taken
    from the library's own demos: `_src/number-flow/site/src/pages/[...framework]/_demos/Trend.tsx:66-71`
    (locales/trend/value) and `_demos/Continuous.tsx:28-33` (`plugins={[continuous]}`).
    `usePrefersReducedMotion` / `respectMotionPreference` exist in
    `_lab/node_modules/number-flow/dist/lite.d.ts:20-21`.
  - The strip's shape (a fixed-width row of market cells with a tabular price, and a single
    slow ambient motion) is the Hyperliquid pattern as torn in
    `~/.claude/surface/refs/hyperliquid/MOTION.md` (`market-ticker-scroll`, durations 150/200 ms)
    and `refs/hyperliquid/TOKENS.css` (one signal hue, no borders, tabular figures). The
    infinite marquee is deliberately not ported: six cells fit 1280 without one, and an
    endless scroll is ambient motion spent on nothing.
  - `font-variant-numeric: tabular-nums` on every changing number: `~/.claude/surface/principles.md`
    (Rauno Freiberg, "Numbers that change").
  - One hue for both directions: `principles.md` (Sara Soueidan, "Color alone — never the only
    carrier of meaning") and the Tufte severity rule in the same file.
- Licence: number-flow MIT (`_src/number-flow/LICENSE.md`).

When to use it: a surface whose numbers change while the reader watches, and where the age of
a number matters as much as its value.

Props: `interval` (1100 ms between prints), `keep` (9 rows), `freshFor` (6000 ms — the recency
decay window).

Measured: `measure.mjs --width 1280 --motion --dpr 1 --budget-kb 3000` → findings [], pass true.
Frame time p50 17 ms, p95 17 ms, 2 dropped of 308 samples; one 68 ms long task at load, none
after. 9 animations live at the sample, all `lt-enter`, 220 ms, one iteration. Word count 295
animated / 289 with reduced motion.

Reduced motion: the interval never starts and NumberFlow is passed `animated={false}`. The feed
is seeded with a full nine prints at staggered ages, so the static page carries the same rows,
the same ages and the same words as the live one; the row-enter keyframe is also disabled by a
`prefers-reduced-motion` block.

## Phone pass (390)

Re-measured with `--width 390,1280 --motion --dpr 1 --budget-kb 3000`: findings [] at both
widths, pass true. Frame time p50 17 ms / p95 17 ms at 390 and at 1280 (2/283 dropped frames at 390,
1/298 at 1280). At 390 the strip goes from six cells to two, the feed table becomes a three-column grid per row (age / market / side, then price and recency), and `.lt-fold` holds the masthead and the strip.
cost: 2090 KB, p95 17 ms on the floor
```jsx
function LiveTicker({ interval = 1100, keep = 9, freshFor = 6000 }) {
  const reduced = React.useRef(false);
  const [rows, setRows] = React.useState([]);
  const [marks, setMarks] = React.useState(() => LT_MARKETS.map((m) => ({ ...m, at: 0, dir: 0 })));
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const rnd = ltRand(20260919);
    const t0 = performance.now();
    // the static pose: a full feed already on the page, so nothing is empty, nothing
    // has to animate in before it can be read, and the reduced-motion page carries
    // exactly the same words as the animated one
    const seed = Array.from({ length: keep }, (_, i) => {
      const m = LT_MARKETS[i % LT_MARKETS.length];
      const d = (rnd() - 0.5) * 0.02;
      return { id: `s${i}`, sym: m.sym, px: m.px * (1 + d), dp: m.dp, dir: d >= 0 ? 1 : -1, at: t0 - (i + 1) * 4200 };
    });
    setRows(seed);
    setNow(t0);
    if (mq.matches) return undefined;

    let tick = 0;
    let timer = 0;
    let visible = true;
    const print = () => {
      const m = LT_MARKETS[Math.floor(rnd() * LT_MARKETS.length)];
      const d = (rnd() - 0.5) * 0.016;
      const at = performance.now();
      const px = m.px * (1 + d);
      setRows((r) => [{ id: `p${tick++}`, sym: m.sym, px, dp: m.dp, dir: d >= 0 ? 1 : -1, at }, ...r].slice(0, keep));
      setMarks((ms) => ms.map((x) => (x.sym === m.sym ? { ...x, px, at, dir: d >= 0 ? 1 : -1 } : x)));
    };
    const age = () => setNow(performance.now());
    const start = () => { if (!timer) { timer = window.setInterval(() => { print(); age(); }, interval); } };
    const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };
    const sync = () => { if (visible && !document.hidden) start(); else stop(); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
    const el = document.querySelector("[data-device='live-ticker']");
    if (el) io.observe(el);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { stop(); io.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [interval, keep]);

  const freshness = (at) => Math.max(0, 1 - (now - at) / freshFor);
  const ageText = (at) => { const s = Math.max(0, Math.round((now - at) / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} m`; };

  return (
    <main className="lt-page">
      <style>{`
.lt-page{min-height:100vh;padding:0 0 72px;display:flex;flex-direction:column;gap:0}
.lt-fold{display:contents}
.lt-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-bottom:1px solid var(--hairline);
  border-top:1px solid var(--hairline);margin-top:18px}
.lt-cell{padding:12px 16px;border-right:1px solid var(--hairline);display:flex;flex-direction:column;gap:5px}
.lt-cell:last-child{border-right:0}
.lt-sym{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}
.lt-px{font-size:19px;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";display:flex;align-items:baseline;gap:7px}
.lt-age{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2);font-variant-numeric:tabular-nums}
.lt-mark{font-size:12px;color:var(--ink-2)}
.lt-head{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:22px 16px 0}
.lt-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2);margin:0}
.lt-h1{font:400 clamp(24px,3vw,36px)/1.06 var(--font-display);margin:0}
.lt-main{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:40px;padding:22px 16px 0}
.lt-feed{width:100%;border-collapse:collapse;font-size:13px}
.lt-feed caption{text-align:left;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);padding-bottom:8px}
.lt-feed th{text-align:left;font-weight:400;color:var(--ink-2);font-size:11px;letter-spacing:.1em;text-transform:uppercase;
  border-bottom:1px solid var(--hairline);padding:0 12px 7px 0}
.lt-feed th.lt-r,.lt-feed td.lt-r{text-align:right;padding-right:0}
.lt-feed td{border-bottom:1px solid var(--hairline);padding:9px 12px 9px 0;font-variant-numeric:tabular-nums;
  font-feature-settings:"tnum";color:var(--ink)}
.lt-row{animation:lt-enter 220ms cubic-bezier(0,0,.2,1) both}
@keyframes lt-enter{from{transform:translateY(-6px);clip-path:inset(0 0 100% 0)}to{transform:none;clip-path:inset(0 0 0 0)}}
.lt-bar{display:inline-block;height:2px;background:var(--signal);vertical-align:3px;margin-right:8px}
.lt-note{font-size:13px;line-height:1.62;color:var(--ink-2);margin:0 0 14px;max-width:52ch}
.lt-note b{color:var(--ink);font-weight:400}
@media (prefers-reduced-motion: reduce){.lt-row{animation:none}}
@media (max-width:700px){
  .lt-page{display:block;padding:0 0 96px}
  .lt-fold{display:block;min-height:100vh;padding-bottom:112px}
  .lt-head{display:block;padding:20px 16px 0}
  .lt-head .lt-kicker+.lt-kicker{margin-top:10px}
  .lt-h1{margin-top:8px}
  .lt-head>p.lt-kicker{margin-top:12px}
  .lt-strip{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:16px}
  .lt-cell{padding:10px 12px;border-bottom:1px solid var(--hairline)}
  .lt-cell:nth-child(2n){border-right:0}
  .lt-px{flex-wrap:wrap;font-size:17px}
  .lt-main{display:block;padding:22px 16px 0}
  .lt-feed{display:block}
  .lt-feed caption{display:block}
  .lt-feed thead{display:none}
  .lt-feed tbody,.lt-feed tr{display:block;width:100%}
  .lt-feed tr{border-bottom:1px solid var(--hairline);padding:8px 0;display:grid;
    grid-template-columns:auto 1fr auto;gap:2px 12px;align-items:baseline}
  .lt-feed td{border:0;padding:0}
  .lt-feed td:nth-child(4){grid-column:1;text-align:left;font-size:14px}
  .lt-feed td:nth-child(5){grid-column:2/-1;text-align:right}
  .lt-note{max-width:none;margin-top:0}
  .lt-main>div{margin-top:24px}
}
```

### view-transition
# view-transition

A list and its detail as two states of the same document, swapped inside
`document.startViewTransition`, with one element named across both states so the browser morphs its
box instead of crossfading it.

- Source: https://github.com/darkroomengineering/satus —
  `lib/styles/css/global.css:141-181` (name the snapshots, animate opacity only, keep the overlay
  out of hit-testing) and `:190-196` (kill every `::view-transition-*` animation under reduced
  motion); `components/layout/README.md:70-88` (one named participant per shared subject).
  React 18 needs the state write inside `flushSync` so the browser captures the finished DOM.
- Licence: MIT.
- When: reach for it when a list and its detail are the same page and the swap should read as one move.
- Props: none; `ROWS` holds the four launches.
- Measured (dpr 1, software GL, `--width 390,1280 --motion --budget-kb 3000`): no findings at either width. 1280: load 122 ms, frame p50 17 ms, p95 17 ms, longest task 61 ms. 390: load 124 ms, p50 17 ms, p95 17 ms, longest task 60 ms. 2087 KB transferred is the shared lab bundle, not this part's own cost. At 390 the rows go to two columns and the list owns the first screen.
- Reduced motion: `startViewTransition` is not called at all and the state is set directly; the CSS
  also zeroes every `::view-transition-*` animation, so a transition started elsewhere would be
  instant too (124 words in both poses). Without the API the same direct set runs and the page says so.
cost: 2090 KB, p95 17 ms on the floor
(component source not found in the lab)

### dual-theme-tokens
# dual-theme-tokens

The three-state colour token file, with a system/light/dark switch and a table that prints
each token's resolved value read off the document at runtime. `:root` is light; a
`@media (prefers-color-scheme: dark)` block guarded by `:root:not([data-theme="light"])` is
system dark; `:root[data-theme="dark"]` is the explicit override. No colour is written
anywhere below the token block.

- Sources:
  - The three-layer structure and the guard, ported line for line:
    `/Users/mujeeb/ledge/site/app/globals.css:41-100` — `:root` (:42-70),
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"])}` (:71-86),
    `:root[data-theme="dark"]` (:87-100). The palette values are that file's.
  - Attribute-driven theming (`document.documentElement.setAttribute('data-theme', …)`,
    server-rendered default so the first paint does not flash):
    `_src/satus/components/layout/theme/index.tsx:70-76` and `_src/satus/app/layout.tsx:24-26`.
  - Per-theme blocks keyed on `[data-theme=…]` re-declaring the same names:
    `_src/satus/lib/styles/css/tailwind.css:33-47`.
  - One contrast-tuned accent shared by both themes, with the reason written next to the
    value: `_src/satus/lib/styles/colors.ts:1-11`.
- Licence: satus MIT (`_src/satus/LICENSE`); LEDGE is this operator's own repo.

When to use it: any product that ships both modes and lets the reader override the machine —
the guard is what stops the media query from silently beating that choice.

Props: `initial` ("system" | "light" | "dark").

Measured: `measure.mjs --width 1280 --motion --dpr 1 --budget-kb 3000` → findings [], pass true.
Frame time p50 17 ms, p95 17 ms, 0 long tasks. Verified by hand in three states at 1280×900:
system light → `--dt-ground: #efeae0`; system dark (emulated `colorScheme: dark`) → `#121110`;
"light" chosen on a dark machine → `#efeae0`, i.e. the guard holds.

Reduced motion: the only motion is a 150 ms background/colour crossfade on the switch, and
`@media (prefers-reduced-motion: reduce)` sets `transition: none` on the page and the buttons,
so the change is instant. No content depends on it.

## Phone pass (390)

Re-measured with `--width 390,1280 --motion --dpr 1 --budget-kb 3000`: findings [] at both
widths, pass true. Frame time p50 17 ms / p95 17 ms at 390 and at 1280 (1/283 dropped frames at 390,
1/299 at 1280). At 390 the body stacks and the token table becomes block rows (token, chip + value, purpose), which also removed the horizontal scroll the 3-column table caused.
cost: 2090 KB, p95 17 ms on the floor
(component source not found in the lab)

### hairline-grid
# hairline-grid

A document page with no boxes: three tokenised rule weights (hair 1px, mid 3px, heavy 7px)
carry every division, and the layout is a 12-column grid whose column width is derived from
`--columns`, `--gap` and `--safe` rather than written down. Press **G** (or the button) for a
fixed overlay that paints the twelve columns and the 26px baseline.

- Sources:
  - Column debugger — reading `--columns` off the document element and rendering one `<span>`
    per column inside a fixed, pointer-transparent layer:
    `_src/satus/lib/dev/grid/index.tsx:10-31`; the tinted-span styling at
    `_src/satus/lib/dev/grid/grid.module.css:1-13`.
  - Derived column width (`--layout-width`, `--column-width` computed from columns/gap/safe,
    4 columns on mobile and 12 on desktop): `_src/satus/lib/styles/css/root.css:11-34`.
  - Three rule weights as tokens and the `.rule-hair` / `.rule-mid` / `.rule-heavy` classes:
    `/Users/mujeeb/ledge/site/app/globals.css:34-36` and `:218-227`.
- Licence: satus MIT (`_src/satus/LICENSE`); LEDGE is this operator's own repo.

When to use it: any document-shaped surface where a card would add four edges to say what a
single rule already says.

Props: `columns` (12), `gap` (16px), `safe` (40px), `baseline` (26px — also the body
line-height, so paragraphs in all three columns land on the same lines).

Measured: `measure.mjs --width 1280 --motion --dpr 1 --budget-kb 3000` → findings [], pass true.
No animations, no canvas; the overlay is mounted only while it is on.

Reduced motion: nothing moves in either state. The only transition is a 150 ms border-colour
change on the button's hover, which no reader depends on.

## Phone pass (390)

Re-measured with `--width 390,1280 --motion --dpr 1 --budget-kb 3000`: findings [] at both
widths, pass true. Frame time p50 17 ms / p95 17 ms at 390 and at 1280 (1/283 dropped frames at 390,
1/296 at 1280). At 390 the grid drops from 12 columns to satus's 4, every prose block spans `1/-1`, the figures go two-up, and the masthead band takes `min-height:100vh`.
cost: 2090 KB, p95 17 ms on the floor
```jsx
function HairlineGrid({ columns = 12, gap = 16, safe = 40, baseline = 26 }) {
  const [grid, setGrid] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "g" || e.key === "G") setGrid((v) => !v); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const vars = {
    "--columns": columns,
    "--gap": `${gap}px`,
    "--safe": `${safe}px`,
    "--baseline": `${baseline}px`,
  };

  return (
    <main className="hg-page" style={vars} data-device="hairline-grid" data-grid={grid ? "on" : "off"}>
      <style>{`
.hg-page{--rw-hair:1px;--rw-mid:3px;--rw-heavy:7px;position:relative;min-height:100vh;padding:var(--safe);
  display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));column-gap:var(--gap);row-gap:0;align-content:start}
.hg-rule{grid-column:1/-1;background:var(--hairline)}
.hg-rule[data-w="hair"]{height:var(--rw-hair)}
.hg-rule[data-w="mid"]{height:var(--rw-mid);background:var(--ink-2)}
.hg-rule[data-w="heavy"]{height:var(--rw-heavy);background:var(--ink)}
.hg-band{grid-column:1/-1;display:grid;grid-template-columns:subgrid;padding:calc(var(--baseline)*0.75) 0}
.hg-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2);margin:0}
.hg-h1{grid-column:1/9;font:400 clamp(30px,4.2vw,50px)/1.06 var(--font-display);margin:0}
.hg-meta{grid-column:10/-1;display:flex;flex-direction:column;gap:6px;align-items:flex-end;text-align:right}
.hg-a{grid-column:1/6}
.hg-b{grid-column:6/10}
.hg-c{grid-column:10/-1}
.hg-band p{margin:0 0 calc(var(--baseline)*0.6);font-size:14px;line-height:var(--baseline);color:var(--ink)}
.hg-band p:last-child{margin-bottom:0}
.hg-band p.hg-dim{color:var(--ink-2)}
.hg-label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);margin:0 0 10px}
.hg-figs{grid-column:1/-1;display:grid;grid-template-columns:subgrid}
.hg-fig{grid-column:span 3;border-left:var(--rw-hair) solid var(--hairline);padding-left:12px}
.hg-fig b{display:block;font:400 30px/1 var(--font-display);margin-bottom:6px}
.hg-fig span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)}
.hg-controls{grid-column:1/-1;display:flex;gap:16px;align-items:center;padding-top:14px;font-size:12px;color:var(--ink-2)}
.hg-controls button{font:12px/1 var(--font-mono);background:transparent;color:var(--ink);border:var(--rw-hair) solid var(--hairline);padding:8px 12px;cursor:pointer;transition:border-color 150ms cubic-bezier(0,0,.2,1)}
.hg-controls button:hover{border-color:var(--ink-2)}
.hg-overlay{position:fixed;inset:0;pointer-events:none;z-index:60;padding:0 var(--safe);
  display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));column-gap:var(--gap)}
.hg-overlay span{background:var(--signal);opacity:.07}
.hg-overlay::before{content:"";position:absolute;inset:0;
  background-image:repeating-linear-gradient(to bottom,var(--hairline) 0 1px,transparent 1px var(--baseline))}
@media (max-width:700px){
  .hg-page{grid-template-columns:repeat(4,minmax(0,1fr));padding:20px 16px 96px}
  .hg-overlay{padding:0 16px}
  .hg-masthead{min-height:100vh;align-content:start;padding-bottom:112px}
  .hg-h1,.hg-meta,.hg-a,.hg-b,.hg-c{grid-column:1/-1}
  .hg-meta{align-items:flex-start;text-align:left;margin-top:14px}
  .hg-band{row-gap:26px}
  .hg-fig{grid-column:span 2}
  .hg-controls{flex-wrap:wrap;gap:12px}
}
```

## References (4), each with its numbers
### cordon: take warm-paper console ground, groundL 0.943, 1 easing, 400 ms longest (refs/INDEX.tsv)
hues 2, signal C 0.16, ground L 0.943, ink L 0.521, radius 24px, shadows 9, easings 1, longest 400 ms, display 94.72px, above the fold 145, 750 KB
/* cordon: values read from computed styles at 1280; :root vars copied where readable */
/* measured */
/* ground rgb(236, 236, 235) (L 0.943); ink rgb(105, 105, 105) (L 0.521) */
/* signal rgb(173, 49, 77) oklch(0.508 0.16 12); hue buckets 0,60 */
/* backgrounds by count: rgb(244, 244, 242) x9; rgb(255, 255, 255) x5; rgb(173, 49, 77) x2; rgb(236, 236, 235) x1; color(srgb 0.904314 0.879608 0.849569) x1; rgb(176, 106, 31) x1; rgb(232, 232, 232) x1; rgba(255, 255, 255, 0.97) x1 */
/* inks by count: rgb(105, 105, 105) x55; rgb(32, 32, 32) x22; rgb(74, 74, 74) x17; rgba(255, 255, 255, 0.96) x13; rgb(173, 49, 77) x12; rgba(34, 34, 34, 0.34) x7; rgba(34, 34, 34, 0.3) x6; rgb(34, 34, 34) x4 */
/* borders by count: rgba(34, 34, 34, 0.07) x13; rgba(34, 34, 34, 0.12) x9; rgba(0, 0, 0, 0) x2; rgba(173, 49, 77, 0.34) x2; rgba(173, 49, 77, 0.5) x2; rgba(140, 19, 32, 0.16) x2; rgba(255, 255, 255, 0.36) x2; rgba(166, 59, 80, 0.42) x1; hairline alpha 0.07 */
/* fonts: Inter x123; JetBrains Mono x17; SFMono-Regular x4; body weight 400 */
value | file:line | for them | for the project at hand
`--cordon-paper: #ececeb`, `--cordon-ink: #222222`, warm paper ground, not dark-mode default | packages/ui/tokens/tokens.css:9-12 | a policy console that reads like a printed form | ground and ink are two tokens chosen against the audience census, not a theme toggle
tag tint by `color-mix(in srgb, var(--cordon-tag-hue) 9%, var(--cordon-paper))` | packages/ui/styles/tag.css:39 | one hue variable, tints derived, never a second palette | derive tints from the signal colour; no hand-picked pastel set
`[data-cordon-density="compact"]` remaps `--cordon-control-h`, `--cordon-row-h` | packages/ui/tokens/tokens.css:347-356 | one knob for the whole system's density | density is a token, not a per-page tweak (FOUNDER 2026-09-18: density is a look, not crowding)
one 4,425-line hand-authored UI package, 45 components, no kit | packages/ui/ | uniform craft at scale | a project's DESIGN_SYSTEM.md extracts to real primitives, not Tailwind class soup
`fill: var(--cordon-ink)` on chart marks | packages/ui/styles/chart.css:25 | charts drawn in ink, not chart-library defaults | charts take the page's tokens; no library palette leaks
shots: /Users/mujeeb/.claude/surface/refs/cordon/1280.png, /Users/mujeeb/.claude/surface/refs/cordon/390.png

### linear-changelog: take 0 accent hues and 1 easing across a dense dated list: the control feed and the pending queue
hues 0, signal C 0, ground L 0.139, ink L 0.874, radius 100px, shadows 3, easings 1, longest 250 ms, display 48px, above the fold 109, 288117 KB
/* linear-changelog: values read from computed styles at 1280; :root vars copied where readable */
/* measured */
/* ground rgb(8, 9, 10) (L 0.139); ink rgb(208, 214, 224) (L 0.874) */
/* signal none (achromatic); hue buckets none */
/* backgrounds by count: rgb(8, 9, 10) x380; rgb(28, 28, 31) x42; rgb(229, 229, 230) x1; rgb(20, 21, 22) x1; rgb(255, 255, 255) x1; rgb(40, 40, 44) x1 */
/* inks by count: rgb(208, 214, 224) x893; rgb(247, 248, 248) x175; rgb(138, 143, 152) x47; rgba(255, 255, 255, 0.48) x14; rgb(98, 102, 109) x4; rgb(8, 9, 10) x1 */
/* borders by count: rgb(52, 52, 58) x381; rgba(255, 255, 255, 0.05) x36; rgb(35, 37, 42) x2; rgba(255, 255, 255, 0.08) x1; rgb(229, 229, 230) x1; hairline alpha 1 */
/* fonts: Inter Variable x1092; Berkeley Mono x42; body weight 400 */
value | where | for them | for the project at hand
achromatic: 0 hue buckets, signal none; ground `rgb(8,9,10)` L 0.139, ink `rgb(208,214,224)` L 0.874 | TOKENS.css "signal", "ground" | a whole product page with no accent | colour is optional; hierarchy comes from L and weight
Inter Variable x1071 + Berkeley Mono x42 | TOKENS.css "fonts" | one text face, mono for the technical inline | two faces max, mono for identifiers
radius 8 px (x68), 4.46 px, 5 px; max 100 for pills only | TOKENS.css "radii" | one radius family with a pill exception | radius scale of two steps plus pill
one easing `cubic-bezier(0.25,0.46,0.45,0.94)` x54, durations 100/120/160/250 ms | MOTION.md | one curve, four durations, longest 250 ms | MOTION-RULES 1-2 exactly
display 48 px "Now" at both widths; 8312 words on one page | TOKENS.css "display", "above the fold" | a long page reads because the type scale never changes | long is fine when the scale holds; the headline is still the biggest thing
shots: /Users/mujeeb/.claude/surface/refs/linear-changelog/1280.png, /Users/mujeeb/.claude/surface/refs/linear-changelog/390.png

### owid-grapher: take the chart with its sources on it: every mark, figure and stage carries its transaction or anchored day
hues 4, signal C 0.203, ground L 1, ink L 0.471, radius 100px, shadows 2, easings 2, longest 300 ms, display 25px, above the fold 978, 6118 KB
/* owid-grapher: values read from computed styles at 1280; :root vars copied where readable */
/* measured */
/* ground rgb(255, 255, 255) (L 1); ink rgb(91, 91, 91) (L 0.471) */
/* signal rgb(206, 38, 30) oklch(0.551 0.203 29); hue buckets 30,90,240,270 */
/* backgrounds by count: rgb(255, 255, 255) x555; rgb(235, 238, 242) x299; rgb(164, 182, 202) x13; rgb(219, 229, 240) x6; rgb(242, 242, 242) x6; rgb(240, 244, 250) x6; rgb(0, 33, 71) x4; rgb(206, 38, 30) x2 */
/* inks by count: rgb(91, 91, 91) x307; rgb(118, 118, 118) x283; rgb(66, 101, 145) x85; rgb(29, 61, 99) x74; rgb(255, 255, 255) x22; rgb(87, 114, 145) x17; rgb(17, 46, 79) x12; rgb(152, 169, 189) x11 */
/* borders by count: rgb(242, 242, 242) x272; rgb(218, 218, 218) x260; rgb(219, 229, 240) x17; rgb(164, 182, 202) x13; rgba(0, 0, 0, 0) x10; rgb(208, 218, 227) x9; rgb(231, 231, 231) x3; rgb(255, 255, 255) x2; hairline alpha 1 */
/* fonts: Lato x782; Playfair Display x21; Menlo x19; body weight 400 */
value | where | for them | for the project at hand
signal `rgb(206,38,30)` on a white ground, chart series in 4 hue buckets | TOKENS.css "signal" | colour only on data lines; chrome is grey | a chart's hues are data; the page's chrome stays achromatic
radius 2 px on 275 elements, 4 px on 19 | TOKENS.css "radii" | one small radius, the instrument look | one radius token
two shadows total, one is a 1 px inset ring | TOKENS.css "shadows" | edges by hairline, not by elevation | depth level 0: rings and hairlines, no drop shadows
sources and notes printed under every chart | 1280.png | the chart carries its provenance | n and source on every figure (LEDGE CONSTRAINTS; FOUNDER 2026-09-15)
longest transition 300 ms, easings ease-out and (0.23,1,0.32,1) | MOTION.md | motion at data speed | MOTION-RULES 2: cap under a third of a second for chrome
shots: /Users/mujeeb/.claude/surface/refs/owid-grapher/1280.png, /Users/mujeeb/.claude/surface/refs/owid-grapher/390.png

### megaeth: take one claim above the fold, zero decoration, 79 KB above the fold
hues 0, signal C 0, ground L 0.89, ink L 0.89, radius 0px, shadows 0, easings 2, longest 300 ms, display 56px, above the fold 79, 5547 KB
/* megaeth: values read from computed styles at 1280; :root vars copied where readable */
/* measured */
/* ground rgb(223, 217, 217) (L 0.89); ink rgb(223, 217, 217) (L 0.89) */
/* signal none (achromatic); hue buckets none */
/* backgrounds by count: rgb(26, 26, 27) x5; rgb(26, 26, 26) x2; rgb(223, 217, 217) x2 */
/* inks by count: rgb(223, 217, 217) x145; rgb(26, 26, 27) x37; rgb(26, 26, 26) x1 */
/* borders by count: rgba(223, 216, 216, 0.4) x8; rgba(0, 0, 0, 0.3) x8; hairline alpha 0.4 */
/* fonts: __helveticaNeueLight_9058be x127; __wudooMono_658c6e x20; __helveticaNeueMedium_1ba183 x20; __helveticaNeue_5e32df x14; __helveticaNeueRoman_cba62d x2; body weight 400 */
Five lines max. Each: value | file:line or TOKENS.css/MOTION.md line | what it does for them | what it would do for the project at hand. Written by a reader, not by tear.mjs.
shots: /Users/mujeeb/.claude/surface/refs/megaeth/1280.png, /Users/mujeeb/.claude/surface/refs/megaeth/390.png

## Bans, each with its number (a Ruler finding when 3+ fire; the charter's own are findings on their own)
- default-display-face
- purple-gradient
- gradients (>=3)
- gradient-text
- three-feature-cards
- rounded-everything (>60% of boxes >=16px)
- shadow-everything (>40% of boxes)
- glassmorphism (>=2)
- uniform-entrance (>=5 share one animation)
- emoji-icons (>=3)
- stock-copy (>=2 phrases)
- centred-hero-two-buttons
- icon-in-circle (>=4)
- too-many-hues (>3 buckets)
- accent-everywhere (>9 moments)
- one-default-face
- CHARTER: an opinion score or grade as a headline (a stage is shown with the facts and rule that set it)
- CHARTER: any orange that does not mean weak or weakening control
- CHARTER: a figure without its transaction, anchored day or 'reconstructed' label
- CHARTER: naming a protocol as owner of a program beyond what the chain proves (a repo is 'built from')

## Copy
# VOICE.md (copy rules for the founder)

The founder's voice rules, extracted from FOUNDER.jsonl and POSTMORTEM.md §4.
Read these before drafting any copy for a surface.

## Ten rules

1. **Voice is tape, not narrative.** No em-dash label pairs, no semicolons for lists, no performed feeling. A line parses on first read.
   - Wrong: "command — gloss; option — explanation"
   - Right: "type /command. it shows your balance."

2. **Never manufacture feeling.** Avoid phrases that read as fake or AI-like.
   - Wrong: "the number that surprised me"
   - Right: "1 in 150 graduated"

3. **The subject is the headline.** The event or the thing, not the date or the rate.
   - Wrong: "September 19" or "4.5%"
   - Right: "Grid launched" or "Lizard token"

4. **Names, not hashes.** Show human-readable identifiers.
   - Wrong: "0x742d35Cc6634C0532925a3b844Bc4e7595f42bF"
   - Right: "Lizard"

5. **Short by default.** If the founder asks for more, give it; otherwise assume every line is one sentence and every page is one screen.
   - Wrong: "The platform which serves as a launchpad for innovative projects..."
   - Right: "Launches on Pons."

6. **Value first, then background.** Descriptions open with what it does, not its story.
   - Wrong: "Created in 2026 to solve the problem of..."
   - Right: "Tracks launch outcomes. 4.5% graduate in 5+ minutes."

7. **One example sentence in the sender's voice before drafting.** Show the founder one line in their tone; get approval before the full draft.
   - Step: "Sender's voice would be: 'Lizard hit 5K holders.'"
   - Then: Draft the full reply

8. **Terminal register for data.** No adjectives on numbers; no hedging.
   - Wrong: "Impressive 1,847 launches"
   - Right: "1,847 launches"

9. **Replace every instance on the first rewrite.** Do not let the same error recur.
   - First pass: Find all instances of the problem
   - Rewrite: Fix all of them in one pass

10. **Platform field rules.** Check the character limit, format rules, and image requirements before drafting.
    - Read the platform's specs (X post length, form field max, image ratio)
    - Confirm compliance before sending

## Ambition floor (Ruler --floor)
- the display face is not a default (Inter, Roboto, Arial, system)
- 1 to 3 motion moments that render a data or state change; never 0, never one on every section
- accent moments <= 9 (3 colours x 3 appearances)
- one [data-device] element on the surface: the thing that could only exist for this product
- one hero technique, from the parts bin, named in the charter

## Missing before building
- nothing
