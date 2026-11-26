---
title: 'Rotate the clock through a chosen set of fonts, plus tiny seconds and a pulsing separator'
type: 'feature'
ticket: ''
created: '2026-11-25'
status: 'in-review'
baseline_revision: '9e609a3a9956a24c4bfdc891b288eedd69a32a30'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The font picker offers a single choice plus "Surprise me daily", and both lists carry a `Default` entry. Users cannot say "rotate between these three", the word "default" means two different things (a font name and an app fallback), and one daily rotation is too coarse to show off the faces the app already ships. The clock also has no way to show seconds without shrinking the digits, and its separator is static.

**Approach:** Make digit-font selection a multi-select set: the clock rotates through the selected fonts once a day at local midnight, one selection means that font always, and the picker enforces at least one selection so an empty state never exists. Delete the `Default` font entry and the old date-arithmetic rotation. Add two independent display toggles — tiny seconds pinned to the bottom-right corner of the digits, and a slow breathing pulse on the `:` separator.

## Decisions (settled with the human at planning)

- **Cadence:** rotate randomly at local midnight, once a day. A redraw must never land on the font just used: draw again among the remaining candidates until a different one is chosen, so consecutive days always differ.
- **First launch (nothing stored):** select every font this device offers, so rotation is visible from day one.
- **Separator pulse:** opacity only — full → ~20% over a ~3s in-out cycle, native driver, no scale and no layout involvement.
- **Plan size:** kept as one plan above the 1600-token guideline by explicit human choice; the three asks share the settings-persistence block and the clock JSX container in `App.js`, so splitting them would churn identical lines.

## Boundaries & Constraints

**Always:**
- At least one font is always selected; deselecting the last one is refused in the UI rather than silently accepted.
- The stored preference migrates: an existing single `digitFont` becomes a one-element set, and unreadable or stale values fall back without ever writing garbage back over intact prefs.
- All rotation happens inside the fonts this device actually has (`availableFontIds`); a font that disappears from the list can never be drawn.
- The day's pick is persisted with its date, so relaunching later the same day keeps the same face; only a new local day (or a pick no longer in the pool) triggers a redraw.
- The digit-fitting maths (measured box → largest size that fits, travel walls) keeps measuring the `h:mm` string only. Seconds and the pulse must not change the fitted font size or the drift range.
- Every new animation uses `useNativeDriver: true` and is cleaned up on unmount.

**Never:** no new dependencies; no changes to chime/tick audio, the chime time range, the settings scrollbar, or the travel-margin constants; no per-second re-measurement of the digit box; no JS-state-driven animation for the pulse (no `setState` at 60fps); do not render seconds by lengthening the measured string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First launch, nothing stored | No `digitFonts`, no legacy keys | A valid non-empty set is selected and the clock draws it immediately after probes settle | None expected |
| Upgrade from single font | Stored `digitFont: "mono"`, `randomDaily: true` | Set becomes `["mono"]`, clock always draws Mono, `randomDaily` key removed and ignored | Corrupt JSON → treat as unset, keep drawing fallback set |
| Legacy `"default"` stored | Stored `digitFont: "default"` | Falls back to the first-font default set; `default` is never drawn or listed | — |
| Last font tapped off | Set has exactly 1 id | Selection stays at that id (no empty set); label still shows it selected | — |
| Device lacks fonts in the set | Stored ids include unavailable faces | Rotation pool = stored ∩ offered; if empty, pool = all offered ids | While probes pending (`availableFontIds === null`), offer everything as today |
| Relaunch later the same day | Daily pick stored for today's date | The stored font is drawn again — no re-draw on launch | Stored pick not in the current pool → draw a new one |
| Local midnight passes while running | Pool has ≥2 eligible fonts | New random pick, guaranteed different from the one just shown; digits re-fit as on any font change | Pool of 1 → that font stays |
| Seconds toggle on | `showSeconds === true` | Two-digit seconds drawn small at the digits' bottom-right, updating every second, drifting with the digits | None expected |
| Pulse toggle off/on mid-breath | Toggle flipped while animating | Animation loop stops (colon rests at full opacity) or restarts cleanly; no leaked timer | — |

</frozen-after-approval>

## Code Map

`App.js` is the whole app (1043 lines). Anchors as of `9e609a3`.

- `:33-35` — `DIGIT_FONT_KEY`, `RANDOM_DAILY_KEY`, `DEFAULT_FONT`: add a set key, delete the other two.
- `:44-133` — `FONTS`, 10 entries. Delete `default` (`:45`). The rest (`serif, mono, rounded, script, typewriter, geometric, display, engraved, marker`) keep their labels/weights/styles untouched.
- `:135-160` — daily-mode surface, delete outright: `DAILY_FONT_POOL`, `dayOfYear`, `dailyFontId`, `normalizeFontId`, `activeFontId`. Replace with a pure rotation picker (Design Notes).
- `:267-278` — `DEFAULT_FAMILY_FONT_IDS`, `isDefaultFamilyFont`, `ALL_NON_DEFAULT_FONT_IDS` (`:272`'s `!== DEFAULT_FONT` filter becomes moot once the id is gone), `MEASURED_FONT_IDS`, `DECLARED_FONT_IDS`. Leave `FontProbe` / `fontMetricsDiffer` alone.
- `:412-435` — `availableFontIds` (drop hardcoded `DEFAULT_FONT` at `:422`) and `offeredFontIds`.
- `:374-378` — prefs state `digitFont`, `randomDaily`, `fontPrefsLoaded`: becomes selected-set + two booleans, all still `null` = "not loaded yet".
- `:437-449` — `currentFontId` / `fontSpecs`: derive the active font here from pool + time; downstream (`metricsKey`, probes, buttons) keeps reading `currentFontId`.
- `:457-501` — fitting maths (`digitMetrics`/`metricsKey`, `fittedFontSize`, `digitFontSize`, `digitWidth/digitHeight`, `xRange/yRange`, clamped shifts): read-only for this change; the seconds overlay reuses these numbers.
- `:512-527` — `initDigitFontPrefs`: JSON.parse reads, only successful reads write state, `catch {}` leaves prefs unset, `finally` sets `fontPrefsLoaded`. Migration goes here.
- `:634-652` — the two persist effects; replace with one per new setting, keeping best-effort `.catch`.
- `:591-621` — tick effect: bounce + `setCurrentText(format('h:mm'))` only on minute change. Seconds must stay out of `currentText` (`metricsKey` would churn each second).
- `:869-950` — settings font group: button row `:896-924` (highlight at `:911/:919`) and the Surprise Pressable `:926-949`; that Pressable's shape is the pattern for the new toggles.
- `:985-1030` — clock JSX: hidden digit probe `:985-1012`, visible digits `Text` `:1014-1029` positioned from `digitWidth/digitHeight` + clamped shifts, then `<StatusBar>`.
- Untouched: chime effects `:654-703`, settings scrollbar `:709-780`, audio init, `travelMargin`/`INK_SLACK`.

## Tasks & Acceptance

**Execution:**
- [ ] `App.js` — Delete the `default` font entry and the daily-mode helpers/pool/key/state/UI; make `ALL_NON_DEFAULT_FONT_IDS`, `availableFontIds` and `offeredFontIds` read `FONTS` directly -- removing the concept at the source keeps it from returning through a fallback path.
- [ ] `App.js` — Add selected-set state + SecureStore key, migration from legacy `digitFont`, removal of the legacy `randomDaily` key, and persist effects; add `showSeconds` / `pulseSeparator` booleans with the same null-until-loaded discipline -- one preference shape for all three settings.
- [ ] `App.js` — Replace `activeFontId` with a daily pick: pool = selection ∩ offered; keep the chosen `{id, date}` in state and SecureStore; redraw on a new local date or when the stored id leaves the pool, excluding the font just used; use it for `currentFontId` -- survives relaunch, never repeats a day, no per-render randomness.
- [ ] `App.js` — Rebuild the font buttons as multi-select toggles that refuse to clear the last selection, and add two display-option toggles in the same visual language; delete the "Surprise me daily" button -- one consistent settings surface.
- [ ] `App.js` — Restructure the visible digits into a positioned container holding hours / separator / minutes plus an absolutely positioned seconds overlay, driven by the existing fitted size and shifts; add the `Animated` pulse loop for the separator with start/stop on toggle and unmount -- keeps the fitting maths untouched while making only the separator animate.
- [ ] `App.js` — Run lint/format/bundle checks listed under Verification and fix anything they raise.

**Acceptance Criteria:**
- Given a fresh install, when the settings screen loads, then at least two fonts are shown as selected, no "Default" button exists, and no "Surprise me daily" control exists anywhere.
- Given three fonts selected, when local midnight passes, then the clock draws one of those three, never the face it was showing before, and the digits keep their fitted size within the travel walls.
- Given a pick made earlier today, when the app is killed and relaunched, then the same font is drawn again; given the user narrows the set to one font, when the next midnight passes, then that font is drawn.
- Given exactly one font selected, when the app runs for hours, then that font is always drawn.
- Given one font selected, when its button is tapped again, then it stays selected and the clock keeps drawing it.
- Given an install that had `digitFont: "mono"` and `randomDaily: true`, when it upgrades, then Mono is the sole selection and no daily behaviour remains.
- Given seconds enabled, when a minute rolls over, then digits keep their size/position logic while the tiny seconds update each second at the corner; given it disabled, then nothing but `h:mm` draws.
- Given separator pulse enabled, when the clock screen is open, then the colon breathes smoothly (~3s cycle) at 60fps off the native driver while hours and minutes stay steady; given disabled, then it holds full opacity.

## Implementation Notes

Full route, implemented directly in this session: subagent dispatch failed in this environment (`400 The requested model is not supported` / `502` from the model endpoint), so no clean-context implementer was available. One file changed, `App.js`, ~330 lines of diff.

Ran as planned:
- Removed the `default` entry from `FONTS` and deleted `DIGIT_FONT_KEY`/`RANDOM_DAILY_KEY`/`DEFAULT_FONT`, `DAILY_FONT_POOL`, `dayOfYear`, `dailyFontId`, `normalizeFontId`, `activeFontId`, both legacy persist effects, the single-select highlight logic and the "Surprise me daily" button. `ALL_NON_DEFAULT_FONT_IDS` became `ALL_FONT_IDS = Object.keys(FONTS)`; `availableFontIds` no longer prepends a synthetic always-available id.
- New pure helpers beside `FONTS`: `validFontIds`, `rotationPool(selectedIds, offeredFontIds)`, `drawDailyFont(pool, previousId)`, `todayKey`, `isTodayPick`. `rotationPool` intersects over the offered list, which normalises a stored set into `FONTS` order for free — that is why the button row and the pool cannot disagree.
- Prefs: `digitFonts`, `dailyPick` (`{ id, date }`), `showSeconds`, `pulseSeparator`, all null-until-loaded like the old pair; one `persistPref(key, value)` helper replaces four copies of the same `.catch`. `initDigitFontPrefs` migrates a legacy single face into a one-element set, drops anything not in `FONTS` (the old `"default"` included), starts a fresh install on every offered font, and deletes both legacy keys after reading.
- Daily draw lives in its own effect keyed on `[currentTime, digitFonts, offeredFontIds, dailyPick]`; the guard makes it a no-op except at midnight or when today's face leaves the pool. `currentFontId` reads that pick and otherwise falls back to the pool's first entry, so there is never an undefined font lookup between a selection change and the redraw.
- Clock render: the single digits `Text` became a positioned container (same `left`/`top`, `width: digitWidth`, `height: digitHeight`) holding a baseline-aligned row of hours / `Animated.Text` separator / minutes, plus the optional seconds `Text` absolutely pinned to `right: 0, bottom: 0`. The hidden probe still measures the whole `h:mm` string, so `fittedFontSize`, `digitWidth/digitHeight` and the travel walls are untouched.

Decisions during implementation:
- `hoursText`/`minutesText` come from `currentText.split(':')` rather than a second dayjs format call, so the row is built from exactly the string the probe measured.
- Each piece of the row carries `flexShrink: 0`: Yoga defaults Text to shrinkable, and a row a hair wider than `digitWidth` would otherwise ellipsize the minutes instead of overflowing visibly.
- The pulse effect also depends on `firstScreen` and resets the value to 1 when off, so no native-driver animation runs against an unmounted clock and switching off leaves a steady separator rather than one frozen mid-breath.
- Added a caption under the font row (`rotates daily through N selected` / `always this font`) because "tap again to keep the last one" is otherwise invisible behaviour.

Matrix Test Audit (step-03): the repo had no harness at all — no `test` script, no jest config, no test files, and `jest-expo` absent, while `jest` + `babel-jest` were already devDependencies. The human chose to extract the selection logic and unit-test it without new dependencies, so:

- New `fontSelection.js` holds the pure rules — `validFontIds`, `rotationPool`, `drawDailyFont`, `todayKey`, `isTodayPick`, `resolveSelectedFonts`, `nextSelection`. It imports nothing: the font table stays in `App.js` because naming a family is a `Platform` concern, and this module is handed the shipped ids plus the offered ids.
- New `jest.config.js` (`testEnvironment: node`, `watchman: false` — Watchman cannot start in a restricted environment) and `"test": "jest"` in `package.json`. `.eslintrc.js` gained one override giving `__tests__/**` the `jest` env.
- New `__tests__/fontSelection.test.js`: 20 tests, named after the matrix rows they cover. The shipped ids are read out of `App.js`'s source text rather than hardcoded, so the "ships no default font" row fails if the entry ever comes back.
- Audit caught a real defect: the first extraction filtered the stored set into the pool, which made the rotation order follow tap order instead of shipped order — the button row and the clock could have disagreed after an upgrade. `rotationPool` now intersects over the offered list, and that ordering is a named test.

Coverage by matrix row: first launch, upgrade from single font, legacy `"default"`, last font tapped off, device lacks fonts in set, relaunch same day, and midnight redraw are covered by tests. "Seconds toggle on" and "pulse toggle off/on mid-breath" are RN rendering behaviour and stay device-only manual checks — this project deliberately has no `jest-expo` renderer.

Verification: `npx eslint App.js fontSelection.js jest.config.js __tests__/fontSelection.test.js` exit 0; `npx prettier --check` on all changed files clean (after one `--write` pass); `npx jest` 20/20 passed; `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` produced a Hermes bundle.

Review halt (step-04): no reviewer subagent could be launched in this session, so the Quick lens prompt was written out with the plan, the repo's only rule file and the full diff inlined — `plan-font-rotation-set-and-display-toggles.quick-lens-prompt.md` beside this plan. The human runs it in a separate session; findings come back here for triage into `## Review Triage Log`, and nothing is committed until that triage is done. Regenerate the diff with `git --no-pager diff 9e609a3a9956a24c4bfdc891b288eedd69a32a30` plus `git diff --no-index /dev/null <file>` for `fontSelection.js`, `jest.config.js` and `__tests__/fontSelection.test.js`.

Follow-up tweaks requested after the review snapshot (to be committed separately from the feature change):

- `SECONDS_SCALE` 0.3 -> 0.1, so the corner seconds read as a footnote rather than a second line.
- New `DRIFT_STEP = 1 / 3`, used both for the initial `xStep`/`yStep` state and for the reversal inside `nextShift`. The old ±1 lived in those two places; slowing only the state would have snapped back to full speed at the first wall.
- "Show the clock" restyled as the settings screen's call to action: clock-green fill, bold label, taller touch target, shadow, and pressed feedback. It was previously indistinguishable from the secondary buttons.
- Seconds repositioned onto the digits' baseline. They were pinned to `bottom: 0` of the container, which is the bottom of the *line box* — below the digits' baseline by the font's descent (~0.18 of line height, i.e. ~30dp under a 190dp face), so they read as floating away from the text. `onMeasureDigits` now also records the probe's `ascender` (guarded to values strictly inside its own line box; otherwise treated as unreported), and `secondsBottomInset` lifts the seconds by `(height - ascender) * digitScale`, falling back to `DESCENT_FALLBACK_SHARE = 0.2` of the box height on a platform that reports no usable ascender. Their top edge lands on the baseline; digits carry no descenders, so only round glyphs overshoot by a percent or two.

- The seconds are now drawn in a fixed-size chip — black fill, rounded corners, padding and radius as shares of their own font size (`SECONDS_PAD_SHARE`, `SECONDS_RADIUS_SHARE`). They sit inside the digits' line box, so they can overlap a minute glyph, and green-on-green there was invisible. Sizing is explicitly not derived from the current second: most shipped faces have proportional digits, so a hugging chip twitched on every tick. A second hidden probe measures `'88'` once per font (`secondsMetrics`, `onMeasureSeconds`) and `secondsChipStyle` sizes the box from it — scaled by `secondsFontSize / MEASURE_SIZE`, not the digits' scale — with fallback shares until it reports. Glyphs are centred in the chip, whose bottom sits one half-pad below the baseline so their floor still lands on it. The fill is `SECONDS_CHIP_FILL = 'rgba(0, 0, 0, 0.5)'` — half-transparent so the overlapped glyph reads through it, with the alpha in the fill rather than the box's opacity, which would fade the seconds too.
Re-verified after these edits: eslint exit 0, prettier clean, `npx jest` 20/20, `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` produced a Hermes bundle.

## Plan Change Log

## Review Triage Log

## Design Notes

**Daily pick, no repeats, no flicker:** the clock re-renders every second, so the pick must never be recomputed from `Math.random()` at render time. Keep it as state shaped `{id, date}` and persist it under its own SecureStore key. On load and whenever the minute changes: if `date` is not today's local date (`dayjs().format('YYYY-MM-DD')`) or `id` is no longer in the pool, draw again — pick uniformly from `pool` minus the previous id, which is the terminating form of "draw again until it differs"; when that leaves nothing (single-font pool), keep the current font. A one-element pool always yields that element, which is what "one selected becomes the default" means here.

**Animating only the separator:** nested `<Text>` children cannot carry an `Animated` style, so the digits become three siblings inside one absolutely positioned container (`left`/`top` exactly as `App.js:1023-1025` computes today, `width: digitWidth`, `flexDirection: 'row'`, `alignItems: 'baseline'`): hours `Text`, separator `Animated.Text`, minutes `Text`, all sharing `fontSpecs` + `digitFontSize`. The hidden probe keeps measuring the whole `h:mm` string, so fitting and walls are unchanged; if the composed row is a hair wider than the measured box, centring inside the same container keeps the digits on the same centre point. Pulse: `Animated.loop(Animated.sequence([timing(pulse,{toValue:PULSE_MIN,duration:1500,easing:Easing.inOut(Easing.ease)}), timing(pulse,{toValue:1,duration:1500,...})])))`, `useNativeDriver: true`, opacity only (scale risks the row's measured geometry).

**Tiny seconds:** a second `Text` absolutely positioned inside the same container at `right: 0, bottom: 0`, `fontSize: digitFontSize * SECONDS_SCALE` (~0.3), same colour and font spec, content `currentTime.format('ss')`. It inherits the drift for free because it lives in the drifting container, and it is excluded from the probe so the digits never shrink to make room.

## Verification

**Commands:**
- `npx eslint App.js fontSelection.js jest.config.js __tests__/fontSelection.test.js` -- expected: exit 0 (baseline is clean)
- `npx prettier --check App.js fontSelection.js jest.config.js __tests__/fontSelection.test.js` -- expected: unchanged
- `npx jest` -- expected: all tests in `__tests__/fontSelection.test.js` pass
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` -- expected: Hermes bundle produced without errors

**Manual checks (device only, cannot be run here):**
- Given the settings screen, then the font row is multi-select with at least one highlighted, tapping the last selected font off leaves it on, and both new toggles invert like the old Surprise button.
- Given several fonts selected on a real device, when the rotation boundary passes, then the face changes without a size jump or a clipped digit at any screen edge.
- Given seconds on in landscape on a small phone, then the tiny seconds sit inside the digits' bottom-right corner and never cover a minute digit.
- Given pulse on, then the colon fades smoothly with no stutter of the hours/minutes; given off, it is steady.
