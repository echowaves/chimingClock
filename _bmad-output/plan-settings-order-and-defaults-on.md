---
title: 'Settings screen order, on-by-default toggles, and complete persistence'
type: 'feature'
ticket: ''
created: '2026-11-27'
status: 'built'
baseline_revision: '7fee998cc4674035aae0bb528ffe3a7bc59bd030'
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

**Problem:** The settings screen leads with the chime-range sliders, so the one action on the screen (`Show the clock`) and the two display toggles sit below it. And two of the three toggles — `Show seconds`, `Pulsing separator` — read **Off** on a fresh install, because their reads use `=== true`; the app's rule elsewhere (`Ticking sound`) is that anything not stored is On.

**Approach:** Put `Show the clock` first on the settings screen and the display toggles immediately after it, then give every boolean pref one shared storage rule: absent, unparseable or unrecognised means **On**, and an explicitly stored `false` is the only Off. Every existing write path stays, so each setting still survives a restart.

## Boundaries & Constraints

**Always:** A stored value always beats a default — a saved Off stays Off across relaunches. Pref state starts `null` = "not loaded"; nothing is written before a successful read, so a failed read can never overwrite an intact value. The font picker keeps defaulting to every offered face and `digitFonts` keeps persisting. JS-only change, publishable through `eas update`.

**Never:** No new dependency, no AsyncStorage/MMKV — `expo-secure-store` stays the only store. Don't restyle or rewrite the controls, only move existing groups. Don't add or remove stored keys beyond those in the Code Map.

## Decisions

- **Placement (human):** move the whole existing pill row — `Show seconds`, `Pulsing separator`, `Ticking sound` — up under `Show the clock`. No split of the row; the display toggles are its first two pills, so they are the first options after the button.
- **Landing view (human):** `firstScreen` is not a setting and stays unpersisted — every launch opens settings, as today.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh install | no keys stored | all offered fonts selected; seconds shown; separator pulsing; ticking on; range 0–24 | none expected |
| Stored Off | `showSeconds` = `"false"` | reads Off, clock has no seconds, stays off after relaunch | none |
| Corrupt value | `pulseSeparator` = `"yes please"` | treated as not stored → On; rewritten on next save | never throws into state |
| Read fails | SecureStore throws for a key | pref stays `null`, renders its default, nothing written back | existing `catch` keeps stored value |
| Toggle then relaunch | user taps Pulsing separator Off, restarts | restored Off; colon steady | none |
| Legacy upgrade | `digitFont: "serif"` only | one-face set wins over the all-fonts default; legacy key deleted | existing path |

</frozen-after-approval>

## Code Map

Settings screen is the `firstScreen === true` branch — the only screen with controls; tapping it away shows the clock, tapping the clock returns. Everything below is in `App.js` unless noted.

- `App.js:1065-1296` -- settings screen rows, today's order: title + chime-range block (`1082-1129`) → `Show the clock` Pressable (`1137-1157`) → fonts+toggles group whose tail is the toggle row array at `1234-1256` (`Show seconds`, `Pulsing separator`, `Ticking sound`). Reordering = moving whole JSX blocks; the toggle row is already a `[...].map(...)` over `{label, value, onToggle}`.
- `App.js:42-53` -- the six stored keys (`chimingTimeRange`, `digitFonts`, `dailyFontPick`, `showSeconds`, `pulseSeparator`, `tickingSound`) + two legacy keys read once and deleted at `746-747`. **Inventory result: all six already persist; no user-facing setting is unpersisted.**
- `App.js:82` -- `persistPref`: best-effort write, `.catch(() => {})`. Save effects `905-931`, each guarded so `null` (not loaded) never writes. Chime range writes directly at `896-903` without the helper — route it through `persistPref`.
- `App.js:693-704` -- `initTickingPref`: `stored !== false`, the on-by-default precedent to copy.
- `App.js:736-742` -- **the bug**: `JSON.parse(...) === true` for `showSeconds` and `pulseSeparator` → absent means Off.
- `App.js:844` pulse effect (`pulseSeparator !== true`) and the seconds chip render near `1417` (`showSeconds === true`) must flip to the same on-by-default test as their reads.
- `fontSelection.js` -- `resolveSelectedFonts` / `rotationPool` already land on every offered id when nothing is stored, and the picked list persists via `DIGIT_FONTS_KEY`; covered by `__tests__/fontSelection.test.js` ("selects every font the app ships when nothing is saved"). **No change.**
- `prefDefaults.js` (new) -- one exported pure function interpreting a stored boolean string. Follows the repo pattern: no imports, node-only tests (`jest.config.js` has no RN env).
- Do not touch: `clockMotion.js`, `soundGating.js`, slider logic, font probe plumbing.

## Tasks & Acceptance

**Execution:**
- [x] `prefDefaults.js` -- create with one exported function mapping a raw stored string to a boolean; absent / unparseable / anything not exactly `false` → `true`. Comment why one rule serves all toggles.
- [x] `__tests__/prefDefaults.test.js` -- cover `null`, `"false"`, `"true"`, garbage, and that only an explicit `false` yields Off.
- [x] `App.js` (reads) -- use the helper for `showSeconds` + `pulseSeparator`; route `tickingSound` and the chime-range write through the shared helpers so all six keys read/write the same way.
- [x] `App.js` (renderers) -- seconds chip, pulse effect, and the toggle row's `value` expressions switch from `=== true` to the on-by-default test; keep `null`-while-loading rendering as On, matching `Ticking sound`.
- [x] `App.js` (order) -- lift the pill row out of the fonts group into its own block and move whole JSX blocks so the order is: `Show the clock`, the pill row (`Show seconds`, `Pulsing separator`, `Ticking sound`), the chime-range block, the fonts group. The moved row keeps a `fontPrefsLoaded` `pointerEvents`/opacity wrapper of its own, so no toggle is tappable before its stored value has been read. Keep the comment about the button's prominence truthful -- it explains why the button leads, not why it sits second.

**Acceptance Criteria:**
- Given a fresh install, when settings open, then every offered font is selected, seconds are on, separator pulses and ticking is on.
- Given any stored value that is not exactly `false`, when prefs load, then that option reads On.
- Given a user turns a toggle Off and restarts, when settings reopen, then it still reads Off and the clock behaves accordingly.
- Given the settings screen, when it opens, then `Show the clock` is above every other control and the display toggles are the first options after it.
- Given a pref read throws, when prefs load, then nothing is written for that key and the stored value survives intact.

## Implementation Notes

Implemented by a context-free subagent from this plan; the parent session read the full diff, verified the row order statically (`Show the clock` `App.js:1114` → pills `1137-1149` → chime title/slider `1184`/`1211` → `Digit fonts` `1246`), finished one gap and re-ran everything.

Added beyond the task list, on the plan's own principle that a read never throws into state:
- `rangePref(raw)` + `CHIME_RANGE_DEFAULT` in `prefDefaults.js`, used by `initChimingTime` (`App.js:686`) inside a `try`. The boolean reads were made throw-proof, but this one still ran bare and it sits **first** in the launch chain (`initChimingTime` → `initTickingPref` → `initDigitFontPrefs`): a stored value that was not valid JSON used to abort all three, so the tick and the font prefs silently fell back to defaults. Now anything that is not two whole hours inside 0..24 with `min <= max` is repaired to a full day, and an unreadable store leaves the range unloaded (so nothing is written over it) while the rest of the chain still runs.
- Two more test describes for it: absent → full day, well-formed stored range wins (including `{0,0}`), nine unusable shapes repaired, and never throws.

Matrix audit — row → covering test (all ran, none skipped):
- Fresh install → `prefDefaults` "reads On when nothing is stored" + "chimes every quarter-hour when nothing is stored"; fonts by `fontSelection` "selects every font the app ships when nothing is saved".
- Stored Off → "reads Off for an explicitly stored false".
- Corrupt value → describe "corrupt value (never throws into state)".
- Read fails → interpretation half pinned by "never throws, whatever the store handed back"; the store itself throwing and the no-write-back guard live in `App.js` effects and stay a **manual** check (`jest.config.js` has no React Native env; adding jest-expo is out of the plan's Boundaries).
- Toggle then relaunch → read side pinned by the Off case above; the write side is `persistPref` in an effect, same manual row.
- Legacy upgrade → `fontSelection` "turns one saved face into a one-element set that never rotates" and "prefers a valid saved set over the legacy single value"; the legacy-key deletion stays App-level/manual.

Verification: `npm test` → 87 passed / 4 suites; `npx eslint prefDefaults.js App.js __tests__/prefDefaults.test.js` clean; `npx prettier --check` clean. Device checks in **Verification** below are not run here.

## Plan Change Log

- 2026-11-27 (build): the chime block moved as "title + chime-range" together — the
  Code Map treats them as one unit, and the title's "specified below" would lie if it
  stayed at the top while its slider dropped below the pills. No other deviation.

## Review Triage Log

Pass 1 — lens `quick` (thorough-only lenses skipped), 0 high / 0 medium / 4 low / 3 false / 0 maybe-false. No loopback.

- **low → patch** `App.js:1118-1120`: the new wrapper comment promised "no pill can be tapped before the value it is about to show has been read". The gate is the single `fontPrefsLoaded` flag set in `initDigitFontPrefs`'s `finally` (`App.js:758`), and the digit-fonts / daily-pick reads at `App.js:723`/`730` can throw before the seconds and separator reads run — leaving those two `null` while the pills go live, where a tap writes. Comment reworded to describe the gate it actually provides; no new flags added. The underlying overwrite hazard is pre-existing (the ticking pill read `!== false` this same way before the change) and is deferred separately.
- **false** `App.js:742-744`: claim was that a rejecting `SecureStore.getItemAsync` still escapes `initDigitFontPrefs`, contradicting "neither read can throw out of this init". It does not — the whole body sits in the `try` at `App.js:716` whose `catch` at `App.js:755` absorbs it, which is exactly what the sentence describes. What *is* true (later reads and the legacy deletions are skipped) is the pre-existing hazard logged above.
- **false** `App.js:853`/`1434`: claim was that AC 3 fails because a user with `"false"` stored sees On when their read fails. That path is specified behaviour, not a defect — the frozen matrix row "Read fails" states the pref stays `null`, renders its default, and writes nothing back, so the stored value survives; AC 3 concerns the successful-read path, which the Off cases in `__tests__/prefDefaults.test.js` pin.
- **low → rejected** (`App.js:1090-1180` ordering, store-throw guards, toggle→relaunch round trip have nothing automated behind them). Real coverage gap, but `jest.config.js` is node-only by design and a React Native harness is excluded by this plan's Boundaries; the fix is far more than a correction. Ordering was verified statically (button `1114` → pills `1137-1149` → slider `1211` → fonts `1246`) and the rest stays on the device checklist in **Verification**.
- **low → patch** `prefDefaults.js:30`: `CHIME_RANGE_DEFAULT` was exported with no consumer while `MultiSlider` kept its own `min={0}`/`max={24}`, so the repair rule and the control could drift apart. The slider now takes both bounds from the constant.
- **false** `App.js:1121-1130`: claim was a restyle against "don't restyle or rewrite the controls". The `fontPrefsLoaded` `pointerEvents`/opacity wrapper is required verbatim by this plan's own task list; what travelled with the block is container spacing (`marginTop` dropped, `width: '90%'` added for its new position), and every pill's own styles are byte-identical to the removed block.
- **low → defer** `.github/instructions/codacy.instructions.md` asks for a `codacy_cli_analyze` pass on each edited file; no Codacy tool is exposed in this session, so the pass could not be run for `App.js`, `prefDefaults.js` or `__tests__/prefDefaults.test.js`. Recorded as a new `deferred-work.md` entry.

## Design Notes

One rule, three call sites today (`=== true`, `!== false`, and the sliders' own default). Collapsing them:

```js
// prefDefaults.js — absent means on: an option is Off only if the user said so.
export const booleanPref = (rawStored) => JSON.parse(rawStored) !== false
```

`JSON.parse(null)` → `null`, garbage throws — both must land on On, never on a thrown read poisoning state; the test file pins that.

## Verification

**Commands:**
- `npm test` -- expected: all suites pass, including the new `prefDefaults` cases and the untouched font/clock/sound suites.
- `npx eslint prefDefaults.js App.js __tests__/prefDefaults.test.js` -- expected: no errors.
- `npx prettier --check prefDefaults.js App.js __tests__/prefDefaults.test.js` -- expected: clean.

**Manual checks (device):**
- Fresh install (or clear storage): settings screen shows the button at top, then Show seconds / Pulsing separator; clock has seconds and a pulsing colon without touching anything.
- Turn both off → force-quit → relaunch: both read Off, colon steady, no seconds.
- Drag the chime range, restart: range restored. Tap fonts off, restart: same set restored.
