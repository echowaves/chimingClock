// The clock's drift geometry: how far each axis may travel and where a tick puts it.
// Kept free of React, React Native and any timer so the wall maths can be tested on
// their own (see __tests__). App.js decides what the motion box and the drawn extent
// are; this module only answers what a step means once those are known, so the bounce
// and the placement that draws it cannot disagree.

// How far the clock moves per tick (one tick per second). A third of a dp keeps the
// drift below the threshold where the eye tracks it as movement — the digits read as
// resting in place while the composition slowly rearranges itself. The direction is a
// unit vector, so this one number is the whole speed on both axes: a leg that leaves a
// wall at a shallow angle covers the same ground per second, only spread differently.
export const DRIFT_STEP = 1 / 3

// The smallest angle a leg may make with either axis, in degrees. At exactly 0° the
// perpendicular component would be zero and that axis would stop moving for good, so
// every leg is drawn inside [MIN_ANGLE_DEG, 90 - MIN_ANGLE_DEG] instead. 3° still
// allows a graze that runs almost parallel to an edge — the accepted cost: such a leg
// can take tens of minutes to reach the next wall on that axis, and its off-wall axis
// carries only ~5% of the speed (still nonzero, so motion never stalls).
export const MIN_ANGLE_DEG = 3

// A reflection loop bound. With a near-zero range a leg can in principle bounce
// several times inside one tick; three is plenty for a real window, and it is what
// stops a degenerate axis from spinning forever.
const MAX_BOUNCES_PER_TICK = 3

// Distances at or below this count as already landed, so the loop cannot spend its
// whole budget on a bounce that goes nowhere, and two walls reached in the same
// instant are recognised as the corner they are.
const LAND_EPS = 1e-9

const finiteOr = (value, fallback) =>
  Number.isFinite(value) ? value : fallback

const clampToWall = (value, range) => Math.max(-range, Math.min(range, value))

// Which way an axis points once a bounce is over: turned around if that axis touched a
// wall, and carrying on as before if it did not.
const leaveSign = (landedOnWall, current) => {
  if (landedOnWall) return current > 0 ? -1 : 1
  return current >= 0 ? 1 : -1
}

// A fresh leg: `roll` of [0,1) maps onto the allowed band, placed in the quadrant
// handed in. The randomness is injected rather than read from Math.random here, so
// both determinism and randomness are provable from a test. An unusable draw returns
// null and leaves the caller on the angle it already had.
const drawAngle = (rand, sx, sy) => {
  if (typeof rand !== 'function') return null
  const roll = rand()
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null
  const theta =
    ((MIN_ANGLE_DEG + roll * (90 - 2 * MIN_ANGLE_DEG)) * Math.PI) / 180
  return { ux: sx * Math.cos(theta), uy: sy * Math.sin(theta) }
}

// Half the free space on each axis, less the ink slack: how far from centre a shift
// may sit before it is at its wall. `extent` is what actually gets drawn — App.js
// hands in the larger of the nominal metrics box and the row's own reported layout
// box — so a wall is never set from a box smaller than what is on screen. An axis with
// no free space gets range 0 rather than a negative wall, which would leave every
// position outside it.
export function motionRanges(box, extent, inkSlack) {
  const slack = Math.max(0, finiteOr(inkSlack, 0))
  return {
    x: Math.max(
      0,
      (finiteOr(box?.width, 0) - finiteOr(extent?.width, 0)) / 2 - slack,
    ),
    y: Math.max(
      0,
      (finiteOr(box?.height, 0) - finiteOr(extent?.height, 0)) / 2 - slack,
    ),
  }
}

// One tick of travel. `motion` is `{ x, y, ux, uy }` — a position and a *unit*
// direction — and `walls` is what motionRanges returned for the current box, extent
// and slack. The whole path length of a tick is DRIFT_STEP: a leg that reaches a wall
// lands on it exactly and travels what is left of the tick along the freshly drawn
// angle, so a position is never merely near a wall and nothing but ink has to be
// reserved at the edge.
export function advanceMotion(motion, walls, rand) {
  const rangeX = Math.max(0, finiteOr(walls?.x, 0))
  const rangeY = Math.max(0, finiteOr(walls?.y, 0))

  // A wall that shrank mid-flight — a font swap or a longer time string — is dealt
  // with before anything is stepped, so the shift this tick draws is already inside
  // it. The pull is inward only and stops at the wall, so it cannot throw the clock
  // across the screen the way clamping-then-reversing used to.
  let x = clampToWall(finiteOr(motion?.x, 0), rangeX)
  let y = clampToWall(finiteOr(motion?.y, 0), rangeY)

  // A direction that is absent, non-finite or zero-length is repaired rather than
  // propagated: one NaN would poison every later tick.
  let ux = finiteOr(motion?.ux, 0)
  let uy = finiteOr(motion?.uy, 0)
  const length = Math.hypot(ux, uy)
  if (length > LAND_EPS) {
    ux /= length
    uy /= length
  } else {
    ux = Math.SQRT1_2
    uy = Math.SQRT1_2
  }

  let remaining = DRIFT_STEP
  for (let bounce = 0; bounce < MAX_BOUNCES_PER_TICK; bounce += 1) {
    if (remaining <= LAND_EPS) break

    // An axis with no range at all is pinned at its centre: it can neither travel nor
    // register a hit, so its component of the direction is dropped and only the other
    // axis's own component carries the tick. That is less than DRIFT_STEP overall — by
    // cos or sin of the leg's angle — so a leg grazing the band edge (see
    // MIN_ANGLE_DEG) moves its free axis by as little as ~5% of the speed. Still
    // nonzero, which is what keeps a one-axis window from ever looking frozen.
    const stepX = rangeX > 0 ? ux * remaining : 0
    const stepY = rangeY > 0 ? uy * remaining : 0
    const targetX = x + stepX
    const targetY = y + stepY

    const hitX = rangeX > 0 && Math.abs(targetX) > rangeX
    const hitY = rangeY > 0 && Math.abs(targetY) > rangeY
    if (!hitX && !hitY) {
      x = targetX
      y = targetY
      remaining = 0
      break
    }

    // Land on whichever wall comes first, exactly. `(wall - pos) / dir` is the part of
    // this leg spent getting there; it is always >= 0, because an axis only registers a
    // hit when it is travelling at that wall.
    const timeX = hitX ? ((ux > 0 ? rangeX : -rangeX) - x) / ux : Infinity
    const timeY = hitY ? ((uy > 0 ? rangeY : -rangeY) - y) / uy : Infinity
    const time = Math.min(timeX, timeY, remaining)
    x += ux * time
    y += uy * time
    remaining -= time

    // A corner is both walls at the same instant, and gets one new angle, not two.
    const landedX = hitX && Math.abs(timeX - time) <= LAND_EPS
    const landedY = hitY && Math.abs(timeY - time) <= LAND_EPS

    // Away from every wall this bounce touched; anywhere else keep going as before.
    const sx = leaveSign(landedX, ux)
    const sy = leaveSign(landedY, uy)
    const angle = drawAngle(rand, sx, sy)
    if (angle) {
      ;({ ux, uy } = angle)
    } else {
      // Bad randomness: stay on the previous angle rather than invent one, but still
      // turn away from the wall, or the next tick would hit it again forever.
      ux = sx * Math.abs(ux)
      uy = sy * Math.abs(uy)
    }
  }

  // Belt and braces: whatever the loop did, a shift is never stored past its wall.
  return { x: clampToWall(x, rangeX), y: clampToWall(y, rangeY), ux, uy }
}
