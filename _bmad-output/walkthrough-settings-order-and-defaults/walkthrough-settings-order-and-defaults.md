# Walkthrough: settings order and on-by-default toggles

Target: commit `9c39e092a35c8fcd39f6a3fb463f3aeeffc260c0` — "feat: lead settings with the clock button and default toggles on" (5 files, +408/−108).

Suite status at review close (HEAD `8722214`, 2026-11-27): `npx jest --ci` → 87 passed / 4 suites; eslint clean over the five source modules and `__tests__`; `npx prettier --check "**/*.js"` clean. Only the code commit made during this review (`8722214`, a comment) sits between that run and the reviewed commit `9c39e09`.

Every block has been walked once. Nothing is checked off until you say a block is done. A box gets checked only when you say the block is done — nothing else counts as acceptance.

- [x] **Block 1 — Intent** _(done — scope and criteria corrected to match what shipped)_
- [x] **Block 2 — Broad strokes** _(done — tour extended to the write side, all three toggle reads, and what `fontPrefsLoaded` actually promises)_
- [x] **Block 3 — The on-by-default rule** _(done — header comment corrected in `8722214`; rule itself confirmed sound and well-pinned)_
- [x] **Block 4 — Clock and pills follow the same test** _(done — colon shown as a derived render site; layout proven immune to the default)_
- [x] **Block 5 — Settings screen order** _(done — button move proven byte-identical; nothing left behind and no order assumptions)_
- [x] **Block 6 — A chime range that can't be used** _(done — rule executed against real values; repair-vs-never-recover contrast recorded)_
- [x] **Block 7 — Periphery** _(done — handoff docs corrected: line refs, superseded snippet, stale deferred-work clause, launch observation added to the device checklist)_

## Block 1 — Intent

**Problem being solved:** the settings screen opened with the chime-range sliders, so the one action on the screen (`Show the clock`) and the display toggles sat underneath something users rarely touch. And on a fresh install, `Show seconds` and `Pulsing separator` read **Off**, because their reads asked "is the stored value exactly `true`?" — while the neighbouring ticking-sound control had always assumed the opposite: anything you never stored is On.

**Approach:** put the button first on the screen and the display toggles straight after it, then give every boolean preference one shared storage rule — absent, unparseable or unrecognised means **On**, and an explicitly stored `false` is the only Off. All existing write paths stay, so nothing that used to survive a restart stops surviving one.

**Scope actually shipped:** the rule covers **three** toggles — `Show seconds`, `Pulsing separator` and `Ticking sound` — while the instruction named two. That gap was closed before anyone wrote code: the approved plan's frozen Intent names all three pills and its Decisions move the whole row, so the third toggle is approved scope rather than implementer drift. It is worth stating here anyway because a reader of the instruction alone would not expect it, and the reason holds regardless — it answers the same question as the other two (*did the user turn this off?*), its pill already rendered as On while its read asked for an exact `true`, and leaving it out would have kept one preference disagreeing with the rule everything else now follows. Six keys persist in total; the chime range is the only non-boolean among them.

**Success criteria.**
1. A fresh install shows seconds on, and — after tapping `Show the clock`, since the pulse loop is also gated on not being on the settings screen ([App.js:853](../../App.js:853)) — a pulsing separator.
2. Turning a toggle off, force-quitting and relaunching keeps it off. Holds by construction: each of the six keys is read once and written by exactly one effect guarded against the unloaded `null`, so no default can be written over a stored value.
3. Picked fonts survive a restart; with nothing stored, every available font is selected.
4. A corrupt *value* — for a toggle or for the chime range — lands on its default instead of throwing into state. **Not** claimed: a corrupt value repairs itself. Repair happens only for the chime range ([prefDefaults.js:40](../../prefDefaults.js:40)); an unreadable `digitFonts` value still strands the reads that share its `try` (see Block 3 and [deferred-work.md](../deferred-work.md)).

_Source: the `## Intent` section inside `<frozen-after-approval>` of [the build plan](../plan-settings-order-and-defaults-on.md), as approved, corrected in this review to match what shipped._

## Block 2 — Broad strokes

The whole change is one rule plus everywhere that rule is honored: read, write, screen, clock. Open these in order and the mechanism is visible without reading anything else:

- [prefDefaults.js:14](../../prefDefaults.js:14) — the rule itself: a stored string becomes an on/off value.
- [App.js:745](../../App.js:745), [App.js:748](../../App.js:748) and [App.js:700](../../App.js:700) — the rule's three users at launch: seconds, separator, ticking sound. The first two sit in the same `try` as the font reads; that shared `try` is what Block 3's caveat is about.
- [App.js:85](../../App.js:85) with [App.js:908](../../App.js:908)-[939](../../App.js:939) — the way back out, and the half of the change that makes "survives a restart" true. One best-effort writer (`persistPref`, which swallows a SecureStore failure rather than throwing inside an effect), called from six effects that each refuse to write while their value is still `null` — so a default can never be stored over a real choice.
- [App.js:1089](../../App.js:1089) — top of the settings screen: the button, then the pill row in its own gate wrapper. The flag that wrapper reads, `fontPrefsLoaded`, means *the preference-read pass has finished* — it is set unconditionally in the `finally` at [App.js:759](../../App.js:759) (state declared at [App.js:420](../../App.js:420)) — **not** that any particular value arrived. Block 3's caveat rests on that distinction.
- [App.js:1439](../../App.js:1439), [App.js:853](../../App.js:853) and [App.js:890](../../App.js:890) — the clock obeying the same test as the storage rule: the seconds chip, the separator's breath, and the ticking player's gate.
- [prefDefaults.js:40](../../prefDefaults.js:40) with [App.js:686](../../App.js:686) — the chime range: what an unusable stored value now becomes, and where it is read. Its bounds reach the slider itself at [App.js:1218](../../App.js:1218), so rule and control cannot drift apart.

## Block 3 — The on-by-default rule

Every stored toggle answers one question: *did the user turn this off?* A key that was never written, and a value this version cannot parse, both mean "never turned off" → On; JSON `false` is the only Off. The parse is wrapped so a bad stored value can never throw into React state — which matters because these reads run in sequence at launch, and one exception used to strand every preference after it.

The commit itself shows the split this heals: the pill row it removed from the fonts group still carries its old tests in the diff (`9c39e09`, deletion inside the `@@ -1224,60` hunk of [App.js](../../App.js)) — `value: showSeconds === true` and `value: pulseSeparator === true` sitting directly beside a ticking-sound pill that already said `value: tickingSound !== false`. Two toggles asking "is it stored as true?", their neighbour asking "did anyone say no?".

- [prefDefaults.js:14](../../prefDefaults.js:14) — `booleanPref`, the whole rule.
- [App.js:700](../../App.js:700), [App.js:745](../../App.js:745), [App.js:748](../../App.js:748) — its three users: ticking sound, seconds, separator.
- [App.js:927](../../App.js:927)-[938](../../App.js:938) — the save effects, unchanged: a preference still holding `null` (unread) never writes, so a failed read cannot overwrite what is stored.

**Where the protection stops.** The parse is wrapped; the *read* is not. A key this version can't parse is caught inside `booleanPref` and lands on On, but an exception from SecureStore itself escapes into the enclosing `try`, which in [initDigitFontPrefs](../../App.js:712) covers four reads at once — so garbage in `digitFonts` (parsed at [App.js:722](../../App.js:722)) skips `dailyFontPick`, `showSeconds` and `pulseSeparator` beside it. They render on their defaults, the null guards keep anything from being written back, and the bad value is therefore never repaired. Deferred, not fixed here.

What the wrapping did buy: all three preference inits now swallow their own throws ([App.js:687](../../App.js:687), [App.js:701](../../App.js:701), [App.js:715](../../App.js:715)), so the sequential launch chain in [App.js:795](../../App.js:795)-[799](../../App.js:799) can no longer reject part-way through and strand everything after it — before this change, `initChimingTime` sat bare at the head of that chain.

The module header used to claim the opposite — "every read goes through one of these" — which was contradicted by the three reads above. Corrected during this review in `8722214`, so [prefDefaults.js:1](../../prefDefaults.js:1) now names the font-set and daily-pick exceptions and points at `resolveSelectedFonts` ([fontSelection.js:50](../../fontSelection.js:50)).

**Checked, not changed.** Two things were looked for here and found absent: *format drift* — no shipped build ever wrote these keys through Expo's own boolean encoding (`git log -S getBooleanItemAsync` / `-S setBooleanItemAsync` on [App.js](../../App.js) come back empty), and the rule tolerates that encoding anyway, since `JSON.parse('false') === false`, so an upgrading install can never be flipped On by the new default. And *coverage gaps* — the tests pin every value shape the store can hand back (`null`, `undefined`, `''`, garbage, `'0'`, `'null'`, `'{}'`, both string and native booleans), plus string bounds and inverted ranges for the chime window; what stays unpinned is only the App.js composition above, which needs a React Native jest environment this repo deliberately does not have.

## Block 4 — Clock and pills follow the same test

A rule that only governs reads would show one thing in settings and do another on the clock, so the consumers ask the same question the storage rule asks: "is this explicitly off?" While a read is still outstanding the state is `null`, which now renders as On — its default — rather than Off.

- [App.js:1439](../../App.js:1439) — the seconds chip draws unless the value is explicitly `false`.
- [App.js:853](../../App.js:853) — the separator animates unless it is explicitly `false`; switching it off still leaves a steady colon rather than a frozen mid-breath one. Note this effect also stops the breath while the settings screen is up (`firstScreen`), and the app opens there — so "fresh install pulses" is only observable after tapping `Show the clock`.
- [App.js:890](../../App.js:890) — the third toggle's consumer: [isTickingAudible](../../soundGating.js:20), gated by the same `!== false` test its pill renders, so a value that never arrived still ticks. The case that matters is a *failed* read, not a slow one: the launch effect awaits all three preference inits before [initSounds](../../App.js:763) creates any player (called at [App.js:799](../../App.js:799)) and `resetTicking` early-returns while there is no player, so nothing can sound mid-launch anyway — but a read that failed leaves the value `null` for the whole session, and the lenient test is what stops that from silencing a clock whose tick has always played.
- [App.js:1429](../../App.js:1429) — the colon itself is a fifth render site, but it reads the `separatorPulse` **animated value**, not the boolean: the effect above owns the decision and this line just obeys it. So there is no second place to look for a missing gate.
- [App.js:1136](../../App.js:1136)-[1155](../../App.js:1155) — all three pills' `value` and `onToggle` pairs, so what a pill shows and what a tap stores agree — including a tap on a still-unloaded pill, which turns the option **off** rather than on.

**Layout cannot be perturbed by a default.** A value that renders On before its read lands is only safe if showing it costs nothing structurally, and here it does: the chip is `position: 'absolute'` ([secondsChipStyle](../../App.js:637)), and the layout key the row extent and motion walls are cached under is `` `${currentFontId}|${currentText}` `` ([App.js:516](../../App.js:516)) — no toggle enters it. Turning seconds off therefore cannot change a measurement or move a wall. The chip's size comes from a hidden probe on the settings screen ([App.js:1367](../../App.js:1367)) that renders whatever the toggle says, so even an install with seconds off has them measured before anyone turns them on.

## Block 5 — Settings screen order

The blocks themselves were lifted, not rebuilt: same button styles, same pill components, same slider. What changed is their order in the scroll view, plus the pill row getting a wrapper of its own so it can be inert while preferences load.

- [App.js:1089](../../App.js:1089) — `Show the clock` now leads the screen, with the reasoning kept beside it.
- [App.js:1116](../../App.js:1116)-[1131](../../App.js:1131) — the pill row lifted out of the fonts group, with its own `fontPrefsLoaded` gate; the comment here says plainly what that gate does and does not promise. Three pills ride in it, in this order: seconds, separator, ticking sound.
- [App.js:1185](../../App.js:1185) then [App.js:1251](../../App.js:1251) — chime range and fonts follow, in that order; the range's explanatory text travels with its slider so "specified below" stays true.

**Verified rather than assumed.** Three things were checked because a reordering is exactly where collateral hides. The button is a *pure* move: its block extracted from `9c39e09^` (old line 1151) and from here ([App.js:1114](../../App.js:1114)) is byte-identical once indentation is stripped. Nothing was left behind where the pills used to sit — the fonts group keeps its own gate and column layout intact ([App.js:1231](../../App.js:1231)-[1241](../../App.js:1241)), and the pill row's new gate gives exactly the coverage it previously inherited, since at `9c39e09^` the file had a single gated wrapper (old line 1155) that the pills were inside. And nothing in the screen remembered the old order: content height is measured by `onSettingsLayout` ([App.js:1084](../../App.js:1084)) into the scrollbar-thumb math ([App.js:1012](../../App.js:1012)-[1028](../../App.js:1028)), and the file contains no `scrollTo` or `initialScrollIndex` at all.

## Block 6 — A chime range that can't be used

The range is the one preference that isn't a switch, so it got the same treatment: garbage, or a value the slider couldn't draw (not whole hours inside 0..24, or inverted), is repaired to a full day instead of trusted, and the read no longer sits bare in front of every other launch-time read.

- [prefDefaults.js:30](../../prefDefaults.js:30) — `CHIME_RANGE_DEFAULT`, now also feeding the slider's own bounds at [App.js:1218](../../App.js:1218), so the repair rule and the control cannot drift apart.
- [prefDefaults.js:40](../../prefDefaults.js:40) — `rangePref`.
- [App.js:686](../../App.js:686) — `initChimingTime` wrapped in `try`: an unreadable store leaves the range unloaded (so nothing is written over it) while the tick and font preferences still load.

**Executed, not reasoned about.** The function was run against hand-written stored values rather than read: `{"min":7,"max":22}`, `{"min":23,"max":24}`, `{"min":0,"max":0}` and `{"min":24,"max":24}` come back unchanged; `{"min":"8","max":9}`, `[0,24]`, `{"min":0,"max":24.5}` and `{"min":-0,"max":24}` become a full day (the last one normalizing `-0` to `0`). Nothing produced a range the slider could not draw, and unknown extra keys are dropped rather than rejected — so the rule is total over every shape the store can hand back.

**Why this one recovers and the fonts never do.** The repaired value is non-null, so [App.js:908](../../App.js:908)-[910](../../App.js:910) writes it back on the same launch: a corrupt range is *repaired*, permanently. Every preference does exactly one write per launch after a successful load ([App.js:908](../../App.js:908)-[939](../../App.js:939)) — harmless by itself, and precisely the mechanism Block 3's corrupt font value lacks, since that read leaves its state `null` and the guards then refuse to write anything at all.

**One thing that looks like a bug and isn't.** `{min:0,max:0}` survives the rule, which means *silent for the whole day* — reachable by putting both slider thumbs on the same hour, deliberate enough that [__tests__/prefDefaults.test.js](../../__tests__/prefDefaults.test.js) pins it as "a silent day".

## Block 7 — Periphery

- [__tests__/prefDefaults.test.js:6](../../__tests__/prefDefaults.test.js:6), [:30](../../__tests__/prefDefaults.test.js:30), [:43](../../__tests__/prefDefaults.test.js:43) — the three describes pinning the rule, the corrupt-value path, and the range repair.
- [../plan-settings-order-and-defaults-on.md](../plan-settings-order-and-defaults-on.md) — the build plan, including its review triage log.
- [../deferred-work.md](../deferred-work.md) — the two items this review pushed out: one throwing preference read stranding the rest of its pass, and the unrun Codacy analysis pass.
