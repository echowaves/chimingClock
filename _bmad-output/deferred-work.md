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
