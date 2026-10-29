---
title: 'Digit font customization with daily random mode'
type: 'feature'
ticket: ''
created: '2026-10-28'
status: 'built'
baseline_revision: '2f5bc3cd6708b82cd892ae4965778895806f06a7'
route: 'full'
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

**Problem:** The clock digits render in the platform system font with no way to change it. Users want to pick from a small curated set of classic fonts, restore the original look without remembering what it was, and optionally let the app pick a random font for them once per day.

**Approach:** Add a "Digit font" picker (chips row) and a "Surprise me daily" toggle to the existing first/settings screen in App.js. Choices persist via SecureStore like the chime range already does. The stored value is either a font id or the sentinel `default`; `default` always renders exactly today's system-font look, so reverting needs no memory of the original. Daily mode derives the font deterministically from the calendar date, so the whole day shows one font with no extra state and stable behavior across restarts.

Decisions (assumptions made deliberately):
1. Curated fonts are built-in system families only — no bundled font files, no expo-font: `default` (system), `serif` (Georgia / serif), `mono` (Menlo / monospace), `rounded` (Avenir / sans-serif), `script` (Snell Roundhand / cursive) via Platform.select.
2. Daily random picks among the four non-default fonts (so daily mode always shows a distinct font); manual pick still offers `default`.
3. Settings UI lives on the existing first screen; tapping the clock already returns there.

## Boundaries & Constraints

**Always:** First-run with no stored preference renders pixel-identically to today (system font, weight 600, color #d0fcc5). Any invalid/unknown stored font id falls back to `default` silently. Daily derivation must be pure: same local date ⇒ same font.

**Never:** No new npm dependencies. No bundled .ttf assets. Do not touch audio/chime logic or the drift animation. Do not add AsyncStorage or navigation libraries.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First run | No stored font pref | Digits render as before; picker highlights "Default"; toggle off | No error expected |
| Pick `serif` | Tap serif chip | Digits switch immediately; persisted; survives reload | SecureStore write failure: UI still switches for the session (best-effort persist) |
| Revert | Tap "Default" after any pick | Digits return to original system look; stored sentinel `default` | — |
| Daily mode ON | Toggle on, date D | Font = pool[dateSeededPick] where pool excludes default; same font all day incl. restarts on D | Corrupt lastKnown pref: treat as unset (default) |
| Date rolls over | App open past midnight local | Next minute-tick render uses new day's pick | — |
| Daily mode OFF | Toggle off | Immediately back to manually picked font; date seed ignored | — |

</frozen-after-approval>

## Code Map

- `App.js` — entire feature lives here (single-file app).
  - L26-31 `fontSpecs` object: add `...selectedFontStyle` spread (fontFamily only; keep fontSize width/3, fontWeight '600').
  - L57-64: existing SecureStore pattern — `CHIMING_TIME_RANGE` key const, async init in mount effect, save effect on change. Mirror it for `digitFont` and `randomDaily`.
  - L118-127 mount effect (`initChimingTime` etc.): load new prefs before first render of clock (firstScreen gate already covers the flash).
  - ~L230+ first-screen JSX: after the MultiSlider block, add font chips row + "Surprise me daily" Pressable toggle; reuse inline style language (black buttons, white text, fontWeight 600).
  - Clock `Text` (~L300): apply chosen font.
- New pure helpers in App.js: `FONTS` registry `{ id: { label, style } }` with Platform.select styles; `dailyFontId(date)` = `pool[Math.floor(dayOfYear % pool.length)]`-style deterministic pick (use local year-day to avoid hashing deps).

## Tasks & Acceptance

**Execution:**
- [ ] `App.js` — add `FONTS` registry + `Platform` import; derive current font id from state (`digitFontId`, `randomDaily`) via a small pure function `activeFontId()`; spread active style into `fontSpecs`.
- [ ] `App.js` — persistence: consts `DIGIT_FONT_KEY='digitFont'`, `RANDOM_DAILY_KEY='randomDaily'`; init in mount effect (JSON parse, unknown ids → 'default'); save on change via effects mirroring the chiming-range pattern.
- [ ] `App.js` — settings UI: chips row mapping FONTS (highlight active; tapping a chip sets font AND turns randomDaily off), toggle Pressable showing "Surprise me daily: On/Off".
- [ ] `App.js` — daily derivation: pure `dailyFontId(now)` from local date parts; used only when randomDaily is on; recompute piggybacks on the existing 1s currentTime tick (no new timers).

**Acceptance Criteria:**
- Given fresh storage, when the clock renders, then digits use system font weight 600 (identical to baseline) and "Default" chip is highlighted.
- Given user picked `mono`, when app reloads, then digits are mono again without re-picking; tapping "Default" restores system look instantly.
- Given randomDaily on, when the same local date is reopened multiple times, then the same font id is derived each time; when local date differs (mock by changing device day), a possibly different pool entry is chosen; pool never yields `default`.
- Given stored digitFont is garbage (e.g. `"\"bogus\""`), when app inits, then it falls back to `default` without throwing.

## Implementation Notes

(full-route implementation will append here)

## Verification

**Commands:**
- `npx eslint App.js` — expected: clean.
- `node -e` unit probe of the pure helpers (extract or replicate dailyFontId logic) asserting same-date stability, rollover sensitivity, and pool membership — expected: assertions pass.
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios --platform android --output-dir "$TMPDIR/font-export"` — expected: exit 0, bundles produced.

**Manual checks:**
- First-screen JSX shows chips + toggle with consistent inline styling; no audio code paths touched (`git diff` review).

## Review Triage Log

- [x] Pre-load interaction clobber: taps on the chips/toggle before `initDigitFontPrefs` resolved were overwritten by init's late `setState`, and stored non-default state briefly rendered wrong — accepted, fixed (patched): added `fontPrefsLoaded` gate; the Digit font section is `pointerEvents="none"` at 0.5 opacity until prefs finish loading
- [x] SecureStore read failure conflated with corrupt data: any throw set `'default'`/`false`, which the save effects then persisted over possibly-intact stored values — accepted, fixed (patched): only successful reads write state; catch leaves prefs `null` so save-effect guards skip persisting; `fontPrefsLoaded` set in `finally`
- [x] Unguarded font-id lookup class: `DAILY_FONT_POOL` duplicated `FONTS` keys by hand and the daily branch bypassed `normalizeFontId`, so future FONTS/pool drift would crash every render on `FONTS[undefined].style` — accepted, fixed (patched): pool derived via `Object.keys(FONTS).filter(id => id !== DEFAULT_FONT)`; `activeFontId` routes both branches through `normalizeFontId`
- [x] Reviewer confirmed no issue: AC1 default path, AC2/AC4 JSON round-trip consistency with the chimingTimeRange pattern, same-date determinism (no DST off-by-one), pool excludes `default`, toggle-off restores manual pick, chip tap exits daily mode, no new deps
