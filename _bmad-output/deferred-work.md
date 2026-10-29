# Deferred Work

- source_plan: none
  summary: Add a digit-font customization feature (curated standard/classic font list, default = currently selected font, one-tap revert to default, optional automatic random font once a day).
  evidence: Split from the combined intent because the Expo SDK 58 + dependency migration is an independently shippable deliverable; the feature depends on it only in that it should be built on top of the upgraded app. User specified migration first.

- source_plan: `_bmad-output/plan-app-store-icon.md`
  summary: Splash screen still shows the old orange-bell artwork with a white background, clashing with the new navy Luminous icon.
  evidence: assets/splash.png dominant colors are near-black plus orange #B2472E (old branding); app.json expo-splash-screen backgroundColor is #ffffff while the new icon/adaptive background is #080E1D.
