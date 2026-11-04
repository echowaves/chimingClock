# Deferred Work

- source_plan: none
  summary: Add a digit-font customization feature (curated standard/classic font list, default = currently selected font, one-tap revert to default, optional automatic random font once a day).
  evidence: Split from the combined intent because the Expo SDK 58 + dependency migration is an independently shippable deliverable; the feature depends on it only in that it should be built on top of the upgraded app. User specified migration first.

- source_plan: `_bmad-output/plan-app-store-icon.md`
  summary: Splash screen still shows the old orange-bell artwork with a white background, clashing with the new navy Luminous icon.
  evidence: assets/splash.png dominant colors are near-black plus orange #B2472E (old branding); app.json expo-splash-screen backgroundColor is #ffffff while the new icon/adaptive background is #080E1D.
- source_plan: `/Users/dmitry/hacks/chimingClock/_bmad-output/plan-settings-screen-scroll.md`
  summary: Vertical scrolling is blocked where the MultiSlider thumbs and between-track capture the pan gesture, so users must scroll from other areas of the settings screen.
  evidence: MultiSlider sets onMoveShouldSetPanResponderCapture: true, onPanResponderTerminationRequest: false and onShouldBlockNativeResponder: true (node_modules/@ptomasroos/react-native-multi-slider/MultiSlider.js:78-87) on the marker and between views; verified in source. Real (medium); a scrollEnabled-toggle workaround risks breaking the currently-working drag and cannot be device-verified in this environment.

- source_plan: `_bmad-output/plan-clock-bounce-edge-and-font-fit.md`
  summary: On Android the clock's motion box is the full window, so digits can drift under the (transparent) navigation/gesture area; only iOS insets are honored today.
  evidence: RN core SafeAreaView applies insets on iOS only (review finding on the bounce change, confirmed); the pre-change code had the same limitation, so it was not patched inside this build. A react-native-safe-area-context (or equivalent) provider would bound the drift by Android gesture insets too. [CLOSED 2026-11-03: motion box now subtracts live useSafeAreaInsets() on both platforms — see plan-safe-area-context-migration.md.]

- source_plan: `_bmad-output/plan-safe-area-context-migration.md`
  summary: Ship a fresh native (EAS) build before publishing this JS via `publish:prod` — react-native-safe-area-context adds native code that binaries built earlier do not contain.
  evidence: OTA updates swap only the JS bundle; the new top-level imports of the RNCSafeAreaView host component and provider would throw on launch in previously shipped binaries (review finding, confirmed against the library's codegen specs). Release-ordering constraint, not a code fix.
