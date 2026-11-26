---
title: 'Clock hugs the screen edge; bounces flush; drift on both axes'
type: 'bugfix'
ticket: ''
created: '2026-11-26'
status: 'built'
baseline_revision: 'a8ad8c1'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'none'
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '_bmad-output/plan-clock-edge-fit-and-random-bounce.md'
  - '_bmad-output/plan-drift-budget-margin.md'
  - '_bmad-output/plan-safe-area-context-migration.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The time text sat in the safe-area box with a half-inch travel margin per side, so a large gap of screen between the text and the edge made the clock read as small and nearly motionless; as the margin was shrunk toward ink-only, the binding axis came out with a zero bounce range — the drawn box fills the window to within the ink slack, so xRange or yRange is 0, that axis is pinned at centre and the clock visibly moved along only one axis.

**Approach:** Fit the digits to the whole window — safe-area insets deliberately dropped: the face is sized to hug the screen edge, notch and home indicator included — inset by a small per-side travel room on top of the ink slack (8dp per side) so both axes carry a real bounce range. The walls stay derived from the real laid-out extent (unchanged), so a leg still lands the text flush on the screen edge and only then bounces.

## Boundaries & Constraints

**Always:** Font size stays a pure function of the `MEASURE_SIZE` probe — no feedback from the laid-out row into size; walls stay extent-derived (`max(nominal, row-reported)`) with the 1dp ink slack; text never draws past the screen edge; existing bounce machinery in `clockMotion.js` unchanged.

**Never:** No laid-out extent feeding font size; no size distortion to fill the free axis; no new dependencies; no change to chime, seconds-chip or daily-font logic.

**Note:** Human renegotiated, this session — the half-inch margin intent (`plan-clock-max-font-scaling`, `plan-drift-budget-margin`, `plan-small-screen-font-fill`, `plan-proportional-travel-margin`, `plan-clock-bounce-edge-and-font-fit`) and the safe-area motion-box intent (`plan-safe-area-context-migration`) are superseded by this plan. Do not re-apply them.

</frozen-after-approval>

## Code Map

- `App.js` L184-222 -- constants block: `INK_SLACK = 1`, `TRAVEL_ROOM = 8`, `travelMargin()` = 9dp per side; `UNKNOWN_EXTENT_SLACK = 4` unchanged (probe-box walls before the row reports).
- `App.js` ~L345-355 -- `motionBox` = whole window (`useSafeAreaInsets()` removed, insets subtracted nowhere).
- `App.js` ~L365-369 -- `fitWidth`/`fitHeight` = window inset by `2 * travelMargin()`.
- `App.js` ~L1375+ -- outer digits `View` positioned off the full window, no `insets.left/top` offset.
- Walls (`xRange`/`yRange` via `motionRanges`) unchanged — already extent-derived; bounce itself unchanged.

## Implementation Notes

- 2026-11-26, round 1: margin scaled to ~1/3 of the old formula (80/3 ceiling, 2% share, 8dp floor, cap 6.7%) — visible gap persists per the user, so revisited.
- 2026-11-26, round 2: honest per-side gap — `ink slack + minimal travel (1+4dp)` with a degenerate-window guard — still not small enough per the user.
- 2026-11-26, round 3: ink-only gap + full-window motion box (insets dropped) — text hugged the screen, but the binding axis pinned (range 0 → only one axis moved).
- 2026-11-26, round 4 (final): both fixes — full window with a small travel room. `TRAVEL_ROOM = 8` keeps the binding axis at ~8dp of wall room (leg crosses it in seconds at the current drift speed); the free axis keeps its aspect-limited leftover. The resting gap is the one honest gap left between the text and the screen.
- Round-4 geometry, portrait 393x852 (~2:1 string): text ~375x100, gap 9px x / 376px y, ranges 8 / 375. Landscape 852x393: text ~834x222, gap 9px x / 85px y, ranges 8 / 84.
- Design limit worth knowing: a single scalar font cannot fill both axes of a screen whose aspect differs from the time string's; the free axis's resting gap is aspect-set and cannot be shrunk without distorting the text. The binding axis is the one that can be squeezed, and 8dp is the minimum that keeps the drift real.
- Review note: the bounce walls derive from the drawn extent, NOT from the fit box, so the clamped bounce still lands flush at the edge regardless of which margin made the font smaller.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: no errors.
- `npx jest` -- expected: 75/75 (clockMotion.test.js at the 1/3 dp/s speed the suite is designed for).

**Manual checks (device/simulator):**
- Text nearly fills the screen; resting gap ~9dp on the binding axis (free axis keeps its aspect-limited leftover).
- Clock drifts along BOTH axes; a leg lands the text flush on the screen edge and only then bounces.
- Binding axis visibly bounces between walls (~8dp); free axis sweeps through the leftover; no part of the row ever draws past the screen edge.
