---
title: 'Migrate to Expo SDK 58 and refresh dependencies'
type: 'chore'
ticket: ''
created: '2026-10-28'
status: 'built'
baseline_revision: '656c3877ac19ae77a2c493f177d8563a1e09e34b'
route: 'oneshot'
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

**Problem:** The app ships on Expo SDK 54 / RN 0.81 while Expo SDK 58 (RN 0.88, React 19.3.0) is current; `expo-av` is no longer shipped with the SDK and must be replaced by `expo-audio`. Dependencies have drifted behind.

**Approach:** Follow Expo's official upgrade path: install `expo@^58`, run `npx expo install --fix` to align all SDK-managed packages, bump non-SDK deps to latest compatible, port the small audio surface in App.js from `expo-av` to `expo-audio`, and verify with `expo-doctor` plus a real Metro export bundle.

## Boundaries & Constraints

**Always:** Preserve current runtime behavior (chimes at :00/:15/:30/:45 within the saved time range, looping tick sound, drift animation, settings persistence). Keep EAS project id, runtimeVersion policy, and update URL untouched.

**Never:** No new features (digit-font customization is deferred to its own plan — see `_bmad-output/deferred-work.md`). No change to app branding, assets, or the MultiSlider library unless it fails to bundle. Do not downgrade Node/EAS assumptions (local Node 24.14 satisfies SDK 58).

</frozen-after-approval>

## Code Map

- `package.json` — all version bumps live here; `main: node_modules/expo/AppEntry.js` still valid in expo@58 (`./AppEntry.js` export exists).
- `App.js` — sole app source (317 lines). Uses `expo-av`: `Audio.setAudioModeAsync({playsInSilentModeIOS:true})` (~L124), `initSounds()` building Maps of 12 hour + 3 minute sounds + tick via `Audio.Sound.createAsync(require(...))`, `play()` (`setPositionAsync(0)`, `setVolumeAsync`, `playAsync`), `resetTicking()` (`setVolumeAsync`), tick looping (`setIsLoopingAsync(true)`).
- `app.json` — `updates.fallbackToCacheTimeout` legacy key; plugins list (screen-orientation, secure-store); runtimeVersion sdkVersion policy stays.
- SDK 58 pins (bundledNativeModules): react 19.3.0, react-native 0.88.1, expo-updates ~58.0.19, expo-status-bar ~58.0.4, expo-screen-orientation ~58.0.3, expo-secure-store ~58.0.2, expo-navigation-bar ~58.0.4, expo-keep-awake ~58.0.3, react-native-gesture-handler ~3.3.0, react-native-svg 15.16.0, babel-preset-expo ~58.
- `@ptomasroos/react-native-multi-slider@2.2.2` — peers are `*`, but its `DefaultLabel.js` imports `prop-types`, which RN 0.88 no longer provides → must add `prop-types` explicitly.
- Known RN 0.87/0.88 removals (Touchable root export, StatusBar backgroundColor/translucent props, InteractionManager) — none used by App.js; `ImageBackground` only deprecated inside multi-slider.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` + lockfile — `npm install expo@^58.0.21`, then `npx expo install --fix`; add `prop-types`; bump `dayjs` (already latest), `@babel/core`/`@babel/runtime` to latest 7.x, `react-test-renderer` to ^19.3.0; remove `expo-av`, add `expo-audio`.
- [ ] `App.js` — swap `import { Audio } from 'expo-av'` for `expo-audio` (`createAudioPlayer`, `setAudioModeAsync`); store players (not `{sound}` wrappers) in the Maps; `setPositionAsync(0)`→`seekTo(0)`, `setVolumeAsync(v)`→`.volume = v`, `playAsync()`→`.play()`, `setIsLoopingAsync(true)`→`.loop = true`.
- [ ] `app.json` — drop `updates.fallbackToCacheTimeout` if expo-doctor/config schema flags it; add `expo-audio` config plugin only if required for iOS silent-mode playback.

**Acceptance Criteria:**
- Given a clean checkout after migration, when `npx expo-doctor` runs, then it reports no errors (informational warnings about Expo Go availability acceptable).
- Given the migrated project, when `npx expo export` bundles for ios+android, then Metro completes with exit 0 and no unresolved-module errors.
- Given App.js after the port, when grepping, then no `expo-av` references remain and audio behavior calls map 1:1 to the expo-audio equivalents listed above.

## Implementation Notes

Oneshot because: ~3 files, mostly mechanical version bumps plus a ~40-line API port; investigation already done (SDK 58 pins fetched from bundledNativeModules.json; breaking-change list checked against App.js imports).

Implementation log:
- `npx expo install --fix` is unusable in this sandbox (writes to ~/.expo/native-modules-cache are blocked), so SDK 58 versions were pinned manually from expo@58.0.21's bundledNativeModules.json — equivalent result, verified by expo-doctor "compatible versions" check passing 20/20.
- expo-doctor flagged two extra items beyond the plan: (1) top-level `splash` in app.json is no longer allowed → moved to the `expo-splash-screen` config plugin (installed expo-splash-screen ~58.0.12); (2) expo-audio requires peer `expo-asset` → installed ~58.0.19.
- react-test-renderer must be exactly 19.3.0 (npm resolved ^19.3.0 to 19.3.1, whose peer react ^19.3.1 conflicted with SDK-pinned react 19.3.0).
- `updates.fallbackToCacheTimeout` was NOT flagged by the schema check → kept unchanged.
- Verification results: expo-doctor 20/20; `npx expo export --platform ios --platform android` produced Hermes bundles (ios 1.8MB, android 1.9MB) with no unresolved modules; `npx eslint App.js` clean.

## Verification

**Commands:**
- `npx expo-doctor` — expected: pass (or only environment-level warnings).
- `npx expo export --platform ios --platform android --output-dir "$TMPDIR/chimingclock-export"` — expected: bundle(s) written, exit 0.
- `npx eslint App.js` — expected: no new errors vs baseline.

**Manual checks:**
- `git diff package.json` shows only dependency/version (+prop-types, −expo-av, +expo-audio) changes; project id/runtimeVersion/update URL unchanged in app.json.

## Review Triage Log

Pass 1 (quick lens): 1 high · 1 low · 1 accepted-behavior-change · 0 false · 0 maybe-false.

- `high` → patch: `App.js` passed `playsInSilentModeIOS` to expo-audio's `setAudioModeAsync`; the key does not exist in expo-audio@58 (verified absent from `build/`, type is `playsInSilentMode`) so iOS silent-mode playback would silently stop. Fixed to `{ playsInSilentMode: true }`; re-linted, re-exported clean.
- `low` → patch: `package.json` kept `react-test-renderer: ^19.3.0`, which resolves to 19.3.1 and ERESOLVE-conflicts with SDK-pinned react 19.3.0 on fresh resolution. Pinned exact `19.3.0`.
- accepted: tick volume at cold start now obeys the saved chiming range because `initSounds()` is synchronous, whereas the old async chain applied volume after first sound creation. Judged a strict improvement consistent with intent; KEEP — do not reintroduce artificial async delay.
