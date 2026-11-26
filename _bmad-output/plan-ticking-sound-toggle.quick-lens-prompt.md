# Quick lens review — ticking sound preference

Run this as a context-free reviewer. The session that produced the change cannot launch a
reviewer subagent, so this prompt carries everything it would otherwise point at: the plan,
the repository's only instruction file, and the diff under review. Nothing here refers to your
filesystem.

---

Read the plan below — it holds the acceptance criteria and intent — and the files its
frontmatter `context:` lists (there are none). Read the agent instruction files
(`AGENTS.md`, `CLAUDE.md`, or equivalents) at the repository root and in the directories the
diff touches; those are the rules — the repository has exactly one, inlined below. Then read
the unified diff — it is the change under review.

Report unmet acceptance criteria, broken rules, and bugs. Each finding: the location, what
goes wrong, and evidence checked against the surrounding code. Output a Markdown list of
findings only — no severity, priority, or ranking.

Review by inspection only. Do not modify code, run builds or tests, or invoke quality gates.
Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return
your findings as text in your final message; do not route them through any findings-reporting
tool the host may offer.

---

## The plan (`_bmad-output/plan-ticking-sound-toggle.md`)

---
title: 'A preference for the ticking sound, on by default'
type: 'feature'
ticket: ''
created: '2026-11-25'
status: 'in-review'
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


---

## Repository instruction file (`.github/instructions/codacy.instructions.md`)

---
    description: Configuration for AI behavior when interacting with Codacy's MCP Server
    applyTo: '**'
---
---
# Codacy Rules
Configuration for AI behavior when interacting with Codacy's MCP Server

## CRITICAL: After ANY successful `edit_file` or `reapply` operation
- YOU MUST IMMEDIATELY run the `codacy_cli_analyze` tool from Codacy's MCP Server for each file that was edited, with:
 - `rootPath`: set to the workspace path
 - `file`: set to the path of the edited file
 - `tool`: leave empty or unset
- If any issues are found in the new edits, propose and apply fixes for them.
- > NOTE: Failure to follow this rule is considered a critical error.

## When you tried to run the `codacy_cli_analyze` tool and the Codacy CLI is not installed
- Ask the user 'Codacy CLI is not installed. Would you like me to install it now?'
- If the user responds with "yes", run the `codacy_cli_install` tool and then continue with the original task
- If the user responds with "no", instruct the user that they can disable automatic analysis in the extension settings
- Wait for the user to respond before proceeding with any other actions

## After every response
- If you made any file edits in this conversation, verify you ran `codacy_cli_analyze` tool from Codacy's MCP Server 

## When there are no Codacy MCP Server tools available, or the MCP Server is not reachable
- Suggest the user the following troubleshooting steps:
 - Try to reset the MCP on the extension
 - If the user is using VSCode, suggest them to review their Copilot > MCP settings in Github, under their organization or personal account. Refer them to Settings > Copilot > Enable MCP servers in Copilot. Suggested URL (https://github.com/settings/copilot/features) or https://github.com/organizations/{organization-name}/settings/copilot/features (This can only be done by their organization admins / owners)
- If none of the above steps work, suggest the user to contact Codacy support

## Trying to call a tool that needs a rootPath as a parameter
- Always use the standard, non-URL-encoded file system path

## CRITICAL: Dependencies and Security Checks
- IMMEDIATELY after ANY of these actions:
 - Running npm/yarn/pnpm install
 - Adding dependencies to package.json
 - Adding requirements to requirements.txt
 - Adding dependencies to pom.xml
 - Adding dependencies to build.gradle
 - Any other package manager operations
- You MUST run the `codacy_cli_analyze` tool with:
 - `rootPath`: set to the workspace path
 - `tool`: set to "trivy"
 - `file`: leave empty or unset
- If any vulnerabilities are found because of the newly added packages:
 - Stop all other operations
 - Propose and apply fixes for the security issues
 - Only continue with the original task after security issues are resolved
- EXAMPLE:
 - After: npm install react-markdown
 - Do: Run codacy_cli_analyze with trivy
 - Before: Continuing with any other tasks

## General
- Repeat the relevant steps for each modified file.
- "Propose fixes" means to both suggest and, if possible, automatically apply the fixes.
- You MUST NOT wait for the user to ask for analysis or remind you to run the tool.
- Do not run `codacy_cli_analyze` looking for changes in duplicated code or code complexity metrics.
- Do not run `codacy_cli_analyze` looking for changes in code coverage.
- Do not try to manually install Codacy CLI using either brew, npm, npx, or any other package manager.
- If the Codacy CLI is not installed, just run the `codacy_cli_analyze` tool from Codacy's MCP Server.
- When calling `codacy_cli_analyze`, only send provider, organization and repository if the project is a git repository.

## Whenever a call to a Codacy tool that uses `repository` or `organization` as a parameter returns a 404 error
- Offer to run the `codacy_setup_repository` tool to add the repository to Codacy
- If the user accepts, run the `codacy_setup_repository` tool
- Do not ever try to run the `codacy_setup_repository` tool on your own
- After setup, immediately retry the action that failed (only retry once)
---

---

## The diff (baseline `5961006b3347821927eef241a4b763fe683fe5c4`, branch `main`, staged)

```diff
diff --git a/App.js b/App.js
index fd4fcb8..b679005 100644
--- a/App.js
+++ b/App.js
@@ -31,6 +31,8 @@ import * as SecureStore from 'expo-secure-store'
 
 import MultiSlider from '@ptomasroos/react-native-multi-slider'
 
+import { isHourInActiveRange, isTickingAudible } from './soundGating'
+
 import {
   drawDailyFont,
   isTodayPick,
@@ -48,6 +50,9 @@ const DIGIT_FONTS_KEY = 'digitFonts'
 const DAILY_PICK_KEY = 'dailyFontPick'
 const SHOW_SECONDS_KEY = 'showSeconds'
 const PULSE_SEPARATOR_KEY = 'pulseSeparator'
+// Absent in storage means On: the tick has played since the first build, and neither a
+// fresh install nor an upgrade should lose it.
+const TICKING_SOUND_KEY = 'tickingSound'
 const LEGACY_DIGIT_FONT_KEY = 'digitFont'
 const LEGACY_RANDOM_DAILY_KEY = 'randomDaily'
 
@@ -389,6 +394,11 @@ function App() {
   // ref, not state: it must never re-render or batch with the clock itself.
   const lastChimedQuarter = useRef(null)
 
+  // Whether the looping tick player is currently meant to be running. A ref because
+  // it only exists to make the start/stop below edge-triggered: without it every
+  // minute tick would pause, rewind and seek a player that is already stopped.
+  const tickingRunning = useRef(false)
+
   const CHIMING_TIME_RANGE = 'chimingTimeRange'
   const [chimingTimeRange, setChimingTimeRange] = useState(null)
 
@@ -399,6 +409,9 @@ function App() {
   const [dailyPick, setDailyPick] = useState(null)
   const [showSeconds, setShowSeconds] = useState(null)
   const [pulseSeparator, setPulseSeparator] = useState(null)
+  // null until loaded, and treated as On while unloaded — the same default storage
+  // gives a missing key — so the pill never shows Off for a value nobody chose.
+  const [tickingSound, setTickingSound] = useState(null)
   // Until the prefs load finishes, the font controls are shown but inert, so a
   // early tap can't be clobbered by (or clobber) the values init is reading.
   const [fontPrefsLoaded, setFontPrefsLoaded] = useState(false)
@@ -635,6 +648,19 @@ function App() {
     )
   }
 
+  const initTickingPref = async () => {
+    try {
+      const saved = await SecureStore.getItemAsync(TICKING_SOUND_KEY)
+      const stored = saved === null ? null : JSON.parse(saved)
+      // Anything other than an explicit `false` — a key never written, or a value this
+      // version does not recognise — means On.
+      setTickingSound(stored !== false)
+    } catch {
+      // Unreadable: leave it unloaded, which renders and sounds as On, and the save
+      // effect below skips it so a bad read cannot overwrite an intact value.
+    }
+  }
+
   const initDigitFontPrefs = async () => {
     // Only successful reads write state. A corrupt or unreadable stored value
     // leaves prefs null (renders as every offered font) and is never written back
@@ -709,14 +735,16 @@ function App() {
 
     const tick = createAudioPlayer(require('./assets/ticktack.mp3'))
     setTickSound(tick)
+    // Looping, but deliberately not started here: the gate below owns the first start,
+    // so nothing sounds before the preference and the time range are known.
     tick.loop = true
-    tick.play()
   }
 
   useEffect(() => {
     ;(async () => {
       await setAudioModeAsync({ playsInSilentMode: true })
       await initChimingTime()
+      await initTickingPref()
       await initDigitFontPrefs()
       initSounds()
     })()
@@ -805,33 +833,49 @@ function App() {
     return () => breath.stop()
   }, [pulseSeparator, firstScreen, separatorPulse])
 
-  const isSoundEnabled = () => {
-    const currentHour = dayjs(currentTime).hour()
-
-    if (
-      currentHour >= chimingTimeRange?.min &&
-      currentHour < chimingTimeRange?.max
-    ) {
-      return true
-    }
-    return false
-  }
-
+  // The bells' quiet-hours rule, delegated to the shared module so the ticking cannot
+  // drift into disagreeing with it about which hours are active.
+  const isSoundEnabled = () =>
+    isHourInActiveRange(dayjs(currentTime).hour(), chimingTimeRange)
+
+  // The tick's own switch sits on top of that window: preference first, then hours.
+  // Off stops the looping player instead of muting it — a muted loop keeps decoding
+  // all day — and rewinding on the way out means the next start begins at the top of
+  // the clip rather than half-way through a "tick". The ref makes this edge-triggered,
+  // so the minute tick that calls it as hours pass by costs nothing when nothing
+  // changed.
   const resetTicking = () => {
-    if (tickSound) tickSound.volume = isSoundEnabled() ? 1 : 0
+    if (!tickSound) return
+    const audible = isTickingAudible({
+      enabled: tickingSound,
+      hour: dayjs(currentTime).hour(),
+      range: chimingTimeRange,
+    })
+    if (audible === tickingRunning.current) return
+    tickingRunning.current = audible
+    if (audible) {
+      tickSound.play()
+    } else {
+      tickSound.pause()
+      tickSound.seekTo(0).catch(() => {})
+    }
   }
 
   useEffect(() => {
-    resetTicking()
     if (chimingTimeRange) {
       SecureStore.setItemAsync(
         CHIMING_TIME_RANGE,
         JSON.stringify(chimingTimeRange),
       )
     }
-    // console.log({ chimingTimeRange: JSON.stringify(chimingTimeRange) })
   }, [chimingTimeRange])
 
+  // The tick follows its switch, the active range and the player arriving. A tap on
+  // the pill gets through here; hour boundaries get through on the minute tick below.
+  useEffect(() => {
+    resetTicking()
+  }, [tickSound, tickingSound, chimingTimeRange])
+
   useEffect(() => {
     if (digitFonts) persistPref(DIGIT_FONTS_KEY, digitFonts)
   }, [digitFonts])
@@ -849,6 +893,12 @@ function App() {
       persistPref(PULSE_SEPARATOR_KEY, pulseSeparator)
   }, [pulseSeparator])
 
+  // Guarded on the loaded state like its siblings: while the read is outstanding — or
+  // if it failed — nothing is written, so a default can never overwrite a stored one.
+  useEffect(() => {
+    if (tickingSound !== null) persistPref(TICKING_SOUND_KEY, tickingSound)
+  }, [tickingSound])
+
   // The hour and minute are the quarter's own, so a chime that lands late still
   // sounds the bell for the hour it is announcing.
   const play = async (hour, minute) => {
@@ -882,7 +932,8 @@ function App() {
     play(boundary.hour(), boundary.minute())
   }, [currentTime])
 
-  // The tick volume follows the active time range as hours pass by it.
+  // The minute tick is what notices an hour crossing the edge of the active range while
+  // the app sits open; the gate itself no-ops unless something actually changed.
   useEffect(() => {
     resetTicking()
   }, [currentMinute])
@@ -1160,6 +1211,14 @@ function App() {
                   value: pulseSeparator === true,
                   onToggle: () => setPulseSeparator(pulseSeparator !== true),
                 },
+                // The one sound control in this row. It reads On while its value is
+                // still loading, matching the default and the gate that drives the
+                // player, and tapping it then turns the tick off rather than on.
+                {
+                  label: 'Ticking sound',
+                  value: tickingSound !== false,
+                  onToggle: () => setTickingSound(tickingSound === false),
+                },
               ].map(({ label, value, onToggle }) => (
                 <Pressable
                   key={label}
diff --git a/__tests__/soundGating.test.js b/__tests__/soundGating.test.js
new file mode 100644
index 0000000..13b74cf
--- /dev/null
+++ b/__tests__/soundGating.test.js
@@ -0,0 +1,104 @@
+import { isHourInActiveRange, isTickingAudible } from '../soundGating'
+
+// Each describe is named after a row of the plan's I/O & Edge-Case Matrix, so the
+// audit can see at a glance which rows have a test and which stay device-only.
+
+describe('active range rule (shared by bells and ticking)', () => {
+  it('treats the lower bound as inclusive', () => {
+    expect(isHourInActiveRange(8, { min: 8, max: 12 })).toBe(true)
+  })
+
+  it('treats the upper bound as exclusive', () => {
+    expect(isHourInActiveRange(11, { min: 8, max: 12 })).toBe(true)
+    expect(isHourInActiveRange(12, { min: 8, max: 12 })).toBe(false)
+  })
+
+  it('is silent outside the range on both sides', () => {
+    expect(isHourInActiveRange(7, { min: 8, max: 12 })).toBe(false)
+    expect(isHourInActiveRange(13, { min: 8, max: 12 })).toBe(false)
+  })
+
+  it('is silent while no range has been loaded yet', () => {
+    expect(isHourInActiveRange(12, null)).toBe(false)
+    expect(isHourInActiveRange(12, undefined)).toBe(false)
+  })
+
+  it('covers every hour of a whole-day range', () => {
+    expect(isHourInActiveRange(0, { min: 0, max: 24 })).toBe(true)
+    expect(isHourInActiveRange(23, { min: 0, max: 24 })).toBe(true)
+    expect(isHourInActiveRange(24, { min: 0, max: 24 })).toBe(false)
+  })
+
+  it('behaves exactly like the comparison it replaced for odd stored bounds', () => {
+    // Not an endorsement of these values — a promise that extraction changed nothing.
+    expect(isHourInActiveRange(12, { min: null, max: 24 })).toBe(
+      12 >= null && 12 < 24,
+    )
+    expect(isHourInActiveRange(12, { min: 'abc', max: 24 })).toBe(false)
+  })
+})
+
+describe('Fresh install — no stored preference', () => {
+  it('has the ticking on inside the range', () => {
+    expect(
+      isTickingAudible({
+        enabled: undefined,
+        hour: 9,
+        range: { min: 8, max: 12 },
+      }),
+    ).toBe(true)
+  })
+})
+
+describe('Upgrade from older build — key absent means on', () => {
+  it('treats an unloaded preference as on rather than off', () => {
+    expect(
+      isTickingAudible({ enabled: null, hour: 9, range: { min: 0, max: 24 } }),
+    ).toBe(true)
+  })
+})
+
+describe('Off, hour enters active range', () => {
+  it('stays silent however wide the window is', () => {
+    expect(
+      isTickingAudible({ enabled: false, hour: 9, range: { min: 0, max: 24 } }),
+    ).toBe(false)
+  })
+
+  it('stays silent at the moment the window opens', () => {
+    expect(
+      isTickingAudible({ enabled: false, hour: 8, range: { min: 8, max: 12 } }),
+    ).toBe(false)
+  })
+})
+
+describe('On, hour crosses into range while app is open', () => {
+  it('becomes audible as soon as the hour is inside', () => {
+    expect(
+      isTickingAudible({ enabled: true, hour: 7, range: { min: 8, max: 12 } }),
+    ).toBe(false)
+    expect(
+      isTickingAudible({ enabled: true, hour: 8, range: { min: 8, max: 12 } }),
+    ).toBe(true)
+  })
+
+  it('goes quiet again the moment the window closes', () => {
+    expect(
+      isTickingAudible({ enabled: true, hour: 12, range: { min: 8, max: 12 } }),
+    ).toBe(false)
+  })
+})
+
+describe('Stored value unreadable', () => {
+  it('falls back to on, the behaviour a clock that always ticked should keep', () => {
+    expect(
+      isTickingAudible({ enabled: null, hour: 10, range: { min: 0, max: 24 } }),
+    ).toBe(true)
+  })
+
+  it('still respects the window while unloaded', () => {
+    expect(
+      isTickingAudible({ enabled: null, hour: 3, range: { min: 8, max: 12 } }),
+    ).toBe(false)
+  })
+})
diff --git a/_bmad-output/plan-ticking-sound-toggle.md b/_bmad-output/plan-ticking-sound-toggle.md
new file mode 100644
index 0000000..1fe9c86
--- /dev/null
+++ b/_bmad-output/plan-ticking-sound-toggle.md
@@ -0,0 +1,122 @@
+---
+title: 'A preference for the ticking sound, on by default'
+type: 'feature'
+ticket: ''
+created: '2026-11-25'
+status: 'in-review'
+baseline_revision: '5961006b3347821927eef241a4b763fe683fe5c4'
+route: 'full'
+route_source: 'pinned'
+risk: 'medium'
+review: 'quick'
+review_source: 'pinned'
+lenses_ran: []
+review_loop_iteration: 0
+context: []
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** The ticking loop has no switch. Only the chime time range silences it, and that range is really the *chime* window — so someone who likes the bells but not the constant tick cannot have that, and someone outside the window cannot turn the tick back on.
+
+**Approach:** One persisted preference, "Ticking sound", defaulting to On, gating only the looping tick player; the chimes keep exactly the behaviour they have now.
+
+## Boundaries & Constraints
+
+**Always:** a missing stored value means On (fresh install and upgrade alike); Off really stops the looping player rather than muting it; ticking sounds when and only when the preference is On *and* the hour is inside the active range; a failed SecureStore read leaves state untouched and writes nothing back; the control reuses the existing toggle pill.
+
+**Never:** do not change what `isSoundEnabled()` means for chimes, nor the quarter-hour boundary logic; no new dependencies and no new audio assets (no synthesised tick); no volume control, no second quiet-hours control; do not persist while prefs are still loading.
+
+## Decisions (settled with the human at planning)
+
+- **Scope:** the preference governs the ticking only. The quarter-hour chimes keep their current rule untouched.
+- **"Off" is a real stop:** the looping player is paused and rewound, not muted.
+- **Default is On**, including for installs upgrading from an older build with no stored value.
+- **Placement:** a third pill in the existing toggle row beside Show seconds / Pulsing separator, inheriting its styling and load-time inertness.
+- **Launch blip is fixed as part of this work:** nothing sounds until the preference and the time range are known, so the gate owns the player's first start.
+- **Plan size** (~1800 tokens) kept in full at the human's choice; the excess is Code Map anchoring.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| Fresh install | key absent | ticking plays inside the active range, pill shows On | no error expected |
+| Upgrade from an older build | key absent | same as fresh — On, nothing to migrate | no error expected |
+| Tap Off mid-tick | player looping | stops on that tap and rewinds to the top of the clip | no error expected |
+| Tap back On | paused at 0 | restarts from the top of the clip, never mid-"tick" | no error expected |
+| Off, hour enters active range | pref false, window opens | stays silent | no error expected |
+| On, hour crosses into range while app is open | pref true | resumes on the next minute tick | no error expected |
+| Stored value unreadable | read throws or JSON is corrupt | state stays unloaded, pill shows On, nothing written back | caught; never persisted over |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `App.js:47-52` -- pref key constants; add `TICKING_SOUND_KEY` beside `SHOW_SECONDS_KEY`.
+- `App.js:80` -- `persistPref(key, value)`: best-effort write, already swallows failures. Reuse as-is.
+- `App.js:381-385` -- sound state; `tickSound` holds the player. The new boolean belongs with the other prefs at `App.js:400-404`, which are `null` until loaded.
+- `App.js:629-637` -- `initChimingTime`: the house pattern for a sound pref with a default.
+- `App.js:639-685` -- `initDigitFontPrefs`: null-until-loaded reads inside one `try`; the new read belongs in the same init sequence.
+- `App.js:714-715` -- `tick.loop = true; tick.play()`: the unconditional autoplay that must move behind the gate.
+- `App.js:808-822` -- `isSoundEnabled()` (the hour-window rule) and `resetTicking()` (the only writer of tick volume). `resetTicking` becomes the start/stop decision.
+- `App.js:824-833`, `App.js:885-887` -- the two effects calling `resetTicking`, keyed `[chimingTimeRange]` and `[currentMinute]`; both need the preference in their deps.
+- `App.js:852-862` -- `play()` uses `isSoundEnabled()` for chime volume. **Do not change.**
+- `App.js:1072,1079` -- `fontPrefsLoaded` makes the settings group inert and dimmed until prefs land; the toggle row is inside it.
+- `App.js:1152-1163` -- the pill array (`Show seconds`, `Pulsing separator`); styling is inline in the `.map`, so a new entry needs no new styles.
+- `fontSelection.js`, `jest.config.js`, `__tests__/` -- precedent from last change: pure extracted rules with no React Native imports, run under node jest.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [ ] `soundGating.js` -- extract the active-range rule out of `isSoundEnabled` into a pure function (hour, range) → boolean, keeping min inclusive and max exclusive exactly as today.
+- [ ] `__tests__/soundGating.test.js` -- cover the pure rows: boundary at `min`, boundary at `max`, hour outside, unset range, and a false preference silencing regardless of window.
+- [ ] `App.js` -- add `TICKING_SOUND_KEY`, the `tickingSound` state (null until loaded), its read in the init sequence defaulting to On, and its persist effect guarded against the unloaded state.
+- [ ] `App.js` -- make `resetTicking` start/stop rather than set volume: play when preference On and window open, otherwise pause and rewind to 0; drop the unconditional autoplay from `initSounds`; add the preference to both effect dep arrays that call it.
+- [ ] `App.js` -- have `isSoundEnabled()` delegate to the extracted rule, so chimes and ticking share one truth and the chime behaviour is provably unchanged.
+- [ ] `App.js` -- add the pill as a third entry in the existing toggle row (`App.js:1152-1163`).
+
+**Acceptance Criteria:**
+- Given a fresh install, when the app runs inside the active range, then ticking sounds and the control reads On with no taps.
+- Given ticking On, when the user taps it Off, then sound stops on that tap and stays stopped across minute boundaries and hour crossings until tapped again.
+- Given ticking Off, when the app is closed and reopened, then it is still Off.
+- When the preference is toggled either way, then the quarter-hour chimes behave exactly as before.
+- Given storage cannot be read, when init finishes, then the control reads On and nothing has been written to storage.
+
+## Implementation Notes
+
+Implemented from this plan; no deviations from the frozen block.
+
+- New `soundGating.js` holds two pure rules: `isHourInActiveRange(hour, range)` — deliberately the *same expression* the app had inline (`hour >= range?.min && hour < range?.max`), so extraction cannot change what the bells do, odd stored bounds included — and `isTickingAudible({ enabled, hour, range })`, which layers the preference on top of it. Anything not an explicit `false` counts as On, which serves fresh install, upgrade and unreadable value with one rule.
+- `App.js`: `TICKING_SOUND_KEY`, a `tickingSound` state (`null` until loaded), `initTickingPref` awaited between `initChimingTime` and `initDigitFontPrefs`, a persist effect guarded on the loaded state, and the pill as the third entry of the existing row (so it inherits the row's styling and its load-time inertness).
+- `resetTicking` no longer touches volume. It asks `isTickingAudible`, compares against a `tickingRunning` ref, and acts only on a change: `play()` going in, `pause()` + `seekTo(0)` going out. The ref is what keeps the per-minute call from re-seeking an already-stopped player every sixty seconds.
+- `tick.play()` is gone from `initSounds`; the gate owns the first start, which is why nothing sounds at launch before prefs are known. Only the chime path still sets `volume`.
+- The `[chimingTimeRange]` effect now only persists the range (and its dead `console.log` line went with the rewrite); a dedicated effect keyed `[tickSound, tickingSound, chimingTimeRange]` owns the tick, and the existing `[currentMinute]` effect still carries hour crossings.
+- Chime gating (`play`, `isSoundEnabled` semantics) untouched: `isSoundEnabled` is now a one-line delegation to the extracted rule.
+
+Matrix Test Audit: 14 new tests in `__tests__/soundGating.test.js` (34 total, all passing). Covered by tests: fresh install, upgrade with no key, off while the window opens, on as an hour crosses in and out, unreadable value falling back to On while still respecting the window, plus the boundary rows of the shared rule. Not testable here: "Tap Off mid-tick" and "Tap back On", and the storage glue behind fresh install / upgrade / unreadable — those are `expo-audio` player side effects and SecureStore reads, and this project has no `jest-expo` renderer by deliberate choice, so they remain the device checks listed under Verification.
+
+## Plan Change Log
+
+## Review Triage Log
+
+## Design Notes
+
+Stopping rather than muting: a muted `loop = true` native player keeps decoding all day for nothing. `pause()` then `seekTo(0)` makes the next start begin at the top of the clip instead of half-way through a "tick"; the un-awaited `seekTo` follows the precedent in `play()` (`App.js:859`).
+
+The window rule is extracted rather than re-implemented for ticking, because two copies of "is this hour inside the range" is exactly how chimes and ticks end up disagreeing about quiet hours.
+
+## Verification
+
+**Commands:**
+- `npx eslint App.js soundGating.js __tests__/soundGating.test.js` -- expected: exit 0 (baseline is clean)
+- `npx prettier --check App.js soundGating.js __tests__/soundGating.test.js` -- expected: unchanged
+- `npx jest` -- expected: existing font-selection tests plus the new gating tests pass
+- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` -- expected: Hermes bundle produced without errors
+
+**Manual checks (device only):**
+- Given a fresh install, then ticking is audible inside the range and the pill reads On.
+- Given ticking playing, when tapped Off, then silence follows immediately and survives an hour crossing into the range; tapping On again restarts from the top of the clip.
+- Given ticking Off, kill and relaunch: still Off, and no tick sounds at launch before the settings screen is opened.
+- Given any state of the new pill, the quarter-hour bells still ring inside the range at the same loudness as before.
diff --git a/soundGating.js b/soundGating.js
new file mode 100644
index 0000000..8f82a1b
--- /dev/null
+++ b/soundGating.js
@@ -0,0 +1,22 @@
+// The quiet-hours rule and the one thing layered on top of it, kept free of React,
+// React Native and the audio player so they can be tested on their own (see
+// __tests__). Both the quarter-hour bells and the ticking ask these questions, so a
+// change to when sound is allowed has one answer rather than two that can drift apart.
+
+// Deliberately the same expression the app has always used — optional chaining into
+// the stored range and nothing else — because extracting a rule is no licence to
+// change it: an unset range means silent, and a range whose bounds are not numbers
+// behaves exactly as the comparison it replaced did. `min` is inclusive and `max`
+// exclusive, so 0..24 is every hour and 8..12 is 8am through 11am.
+export function isHourInActiveRange(hour, range) {
+  return hour >= range?.min && hour < range?.max
+}
+
+// Whether the ticking should be running. Its own switch sits on top of the shared
+// window: anything that is not an explicit `false` counts as On, which is both the
+// default for a fresh install and for an upgrade from a build that never stored the
+// preference — and it is what an unreadable stored value falls back to, so a
+// SecureStore hiccup cannot silently silence a clock whose tick has always played.
+export function isTickingAudible({ enabled, hour, range }) {
+  return enabled !== false && isHourInActiveRange(hour, range)
+}
```
