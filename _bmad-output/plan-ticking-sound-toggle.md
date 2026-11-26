---
title: 'A preference for the ticking sound, on by default'
type: 'feature'
ticket: ''
created: '2026-11-25'
status: 'built'
baseline_revision: '5961006b3347821927eef241a4b763fe683fe5c4'
route: 'full'
route_source: 'pinned'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The ticking loop has no switch. Only the chime time range silences it, and that range is really the *chime* window — so someone who likes the bells but not the constant tick cannot have that, and someone outside the window cannot turn the tick back on.

**Approach:** One persisted preference, "Ticking sound", defaulting to On, gating only the looping tick player; the chimes keep exactly the behaviour they have now.

## Boundaries & Constraints

**Always:** a missing stored value means On (fresh install and upgrade alike); Off really stops the looping player rather than muting it; ticking sounds when and only when the preference is On *and* the hour is inside the active range; a failed SecureStore read leaves state untouched and writes nothing back; the control reuses the existing toggle pill.

**Never:** do not change what `isSoundEnabled()` means for chimes, nor the quarter-hour boundary logic; no new dependencies and no new audio assets (no synthesised tick); no volume control, no second quiet-hours control; do not persist while prefs are still loading.

## Decisions (settled with the human at planning)

- **Scope:** the preference governs the ticking only. The quarter-hour chimes keep their current rule untouched.
- **"Off" is a real stop:** the looping player is paused and rewound, not muted.
- **Default is On**, including for installs upgrading from an older build with no stored value.
- **Placement:** a third pill in the existing toggle row beside Show seconds / Pulsing separator, inheriting its styling and load-time inertness.
- **Launch blip is fixed as part of this work:** nothing sounds until the preference and the time range are known, so the gate owns the player's first start.
- **Plan size** (~1800 tokens) kept in full at the human's choice; the excess is Code Map anchoring.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh install | key absent | ticking plays inside the active range, pill shows On | no error expected |
| Upgrade from an older build | key absent | same as fresh — On, nothing to migrate | no error expected |
| Tap Off mid-tick | player looping | stops on that tap and rewinds to the top of the clip | no error expected |
| Tap back On | paused at 0 | restarts from the top of the clip, never mid-"tick" | no error expected |
| Off, hour enters active range | pref false, window opens | stays silent | no error expected |
| On, hour crosses into range while app is open | pref true | resumes on the next minute tick | no error expected |
| Stored value unreadable | read throws or JSON is corrupt | state stays unloaded, pill shows On, nothing written back | caught; never persisted over |

</frozen-after-approval>

## Code Map

- `App.js:47-52` -- pref key constants; add `TICKING_SOUND_KEY` beside `SHOW_SECONDS_KEY`.
- `App.js:80` -- `persistPref(key, value)`: best-effort write, already swallows failures. Reuse as-is.
- `App.js:381-385` -- sound state; `tickSound` holds the player. The new boolean belongs with the other prefs at `App.js:400-404`, which are `null` until loaded.
- `App.js:629-637` -- `initChimingTime`: the house pattern for a sound pref with a default.
- `App.js:639-685` -- `initDigitFontPrefs`: null-until-loaded reads inside one `try`; the new read belongs in the same init sequence.
- `App.js:714-715` -- `tick.loop = true; tick.play()`: the unconditional autoplay that must move behind the gate.
- `App.js:808-822` -- `isSoundEnabled()` (the hour-window rule) and `resetTicking()` (the only writer of tick volume). `resetTicking` becomes the start/stop decision.
- `App.js:824-833`, `App.js:885-887` -- the two effects calling `resetTicking`, keyed `[chimingTimeRange]` and `[currentMinute]`; both need the preference in their deps.
- `App.js:852-862` -- `play()` uses `isSoundEnabled()` for chime volume. **Do not change.**
- `App.js:1072,1079` -- `fontPrefsLoaded` makes the settings group inert and dimmed until prefs land; the toggle row is inside it.
- `App.js:1152-1163` -- the pill array (`Show seconds`, `Pulsing separator`); styling is inline in the `.map`, so a new entry needs no new styles.
- `fontSelection.js`, `jest.config.js`, `__tests__/` -- precedent from last change: pure extracted rules with no React Native imports, run under node jest.

## Tasks & Acceptance

**Execution:**
- [ ] `soundGating.js` -- extract the active-range rule out of `isSoundEnabled` into a pure function (hour, range) → boolean, keeping min inclusive and max exclusive exactly as today.
- [ ] `__tests__/soundGating.test.js` -- cover the pure rows: boundary at `min`, boundary at `max`, hour outside, unset range, and a false preference silencing regardless of window.
- [ ] `App.js` -- add `TICKING_SOUND_KEY`, the `tickingSound` state (null until loaded), its read in the init sequence defaulting to On, and its persist effect guarded against the unloaded state.
- [ ] `App.js` -- make `resetTicking` start/stop rather than set volume: play when preference On and window open, otherwise pause and rewind to 0; drop the unconditional autoplay from `initSounds`; add the preference to both effect dep arrays that call it.
- [ ] `App.js` -- have `isSoundEnabled()` delegate to the extracted rule, so chimes and ticking share one truth and the chime behaviour is provably unchanged.
- [ ] `App.js` -- add the pill as a third entry in the existing toggle row (`App.js:1152-1163`).

**Acceptance Criteria:**
- Given a fresh install, when the app runs inside the active range, then ticking sounds and the control reads On with no taps.
- Given ticking On, when the user taps it Off, then sound stops on that tap and stays stopped across minute boundaries and hour crossings until tapped again.
- Given ticking Off, when the app is closed and reopened, then it is still Off.
- When the preference is toggled either way, then the quarter-hour chimes behave exactly as before.
- Given storage cannot be read, when init finishes, then the control reads On and nothing has been written to storage.

## Implementation Notes

Implemented from this plan; no deviations from the frozen block.

- New `soundGating.js` holds two pure rules: `isHourInActiveRange(hour, range)` — deliberately the *same expression* the app had inline (`hour >= range?.min && hour < range?.max`), so extraction cannot change what the bells do, odd stored bounds included — and `isTickingAudible({ enabled, hour, range })`, which layers the preference on top of it. Anything not an explicit `false` counts as On, which serves fresh install, upgrade and unreadable value with one rule.
- `App.js`: `TICKING_SOUND_KEY`, a `tickingSound` state (`null` until loaded), `initTickingPref` awaited between `initChimingTime` and `initDigitFontPrefs`, a persist effect guarded on the loaded state, and the pill as the third entry of the existing row (so it inherits the row's styling and its load-time inertness).
- `resetTicking` no longer touches volume. It asks `isTickingAudible`, compares against a `tickingRunning` ref, and acts only on a change: `play()` going in, `pause()` + `seekTo(0)` going out. The ref is what keeps the per-minute call from re-seeking an already-stopped player every sixty seconds.
- `tick.play()` is gone from `initSounds`; the gate owns the first start, which is why nothing sounds at launch before prefs are known. Only the chime path still sets `volume`.
- The `[chimingTimeRange]` effect now only persists the range (and its dead `console.log` line went with the rewrite); a dedicated effect keyed `[tickSound, tickingSound, chimingTimeRange]` owns the tick, and the existing `[currentMinute]` effect still carries hour crossings.
- Chime gating (`play`, `isSoundEnabled` semantics) untouched: `isSoundEnabled` is now a one-line delegation to the extracted rule.

Matrix Test Audit: 14 new tests in `__tests__/soundGating.test.js` (34 total, all passing). Covered by tests: fresh install, upgrade with no key, off while the window opens, on as an hour crosses in and out, unreadable value falling back to On while still respecting the window, plus the boundary rows of the shared rule. Not testable here: "Tap Off mid-tick" and "Tap back On", and the storage glue behind fresh install / upgrade / unreadable — those are `expo-audio` player side effects and SecureStore reads, and this project has no `jest-expo` renderer by deliberate choice, so they remain the device checks listed under Verification.

## Plan Change Log

## Review Triage Log

- Closed as `built` by the human on 2026-11-25 with no findings received. The Quick lens prompt was written out at `plan-ticking-sound-toggle.quick-lens-prompt.md` because no reviewer subagent could be launched in this session; the human accepted the change on device instead, so `lenses_ran` stays empty and nothing was triaged.
- Deferred to device use by design, not by oversight: the two player rows of the I/O matrix (tap Off stops mid-tick and rewinds; tap On restarts from the top of the clip) and the SecureStore glue behind the fresh-install, upgrade and unreadable-value rows. This project has no `jest-expo` renderer, so they are covered only by the manual checks under Verification.

## Design Notes

Stopping rather than muting: a muted `loop = true` native player keeps decoding all day for nothing. `pause()` then `seekTo(0)` makes the next start begin at the top of the clip instead of half-way through a "tick"; the un-awaited `seekTo` follows the precedent in `play()` (`App.js:859`).

The window rule is extracted rather than re-implemented for ticking, because two copies of "is this hour inside the range" is exactly how chimes and ticks end up disagreeing about quiet hours.

## Verification

**Commands:**
- `npx eslint App.js soundGating.js __tests__/soundGating.test.js` -- expected: exit 0 (baseline is clean)
- `npx prettier --check App.js soundGating.js __tests__/soundGating.test.js` -- expected: unchanged
- `npx jest` -- expected: existing font-selection tests plus the new gating tests pass
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` -- expected: Hermes bundle produced without errors

**Manual checks (device only):**
- Given a fresh install, then ticking is audible inside the range and the pill reads On.
- Given ticking playing, when tapped Off, then silence follows immediately and survives an hour crossing into the range; tapping On again restarts from the top of the clip.
- Given ticking Off, kill and relaunch: still Off, and no tick sounds at launch before the settings screen is opened.
- Given any state of the new pill, the quarter-hour bells still ring inside the range at the same loudness as before.
