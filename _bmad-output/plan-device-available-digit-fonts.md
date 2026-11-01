---
title: 'Offer only the digit fonts a device actually has'
type: 'feature'
ticket: ''
created: '2026-11-01'
status: 'in-progress'
baseline_revision: 'ee33b84'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The picker lists ten faces because ten are usually present, not because this device has them. A family the device does not have is not an error: React Native quietly falls back to the system font, so the button says Engraved while the clock draws San Francisco or Roboto, and "Surprise me daily" can land on a face that renders as something else. Nothing tells the user their choice did nothing, and no list of "fonts iOS ships" written into the app can know what this particular device has.

**Approach:** Ask the device rather than assume. Each candidate face is laid out once in a hidden probe at a known size next to a twin probe that asks for the same weight with no family; if the two come out metrically identical, the family did not resolve and its button is not offered. Detection is therefore per-device and per-OS. Until measurement completes everything stays offered, so the picker never starts empty or loses buttons while the user is looking at it.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one file (`App.js`), ~85 lines — a probe component, collection state, an availability memo, and three places that consume it.

Investigation (verified against the pinned dependencies):
- `node_modules/react-native/Libraries/Types/CoreEventTypes.js:64-71` — `onTextLayout` reports per line `{x, y, width, height, text, ascender, capHeight, descender, xHeight}`. Those six numbers are enough to tell two faces apart, and the app already relies on this event for digit fitting (`App.js:241-247`).
- `node_modules/react-native/.../RCTFontUtils.mm:413-447` — an unmatched `fontFamily` is answered with the system font rather than a failure, which is exactly why a missing face is invisible today. It also means a missing family and a no-family probe at the same weight produce *the same* metrics, which is the signal to detect it by.
- `App.js:38-125` — every entry carries `{label, weight, style}`; only `default` has an empty `style`, so it is the system font by construction and must never be filtered out.
- Weights matter for the comparison: Avenir at 800 and the system font at 800 are different faces, but a *missing* family at 800 renders as the system font at 800. So each candidate is compared against a twin that requests no family at the candidate's own weight — not against one global baseline.
- `App.js:130-141` — `DAILY_FONT_POOL`, `dailyFontId` and `activeFontId` are pure; they gain an availability parameter rather than reading state, keeping them testable and keeping the daily derivation stable for a given device.

Decisions taken (the human was away when they were offered):
- **Hide, don't grey.** The ask is that unavailable fonts are "not available in the picker", so they are removed from the list; a disabled row would still advertise a face the device lacks and add a second visual state to maintain.
- **Measure, don't declare.** A static per-platform table was rejected: it cannot know an Android skin that dropped `casual`, and it would hide faces that are present. A native module calling `UIFont.fontNames(forFamilyName:)` is definitive on iOS but needs new native code plus a rebuild, answers nothing on Android, and the metric probe already covers both platforms from JS.
- **Fail open while measuring.** Availability starts unknown; the picker shows everything until probes report, so a slow or unexpected layout can never leave the user with an empty picker or silently move their chosen font out from under them.
- **Comparison tolerance, not equality.** Sub-pixel differences in reported line boxes across faces are real; metrics must differ by more than a small epsilon to count as a distinct face. A coincidence that large across width, height and all four vertical metrics for one of these deliberately distinctive families is the residual risk, recorded in Verification.
- **Active font follows availability.** If the stored or daily id turns out unavailable on this device, the clock draws `default` instead of the system-font rendering of a face it does not have — so the highlighted button and the digits agree.

Change shape:
- A module-level `FontProbe` component: one hidden `Text` at `MEASURE_SIZE` reporting its line metrics through `onTextLayout`.
- Candidate probes for every font with a family, plus one system twin per distinct requested weight; results collected into one `{ [key]: metrics }` state map.
- `availableFontIds` memo: the ids whose candidate differs from its twin, plus `default`; `null` while anything is still unmeasured.
- Picker, daily pool and active-font resolution all read the availability set.
