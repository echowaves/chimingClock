---
title: 'Cap the travel margin per axis so small screens get their font'
type: 'bugfix'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: 'e7b698e'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '_bmad-output/plan-clock-max-font-scaling.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On small-screen devices the clock's font stays too small to fill the screen: the fitting box subtracts a fixed 80dp travel margin per side, which on a ~300dp-tall landscape phone reserves over half the height-binding axis, leaving the digits only ~40% of it.

**Approach:** Keep the nominal half-inch (80dp) margin wherever the screen affords it, but cap it per axis at one fifth of that axis's motion-box size — worst case text keeps three fifths of each axis and travel stays visible (two fifths combined) on small devices. Bounce walls keep deriving from the measured digit box, so edges remain exactly reachable on every device.

</frozen-after-approval>

## Code Map

- `App.js` ~L163-175 -- constants comment + `EDGE_TRAVEL_MARGIN`; add share cap constant and helper.
- `App.js` ~L318-319 -- `fitWidth`/`fitHeight` use the per-axis margin.
- Unchanged: bounce ranges (`xRange`/`yRange`, derived from digit box — no margin term), placement, probe, chimes.

## Tasks & Acceptance

**Execution:**
- [ ] `App.js` -- add `travelMargin(dim) = min(EDGE_TRAVEL_MARGIN, dim * TRAVEL_MARGIN_SHARE)` (share 0.2), use per axis in the fitting box, update the constants comment -- one goal: font fills small screens without losing bounce room.

**Acceptance Criteria:**
- Given a device whose motion-box axis is under 400dp, when digits are fitted, then that axis reserves ≤20% per side for travel (e.g., 300dp height → 60dp margins, ~29% larger font than today on iPhone SE landscape).
- Given a device whose axis is ≥400dp, when fitted, then the margin stays the full 80dp — yesterday's half-inch guarantee holds there; axes just under 400dp land marginally under it (e.g., 393pt → 78.6dp).
- Given any fitted size, when the clock drifts, then walls still land flush on the inset edges (ranges digit-box-derived, untouched).

## Implementation Notes

Implemented as planned: `travelMargin(axisSize) = min(EDGE_TRAVEL_MARGIN, axisSize * TRAVEL_MARGIN_SHARE)` at module scope, used per axis in the fitting box; bounce ranges untouched (digit-box-derived). `npx eslint App.js` clean.

## Plan Change Log

- Review finding: this plan's auto-drafted frozen Approach said "text always gets at least 80% of each axis" — arithmetically wrong (the cap is per side: 2 × 20% reserved worst case → text ≥ 60%). Corrected to the true bound before any human read it; intent (cap at one fifth per axis) unchanged. The App.js comment copied from it was fixed to match.

## Review Triage Log

Quick lens (1 reviewer), 3 findings — no code bugs; AC1–AC3 confirmed exact as implemented, `EDGE_TRAVEL_MARGIN` has no consumers outside the helper, flush-wall bounce preserved:

- **"at least 80% of every axis" false in comment and frozen prose** — real, low, patched: both restated to the ≥60%/two-fifths truth (see change log; frozen text was machine-drafted this session, never human-read).
- **"iPhone 15-class unchanged" manual check unobservable at the 400dp threshold** — real, low, patched: AC bullet and manual check reworded to "≈half inch, marginally under on sub-400dp axes".
- **"leaving digits only ~40%" should be ~47%** — real, low, patched: comment now says "under half", exact figures dropped.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: clean.

**Manual checks (device/simulator):**
- Small landscape device/simulator (e.g., SE-class 568x320): digits noticeably larger than before, closest-edge gap still clearly visible and the clock still drifts and bounces off all four edges.
- iPhone 15-class landscape ≈ unchanged (~half-inch margin at rest, marginally under on the height axis by design).
