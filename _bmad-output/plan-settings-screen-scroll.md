---
title: 'Make the settings screen scrollable on small phones'
type: 'bugfix'
ticket: ''
created: '2026-10-30'
status: 'built'
baseline_revision: 'd95e114dee193febb41ee9814b50616097d161bc'
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

**Problem:** The settings screen (the `firstScreen` view in App.js) is a fixed, vertically centered column. On smaller phones its content — intro text, chime time-range slider, digit-font buttons, "Surprise me daily" toggle, and the "Show the clock" button — exceeds the viewport and gets clipped with no way to reach it.

**Approach:** Render the settings content inside a vertical `ScrollView` that keeps today's centered look when everything fits and becomes scrollable when it doesn't. Clock screen untouched.

</frozen-after-approval>

## Implementation Notes

Oneshot route: single-file, ~30-line UI change well under the 100-line threshold. The settings screen is one JSX block inside `App.js`. Wrapping its children in a `ScrollView` whose `contentContainerStyle` uses `flexGrow: 1`, `justifyContent: 'center'`, and `alignItems: 'center'` reproduces the current centered layout whenever content fits (container grows to viewport, centering applies) and scrolls naturally when it overflows (container grows to content height, centering becomes a no-op — no clipped top). The outer `SafeAreaView` keeps its white background and safe-area insets; the slider section already declares `width: '90%'`, so horizontal sizing is unchanged. A horizontal MultiSlider inside a vertical ScrollView is unaffected because the scroll view only claims vertical gestures.

Ran as planned: `ScrollView` imported, firstScreen JSX children wrapped in it, the two new styles added, and prettier re-indented the wrapped block (the large diff stat is that re-indentation, not logic). Verification passed: eslint exit 0, babel parse OK, and `npx expo export --platform ios` produced a Hermes bundle (needed `EXPO_NO_TELEMETRY=1` in the sandbox to skip an unrelated `~/.expo` write).

Decisions during implementation/review: `width: '100%'` added to `settingsScroll` — the parent's `alignItems: 'center'` shrink-wraps a flex-only child, which would have re-resolved the 90% sections and MultiSlider against a content-sized box (found in review). The `paddingBottom: 24` on the content container is deliberate breathing room for the last button when scrolled; it shifts the centered layout by ~12pt only on viewports tall enough to fit everything. The app is landscape-locked (`app.json` `"orientation": "landscape"`), so "small phones" means short landscape viewports (e.g. iPhone SE landscape) where the settings column overflows. The pre-existing `app.json` buildNumber 20→21 bump in the working tree is unrelated release work and is deliberately excluded from this change's commit.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: exit 0 (baseline was clean) — passed

**Manual checks:**
- Settings content scrolls to reveal the "Show the clock" button on a short landscape viewport (app is landscape-locked; e.g. iPhone SE landscape simulator).
- On a viewport tall enough to fit everything (e.g. iPad landscape) the screen still looks centered as before; the slider still drags horizontally. Note: vertical swipes that start on a slider thumb or the between-track are captured by MultiSlider (deferred — see deferred-work.md); scroll from elsewhere.

## Review Triage Log

- `medium` (patched): ScrollView shrink-wrapped under parent `alignItems: 'center'` — RN vertical ScrollView base style is main-axis only (verified in node_modules), so added `width: '100%'`.
- `medium` (deferred): MultiSlider thumbs/between-track capture all pan gestures (`onMoveShouldSetPanResponderCapture: true`, verified at MultiSlider.js:78-87), blocking vertical scroll there; no simple safe fix, recorded in deferred-work.md.
- `low` (accepted): `paddingBottom: 24` not in plan — deliberate, ~12pt shift only on viewports that fit everything; rationale recorded in Implementation Notes.
- `false`: "acceptance criteria asserted, not demonstrated" misstates status — manual checks are the post-plan human step; static evidence (export bundle) is honest and complete for this environment. Device check remains listed as manual.
- `low` (fixed in plan): viewport wording — app is landscape-locked (`app.json:7`); manual checks reworded to iPhone SE landscape / iPad landscape.
- `low` (fixed): `app.json` 20→21 bump is pre-existing unrelated work; Implementation Notes now say it is excluded from this commit; committing App.js only.
- Rejected (process): Codacy MCP rule — no `codacy_cli_analyze` tool is available in this session and the rules forbid manual CLI installation; project lint (eslint+prettier, exit 0) was run instead.
