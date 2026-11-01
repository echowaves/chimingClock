---
title: 'Fix the settings screen crashing on the first scroll'
type: 'bugfix'
ticket: ''
created: '2026-11-01'
status: 'built'
baseline_revision: '87c94a0b7fc85ab2c60066144a82235e7c0a5280'
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

**Problem:** On device the settings screen dies as soon as it is scrolled: `Uncaught Error: Object is not a function`, thrown from `ScrollView._handleScroll` (`node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js:1247`). The screen is unusable — nothing can be changed, including "Show the clock". The defect came in with the always-visible scrollbar (`44f6539`) and was reported from the first device run after that build.

**Approach:** Give the animated scroll event to a component that understands it. `Animated.event(..., { useNativeDriver: true })` is not a callback in this React Native version — it is an `AnimatedEvent` object that an *animated* component attaches natively and replaces with a real handler for the wrapped view. So the settings scroller becomes `Animated.ScrollView`; no other behaviour of the drawn scrollbar changes.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one file (`App.js`), four lines changed (open/close tag, an explanatory comment, and the import that became unused).

Investigation (verified against the pinned dependencies):
- `node_modules/react-native/Libraries/Animated/AnimatedImplementation.js:578-590` — `eventImpl` builds an `AnimatedEvent` and, when the config asks for the native driver (`animatedEvent.__isNative`), returns **that object**; only the JS-driver branch returns `animatedEvent.__getHandler()`, a function. The comment above it states the object is meant to be "handed straight back to an animated component's event prop".
- `node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js:1246-1249` — a plain `ScrollView` does exactly `this.props.onScroll && this.props.onScroll(e)`. The object is truthy, so the first scroll event calls it and Hermes throws `Object is not a function`, matching the reported stack frame for frame.
- `node_modules/react-native/Libraries/Animated/components/AnimatedScrollView.js:143` — `Animated.ScrollView` is `createAnimatedComponent(ScrollView)`, and `node_modules/react-native/Libraries/Animated/nodes/AnimatedProps.js:175-176, 183-197` shows why that is the fix: an animated component collects the native `AnimatedEvent` props, attaches them to the native view (`propValue.__attach(target, propName)` in `src/private/animated/createAnimatedPropsHook.js:205-211`) and hands the wrapped view `maybeNode.__getHandler()` — a function. Static props such as `onLayout`, `onContentSizeChange` and `contentContainerStyle` pass through untouched.
- `AnimatedScrollView` defaults `scrollEventThrottle` to `0.0001` *before* spreading props, so the explicit `scrollEventThrottle={16}` still wins.
- Keep untouched: the thumb geometry, the track/thumb styles, `showsVerticalScrollIndicator={false}`, `pointerEvents="none"`, and everything on the clock screen.

Change shape:
- `<ScrollView>` → `<Animated.ScrollView>` around the settings content, closing tag to match.
- A comment at the element saying why the animated variant is required, so it is not "simplified" back.
- `ScrollView` dropped from the `react-native` import; nothing else used it.

Decisions during implementation/review:
- Rejected: `{ useNativeDriver: false }`, which would return a callable handler and hide the crash. It puts every scroll frame through the JS thread for a bar that can be driven natively, and it leaves the code doing the wrong thing with an animated component only one edit away.
- Rejected: calling `Animated.event(...).__getHandler()` by hand — private API, and it is exactly what the animated component already does.
- `_bmad-output/plan-always-visible-settings-scrollbar.md` recommended plain `ScrollView` + `Animated.event`; that recommendation was wrong on device and now carries a pointer here.

## Review Triage Log

- `quick` lens (read-only review subagent): no significant issues — the only scroll handler in the file is this one, so no other component receives an `AnimatedEvent` object; the removed import has no remaining use outside comments (eslint exit 0 confirms); the wrapped element keeps every prop it had, and the overlay still positions against the same `SafeAreaView`.
- Noted, not changed: the thumb now updates on the native driver's own cadence rather than a JS callback — the intended behaviour of the original design.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: exit 0 (baseline is clean; also proves no unused import)
- `npx prettier --check App.js` -- expected: unchanged
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` -- expected: Hermes bundle produced without errors

**Manual checks (device only, cannot be run here):**
- Given the settings screen, then scrolling to the bottom and back raises no red box, and the drawn thumb slides with the content.
- Given the settings screen, then sliders, font buttons, the toggle and "Show the clock" still work — the animated wrapper changed no touch handling.
