// How a stored preference is interpreted, kept free of React, React Native and
// SecureStore so it can be tested on its own (see __tests__). Every read goes through
// one of these, so "what does a fresh install get?" has the same answer everywhere.
//
// One rule serves all of the toggles because they answer the same question: did the
// user turn this off? A key that was never written — a fresh install, or an upgrade
// from a build that did not store it — and a value this version cannot parse are both
// "never turned off", so both mean On; an explicitly stored `false` is the only Off.
// A stored value still beats the default, so a saved Off survives every relaunch.

// Reads must never throw into state: `JSON.parse(null)` is `null`, while garbage such
// as `"yes please"` throws — both have to land on On instead of poisoning the pref
// they were read for (and, through an aborted init, the ones beside it).
export const booleanPref = (rawStored) => {
  let stored
  try {
    stored = JSON.parse(rawStored)
  } catch {
    return true
  }
  return stored !== false
}

// The chime range is the one preference that is not a switch, and it carries the same
// risk: a stored value this version cannot use must not take the rest of the launch
// with it. A full day is both what a fresh install gets and the safe repair — every
// quarter-hour chiming, which is what a build with nothing stored has always played.
// Anything that is not two whole hours inside 0..24 is repaired rather than trusted,
// because the slider cannot draw those values.
export const CHIME_RANGE_DEFAULT = { min: 0, max: 24 }

// Bounds read off the default rather than written out again, so the repair rule and
// the slider cannot drift to different ends: whatever the control can be dragged to
// is exactly what a stored range is allowed to hold.
const wholeHour = (value) =>
  Number.isInteger(value) &&
  value >= CHIME_RANGE_DEFAULT.min &&
  value <= CHIME_RANGE_DEFAULT.max

export const rangePref = (rawStored) => {
  let stored
  try {
    stored = JSON.parse(rawStored)
  } catch {
    return { ...CHIME_RANGE_DEFAULT }
  }
  const { min, max } = stored || {}
  return wholeHour(min) && wholeHour(max) && min <= max
    ? { min, max }
    : { ...CHIME_RANGE_DEFAULT }
}
