---
title: 'Replace app store icon with Luminous Chime artwork'
type: 'chore'
ticket: ''
created: '2026-10-29'
status: 'built'
baseline_revision: '83ad721'
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

**Problem:** The app icon is still the old orange bell glyph. The user supplied new artwork ("Luminous 10_24 Chime Icon.png", 768×768) to use as the app store icon.

**Approach:** Replace `assets/icon.png` with the new art prepared as a proper 1024×1024 full-bleed master: the source has white corners outside its baked-in rounded square, which must be filled with the artwork's own dark background color (store/launcher masks will re-round it). Reuse the same prepared image for the Android adaptive foreground and refresh `assets/favicon.png` from it. No app.json path changes needed; set the adaptive icon background to the artwork navy so any exposed parallax edge matches.

## Boundaries & Constraints

**Always:** Master icon 1024×1024, fully opaque, no white pixels at the four corners; derived assets generated from the same prepared master.
**Never:** No changes to splash/favicon *paths*, build numbers, or unrelated assets; no new dependencies.

</frozen-after-approval>

## Implementation Notes

(oneshot route — mechanical asset swap with image processing.)

- Source art (768x768) had white corners outside its baked-in squircle and 1px white padding on right/bottom edges; flood-fill approaches leaked through the bright rim highlight, so the final pipeline uses a geometric keep-mask (circle r=223 + rects, feathered) over a radial navy gradient background (#10243 4→#000108 family), upscaled to 1024 with a 3px #080E1D edge frame.
- icon.png == adaptive-icon.png (full-bleed master, per Android guidance); favicon derived at 48x48; app.json adaptiveIcon backgroundColor #FFFFFF -> #080E1D to match art background.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `magick identify` on all three assets -- expected: 1024x1024 (favicon per current size), opaque, corner pixels dark (r < 64)
- `npx expo config --type public` -- expected: app.json resolves with icon paths intact

**Manual checks:**
- View generated icon.png and adaptive-icon.png; artwork centered/unclipped, corners dark navy, no white fringes along the squircle arc.

## Review Triage Log

- [x] high / patch (fixed): master icon stored with alpha channel (`srgba`, uniformly opaque) — Apple rejects 1024px PNGs carrying an alpha channel even when opaque; verified via `identify %[channels]` and `-channel A -separate`. Fix: rebuilt pipeline ending in `-alpha off PNG24:`; final assets are `srgb 3.0`
- [x] high / patch (fixed): pure-white fringe residue along right/bottom canvas edges (37–39 bright px per edge from the 768→1024 preparation of art whose white padding touches those edges) — would stay visible under store masks. Fix: 3px navy (#080E1D) frame painted on all four edges after upscale; byte-level audit of final icon.png shows 0 pixels ≥240 within 10px of any edge, corners exactly (8,14,29)
- [x] defer: `assets/splash.png` still uses the old orange-bell artwork and white splash background clashes with the new navy icon — pre-existing asset, out of this plan's scope; logged to deferred-work.md
