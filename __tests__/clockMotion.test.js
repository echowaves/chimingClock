import {
  DRIFT_STEP,
  MIN_ANGLE_DEG,
  advanceMotion,
  motionRanges,
} from '../clockMotion'

// Each describe is named after a row of the plan's I/O & Edge-Case Matrix, so the
// audit can see at a glance which rows have a test and which stay device-only. The
// randomness is always injected: a stubbed `rand` makes both determinism and
// randomness provable rather than something you have to squint at on a phone.

const DEG = Math.PI / 180
// A dp-scale tolerance: far below anything visible on a screen, well above float noise.
const EPS = 1e-9
// The angle a direction actually makes with the x axis, folded into [0, 90] so the
// quadrant it happens to sit in does not change the answer.
const angleFromAxes = ({ ux, uy }) =>
  Math.atan2(Math.abs(uy), Math.abs(ux)) / DEG
// A spread of rolls including both ends of [0,1) — the band's edges are where a leg
// comes closest to axis-aligned, which is exactly what MIN_ANGLE_DEG exists to prevent.
const rolls = Array.from({ length: 101 }, (_, i) => i / 102).concat(
  1 - Number.EPSILON,
)

const insideWalls = (state, walls) => {
  expect(Math.abs(state.x)).toBeLessThanOrEqual(walls.x + EPS)
  expect(Math.abs(state.y)).toBeLessThanOrEqual(walls.y + EPS)
}

describe('Mid-air step', () => {
  const walls = { x: 100, y: 100 }
  const motion = { x: 0, y: 0, ux: 0.6, uy: 0.8 }

  it('advances exactly DRIFT_STEP with nothing nearby', () => {
    const next = advanceMotion(motion, walls, () => 0.5)

    expect(next.x).toBeCloseTo(motion.ux * DRIFT_STEP, 12)
    expect(next.y).toBeCloseTo(motion.uy * DRIFT_STEP, 12)
    expect(Math.hypot(next.x - motion.x, next.y - motion.y)).toBeCloseTo(
      DRIFT_STEP,
      12,
    )
  })

  it('leaves the direction alone and draws no new angle', () => {
    const rand = jest.fn(() => 0.5)
    const next = advanceMotion(motion, walls, rand)

    expect(rand).not.toHaveBeenCalled()
    expect(next.ux).toBeCloseTo(motion.ux, 12)
    expect(next.uy).toBeCloseTo(motion.uy, 12)
  })

  // Checked after every tick rather than at the end: a wall that holds on average is
  // not a wall.
  it('keeps every coordinate inside its wall across a long run', () => {
    Array.from({ length: 5000 }, (_, i) => (i * 0.37) % 1).reduce(
      (state, roll) => {
        const next = advanceMotion(state, walls, () => roll)

        insideWalls(next, walls)
        return next
      },
      motion,
    )
  })

  it('moves no more than one step per tick while the walls hold', () => {
    const start = { x: -7.5, y: 3.25, ux: -0.8, uy: -0.6 }
    const next = advanceMotion(start, walls, () => 0.5)

    expect(Math.hypot(next.x - start.x, next.y - start.y)).toBeLessThanOrEqual(
      DRIFT_STEP + EPS,
    )
  })
})

describe('Single wall hit', () => {
  const walls = { x: 1, y: 100 }
  const motion = { x: 0.95, y: 0, ux: 0.6, uy: 0.8 }
  // Where this leg meets the wall, and what is left of the tick afterwards.
  const timeToWall = (walls.x - motion.x) / motion.ux
  const leftover = DRIFT_STEP - timeToWall

  it('lands on the wall and carries the overshoot along the new angle', () => {
    // A roll of 0 puts the new leg at exactly MIN_ANGLE_DEG off the x axis.
    const next = advanceMotion(motion, walls, () => 0)
    const ux = -Math.cos(MIN_ANGLE_DEG * DEG)
    const uy = Math.sin(MIN_ANGLE_DEG * DEG)

    expect(next.x).toBeCloseTo(walls.x + ux * leftover, 12)
    expect(next.y).toBeCloseTo(motion.uy * timeToWall + uy * leftover, 12)
  })

  it('never leaves the coordinate past the wall it just hit', () => {
    const next = advanceMotion(motion, walls, () => 0.5)

    expect(Math.abs(next.x)).toBeLessThanOrEqual(walls.x)
    expect(next.x).toBeLessThan(walls.x)
  })

  it('leaves at a new angle inside the allowed band', () => {
    const next = advanceMotion(motion, walls, () => 0.5)

    expect(angleFromAxes(next)).toBeGreaterThanOrEqual(MIN_ANGLE_DEG - EPS)
    expect(angleFromAxes(next)).toBeLessThanOrEqual(90 - MIN_ANGLE_DEG + EPS)
  })

  it('points away from the wall it hit and keeps the other axis going', () => {
    const next = advanceMotion(motion, walls, () => 0.5)

    expect(next.ux).toBeLessThan(0)
    expect(next.uy).toBeGreaterThan(0)
  })

  it('keeps the speed at DRIFT_STEP: a unit direction and one step of path', () => {
    const next = advanceMotion(motion, walls, () => 0.5)

    expect(Math.hypot(next.ux, next.uy)).toBeCloseTo(1, 12)
    expect(
      Math.hypot(next.x - motion.x, next.y - motion.y),
    ).toBeLessThanOrEqual(DRIFT_STEP + EPS)
  })

  it('draws exactly one angle for the bounce', () => {
    const rand = jest.fn(() => 0.5)
    advanceMotion(motion, walls, rand)

    expect(rand).toHaveBeenCalledTimes(1)
  })

  it('reflects the negative wall too', () => {
    const next = advanceMotion(
      { x: -0.95, y: 0, ux: -0.6, uy: 0.8 },
      walls,
      () => 0.25,
    )

    expect(next.ux).toBeGreaterThan(0)
    expect(Math.abs(next.x)).toBeLessThanOrEqual(walls.x)
  })

  it('handles a tick that starts on the wall and heads straight into it', () => {
    // A previous tick can end exactly on a wall, so this state really occurs. The zero
    // landing distance must not eat the bounce budget or leave the clock outside.
    const start = { x: walls.x, y: 0, ux: 0.6, uy: 0.8 }
    const rand = jest.fn(() => 0.5)
    const next = advanceMotion(start, walls, rand)

    expect(rand).toHaveBeenCalledTimes(1)
    expect(next.ux).toBeLessThan(0)
    insideWalls(next, walls)
    expect(Math.hypot(next.x - start.x, next.y - start.y)).toBeLessThanOrEqual(
      DRIFT_STEP + EPS,
    )
  })
})

describe('Corner hit', () => {
  const walls = { x: 0.2, y: 0.2 }
  // Symmetric on purpose: the two axes then reach their walls in the same instant,
  // which is what makes this a corner rather than two bounces.
  const motion = { x: 0.1, y: 0.1, ux: 0.8, uy: 0.8 }

  it('reflects both components and stays inside both walls', () => {
    const next = advanceMotion(motion, walls, () => 0.5)

    expect(next.ux).toBeLessThan(0)
    expect(next.uy).toBeLessThan(0)
    expect(Math.abs(next.x)).toBeLessThanOrEqual(walls.x)
    expect(Math.abs(next.y)).toBeLessThanOrEqual(walls.y)
  })

  it('draws only one new angle', () => {
    const rand = jest.fn(() => 0.5)
    advanceMotion(motion, walls, rand)

    expect(rand).toHaveBeenCalledTimes(1)
  })

  it('lands inside both walls rather than on one and past the other', () => {
    rolls.reduce((state, roll) => {
      const next = advanceMotion(state, walls, () => roll)

      insideWalls(next, walls)
      expect(Number.isFinite(next.x)).toBe(true)
      expect(Number.isFinite(next.y)).toBe(true)
      expect(Number.isFinite(next.ux)).toBe(true)
      expect(Number.isFinite(next.uy)).toBe(true)
      return next
    }, motion)
  })

  it('bounds the reflection loop so a near-zero range cannot spin', () => {
    // A range far smaller than one step: this leg could in principle cross the box many
    // times in a tick, so the loop has to stop at its bound and leave the position
    // inside the walls rather than running on.
    const tight = { x: 0.01, y: 0.01 }
    const rand = jest.fn(() => 0.5)
    const next = advanceMotion(
      { x: 0, y: 0, ux: 0.999, uy: 0.001 },
      tight,
      rand,
    )

    expect(rand).toHaveBeenCalledTimes(3)
    insideWalls(next, tight)
    expect(Number.isFinite(next.x)).toBe(true)
    expect(Number.isFinite(next.y)).toBe(true)
  })
})

describe('Degenerate axis', () => {
  const walls = { x: 0, y: 5 }

  it('pins an axis whose range is zero at 0', () => {
    const next = advanceMotion(
      { x: 4, y: 0, ux: 0.6, uy: 0.8 },
      walls,
      () => 0.5,
    )

    expect(next.x).toBe(0)
  })

  it('keeps the other axis moving so motion never stalls', () => {
    const steps = Array.from({ length: 20 }).reduce(
      ({ state, travelled }, _slot, i) => {
        const next = advanceMotion(state, walls, () => (i % 7) / 8)

        return {
          state: next,
          travelled: travelled.concat(Math.abs(next.y - state.y)),
        }
      },
      { state: { x: 9, y: -1, ux: 0.6, uy: 0.8 }, travelled: [] },
    )

    expect(steps.travelled.every((d) => d > 0)).toBe(true)
    // The moving axis carries at least the band's shallowest share of the speed.
    expect(Math.max(...steps.travelled)).toBeGreaterThanOrEqual(
      DRIFT_STEP * Math.sin(MIN_ANGLE_DEG * DEG),
    )
  })

  it('never returns NaN when both axes are degenerate', () => {
    const next = advanceMotion(
      { x: 12, y: -7, ux: 0.6, uy: 0.8 },
      { x: 0, y: 0 },
      () => 0.5,
    )

    expect(next.x).toBe(0)
    expect(next.y).toBe(0)
    expect(Number.isFinite(next.ux)).toBe(true)
    expect(Number.isFinite(next.uy)).toBe(true)
  })

  it('repairs a zero-length or non-finite direction instead of propagating it', () => {
    const broken = [
      { ux: 0, uy: 0 },
      { ux: NaN, uy: 1 },
      { ux: Infinity, uy: -Infinity },
      {},
    ]

    broken.forEach((bad) => {
      const next = advanceMotion(
        { x: 1, y: 1, ...bad },
        { x: 10, y: 10 },
        () => 0.5,
      )

      expect(Number.isFinite(next.x)).toBe(true)
      expect(Number.isFinite(next.y)).toBe(true)
      expect(Math.hypot(next.ux, next.uy)).toBeCloseTo(1, 9)
    })
  })
})

describe('Wall shrinks mid-flight', () => {
  const walls = { x: 10, y: 10 }

  it('clamps a stale shift to the new wall the same tick', () => {
    const next = advanceMotion(
      { x: 40, y: 0, ux: -0.6, uy: 0.8 },
      walls,
      () => 0.5,
    )

    expect(Math.abs(next.x)).toBeLessThanOrEqual(walls.x)
  })

  it('clamps from either side', () => {
    const next = advanceMotion(
      { x: -40, y: -30, ux: 0.6, uy: -0.8 },
      walls,
      () => 0.5,
    )

    expect(next.x).toBeGreaterThanOrEqual(-walls.x)
    expect(next.y).toBeLessThanOrEqual(walls.y)
  })

  it('pulls inward and never teleports to the opposite wall', () => {
    const next = advanceMotion(
      { x: 40, y: 0, ux: 0.6, uy: 0.8 },
      walls,
      () => 0.5,
    )

    expect(next.x).toBeGreaterThan(0)
  })

  it('steps at most one DRIFT_STEP beyond the inward correction', () => {
    // The clamp is a correction to the wall, not travel; what the tick adds beyond it is
    // still exactly one step's worth of path.
    const pulledIn = { x: walls.x, y: walls.y }
    const next = advanceMotion(
      { x: 40, y: 30, ux: 0.6, uy: 0.8 },
      walls,
      () => 0.5,
    )

    expect(
      Math.hypot(next.x - pulledIn.x, next.y - pulledIn.y),
    ).toBeLessThanOrEqual(DRIFT_STEP + EPS)
  })

  it('keeps drawing inside a wall that shrinks repeatedly', () => {
    Array.from({ length: 200 }, (_, i) => 30 - i * 0.1).reduce(
      (state, range) => {
        const next = advanceMotion(state, { x: range, y: range }, () => 0.4)

        insideWalls(next, { x: range, y: range })
        return next
      },
      { x: 0, y: 0, ux: 0.6, uy: 0.8 },
    )
  })
})

describe('Bad randomness', () => {
  const walls = { x: 1, y: 100 }
  const motion = { x: 0.95, y: 0, ux: 0.6, uy: 0.8 }

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['undefined', undefined],
    ['1', 1],
    ['above 1', 1.5],
    ['below 0', -0.1],
    ['a string', '0.5'],
  ])('keeps the previous angle when rand hands %s', (_label, roll) => {
    const next = advanceMotion(motion, walls, () => roll)

    expect(Number.isFinite(next.x)).toBe(true)
    expect(Number.isFinite(next.y)).toBe(true)
    expect(Math.abs(next.ux)).toBeCloseTo(0.6, 12)
    expect(Math.abs(next.uy)).toBeCloseTo(0.8, 12)
  })

  it('still turns away from the wall it hit', () => {
    const next = advanceMotion(motion, walls, () => NaN)

    expect(next.ux).toBeCloseTo(-0.6, 12)
    expect(next.x).toBeLessThan(walls.x)
  })

  it('tolerates a missing rand entirely', () => {
    const next = advanceMotion(motion, walls)

    expect(Number.isFinite(next.x)).toBe(true)
    expect(Math.abs(next.ux)).toBeCloseTo(0.6, 12)
  })
})

describe('Injected randomness', () => {
  const walls = { x: 1, y: 1 }
  const motion = { x: 0.95, y: 0.9, ux: 0.6, uy: 0.8 }

  it('is deterministic for the same stub', () => {
    expect(advanceMotion(motion, walls, () => 0.42)).toEqual(
      advanceMotion(motion, walls, () => 0.42),
    )
  })

  it('gives a different slope for different stubs', () => {
    const first = advanceMotion(motion, walls, () => 0.1)
    const second = advanceMotion(motion, walls, () => 0.9)

    expect(first.uy / first.ux).not.toBeCloseTo(second.uy / second.ux, 6)
  })

  it('covers the whole allowed band across many draws', () => {
    const angles = rolls.map((roll) =>
      angleFromAxes(advanceMotion(motion, walls, () => roll)),
    )

    angles.forEach((angle) => {
      expect(angle).toBeGreaterThanOrEqual(MIN_ANGLE_DEG - EPS)
      expect(angle).toBeLessThanOrEqual(90 - MIN_ANGLE_DEG + EPS)
    })
    expect(Math.min(...angles)).toBeCloseTo(MIN_ANGLE_DEG, 6)
    expect(Math.max(...angles)).toBeCloseTo(90 - MIN_ANGLE_DEG, 6)
  })
})

describe('motionRanges', () => {
  it('puts each wall at half the free space less the ink slack', () => {
    expect(
      motionRanges({ width: 400, height: 800 }, { width: 300, height: 200 }, 1),
    ).toEqual({ x: 49, y: 299 })
  })

  it('never returns a negative wall when the extent fills the box', () => {
    expect(
      motionRanges({ width: 300, height: 200 }, { width: 320, height: 260 }, 4),
    ).toEqual({ x: 0, y: 0 })
  })

  it('shrinks a wall when the drawn extent is larger than the nominal box', () => {
    const nominal = motionRanges(
      { width: 400, height: 800 },
      { width: 300, height: 200 },
      1,
    )
    const tighter = motionRanges(
      { width: 400, height: 800 },
      { width: 310, height: 205 },
      1,
    )

    expect(tighter.x).toBeLessThan(nominal.x)
    expect(tighter.y).toBeLessThan(nominal.y)
  })

  it('treats a non-finite slack or box as no room rather than NaN', () => {
    const bad = [undefined, NaN, -5]

    bad.forEach((slack) => {
      const walls = motionRanges(
        { width: 400, height: 800 },
        { width: 300, height: 200 },
        slack,
      )

      expect(Number.isFinite(walls.x)).toBe(true)
      expect(Number.isFinite(walls.y)).toBe(true)
      expect(walls.x).toBeGreaterThanOrEqual(0)
    })
  })
})
