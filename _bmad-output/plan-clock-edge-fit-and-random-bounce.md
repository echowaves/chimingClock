---
title: 'Walls from the real drawn box, plus a randomized bounce angle'
type: 'feature'
ticket: ''
created: '2026-11-26'
status: 'built'
baseline_revision: '2098dce0b49af4cf0a64dfe8300201123fe98fe1'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Travel walls come from a hidden probe's *advance* metrics for the whole `h:mm` string, but what draws is three separate `Text` elements whose laid-out row can be wider than that box, plus ink that spills past the advance box on script faces. So a wall can be set from a box smaller than what is on screen, with `INK_SLACK = 4` as the only thing between digits and an edge — yet 4dp of permanent gap is more than wanted when nothing is near the edge. Separately the path is locked: both axes carry one step magnitude and a bounce flips a single sign, so the same 45° rectangle repeats forever.

**Approach:** Measure what was actually laid out (the clock row's own layout box) and drive walls from `max(nominal box, real box)`, which makes "bounce exactly when the drawn message would touch the edge" computable and lets the edge gap shrink to ink only. Replace the two scalar step states with one constant-speed unit direction that reflects at each wall with exact landing (overshoot carried into the reflected leg) and draws a fresh random angle on every bounce, pointing away from the walls just left.

## Boundaries & Constraints

**Always:** Keep `DRIFT_STEP` as the velocity magnitude so drift stays below the eye's tracking threshold; keep font fitting exactly as today (a pure function of the `MEASURE_SIZE` probe); keep every edge reachable on both axes; put new math in a React-free module with jest coverage, following `soundGating.js`/`fontSelection.js`; never store or draw a shift outside its wall.

**Never:** No feedback from laid-out extent into font size — size must stay a pure function of probe metrics, or layout and fitting become mutually recursive; no rewrite to `Animated`; no new dependencies; do not touch `travelMargin`, the seconds chip geometry, or chime logic.

## I/O & Edge-Case Matrix

For `advanceMotion(motion, walls, rand)` → `{x, y, ux, uy}`.

| Scenario | Input / State | Expected Behavior | Error Handling |
|---|---|---|---|
| Mid-air step | pos + step inside both walls | advance exactly `DRIFT_STEP`; direction unchanged | No error expected |
| Single wall hit | one axis would pass its wall | land exactly on the wall, reflect that component, carry overshoot along the new direction, draw one new angle in the quadrant away from both walls | — |
| Corner hit | both axes pass their walls in one step | both components reflected, only one new angle, position inside both walls | Bounded reflection loop (≤3) so a near-zero range cannot spin |
| Degenerate axis | `range = 0` on an axis | that coordinate pinned at 0; the other keeps ≥ `sin(MIN_ANGLE_DEG)` of the speed so motion never stalls | Zero-length direction guarded, never NaN |
| Wall shrinks mid-flight | stored \|pos\| > new range | clamped to the new wall that same tick, before stepping; no jump beyond one step | — |
| Bad randomness | `rand` non-finite or outside [0,1) | keep the previous angle rather than propagate NaN | Falls back silently |

## Decisions

- 2026-11-26: fitting scope is **walls only**. `fittedFontSize` and the probe stay exactly as they are; bigger text via ink-height fitting was considered and explicitly deferred. This change's gain is a smaller edge gap and correct walls, not larger digits.
- 2026-11-26: plan kept at full length (~2000 tokens) by human choice over the 1600 guideline; no goal is independently shippable, so splitting would only cut content.
- 2026-11-26: `MIN_ANGLE_DEG = 3`, not the ~20° first drafted — the human wants legs that travel almost parallel to an edge. Accepted cost: a grazing leg can take tens of minutes to reach the next wall on that axis, and its off-wall axis contributes only ~5% of the speed (still nonzero, so motion never stalls).

</frozen-after-approval>

## Code Map

- `App.js` L222 `INK_SLACK = 4`, L228 `DRIFT_STEP`, constants comment L185-229 — the walls' only safety margin; the comment describes the locked 45° sweep and must be reworded for a random angle.
- `App.js` L382-386 — four states (`xStep`, `yStep`, `xShift`, `yShift`) → one motion state `{x, y, ux, uy}`.
- `App.js` L753-780 — per-second bounce effect and its local `nextShift`; becomes one call into the new module, one state write. Keep reading ranges from render scope so walls and placement cannot disagree.
- `App.js` L637-641 — `xRange`/`yRange`/`clamped*Shift`: extent source changes from `digitWidth/digitHeight` to true extent. Placement L1348-1352 already consumes the clamped values; keep it doing so.
- `App.js` L1355-1361 — the clock row `<View flexDirection:'row'>`: add `onLayout` here. It has no fixed size, so Yoga reports the real laid-out row box; the outer digits box (L1343-1352) is sized from metrics and would only echo them back.
- `App.js` L507-578 — `digitMetrics`, `onMeasureDigits`, `fittedFontSize`, `digitWidth/Height`: reuse as nominal extent; layout must never influence size.
- New `clockMotion.js` + `__tests__/clockMotion.test.js` — mirror `soundGating.js` and its test (jest `testEnvironment: 'node'`, no RN imports, one `describe` per matrix row).

## Tasks & Acceptance

**Execution:**
- [x] `clockMotion.js` — create `motionRanges(box, extent, inkSlack)` and `advanceMotion(motion, walls, rand)`: exact-wall landing, corner handling, inward-pointing angle within `[MIN_ANGLE_DEG, 90 - MIN_ANGLE_DEG]`, non-finite-`rand` fallback.
- [x] `__tests__/clockMotion.test.js` — one `describe` per matrix row; inject a stubbed `rand` so both determinism and randomness are provable.
- [x] `App.js` — wire: single motion state; `onLayout` extent state keyed to font+string with a >0.5dp change threshold so layout churn cannot loop; walls from true extent; smaller `INK_SLACK` now the real box is known; constants comment rewritten.

**Acceptance Criteria:**
- Given any font, time string and window, when the clock drifts across many legs, then no part of the laid-out row lies outside `motionBox` — each wall is `(box − extent)/2` with `extent ≥` the row's own reported layout size.
- Given a step that would pass a wall, when that tick lands, then the coordinate sits exactly on the wall and the outgoing leg leaves at a new angle inside the allowed band, velocity magnitude still `DRIFT_STEP`.
- Given different stubbed `rand` values, when the same motion is stepped, then resulting slopes differ; given the same stub, results are identical — randomness is injected, not hidden.
- Given a font swap or minute change that shrinks a wall mid-leg, when the next tick runs, then the shift is inside the new wall and no coordinate moves more than one step per tick.
- Given identical probe metrics and window, `fittedFontSize` is bit-for-bit what it was at `baseline_revision`.

## Implementation Notes

- `DRIFT_STEP` and `MIN_ANGLE_DEG` live in `clockMotion.js`, not `App.js`. The plan's
  signature `advanceMotion(motion, walls, rand)` takes no step argument, so the speed has
  to be readable where the maths is; importing it back into `App.js` from there would
  close a cycle. `App.js` imports only `advanceMotion` and `motionRanges`.
- `INK_SLACK: 4 → 1`. The plan asked for "ink only" without naming a number; 1dp covers
  the antialiasing at the boundary plus the ink that spills past a layout box, and it was
  chosen so the gain is visible while a glyph still cannot touch an edge. It is one line
  to move if a device check says otherwise.
- `alignSelf: 'center'` on the clock row is a prerequisite, not cosmetics. Its parent has
  no `alignItems`, so Yoga's default `stretch` would size the row to the outer metrics box
  and `onLayout` would only echo that box back — exactly the thing the plan rules out.
  Centring is unchanged (parent centring plus the row's own `justifyContent: 'center'`),
  and it keeps the row's centre on the point the walls are measured from, which is what
  makes `(box − extent) / 2` describe the drawn rectangle.
- The wall-shrink clamp is an inward correction to the wall, not travel: `advanceMotion`
  pulls a stale shift onto the new wall first and only then steps, so the tick adds one
  step's worth of path beyond that correction and never throws the shift to the opposite
  wall the way the old `[-DRIFT_STEP, range]` return did.
- A bad `rand` keeps the previous angle's magnitudes but still turns its signs away from
  the wall just touched; keeping the old signs too literally would hit the same wall on
  every later tick forever.
- Pinned axes (`range = 0`) never register a hit, so they neither bounce nor spend the
  angle budget; their coordinate is held at 0 and the free axis carries only its own
  cos/sin of the leg — as little as ~5% of `DRIFT_STEP` at the band edge, but never zero.

## Plan Change Log

- 2026-11-26: implemented as planned; no change to the frozen intent. Choices the plan
  left open are recorded in Design Notes / Implementation Notes above.

## Review Triage Log

Quick lens (context-free subagent, pinned): 0 high, 0 medium, 2 low, 1 false, 3 maybe-false.

- `App.js` L691-704 — **low / patch** — PATCHED: extent fell back to the nominal probe box with only 1dp slack whenever `rowExtent.key !== metricsKey`, which is every minute change and daily font swap, so an edge cost 1dp precisely when nothing was known about the real row box. Fixed by reserving `UNKNOWN_EXTENT_SLACK` until a matching report arrives.
- `clockMotion.js` pinned-axis comment — **low / patch** — PATCHED: comment claimed a zero-range axis "leaves the other axis the whole speed"; that axis moves by its own cos/sin of the leg, ~5% at the band edge. Comment corrected here and in the module.
- `clockMotion.js` corner detection via `|timeX - timeY| <= 1e-9` — **false** — rejected on refutation: a same-tick double reflection is not a defect, because each bounce lands exactly on the wall it reaches and leaves pointing off it; position stays inside both walls (asserted by `reflects both components and stays inside both walls`), speed is conserved across the sub-bounces, and two angle draws inside one second are indistinguishable at 1/3 dp/s. The matrix row describes a simultaneous corner — which the code handles with a single angle — not an obligation to merge two wall arrivals at different instants.
- `clockMotion.js` zero-length landing consuming the ≤3 bounce budget — **maybe-false, would be low** — a tick can spend iterations on `time === 0` reflections and travel under one step that second. Settled by a device check of one second's movement after a font swap; invisible at 1/3 dp/s either way.
- `clockMotion.js` pinned-axis speed share — **maybe-false, would be low** — while an axis has range 0 its share of the speed is given up, so a tick covers less ground for as long as text fills that axis. Settled by a device check on a small window; the free axis still advances every tick.
- `App.js` `ROW_LAYOUT_EPS = 0.5` ignoring growth below the threshold — **maybe-false, would be low** — a wall could sit up to 0.25dp too far out on that axis. Settled by a device check of edge contact on a face whose row width hovers near the metrics box; the 0.5dp threshold itself is required by the task list to stop layout churn looping.
- `App.js` tick reading one-render-stale walls when `rowExtent` settles mid-second — **maybe-false, would be low** — placement clamps with fresh walls so nothing draws outside, and a stale wall is strictly tighter than the current one (extent only grows once known), so the worst case is a bounce marginally early. Settled by observing bounce position across a font swap.

## Design Notes

```js
const theta = MIN_ANGLE + rand() * (90 - 2 * MIN_ANGLE) // deg from the axes
const rad = (theta * Math.PI) / 180
// sx/sy are ±1: away from the wall that axis just hit (else its current sign)
return { ux: sx * Math.cos(rad), uy: sy * Math.sin(rad) }
```

`MIN_ANGLE_DEG = 3` keeps a leg off being perfectly axis-aligned — at exactly 0° the perpendicular axis would stop moving for good — while still allowing a graze that runs almost parallel to an edge, which is wanted. Consequences worth knowing: such a leg's next wall on the grazing axis can be tens of minutes away, and its inward axis carries only ~5% of the speed, so it must never be rounded to zero. Landing *on* the wall rather than clamping an overshoot is what lets the edge gap come down: the position is never merely near the wall, so nothing but ink slack needs reserving.

## Verification

**Commands:**
- `npx jest __tests__/clockMotion.test.js` -- expected: all new tests pass.
- `npm test` -- expected: new suite plus existing `fontSelection`/`soundGating` pass.
- `npx eslint App.js clockMotion.js` -- expected: no errors.

**Manual checks:**
- Watch a minute of drift on device: each leg leaves the wall at a visibly different angle, speed still reads as resting, digits tight to the edge on contact without touching it.
