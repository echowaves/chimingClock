---
title: 'Travel margin becomes an explicit drift budget: 6% of axis, floor 24dp'
type: 'feature'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: 'efa98c5'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '_bmad-output/plan-proportional-travel-margin.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Even with the proportional margin, small devices reserve 10% of each axis per side for travel — but the margin never gates the bounce (walls always sit flush on the motion-box edges); it only sizes the font and sets the drift distance. The user wants text as large as possible for distance viewing, keeping only enough room that the clock visibly drifts and bounces.

**Approach:** Re-purpose the margin as an explicit drift budget: 6% of the axis (floor 24dp, unchanged half-inch ceiling), which at the current 1dp/s drift still means ~15–30 s per wall before a bounce on phones. Fonts grow another ~7–10% on sub-800dp axes (SE-class width fit ≈ +10%, iPhone-15-class ≈ +10%); large devices unchanged; no axis can regress versus the current formula.

</frozen-after-approval>

## Code Map

- `App.js` L163-197 -- constants block: share 0.1→0.06, floor 28→24, comment recast as drift budget (walls flush regardless; margin sizes font + drift only).
- Untouched: travelMargin shape (ceiling/floor-cap guards), fitting box consumers, ranges, placement, probe.

## Tasks & Acceptance

**Execution:**
- [x] `App.js` -- two constants + rationale comment -- one goal: text as big as possible with just-liveable drift.

**Acceptance Criteria:**
- Given SE-class landscape (568×320), when fitted, then width reserves ~34dp/side (fit box ~500 vs 454 today) — font ≥ +9% over baseline efa98c5.
- Given any axis ≥1334dp, when fitted, then the margin stays exactly 80dp; axes between 400 and 1333dp take 6% of themselves.
- Given any ordinary phone axis, when drifting, then each axis's binding wall is reached within ≤ ~45 s of drift from centre (on the font-capping axis range = margin − INK_SLACK ≥ 20dp at 1dp/s; the roomier axis sweeps longer — its range comes from the digit box), bouncing flush as before.

## Implementation Notes

- Share 0.1→0.06, floor 28→24; ceiling and floor-cap untouched. Node check across axes 40–1400: the new margin is never larger than the old anywhere ⇒ fit boxes only ever grow (zero font regression by construction). Gains: +6.3% at 320, +10% at 568/726, +9.6% at 812, +6.2% at 932, +3.3% at 1080, 0% at 1366.
- Degenerate axes (<120dp) reduce to the floor-cap branch `0.2a` in both formulas — bit-for-bit unchanged split-screen behaviour.
- Reviewer correction applied: drift time-to-wall ≈ margin − INK_SLACK only on the font-capping axis; the other axis's range is `(box − extent)/2 − INK_SLACK` and can be minutes. Comment scoped accordingly.

## Plan Change Log

- 2026-11-04 (post-review): ACs corrected — ceiling binds at ≥1334dp (not 800; that was the old 10% share), and the ≤~45 s drift bound qualified to each axis's binding direction. Quick-lens findings, no deviation from frozen intent.

## Review Triage Log

- Quick lens (Explore subagent, pinned): 3 findings —
  1. **Medium** plan AC "margin stays 80dp at ≥800dp" stale under 6% share (contradicts code's correct ~1334dp). → Patched: AC rewritten to ≥1334dp.
  2. **Low** new App.js comment claimed "~20–30 s a wall on handhelds" — true only for the font-capping axis; the other sweeps minutes. → Patched: comment scoped to the binding axis.
  3. **Low** same overreach in AC 3. → Patched: qualified to binding direction, ≤~45 s.
  Reviewed-and-dismissed: no consumer assumes margin ≥ 28 (travelMargin feeds only fitWidth/fitHeight; FontProbes measure at fixed MEASURE_SIZE and are unaffected); guess fallback unaffected (fitted sizes only grow); floor 24 > INK_SLACK + step ⇒ range ≥ 20 always.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: clean.
- Node check of travelMargin across axes 40–1024: never below the previous formula's reserve (no font regression anywhere), ~+9% fit box at 320/568/726.

**Manual checks (device/simulator):**
- Small landscape simulator: digits larger again, still not touching edges at rest; drift reaches and bounces flush off all four edges.
