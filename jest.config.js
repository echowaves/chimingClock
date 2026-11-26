// Only the pure selection logic is unit-tested, so no React Native environment is
// needed: `fontSelection.js` imports nothing and runs in plain node. Rendering the
// clock or the settings screen would need jest-expo, which this project does not
// use; those paths stay covered by the device checks recorded in the plan.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  // Two files to discover: polling is cheaper than a Watchman dependency, and
  // Watchman cannot start in a restricted environment at all.
  watchman: false,
  roots: ['<rootDir>/__tests__'],
}
