---
title: 'Fit clock digits to the screen with dynamic font sizing'
type: 'bugfix'
ticket: ''
created: '2026-10-29'
status: 'built'
baseline_revision: 'cfdee8df19401eb9179a8d3045afc4e2f9a7f333'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The clock face hard-codes `fontSize = width / 3`, and the digits render in an absolutely-positioned `Text` with no size constraint. A five-glyph time (`12:34`) at that size is wider than the window once a wide face is chosen, so React Native wraps it onto a second line; the ±55px drift can also push the glyphs off the edge. Nothing constrains height either, and the app is locked to landscape, where the line box at `width / 3` is already close to the full window height.

**Approach:** Give the clock `Text` a real fitting box and let the platform shrink the type into it: `adjustsFontSizeToFit` with a low `minimumFontScale` and `numberOfLines={1}`, so digits never wrap or clip on iOS or Android for any chosen font, time string, or window size. The box is the window inset by the drift range, which makes "fully visible at every point of the drift" provable rather than lucky. `width / 3` stays as the *maximum* size, so a clock that already fits renders exactly as it does today.

</frozen-after-approval>

## Implementation Notes

Oneshot: one file, ~50 lines, no new dependencies and no design forks left open.

**How it works.** A hidden probe `Text` renders the same string in the active face at a small known size (`MEASURE_SIZE = 40`). Its `onTextLayout` reports the natural line box, and because text metrics scale linearly with font size, one measurement yields the exact largest size that fits: `min(width / 3, fitWidth * 40 / w, fitHeight * 40 / h)`. The visible `Text` uses that size and is centred from the measured box, so both axes are constrained and neither platform has to guess.

Facts this rests on, verified in `node_modules/react-native@0.88.1`:
- iOS emits the **used** line rect (`RCTTextLayoutManager.mm:397-400`), not the container width; Android implements the same event through `measureLines`. The probe carries no `width` style so there is no container/glyph ambiguity, and at 40pt a five-glyph time is ~120px — it cannot wrap on any device.
- Native auto-fit was tried first and rejected: iOS caps it at **96pt** (`RCTTextLayoutManager.mm:440-444`, `maximumFontSize` defaults to 96.0), which would shrink the clock to a third of its size, and `minimumFontScale` is parsed but consumed nowhere on Fabric (iOS uses an absolute 4pt floor; Android reads `PA_KEY_MINIMUM_FONT_SIZE`). Neither knob is reachable from JS (`TextProps.js`).
- `textAlignVertical` has no iOS consumer (`ReactTextViewManager.kt:291`), so vertical centring comes from positioning the measured box, not from text alignment.
- The drift stepper overshoots its bound by one step because the tick effect reads `xShift`/`yStep` before its own `setXStep`, so the reversal lags a tick: the real extremes are ±57, not ±55. Insetting the box by `DRIFT_RANGE + FIT_PADDING` (63px) keeps ≥ 6px of margin at every tick.

Decisions:
- One source of truth for the wander: `DRIFT_RANGE` replaces the four hard-coded `55`s, and the fitting box insets by `DRIFT_RANGE + FIT_PADDING`, which makes "fully visible at every point of the drift" provable rather than lucky.
- `width / 3` stays as the **ceiling**: a clock that already fits is untouched, so nothing that works today changes appearance.
- What is cached is the **raw measurement** (`font | time string` → natural width and height at 40pt), never a size: the fitting size is derived from it during render against the live box, so a window resize needs no new measurement. That matters because `ParagraphEventEmitter::onTextLayout` deduplicates identical line metrics (`ParagraphEventEmitter.cpp:38-46`) — an absolutely-positioned probe reports the same metrics after a resize and would never re-fire, freezing the old size if it were stored against the window.
- While a new face or time string is being measured, the previous metrics keep drawing for that one frame instead of flashing back to the ceiling.
- Dropping `onLayout`/`textWidth`/`textHeight`: the measured box replaces the layout round-trip that used to feed the position math.
- Leaving `allowFontScaling` at its default: OS text-size settings enlarge the starting size, and the measurement is taken from that same rendered text, so accessibility scaling stays supported.

## Plan Change Log

- **Review round 1 — measurement moved out of state.** The quick lens showed the first version stored a *fitted* size keyed by window dimensions; because the native `onTextLayout` emitter suppresses repeated metrics, a resize (Split View, multi-window) left the old size in place and the digits could overflow. Now only the window-independent natural box is stored and the size is derived each render.
- **After implementation, before review — approach pivoted, intent unchanged.** The frozen Approach named `adjustsFontSizeToFit` + `minimumFontScale`. Reviewing the change against the React Native sources showed those props cannot do the job: iOS silently caps auto-fit at 96pt (the clock is 180-340pt), `minimumFontScale` is dead on Fabric, and `textAlignVertical` is Android-only. Replaced with a measured, JS-computed size that achieves the same intent (never wrap, never clip, never bigger than today when it already fits) with no platform-specific gaps. The fitting-box idea from the Approach survived unchanged.

## Review Triage Log

Round 1 (against the first approach, `adjustsFontSizeToFit`):

- [x] iOS caps native auto-fit at 96pt (`RCTTextLayoutManager.mm:440-444`, `maximumFontSize` default 96.0) — accepted, fixed by approach: high; the clock is 180-340pt, so every fitting case would have rendered about a third of its size. Native auto-fit abandoned for the measured size.
- [x] `minimumFontScale` is never consumed on Fabric (parsed in `BaseParagraphProps.cpp`, unused; iOS uses an absolute 4pt paragraph floor, Android `PA_KEY_MINIMUM_FONT_SIZE`) — accepted, fixed by approach: high; a prop that silently does nothing.
- [x] `textAlignVertical` has no iOS consumer (`ReactTextViewManager.kt:291`), so the vertical centring the first draft relied on was Android-only — accepted, fixed (patched): medium; centring now comes from positioning the measured box, which works identically on both platforms.
- [x] Drift bound claimed as ±55 is really ±57 (the tick effect reads `xShift`/`yStep` before its own `setXStep`, so reversal lags a tick) — accepted, fixed (patched): medium; the box insets by `DRIFT_RANGE + FIT_PADDING` = 63px, leaving 6px at the true extremes.
- [x] Plan claimed "renders exactly as today" and a saved re-render — rejected as inaccurate wording, corrected: low; the ceiling keeps fitting clocks unchanged, but the claim needed the condition stated, and the old `onLayout` fired on text change rather than every minute.

Round 2 (against the measured approach):

- [x] Stale size after a window resize: the first version stored a *fitted* size keyed by window dimensions, but `ParagraphEventEmitter::onTextLayout` returns early when line metrics are unchanged (`ParagraphEventEmitter.cpp:38-46`), and an unconstrained absolutely-positioned probe reports identical metrics across a resize — so Split View / Stage Manager / multi-window resizes never re-measured and the digits could overflow (or stay undersized) indefinitely in a monospace face — accepted, fixed (patched): medium, confidence 8; only the window-independent natural box is stored now (`font | time string`), and the fitting size is derived from it during render against the live box, so no new event is needed.
- [x] `useRef` imported and unused — accepted, fixed (patched): low; removed from the import.
- [x] Reviewer confirmed no issue: no `setState` loop (value-equal probe props plus the key guard plus native dedup), zero/absurd events rejected before storing, payload shape identical on both platforms, linear scaling valid since probe and visible `Text` share every style but `fontSize`, and no regression in drift, font switching, daily rollover, settings, or first render.

## Verification

**Commands (all run, all pass):**
- `npx eslint App.js` -- clean, no new warnings.
- Node invariant probe (`$TMPDIR/fit-invariant-probe.js`) replaying the drift stepper and the derive-at-render sizing rule over five device sizes x five face metric profiles: asserts the derived size never exceeds the ceiling, the glyphs never overflow the fitting box, a face that fits at the ceiling keeps `width / 3`, the drawn box stays inside the window for 20000 ticks per case, and a measurement taken on any window still fits when reused on every other window (the resize path). Result: pass, minimum margin from the window edge 6.0px.
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios --platform android --output-dir "$TMPDIR/fit-export3"` -- exit 0, both Hermes bundles produced.

**Manual checks (no simulator in this environment):**
- `git diff` touches only the clock-face render, the drift constants and the measurement; audio, chime-range and font-preference code paths are untouched.
- Reasoning check: with a narrow face at `9:05` the glyphs fit inside the box at the ceiling, so the probe leaves `width / 3` untouched — no visual regression where it already worked (the probe asserts this case).

**Not covered here:** the glyph metrics in the invariant probe are approximate, and `onTextLayout` firing for an `opacity: 0` probe has not been exercised on a device. Worth one look on a real iPhone and Android phone: switch every face at `9:05` and at `08:88` and confirm the digits stay on one line and inside the screen while they drift.
