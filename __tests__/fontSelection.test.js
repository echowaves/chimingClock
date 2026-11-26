import fs from 'fs'
import path from 'path'

import dayjs from 'dayjs'

import {
  drawDailyFont,
  isTodayPick,
  nextSelection,
  resolveSelectedFonts,
  rotationPool,
} from '../fontSelection'

// Each describe block names the row of the plan's I/O & Edge-Case Matrix it covers
// (../_bmad-output/plan-font-rotation-set-and-display-toggles.md). The font table
// itself lives in App.js and needs react-native to evaluate, so the shipped ids are
// read out of that source text rather than imported.

const TODAY = dayjs('2026-11-25T13:45:00')

const fontsSource = () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8')
  const start = src.indexOf('const FONTS = {')
  return src.slice(start, src.indexOf('\n}', start))
}

const SHIPPED = (fontsSource().match(/^\s{2}(\w+): \{/gm) || []).map((line) =>
  line.trim().replace(/: \{$/, ''),
)

describe('first launch, nothing stored', () => {
  it('selects every font the app ships when nothing is saved', () => {
    expect(
      resolveSelectedFonts({
        saved: null,
        legacyFontId: null,
        allIds: SHIPPED,
      }),
    ).toEqual(SHIPPED)
    expect(SHIPPED.length).toBeGreaterThan(1)
  })

  it('pools every offered face while the selection is still unset', () => {
    expect(rotationPool(null, SHIPPED)).toEqual(SHIPPED)
  })
})

describe('upgrade from a single stored font', () => {
  it('turns one saved face into a one-element set that never rotates', () => {
    const selected = resolveSelectedFonts({
      saved: null,
      legacyFontId: 'mono',
      allIds: SHIPPED,
    })
    expect(selected).toEqual(['mono'])
    expect(rotationPool(selected, SHIPPED)).toEqual(['mono'])
    expect(drawDailyFont(['mono'], 'serif')).toBe('mono')
  })

  it('prefers a valid saved set over the legacy single value', () => {
    expect(
      resolveSelectedFonts({
        saved: ['serif', 'marker'],
        legacyFontId: 'mono',
        allIds: SHIPPED,
      }),
    ).toEqual(['serif', 'marker'])
  })
})

describe('legacy "default" stored', () => {
  it('ships no default font any more', () => {
    expect(SHIPPED).not.toContain('default')
    expect(SHIPPED.length).toBeGreaterThan(5)
  })

  it('drops a stored default together with any other unknown id', () => {
    expect(
      resolveSelectedFonts({
        saved: null,
        legacyFontId: 'default',
        allIds: SHIPPED,
      }),
    ).toEqual(SHIPPED)
    expect(
      resolveSelectedFonts({
        saved: ['serif', 'default', 'bogus'],
        legacyFontId: null,
        allIds: SHIPPED,
      }),
    ).toEqual(['serif'])
  })

  it('treats a non-array stored value as nothing saved', () => {
    expect(
      resolveSelectedFonts({
        saved: 'mono',
        legacyFontId: null,
        allIds: SHIPPED,
      }),
    ).toEqual(SHIPPED)
    expect(rotationPool('serif', SHIPPED)).toEqual(SHIPPED)
  })
})

describe('last font tapped off', () => {
  it('keeps the only selected face selected', () => {
    expect(nextSelection(['marker'], 'marker')).toEqual(['marker'])
  })

  it('removes any other face and adds an unselected one in pool order', () => {
    expect(nextSelection(['serif', 'mono', 'script'], 'mono')).toEqual([
      'serif',
      'script',
    ])
    expect(nextSelection(['serif'], 'mono')).toEqual(['serif', 'mono'])
  })
})

describe('device lacks fonts in the set', () => {
  const offered = ['serif', 'rounded']

  it('narrows the saved selection to what the device has', () => {
    expect(rotationPool(['mono', 'serif'], offered)).toEqual(['serif'])
  })

  it('falls back to everything offered when no saved face survived', () => {
    expect(rotationPool(['mono', 'script'], offered)).toEqual(offered)
  })

  it('keeps the pool in offered order whatever order was stored', () => {
    expect(rotationPool(['marker', 'serif', 'script'], SHIPPED)).toEqual(
      SHIPPED.filter((id) => ['marker', 'serif', 'script'].includes(id)),
    )
  })

  it('pools nothing when the device offers nothing, so no font is drawn blindly', () => {
    expect(rotationPool(['serif'], [])).toEqual([])
    expect(drawDailyFont([], null)).toBeNull()
  })
})

describe('relaunch later the same day', () => {
  it('accepts a stored pick dated today', () => {
    expect(isTodayPick({ id: 'mono', date: '2026-11-25' }, TODAY)).toBe(true)
  })

  it('rejects yesterday and malformed values', () => {
    expect(isTodayPick({ id: 'mono', date: '2026-11-24' }, TODAY)).toBe(false)
    expect(isTodayPick({ id: 'mono' }, TODAY)).toBe(false)
    expect(isTodayPick({ id: 7, date: '2026-11-25' }, TODAY)).toBe(false)
    expect(isTodayPick(null, TODAY)).toBe(false)
  })

  it('cannot draw a stored pick naming a font the app no longer ships', () => {
    // The clock only ever draws a pick that is inside the current pool, and the pool
    // is built from shipped ids — so an id the app dropped is never selected.
    const pick = { id: 'default', date: '2026-11-25' }
    expect(rotationPool([pick.id], SHIPPED)).toEqual(SHIPPED)
    expect(rotationPool([pick.id], SHIPPED)).not.toContain(pick.id)
  })

  it('redraws when today’s face leaves the pool', () => {
    const pool = ['serif', 'rounded']
    const stale = { id: 'mono', date: '2026-11-25' }
    expect(pool.includes(stale.id)).toBe(false)
    const next = drawDailyFont(pool, stale.id)
    expect(pool).toContain(next)
    expect(next).not.toBe(stale.id)
  })
})

describe('local midnight passes while running', () => {
  it('never repeats the face just shown', () => {
    const pool = ['serif', 'mono', 'script']
    for (let i = 0; i < 500; i += 1)
      expect(drawDailyFont(pool, 'mono')).not.toBe('mono')
  })

  it('always lands on a pooled face, and alternates with a pool of two', () => {
    const pair = ['serif', 'marker']
    for (let i = 0; i < 200; i += 1) {
      const next = drawDailyFont(pair, 'serif')
      expect(next).toBe('marker')
      expect(pair).toContain(drawDailyFont(pair, next))
    }
  })

  it('covers every face of the pool eventually', () => {
    const pool = ['serif', 'mono', 'script', 'marker']
    const seen = new Set()
    let previous = null
    for (let i = 0; i < 200; i += 1) {
      previous = drawDailyFont(pool, previous)
      seen.add(previous)
    }
    expect([...seen].sort()).toEqual([...pool].sort())
  })
})
