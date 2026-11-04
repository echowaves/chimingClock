---
title: 'Make the travel margin proportional (10% of axis) so landscape phones fill'
type: 'bugfix'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: '283d171'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
context:
  - '_bmad-output/plan-small-screen-font-fill.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The clock font still under-fills small screens: the 20% margin cap only opened the *height* axis, but on a landscape phone the wide time string makes *width* the binding axis, and width kept reserving the full 80dp per side (0.2 × 568 > 80) — measured effect of the last fix: +1% font on iPhone-15-class, ~+10% on SE-class.

**Approach:** Make the travel margin genuinely proportional to each axis — 10% of the axis, floor 28dp (itself capped at a fifth of the axis so degenerate windows never regress), ceiling unchanged at 80dp (the user's half-inch is a maximum, not a minimum) — so the binding width axis finally releases room on small devices. Gains over baseline 283d171: SE-class +~11% for two-digit hours, up to +~28% when height had been binding (single-digit hours); iPhone-15-class +~6–14%; large devices unchanged. Bounce walls keep deriving from the measured digit box.

</frozen-after-approval>

## Code Map

- `App.js` L163-184 -- constants block: rewrite comment (binding-axis insight), `TRAVEL_MARGIN_SHARE = 0.2 → 0.1`, add `TRAVEL_MARGIN_FLOOR = 28` into `travelMargin`.
- Everything else untouched: fit box consumers, ranges, placement, probe, ink slack.

## Tasks & Acceptance

**Execution:**
- [ ] `App.js` -- proportional margin with floor + rewritten rationale comment -- one goal: the binding axis releases room on small screens.

**Acceptance Criteria:**
- Given SE-class landscape (568×320), when fitted, then each side reserves 10% of its axis (57dp/32dp), not 80/64 — fit box +11.4% wide, and taller where height binds.
- Given a degenerate axis (<140dp, e.g. Android split-screen), when fitted, then the margin equals the old proportional cap's (one fifth of the axis) — never worse than baseline.
- Given an axis ≥800dp, when fitted, then the margin stays exactly 80dp (half-inch ceiling holds on big screens).
- Given any device, when the clock drifts, then bounce walls stay flush to the motion-box edges and travel never vanishes (range ≥ 24dp from the floor minus ink slack).

## Implementation Notes

`travelMargin = min(80, max(min(FLOOR=28, 0.2×axis), 0.1×axis))` — piecewise: pure proportion ≤140dp, flat 28dp 140–280dp, 10% 280–800dp, half-inch ceiling ≥800dp. Width is the binding axis on landscape phones (string aspect ≈ screen aspect), so gains there are the width fit-box gain (+11.4% SE, +2.6% iPhone-15); where height had bound (single-digit hours, shorter strings) gains reach +28%. Ink-height (capHeight) fitting was considered and skipped: after this change virtually nothing is height-bound in a landscape-locked app, so it would add platform risk for ~0 gain.

## Plan Change Log

- Review finding: frozen Approach (machine-drafted, never human-read) promised "SE-class font +~25%" — only true where height had been binding; width-bound two-digit hours gain +11.4%. Corrected to the range before human review; code unaffected.
- Review finding: floor of 28dp could reserve >40% of a degenerate axis and regress fonts below 140dp vs baseline — floor capped at one fifth of the axis (`TRAVEL_MARGIN_FLOOR_CAP`); verified never-worse table across axes 40–1024dp.

## Review Triage Log

Quick lens (1 reviewer), 3 findings:

- **AC1's ≥+20% unreachable for width-bound hours** — real, low, patched: AC and frozen prose restated to +11.4% width-bound / up to +28% height-bound; code matches the intended mechanism.
- **Floor regresses degenerate axes (<140dp) and collapses fit box <56dp** — real, medium, patched: floor capped at 0.2×axis; node-verified no axis from 40–1024dp gets a smaller fit box than baseline (old collapse cases now match baseline's graceful degradation).
- **Comment claimed ~96% text share on large devices and four-fifths on small** — real, low, patched: ceiling actually leaves 80% at exactly 800dp (96% would need a 4000dp axis); comment restated to "~80% at the ceiling, never under three fifths".

## Verification

**Commands:**
- `npx eslint App.js` -- expected: clean.
- Margin piecewise verified post-patch by node one-liner: fit box never shrinks vs baseline on axes 40–1024dp; margins 8/11.2/20/28/28/32/56.8/72.6/80/80 at axes 40/56/100/140/200/320/568/726/800/1024.

**Manual checks (device/simulator):**
- Small landscape simulator: digits visibly larger than build 283d171, still not touching edges at rest, drift reaches and bounces off all four edges.
- iPad/simulator ≥800dp wide: size identical to before.
