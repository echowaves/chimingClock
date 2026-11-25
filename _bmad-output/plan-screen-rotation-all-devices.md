---
title: 'Screen rotates freely on every device instead of staying landscape-locked'
type: 'feature'
ticket: ''
created: '2026-11-25'
status: 'built'
baseline_revision: 'bea3bff2437339414954dabb057e062f9d7fb542'
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

**Problem:** The app is locked to landscape in two independent places, so a phone or tablet held upright still draws the clock sideways — the one orientation a bedside clock is most often propped in. Nothing in JS ever asks for that lock; it exists only as build configuration, and both entries must change together or the launch-time mask overrides the supported list.

**Approach:** Unlock at the configuration layer only: declare all orientations supported (`expo.orientation: "default"`) and set the `expo-screen-orientation` plugin's launch mask to `DEFAULT`, so iOS and Android hand orientation to the system on every device. No JS orientation code is added — the clock already re-fits from live window dimensions and safe-area insets per axis.

**Decision (human, 2026-11-25):** Free rotation on every device class — iPhone, iPad, Android phones and tablets; no Settings toggle, no portrait-only fallback, no per-device rule. Upside-down portrait is excluded on iOS (`DEFAULT` → `UIInterfaceOrientationMaskAllButUpsideDown`), the platform convention; all four orientations remain in the supported list for iPad validation.

</frozen-after-approval>

## Implementation Notes

Route `oneshot`: the change is two values in one file, well under 100 lines, and needs no coding subagent. Risk `medium`: it cannot ship through an OTA update (`eas update`) — both keys land in Info.plist / AndroidManifest at prebuild, so it reaches users only in a new EAS binary, and the clock face is the app's whole product surface.

Verified facts from the installed SDK 58 toolchain (do not re-investigate):
- `expo.orientation` → iOS `UISupportedInterfaceOrientations` (`@expo/config-plugins/build/ios/Orientation.js`: anything other than `portrait`/`landscape`, i.e. `default`, yields all four) and Android main-activity `android:screenOrientation` (`build/android/Orientation.js:45`: `default` → `unspecified`). Keep the key present with value `"default"` — deleting it leaves Android with no attribute at all, since the mod only writes when the key exists.
- The `expo-screen-orientation` plugin writes iOS `EXDefaultScreenOrientationMask` (`expo-screen-orientation/plugin/build/withScreenOrientation.js:48-57`); `LANDSCAPE` → `UIInterfaceOrientationMaskLandscape`, `DEFAULT` → `UIInterfaceOrientationMaskAllButUpsideDown`. It is the launch lock, so leaving it at `LANDSCAPE` would defeat the `expo.orientation` change on iOS. Valid keys are `DEFAULT | ALL | PORTRAIT | PORTRAIT_UP | PORTRAIT_DOWN | LANDSCAPE | LANDSCAPE_LEFT | LANDSCAPE_RIGHT`; there is no Android effect.
- The package is never imported in JS — no `lockAsync`/`setSupportedOrientationsAsync` call exists anywhere, so there is no runtime lock to remove. Keep the plugin and dependency in place; only its argument changes.
- Do **not** touch `ios.requireFullScreen: true`. It writes `UIRequiresFullScreen`, and as of iOS 27 (per the toolchain's own comment in `build/ios/RequiresFullScreen.js`) it requests discrete resizing that honours the supported orientations rather than blocking rotation. Changing it would alter iPad multitasking and App Store validation for no gain. `UISupportedInterfaceOrientations~ipad` is unset, so the base list covers iPad unchanged.
- Do **not** change layout code in `App.js`. The motion box is window dims minus live `useSafeAreaInsets()` on both platforms (`App.js:324-335`); the font fit solves each axis independently (`App.js:470-483`) and bounce ranges derive from the measured digit box (`App.js:498-499`), so portrait re-fits without help. The settings scrollbar measures the ScrollView itself (`App.js:692-730`). `guessFontSize = width / 3` (`App.js:337`) is only the pre-measurement first-frame guess and self-corrects on the probe's first report — leave it; a "portrait-aware" guess would regress the existing landscape first frame.

Implemented: `app.json` only, two values (`expo.orientation` → `"default"`, plugin `initialOrientation` → `"DEFAULT"`); 2 insertions, 2 deletions. No JS touched — `git diff --stat` shows `app.json` alone, which is the stronger form of the plan's "eslint proves JS undisturbed" check, so eslint was not run.

Verified against the resolved prebuild config (`expo config --type introspect`, telemetry disabled because the sandbox blocks `~/.expo/state.json`): iOS `UISupportedInterfaceOrientations` now lists all four orientations, `EXDefaultScreenOrientationMask: 'UIInterfaceOrientationMaskAllButUpsideDown'`, Android `android:screenOrientation: 'unspecified'`. `app.json` still parses as JSON.

Precedence, checked in the installed native source (`expo-screen-orientation/ios/ScreenOrientationViewController.swift:28-56`): `EXDefaultScreenOrientationMask` is what the root view controller reports, and `UISupportedInterfaceOrientations` is used only as its fallback when that key is absent or invalid — so both keys had to move, and the plist list still matters because UIKit will not rotate into an orientation it omits. The two new values are consistent (`AllButUpsideDown` equals its intersection with the all-four plist list), so the SDK's conflict warning at `:51-53` does not fire; that warning is exactly what leaving `"orientation": "landscape"` in place would have produced.

## Plan Change Log

## Review Triage Log

Pass 1, `quick` lens (subagent), 2026-11-25 — 0 high, 1 medium, 5 low, 1 false, 1 maybe-false.

- `low` **defer** — Historical plans (`plan-settings-screen-scroll.md:34,42,51`, `plan-dynamic-clock-font-fit.md:22`, `plan-clock-bounce-edge-and-font-fit.md:60`) still assert the landscape lock as current fact. Real, but they are frozen/owned build records; `bmod-method/help/artifact-lifetime.md` makes them evidence, "not a replacement for the current code". Recorded in `deferred-work.md`.
- `low` **defer** (same root cause: stale landscape premises in records) — `plan-clock-bounce-edge-and-font-fit.md:60` rejects the stale-`motionBox` risk by citing the lock. Moot in current code anyway: `App.js:324-335` derives the box live from `useWindowDimensions()` + `useSafeAreaInsets()`, and the only `onLayout` is the settings ScrollView (`App.js:796`), so a rotation needs no measured-box refresh.
- `low` **patch** — iPad manual check said "all orientations" while the launch mask excludes upside-down on iPad as well. Reworded both manual checks to the three reachable orientations (Android reverse portrait noted).
- `false` — Claim that the recorded iOS evidence "would still pass with a wrong value" for `expo.orientation`: the check asserts all four `UIInterfaceOrientation*` entries in `UISupportedInterfaceOrientations`, which fails outright if the key stayed `"landscape"` (baseline showed exactly two landscape entries). The underlying precedence point is correct and was added to Implementation Notes: the mask wins over the plist list, and the new pair matches, so the SDK conflict warning at `ScreenOrientationViewController.swift:51-53` stays silent.
- `medium` **defer** — `ios.buildNumber "26"` / `android.versionCode 26` are pinned, so a fresh `eas build` may need another bump to upload. Not caused by this change and not this change's job: every prior bump is a separate human release commit (`bea3bff`, `ba7b573`), and `plan-settings-screen-scroll.md:34` records deliberately excluding one from a feature commit. Recorded in `deferred-work.md` as a release-ordering constraint.
- `low` **patch** — Verification listed an eslint run that Implementation Notes said was not run. Replaced with the check actually performed (`git diff --stat`, which covers every tracked source file).
- `low` **patch** — Citation `build/android/Orientation.js:52` is wrong; the mapping is at line 45 of the installed file. Corrected.
- `maybe-false` **defer** — `.github/instructions/codacy.instructions.md` mandates a `codacy_cli_analyze` pass after every edit; no Codacy MCP tool exists in this session, so it could not be run, and that file is gitignored (there is no `AGENTS.md`/`CLAUDE.md` at the repo root). Settled by the user: is Codacy analysis expected for config-only changes here? Recorded in `deferred-work.md`.

## Verification

**Commands:**
- `EXPO_NO_TELEMETRY=1 npx expo config --type introspect 2>&1 | grep -n -A4 "UISupportedInterfaceOrientations\|EXDefaultScreenOrientationMask\|android:screenOrientation"` -- expected: iOS lists all four `UIInterfaceOrientation*` values, `EXDefaultScreenOrientationMask: 'UIInterfaceOrientationMaskAllButUpsideDown'`, Android `'android:screenOrientation': 'unspecified'`. (Baseline before the change: two landscape entries, `UIInterfaceOrientationMaskLandscape`, `'landscape'`.)
- `git --no-pager diff --stat bea3bff2437339414954dabb057e062f9d7fb542` -- expected: `app.json | 4 ++--` and nothing else, which proves no JS was disturbed (every source file in this app is tracked; only the plan document is untracked).

**Manual checks (needs a device or simulator — cannot be proven from this environment):**
- Rotate a phone through every reachable orientation — portrait up plus both landscapes on iOS (upside-down is deliberately excluded there), and sensor rotation including reverse portrait on most Android devices: the clock re-fits, digits stay fully inside the screen, drift still bounces off every new edge, and the settings list stays scrollable with its custom thumb sized correctly.
- On iPad, confirm rotation across the same three reachable orientations (the launch mask applies to iPad too) and that window resizing behaves as before (`requireFullScreen` untouched).
- Shipping order: a fresh `eas build` must precede any `publish:prod` OTA for this to reach installed binaries.
