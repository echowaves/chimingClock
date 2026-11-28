# Review log: walkthrough-settings-order-and-defaults

Target: commit 9c39e092a35c8fcd39f6a3fb463f3aeeffc260c0 (branch main, repo echowaves/chimingClock) — "feat: lead settings with the clock button and default toggles on"

## 1 — orientation — review opened, narrative created

Session: 69dfdb27-7459-4fbf-bde9-e11327632dd2 · Timestamp: 2026-11-27T19:24:30-0500

- Action: Target chosen by user from this session's two commits. Intent taken from the plan's frozen `## Intent` (no ticket tree in this repo). Narrative written with 7 blocks: intent, broad strokes, on-by-default rule, consumers honoring it, screen order, chime-range repair, periphery.
- Result: No findings raised yet. Block 1 current; nothing accepted. Build-side context a reviewer may want: `npm test` 87 passed / 4 suites and eslint + prettier clean at commit time; pre-commit quick-lens review gave 0 high / 0 medium / 4 low / 3 false, two lows patched, one rejected (needs a React Native jest env this repo deliberately lacks), two deferred.
- Evidence: `_bmad-output/plan-settings-order-and-defaults-on.md` (frontmatter `status: built`, `review: quick`, `lenses_ran: [quick]`); commit 9c39e09 touches App.js, prefDefaults.js, __tests__/prefDefaults.test.js, the plan, deferred-work.md.
- Open: Device checks never run in this environment — fresh-install defaults, toggle-off → force-quit → relaunch, chime-range restore. Deferred items recorded in `_bmad-output/deferred-work.md`.

## 2 — Block 1 (intent) — move: Thoughts

Session: 69dfdb27-7459-4fbf-bde9-e11327632dd2 · Timestamp: 2026-11-27T19:33:10-0500

- Action: Read the shipped code against each intent claim and each success criterion. No formal review skill used; direct reading of App.js, prefDefaults.js plus key/read/write enumeration.
- Findings raised (none accepted yet):
  1. Intent under-documents scope — `Ticking sound` also got defaults-on (`prefDefaults.js:14` at App.js:705, pill App.js:1151); user instruction named only seconds + separator. Narrative Blocks 1/3/5 wording should own the third toggle.
  2. Success criterion 4 over-claims. `rangePref` repairs the chime range (App.js:692) and `booleanPref` absorbs corrupt booleans, but the font reads share one try block (App.js:715–750): garbage in `digitFonts` throws at App.js:722 and skips `dailyFontPick`, `showSeconds`, `pulseSeparator`. They land on defaults, the null guards (919–938) refuse to write, so the corrupt value is never repaired. Matches deferred-work entry 1; recommend narrowing the criterion wording.
  3. Criterion 2 holds by construction: exactly six keys, each read once (692/702/722/731/746/749) and written by one guarded effect (909/919/923/927/932/938); no renderer uses a source other than the stored value, so a default can never be written over a stored one.
  4. Criterion 1 is only observable after a tap: pulse animation is also gated on `!firstScreen` (App.js:853) and the app opens on settings (`firstScreen` starts true, App.js:371). Wording for the device check should say "after tapping Show the clock".
  5. Low/cosmetic: `CHIMING_TIME_RANGE` is declared inside the component (App.js:405) while every other key is module-scope.
- Result: Block 1 still current; user has not marked it done. No narrative edits yet (block shape accepted).

## 3 — Block 1 (intent) — findings 1, 2, 3 accepted; narrative revised

Session: 69dfdb27-7459-4fbf-bde9-e11327632dd2 · Timestamp: 2026-11-27T19:38:40-0500

- Action: User accepted findings 1–3. Narrative Block 1 rewritten: added a "Scope actually shipped" paragraph owning the third toggle (`Ticking sound`), replaced prose with four numbered success criteria, and narrowed criterion 4 to "a corrupt value lands on its default" — self-repair is claimed only for the chime range. Criterion 1 now names the `firstScreen` gate so the device check taps `Show the clock` first.
- Related narrative edits (same wording inherited from Block 1):
  - Block 3 gained "Where the protection stops": the parse is wrapped, the read is not; garbage in `digitFonts` (App.js:722) strands `dailyFontPick`, `showSeconds`, `pulseSeparator` in the same try and is never repaired. Marked deferred, not fixed.
  - Block 4 gained the ticking-sound consumer (App.js:890), the `firstScreen` caveat on the pulse effect, and corrected pill range refs to App.js:1136-1155 (three pills, unloaded-tap turns Off).
  - Block 5 pill-row refs corrected to App.js:1116-1131; chime title 1186 → 1185. Verified slider bounds ref App.js:1218 is correct (`min`/`max` from `CHIME_RANGE_DEFAULT`).
- Result: Findings 1, 2, 3 accepted and reflected in the narrative. Finding 4 (component-scope key const at App.js:405) left as a note, not acted on. Block 1 still current pending the user's "done".

## 4 — Block 1 closed, Block 2 opened

Session: 69dfdb27-7459-4fbf-bde9-e11327632dd2 · Timestamp: 2026-11-27T19:40:30-0500

- Action: User marked Block 1 done. Narrative updated: Block 1 checked with a note that scope and criteria were corrected to match what shipped; Block 2 made current. No further narrative revisions needed — the inherited wording in Blocks 3–5 was already corrected in entry 3.
- Tree state: dirty with review artifacts only — untracked `_bmad-output/walkthrough-settings-order-and-defaults/` (narrative + log). Target commit untouched. User asked whether to commit these.
- Findings carried out of Block 1: finding 4 (component-scope `CHIMING_TIME_RANGE` const, App.js:405) noted and not acted on; the stranding-read item remains deferred in `_bmad-output/deferred-work.md`.
