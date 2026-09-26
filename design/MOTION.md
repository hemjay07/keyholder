# MOTION (project-level; MOTION-RULES.md is the kit-level law)

easings (1, named, matches design/TOKENS.css --ease-1):
- primary: cubic-bezier(0.2, 0.7, 0.2, 1) — used for every transition below

durations (design/TOKENS.css): tick 90 ms, element 240 ms, data 320 ms, count 1400 ms; cap 1600 ms

transitions, each with its cause (which data or state change it renders):
- console key turn (element, 240 ms, ease-out-back): a key slot renders `turned` when the
  live threshold includes that slot — the turn is the read resolving, not decoration.
- console timelock needle (data, 320 ms, ease-out-cubic): the needle settles from a parked
  full-sweep position to the live `timelockSeconds` value read from the API.
- console lamp fade (tick, 90 ms, linear): the WEAKENED / VERIFIED lamps step from off to
  their live emissive value once their data has arrived.
- hero headline rise (element, 240 ms, ease-1): the h1 renders in place, translated up from
  10px — the entrance of the page's one real claim, not a repeated micro-interaction.
- CTA hover (tick, 90 ms, ease-1): background/colour swap on `.cta a:hover`, no cause beyond
  interaction feedback (kit rule 1, not a data render — kept under the tick duration).

Under `prefers-reduced-motion: reduce`: the console lamp/needle land at their final values on
mount (frameloop stays on-demand, no interval), the h1 does not animate in, and no content is
hidden while motion is off (rule 4/6, MOTION-RULES.md).
