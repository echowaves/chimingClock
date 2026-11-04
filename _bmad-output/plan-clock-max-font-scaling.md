---
title: 'Clock font scales to its maximum, leaving only the half-inch travel margin'
type: 'feature'
ticket: ''
created: '2026-11-03'
status: 'built'
baseline_revision: '5746c68'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '_bmad-output/plan-safe-area-context-migration.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The digits did not scale up to fill the screen: a legacy `width / 3` ceiling capped the fitted size on large devices, and the motion box ignored safe-area insets on both platforms (RN core SafeAreaView being iOS-only), so "the space left around the text" was neither the requested half inch nor measured from the truly visible edge.

**Approach:** Size the digits to the largest that fits the inset-aware motion box minus `EDGE_TRAVEL_MARGIN` (80dp ≈ nominal half inch) per side — no other ceiling — so in the original centred position the closest edge is exactly the travel margin away, and the bounce range (margin − ink slack) keeps the text moving and bouncing off every edge. The motion box becomes window dims minus live `useSafeAreaInsets()` values on both platforms; digits are placed with an insets offset inside the full-window tap-target Pressable.

</frozen-after-approval>

## Code Map

- `App.js` ~L300-318 -- motionBox from `useSafeAreaInsets()` (was onLayout-measured padded box); `guessFontSize` replaces the `maxFontSize` ceiling.
- `App.js` fontSpecs/fitted block -- fitted size no longer capped; fallback before/without metrics is the width/3 guess.
- `App.js` clock render -- inner wrapper View removed; placement = insets offset + centred drift position inside the full-window Pressable.

## Tasks & Acceptance

**Execution:**
- [ ] `App.js` -- remove ceiling, compute motion box from live insets, offset placement -- one goal: maximum font with exactly half-inch closest-edge margin.

**Acceptance Criteria:**
- Given any device size, when the probe has measured, then the fitted font equals the largest whose digits fit the inset box minus 80dp per side (no width/3 cap).
- Given a notched phone, when the clock drifts, then walls and margins are measured from the visible (inset) edges on iOS and Android.
- Given metrics have not arrived yet, when the clock first draws, then digits use the conservative guess and never overflow permanently.

## Implementation Notes

Implemented as planned; see also the safe-area migration plan this builds on (same working tree, committed together — the changes interleave in one region of App.js). `npx eslint App.js` clean. Bounce/fit math unchanged apart from dropping the ceiling term.

Sizing check: iPhone 15 landscape (844x393, side insets ~59): motionBox 726x393 → fit 566x233 → "10:00" fits at ~192pt with exactly the 80dp margin left to the visible edges; drift range ≈ 76px per axis. iPad landscape 1024x768: no longer capped by width/3 whenever the fit is taller than the old ceiling.

## Review Triage Log

Independent quick lens could not launch (subagent infrastructure failed 3x); its prompt is saved at `plan-clock-max-font-scaling.quick-lens-prompt.md` for a fresh session. Self-review in this session checked: insets subtraction and both-platform coverage; placement offset by insets inside the full-window Pressable (no padding on the Pressable, so absolute children are window-relative — offset required and present); guess-size first frame unchanged from prior behaviour; fontSpecs carries no size and both consumers override; Root/provider shape vs AppEntry default import; rotation via live dims+insets with the render-side clamp still guarding range shrink; probe placement harmless outside insets. No defects found.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npx eslint App.js` -- expected: clean.

**Manual checks (device/simulator):**
- On a large device (iPad landscape) digits are visibly larger than before, closest-edge gap ≈ half an inch at rest; drift reaches all four edges and bounces.
- No deprecation warning; tapping anywhere (including inset bands) opens settings.
