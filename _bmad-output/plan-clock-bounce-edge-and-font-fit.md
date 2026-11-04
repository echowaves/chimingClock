---
title: 'Clock drift reaches every edge; font sizes to a half-inch travel margin'
type: 'bugfix'
ticket: ''
created: '2026-11-03'
status: 'built'
baseline_revision: 'ba7b573f37131a8121018529567c65904253f24c'
route: 'oneshot'
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

**Problem:** The drifting clock never touches the screen edges — it bounces a fixed 55px from centre while the fitting box reserves 63px per side, so at least ~8px (and far more on any axis where the digits are smaller than the reserved box, e.g. vertically in portrait) is permanently out of reach; on notched iPhones the `SafeAreaView` insets widen the top gap to ~67px, so the upper-left corner is never reached, and the fixed window-sized `Pressable` can even let digits clip at the bottom.

**Approach:** Measure the actual motion container (the safe-area box the clock draws in) and derive each axis's bounce range from the measured digit box, so at a drift extreme the text's layout box lands exactly on that edge — fully visible, edges and corners all reachable. Bounce with clamp-then-reverse so there is no overshoot past the edge. Size the font as large as the container allows minus a nominal half-inch travel margin per side (80dp), keeping room to move and bounce while staying inside the current `width / 3` ceiling.

</frozen-after-approval>

## Implementation Notes

Oneshot: single file (`App.js`), ~60 lines, mechanics fully determined by the investigation below.

Done as planned, all in `App.js`: constants replaced (L156-169), `motionBox` state + `onMotionLayout` added next to `useWindowDimensions`, fitting box now insets `motionBox` by `EDGE_TRAVEL_MARGIN`, the `[currentTime]` effect bounces with step-then-clamp against per-axis ranges derived from `digitWidth`/`digitHeight`, and the clock screen's `SafeAreaView`/`Pressable` switched to `flex: 1` with `onLayout` instead of fixed window size. Corner note: with both axes at 1px/s, exact simultaneous wall hits depend on range parity; ranges change every minute (time string width) and daily (font), so the drift sweeps within a pixel of the corners between edge touches — edges themselves are hit exactly every half period (verified by simulation: max/min reach ±range exactly, never beyond; a shift outside a shrunken range is clamped back inside on the next tick). `npx eslint App.js` clean.

Key facts from investigation:
- Constants `DRIFT_RANGE = 55` / `FIT_PADDING = 8` (App.js ~L158-159) drive both the fitting box (`fitWidth/fitHeight`, L293-295) and the bounce (`useEffect [currentTime]`, L505-517). Replace both.
- Digits are measured via `onTextLayout` probe at `MEASURE_SIZE = 40`; `digitMetrics` → `digitFontSize`, `digitWidth`, `digitHeight` (L402-437). This machinery stays — it is the "better dimension calculation".
- Render positions digits at `(width - digitWidth)/2 + xShift`, `(height - digitHeight)/2 + yShift` inside a fixed-window-size `Pressable` under `SafeAreaView` (L896-957).
- No expo-device dependency → half-inch is a dp constant: 80dp (nominal 160dp/inch; ≥ physical ½″ on Android since density buckets round up, ≈½″ on iOS points).

Plan of attack:
1. Replace `DRIFT_RANGE`/`FIT_PADDING` with `EDGE_TRAVEL_MARGIN = 80` and a small `INK_SLACK = 4` subtracted from bounce ranges (glyph ink can slightly exceed the advance box; keeps "fully visible" literal while edges still visually touch).
2. Clock screen: `SafeAreaView` gets `flex: 1`; `Pressable` drops fixed `width`/`height` for `flex: 1` and reports its real size via `onLayout` into a `motionBox` state (fallback = window dims until first layout). Rotation updates it automatically.
3. Fitting box insets the motion box by `EDGE_TRAVEL_MARGIN` per side; keep `maxFontSize = width / 3` ceiling unchanged.
4. Bounce: per-axis range `max(0, (boxDim - digitDim)/2 - INK_SLACK)`; step then clamp to ±range and reverse at the wall — overshoot impossible, extremes land flush on the edge, corners reachable since both axes start at 0 with equal speed.
5. Update stale comments around the constants and render.

Do not change: probe/fitting math (`MEASURE_SIZE`, `digitScale`), font availability probes, chime logic, settings screen, drift speed (1px/s).

## Plan Change Log

## Review Triage Log

Quick lens (1 reviewer), 6 findings:

- **Verification bullet contradicted smaller font** — real, low, patched: the bullet was rewritten above; a smaller fitted font on binding axes is the mandated half-inch travel margin, not a regression. Evidence: `EDGE_TRAVEL_MARGIN = 80` > old 63 by design.
- **INK_SLACK stops layout box 4px short of "exactly on the edge"** — real but negligible, kept without code change: 4dp (~2pt) is imperceptible and keeps script-face ink (which spills past the advance box) inside the screen; user requirement was fully visible *and* edges reached, and this satisfies both. Frozen wording stays as written for the human.
- **Transient overshoot when digits grow between ticks** — real, medium, patched: `xShift` was clamped only on the 1s tick, so a minute boundary widening the string (9:59→10:00) at a drift extreme could draw past an edge for ≤2s. Fix: ranges hoisted to render scope (`xRange`/`yRange`) and placement clamped via `clampedXShift`/`clampedYShift`, so walls and drawing cannot disagree.
- **RN SafeAreaView is iOS-only; Android nav area inside window** — real, low, pre-existing (old code was window-sized identically): comment corrected to say so; Android-side safe-area handling recorded in deferred-work.md.
- **Tap target shrank with flex:1-inside-SafeAreaView** — real, medium, patched: `Pressable` moved outside the `SafeAreaView` (full-window tap target restored), inner `View` reports the motion box via `onLayout`.
- **Stale fallback `motionBox` for one frame on first clock mount / rotate-in-settings** — real, low, rejected as not worth fixing: self-corrects at the clock's first layout pass; orientation is landscape-locked (`app.json` "orientation": "landscape"), so the stale window only differs by safe-area insets for a single frame.
- **Stale centring comment / dead centering styles** — real, low, patched: comment now says motion box; dead `alignItems`/`justifyContent` dropped with the render restructure.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: no errors (repo lints with airbnb + prettier).

**Manual checks (device/simulator):**
- Clock bounces until the digit box touches left, right, top and bottom edges of the visible area; nothing clipped at any edge, including on a notched iPhone layout.
- Font fills the container inset by the half-inch margin — deliberately a touch smaller than the old 63px-inset look on axes where size binds (that is the requested travel room), and noticeably larger than before only where safe-area insets used to eat the window; digits always have ≥ ~half an inch of travel left per axis, so motion never freezes.
- Rotating the device keeps digits fully visible and bouncing against the new edges.
