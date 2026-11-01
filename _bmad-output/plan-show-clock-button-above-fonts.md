---
title: 'Put "Show the clock" above the digit font picker'
type: 'feature'
ticket: ''
created: '2026-11-01'
status: 'built'
baseline_revision: '3cf59145bb36db0c50eb0c639a13b485a1d2f544'
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

**Problem:** The way out of the settings screen is the last thing in it. "Show the clock" sits below all ten font buttons and the "Surprise me daily" toggle, so on a short landscape screen the user has to scroll past the whole font picker to get back to the clock — even when they came only to check the time or silence a chime.

**Approach:** Move that button up: it follows the chime-time slider and comes before the "Digit font" block. Nothing else on the screen changes order, and the button itself keeps its look and behaviour.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one file (`App.js`), a ~19 line JSX move with no logic touched.

Ran as planned: the `setFirstScreen(false)` Pressable lifted out of the end of the scroll content and dropped in after the slider group, comment added saying why it sits there. Verification passed: eslint exit 0, prettier clean (one blank line removed where the block was cut), `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` produced a Hermes bundle.

## Review Triage Log

- `quick` lens (read-only review subagent): no findings — the moved subtree is character-for-character identical to the original (handler, styles and inner Text), only one copy of it exists in the file, the scroll content still ends on the font group's `</View>`, and the drawn scrollbar derives its geometry from `onLayout`/`onContentSizeChange` rather than child order, so reordering identical content leaves it correct.
