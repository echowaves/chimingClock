# Quick review lens — run this in a separate session

The BMad `bmad-build` review could not launch its reviewer subagent in the build
session (no model endpoint available), so per the workflow the lens prompt is
written out here with every file it points to inlined. Run this as a fresh,
context-free session — ideally on a different LLM — and paste the findings back into
the build session.

Reviewer instruction (verbatim from the workflow):

> Read the plan below — it holds the acceptance criteria and intent — and the files
> its frontmatter `context:` lists (there are none). Read the agent instruction files
> (`AGENTS.md`, `CLAUDE.md`, or equivalents) at the repository root and in the
> directories the diff touches; those are the rules. Then read the unified diff below
> — it is the change under review.
>
> Report unmet acceptance criteria, broken rules, and bugs. Each finding: the
> location, what goes wrong, and evidence checked against the surrounding code.
> Output a Markdown list of findings only — no severity, priority, or ranking.
>
> Review by inspection only. Do not modify code, run builds or tests, or invoke
> quality gates. Do not invoke any skill, and do not spawn subagents of your own —
> you are the reviewer. Return your findings as text in your final message; do not
> route them through any findings-reporting tool the host may offer.

Repository: `/Users/dmitry/hacks/chimingClock` (Expo / React Native 0.88 app). The
changed files on disk are `App.js`, `fontSelection.js`, `__tests__/fontSelection.test.js`,
`jest.config.js`, `package.json`, `.eslintrc.js`; the diff below is against baseline
commit `9e609a3a9956a24c4bfdc891b288eedd69a32a30`. You may open those files for
surrounding context.

## Agent instruction files in this repository

`AGENTS.md` and `CLAUDE.md` do not exist. The only agent rule file is
`.github/instructions/codacy.instructions.md`:

```markdown
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
```

## Plan (claims file) — `_bmad-output/plan-font-rotation-set-and-display-toggles.md`

```markdown
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

```

## Unified diff since `9e609a3` (untracked files included)

```diff
diff --git a/.eslintrc.js b/.eslintrc.js
index 6586657..9fb4ce4 100644
--- a/.eslintrc.js
+++ b/.eslintrc.js
@@ -24,3 +24,10 @@ exports.rules = {
   'import/no-unresolved': ['error', { ignore: ['^expo-', '^@expo/'] }],
 }
 exports.plugins = ['prettier']
+// Jest's globals are only in scope inside the test suite.
+exports.overrides = [
+  {
+    files: ['__tests__/**/*.js'],
+    env: { jest: true },
+  },
+]
diff --git a/App.js b/App.js
index 1c08e18..ca0f6d5 100644
--- a/App.js
+++ b/App.js
@@ -2,6 +2,7 @@
 import { useEffect, useMemo, useRef, useState } from 'react'
 import {
   Animated,
+  Easing,
   Platform,
   Pressable,
   StyleSheet,
@@ -30,9 +31,38 @@ import * as SecureStore from 'expo-secure-store'
 
 import MultiSlider from '@ptomasroos/react-native-multi-slider'
 
-const DIGIT_FONT_KEY = 'digitFont'
-const RANDOM_DAILY_KEY = 'randomDaily'
-const DEFAULT_FONT = 'default'
+import {
+  drawDailyFont,
+  isTodayPick,
+  nextSelection,
+  resolveSelectedFonts,
+  rotationPool,
+  todayKey,
+} from './fontSelection'
+
+// Preferences. `digitFonts` is the set the clock rotates through and
+// `dailyFontPick` is today's draw from it, `{ id, date }`, kept so a relaunch
+// later the same day shows the face the user already saw. The two legacy keys are
+// read once for migration and then deleted.
+const DIGIT_FONTS_KEY = 'digitFonts'
+const DAILY_PICK_KEY = 'dailyFontPick'
+const SHOW_SECONDS_KEY = 'showSeconds'
+const PULSE_SEPARATOR_KEY = 'pulseSeparator'
+const LEGACY_DIGIT_FONT_KEY = 'digitFont'
+const LEGACY_RANDOM_DAILY_KEY = 'randomDaily'
+
+// Display options. The seconds are a third of the digit height, which keeps them
+// readable across the room while leaving the corner they occupy to themselves;
+// the separator breathes between full opacity and a fifth of it, half a cycle
+// each way, so one breath reads as ~3s.
+const SECONDS_SCALE = 0.3
+const PULSE_MIN_OPACITY = 0.2
+const PULSE_HALF_PERIOD_MS = 1500
+
+// Best-effort persist: a SecureStore failure keeps the choice for this session
+// rather than throwing inside an effect.
+const persistPref = (key, value) =>
+  SecureStore.setItemAsync(key, JSON.stringify(value)).catch(() => {})
 
 // Each digit font carries the weight it wants. iOS answers a `fontFamily` request
 // with the face in that family whose weight is closest to the one asked for
@@ -42,7 +72,6 @@ const DEFAULT_FONT = 'default'
 // both of them look thin. Families without an iOS face fall back to the Android
 // family named beside them.
 const FONTS = {
-  default: { label: 'Default', weight: '600', style: {} },
   serif: {
     label: 'Serif',
     weight: '600',
@@ -132,33 +161,9 @@ const FONTS = {
   },
 }
 
-// Daily mode picks among these only, so "surprise me" never shows the default
-// look. Derived from FONTS so a font can never be in one list but not the other;
-// narrowed to the fonts this device has where that is known.
-const DAILY_FONT_POOL = Object.keys(FONTS).filter((id) => id !== DEFAULT_FONT)
-
-// Pure helpers (no state): the same local date always derives the same font id.
-const dayOfYear = (now) => now.startOf('day').diff(now.startOf('year'), 'day')
-
-const dailyFontId = (now, pool) =>
-  pool.length === 0 ? DEFAULT_FONT : pool[dayOfYear(now) % pool.length]
-
-const normalizeFontId = (id) => (FONTS[id] ? id : DEFAULT_FONT)
-
-// `availableFontIds` is the ids measured on this device, or null while that is
-// still unknown. A face the device lacks would only ever draw the system font, so
-// daily mode skips it and a stored choice of it falls back to Default — which is
-// what the digits are already showing, and keeps the highlighted button honest.
-const activeFontId = (randomDaily, digitFont, now, availableFontIds) => {
-  const pool = availableFontIds
-    ? availableFontIds.filter((id) => id !== DEFAULT_FONT)
-    : DAILY_FONT_POOL
-  const wanted =
-    randomDaily === true ? dailyFontId(now, pool) : normalizeFontId(digitFont)
-  if (availableFontIds && !availableFontIds.includes(wanted))
-    return DEFAULT_FONT
-  return normalizeFontId(wanted)
-}
+// Every face the app ships. Device availability is measured separately; this is the
+// universe a stored selection is validated against.
+const ALL_FONT_IDS = Object.keys(FONTS)
 
 // Clock-face layout. The fitting box is the motion box (the clock screen as
 // laid out, safe-area insets included) inset by a travel margin on each side,
@@ -269,13 +274,8 @@ const isDefaultFamilyFont = (id) =>
   (DEFAULT_FAMILY_FONT_IDS[Platform.OS] || []).includes(id)
 
 // Measured ids and declared ones, computed once: the platform never changes mid-run.
-const ALL_NON_DEFAULT_FONT_IDS = Object.keys(FONTS).filter(
-  (id) => id !== DEFAULT_FONT,
-)
-const MEASURED_FONT_IDS = ALL_NON_DEFAULT_FONT_IDS.filter(
-  (id) => !isDefaultFamilyFont(id),
-)
-const DECLARED_FONT_IDS = ALL_NON_DEFAULT_FONT_IDS.filter(isDefaultFamilyFont)
+const MEASURED_FONT_IDS = ALL_FONT_IDS.filter((id) => !isDefaultFamilyFont(id))
+const DECLARED_FONT_IDS = ALL_FONT_IDS.filter(isDefaultFamilyFont)
 
 const fontProbeKey = (id) => id
 const systemProbeKey = (weight) => `system:${weight}`
@@ -370,9 +370,13 @@ function App() {
   const CHIMING_TIME_RANGE = 'chimingTimeRange'
   const [chimingTimeRange, setChimingTimeRange] = useState(null)
 
-  // null means "not loaded from SecureStore yet"; renders fall back to default.
-  const [digitFont, setDigitFont] = useState(null)
-  const [randomDaily, setRandomDaily] = useState(null)
+  // null means "not loaded from SecureStore yet"; renders fall back to the pool of
+  // every font this device offers.
+  const [digitFonts, setDigitFonts] = useState(null)
+  // Today's draw as `{ id, date }`; null until loaded or drawn.
+  const [dailyPick, setDailyPick] = useState(null)
+  const [showSeconds, setShowSeconds] = useState(null)
+  const [pulseSeparator, setPulseSeparator] = useState(null)
   // Until the prefs load finishes, the font controls are shown but inert, so a
   // early tap can't be clobbered by (or clobber) the values init is reading.
   const [fontPrefsLoaded, setFontPrefsLoaded] = useState(false)
@@ -417,9 +421,6 @@ function App() {
     )
     if (outstanding) return null
     return [
-      // The default asks for no family, so it is the system font by definition and
-      // always available.
-      DEFAULT_FONT,
       ...DECLARED_FONT_IDS,
       ...MEASURED_FONT_IDS.filter((id) =>
         fontMetricsDiffer(
@@ -431,17 +432,26 @@ function App() {
   }, [fontProbeMetrics])
 
   const offeredFontIds = availableFontIds
-    ? Object.keys(FONTS).filter((id) => availableFontIds.includes(id))
-    : Object.keys(FONTS)
-
-  // Recomputed on each render (the clock ticks every second), so a new local
-  // date picks up the new daily font without extra state or timers.
-  const currentFontId = activeFontId(
-    randomDaily,
-    digitFont,
-    currentTime,
-    availableFontIds,
-  )
+    ? ALL_FONT_IDS.filter((id) => availableFontIds.includes(id))
+    : ALL_FONT_IDS
+
+  // What the clock may draw, and what the picker shows as selected: the saved set
+  // narrowed to this device, or every offered face when nothing valid is saved. A
+  // single entry means that font always; several rotate at local midnight.
+  const activePool = rotationPool(digitFonts, offeredFontIds)
+
+  // Tapping off the last remaining face is refused rather than emptying the pool —
+  // an empty selection has no honest rendering. Adding a face keeps `FONTS` order,
+  // because `rotationPool` intersects over the offered list.
+  const toggleFont = (id) => setDigitFonts(nextSelection(activePool, id))
+
+  // Today's face, taken from the stored pick so a relaunch inside the same day
+  // redraws what the user already saw. Until today's draw lands — first render, or
+  // a selection that just changed — the pool's first entry draws, which keeps every
+  // `FONTS` lookup honest without a second source of truth.
+  let currentFontId = activePool.length > 0 ? activePool[0] : ALL_FONT_IDS[0]
+  if (isTodayPick(dailyPick, currentTime) && activePool.includes(dailyPick.id))
+    currentFontId = dailyPick.id
 
   // The font family and weight only; each user sets its own size.
   const fontSpecs = {
@@ -449,6 +459,16 @@ function App() {
     ...FONTS[currentFontId].style,
   }
 
+  // The separator needs its own element to breathe on its own, because nested Text
+  // children cannot carry an Animated style. It stays at full opacity unless the
+  // loop below is running.
+  const separatorPulse = useRef(new Animated.Value(1)).current
+
+  // Split out of the very string the hidden probe measures, so the fitted size and
+  // the travel walls stay derived from the whole `h:mm`.
+  const [hoursText, minutesText] = currentText.split(':')
+  const secondsText = currentTime.format('ss')
+
   // The digits' natural box at MEASURE_SIZE, as the probe below reports it; null
   // until the first measurement arrives. Only the font and the time string affect
   // it, never the window size: the fitting size is derived from these numbers on
@@ -489,6 +509,14 @@ function App() {
     ? digitMetrics.height * digitScale
     : fitHeight
 
+  // Shared by the three pieces of the clock row and the seconds overlay, so every
+  // glyph on screen carries one colour and one font spec.
+  const digitTextStyle = {
+    ...fontSpecs,
+    fontSize: digitFontSize,
+    color: '#d0fcc5',
+  }
+
   // How far from centre each axis may drift before its wall: half the free
   // space in the motion box, less the ink slack. Computed on every render and
   // shared by the bounce in the clock effect and the placement in the clock
@@ -511,17 +539,46 @@ function App() {
 
   const initDigitFontPrefs = async () => {
     // Only successful reads write state. A corrupt or unreadable stored value
-    // leaves prefs null (renders as default) and is never written back over,
-    // so a transient SecureStore failure can't destroy intact prefs.
+    // leaves prefs null (renders as every offered font) and is never written back
+    // over, so a transient SecureStore failure can't destroy intact prefs.
     try {
-      const storedFont = JSON.parse(
-        await SecureStore.getItemAsync(DIGIT_FONT_KEY),
+      // The saved set wins; a single legacy face becomes a one-element set; a value
+      // the app no longer ships — the old "default" included — is dropped, and an
+      // install with nothing usable starts on every font it offers.
+      setDigitFonts(
+        resolveSelectedFonts({
+          saved: JSON.parse(await SecureStore.getItemAsync(DIGIT_FONTS_KEY)),
+          legacyFontId: JSON.parse(
+            await SecureStore.getItemAsync(LEGACY_DIGIT_FONT_KEY),
+          ),
+          allIds: ALL_FONT_IDS,
+        }),
+      )
+
+      const savedPick = JSON.parse(
+        await SecureStore.getItemAsync(DAILY_PICK_KEY),
       )
-      setDigitFont(normalizeFontId(storedFont))
+      // Whether that pick is still today's, and still selectable, belongs to the
+      // effect that owns drawing; here it only has to be well-formed.
+      if (
+        savedPick &&
+        typeof savedPick.date === 'string' &&
+        FONTS[savedPick.id]
+      )
+        setDailyPick(savedPick)
 
-      const storedRandomDaily =
-        JSON.parse(await SecureStore.getItemAsync(RANDOM_DAILY_KEY)) === true
-      setRandomDaily(storedRandomDaily)
+      setShowSeconds(
+        JSON.parse(await SecureStore.getItemAsync(SHOW_SECONDS_KEY)) === true,
+      )
+      setPulseSeparator(
+        JSON.parse(await SecureStore.getItemAsync(PULSE_SEPARATOR_KEY)) ===
+          true,
+      )
+
+      // Both legacy keys are gone from the app: drop them so an upgrade leaves no
+      // dead values behind.
+      SecureStore.deleteItemAsync(LEGACY_DIGIT_FONT_KEY).catch(() => {})
+      SecureStore.deleteItemAsync(LEGACY_RANDOM_DAILY_KEY).catch(() => {})
     } catch {
       // treat as unset; save-effect guards skip persisting while null
     } finally {
@@ -603,6 +660,53 @@ function App() {
     }
   }, [currentTime])
 
+  // One face per local day, never the one the day before showed. Runs on every tick
+  // so midnight is caught while the app stays open, and whenever the selection or
+  // the device's font list settles; the guard makes all other ticks a no-op. A
+  // selection that no longer contains today's face redraws at once, so the drawn
+  // font is always one the picker offers as selected.
+  useEffect(() => {
+    if (!digitFonts) return
+    const pool = rotationPool(digitFonts, offeredFontIds)
+    if (pool.length === 0) return
+    if (isTodayPick(dailyPick, currentTime) && pool.includes(dailyPick.id))
+      return
+    setDailyPick({
+      id: drawDailyFont(pool, dailyPick ? dailyPick.id : null),
+      date: todayKey(currentTime),
+    })
+  }, [currentTime, digitFonts, offeredFontIds, dailyPick])
+
+  // The separator's breath: half a cycle down to PULSE_MIN_OPACITY, half back up,
+  // entirely on the native thread so the fade costs no re-render. It runs only while
+  // the clock is actually showing and the option is on — otherwise the value is put
+  // back at full opacity, so switching it off leaves a steady colon rather than
+  // freezing mid-breath or animating an unmounted view.
+  useEffect(() => {
+    if (pulseSeparator !== true || firstScreen) {
+      separatorPulse.setValue(1)
+      return undefined
+    }
+    const breath = Animated.loop(
+      Animated.sequence([
+        Animated.timing(separatorPulse, {
+          toValue: PULSE_MIN_OPACITY,
+          duration: PULSE_HALF_PERIOD_MS,
+          easing: Easing.inOut(Easing.ease),
+          useNativeDriver: true,
+        }),
+        Animated.timing(separatorPulse, {
+          toValue: 1,
+          duration: PULSE_HALF_PERIOD_MS,
+          easing: Easing.inOut(Easing.ease),
+          useNativeDriver: true,
+        }),
+      ]),
+    )
+    breath.start()
+    return () => breath.stop()
+  }, [pulseSeparator, firstScreen, separatorPulse])
+
   const isSoundEnabled = () => {
     const currentHour = dayjs(currentTime).hour()
 
@@ -631,25 +735,21 @@ function App() {
   }, [chimingTimeRange])
 
   useEffect(() => {
-    if (digitFont) {
-      SecureStore.setItemAsync(DIGIT_FONT_KEY, JSON.stringify(digitFont)).catch(
-        () => {
-          // best-effort persist: keep the choice for this session on failure
-        },
-      )
-    }
-  }, [digitFont])
+    if (digitFonts) persistPref(DIGIT_FONTS_KEY, digitFonts)
+  }, [digitFonts])
 
   useEffect(() => {
-    if (randomDaily !== null) {
-      SecureStore.setItemAsync(
-        RANDOM_DAILY_KEY,
-        JSON.stringify(randomDaily),
-      ).catch(() => {
-        // best-effort persist: keep the choice for this session on failure
-      })
-    }
-  }, [randomDaily])
+    if (dailyPick) persistPref(DAILY_PICK_KEY, dailyPick)
+  }, [dailyPick])
+
+  useEffect(() => {
+    if (showSeconds !== null) persistPref(SHOW_SECONDS_KEY, showSeconds)
+  }, [showSeconds])
+
+  useEffect(() => {
+    if (pulseSeparator !== null)
+      persistPref(PULSE_SEPARATOR_KEY, pulseSeparator)
+  }, [pulseSeparator])
 
   // The hour and minute are the quarter's own, so a chime that lands late still
   // sounds the bell for the hour it is announcing.
@@ -884,7 +984,7 @@ function App() {
                 fontWeight: '600',
               }}
             >
-              Digit font
+              Digit fonts
             </Text>
             <View
               style={{
@@ -896,10 +996,7 @@ function App() {
               {offeredFontIds.map((id) => (
                 <Pressable
                   key={id}
-                  onPress={() => {
-                    setDigitFont(id)
-                    setRandomDaily(false)
-                  }}
+                  onPress={() => toggleFont(id)}
                   style={{
                     paddingVertical: 8,
                     paddingHorizontal: 14,
@@ -908,7 +1005,9 @@ function App() {
                     elevation: 5,
                     borderWidth: 1,
                     borderColor: 'black',
-                    backgroundColor: id === currentFontId ? 'black' : 'white',
+                    backgroundColor: activePool.includes(id)
+                      ? 'black'
+                      : 'white',
                   }}
                 >
                   <Text
@@ -916,7 +1015,7 @@ function App() {
                       fontWeight: FONTS[id].weight,
                       ...FONTS[id].style,
                       fontSize: 16,
-                      color: id === currentFontId ? 'white' : 'black',
+                      color: activePool.includes(id) ? 'white' : 'black',
                     }}
                   >
                     {FONTS[id].label}
@@ -924,29 +1023,67 @@ function App() {
                 </Pressable>
               ))}
             </View>
-            <Pressable
-              onPress={() => setRandomDaily(randomDaily !== true)}
+            {/* Says what the selection actually does, so the rotation is never a
+                surprise and tapping the last face off (which does nothing) has an
+                explanation next to it. */}
+            <Text
+              style={{
+                paddingTop: 4,
+                fontSize: 14,
+                textAlign: 'center',
+                color: '#444444',
+              }}
+            >
+              {activePool.length > 1
+                ? `rotates daily through ${activePool.length} selected`
+                : 'always this font'}
+            </Text>
+            <View
               style={{
+                flexDirection: 'row',
+                flexWrap: 'wrap',
+                justifyContent: 'center',
                 marginTop: 12,
-                paddingVertical: 10,
-                paddingHorizontal: 20,
-                borderRadius: 10,
-                elevation: 5,
-                borderWidth: 1,
-                borderColor: 'black',
-                backgroundColor: randomDaily === true ? 'black' : 'white',
               }}
             >
-              <Text
-                style={{
-                  fontWeight: '600',
-                  fontSize: 16,
-                  color: randomDaily === true ? 'white' : 'black',
-                }}
-              >
-                {`Surprise me daily: ${randomDaily === true ? 'On' : 'Off'}`}
-              </Text>
-            </Pressable>
+              {[
+                {
+                  label: 'Show seconds',
+                  value: showSeconds === true,
+                  onToggle: () => setShowSeconds(showSeconds !== true),
+                },
+                {
+                  label: 'Pulsing separator',
+                  value: pulseSeparator === true,
+                  onToggle: () => setPulseSeparator(pulseSeparator !== true),
+                },
+              ].map(({ label, value, onToggle }) => (
+                <Pressable
+                  key={label}
+                  onPress={onToggle}
+                  style={{
+                    margin: 4,
+                    paddingVertical: 10,
+                    paddingHorizontal: 20,
+                    borderRadius: 10,
+                    elevation: 5,
+                    borderWidth: 1,
+                    borderColor: 'black',
+                    backgroundColor: value ? 'black' : 'white',
+                  }}
+                >
+                  <Text
+                    style={{
+                      fontWeight: '600',
+                      fontSize: 16,
+                      color: value ? 'white' : 'black',
+                    }}
+                  >
+                    {`${label}: ${value ? 'On' : 'Off'}`}
+                  </Text>
+                </Pressable>
+              ))}
+            </View>
           </View>
         </Animated.ScrollView>
         {/* Always-visible scrollbar. pointerEvents="none" keeps it clear of the
@@ -1010,23 +1147,62 @@ function App() {
       >
         {currentText}
       </Text>
-      {/* numberOfLines is the backstop: the measured size already keeps the
-            digits inside the fitting box, so they never wrap. */}
-      <Text
-        numberOfLines={1}
+      {/* The digits live in one box placed exactly where the single Text used to
+          go and sized from the measured line, so the centring and the travel walls
+          are unchanged. Inside it the separator is its own Animated.Text — nested
+          Text children cannot carry an animated opacity — and the optional seconds
+          hang off the bottom-right corner, which lets them drift with the digits
+          for free and keeps them out of the measurement that sets the size.
+          flexShrink 0 stops Yoga from shaving a piece off the row if splitting it
+          renders a hair wider than the measured advance; numberOfLines stays the
+          wrap backstop, and justifyContent keeps the row centred on the same point
+          whether it comes out a pixel narrower or wider. */}
+      <View
         style={{
-          ...fontSpecs,
-          fontSize: digitFontSize,
-          color: '#d0fcc5',
           position: 'absolute',
           left:
             insets.left + (motionBox.width - digitWidth) / 2 + clampedXShift,
           top:
             insets.top + (motionBox.height - digitHeight) / 2 + clampedYShift,
+          width: digitWidth,
+          height: digitHeight,
         }}
       >
-        {currentText}
-      </Text>
+        <View
+          style={{
+            flexDirection: 'row',
+            justifyContent: 'center',
+            alignItems: 'baseline',
+          }}
+        >
+          <Text numberOfLines={1} style={[digitTextStyle, { flexShrink: 0 }]}>
+            {hoursText}
+          </Text>
+          <Animated.Text
+            numberOfLines={1}
+            style={[digitTextStyle, { flexShrink: 0, opacity: separatorPulse }]}
+          >
+            {':'}
+          </Animated.Text>
+          <Text numberOfLines={1} style={[digitTextStyle, { flexShrink: 0 }]}>
+            {minutesText}
+          </Text>
+        </View>
+        {showSeconds === true && (
+          <Text
+            numberOfLines={1}
+            style={{
+              ...digitTextStyle,
+              fontSize: digitFontSize * SECONDS_SCALE,
+              position: 'absolute',
+              right: 0,
+              bottom: 0,
+            }}
+          >
+            {secondsText}
+          </Text>
+        )}
+      </View>
       <StatusBar hidden={true} />
     </Pressable>
   )
diff --git a/package.json b/package.json
index a6f6cb3..293a28e 100644
--- a/package.json
+++ b/package.json
@@ -5,6 +5,7 @@
   "packageManager": "npm@10.7.0",
   "scripts": {
     "start": "npx expo start",
+    "test": "jest",
     "startc": "npx expo start --clear",
     "clear": "npm cache clean --force",
     "reset:simulator": "xcrun simctl erase all",

# --- new files ---
diff --git a/fontSelection.js b/fontSelection.js
new file mode 100644
index 0000000..59d11be
--- /dev/null
+++ b/fontSelection.js
@@ -0,0 +1,62 @@
+// The rules that decide which digit font draws, kept free of React, React Native
+// and SecureStore so they can be tested on their own (see __tests__). The font
+// table itself lives in App.js, because naming a family is a platform concern; this
+// module is handed the ids the app ships and the ids this device offers.
+// Stored ids are trusted only as far as they name a font the app still ships: an
+// old "default" choice or a face removed in an update is dropped rather than
+// repaired, so no stale value can reach the picker, the probe or the clock.
+export const validFontIds = (ids, knownIds) =>
+  Array.isArray(ids) ? ids.filter((id) => knownIds.includes(id)) : []
+
+// The faces the clock may actually draw: what the user selected, as far as this
+// device has them, in `FONTS` order so a stored set and the button row agree. When
+// none of the saved choices survives — first launch, or every saved face is absent
+// from this phone — the pool is everything offered, which is also what a fresh
+// install selects. Never empty while `offeredFontIds` has an entry.
+export const rotationPool = (selectedIds, offeredFontIds) => {
+  if (!Array.isArray(selectedIds)) return offeredFontIds
+  // Intersecting over the offered list — not the stored one — is what keeps the pool
+  // in shipped order however the user tapped, so the button row and the clock agree.
+  const eligible = offeredFontIds.filter((id) => selectedIds.includes(id))
+  return eligible.length > 0 ? eligible : offeredFontIds
+}
+
+// Today's draw from the pool, never the face just shown: drawing uniformly from the
+// pool minus the previous pick is the terminating form of "draw again until it
+// differs". A single-face pool has nothing to exclude and keeps that face, which is
+// what one selection meaning "always this font" comes down to.
+export const drawDailyFont = (pool, previousId) => {
+  if (pool.length === 0) return null
+  const candidates = pool.filter((id) => id !== previousId)
+  const source = candidates.length > 0 ? candidates : pool
+  return source[Math.floor(Math.random() * source.length)]
+}
+
+// A pick belongs to a local calendar day, so it survives an app restart inside the
+// same day and is redrawn at midnight.
+export const todayKey = (now) => now.format('YYYY-MM-DD')
+
+export const isTodayPick = (pick, now) =>
+  !!pick &&
+  typeof pick.date === 'string' &&
+  typeof pick.id === 'string' &&
+  pick.date === todayKey(now)
+
+// What the picker holds after a read. A saved set of known faces wins; otherwise a
+// single legacy face becomes a one-element set; anything the app no longer ships —
+// the old "default" included — is dropped, and an install with nothing usable lands
+// on every font it offers, which is also what a fresh install selects.
+export const resolveSelectedFonts = ({ saved, legacyFontId, allIds }) => {
+  const validSaved = validFontIds(saved, allIds)
+  if (validSaved.length > 0) return validSaved
+  return allIds.includes(legacyFontId) ? [legacyFontId] : allIds
+}
+
+// The picker's one rule: a face toggles, except the last one standing, which stays
+// selected because an empty pool has nothing honest to draw. Adding a face keeps
+// `FONTS` order, since callers hand in a pool already intersected over the offered
+// list.
+export const nextSelection = (pool, id) => {
+  if (!pool.includes(id)) return [...pool, id]
+  return pool.length > 1 ? pool.filter((other) => other !== id) : pool
+}
diff --git a/jest.config.js b/jest.config.js
new file mode 100644
index 0000000..71438f3
--- /dev/null
+++ b/jest.config.js
@@ -0,0 +1,12 @@
+// Only the pure selection logic is unit-tested, so no React Native environment is
+// needed: `fontSelection.js` imports nothing and runs in plain node. Rendering the
+// clock or the settings screen would need jest-expo, which this project does not
+// use; those paths stay covered by the device checks recorded in the plan.
+module.exports = {
+  testEnvironment: 'node',
+  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
+  // Two files to discover: polling is cheaper than a Watchman dependency, and
+  // Watchman cannot start in a restricted environment at all.
+  watchman: false,
+  roots: ['<rootDir>/__tests__'],
+}
diff --git a/__tests__/fontSelection.test.js b/__tests__/fontSelection.test.js
new file mode 100644
index 0000000..e94801d
--- /dev/null
+++ b/__tests__/fontSelection.test.js
@@ -0,0 +1,199 @@
+import fs from 'fs'
+import path from 'path'
+
+import dayjs from 'dayjs'
+
+import {
+  drawDailyFont,
+  isTodayPick,
+  nextSelection,
+  resolveSelectedFonts,
+  rotationPool,
+} from '../fontSelection'
+
+// Each describe block names the row of the plan's I/O & Edge-Case Matrix it covers
+// (../_bmad-output/plan-font-rotation-set-and-display-toggles.md). The font table
+// itself lives in App.js and needs react-native to evaluate, so the shipped ids are
+// read out of that source text rather than imported.
+
+const TODAY = dayjs('2026-11-25T13:45:00')
+
+const fontsSource = () => {
+  const src = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8')
+  const start = src.indexOf('const FONTS = {')
+  return src.slice(start, src.indexOf('\n}', start))
+}
+
+const SHIPPED = (fontsSource().match(/^\s{2}(\w+): \{/gm) || []).map((line) =>
+  line.trim().replace(/: \{$/, ''),
+)
+
+describe('first launch, nothing stored', () => {
+  it('selects every font the app ships when nothing is saved', () => {
+    expect(
+      resolveSelectedFonts({
+        saved: null,
+        legacyFontId: null,
+        allIds: SHIPPED,
+      }),
+    ).toEqual(SHIPPED)
+    expect(SHIPPED.length).toBeGreaterThan(1)
+  })
+
+  it('pools every offered face while the selection is still unset', () => {
+    expect(rotationPool(null, SHIPPED)).toEqual(SHIPPED)
+  })
+})
+
+describe('upgrade from a single stored font', () => {
+  it('turns one saved face into a one-element set that never rotates', () => {
+    const selected = resolveSelectedFonts({
+      saved: null,
+      legacyFontId: 'mono',
+      allIds: SHIPPED,
+    })
+    expect(selected).toEqual(['mono'])
+    expect(rotationPool(selected, SHIPPED)).toEqual(['mono'])
+    expect(drawDailyFont(['mono'], 'serif')).toBe('mono')
+  })
+
+  it('prefers a valid saved set over the legacy single value', () => {
+    expect(
+      resolveSelectedFonts({
+        saved: ['serif', 'marker'],
+        legacyFontId: 'mono',
+        allIds: SHIPPED,
+      }),
+    ).toEqual(['serif', 'marker'])
+  })
+})
+
+describe('legacy "default" stored', () => {
+  it('ships no default font any more', () => {
+    expect(SHIPPED).not.toContain('default')
+    expect(SHIPPED.length).toBeGreaterThan(5)
+  })
+
+  it('drops a stored default together with any other unknown id', () => {
+    expect(
+      resolveSelectedFonts({
+        saved: null,
+        legacyFontId: 'default',
+        allIds: SHIPPED,
+      }),
+    ).toEqual(SHIPPED)
+    expect(
+      resolveSelectedFonts({
+        saved: ['serif', 'default', 'bogus'],
+        legacyFontId: null,
+        allIds: SHIPPED,
+      }),
+    ).toEqual(['serif'])
+  })
+
+  it('treats a non-array stored value as nothing saved', () => {
+    expect(
+      resolveSelectedFonts({
+        saved: 'mono',
+        legacyFontId: null,
+        allIds: SHIPPED,
+      }),
+    ).toEqual(SHIPPED)
+    expect(rotationPool('serif', SHIPPED)).toEqual(SHIPPED)
+  })
+})
+
+describe('last font tapped off', () => {
+  it('keeps the only selected face selected', () => {
+    expect(nextSelection(['marker'], 'marker')).toEqual(['marker'])
+  })
+
+  it('removes any other face and adds an unselected one in pool order', () => {
+    expect(nextSelection(['serif', 'mono', 'script'], 'mono')).toEqual([
+      'serif',
+      'script',
+    ])
+    expect(nextSelection(['serif'], 'mono')).toEqual(['serif', 'mono'])
+  })
+})
+
+describe('device lacks fonts in the set', () => {
+  const offered = ['serif', 'rounded']
+
+  it('narrows the saved selection to what the device has', () => {
+    expect(rotationPool(['mono', 'serif'], offered)).toEqual(['serif'])
+  })
+
+  it('falls back to everything offered when no saved face survived', () => {
+    expect(rotationPool(['mono', 'script'], offered)).toEqual(offered)
+  })
+
+  it('keeps the pool in offered order whatever order was stored', () => {
+    expect(rotationPool(['marker', 'serif', 'script'], SHIPPED)).toEqual(
+      SHIPPED.filter((id) => ['marker', 'serif', 'script'].includes(id)),
+    )
+  })
+
+  it('pools nothing when the device offers nothing, so no font is drawn blindly', () => {
+    expect(rotationPool(['serif'], [])).toEqual([])
+    expect(drawDailyFont([], null)).toBeNull()
+  })
+})
+
+describe('relaunch later the same day', () => {
+  it('accepts a stored pick dated today', () => {
+    expect(isTodayPick({ id: 'mono', date: '2026-11-25' }, TODAY)).toBe(true)
+  })
+
+  it('rejects yesterday and malformed values', () => {
+    expect(isTodayPick({ id: 'mono', date: '2026-11-24' }, TODAY)).toBe(false)
+    expect(isTodayPick({ id: 'mono' }, TODAY)).toBe(false)
+    expect(isTodayPick({ id: 7, date: '2026-11-25' }, TODAY)).toBe(false)
+    expect(isTodayPick(null, TODAY)).toBe(false)
+  })
+
+  it('cannot draw a stored pick naming a font the app no longer ships', () => {
+    // The clock only ever draws a pick that is inside the current pool, and the pool
+    // is built from shipped ids — so an id the app dropped is never selected.
+    const pick = { id: 'default', date: '2026-11-25' }
+    expect(rotationPool([pick.id], SHIPPED)).toEqual(SHIPPED)
+    expect(rotationPool([pick.id], SHIPPED)).not.toContain(pick.id)
+  })
+
+  it('redraws when today’s face leaves the pool', () => {
+    const pool = ['serif', 'rounded']
+    const stale = { id: 'mono', date: '2026-11-25' }
+    expect(pool.includes(stale.id)).toBe(false)
+    const next = drawDailyFont(pool, stale.id)
+    expect(pool).toContain(next)
+    expect(next).not.toBe(stale.id)
+  })
+})
+
+describe('local midnight passes while running', () => {
+  it('never repeats the face just shown', () => {
+    const pool = ['serif', 'mono', 'script']
+    for (let i = 0; i < 500; i += 1)
+      expect(drawDailyFont(pool, 'mono')).not.toBe('mono')
+  })
+
+  it('always lands on a pooled face, and alternates with a pool of two', () => {
+    const pair = ['serif', 'marker']
+    for (let i = 0; i < 200; i += 1) {
+      const next = drawDailyFont(pair, 'serif')
+      expect(next).toBe('marker')
+      expect(pair).toContain(drawDailyFont(pair, next))
+    }
+  })
+
+  it('covers every face of the pool eventually', () => {
+    const pool = ['serif', 'mono', 'script', 'marker']
+    const seen = new Set()
+    let previous = null
+    for (let i = 0; i < 200; i += 1) {
+      previous = drawDailyFont(pool, previous)
+      seen.add(previous)
+    }
+    expect([...seen].sort()).toEqual([...pool].sort())
+  })
+})

```

---

## Scope note (added after this snapshot was taken)

Five cosmetic tweaks landed in `App.js` on top of the change above, at the user's request:

- `SECONDS_SCALE` 0.3 → 0.1.
- A new `DRIFT_STEP = 1 / 3` replacing the hard-coded ±1 drift step in both places it lived (the
  initial `xStep`/`yStep` state and the reversal inside `nextShift`), so the clock drifts and
  bounces three times slower.
- A larger clock-green "Show the clock" button as the settings screen's call to action.
- The tiny seconds moved off the container floor onto the digits' baseline: `onMeasureDigits` now
  records the probe's `ascender`, and `secondsBottomInset` lifts them by that descent, with a 0.2
  fallback share where no usable ascender is reported.
- Those seconds now draw inside a fixed-size black rounded-corner chip, because green seconds over
  a green minute digit were invisible — and because a chip hugging the current second twitched on
  every tick. A second hidden probe measures `'88'` once per font (`secondsMetrics`) and
  `secondsChipStyle` sizes itself from it; padding and radius are shares of the seconds' own size,
  and the fill is half-transparent (`SECONDS_CHIP_FILL`) so the overlapped digit reads through it.

They are separate work, not part of this review — judge them only for obvious breakage. If you
open `App.js` from disk its line numbers will sit differently than in the diff above; review the
diff as printed here.
