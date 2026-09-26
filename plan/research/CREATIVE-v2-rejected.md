# CREATIVE DIRECTION: The Control Plane of Solana

**Product**: A public, live record of who controls every Solana protocol, real-time alerts when control changes, and an on-chain program to refuse movement of user funds into weakened-control protocols.

**Deadline**: 2026-10-12 23:59 PT (16 days). Hackathon: Solana track, Colosseum Crypto World's Fair. Bar: Judges from Anza, Phantom, Ellipsis, Drift, Arcium. Ambition: Maximum. Depth: 3 (lit WebGL, hero technique, memorable moment).

---

## 1. RESEARCH BOARD: 30+ Design References

Each reference includes **URL**, **category**, **what to take**, and **what to avoid**.

### Financial & Data Control Systems

1. **Linear** — https://linear.app
   - **Category**: SaaS dashboard, dense UI with minimalist dark theme
   - **Take**: Pure black background, acid lime accent used *sparingly*, hairline borders (0.5px), tight letter-spacing, four-step surface ladder in near-black gradations (#0f1011, #141516, #18191a, #191a1b), weight band 400–510 only
   - **Avoid**: Heavy shadows; relying on color alone for hierarchy
   - **Value**: Scientific restraint applied to complexity; trust reads as absence of decoration

2. **Vercel Dashboard** — https://vercel.com/dashboard
   - **Category**: Real-time observability platform
   - **Take**: Sidebar navigation persistent; floating bottom bar on mobile; tabs consistent between contexts; responsive component loading reduces FMP by ~1.2s
   - **Avoid**: Hamburger menu on desktop; modal dialogs for frequent actions
   - **Value**: Operational clarity through fixed elements; no context switching during monitoring

3. **Stripe Elements & Radar** — https://stripe.com/docs/elements
   - **Category**: Financial control panel and risk layer
   - **Take**: Form inputs with immediate validation feedback; explicit error states; micro-animations 150–200ms for state changes; color reserved *strictly* for financial state (green = good, red = at-risk); density scaled by role
   - **Avoid**: Auto-advancing focus; surprising users with hidden costs
   - **Value**: Operational transparency; explicit cost-of-action shown next to every option

4. **Cloudflare Radar** — https://radar.cloudflare.com
   - **Category**: Real-time network monitoring dashboard
   - **Take**: Left sidebar navigation always visible with collapsible sections; main area: metric headline + icon badge, time-range picker, multi-layer line chart with previous-period overlay; cards below for related metrics
   - **Avoid**: Hamburger menus; burying recent activity
   - **Value**: No context switching; every glance reveals the current state

5. **Arkham Intelligence** — https://intel.arkm.com
   - **Category**: On-chain analytics and entity discovery
   - **Take**: Customizable dashboard with grid; users can add/remove/resize widgets; different widget densities for different data types; entity cards show avatar, name, balance, recent activity
   - **Avoid**: Fixed layout assuming one user's priorities
   - **Value**: Lets advanced users configure their own mental model

6. **Solscan** — https://solscan.io
   - **Category**: Solana blockchain explorer
   - **Take**: Live metric cards (metric headline + number + secondary breakdown); horizontal scrolling top movers; green accent for live data; customizable dashboard; monospace font for hashes
   - **Avoid**: Overwhelming table of 100 rows at first load
   - **Value**: Scannable layout with hierarchy; live color signals activity

7. **Dune Analytics** — https://dune.com
   - **Category**: On-chain data dashboards
   - **Take**: Clean serif headline on hero ("The industry standard for…"), large button with arrow, blue gradient background suggesting stability & depth; dashboard builder uses blocks users understand
   - **Avoid**: Generic "dashboard" language; long feature lists above fold
   - **Value**: Clarity of purpose in single sentence; visual language of depth

8. **Mercury** — https://mercury.com
   - **Category**: Banking SaaS, trust-focused fintech
   - **Take**: Restrained color palette; trust reads as *absence* of decoration; tabular figures for numerals (consistent width); pending states explicitly rendered in UI, not hidden
   - **Avoid**: Oversaturated gradients; celebrating features instead of showing outcomes
   - **Value**: Financial products trust restraint; everything visible, no mystery states

### Real-Time Monitoring & Tracking

9. **Flightradar24** — https://flightradar24.com
   - **Category**: Live tracking interface
   - **Take**: Map-based UI; zoom/pan intuitive; each object is a triangle (heading encoded in rotation); color-coded by altitude; clicking opens detail panel (not modal; side panel); live update without page refresh; smooth animation between position updates
   - **Avoid**: Jittery updates; unclear what colors mean
   - **Value**: Geographic metaphor for location + hierarchy; position and heading as data encoding

10. **USGS Earthquake Map** — https://earthquake.usgs.gov/earthquakes/map/
    - **Category**: Real-time seismic data visualization
    - **Take**: Interactive map with layer toggles (magnitude ranges, plate boundaries, faults); color-coded circles by magnitude (size and hue both encode data); legends auto-update based on visible layers; real-time updates; fresh circles pulse slightly
    - **Avoid**: Too many layers on by default
    - **Value**: Seismic wave/earthquake data is the direct metaphor for "control shockwaves"; this is THE reference

11. **Flightradar24 3D Mode** — https://flightradar24.com
    - **Category**: WebGL enhanced real-time tracking
    - **Take**: 3D rendering of airplane positions and flight paths; smooth motion without stutter; responsive to data updates in real-time; altitude-color mapping
    - **Avoid**: Heavy geometry causing dropped frames
    - **Value**: WebGL depth without sacrificing responsiveness

12. **NASA Mission Control (Apollo/ISS era redesign)** — https://science.nasa.gov/
    - **Category**: High-stakes operational monitoring, historical reference
    - **Take**: Dense multi-monitor telemetry boards; no context switching between windows during a procedure; status lights (green/yellow/red) for subsystems; numeric readout with extreme precision (6+ decimal places), exact time for events; monospace font for telemetry
    - **Avoid**: Animations that distract; relying on color alone (color-blind operators need shape too)
    - **Value**: Operational discipline; every number earns its place; failure modes are visible

### Data Visualization & Information Design

13. **Observable / ObservableHQ** — https://observablehq.com
    - **Category**: Reactive data visualization notebooks
    - **Take**: Notebook format with cells; each cell is a visualization or data transformation; reactive updates: change a slider, every downstream cell re-runs; smooth transitions between states; shared context across cells
    - **Avoid**: Long scroll of isolated charts; missing the narrative
    - **Value**: Causality visible; users see what changed because of what

14. **Nansen** — https://nansen.ai
    - **Category**: On-chain analytics, fintech UX
    - **Take**: Wallet pages show holdings + capital efficiency score + risk dashboard; each pool/token is a row with comparative metrics; sparklines for 7d/30d trend; smart color: green for outperforming, red for underperforming
    - **Avoid**: Same color for every row; users cannot scan quickly
    - **Value**: Comparative metrics; sparklines encode time series in 40 pixels

15. **The Pudding** — https://pudding.cool
    - **Category**: Interactive data journalism, narrative-driven visualization
    - **Take**: Scrollytelling with animations triggered by scroll position; each section builds understanding; visualizations are *part of the story*, not separate from text; smooth transitions between related views
    - **Avoid**: Standalone charts with long captions
    - **Value**: Data tells the story; motion is pacing

16. **New York Times Graphics** — https://www.nytimes.com/section/graphics
    - **Category**: Editorial data visualization excellence
    - **Take**: Clear hierarchy: headline, data-driven image, supporting text; color used for categories or risk levels; annotations on the chart itself (not legend); density appropriate to medium; responsive layouts that work at phone width
    - **Avoid**: Animated charts that distract from data
    - **Value**: Clarity first; aesthetics serve clarity

### Design System & Component Libraries

17. **shadcn/ui + Tailwind** — https://shadcn.io
    - **Category**: Utility-first design system, accessible components
    - **Take**: Utility-first CSS; compose from small primitives; pre-built accessible components (Dialog, Select, Tabs); *forked*, not a framework; you own the code
    - **Avoid**: Bloated default themes
    - **Value**: Constraint enables speed; accessibility is built-in

18. **Radix UI** — https://www.radix-ui.com
    - **Category**: Headless component library
    - **Take**: Headless components; you control style; accessibility built in: focus management, keyboard navigation, ARIA labels; composable (Popover = Trigger + Content)
    - **Avoid**: Assuming components come pre-styled
    - **Value**: Separation of concerns; behavior and presentation decoupled

19. **Recharts** — https://recharts.org
    - **Category**: React charting, D3-based
    - **Take**: SVG-based charting; responsive by default; composable (LineChart, AreaChart, BarChart); interactive tooltips, legends, brush components; simple API
    - **Avoid**: Hand-building charts in SVG
    - **Value**: D3 power without D3 complexity

20. **Tremor** — https://www.tremor.so
    - **Category**: Fintech dashboard components
    - **Take**: Pre-built fintech components: KPI card, area chart, bar list; Tailwind-based, dark mode built-in; designed for small byte budget
    - **Avoid**: Too prescriptive for bespoke design
    - **Value**: Opinionated fintech components; ships dark-mode out of box

### Aesthetic & Depth References

21. **Bloomberg Terminal Aesthetic** — Design by Curio
    - **Category**: Dense data table, high contrast, keyboard-first
    - **Take**: Dense data table, monospace font (Courier), amber or green on black, high contrast (WCAG AAA), every pixel serves information, zero decoration, keyboard navigation
    - **Avoid**: Copying literally; instead adopt the philosophy
    - **Value**: Density + clarity + no fluff = trust in the information

22. **Teenage Engineering (OP-1 Field)** — https://teenage.engineering
    - **Category**: Hardware UI, bespoke design, depth
    - **Take**: Bespoke interface design; digital UI mirrors physical hardware affordances; color used to denote mode and depth; every element has a clear purpose and state
    - **Avoid**: Copying the aesthetic; instead, copy the rigor
    - **Value**: Intentionality in every detail; digital can feel *physical*

23. **Stripe's Design Tokens** — https://stripe.com/en-de/payments
    - **Category**: Design system extraction from product
    - **Take**: Color tokens used consistently across products; spacing scale; typography scale (not just font sizes, but the *use context*)
    - **Avoid**: Hand-picking colors per page
    - **Value**: System enables consistency at scale

### Information Architecture & Control Rooms

24. **Wikipedia's Information Architecture** — https://en.wikipedia.org/wiki/Information_design
    - **Category**: Information hierarchy, dense reference
    - **Take**: Sidebar navigation; infobox on the right (summary of the subject); main text flows logically; links are semantically meaningful ("see also", "references")
    - **Avoid**: Hiding structure; making users search for context
    - **Value**: Reader always knows where they are; navigation is predictable

25. **Github Issues & Pull Requests** — https://github.com
    - **Category**: State management UI, collaboration interface
    - **Take**: State clearly visible (open/closed/draft); timeline of changes; @mentions and links create context; filters and sorting don't change the main content area
    - **Avoid**: Changing content shape when filtering
    - **Value**: State is permanent; filters are views, not mutations

### Inspiration & Creative

26. **Are.na Channel: Information Design** — https://www.are.na/morgan-murphy/information-design
    - **Category**: Curated visual inspiration
    - **Take**: Curated visual references for mood and technique; browse for layout inspiration, color palettes, motion ideas
    - **Avoid**: Treating Are.na as a design system
    - **Value**: Inspiration separated from execution

27. **Are.na Channel: Control Rooms** — https://www.are.na/
    - **Category**: Real and fictional control room imagery
    - **Take**: Dense layouts; status indicators; monospace readouts; operator-focused UI design
    - **Avoid**: Copying directly; instead, adopt the discipline
    - **Value**: Control rooms are the metaphor for monitoring

28. **Are.na Channel: Seismology & Data** — https://www.are.na/
    - **Category**: Visual references for seismic and scientific data
    - **Take**: Wave representations; real seismograph imagery; scientific visualization techniques
    - **Avoid**: Cartoony seismograph graphics
    - **Value**: Real seismology visual language; credibility through rigor

### Minimal Gallery & Premium Design

29. **Minimal Gallery** — https://minimal.gallery
    - **Category**: Beautiful minimal websites
    - **Take**: Restraint in color; generous whitespace; clear typography; no decoration unless it earns its place
    - **Avoid**: Emptiness as virtue
    - **Value**: "Powerful" does not mean "complex"; every element serves purpose

30. **SiteInspire** — https://www.siteinspire.com
    - **Category**: Curated design trends
    - **Take**: Filter by category (SaaS, fintech, developer tools); one-sentence description; understand what makes a site award-worthy
    - **Avoid**: Following trends blindly
    - **Value**: Trend spotting; understanding what judges see

### Solana-Specific References

31. **Solana Foundation Microscope** — https://github.com/solana-foundation/solana-microscope
    - **Category**: Self-hosted Solana program monitor
    - **Take**: Clean, read-only interface focused on a single program; shows account state, recent instructions, signers; UX: clean, no clutter
    - **Avoid**: Assuming users have Rust/Anchor knowledge
    - **Value**: Surface *what changed*, not raw IDL; Solana-native patterns

32. **Sec3 Nonce & Multisig Monitor** — https://www.sec3.dev
    - **Category**: Team-scoped protocol monitoring
    - **Take**: Monitors durable nonces and multisig state; alerts on threshold changes; team-focused interface
    - **Avoid**: Making it team-only (our product is public-by-default)
    - **Value**: Multisig state visualization patterns

---

## 2. THREE DESIGN CONCEPTS & SELECTION

### Concept A: SEISMOGRAPH OF CONTROL

**Metaphor**: Protocol control state visualized as seismic waves. Authority transfers, threshold changes, and timelock decrements appear as tremors on a live seismograph. Drift's attack is replayed as a visible fault rupture in real time.

**Hero Image Description**:
A split-screen: left side shows a physical seismograph drum with live control-state waves printing in real time (thin pen lines in gold on dark paper), overlaid with Solana grid. Right side shows the same data as a digital waveform: each protocol a named wave channel; threshold drops register as sudden amplitude spikes; timelock countdown renders as the wave frequency accelerating toward a threshold line. When a protocol's threshold crosses into "danger zone" (red line), the entire wave inverts—the inversion is the commercial moment. A small live ticker at bottom: "Drift threshold 2-of-5 LIVE / Raydium 3-of-4 stable / Marinade monitoring..." The camera pans from left seismograph to right digital, then pulls back to show 30+ protocol waves stacked, each a different height based on risk score. Small red annotations point to Drift's wave showing the exact slot where the attack started.

**Why This Works**:
- **Unfamiliar metaphor in crypto**: No blockchain product uses seismograph language; it signals "serious science" and "predictive power."
- **Emotional resonance**: Seismographs measure hidden motion you cannot see until it's recorded. Users *feel* the anxiety of watching invisible control-layer tremors.
- **Direct reference to USGS**: The seismograph is already proven for real-time data visualization of hidden changes.
- **Incident replay is visual**: Drift's attack becomes a dramatic rupture event, not a table of transactions.
- **Memorable screenshot**: A seismograph with Drift's attack marked as a spike is unmissable in a 4-minute pitch.

---

### Concept B: MISSION CONTROL DASHBOARD

**Metaphor**: Each Solana protocol is a "mission." Control state mirrors spacecraft telemetry boards in NASA mission control. Authority holder = Flight Director, Multisig = Crew capsule guidance subsystem, Timelock = countdown to commit window, Verified Build = green board light.

**Hero Image Description**:
A vertical stack of protocol "flight status" readouts, styled like NASA mission control from the Apollo era but reinterpreted in a dark modern interface. Each protocol row is a "mission card":
- **Top**: Protocol name (bold, large), with small flags: checkmark for verified, hourglass for timelocked, X for immutable.
- **Middle**: A horizontal bar graph showing multisig member count vs. threshold; if threshold dropped recently, the bar animates downward. Signers listed below as small avatars with holdings.
- **Bottom**: A "window" indicator: "Timelock closes in 2d 14h" rendered in monospace font, glowing faintly.
- **Status light**: A single dot (top-left of card) shifts from green (safe) → yellow (changed in 7d) → red (critical threshold or no timelock).

Multiple cards stack, each occupying a fixed height. When a critical change fires, that card's border animates inward (breath effect). The entire screen feels like a multi-monitor control room: dense, real-time, where each glance tells you what you need to know *now*.

**Why This Works**:
- **Existing visual language**: Judges familiar with fintech will recognize "mission control" language; it signals precision and high stakes.
- **Operational credibility**: "Flight Director" framing makes security feel like a known discipline, not speculation.
- **Calm under pressure**: Mission control design philosophy is "everything on one screen, no clicking, all green is good."
- **Density with clarity**: Each protocol fits in a fixed box; stacking implies "I'm monitoring dozens of missions at once."

---

### Concept C: CARTOGRAPHY OF TRUST

**Metaphor**: Control relationships visualized as a living map. Each protocol is a territory; who controls it is rendered as fortifications, ownership flags, and border walls. Authority concentration = territory size; timelock = border thickness; verified build = territory color.

**Hero Image Description**:
A style inspired by *Flightradar24* and *Mapbox*: Solana Mainnet rendered as a geographic canvas. Each protocol is a distinct "territory" (an irregular polygon, sized by TVL or importance). The protocol name appears as a city label. Visual encoding:
- **Border thickness**: Timelock duration (thick = long timelock, thin = no timelock)
- **Border color**: Red if multisig, blue if single-key, green if immutable
- **Fill color**: Darker if verified build; lighter if unverified
- **Flags at center**: Small icons representing top 3 signers
- **Pulsing alert zone**: When a control change occurs within the last 7 days, a faint red glow expands from that territory's center and fades

Zoom out to see the whole Solana ecosystem; zoom in on a territory to see the multisig members, their holdings, recent changes. Clicking a territory opens the detailed control card. The incident replay shows Drift's territory flashing red, then the border *collapsing inward* as the timelock argument to SetAuthority resolves to zero.

**Why This Works**:
- **Unique to control plane**: No blockchain product maps "who holds keys" as geographic territory. It's instantly novel.
- **Intuitive hierarchy**: Map-based UIs are familiar from driving/weather apps; users understand zoom, pan, and territory size = importance.
- **Incident narrative**: Drift's attack plays out as a territorial incursion; the final drain is the "border collapse."
- **Multi-scale storytelling**: 1-second glance = "which territories are red?" → 30-second drill = signers and timeline → 5-minute deep dive = full transaction log.

---

### SELECTION: SEISMOGRAPH OF CONTROL

**Chosen Concept**: Seismograph.

**Reasoning**:

1. **Scientific Metaphor Advantage**: Judges from Anza, Phantom, Drift, and Arcium are engineers and researchers. Seismology language—measuring hidden motion before a break—is *exactly* how they think about control-plane risk. Mission Control is Hollywood; Cartography is elegant but decorative. Seismograph is how scientists visualize invisible data.

2. **Direct USGS Reference**: The USGS Earthquake Map is already proven for real-time monitoring of hidden events. We're not inventing the metaphor; we're borrowing from a 150-year-old scientific discipline. Judges will instantly get it.

3. **Drift Replay as Commercial Gold**: A seismograph with a visible *fault rupture* at the exact moment the attack occurred—that screenshot lives in judges' heads. A mission control with a red light is competent. A seismograph showing a fault line is *unforgettable*.

4. **Timelock as Frequency**: A clever technical encoding: a short timelock renders as a *fast-oscillating* wave; a long timelock as a *slow* wave. That's real information design, not decoration.

5. **Scalability**: 50+ protocol waves stacked vertically are still readable. A map with 50 territories gets cluttered. Mission control with 50 cards forces scrolling.

6. **Depth Level 3 Natural**: A spinning 3D seismograph drum with live pen motion in the WebGL hero is the *exact* type of signature technique that reads as ambitious without being gratuitous.

7. **Repeatable Phrase**: "Control Shockwaves" or "Protocol Tremors" enter Solana vocabulary. Within weeks, Discord says "check the shockwaves." That's the double-entendre: (1) the wave data, (2) the human shock of surprise control changes.

---

## 3. REPEATABLE PHRASE & TONE OF VOICE

### The Line (with second meaning)

**"Control Shockwaves"**
- **First meaning**: The waves of data showing protocol control changes in real time.
- **Second meaning**: The human shockwave—surprise and urgency—when a protocol's safety degrades without warning.
- **Used identically across**: Landing copy, alert titles, incident replay title card, X posts, badge tagline, API docs.

**Example microcopy in product**:
- Alert fired: "Drift multisig threshold: 3→2. Shockwave detected."
- Empty state: "No shockwaves yet. You're watching 8 protocols."
- Error state: "RPC failed. Last shockwave was 4m ago. Reconnecting…"
- Incident replay intro: "Watch the Drift Shockwave. April 1, 2026."
- X post: "Drift's control threshold dropped yesterday. This is what a shockwave looks like."

### Tone of Voice

The product tone is **urgent without hysteria, technical without jargon, honest about limits**.

**Voice Rules**:
- **No superlatives**: Not "revolutionary," "cutting-edge," or "unmatched." Say "first public record" or "live protocol control state."
- **No buzzwords**: Not "leveraging," "synergizing," "unlocking." Say what it does: "decodes Anchor IDL on-chain" or "tracks multisig member changes."
- **Numbers over adjectives**: Not "comprehensive monitoring"; say "tracks 3 control-state vectors per protocol: authority holder, multisig threshold/signers, timelock duration."
- **Honesty about scope**: "Monitors on-chain control state only. Does not detect compromised signers, DNS hijacks, or social engineering."
- **Second-person address in alerts**: "Your wallet holds 42% of this protocol's TVL. Threshold changed 3→2."

| **Context** | **Copy** | **Why** |
|---|---|---|
| Hero headline | "Control Shockwaves: The live record of who holds Solana." | Direct statement, second meaning embedded. |
| CTA (landing) | "Watch Drift's Timeline" | Past tense (historical proof), specific (Drift), implies rich media. |
| Error: RPC down | "Data paused. Last read 6m ago. We're reconnecting." | Honest (paused ≠ broken), time-specific, action-oriented. |
| Risk alert: No timelock | "Raydium: no timelock. Admin can move funds in 1 TX." | Facts first, implication last. Not alarming; precise. |
| Empty state | "Zero protocols watched. Add one to see shockwaves." | Verb-first, consequence-clear. |
| Incident replay card | "Drift Fault: 2026-03-23 to 04-01. 8 days. $285M gone." | Date range, duration, impact. "Fault" is the double-entendre (Drift was the bug; fault is the seismic line). |

---

## 4. VISUAL SYSTEM

### Typography

**Display Face**: **Inter Display** (Google Fonts, variable weight)
- Used for: Headlines (H1, H2), large numbers (KPI cards)
- Weights: 700 (headlines), 600 (subheads)
- Sizes: 48px (hero headline), 32px (section headlines), 24px (card headlines)
- Rationale: Inter is neutral, highly legible, no "crypto" baggage. Display variant has wider letter forms for headlines. *Not* system font or default sans.

**Text Face**: **Inter** (Google Fonts, variable weight)
- Used for: Body text, labels, descriptions
- Weights: 400 (body), 500 (labels), 600 (emphasis)
- Sizes: 16px (body), 14px (labels), 12px (small text)
- Rationale: Consistent with display; legible at small sizes. Excellent numerals for tabular data.

**Mono Face**: **JetBrains Mono** (Google Fonts)
- Used for: Wallet addresses, transaction IDs, protocol names in tables, numeric readouts
- Sizes: 13px (addresses), 14px (data values)
- Rationale: Monospace for technical data reduces misreads; JetBrains Mono has excellent tabular numerals by default.

**Load via `@next/font/google`**:
```typescript
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
```

### Color Palette

**Dark Mode** (primary; light mode optional but not hero path):

| Token | Hex | RGB | Usage | Contrast (on text) |
|---|---|---|---|---|
| `--bg-main` | `#0A0A0F` | 10, 10, 15 | Page background | N/A |
| `--bg-surface` | `#12121A` | 18, 18, 26 | Card, container backgrounds | N/A |
| `--bg-elevated` | `#1A1A24` | 26, 26, 36 | Hover states, tooltips | N/A |
| `--bg-scrim` | `#000000A0` | 0, 0, 0, 63% alpha | Modal overlay, glassmorphism base | N/A |
| `--primary` | `#10B981` | 16, 185, 129 | Buttons, highlights, verified state | 12.8:1 on `--bg-main` |
| `--primary-hover` | `#34D399` | 52, 211, 153 | Button hover, interactive elements on hover | 14.1:1 |
| `--primary-muted` | `#059669` | 5, 150, 105 | Disabled state, secondary accents | 8.2:1 |
| `--text-primary` | `#FAFAFA` | 250, 250, 250 | Headline, main body text | 20.1:1 on `--bg-main` |
| `--text-muted` | `#A1A1AA` | 161, 161, 170 | Secondary text, descriptions | 6.8:1 on `--bg-main` |
| `--text-dim` | `#71717A` | 113, 113, 122 | Tertiary text, hints, metadata | 4.1:1 on `--bg-main` |
| `--border` | `#27272A` | 39, 39, 42 | Hairline borders, dividers | N/A |
| `--success` | `#10B981` | 16, 185, 129 | Verified build, immutable programs | 12.8:1 on `--bg-main` |
| `--warning` | `#F59E0B` | 245, 158, 11 | Multisig with short timelock, recent changes | 14.2:1 |
| `--error` | `#EF4444` | 239, 68, 68 | No timelock, threshold dropped, single key at risk | 9.2:1 |
| `--info` | `#3B82F6` | 59, 130, 246 | Informational badges, secondary data | 8.7:1 on `--bg-main` |

**Rationale for Emerald Green Primary** (`#10B981`):
- Emerald green evokes the USGS seismograph tradition (green ink on paper); it's both scientific and Solana-native (Solana's ecosystem imagery uses green).
- High enough contrast (12.8:1) to pass WCAG AAA on dark background.
- Feels *intentional*, not arbitrary; matches Solana's on-chain explorer aesthetic without the casino-gold leak.
- Warm (warning) and cool (error) accents provide semantic information without relying on red-green alone (colorblind accessibility).

**Alert Color Encoding**:
- **Green**: Verified build status, immutable programs (cannot be changed, ever), signers added
- **Warning (amber)**: Threshold or timelock degraded within 7 days; multisig that recently lost a signer
- **Red**: No timelock (instant risk), threshold < 2-of-5, single-key authority, program compromised in last 24h
- **Blue**: Informational (new protocol added, status update, historical context)

### Grid & Spacing

**Grid**: 4px baseline grid (Tailwind: `space-*` units)
- Card padding: 24px (6 units)
- Section margin: 32px (8 units)
- Component gutter: 16px (4 units)

**Breakpoints**:
- Mobile: 390px (primary breakpoint; founder's spec for "phone width" testing)
- Tablet: 768px
- Desktop: 1280px
- Wide: 1920px+

**Density by Role**:
- **Landing/Marketing**: Ample whitespace, 1–2 sections per fold, 60–70 chars per line.
- **Control Map & Feed**: Dense table, 12–16 rows visible without scroll, high info density (e.g., Solscan-like).
- **Incident Replay**: Moderate density; prioritize narrative flow over data compression.

### Iconography

**Icon Library**: **Heroicons** (https://heroicons.com) + **Phosphor** (https://phosphoricons.com) for data-specific glyphs.
- Heroicons for UI (menu, close, chevron, check).
- Phosphor for data (chart-line for trend, shield-check for verified, clock for timelock, wave for shockwave).
- Stroke weight: 1.5–2px (never filled, unless highlighting).
- Size: 20px (standard), 24px (large), 16px (small).

**Custom Icon for Product**: A seismic wave symbol (simplified; 3–4 sine waves stacked).
- Used in: Logo, alerts, incident replay title card, wave amplitude visualization.
- Style: Thin emerald lines on dark, 1–2px stroke width.

### Data Visualization Language

**For Control State Heatmaps & Risk Deltas**:
- **Axis encoding**: X = time (left to right), Y = protocol (top to bottom) or risk score (bottom = safe, top = critical).
- **Color encoding**: Start with primary emerald for "normal"; shift to warning amber → error red as risk increases.
- **Size encoding**: Wave amplitude = risk magnitude. Timelock duration encoded as wave frequency (shorter timelock = higher frequency / closer oscillations).
- **Shape encoding**: Wave inversion (top-to-bottom flip) = critical control change (threshold drop, signer removal).
- **Animation encoding**: Pulsing glow when a new alert fires; fade-out over 6 seconds (alert has aged, now historical).

**For Multisig Member Lists**:
- Small avatar (16px) + signer name + share % + recent activity (1d/7d/30d action indicator).
- Row highlight on hover (subtle `bg-elevated` lift).
- Red badge if signer is new (added < 7 days) or removed.

### Motion Principles

**Timing**:
- `tick`: 90ms (state changes, micro-interactions: button press feedback)
- `element`: 180ms (card entrance, panel slide-in)
- `data`: 320ms (chart re-draw, number tween, wave shift)
- `count`: 1400ms (number count-out, for dramatic reveals: "285,260,000" climbs over 1.4s)

**Easing**:
- State changes: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out, Material Design)
- Entrances: `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot, 150–200ms, for landing/cards)
- Data updates: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (smooth, moderate)

**What Animates**:
- Number tweens (e.g., threshold 3 → 2 animated over 300ms).
- Chart re-draws (axis, data points update with `data` timing).
- Alert pulses (glow expands 0–100% opacity over 600ms, then fades).
- Panel entrance (slide-in from right, `element` timing).
- Wave motion on seismograph (continuous, not stop-start; use Web Animation API or Framer Motion for smooth 60fps).
- **Seismograph pen motion**: Real-time draw of wave amplitude as new events arrive (requestAnimationFrame, ~16ms ticks).

**What Never Animates**:
- Page scrolls (user controls scroll; avoid scroll-jacking).
- Text wrapping or reflow (jumpy UX).
- Logo or primary navigation (should feel stable).
- Status colors (state changes instantly, then glow animates).

**Motion Budget**: Aim for <200ms p95 on rAF (requestAnimationFrame) to avoid dropped frames. Test on a real phone (not Chrome DevTools throttle only; real device p95 can be 2–3x worse).

### Depth & Lighting (Depth Level 3: Lit WebGL)

**Depth Strategy**:
- `--bg-main` is the floor; no elements go below.
- `--bg-surface` cards sit 1 unit above floor (no shadow; rely on color difference).
- `--bg-elevated` tooltips/popovers sit 1 unit above cards (faint `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5)`; not heavy).
- **WebGL Hero Section** (landing page, incident replay): A 3D seismograph drum rotating slowly in the background (1 rev / 8s). Pen arm draws live data on the drum surface. Lighting: single top-left light (warm amber), creating subtle shadows on drum geometry. Pen is emerald, drum surface is near-black with faint grid. **Do not block content with animation; content overlays semi-transparent, or animation is background-only.**

**Rationale for WebGL**:
- A static seismograph is a drawing; a spinning 3D drum with live pen motion is *unforgettable* in a pitch.
- Depth level 3 (lit WebGL) is the founder's default max ambition (rule 32).
- Use **Three.js** (with React Three Fiber for easy integration in Next.js) + **Framer Motion** for smooth choreography between states.
- **Fallback for browsers without WebGL**: Raster PNG of a seismograph, animating pen manually with CSS or SVG.

---

## 5. INFORMATION ARCHITECTURE & EVERY SCREEN

### Sitemap & Route Structure

```
/                                    # Landing / Home
├── /live                            # Live Feed (all protocols, all changes)
├── /protocols                       # Protocol Control Map (table or card view)
│   └── /protocols/[id]              # Protocol Detail Page
├── /incidents                       # Incident Replay Hub
│   └── /incidents/drift-2026-04-01  # Incident Detail (Drift case study)
├── /wallet                          # Wallet Integration (logged-in only)
│   └── /wallet/alerts               # Alert Settings & History
├── /risk                            # Risk Delta Explainer (educational)
├── /api                             # API Docs & Webhooks
├── /embed/badge/[protocol-id]       # Embeddable Badge (for protocols' websites)
└── /public/[hash]                   # Public Record / Permalink (for sharing)
```

---

### Screen 1: LANDING PAGE (/)

**Primary Action**: "Watch Drift's Timeline" (CTA button, emerald, points to `/incidents/drift-2026-04-01`)

**Fold 1 (Hero, 0–100vh)**:
```
[SEISMOGRAPH ANIMATION - 3D rotating drum, live waves drawing]

Headline (48px, Inter Display 700):
"Control Shockwaves"

Subheading (16px, Inter 400, text-muted):
"The live record of who controls Solana. Get alerts before money moves."

CTA (large, emerald, with arrow icon):
"Watch Drift's Timeline" OR "Start Monitoring" (two options)

Social proof (12px, text-dim):
"Tracking 40+ protocols • 15 critical alerts in 7 days • Public record"
```

**Fold 2 (The Ask, 100–200vh)**:
```
Headline: "What is a Control Shockwave?"

Three cards (side by side on desktop, stacked on mobile):

1. Authority Holder
   Icon: [shield]
   Text: "Who can upgrade the program? A single key, multisig, or nobody (immutable)."

2. Multisig Threshold
   Icon: [people-icon]
   Text: "If 5 signers exist but only 2 must sign, moving your money takes 2 clicks."

3. Timelock Duration
   Icon: [hourglass]
   Text: "How long before a change is final? 0 days means instant risk."

Each card has a number: "3 vectors tracked" subtitle, linking to `/risk` for deep dive.
```

**Fold 3 (Incident Proof, 200–300vh)**:
```
Headline: "See it in action: Drift, April 1, 2026"

[EMBEDDED INCIDENT REPLAY VIDEO OR INTERACTIVE TIMELINE]
Miniature version of full incident replay; click to expand to `/incidents/drift-2026-04-01`

Narrative text (left of video):
"Multisig threshold 3→2. No timelock. 128 seconds. $285M drained."

Stat cards (below):
[Timeline: 8 days of decisions shown in 90 seconds]
[Before → After: threshold comparison]
[Signers: 5 people → 4 people → drain]
```

**Fold 4 (Call to Action & Signup, 300–400vh)**:
```
Headline: "Start monitoring your protocols today"

Input field: "Enter your wallet address" (optional for anonymous access)
OR
Button: "Connect Wallet" (Phantom, Solflare, Ledger)

Subtext: "Optional. Monitor without signing in."

Secondary CTA (text link): "Read API Docs" (for devs)
```

---

### Screen 2: LIVE FEED (/live)

**Layout**: Full-width timeline / activity feed. Each event is a card.

**Hero Section** (sticky top):
```
Headline (24px): "Control Shockwaves: Live Feed"

Filter Row:
[Select All Protocols ▼]  [Last 24h ▼]  [All Events ▼]  [Search by protocol]

Stat badges (inline):
"12 protocols monitored • 3 alerts in 24h • Last update 2m ago"
```

**Feed Cards** (infinite scroll or paginated):

Each card represents one event (one "shockwave"). Cards are ordered by recency.

**Card Structure**:
```
┌─────────────────────────────┐
│ [PROTOCOL ICON] Drift       │ ← Protocol name (bold)
│ Threshold change: 3-of-5 → 2-of-5
│ 
│ Time: 2026-09-26 14:32:15 UTC
│ Signer removed: Alice (45% of voting power)
│ New signer: Bob (22%)
│ 
│ [Risk Delta Badge: AMBER]   │ ← Severity badge (warning/critical)
│ [View Details ▶]            │ ← Link to `/protocols/drift`
└─────────────────────────────┘
```

**Event Types**:
- **Authority Transfer**: Old holder → New holder
- **Multisig Threshold Change**: 3-of-5 → 2-of-5 (with color: amber if decreased)
- **Multisig Member Add/Remove**: Name, voting %, recent activity
- **Timelock Change**: "Timelock set to 2 days" or "Timelock removed (0 days)"
- **Verified Build Status Change**: Verified → Unverified (red badge)
- **Admin Instruction**: Decoded instruction (e.g., "Oracle swap, Collateral market created")

---

### Screen 3: PROTOCOL CONTROL MAP (/protocols)

**Layout**: Card grid or dense table view (toggle at top-right).

**Hero Section**:
```
Headline (24px): "Protocol Control Map"

View Toggle: [Table] [Grid] (icons, default: Table for info density)

Sort & Filter:
[Sort by ▼: Recency / Risk Score / TVL]
[Filter: Multisig / Single-Key / Immutable]
[Search by name]

Quick stats (badges):
"40 protocols • 12 critical • 18 recent changes (7d)"
```

**TABLE VIEW** (recommended; dense, scannable):

```
Protocol Name | Authority Type | Threshold | Signers | Timelock | Verified | Risk | 1d Change
─────────────────────────────────────────────────────────────────────────────────────────
Drift         | Multisig       | 2-of-5    | 5      | 0 days   | No       | 🔴  | ↓ threshold
Raydium       | Multisig       | 3-of-4    | 4      | 7 days   | Yes      | 🟠  | —
Marinade      | Multisig       | 2-of-7    | 7      | 0 days   | Yes      | 🟠  | +1 signer
Orca          | Single Key     | —         | 1      | —        | No       | 🔴  | —
Jupiter       | Immutable      | —         | —      | —        | No       | 🟢  | —
```

**GRID VIEW** (card layout):

```
┌────────────────────────┐
│ Drift                  │ ← Protocol name (headline)
│ [Multisig 2-of-5]      │ ← Authority type badge
│                        │
│ Signers:               │
│ [A] [B] [C] [D] [E]   │ ← Small avatars
│                        │
│ Timelock: 0 days       │ ← Inline text (red = critical)
│ Verified: No           │ ← Status
│                        │
│ [⚠️ CRITICAL RISK] [→] │ ← Risk badge + link to detail
└────────────────────────┘
```

---

### Screen 4: PROTOCOL DETAIL (/protocols/[id])

**Layout**: Sidebar + main content area.

**Left Sidebar** (fixed, 280px):
```
[← Back to Map]

DRIFT
Single headline (protocol name, 24px)

Status Badges:
[Multisig 2-of-5]
[No Timelock] ← Red
[Unverified]

Quick Numbers:
TVL: $2.4B
Last Change: 3 days ago
Type: Decentralized Margin Trading
```

**Main Content**:
```
Fold 1: Control Summary
┌─────────────────────────────────────────┐
│ "Who can move your money?"              │
│                                         │
│ Multisig Governance: 2-of-5 required    │
│ │ Alice (45%)                           │
│ │ Bob (22%)                             │
│ │ Carol (18%)                           │
│ │ Dan (10%)                             │
│ │ Eve (5%)                              │
│                                         │
│ Any 2 of these 5 can:                   │
│ • Upgrade program bytecode              │
│ • Change oracle prices (← risk!)        │
│ • Raise withdrawal caps                 │
│ • Move admin-controlled collateral      │
│                                         │
│ Timelock: 0 days (changes are instant)  │
│ Verified Build: No (unaudited changes)  │
│                                         │
│ Risk Score: 8.2/10 (CRITICAL)           │
└─────────────────────────────────────────┘

Fold 2: Timeline of Changes (last 30 days)
┌─────────────────────────────────────────┐
│ 2026-09-26 14:32 [CRITICAL]             │
│ Threshold: 3-of-5 → 2-of-5              │
│ Signer removed: Frank (5%)              │
│                                         │
│ 2026-09-20 08:15 [WARNING]              │
│ Timelock changed: 3 days → 0 days       │
│                                         │
│ 2026-09-15 16:45 [INFO]                 │
│ Signer added: Grace (12%)               │
└─────────────────────────────────────────┘

Fold 3: Verified Build Status
[Icon: X] No verified build on record
(Rebuilds from source can be checked at verify.osec.io/status/DriftxD...)
Last check: 2026-09-10

Fold 4: Admin Privileges
[Decoded from on-chain IDL]
• update_oracle() — Can set price feeds
• set_collateral_cap() — Cap how much collateral can be posted
• set_withdrawal_cap() — Limit daily withdrawals
• pause_market() — Freeze all trading
[View Transaction Decoder] (link to external tool, e.g., Solscan)
```

---

### Screen 5: LIVE INCIDENT REPLAY (/incidents/drift-2026-04-01)

**Layout**: Full-screen timeline with video/interactive scrubber.

**Hero Section** (fixed top):
```
← Back

Incident: "Drift Fault"
Date: April 1, 2026 | Duration: 8 days | Impact: $285.26M lost

Timeline Scrubber:
[=====●──────────] ← Draggable cursor, snaps to key events
Mar 23           Apr 1 (drain)

Key Events Listed Below Timeline:
[⚙️] Mar 23: Durable nonce created
[⚠️] Mar 23: Security Council meeting
[🔴] Mar 27: Threshold dropped 3→2
[📍] Mar 28: Timelock set to 0
[🚨] Apr 01 08:15: Malicious market created
[⬇️] Apr 01 08:17: 18 vaults drained (128s window)
```

**Main Content**:

**Frame 1: Mar 23, Setup** (plays automatically on load)
```
Card Layout:
Left: Timeline descriptor ("Day 0: Security Council Upgrade")
Right: Drift protocol card (old state: threshold 3-of-5, timelock 3d)

Narration (subtitle):
"March 23: A Security Council migration begins. Threshold can change from 3-of-5 to 2-of-5."

Animation:
Drift card's multisig member list appears, showing the 5 signers.
```

**Frame 2: Mar 27, Threshold Drops**
```
Left: "Day 4: Threshold Lowered"
Right: Drift card animates — the member list reorders, one member fades out
       Below: "Threshold changed: 3-of-5 → 2-of-5"
       New badge appears: [WARNING] Risk Score: 6.2 → 7.8

Narration:
"March 27: The threshold is lowered to 2-of-5. Fewer signers needed. Easier to coordinate an attack."
```

**Frame 3: Mar 28, Timelock Removed**
```
Left: "Day 5: Timelock Drops to Zero"
Right: Drift card — timelock badge flips red
       "Timelock: 3 days → 0 days"
       Risk badge: [CRITICAL] 7.8 → 9.2

Narration:
"March 28: Timelock is removed. Changes are now instant. No delay between decision and execution."
```

**Frame 4: Apr 1 Morning, Market Created**
```
Left: "Day 9: Malicious Market Deployed"
Right: A new row appears below Drift's card: "Collateral Market: USDC → Fake"
       It pulses red (new alert).

Narration:
"April 1: A malicious collateral market is created on Drift. It appears legitimate but is designed to fail."
```

**Frame 5: Apr 1 08:15–08:17, The Drain**
```
Left: "Day 9: 128 Seconds"
Right: Split screen showing two actions:
  LEFT side:  Withdrawal caps raise in real-time (numbers climb: 100M → 200M → 285M)
  RIGHT side: A red wave spreads across a Solana ecosystem map (18 vault icons go red)

Animated countdown: "08:15:00 → 08:16:47" (127 seconds)
Subtle falling emerald coins animation (understated, not cheesy).

Narration:
"April 1 at 08:15 UTC: The attack executes. Withdrawal limits are raised in rapid sequence. 18 vaults drain. All $285.26M, gone in 128 seconds."
```

**Post-Timeline Reflection**:
```
Headline: "What Shockwaves Would Have Fired?"

Three cards showing what alerts a subscriber would have received:

1. Threshold Change Alert
   "Your protocol changed control state"
   "Drift threshold: 3-of-5 → 2-of-5 [Mar 27 12:34]"
   Sent: instantly ✓

2. Timelock Removal Alert
   "Drift timelock: 3 days → 0 days [Mar 28 16:45]"
   Severity: CRITICAL (red badge)
   Sent: instantly ✓

3. Admin Instruction Alert
   "Collateral cap changed: 100M → 285M [Apr 1 08:15]"
   Severity: WARNING (amber badge)
   Sent: instantly ✓

Reflection text (14px, text-muted):
"A subscriber watching Drift's control plane would have been alerted 4 days before the drain. Time to act. Time to move funds. Time to tell the Drift team."
```

---

### Screen 6: ALERT SETUP & WALLET (/wallet/alerts)

**Layout**: Multi-step form (if first time) or settings dashboard (if returning).

**Step 1: Connect Wallet** (if not signed in)
```
Headline: "Connect your wallet to get started"

Buttons (side-by-side):
[🔗 Connect Wallet] [Continue as Guest]

Copy (14px):
"We'll scan your wallet to see which protocols hold your funds. No messages to sign. No data stored. No fees."
```

**Step 2: Choose Protocols** (after wallet connection)
```
Headline: "Your protocols"

List of protocols holding this wallet's funds, auto-detected:
┌─────────────────────────────┐
│ ✓ Drift (42% of your funds) │ ← Checkbox (default: checked)
│ ✓ Raydium (30%)             │
│ ☐ Orca (0.1%, low balance)  │
│ ✓ Marinade (25%)            │
│                             │
│ [Only watch selected]       │ ← Button
└─────────────────────────────┘

Copy: "We'll alert you *only* for protocols holding your funds."
```

**Step 3: Choose Alert Channels**
```
Headline: "How to receive alerts?"

Checkboxes:
☑️ Email (irfan@example.com)
☐ Telegram (@username_bot)
☐ Webhook (https://...)
☐ Twitter/X Mentions (@yourhandle)

For each checked option, a second-level input appears:
  Email → Already filled
  Telegram → "Enter Telegram handle" + "Send me auth code" button
  Webhook → "Enter endpoint URL" + "Test webhook" button
  X → "Follow @control-shockwaves" + "I'll mention you in alerts" checkbox
```

**Step 4: Alert Thresholds** (optional, advanced)
```
Headline: "Fine-tune alerts (optional)"

Defaults:
○ All events (default: checked)
○ Critical events only (threshold < 2-of-5, no timelock)
○ Custom (show filters below)

If "Custom" selected:
☑ Threshold changes
☑ Timelock changes
☑ Signer adds/removes
☐ Verified build status changes
☐ Admin instructions
☑ Only alert if signer is new (< 7 days) or removed

[Save Preferences]
```

**Return State: Alert History**
```
Headline: "Alert History"

View toggle: [Last 24h] [Last 7d] [Last 30d]

Table:
Time | Protocol | Event | Status | Action
─────────────────────────────────────────────
14:32 | Drift | Threshold 3→2 | Sent ✓ | [View]
12:15 | Raydium | Signer added | Sent ✓ | [View]
10:42 | Marinade | No timelock | Failed ✗ | [Retry]

[View my public record] (link to `/public/[wallet-hash]`)
```

---

### Screen 7: RISK DELTA EXPLAINER (/risk)

**Layout**: Scrollytelling (scroll-driven animations).

**Section 1: Intro**
```
Headline (48px): "Control Risk Deltas"
Subheading: "What changes matter most?"

Interactive explainer: Three sliders
┌──────────────────────┐
│ Threshold: [3]←→[2]  │ (drag to see risk change)
│ Risk score: 4.2 → 6.8 │
│ 
│ Timelock: [3 days]←→[0] │
│ Risk score: 4.2 → 8.1 │
│
│ Verified?: [Yes]←→[No] │
│ Risk score: 4.2 → 5.1 │
└──────────────────────┘
```

**Section 2: Threshold Deep Dive**
```
Headline: "Multisig Threshold: The Bottleneck"

Narrative (left), Visuals (right):

"A 5-of-5 multisig requires all 5 signers to agree.
A 3-of-5 multisig requires 3 to agree (quorum).
A 2-of-5 multisig requires only 2 to agree.
A 1-of-5 is a single key held by a committee member."

Visualization (on right): A seismograph wave grows taller as threshold decreases:
- 5-of-5: tiny amplitude (very stable)
- 3-of-5: medium amplitude
- 2-of-5: tall amplitude
- 1-of-5: tallest (most unstable)

Number box (red, large): "Drift: 2-of-5 = 40% of signers can coordinate an attack"
```

**Section 3: Timelock Deep Dive**
```
Headline: "Timelock: The Delay Defense"

Narrative (left), Timeline Visualization (right):

"A timelock is a delay between when a change is proposed and when it takes effect.
- No timelock (0 days): Change is instant.
- 1-day timelock: Change takes 24 hours.
- 7-day timelock: A week to respond."

Timeline animation (on right):
[Proposal at 08:00] → [8 hours] → [16:00 still waiting] → [+1d] → [Next day 08:00: Change takes effect]

Red box: "Drift: 0-day timelock. From proposal to drain: < 1 TX."
```

**Section 4: Verified Build Status**
```
Headline: "Verified Build: The Truth Test"

Two cards:
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ Verified Build              │ │ Unverified Build            │
│ ✓ Source code on-chain      │ │ ✗ No public source          │
│ ✓ Matches deployed binary   │ │ ? Could contain hidden code │
│ ✓ Auditors can review       │ │ ? Developers only know what │
│ Risk: Low                   │ │   it does                   │
│                             │ │ Risk: High                  │
└─────────────────────────────┘ └─────────────────────────────┘

Narrative:
"Drift's program is unverified. When they upgrade, nobody can audit the new code. A hidden instruction could drain your collateral."
```

**Section 5: Risk Score Model**
```
Headline: "How Shockwaves Calculates Risk"

Formula (stylized):

Risk = (Threshold Weight × [5 - threshold] / 4)
       + (Timelock Weight × (7 - timelock_days) / 7)
       + (Verified Weight × [1 - verified])
       + (Signer Weight × [1 - signer_diversity])

Example calculation for Drift:
Threshold (2-of-5):     +7.5 points (high risk)
Timelock (0 days):      +9.0 points (critical)
Verified (no):          +2.5 points (medium risk)
Signer Diversity (low): +1.2 points (low risk)
─────────────────────────────────
Total Risk Score:       9.2 / 10 (CRITICAL)

Interactive slider: Adjust weights to see how risk changes.
```

---

### Screen 8: API DOCS & WEBHOOKS (/api)

**Layout**: Two-column (sidebar nav + content).

**Sidebar Navigation** (fixed, 220px):
```
API Reference
├── Webhooks
│   ├── Subscribe
│   ├── Event Types
│   └── Examples
├── REST API
│   ├── GET /protocols
│   ├── GET /protocols/:id
│   ├── GET /feed
│   └── GET /risk/:protocol-id
├── On-Chain Program
│   ├── Overview
│   ├── CPI Check
│   └── Attestation
└── Examples
    ├── JavaScript/TypeScript
    ├── Python
    └── Rust
```

**Main Content: Webhooks Section**

```
Headline: "Webhooks"

Subheading: "Get real-time alerts delivered to your endpoint"

Code Example (syntax-highlighted):
```javascript
const response = await fetch('https://api.controlplane.sol/v1/webhooks', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${your_api_key}` },
  body: JSON.stringify({
    url: 'https://your-service.com/alerts',
    events: ['threshold_change', 'timelock_change', 'signer_change'],
    protocols: ['Drift', 'Raydium'],
  })
});
```

Event Example (webhook payload):
```json
{
  "id": "evt_1234567890",
  "timestamp": "2026-09-26T14:32:15Z",
  "protocol": "Drift",
  "event_type": "threshold_change",
  "data": {
    "old_threshold": "3-of-5",
    "new_threshold": "2-of-5",
    "removed_signer": "Alice",
    "removed_signer_share": "45%",
    "slot": 250564373,
    "transaction": "4bXx..."
  }
}
```

**Main Content: On-Chain Program Section**

```
Headline: "Control Policy Program (On-Chain CPI)"

Subheading: "Call this program to refuse movements into weakened-control protocols"

Description:
"Any vault, curator, or integrator can call the ControlPolicy program to check a protocol's control state before accepting a move of user funds."

Code Example (Anchor, Rust):
```rust
#[program]
pub mod control_policy {
    pub fn check_protocol_safety(
        ctx: Context<CheckSafety>,
        protocol_id: Pubkey,
        min_threshold: u8,
        min_timelock_days: u8,
    ) -> Result<()> {
        let protocol_state = ProtocolControlState::load(&ctx.accounts.protocol_state)?;
        
        require!(
            protocol_state.multisig_threshold >= min_threshold,
            "Threshold too low"
        );
        require!(
            protocol_state.timelock_days >= min_timelock_days,
            "Timelock too short"
        );
        
        Ok(())
    }
}
```

Call it:
```rust
// In your vault's instruction
let _ = control_policy::cpi::check_protocol_safety(
    CpiContext::new(cpi_program, accounts),
    drift_pubkey,
    2,  // min_threshold: 2-of-5 or better
    1,  // min_timelock: at least 1 day
)?;
```

---

### Screen 9: EMBEDDABLE BADGE (/embed/badge/[protocol-id])

**Purpose**: Protocols embed a badge on their website showing "Control Status: Safe" or "Control Status: At Risk".

**Badge Designs**:

Size: 200×50px (responsive)

Safe (Verified, high threshold, long timelock):
```
┌──────────────────────────┐
│ ✓ Drift Control Safe     │
│   2-of-5 • 7d timelock   │
│   Updated 2h ago         │
└──────────────────────────┘
```

At Risk (Low threshold, no timelock):
```
┌──────────────────────────┐
│ ⚠ Drift Control At Risk  │
│   2-of-5 • 0d timelock   │
│   Updated 2h ago         │
└──────────────────────────┘
```

Critical (Single key or recent changes):
```
┌──────────────────────────┐
│ 🔴 Drift Control Critical│
│   Single key (changed 1d)│
│   Updated 2h ago         │
└──────────────────────────┘
```

**Embed Code** (single line):
```html
<iframe src="https://controlplane.sol/embed/badge/drift" width="200" height="50" frameborder="0"></iframe>
```

**Styling**: Dark background, emerald accent, monospace font for numbers, hover effect (darkens slightly, shows tooltip with detail).

---

### Screen 10: PUBLIC RECORD / PERMALINK (/public/[hash])

**Purpose**: Shareable, permanent record of a protocol's control history. Anyone can link to a protocol's record; no login needed.

**Layout**: Same as Protocol Detail, but read-only, with share buttons.

**Share Options**:
```
[Copy Link] [Share to Twitter/X] [Export as PDF]
```

**Content**:
- Full control history (timeline)
- Multisig members & voting power (snapshot at share time)
- Verified build status
- Admin privileges (decoded)
- Risk score
- "Record created: 2026-09-26 14:32:15 UTC"

---

## 6. INTERACTION & UX PRINCIPLES

### Keyboard Navigation & Shortcuts
- **Tab**: Navigate between controls (links, buttons, inputs).
- **Enter/Space**: Activate button.
- **Arrow keys**: Navigate within lists (feed, table rows).
- **Escape**: Close modals, popovers.
- **/**: Open search (global protocol search).
- **K** (cmd+k on Mac, ctrl+k on Windows/Linux): Command palette (quick jump to protocol, alert, incident).

### Search & Discovery
- **Global Search Bar** (top of every page, after header logo):
  - Type protocol name: "Drift" → suggestions appear (debounced, 150ms).
  - Type wallet address: "5P..." → search that wallet's alerts.
  - Type transaction signature: "4Xx..." → link to Solscan.
  - Keyboard shortcut: **/** or **Cmd+K**.

### Deep Links & Sharing
- Protocol detail: `/protocols/drift` (bookmarkable, shareable).
- Incident: `/incidents/drift-2026-04-01` (permanent, citable).
- Public record: `/public/0x1a2b3c` (wallet hash, immutable snapshot).
- Embed badge: `/embed/badge/drift` (iframeable).

### Speed Budget
- **Lighthouse scores**: Aim for >90 performance on desktop, >75 on mobile.
- **First Contentful Paint**: <1.5s.
- **Largest Contentful Paint**: <2.5s.
- **Cumulative Layout Shift**: <0.05.
- **Interactive (TTI)**: <3.5s.
- **RPC calls**: Cache for 30s; show "last updated Xm ago" if cache hit.

### Mobile Optimization (390px breakpoint)
- **Bottom navigation bar**: Links to Live, Protocols, Wallet, Settings (fixed, swipeable).
- **Single-column layout**: Cards stack vertically.
- **Tables**: Horizontally scrollable (freeze protocol name column).
- **Tap targets**: Minimum 44×44px (Apple iOS standard).
- **No hover states**: Use active/pressed states instead.
- **Modals**: Slide up from bottom (not center modal).

### Accessibility
- **Color contrast**: WCAG AAA (7:1 minimum; aim for 10:1).
- **Focus indicators**: Visible, emerald-colored outline (3px, offset).
- **Semantic HTML**: Proper heading hierarchy (H1 once per page).
- **ARIA labels**: Buttons with icons only get aria-label="...".
- **Form labels**: Every input paired with explicit label.
- **Reduced motion**: Respect `prefers-reduced-motion` media query (disable animations).

---

## 7. LIBRARIES & MATERIALS TO USE

### Frontend Stack
- **Framework**: Next.js 14+ (React Server Components for performance)
- **Styling**: Tailwind CSS v4 (dark mode via `dark:` prefix, no arbitrary color hacks)
- **Component Library**: shadcn/ui (use as a starting point; fork and customize)
- **Charts & Viz**: visx + D3 for seismograph custom visualization, OR Recharts (for simplicity) + Tremor (fintech components)
  - *Why visx*: Lower-level, more control for seismograph wave rendering; D3 is the standard for scientific visualization.
  - *Why Recharts*: Easier for standard charts (area, line, bar); responsive out of the box.
- **3D Graphics**: React Three Fiber + Three.js (for seismograph hero animation on landing)
- **Motion**: Framer Motion (spring animations, exit animations, shared layout animation) + Web Animation API for continuous seismograph pen motion
- **Icons**: Heroicons + Phosphor (already mentioned; loaded from npm)

### Backend & Data
- **Indexing**: Helius (5 webhooks free; Parsed Streams for state changes)
- **RPC**: Helius, Yellowstone gRPC, or Solana RPC for polling
- **Database**: PostgreSQL (state, cache), Redis (session, alert queue)
- **Verification**: OtterSec's `verify` program (on-chain program ID) for verified build checks
- **Squads SDK**: v4 for decoding multisig state
- **Anchor IDL**: Decode on-chain; store in PostgreSQL for fast lookup

### On-Chain Program (Rust/Anchor)
- **Language**: Anchor (Solana's framework)
- **CPI Target**: ControlPolicy program (you build this as part of the product)
- **State**: Stores latest control state for each protocol, attested by indexer (later: quorum)

### Design Tools (for spec'ing, not execution)
- **Figma** (for UI mockups; link to this CREATIVE.md from Figma components)
- **Are.na** (reference collection; public link for team)

### Fonts
- **Display**: Inter Display (Variable, Google Fonts)
- **Text**: Inter (Variable, Google Fonts)
- **Mono**: JetBrains Mono (Google Fonts)

**Load fonts** via `@next/font`:
```typescript
// app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-inter">{children}</body>
    </html>
  );
}
```

---

## 8. WHAT MAKES A JUDGE REMEMBER IT TOMORROW

### The 90-Second Pitch Moment
The hero screenshot a founder takes into the judge's room:

**Image 1**: Seismograph with live waves drawing in emerald on dark background. Drift's attack is a visible rupture/fault line in red, with the timestamp "Apr 1, 08:15 UTC" and impact number "$285.26M" overlaid. The wave metaphor is immediately understood; the incident is visceral.

**Image 2**: (If time allows) Incident replay showing the timeline of Drift's attack from Mar 23 to Apr 1. The visual progression of "threshold down" → "timelock removed" → "drain" is a story without words.

### The Repeatable Phrase
"Control Shockwaves" enters the Solana zeitgeist. Within two weeks of launch, everyone in the Solana Discord says "check the shockwaves" when a protocol changes its multisig. Judges will have heard it used by others by the time they see the final submission.

### The Incident Replay
The Drift incident replay is the centrepiece. A judge watching it sees:
1. A moment-by-moment chronicle of how a protocol's control state degraded.
2. The exact sequence of decisions that enabled the attack.
3. A clear visualization of what *should have been* an alert.
4. A proof-of-concept that the product catches the next Drift before it happens.

Founder can say: *"Watch Drift. 8-day setup, 128-second drain. This product fires alerts on day 1. Your protocols get 8 days to respond."*

### The Seismograph Metaphor Itself
It's not a table. It's not a Dashboard. It's a *seismograph*, a scientific instrument for measuring hidden motion. Judges will remember this. It separates the product from generic "blockchain monitoring" noise. Researchers at Anza instantly connect it to scientific rigor.

### The On-Chain Program
When a founder says, *"Any vault can call our on-chain program and refuse to move funds into this protocol until its control state stabilizes,"* the product becomes a building block, not a viewer. That makes it defensible against future competitors.

### The Public Record
The fact that the data is public, permanent, and citable means a researcher can link a peer to a protocol's control history without authentication. That citation power is unforgettable in academic/VC circles. A judge from Anza will write a paper citing this product.

### Execution Quality at Depth 3
A seismograph 3D model that spins and draws live data in the landing page hero is *not generic*. Judges remember products that dare to use WebGL when a static image would suffice. It signals ambition and craft. Real data flowing through the animation (not mocked) is the proof of concept.

### The Founder's Narrative
"I'm in Nigeria. I watched Drift happen in real time. Nobody published who could move the money until it was gone. I built this so the next protocol team and every user has 8 days of warning." That's the story. The product is the proof.

---

## SUMMARY

**The Control Plane of Solana** is a public, live record of who controls Solana protocols, delivered as a seismograph visualization where control changes appear as shockwaves. The product's hero moment is the interactive Drift incident replay, showing how a multisig threshold drop and timelock removal preceded a $285M drain by 8 days. A judge watches that replay and immediately understands: *"This catches the next Drift before it happens."*

The seismograph metaphor is unfamiliar in crypto—it signals scientific rigor and predictive power. The repeatable phrase *"Control Shockwaves"* has a second meaning (the human shock of surprise control changes). The visual system is Solana-native (dark theme, emerald accents derived from USGS seismograph imagery, dense data tables, seismic waves encoded with risk metrics). The information architecture covers every user need: live feed, protocol control map, incident replay, wallet alerts, risk explainer, API docs, and embeddable badges for protocols.

Execution at depth level 3 (lit WebGL seismograph, smooth motion, no dropped frames) separates this from generic dashboards. The on-chain program turns monitoring into a building block. The public record makes the product academic-grade, citable, and durable.

Judges will leave the pitch room talking about the seismograph. The incident replay will play in their head for a week. The product will be remembered not as "a blockchain monitoring tool" but as *"the Drift timeline made visible, and the system that catches the next one."*

---

**Next Step**: This CREATIVE.md is the foundation. The team now moves to SELECT (refine demand, write PROJECT.yaml with demand evidence), then BUILD (implement each screen, test on real device at 390px, ship incident replay first as proof-of-concept, then scale to full platform).

**Planning Complete**: Awaiting founder approval before implementation.
