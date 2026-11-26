// The rules that decide which digit font draws, kept free of React, React Native
// and SecureStore so they can be tested on their own (see __tests__). The font
// table itself lives in App.js, because naming a family is a platform concern; this
// module is handed the ids the app ships and the ids this device offers.

// Stored ids are trusted only as far as they name a font the app still ships: an
// old "default" choice or a face removed in an update is dropped rather than
// repaired, so no stale value can reach the picker, the probe or the clock.
export const validFontIds = (ids, knownIds) =>
  Array.isArray(ids) ? ids.filter((id) => knownIds.includes(id)) : []

// The faces the clock may actually draw: what the user selected, as far as this
// device has them, in shipped order so a stored set and the button row agree. When
// none of the saved choices survives — first launch, or every saved face is absent
// from this phone — the pool is everything offered, which is also what a fresh
// install selects. Never empty while `offeredFontIds` has an entry.
export const rotationPool = (selectedIds, offeredFontIds) => {
  if (!Array.isArray(selectedIds)) return offeredFontIds
  // Intersecting over the offered list — not the stored one — is what keeps the pool
  // in shipped order however the user tapped, so the button row and the clock agree.
  const eligible = offeredFontIds.filter((id) => selectedIds.includes(id))
  return eligible.length > 0 ? eligible : offeredFontIds
}

// Today's draw from the pool, never the face just shown: drawing uniformly from the
// pool minus the previous pick is the terminating form of "draw again until it
// differs". A single-face pool has nothing to exclude and keeps that face, which is
// what one selection meaning "always this font" comes down to.
export const drawDailyFont = (pool, previousId) => {
  if (pool.length === 0) return null
  const candidates = pool.filter((id) => id !== previousId)
  const source = candidates.length > 0 ? candidates : pool
  return source[Math.floor(Math.random() * source.length)]
}

// A pick belongs to a local calendar day, so it survives an app restart inside the
// same day and is redrawn at midnight.
export const todayKey = (now) => now.format('YYYY-MM-DD')

export const isTodayPick = (pick, now) =>
  !!pick &&
  typeof pick.date === 'string' &&
  typeof pick.id === 'string' &&
  pick.date === todayKey(now)

// What the picker holds after a read. A saved set of known faces wins; otherwise a
// single legacy face becomes a one-element set; anything the app no longer ships —
// the old "default" included — is dropped, and an install with nothing usable lands
// on every font it offers, which is also what a fresh install selects.
export const resolveSelectedFonts = ({ saved, legacyFontId, allIds }) => {
  const validSaved = validFontIds(saved, allIds)
  if (validSaved.length > 0) return validSaved
  return allIds.includes(legacyFontId) ? [legacyFontId] : allIds
}

// The picker's one rule: a face toggles, except the last one standing, which stays
// selected because an empty pool has nothing honest to draw. Adding a face keeps
// `FONTS` order, since callers hand in a pool already intersected over the offered
// list.
export const nextSelection = (pool, id) => {
  if (!pool.includes(id)) return [...pool, id]
  return pool.length > 1 ? pool.filter((other) => other !== id) : pool
}
