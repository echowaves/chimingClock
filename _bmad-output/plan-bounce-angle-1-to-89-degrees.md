---
title: 'Keep every bounce leg strictly between 1° and 89°'
type: 'feature'
ticket: ''
created: '2026-11-27'
status: 'built'
baseline_revision: '0214c76a7158ca2457247bfba77d69a176783465'
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

**Problem:** Every new leg the clock draws after a bounce is placed inside `[MIN_ANGLE_DEG, 90 - MIN_ANGLE_DEG]` = `[3°, 87°]`. The human wants the legs allowed to run closer to parallel with an edge and closer to perpendicular than that: every bounce angle must always be **more than 1°** and **less than 89°**.

**Approach:** Widen the draw band in `clockMotion.js` to the open interval (1°, 89°) — strictly inside, so no leg can ever land exactly on 1° or 89° even when `rand()` hands back its extreme values — and keep every existing guarantee of `advanceMotion` intact. Update the two comments that state the old band's numbers and consequences, and the tests that assert against them.

</frozen-after-approval>

## Implementation Notes

Oneshot: ~25 lines across two files it already has passing coverage for — one constant pair and its draw formula in `clockMotion.js`, plus the assertions that reference the band in `__tests__/clockMotion.test.js`. No new symbols, no call-site change (`App.js` only imports `advanceMotion`/`motionRanges`), so a coding subagent would add nothing.

Decisions made during investigation:
- **Strictness is literal.** `roll ∈ [0,1)` currently maps onto the closed low end, so `rand() === 0` (reachable from `Math.random`) yields *exactly* `MIN_ANGLE_DEG`. To honour "more than 1 degree", the band is drawn as an open interval with a small inset; both ends are then provably unreachable.
- **Two constants, not one.** The band is no longer symmetric about 45° in name only — `90 - MIN` would give 89° by luck of arithmetic. Export `MIN_ANGLE_DEG = 1` and `MAX_ANGLE_DEG = 89` and draw with `(MAX - MIN)` as the span, so the upper bound is stated rather than derived.
- **Nothing else re-clamps an angle.** A new leg's angle comes only from `drawAngle`; `advanceMotion` normalises an incoming direction (angle-preserving) and its bad-`rand` fallback mirrors signs (also angle-preserving), and `App.js` seeds `{ ux: SQRT1_2, uy: SQRT1_2 }` = 45°. So widening the draw band alone makes the invariant hold for every leg; do **not** add band-clamping of incoming directions — it would silently rewrite a caller-supplied vector.
- **The old cost notes go stale at 1°.** At the shallow end the off-wall axis now carries `sin(1°) ≈ 1.7%` of `DRIFT_STEP` (was ~5%), and a grazing leg's next wall on that axis is correspondingly further off (~57× the perpendicular crossing time). Comments must say the new numbers, not the old ones — they are the only record of why a near-parallel leg is acceptable.
- **Keep** `MAX_BOUNCES_PER_TICK`, exact-wall landing, corner handling, inward-only shrink clamp, and the injected-`rand` design untouched; the degenerate-axis floor (`sin(MIN_ANGLE_DEG)` of the speed) stays true with the new constant and must not be special-cased.

Done during implementation:
- `clockMotion.js`: `MIN_ANGLE_DEG = 1`, new exported `MAX_ANGLE_DEG = 89`, module-private `BAND_INSET_DEG = 1e-6`, and `drawAngle` now maps `roll ∈ [0,1)` onto `(1°, 89°)`. The two comments quoting the old band's consequences now quote `sin 1° ≈ 1.7%` of the speed and hours rather than minutes.
- `__tests__/clockMotion.test.js`: band assertions switched from `>= MIN - EPS` / `<= 90 - MIN + EPS` to strict `> MIN_ANGLE_DEG` / `< MAX_ANGLE_DEG`; band coverage now checks the extremes land *just inside* the bounds. The roll-0 landing test dropped its hard-coded `-cos(MIN)/sin(MIN)` expectation — that exact-value check is off by the inset and fails at 12 decimals — and instead verifies the landing maths against the direction the tick actually left by, plus strict placement at the shallow end. One new case pins both ends of `Math.random`'s range (0, ε/2, 1−ε).
- `App.js` untouched, as planned: it never reads the band constants and its seed direction is 45°.
- `npx jest` → 76 passed. `npx eslint clockMotion.js App.js __tests__/clockMotion.test.js` → clean after one Prettier line-wrap autofix. The Codacy MCP analysis the repo's instruction file asks for could not run — no Codacy tool is exposed in this session (same gap already recorded in `deferred-work.md`).

Patched after review:
- Band comment now states the frame the code actually uses (degrees off the x axis) and explains that, because the bounds are complementary, that is also more than 1° and less than 89° off *each* axis.
- Inset comment's justification corrected: the hazard is `roll === 0` (and its mirror just below 1), not float noise. 1e-6° sits ~8 orders above this path's real ~1e-14° round-off, which is exactly why it must not be shrunk towards noise — an inset near round-off would make the strict `>` bounds unprovable.
- Tests now pin `1` and `89` literally as well as symbolically, and assert the leaving quadrant (`ux < 0`, `uy > 0`) at both roll extremes in a box generous enough to keep each draw a single bounce. Checked by mutation: setting `MIN_ANGLE_DEG = 5` fails `draws the band in the numbers the intent asks for`.
- Extreme-roll fixture uses the largest double `Math.random` can return, `1 - Number.EPSILON / 2`; `1 - Number.EPSILON` rounds to exactly 1 and was never a legal roll.
- Final state: `npm test` → 77 passed; eslint and Prettier clean on all touched files.

## Review Triage Log

Pass 1 — lens `quick`, 1 high / 1 medium / 4 low / 1 false / 0 maybe-false.

- **high → patch** `clockMotion.js:13-25`: header claimed the band is measured "from the nearer axis", but `drawAngle` measures one `theta` off the x axis (`ux = sx·cos θ`, `uy = sy·sin θ`) — the frame `angleFromAxes` reads back; read as written, `(1°, 89°)` would be impossible. Comment rewritten to name the x-axis frame and derive the per-axis guarantee from the complementary bounds. KEEP: the code was right — comment-only fix.
- **medium → patch** (with the low below) `__tests__/clockMotion.test.js`: every band assertion compared against the imported constants, so a revert of the band to e.g. `(5°, 85°)` kept jest green; reviewer verified arithmetically that the `1e-3` slack checks still pass under such a change. Added `draws the band in the numbers the intent asks for`, asserting `MIN_ANGLE_DEG === 1`, `MAX_ANGLE_DEG === 89` and shallow/steep draws inside `(1, 1.001)` / `(88.999, 89)`. Confirmed by mutation: `MIN_ANGLE_DEG = 5` fails that test.
- **low → patch** (same root cause as the medium above) `__tests__/clockMotion.test.js:87-99`: the roll-0 landing test builds its expected position from the result's own direction, so it can catch lost overshoot but not a wrong angle. Deliberate — the inset makes the old exact `-cos/sin` expectation fail at 12 decimals — and now compensated by the literal shallow-angle pin above.
- **low → patch** `__tests__/clockMotion.test.js:415-427`: fixture claimed `1 - Number.EPSILON` was a hair under 1; it rounds to exactly 1, so the true supremum went uncovered. Now `LARGEST_ROLL = 1 - Number.EPSILON / 2`, also used by the `rolls` spread.
- **false** `__tests__/clockMotion.test.js:415-427`: "no quadrant assertion at either extreme; a leg pointing back into the wall would score as in-band". Checked against `leaveSign` and `drawAngle`: the quadrant comes from `sx`/`sy`, set from the wall just touched, so a back-pointing leg is not reachable, and widening the band does not change that. Assertions added anyway (`ux < 0`, `uy > 0` at both extremes) since they cost nothing and would surface it if that ever stopped holding.
- **low → patch** `clockMotion.js:27-30`: inset comment justified itself against "float noise" it sits ~8 orders above; the guard is for `roll === 0`. Rewritten, including why shrinking towards round-off would make the strict bounds unprovable.
- **low → patch** `_bmad-output/plan-bounce-angle-1-to-89-degrees.md` was untracked while every earlier plan in this repo is tracked; the plan now ships in the same commit as the change.
- **defer** `.github/instructions/codacy.instructions.md` asks for a `codacy_cli_analyze` pass per edited file; no Codacy MCP tool is exposed in this session, and the same gap is already recorded at `_bmad-output/deferred-work.md` (from `plan-screen-rotation-all-devices.md`) — no duplicate entry added.

## Verification

**Commands:**
- `npx jest __tests__/clockMotion.test.js` -- expected: all suites pass, including a test that asserts every drawn angle is strictly `> MIN_ANGLE_DEG` and `< MAX_ANGLE_DEG` across rolls spanning `0 … 1 - Number.EPSILON`.
- `npm test` -- expected: full suite green (fontSelection, soundGating unaffected).
- `npx eslint clockMotion.js App.js __tests__/clockMotion.test.js` -- expected: no errors.

**Manual checks:**
- On device the clock still drifts at one third of a dp per second and bounces off each edge; nothing about speed or wall placement changes.
