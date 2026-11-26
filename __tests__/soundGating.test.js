import { isHourInActiveRange, isTickingAudible } from '../soundGating'

// Each describe is named after a row of the plan's I/O & Edge-Case Matrix, so the
// audit can see at a glance which rows have a test and which stay device-only.

describe('active range rule (shared by bells and ticking)', () => {
  it('treats the lower bound as inclusive', () => {
    expect(isHourInActiveRange(8, { min: 8, max: 12 })).toBe(true)
  })

  it('treats the upper bound as exclusive', () => {
    expect(isHourInActiveRange(11, { min: 8, max: 12 })).toBe(true)
    expect(isHourInActiveRange(12, { min: 8, max: 12 })).toBe(false)
  })

  it('is silent outside the range on both sides', () => {
    expect(isHourInActiveRange(7, { min: 8, max: 12 })).toBe(false)
    expect(isHourInActiveRange(13, { min: 8, max: 12 })).toBe(false)
  })

  it('is silent while no range has been loaded yet', () => {
    expect(isHourInActiveRange(12, null)).toBe(false)
    expect(isHourInActiveRange(12, undefined)).toBe(false)
  })

  it('covers every hour of a whole-day range', () => {
    expect(isHourInActiveRange(0, { min: 0, max: 24 })).toBe(true)
    expect(isHourInActiveRange(23, { min: 0, max: 24 })).toBe(true)
    expect(isHourInActiveRange(24, { min: 0, max: 24 })).toBe(false)
  })

  it('behaves exactly like the comparison it replaced for odd stored bounds', () => {
    // Not an endorsement of these values — a promise that extraction changed nothing.
    expect(isHourInActiveRange(12, { min: null, max: 24 })).toBe(
      12 >= null && 12 < 24,
    )
    expect(isHourInActiveRange(12, { min: 'abc', max: 24 })).toBe(false)
  })
})

describe('Fresh install — no stored preference', () => {
  it('has the ticking on inside the range', () => {
    expect(
      isTickingAudible({
        enabled: undefined,
        hour: 9,
        range: { min: 8, max: 12 },
      }),
    ).toBe(true)
  })
})

describe('Upgrade from older build — key absent means on', () => {
  it('treats an unloaded preference as on rather than off', () => {
    expect(
      isTickingAudible({ enabled: null, hour: 9, range: { min: 0, max: 24 } }),
    ).toBe(true)
  })
})

describe('Off, hour enters active range', () => {
  it('stays silent however wide the window is', () => {
    expect(
      isTickingAudible({ enabled: false, hour: 9, range: { min: 0, max: 24 } }),
    ).toBe(false)
  })

  it('stays silent at the moment the window opens', () => {
    expect(
      isTickingAudible({ enabled: false, hour: 8, range: { min: 8, max: 12 } }),
    ).toBe(false)
  })
})

describe('On, hour crosses into range while app is open', () => {
  it('becomes audible as soon as the hour is inside', () => {
    expect(
      isTickingAudible({ enabled: true, hour: 7, range: { min: 8, max: 12 } }),
    ).toBe(false)
    expect(
      isTickingAudible({ enabled: true, hour: 8, range: { min: 8, max: 12 } }),
    ).toBe(true)
  })

  it('goes quiet again the moment the window closes', () => {
    expect(
      isTickingAudible({ enabled: true, hour: 12, range: { min: 8, max: 12 } }),
    ).toBe(false)
  })
})

describe('Stored value unreadable', () => {
  it('falls back to on, the behaviour a clock that always ticked should keep', () => {
    expect(
      isTickingAudible({ enabled: null, hour: 10, range: { min: 0, max: 24 } }),
    ).toBe(true)
  })

  it('still respects the window while unloaded', () => {
    expect(
      isTickingAudible({ enabled: null, hour: 3, range: { min: 8, max: 12 } }),
    ).toBe(false)
  })
})
