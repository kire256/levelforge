// Build version information
// Increment VERSION.build with each release

const VERSION = {
  major: 0,
  minor: 2,
  patch: 0,
  build: 69
}

export const BUILD_VERSION = `v${VERSION.major}.${VERSION.minor}.${VERSION.patch}`
export const BUILD_COMMIT = 'main'
export const BUILD_TIME = new Date().toISOString().split('T')[0]

export const getFullVersion = () => {
  return `v${VERSION.major}.${VERSION.minor}.${VERSION.patch} (build ${VERSION.build})`
}

export const VERSION_INFO = VERSION
