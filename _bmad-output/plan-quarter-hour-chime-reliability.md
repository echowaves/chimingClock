---
title: 'Chime every quarter hour even when clock ticks are skipped'
type: 'bugfix'
ticket: ''
created: '2026-10-31'
status: 'built'
baseline_revision: '88429daf6ede5d0ff1f5467c87a632d1b0a69f1a'
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

**Problem:** The clock sometimes stays silent at a quarter hour. The chime only sounds if a 1-second tick happens to observe exactly minute :00/:15/:30/:45, so any gap in ticking loses that quarter's chime forever — React Native stops JS timers as soon as the app is inactive (Control Centre, a call, the app switcher, a covered proximity sensor) and while the app is backgrounded or the screen is locked, and Android doze delays interval callbacks.

**Approach:** Key the chime on wall-clock quarters instead of the observed minute: remember which quarter was last chimed, and when a tick observes that a new quarter has begun, chime once for it — late but never missing — using that quarter's own hour and minute so a late hour-bell still announces the right hour. While the app is running normally this is indistinguishable from today's behaviour.

</frozen-after-approval>

## Implementation Notes

Oneshot route: single file (`App.js`), ~40 lines, well under the 100-line threshold.

Investigation (verified in the pinned dependencies):
- `App.js:251` — the only clock driver is `setInterval(..., 1000)` writing `setCurrentTime(dayjs())`.
- `App.js:258-275` — on each tick the observed minute is compared with `currentMinute`; a change updates `currentMinute` and the displayed text.
- `App.js:337-347` — the chime fires from an effect on `[currentMinute]`, so it needs an observed minute of exactly 0/15/30/45. Two consecutive observations are ~1s apart while ticking, so a miss requires the tick to jump a quarter: it cannot be fixed by tuning the interval, only by not requiring the exact match.
- `node_modules/react-native/React/CoreModules/RCTTiming.mm:138-196` — timers stop on `UIApplicationWillResignActiveNotification` (not only on entering background), restart on becoming active, and also stop whenever `UIDevice.proximityState` is close. A quarter crossed during any of those windows is never observed.
- `node_modules/expo-audio/ios/AudioModule.swift:109-127` — with `shouldPlayInBackground` left at its default (`false`), expo-audio pauses every player on entering background. So the app cannot sound a chime while suspended; this change deliberately does not fight that (no background audio capability, no `shouldPlayInBackground`, no local notifications).
- `App.js:326-335` — `play(minute)` derives the hour bell from `currentTime`, which is right for an on-time chime but would name the wrong hour for a late one. It also assumes the map lookup succeeds.
- Keep untouched: the drift/step logic in the `[currentTime]` effect, the once-per-minute `resetTicking()` call and its `[chimingTimeRange]` effect (tick volume), the time-range gate inside `play()`, sound creation in `initSounds()`, and both screens' JSX.

Change shape:
- Module constants for the quarter length and a grace window, next to the other layout constants, with comments naming the RN timer behaviour they defend against.
- A `useRef` holding the last chimed quarter index, seeded on the first tick so launching mid-quarter does not ring immediately (today's behaviour) — this needs `useRef` added to the `react` import.
- The chime moves to its own effect on `[currentTime]`: compute the current quarter index from wall-clock milliseconds; return if unchanged; otherwise record it and play, unless the boundary is older than the grace window (announcing a quarter that passed many minutes ago would state the wrong time) or the sounds have not loaded yet.
- `play` takes the hour and minute of the quarter boundary and returns early when no player matches.

Ran as planned: constants, `useRef` import, the quarter-indexed chime effect on `[currentTime]`, `resetTicking()` left in its own once-a-minute `[currentMinute]` effect so the tick volume still tracks the range as hours pass, and `play(hour, minute)` with a missing-player guard. Verification passed: eslint exit 0, prettier clean, `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` produced a Hermes bundle.

Decisions during implementation/review: the grace window is 2 minutes (a named constant), long enough to cover a short suspension across a boundary and short enough that a chime never announces a time already past; only the newest quarter after a long gap sounds, so resuming can't fire a burst. `isSoundEnabled()` still reads the current tick rather than the boundary — a 2-minute delay from any of `:00/:15/:30/:45` never reaches the next hour, so the two hours always agree. Quarters are counted from epoch milliseconds; every UTC offset is a multiple of 15 minutes, so those boundaries are local `:00/:15/:30/:45`, and DST shifts change only which bell rings, not the cadence. Subagent note for later runs in this environment: the `explore` and `task` agent types fail here ("The requested model is not supported") and explicit model overrides were refused; the `code-review` agent type works and served as the quick lens.

## Review Triage Log

- `quick` lens (run as a read-only review subagent, since the plan's other lens hosts are unavailable): no findings — no unmet acceptance criteria, broken rules, or bugs.
- `false` (checked, not a bug): "a late chime could sound outside the configured time range" — `play()` gates volume on `isSoundEnabled()`, and inside the 2-minute grace window the boundary's hour always equals the current hour, so gating is identical to an on-time chime.
- `false` (checked, not a bug): "moving `resetTicking()` out of the chime effect changes how often it runs" — the baseline effect was also keyed on `[currentMinute]`, so it still runs once per minute plus on range change.
- Accepted as designed / baseline parity: a quarter whose boundary passes while the sounds are still loading is consumed silently (the baseline lost it the same way), and quarters crossed during a gap longer than the grace window stay silent rather than announcing a stale time.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: exit 0 (baseline is clean)
- `npx prettier --check App.js` -- expected: unchanged
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` -- expected: Hermes bundle produced without errors

**Manual checks (device only, cannot be run here):**
- Given the app open on the clock, when a quarter hour passes, then it chimes within ~1s of the boundary, as today.
- Given the app open, when Control Centre is held down across a quarter hour and then dismissed, then the first tick after returning chimes that quarter instead of staying silent.
- Given the device locked across a quarter hour, when it unlocks within the grace window, then it chimes once on return; when it unlocks long after, it stays silent rather than announcing a stale quarter.
- Given a launch in the middle of a quarter, then no chime sounds at startup; given the configured time range excludes the current hour, then the chime stays silent and the ticking volume still follows the range.
