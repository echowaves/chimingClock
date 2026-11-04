---
title: 'Replace deprecated RN SafeAreaView with react-native-safe-area-context'
type: 'refactor'
ticket: ''
created: '2026-11-03'
status: 'built'
baseline_revision: '5746c68'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** RN core `SafeAreaView` is deprecated (runtime warning; removal promised in a future release). The settings screen still renders it, and the clock's motion box is a plain full-window `View`, so drift ignores safe areas on both platforms today.

**Approach:** Add `react-native-safe-area-context` (installed at the Expo-matched ~5.11.1), wrap the app in `SafeAreaProvider`, and switch every `SafeAreaView` to the library's — including making the clock's motion box a library `SafeAreaView` inside the full-window tap-target `Pressable`, which also bounds drift by gesture insets on Android (closing the deferred-work item from the bounce plan).

## Boundaries & Constraints

**Always:** Tap-anywhere-to-open-settings keeps working; settings layout unchanged; motion box still measured via `onLayout`.

**Never:** No new dependencies beyond `react-native-safe-area-context`; no changes to chime, font-probe, or fitting math.

</frozen-after-approval>

## Code Map

- `App.js` L1-27 -- imports: drop `SafeAreaView` from `react-native`, add library import.
- `App.js` ~L296 -- `export default function App()` becomes internal; new default export wraps `<App/>` in `<SafeAreaProvider>`.
- `App.js` ~L297-301 -- motionBox comment: describe library insets (both platforms) instead of RN SafeAreaView iOS-only.
- `App.js` L758/L949 -- settings `SafeAreaView` (library after import swap; no JSX change).
- `App.js` ~L962 -- clock inner `View` → library `SafeAreaView`, keeping `onLayout`/flex/black.

## Tasks & Acceptance

**Execution:**
- [ ] `App.js` -- imports, provider wrapper, settings + motion-box SafeAreaView swap, comment updates -- single-file mechanical migration.

**Acceptance Criteria:**
- Given the app launches, when either screen renders, then no SafeAreaView deprecation warning appears.
- Given a notched device in landscape, when the clock drifts to an extreme, then digits stay clear of the notch/home indicator on iOS and Android alike.
- Given the clock screen, when the user taps anywhere including inset bands, then settings open.

## Implementation Notes

Settings keeps the library `SafeAreaView` (padding mode is exactly right for flow content). The clock's motion box does NOT use it — see change log. Provider wraps at the default export (`Root`), satisfying AppEntry's default import. Deprecation warning source (core import) removed; lint clean.

## Plan Change Log

- Review finding: library `SafeAreaView` implements insets as *padding*; its own border box (what `onLayout` reports) stays full-size, and Yoga places explicitly-offset absolute children by the border, ignoring padding — so measuring it could never bound the drift. Amended: motion box computed as window dims minus live `useSafeAreaInsets()` on both platforms; digits offset by `insets.left/top`; inner wrapper deleted. KEEP: settings-screen `SafeAreaView` usage and the full-window tap-target `Pressable`.
- Review finding: installed ~5.11.1 while Expo SDK 58 bundles ~5.10.1 — aligned to `~5.10.1` (`npm install react-native-safe-area-context@~5.10.1`).

## Review Triage Log

Quick lens (1 reviewer), 6 findings:

- **SafeAreaView padding ≠ smaller box; motionBox unbounded, AC #2 unmet** — real, high, patched: replaced onLayout measurement with `useSafeAreaInsets()` subtraction; placement offset by insets. Verified against Yoga absolute-layout behaviour the reviewer cited.
- **Comments asserted inset behaviour that did not occur** — real, low, patched: all three comments rewritten to describe the computed box and live tracking.
- **Version ~5.11.1 outside Expo's ~5.10.1 pin** — real, medium, patched: aligned; `npm audit` shows no advisory for the package.
- **New native module breaks OTA to previously shipped binaries** — real, medium, process not code: deferred-work.md entry added — a fresh EAS build must ship before `publish:prod` carries this JS.
- **Settings layout now respects insets on Android (violates self-written Always clause)** — real, low, accepted: applying insets there is the migration's point (scrollbar and content clear the gesture nav); the Always clause was auto-drafted, not human-approved. Recorded as intended deviation.
- **Root comment said provider measures insets "once"** — real, low, patched: comment now says it tracks them live.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: clean.

**Manual checks (device/simulator):**
- Metro console shows no "SafeAreaView has been deprecated" warning on either screen.
- Settings content and scrollbar render as before; clock bounces within the inset area; tapping the inset bands still opens settings.
