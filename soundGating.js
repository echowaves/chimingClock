// The quiet-hours rule and the one thing layered on top of it, kept free of React,
// React Native and the audio player so they can be tested on their own (see
// __tests__). Both the quarter-hour bells and the ticking ask these questions, so a
// change to when sound is allowed has one answer rather than two that can drift apart.

// Deliberately the same expression the app has always used — optional chaining into
// the stored range and nothing else — because extracting a rule is no licence to
// change it: an unset range means silent, and a range whose bounds are not numbers
// behaves exactly as the comparison it replaced did. `min` is inclusive and `max`
// exclusive, so 0..24 is every hour and 8..12 is 8am through 11am.
export function isHourInActiveRange(hour, range) {
  return hour >= range?.min && hour < range?.max
}

// Whether the ticking should be running. Its own switch sits on top of the shared
// window: anything that is not an explicit `false` counts as On, which is both the
// default for a fresh install and for an upgrade from a build that never stored the
// preference — and it is what an unreadable stored value falls back to, so a
// SecureStore hiccup cannot silently silence a clock whose tick has always played.
export function isTickingAudible({ enabled, hour, range }) {
  return enabled !== false && isHourInActiveRange(hour, range)
}
