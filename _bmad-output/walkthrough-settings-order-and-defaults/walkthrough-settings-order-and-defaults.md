# Walkthrough: settings order and on-by-default toggles

Target: commit `9c39e092a35c8fcd39f6a3fb463f3aeeffc260c0` — "feat: lead settings with the clock button and default toggles on" (5 files, +408/−108).

Review in progress. Block 2 is current. A box gets checked only when you say the block is done — nothing else counts as acceptance.

- [x] **Block 1 — Intent** _(done — scope and criteria corrected to match what shipped)_
- [ ] **Block 2 — Broad strokes** _(current)_
- [ ] **Block 3 — The on-by-default rule** _(not visited)_
- [ ] **Block 4 — Clock and pills follow the same test** _(not visited)_
- [ ] **Block 5 — Settings screen order** _(not visited)_
- [ ] **Block 6 — A chime range that can't be used** _(not visited)_
- [ ] **Block 7 — Periphery** _(not visited)_

## Block 1 — Intent

**Problem being solved:** the settings screen opened with the chime-range sliders, so the one action on the screen (`Show the clock`) and the display toggles sat underneath something users rarely touch. And on a fresh install, `Show seconds` and `Pulsing separator` read **Off**, because their reads asked "is the stored value exactly `true`?" — while the neighbouring ticking-sound control had always assumed the opposite: anything you never stored is On.

**Approach:** put the button first on the screen and the display toggles straight after it, then give every boolean preference one shared storage rule — absent, unparseable or unrecognised means **On**, and an explicitly stored `false` is the only Off. All existing write paths stay, so nothing that used to survive a restart stops surviving one.

**Scope actually shipped** (wider than the instruction, deliberately): the rule covers **three** toggles, not the two that were named — `Show seconds`, `Pulsing separator` and `Ticking sound`. The third was included because it answers the same question as the other two (*did the user turn this off?*), its pill already rendered as On while its read asked for an exact `true`, and leaving it out would have kept one preference disagreeing with the rule everything else now follows. Six keys persist in total; the chime range is the only non-boolean among them.

**Success criteria.**
1. A fresh install shows seconds on, and — after tapping `Show the clock`, since the pulse loop is also gated on not being on the settings screen ([App.js:853](../../App.js:853)) — a pulsing separator.
2. Turning a toggle off, force-quitting and relaunching keeps it off. Holds by construction: each of the six keys is read once and written by exactly one effect guarded against the unloaded `null`, so no default can be written over a stored value.
3. Picked fonts survive a restart; with nothing stored, every available font is selected.
4. A corrupt *value* — for a toggle or for the chime range — lands on its default instead of throwing into state. **Not** claimed: a corrupt value repairs itself. Repair happens only for the chime range ([prefDefaults.js:40](../../prefDefaults.js:40)); an unreadable `digitFonts` value still strands the reads that share its `try` (see Block 3 and [deferred-work.md](../deferred-work.md)).

_Source: the `## Intent` section inside `<frozen-after-approval>` of [the build plan](../plan-settings-order-and-defaults-on.md), as approved, corrected in this review to match what shipped._

## Block 2 — Broad strokes

The whole change is one rule plus where that rule is honored. Open these in order and the mechanism is visible without reading anything else:

- [prefDefaults.js:14](../../prefDefaults.js:14) — the rule itself: a stored string becomes an on/off value.
- [App.js:745](../../App.js:745) — launch-time read for seconds and separator, sitting in the same `try` as the font reads.
- [App.js:1089](../../App.js:1089) — top of the settings screen: the button, then the pill row in its own gate wrapper.
- [App.js:1439](../../App.js:1439) and [App.js:853](../../App.js:853) — the clock obeying the same test: the seconds chip and the separator's breath.
- [prefDefaults.js:40](../../prefDefaults.js:40) with [App.js:686](../../App.js:686) — the chime range: what an unusable stored value now becomes, and where it is read.

## Block 3 — The on-by-default rule

Every stored toggle answers one question: *did the user turn this off?* A key that was never written, and a value this version cannot parse, both mean "never turned off" → On; JSON `false` is the only Off. The parse is wrapped so a bad stored value can never throw into React state — which matters because these reads run in sequence at launch, and one exception used to strand every preference after it.

- [prefDefaults.js:14](../../prefDefaults.js:14) — `booleanPref`, the whole rule.
- [App.js:700](../../App.js:700), [App.js:745](../../App.js:745), [App.js:748](../../App.js:748) — its three users: ticking sound, seconds, separator.
- [App.js:927](../../App.js:927)-[938](../../App.js:938) — the save effects, unchanged: a preference still holding `null` (unread) never writes, so a failed read cannot overwrite what is stored.

**Where the protection stops.** The parse is wrapped; the *read* is not. A key this version can't parse is caught inside `booleanPref` and lands on On, but an exception from SecureStore itself escapes into the enclosing `try`, which in [initDigitFontPrefs](../../App.js:712) covers four reads at once — so garbage in `digitFonts` (parsed at [App.js:722](../../App.js:722)) skips `dailyFontPick`, `showSeconds` and `pulseSeparator` beside it. They render on their defaults, the null guards keep anything from being written back, and the bad value is therefore never repaired. Deferred, not fixed here.

## Block 4 — Clock and pills follow the same test

A rule that only governs reads would show one thing in settings and do another on the clock, so the consumers ask the same question the storage rule asks: "is this explicitly off?" While a read is still outstanding the state is `null`, which now renders as On — its default — rather than Off.

- [App.js:1439](../../App.js:1439) — the seconds chip draws unless the value is explicitly `false`.
- [App.js:853](../../App.js:853) — the separator animates unless it is explicitly `false`; switching it off still leaves a steady colon rather than a frozen mid-breath one. Note this effect also stops the breath while the settings screen is up (`firstScreen`), and the app opens there — so "fresh install pulses" is only observable after tapping `Show the clock`.
- [App.js:890](../../App.js:890) — the third toggle's consumer: `isTickingAudible({ enabled: tickingSound, … })`, gated the same way as its pill renders, so an unloaded value ticks like its On default instead of going silent until the read lands.
- [App.js:1136](../../App.js:1136)-[1155](../../App.js:1155) — all three pills' `value` and `onToggle` pairs, so what a pill shows and what a tap stores agree — including a tap on a still-unloaded pill, which turns the option **off** rather than on.

## Block 5 — Settings screen order

The blocks themselves were lifted, not rebuilt: same button styles, same pill components, same slider. What changed is their order in the scroll view, plus the pill row getting a wrapper of its own so it can be inert while preferences load.

- [App.js:1089](../../App.js:1089) — `Show the clock` now leads the screen, with the reasoning kept beside it.
- [App.js:1116](../../App.js:1116)-[1131](../../App.js:1131) — the pill row lifted out of the fonts group, with its own `fontPrefsLoaded` gate; the comment here says plainly what that gate does and does not promise. Three pills ride in it, in this order: seconds, separator, ticking sound.
- [App.js:1185](../../App.js:1185) then [App.js:1251](../../App.js:1251) — chime range and fonts follow, in that order; the range's explanatory text travels with its slider so "specified below" stays true.

## Block 6 — A chime range that can't be used

The range is the one preference that isn't a switch, so it got the same treatment: garbage, or a value the slider couldn't draw (not whole hours inside 0..24, or inverted), is repaired to a full day instead of trusted, and the read no longer sits bare in front of every other launch-time read.

- [prefDefaults.js:30](../../prefDefaults.js:30) — `CHIME_RANGE_DEFAULT`, now also feeding the slider's own bounds at [App.js:1218](../../App.js:1218), so the repair rule and the control cannot drift apart.
- [prefDefaults.js:40](../../prefDefaults.js:40) — `rangePref`.
- [App.js:686](../../App.js:686) — `initChimingTime` wrapped in `try`: an unreadable store leaves the range unloaded (so nothing is written over it) while the tick and font preferences still load.

## Block 7 — Periphery

- [__tests__/prefDefaults.test.js:6](../../__tests__/prefDefaults.test.js:6), [:30](../../__tests__/prefDefaults.test.js:30), [:43](../../__tests__/prefDefaults.test.js:43) — the three describes pinning the rule, the corrupt-value path, and the range repair.
- [../plan-settings-order-and-defaults-on.md](../plan-settings-order-and-defaults-on.md) — the build plan, including its review triage log.
- [../deferred-work.md](../deferred-work.md) — the two items this review pushed out: one throwing preference read stranding the rest of its pass, and the unrun Codacy analysis pass.
