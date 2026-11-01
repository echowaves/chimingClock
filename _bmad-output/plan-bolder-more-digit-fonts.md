---
title: 'Bolden Rounded and Script and widen the digit font choice'
type: 'feature'
ticket: ''
created: '2026-10-31'
status: 'built'
baseline_revision: '44f653916b817a495415cc73c46806d9fb973bba'
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

**Problem:** The Rounded and Script digit fonts look too thin next to the others, because one global semibold weight is asked of families that have no semibold face. There are also only four real choices to pick from.

**Approach:** Let each font ask for the weight that suits it instead of sharing one value, so Rounded and Script get a genuinely bold face from their own families. Add five more digit fonts, taken from faces the device already has, each with an Android fallback family.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one file (`App.js`), ~45 lines, all inside the `FONTS` table plus two places that read it.

Investigation (verified against the pinned dependencies):
- `App.js:31-66` — `FONTS` maps id → `{ label, style }`, where `style` is a `Platform.select` of `fontFamily` only. `DAILY_FONT_POOL` (`App.js:69`) and the settings buttons derive from these keys, so a new entry appears in both without further edits.
- `App.js:165-172` — `fontSpecs` sets `fontWeight: '600'` and spreads `FONTS[currentFontId].style` last, which is why an entry can override the weight; but no entry did, so every family was asked for semibold.
- `node_modules/react-native/.../RCTFontUtils.mm:413-447` — on iOS RN lists the faces of the requested family and keeps the one whose weight is **closest** to the requested weight (falling back to the first face when nothing matches). Avenir's faces are Book/Medium/DemiBold/Heavy/Black, so a 0.6 request lands on Medium — visibly light at clock size; Snell Roundhand has Regular/Bold/Black and no semibold at all. That is the reported thinness, and it cannot be fixed by asking for a weight between the available faces — only by asking for one nearer the face that exists.
- `ReactAndroid/src/main/java/com/facebook/react/views/text/TextAttributeProps.kt:268` — Android parses numeric weights and applies them to the typeface, so the same numeric request carries over; an unknown family name falls back to the platform default rather than failing, which bounds the risk of a face that a given device lacks.
- `App.js:519` — the settings preview buttons hardcode `fontWeight: '600'`, so previews would otherwise keep showing the thin look.
- Keep untouched: the measurement/fit logic (`digitMetrics`, `fittedFontSize`), which already measures per font id and time string, the daily-pool derivation, the chime fix, and the settings scrollbar.

Decisions recorded for this run (the human was away when they were offered): system faces rather than bundled Google Fonts — no new dependencies, and it matches how the existing five are declared; five additions (Typewriter, Geometric, Display, Engraved, Marker); a heavier weight request for the two thin fonts — `800` for Rounded, which resolves to Avenir-Heavy, and `700` for Script, which is exactly Snell Roundhand Bold. Both are clearly bold without reaching the display-weight Black faces.

Change shape:
- Each `FONTS` entry gains a `weight`; existing entries keep `'600'`, Rounded moves to `'800'` and Script to `'700'`.
- Five new entries, each with an iOS face and an Android family fallback.
- `fontSpecs` and the settings preview buttons read the entry's weight instead of a shared literal.

Ran as planned: per-entry weights in `FONTS`, the five new faces, and both readers switched to `FONTS[id].weight`. Verification passed: eslint exit 0, prettier clean, `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` produced a Hermes bundle.

Decisions during implementation/review:
- Script asks for `'700'`, not `'800'`: Snell Roundhand offers Regular/Bold/Black, so an 800 request leaves Bold (700) and Black (900) exactly one step away and the closest-face loop keeps whichever it meets first — the digit could land on the ornate Black. Asking for 700 removes the tie.
- The blank label the human reported after installing this build was a missing `label` on the `script` entry: the settings button renders `{FONTS[id].label}`, so an omitted key prints nothing at all. Restored, and the other nine entries were checked to each carry one.

## Review Triage Log

- `quick` lens (read-only review subagent): no significant issues — every `FONTS` entry resolves to a real object with `label`/`weight`/`style`, so `fontSpecs` and the preview buttons cannot read an undefined weight; stored ids that predate the additions still normalize through `normalizeFontId`; `DAILY_FONT_POOL` picks up the new ids automatically; nothing else reads the old two-key shape.
- Patched from that review: Script's `'800'` → `'700'`, to break the Bold/Black distance tie described above. Re-linted and re-formatted after the change (both clean).
- Fixed from device testing (human-reported): the missing `script` label, which rendered that button's name blank.

## Verification

**Commands:**
- `npx eslint App.js` -- expected: exit 0 (baseline is clean)
- `npx prettier --check App.js` -- expected: unchanged
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` -- expected: Hermes bundle produced without errors

**Manual checks (device only, cannot be run here):**
- Given the settings screen, then ten font buttons show, each with a visible name — including Script — each preview rendered at its own weight, and Rounded and Script look as heavy as Serif.
- Given a newly added font, then the clock digits use it and still fit the screen without wrapping (the probe measures each family).
- Given 'Surprise me daily' on, then the next day's font can be any of the nine non-default faces; given a device missing one of the new iOS faces, then that choice falls back to the system font instead of failing.
