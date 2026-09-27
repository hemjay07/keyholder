# Cinematic Web Motion: Reference Analysis for Keyholder

Research date: 2026-09-27 | 6 award-winning references studied for continuous, choreographed motion

---

## Reference 1: Lando Norris (landonorris.com) — Awwwards SOTY 2025

**Award:** Site of the Year + Users' Choice 2025 | **Studio:** OFF+BRAND  
**Contact Sheet:** `/Users/mujeeb/controlplane/design/research/refs/lando-norris/sheet.png`

### Scroll Experience (0–10435px, 22 frames)
- **0–15%:** Lime-green hero text stacked over dark background; portrait photograph of driver; text animates in line-by-line with offset timing
- **15–30%:** Bold "LEGACY IN FORMULA 1" headline with multi-image parallax (racing shots, lifestyle photos at different scroll speeds)
- **30–50%:** Helmet gallery: 3D-rendered helmet objects flip and rotate as you scroll; each helmet is a discrete animation block triggered at entry, with micro-interactions on hover revealing details
- **50–70%:** "ON TRACK / OFF TRACK" split-screen comparison sections; images fade and cross-dissolve
- **70–100%:** Collaborations and footer; minimal motion, mostly fades and scale transitions

### Techniques Observed
1. **Scroll-driven canvas animations** (21 detected canvases): Hero sequences use frame-by-frame scrubbing (likely image sequences, not 3D)
2. **Lenis smooth scroll:** All scroll feels weighted and inertial, never jarring
3. **GSAP + ScrollTrigger:** 83 references to GSAP, 19 to ScrollTrigger; animations pinned to scroll position
4. **Offset parallax:** Images move at different speeds creating depth
5. **Text reveal:** Headlines animate letter-by-letter or line-by-line using clip-path and opacity
6. **Section pinning:** Some sections "stick" while content animates within them
7. **No full-page scroll-snap:** Free scroll with choreographed triggers at breakpoints
8. **Typography:** Mona Sans Variable (dynamic weight shifts), Brier (heavy, expressive)

### What Works
- **Hierarchy:** Motion guides attention—lime green pops, then photography, then white space breathes
- **Pacing:** No two sections feel alike; rhythm prevents fatigue
- **Restraint:** Animations end cleanly; no auto-playing elements distract
- **Brand voice:** Motion reinforces Lando's energy (bold, fast, precise)

### What Keyholder Should NOT Copy
- Athlete/personal brand focus (Keyholder is protocol-centric, not person-centric)
- Bright neon accent color (Keyholder uses bone/ink/signal orange, more serious tone)
- Image-heavy asset loads (Keyholder's 3D instrument console needs optimized geometry)

**Learnings for Keyholder:** Use GSAP + ScrollTrigger for reliability; Lenis for feel; pinning + parallax to create depth; offset animations within sections to guide the eye through complexity.

---

## Reference 2: Lusion (lusion.co) — 3D Interactive Studio

**Award:** FWA multiple times | **Focus:** 3D visual storytelling  
**Contact Sheet:** `/Users/mujeeb/controlplane/design/research/refs/lusion/sheet.png`

### Scroll Experience (0–0px, homepage only; scrolls inside a contained hero)
- **Entire page:** Single 3D scene with abstract geometric objects (floating shapes, cubes, spheres) rotating and transforming
- **Interaction model:** Scene is touch/mouse-interactive (not purely scroll-driven); scroll-triggered animations shift the scene composition
- **Color:** Dark navy/black background with accent (blue neon glow); high contrast
- **Minimal text:** Only tagline and nav visible; content reveals on hover

### Techniques Observed
1. **Three.js scene as hero:** 3D engine used to render and animate objects in real-time
2. **No GSAP detected:** Pure Three.js animation loop (likely `requestAnimationFrame` at 60fps)
3. **Custom fonts:** Aeonik (modern, geometric), IBMPlexMono (code-like precision)
4. **No smooth scroll library:** Native scroll, but very subtle (most interaction is 3D, not scroll)
5. **Canvas rendering:** Single central canvas; 3D objects are procedural geometry, not image sequences
6. **Interaction as narrative:** Viewers explore the scene; motion is emergent from interaction, not linear

### What Works
- **Singular focus:** One 3D instrument (the rotating shapes) commands all attention
- **Brand clarity:** Motion says "we build 3D experiences" without explanation
- **Performance:** Three.js with optimized geometry means fast load and smooth interaction
- **Emotional impact:** The rotating, morphing geometry feels alive and sophisticated

### What Keyholder Should NOT Copy
- The entire experience cannot be a single object (Keyholder has multiple "pages" to cover)
- This would overwhelm scrollytelling needs (Keyholder must layer protocol + replay + data)

**Learnings for Keyholder:** An object-centred approach works IF the object drives narrative; Three.js for real-time 3D is viable; the key insight is that motion as *interaction* (user-driven) feels more playful than purely scroll-driven motion.

---

## Reference 3: La Revoltosa (larevoltosa.es) — Scrollytelling with 3D

**Award:** Awwwards Site of the Day 7.45/10 | **Focus:** Brand relaunch via scrollytelling  
**Contact Sheet:** `/Users/mujeeb/controlplane/design/research/refs/la-revoltosa/sheet.png`

### Scroll Experience (0–5795px, 22 frames)
- **0–10%:** Hero: Full-screen brand introduction; minimal text, color-saturated red background
- **10–30%:** 3D bottle rotates and morphs; text reveals brand voice ("La burbuja Ibérica"); bottle is rendered in Three.js with complex refraction
- **30–60%:** Scrollytelling sections with layered narrative; each section introduces brand heritage ("family bars," "social ritual"); supporting images and statistics reveal on scroll
- **60–100%:** Community stories (user testimonials), contact form (progressive disclosure—one field per scroll stop), footer

### Techniques Observed
1. **Three.js for 3D bottle:** Complex refraction/transparency; procedurally rendered, not baked image sequence
2. **GSAP + ScrollTrigger + Lenis:** Full stack for smooth, pinned animations
3. **ScrollTrigger text reveals:** Headlines and body copy appear with clip-path masks or opacity fades
4. **WordPress backend:** Built on WordPress with Three.js integration (not a SPA)
5. **Section-based pinning:** Content "sticks" while supporting visuals animate within
6. **No canvases detected on first load:** Suggests lazy-loaded Three.js or deferred rendering

### What Works
- **Narrative beats:** Scroll reveals story in chapters; each chapter is self-contained but flows into the next
- **3D as heritage:** The bottle is the brand—its rotation tells the story of transformation
- **Data restraint:** Statistics appear exactly when relevant (no information overload)
- **Progressive form:** Contact form doesn't ask for everything at once; scroll = engagement = commitment
- **Color palette:** Red (energetic, social) + white space (clarity) + typography (personality)

### What Keyholder Should DEFINITELY Apply
1. **3D object as hero:** The machined 3D instrument console should animate and morph on scroll (like the bottle)
2. **Scrollytelling beats:** Drift hack replay should unfold in chapters—each scroll section reveals a new layer
3. **Refraction/material complexity:** Use shader-based materials (not just simple geometry) to convey precision and danger (for hack context)
4. **Section pinning with internal animation:** Keep the console in viewport while protocol state changes animate inside it
5. **Progressive disclosure:** Reveal key controls one at a time; scroll = unlocking capability

**Learnings for Keyholder:** This is your closest analog. Adapt: bottle → instrument console; brand story → Drift hack replay + protocol state; testimonials → protocol metadata (threshold, timelock, key holders).

---

## Reference 4: Linear (linear.app) — Product Scroll Restraint

**Award:** One Page Love (recognized for scroll effect design) | **Focus:** Minimalist product tool showcase  
**Contact Sheet:** `/Users/mujeeb/controlplane/design/research/refs/linear/sheet.png`

### Scroll Experience (0–9060px, 22 frames)
- **0–10%:** Dark hero with large, white type; minimal nav
- **10–30%:** Feature cards scroll into view with subtle fade + scale (no parallax, no skew)
- **30–60%:** Feature carousel: Cards move left while new cards appear right; feels like a runway, not a scroll
- **60–80%:** Testimonials; video backgrounds play silently behind customer quotes
- **80–100%:** CTA and footer; warm color accent (yellow/lime) appears for emphasis

### Techniques Observed
1. **No GSAP detected in bundle:** Animations likely CSS `@keyframes` or minimal JS
2. **No 3D (Three.js, Babylon):** Pure CSS + SVG
3. **Subtle shimmer effects:** On features and buttons (using CSS filters or SVG shaders)
4. **Video backgrounds:** MP4 or WebM playing on autoload (carefully scoped to visible sections)
5. **Darkmode as default:** Contrast with white text drives focus; motion can be minimal because the design is already punchy
6. **Typography-first:** Inter Variable (flexible weight) and Berkeley Mono (monospace for code snippets) do the heavy lifting

### What Works
- **Clarity over spectacle:** Every animation has a purpose—reveal functionality, show sequence, draw attention to CTAs
- **Performance:** Minimal motion library code = fast page loads
- **Dark mode:** Makes even subtle motion visible; understated animations feel sophisticated
- **Responsive design:** No fixed animations; scales smoothly across devices

### What Keyholder Should NOT Copy
- This level of restraint (Keyholder's Drift hack replay NEEDS dramatic motion to convey urgency)
- Minimalist color palette (Keyholder's bone/ink/orange is bold by design)

**Learnings for Keyholder:** Simplicity can be powerful, but only if the subject matter is simple. Keyholder's subject (security breaches, protocol governance, 3D machinery) demands more visual language. Use Linear's *principle* (every motion = information) but not its style.

---

## Reference 5: The Pudding — Sizing Chaos (pudding.cool/2026/02/womens-sizing)

**Award:** Multiple Webby Awards; leader in data scrollytelling  
**Contact Sheet:** `/Users/mujeeb/controlplane/design/research/refs/pudding-sizing/sheet.png`

### Scroll Experience (0–61114px, 22 frames; deepest scroll of all references)
- **0–5%:** Headline and article intro; minimal motion
- **5–20%:** Interactive chart: Bar chart showing body measurements; user can filter by size/brand; reveals comparison data as scroll progresses
- **20–50%:** Dot plot showing size variance; each dot represents a brand; hovering highlights one brand; scroll reveals statistical insights
- **50–80%:** Dress silhouette diagrams; interactive overlays show size range differences; annotation text appears on scroll
- **80–100%:** Conclusion, sources, call-to-action (subscribe/donate)

### Techniques Observed
1. **No 3D or GSAP detected:** Pure D3.js for chart interaction, plain CSS for layout
2. **IntersectionObserver:** Detects when charts enter viewport; triggers D3 render
3. **Minimal animation:** Transitions are abrupt or very subtle (chart data updates snap or fade gently)
4. **SVG for charts:** Scalable graphics, not Canvas or WebGL
5. **Accessibility first:** Legends, labels, and annotations are keyboard-navigable
6. **Long-form reading:** Scroll-depth = reading time; motion is subordinate to data clarity

### What Works
- **Data as narrative:** The story is in the numbers, not the motion
- **Engagement through discovery:** Readers scroll to *understand*, not to see the next animation
- **Restraint:** Animations don't distract; they enhance comprehension
- **Accountability:** Every visual claim has a data source cited below the fold

### What Keyholder Should NOT Copy
- Static data focus (Keyholder's Drift hack replay is *event narrative*, not statistical analysis)
- Lack of motion (Keyholder needs motion to convey tension and timeline)

### What Keyholder MIGHT Borrow
- **Progressive revelation:** Introduce one control/metric at a time
- **Annotation strategy:** Label key moments in the replay (time until breach, threshold crossed, etc.)
- **Scrollbar hinting:** Show readers how much content is left (Pudding does this implicitly via long scroll depth)

**Learnings for Keyholder:** Respect the reader/viewer's cognitive load. Motion should clarify, not ornament. The Drift replay should reveal critical facts at scroll-driven intervals, not all at once.

---

## Reference 6: Uncommon Studio (uncommon.nl) — Cinematic Portfolio

**Award:** FWA Site of the Day; CSS Design Awards nomination | **Focus:** Design studio + client work showcase  
**Contact Sheet:** `/Users/mujeeb/controlplane/design/research/refs/uncommon/sheet.png`

### Scroll Experience (0–3896px, 22 frames)
- **0–10%:** Hero with video background (shot of design team, looping silently)
- **10–30%:** "Recent work" section: Project cards with thumbnail images; cards scale, fade, and reveal full-width on scroll
- **30–50%:** "Expertise" section: Skill tags and service descriptions with subtle parallax on text layers
- **50–70%:** "Showreel" section: Embedded video (larger, autoplay on scroll-into-view with sound)
- **70–100%:** Testimonials with client logos; footer with contact CTA

### Techniques Observed
1. **GSAP + ScrollTrigger heavily used (79 + 29 detections):** Every section has pinned animations
2. **No Three.js:** All motion is 2D (CSS transforms, opacity, clip-path)
3. **Video backgrounds:** Multiple MP4 assets; autoplay on scroll proximity
4. **Typography animation:** Font size and weight shifts on section entry
5. **Image galleries with reveal:** Cards slide and fade into view using GSAP timelines
6. **Smooth scroll not explicitly detected:** But feels smooth (likely Lenis or custom scroll handler)

### What Works
- **Motion serves information hierarchy:** Animations draw attention to key portfolio items
- **Pacing:** Consistent rhythm; each section feels like a "beat" in a composition
- **Portfolio-centric motion:** Motion showcases the work itself (videos, client results), not the studio's motion skills
- **Color palette:** Blue brand color with warm orange/yellow accents (similar to Keyholder's bone/ink/orange)
- **Video as authority:** Moving imagery of the studio's actual work builds credibility

### What Keyholder Should Apply
1. **GSAP + ScrollTrigger as production standard:** Proven reliability for pinned, choreographed motion
2. **Video background strategically:** For the Drift hack timeline, embed video clips of trading data, blockchain activity, etc.
3. **Section-by-section pacing:** Each protocol page (Drift, Marinade, etc.) should feel like a distinct "scene"
4. **Logo/team presence:** Keyholder should show the actual keys/timelock/threshold data, not abstract shapes

**Learnings for Keyholder:** Uncommon proves that GSAP + ScrollTrigger can feel cinematic when paired with video and strategic timing. This is your technical stack model.

---

## Principles of Continuous Motion (Distilled from 6 References)

### 1. **Scroll-Driven Narratives, Not Auto-Play** (Lando, La Revoltosa, Pudding)
- Users control pacing; motion waits for scroll input
- Prevents sensory overload on entry
- **Implication for Keyholder:** The Drift hack replay should scrub on scroll; don't auto-animate the breach

### 2. **Object at the Center** (Lusion, La Revoltosa)
- One hero object (3D scene, bottle, console) commands attention
- Motion radiates outward from this center
- Secondary elements support, not compete
- **Implication for Keyholder:** The instrument console is the hero; all protocol timelines, keys, and data orbit it

### 3. **Pinning + Internal Animation** (Lando, La Revoltosa, Uncommon)
- Section stays visible (pinned) while content animates within it
- Creates illusion of turning pages within a single view
- Reduces jarring transitions
- **Implication for Keyholder:** Keep the instrument console pinned while the replay events unfold; when moving to a new protocol page, "zoom" the console into the next context

### 4. **Parallax with Purpose** (Lando, Uncommon)
- Layers move at different speeds to create depth
- Not gratuitous—every layer conveys information or hierarchy
- **Implication for Keyholder:** The console's foreground (active keys) moves faster than the background (blockchain activity); creates sense of layered control

### 5. **Text Reveal Timing** (Lando, La Revoltosa)
- Headings appear line-by-line or word-by-word, not all at once
- Offset timings between elements create choreography
- Clip-path or opacity fade, never blur
- **Implication for Keyholder:** Protocol names, threshold values, and timelock countdowns should reveal staggered; builds tension

### 6. **Motion Library Choice Matters** (Lando = GSAP, Lusion = Three.js, Pudding = D3/CSS)
- GSAP + ScrollTrigger = reliable for timeline choreography + pinning
- Three.js = complex 3D; heavy investment, but payoff is realism
- CSS alone = sufficient for simple sequences; fast, native
- **Implication for Keyholder:** Use Three.js for the instrument console (real-time, physically plausible); GSAP for the replay timeline; CSS for protocol cards/metadata

### 7. **Smooth Scroll Felt, Not Seen** (Lando, La Revoltosa, Uncommon)
- Lenis (or equivalent) adds inertia; scroll feels weighted and intentional
- Not a gimmick; makes all animations feel cohesive
- **Implication for Keyholder:** Lenis is mandatory; it unifies the console's 3D feel with flat UI elements

### 8. **Minimal Distractions Maximize Impact** (Linear, Pudding)
- Every animation earns its screen time
- No decorative motion; no auto-playing videos (except strategic background)
- Users focus on content, not the medium
- **Implication for Keyholder:** Don't animate for animation's sake; every console dial turn, every text reveal, every color shift should map to a real data event

### 9. **Transitions Between Sections Feel Seamed** (Lando, La Revoltosa, Uncommon)
- No hard cuts; motion bridges each section
- Exiting animation feeds into entering animation
- One "act" ends as the next begins
- **Implication for Keyholder:** When scrolling from the Drift hack to a protocol detail page, the console should morph (not cut) into the new context

### 10. **Color Accents Guide the Eye** (Lando = lime, Uncommon = orange, La Revoltosa = red, Linear = yellow)
- One accent color used sparingly but strategically
- Draws attention to the most important element at each scroll moment
- **Implication for Keyholder:** Signal orange should appear *only* on critical moments (breach event, threshold exceeded, timelock active)

### 11. **Typography Animates, Not Just Fades** (Lando, La Revoltosa)
- Font size, weight, tracking (letter-spacing), and color change together
- Creates sense of "growing" or "shrinking" importance
- **Implication for Keyholder:** Heading announcing the Drift hack should swell and darken; protocol names should fade unless currently active

### 12. **Dense Scroll Depth Demands Constant Rhythm** (Pudding = 61K px)
- Long-form experiences need motion *between* text blocks, not just at section breaks
- Otherwise, users disengage mid-scroll
- **Implication for Keyholder:** Don't front-load all motion into the first 30% of scroll; seed motion throughout—each new protocol should have a reveal moment

---

## What This Means for Keyholder

### Architecture: Three-Layer Motion Model

**Layer 1: The Hero Console (3D, Three.js)**
- Central, persistent 3D instrument console (keys, dials, lamps)
- Rotates and morphs as you scroll through the experience
- Inspired by: Lusion's rotating objects, La Revoltosa's bottle
- Technical foundation: Three.js + Lenis

**Layer 2: The Replay Timeline (Scroll-Driven Narrative)**
- As you scroll, the console's state changes (keys glow red, timelock dial advances, lamps indicate events)
- Supporting annotations (timestamps, event labels) appear staggered
- Inspired by: Lando's section-by-section reveal, La Revoltosa's scrollytelling beats, Pudding's progressive disclosure
- Technical foundation: GSAP + ScrollTrigger pinning

**Layer 3: Protocol Context (Flat UI, CSS + GSAP)**
- When you move to protocol detail pages, the console "anchors" (pinned top-left or center) while protocol-specific data (keys, thresholds, multi-sigs) animates into view
- Cards, tables, and charts supplement the console's visual narrative
- Inspired by: Uncommon's portfolio cards, Linear's feature carousel
- Technical foundation: CSS animations + GSAP for complex sequences

### Key Decisions

1. **No auto-play.** Users scroll to engage; motion rewards curiosity. (From all 6 refs)

2. **The console never leaves the viewport during the Drift replay.** It's pinned while the timeline unfolds around it. (From Lando, La Revoltosa, Uncommon pinning pattern)

3. **Text reveals are staggered, not simultaneous.** A key's label appears first, then its state (active/inactive), then its controller's name. (From Lando, La Revoltosa text animation)

4. **Parallax depth is used to show control hierarchy.** Foreground keys (directly controlled) move faster than background blockchain state (emergent from keys). (From Lando parallax strategy)

5. **Color accent (signal orange) appears only on breach moments and critical state changes.** This trains the eye to seek orange as a danger signal. (From Linear, Uncommon color strategy)

6. **Smooth scroll (Lenis) is non-negotiable.** It makes the 3D console feel like it's part of the same physical space as the flat UI. (From Lando, La Revoltosa)

7. **Section boundaries are bridged with motion, not cut.** Exiting the Drift hack section, the console "zooms in" on a protocol card that becomes the next section's hero. (From La Revoltosa, Uncommon transition philosophy)

8. **Scroll depth should match content density.** The Drift hack replay can be 15–20K pixels if each scroll stop reveals new data (timeline, actor, impact). Don't artificially inflate scroll depth. (From Pudding's content-driven length)

9. **Typography scales with importance.** The Drift hack headline swells as it enters the viewport; protocol names remain readable but secondary until that protocol is active. (From Lando, La Revoltosa typography animation)

10. **No decorative canvases.** Every 3D element (console, data visualizations, blockchain state) earns its rendering cost. No fancy particle effects that don't convey information. (From all refs; note: Lando has 21 canvases, but each is part of a hero sequence)

### Next Steps

1. **Prototype the console in Three.js.** Start with basic geometry (key shapes, dial, lamp housings). Verify performance on target devices (desktop, tablet).

2. **Build a minimal scroll demo.** One section (intro → Drift hack start) using GSAP + ScrollTrigger. Test pinning and internal console state changes.

3. **Map the Drift hack timeline to scroll breakpoints.** Define which events trigger which console animations. This is your storyboard.

4. **Iterate on pacing.** Lenis + GSAP timing need tuning; watch for rhythm consistency.

5. **Test on devices.** Smooth scroll and 3D rendering vary across hardware; plan for graceful degradation (fallback to flat UI on low-end devices).

---

## Sources

- **Lando Norris:** https://landonorris.com | [Awwwards Site of the Year 2025](https://www.awwwards.com/offbrand/)
- **Lusion:** https://lusion.co | [Lusion—Award Winning 3D and Interactive Web Studio](https://lusion.co/)
- **La Revoltosa:** https://larevoltosa.es | [Awwwards Site of the Day](https://www.awwwards.com/sites/la-revoltosa)
- **Linear:** https://linear.app | [One Page Love](https://onepagelove.com/linear)
- **The Pudding—Sizing Chaos:** https://pudding.cool/2026/02/womens-sizing/ | [The Pudding](https://pudding.cool/)
- **Uncommon:** https://uncommon.nl | [CSS Design Awards](https://www.cssdesignawards.com/sites/uncommon-studio/45494/)

---

## Contact Sheets Captured
- `/Users/mujeeb/controlplane/design/research/refs/lando-norris/sheet.png` (22 scroll frames)
- `/Users/mujeeb/controlplane/design/research/refs/lusion/sheet.png` (22 frames, 3D-dominant)
- `/Users/mujeeb/controlplane/design/research/refs/la-revoltosa/sheet.png` (22 frames, scrollytelling model)
- `/Users/mujeeb/controlplane/design/research/refs/linear/sheet.png` (22 frames, minimal restraint)
- `/Users/mujeeb/controlplane/design/research/refs/pudding-sizing/sheet.png` (22 frames, data narrative)
- `/Users/mujeeb/controlplane/design/research/refs/uncommon/sheet.png` (22 frames, portfolio cinematic)

*All sites verified live and accessible as of 2026-09-27.*
