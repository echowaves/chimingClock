import { booleanPref, rangePref } from '../prefDefaults'

// Each describe is named after a row of the plan's I/O & Edge-Case Matrix, so the
// audit can see at a glance which rows have a test and which stay device-only.

describe('fresh install / stored Off (the on-by-default rule)', () => {
  it('reads On when nothing is stored', () => {
    expect(booleanPref(null)).toBe(true)
    expect(booleanPref(undefined)).toBe(true)
    expect(booleanPref('')).toBe(true)
  })

  it('reads Off for an explicitly stored false', () => {
    expect(booleanPref('false')).toBe(false)
    expect(booleanPref(false)).toBe(false)
  })

  it('reads On for an explicitly stored true', () => {
    expect(booleanPref('true')).toBe(true)
    expect(booleanPref(true)).toBe(true)
  })

  it('is Off only for `false` and nothing else', () => {
    // The whole rule in one line: the single value that turns an option off.
    const raw = [null, undefined, '', 'true', 'yes please', '0', 'null', '{}']
    expect(raw.filter(booleanPref).length).toBe(raw.length)
  })
})

describe('corrupt value (never throws into state)', () => {
  it('treats unparseable garbage as not stored, i.e. On', () => {
    expect(booleanPref('yes please')).toBe(true)
    expect(booleanPref('{')).toBe(true)
  })

  it('treats a value this version does not recognise as On', () => {
    expect(booleanPref('"off"')).toBe(true)
    expect(booleanPref('0')).toBe(true)
    expect(booleanPref('null')).toBe(true)
  })
})

describe('chime range default (nothing stored, or stored unusable)', () => {
  // Pinned literally: a full day is what "no stored range" means, and it is also the
  // repair for anything unusable, so both ends of that have to stay true.
  const FULL_DAY = { min: 0, max: 24 }

  it('chimes every quarter-hour when nothing is stored', () => {
    expect(rangePref(null)).toEqual(FULL_DAY)
    expect(rangePref(undefined)).toEqual(FULL_DAY)
    expect(rangePref('')).toEqual(FULL_DAY)
  })

  it('keeps a well-formed stored range, including a silent day', () => {
    expect(rangePref('{"min":7,"max":22}')).toEqual({ min: 7, max: 22 })
    expect(rangePref('{"min":0,"max":0}')).toEqual({ min: 0, max: 0 })
  })

  it('repairs a range the slider cannot draw instead of trusting it', () => {
    const unusable = [
      '{}',
      '{"min":7}',
      '{"min":-1,"max":24}',
      '{"min":30,"max":40}',
      '{"min":"8","max":9}',
      '{"min":18,"max":6}',
      '[]',
      '"all day"',
      'yes please',
    ]

    unusable.forEach((raw) => expect(rangePref(raw)).toEqual(FULL_DAY))
  })

  it('never throws, whatever the store handed back', () => {
    expect(() => rangePref('{"min":')).not.toThrow()
  })
})
