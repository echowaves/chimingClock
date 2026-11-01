---
title: "Keep a scrollbar visible on the settings screen"
type: 'feature'
ticket: ''
created: '2026-10-31'
status: 'built'
baseline_revision: '833e63b3afcc62030365b6b0c02d3da3854b9d8d'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the settings screen there is no reliable sign that more content sits below the fold. The scrollable view added earlier relies on the platform scroll indicator, which fades out as soon as scrolling stops, is absent when the content happens to fit, and on Android is not drawn at all until the user drags.

**Approach:** Draw the scrollbar in the app instead of asking the platform for one: a slim track pinned to the right edge of the settings screen with a thumb that tracks the scroll position and shows how much content there is. It is on screen at all times, including when everything fits, and never intercepts touches.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one file (`App.js`), ~60 lines of UI code plus styles, under the 100-line threshold.

Investigation (verified against the pinned dependencies):
- `node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js:295-301` — this RN version's `indicatorStyle` accepts only `'default' | 'black' | 'white'`. The old iOS `'visible'` value is gone, so no prop combination keeps the native bar on screen. `showsVerticalScrollIndicator` (line 680) only turns it on/off; iOS still fades it and hides it when content fits, Android draws nothing before the first drag. Hence a drawn indicator.
- `App.js:395-410` — the settings tree is `SafeAreaView` → `ScrollView` (`styles.settingsScroll`, `contentContainerStyle` `styles.settingsContent` with `flexGrow: 1`). The overlay needs a positioned wrapper between them; the clock screen's JSX below is untouched.
- Reuse `useWindowDimensions`-free measurement: the ScrollView reports its own viewport height via `onLayout` and its content height via `onContentSizeChange`, so the bar stays correct after rotation or a font change without measuring from the window.
- Animate the thumb with `Animated.Value` + `Animated.event` on `onScroll` rather than state, so scrolling does not re-render the screen once per frame.
- Keep untouched: every settings control and its handlers, the clock screen, the chime logic just fixed, and the previously deferred MultiSlider gesture issue — the overlay is `pointerEvents="none"`, so it cannot capture drags.

Change shape:
- Three styles (track, thumb, wrapper) beside the existing settings styles; `Animated` added to the `react-native` import.
- Local state for `{viewport, content}` heights; an `Animated.Value` for scroll offset; derived thumb height and travel distance, with the fits-on-screen case collapsing to a full-height thumb at the top.
- `showsVerticalScrollIndicator={false}` on the settings ScrollView so only one bar is visible.

Ran as planned: `Animated` added to the `react-native` import and `useMemo` to the `react` import, the three styles, the measured geometry with an `Animated.Value` for the offset, `showsVerticalScrollIndicator={false}`, and the `pointerEvents="none"` overlay after `</ScrollView>`. Verification passed: eslint exit 0, prettier clean, `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` produced a Hermes bundle.

Decisions during implementation/review:
- The request arrived as one message with two asks (the missed quarter-hour chime and this scrollbar). They are independently shippable, so they were built as two sequential `bmad-build` runs rather than one plan; the chime fix is `_bmad-output/plan-quarter-hour-chime-reliability.md`, committed first, and this run starts from that commit.
- The overlay hangs directly off the settings `SafeAreaView` instead of a new wrapper around the ScrollView: an absolutely positioned sibling needs no wrapper, which avoids re-indenting the whole settings tree (the previous change's diff was almost entirely that re-indentation).
- `onSettingsContentSizeChange`'s second parameter is named `contentHeight`, not `height` — eslint's `no-shadow` rule correctly flagged the component's window `height`.
- Heights are stored in one `{ viewport, content }` state object with identity-preserving updates, so a measurement that repeats does not re-render the settings screen.

## Review Triage Log

- `quick` lens (read-only review subagent): no findings — hook order stable across both screen branches, geometry finite for every unmeasured/edge size (`inputRange` always strictly increasing, thumb clamped to at most the track height), overlay excluded from hit-testing by `pointerEvents="none"`, absolute positioning leaves the centred layout and the clock screen untouched.
- Rejected during implementation (not a review finding): driving the thumb from scroll state instead of `Animated.event` was ruled out before coding — a `setState` per frame would re-render every settings control 60 times a second.
- **Superseded on device:** this plan attached `Animated.event` to a plain `ScrollView`, which crashes on the first scroll in RN 0.88 because the native-driver event is an object, not a handler. See `_bmad-output/plan-settings-scrollbar-scroll-crash.md`; the drawn scrollbar itself is unchanged.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: exit 0 (baseline is clean)
- `npx prettier --check App.js` -- expected: unchanged
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` -- expected: Hermes bundle produced without errors

**Manual checks (device only, cannot be run here):**
- Given the settings screen on a short landscape viewport, then a slim bar with a thumb is visible at the right edge before touching anything, the thumb grows/shrinks and slides as content scrolls, and it stops at the bottom exactly when the last button is reached.
- Given a viewport tall enough to fit all settings, then the thumb fills the track and stays visible.
- Given any viewport, then slider dragging, font buttons, the toggle and "Show the clock" still respond — the bar never eats a touch.
