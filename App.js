/* eslint-disable global-require */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import 'react-native-gesture-handler'

// react-native's own SafeAreaView is deprecated; this library also reports the
// insets on Android, which the core component never did.
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'

import { useKeepAwake } from 'expo-keep-awake'
import { StatusBar } from 'expo-status-bar'

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'

import dayjs from 'dayjs'

import * as SecureStore from 'expo-secure-store'

import MultiSlider from '@ptomasroos/react-native-multi-slider'

const DIGIT_FONT_KEY = 'digitFont'
const RANDOM_DAILY_KEY = 'randomDaily'
const DEFAULT_FONT = 'default'

// Each digit font carries the weight it wants. iOS answers a `fontFamily` request
// with the face in that family whose weight is closest to the one asked for
// (RCTFontUtils.mm), so asking a family for a weight it does not have gets the next
// lightest face instead: Avenir's faces are Book/Medium/DemiBold/Heavy/Black and
// Snell Roundhand's are Regular/Bold/Black, which is why one shared semibold made
// both of them look thin. Families without an iOS face fall back to the Android
// family named beside them.
const FONTS = {
  default: { label: 'Default', weight: '600', style: {} },
  serif: {
    label: 'Serif',
    weight: '600',
    style: Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      default: { fontFamily: 'Georgia' },
    }),
  },
  mono: {
    label: 'Mono',
    weight: '600',
    style: Platform.select({
      ios: { fontFamily: 'Menlo' },
      android: { fontFamily: 'monospace' },
      default: { fontFamily: 'Menlo' },
    }),
  },
  rounded: {
    label: 'Rounded',
    // 800 resolves to Avenir-Heavy on iOS and a heavy Roboto on Android; the Black
    // faces are a step too display-like for digits read at a distance.
    weight: '800',
    style: Platform.select({
      ios: { fontFamily: 'Avenir' },
      android: { fontFamily: 'sans-serif' },
      default: { fontFamily: 'Avenir' },
    }),
  },
  script: {
    label: 'Script',
    // Asked exactly, so the closest-face search picks Snell Roundhand Bold by name
    // weight instead of leaving it a tie between Bold and the calligraphic Black.
    weight: '700',
    style: Platform.select({
      ios: { fontFamily: 'Snell Roundhand' },
      android: { fontFamily: 'cursive' },
      default: { fontFamily: 'Snell Roundhand' },
    }),
  },
  typewriter: {
    label: 'Typewriter',
    weight: '700',
    style: Platform.select({
      ios: { fontFamily: 'American Typewriter' },
      android: { fontFamily: 'serif-monospace' },
      default: { fontFamily: 'American Typewriter' },
    }),
  },
  geometric: {
    label: 'Geometric',
    weight: '800',
    style: Platform.select({
      ios: { fontFamily: 'Futura' },
      android: { fontFamily: 'sans-serif-condensed' },
      default: { fontFamily: 'Futura' },
    }),
  },
  display: {
    label: 'Display',
    weight: '700',
    style: Platform.select({
      ios: { fontFamily: 'Didot' },
      android: { fontFamily: 'serif' },
      default: { fontFamily: 'Didot' },
    }),
  },
  engraved: {
    label: 'Engraved',
    weight: '700',
    style: Platform.select({
      ios: { fontFamily: 'Copperplate' },
      android: { fontFamily: 'serif' },
      default: { fontFamily: 'Copperplate' },
    }),
  },
  marker: {
    label: 'Marker',
    // Marker Felt has no bold face; the closest-weight search settles on its widest
    // face, which is still the chunkiest thing the family offers.
    weight: '700',
    style: Platform.select({
      ios: { fontFamily: 'Marker Felt' },
      android: { fontFamily: 'casual' },
      default: { fontFamily: 'Marker Felt' },
    }),
  },
}

// Daily mode picks among these only, so "surprise me" never shows the default
// look. Derived from FONTS so a font can never be in one list but not the other;
// narrowed to the fonts this device has where that is known.
const DAILY_FONT_POOL = Object.keys(FONTS).filter((id) => id !== DEFAULT_FONT)

// Pure helpers (no state): the same local date always derives the same font id.
const dayOfYear = (now) => now.startOf('day').diff(now.startOf('year'), 'day')

const dailyFontId = (now, pool) =>
  pool.length === 0 ? DEFAULT_FONT : pool[dayOfYear(now) % pool.length]

const normalizeFontId = (id) => (FONTS[id] ? id : DEFAULT_FONT)

// `availableFontIds` is the ids measured on this device, or null while that is
// still unknown. A face the device lacks would only ever draw the system font, so
// daily mode skips it and a stored choice of it falls back to Default — which is
// what the digits are already showing, and keeps the highlighted button honest.
const activeFontId = (randomDaily, digitFont, now, availableFontIds) => {
  const pool = availableFontIds
    ? availableFontIds.filter((id) => id !== DEFAULT_FONT)
    : DAILY_FONT_POOL
  const wanted =
    randomDaily === true ? dailyFontId(now, pool) : normalizeFontId(digitFont)
  if (availableFontIds && !availableFontIds.includes(wanted))
    return DEFAULT_FONT
  return normalizeFontId(wanted)
}

// Clock-face layout. The fitting box is the motion box (the clock screen as
// laid out, safe-area insets included) inset by a travel margin on each side:
// the digits are never larger than that, so travel stays free — half an inch
// (80dp at the nominal 160dp per inch) is the ceiling of that margin, never
// its floor, because of how the fitting actually binds: the time string is
// wide for its height, so on a landscape phone it is the width axis that caps
// the font size, and reserving a fixed half inch per side horizontally costs
// near a third of a small screen's width — which is why the font still looked
// under-filled on small devices while only the height axis was made
// proportional. Each axis therefore takes TRAVEL_MARGIN_SHARE of itself as
// its margin — floored at TRAVEL_MARGIN_FLOOR so ordinary small screens keep
// real travel room, but never more than a fifth of the axis so an absurdly
// narrow window (Android split-screen) still loses no more to travel than the
// old proportional cap did. Text keeps ~80% of an axis at the half-inch
// ceiling and never under three fifths anywhere. The bounce
// runs off the measured digit box either way, so a drift extreme lands the
// digits' layout box flush on the edge of the motion box: every edge is
// reachable, whatever font is active and however long the string, and nothing
// is ever drawn past one. INK_SLACK keeps glyph ink — which in script faces
// can spill slightly past the advance box — inside the screen at that flush
// position.
const EDGE_TRAVEL_MARGIN = 80
const TRAVEL_MARGIN_SHARE = 0.1
const TRAVEL_MARGIN_FLOOR = 28
// The floor only applies while it stays within TRAVEL_MARGIN_FLOOR_CAP of the
// axis, so on a degenerate window the margin falls back to plain proportion
// and the font can never come out smaller than the old capped formula gave.
const TRAVEL_MARGIN_FLOOR_CAP = 0.2
const travelMargin = (axisSize) =>
  Math.min(
    EDGE_TRAVEL_MARGIN,
    Math.max(
      Math.min(TRAVEL_MARGIN_FLOOR, axisSize * TRAVEL_MARGIN_FLOOR_CAP),
      axisSize * TRAVEL_MARGIN_SHARE,
    ),
  )
const INK_SLACK = 4

// The digits are measured once per font + time string at this small size. Text
// metrics scale linearly with font size, so one measurement gives exactly the
// largest size that fits the box. A five-glyph time is ~120px wide here, far
// inside even a narrow window, so the probe never wraps and can be trusted.
const MEASURE_SIZE = 40

// Chime bookkeeping. RN pauses JS timers the moment the app stops being active —
// RCTTiming listens for UIApplicationWillResignActive, not only for entering the
// background, and treats a close proximity sensor as background too — so a gap in
// ticking can straddle a quarter hour entirely. Keying the chime on the observed
// minute therefore loses that quarter for good; keying it on wall-clock quarters
// means the first tick after any gap still reports the quarter it crossed.
const QUARTER_MS = 15 * 60 * 1000
// A boundary further back than this was passed while nothing was ticking, and
// announcing it would name a time that has already gone by — stay silent instead.
// Counting quarters from epoch milliseconds is safe in every zone, since all UTC
// offsets are multiples of 15 minutes, so these boundaries are local :00/:15/:30/:45.
const LATE_CHIME_GRACE_MS = 2 * 60 * 1000

// Settings scrollbar. This RN version's `indicatorStyle` is only 'default' |
// 'black' | 'white' (Libraries/Components/ScrollView/ScrollView.js), so the native
// bar cannot be kept on screen: iOS fades it out and drops it entirely when the
// content fits, Android draws nothing before the first drag. The settings screen
// therefore draws its own, which is also the only way to show a bar while there is
// nothing to scroll. INSET keeps the track off the very edge of the screen.
const SCROLLBAR_WIDTH = 4
const SCROLLBAR_INSET = 8
// A thumb shorter than this is hard to see or read as a thumb, however long the list.
const SCROLLBAR_MIN_THUMB = 24

// Which digit fonts this device really has. A family it lacks is not an error:
// RCTFontUtils.mm answers with the system font, so a button can promise Engraved
// and draw San Francisco. So ask the device — lay each candidate out at
// MEASURE_SIZE beside a twin asking for the same weight with no family, and treat
// identical metrics as "that family is not here". Digits plus upper and lowercase
// letters, because some of these faces (Copperplate) differ mostly outside digits.
const FONT_PROBE_TEXT = '0123456789Agg'
// Reported line boxes vary by fractions of a point; smaller differences than this
// are rounding rather than a different face.
const FONT_METRIC_EPSILON = 0.01
const FONT_METRIC_FIELDS = [
  'width',
  'height',
  'ascender',
  'capHeight',
  'descender',
  'xHeight',
]

// True when the two probes are measurably different faces. Fields a platform does
// not report (or reports as nothing) are skipped rather than counted as a match, so
// the comparison still works wherever fewer metrics are available.
const fontMetricsDiffer = (a, b) =>
  !!a &&
  !!b &&
  FONT_METRIC_FIELDS.some(
    (field) =>
      Number.isFinite(a[field]) &&
      Number.isFinite(b[field]) &&
      Math.abs(a[field] - b[field]) > FONT_METRIC_EPSILON,
  )

// Some entries name the platform's own default typeface rather than a face that
// might be absent: Android's 'sans-serif' resolves on every device, which is why
// Rounded is worth offering there even though it asks for no more than the system
// family at a heavier weight. Measuring one against a no-family twin finds identical
// metrics — true, but it proves "same family as the default", not "unavailable". So
// such an entry is declared available where that holds, and measured everywhere else
// (Rounded asks for Avenir on iOS, which is very much worth measuring).
const DEFAULT_FAMILY_FONT_IDS = { android: ['rounded'] }
const isDefaultFamilyFont = (id) =>
  (DEFAULT_FAMILY_FONT_IDS[Platform.OS] || []).includes(id)

// Measured ids and declared ones, computed once: the platform never changes mid-run.
const ALL_NON_DEFAULT_FONT_IDS = Object.keys(FONTS).filter(
  (id) => id !== DEFAULT_FONT,
)
const MEASURED_FONT_IDS = ALL_NON_DEFAULT_FONT_IDS.filter(
  (id) => !isDefaultFamilyFont(id),
)
const DECLARED_FONT_IDS = ALL_NON_DEFAULT_FONT_IDS.filter(isDefaultFamilyFont)

const fontProbeKey = (id) => id
const systemProbeKey = (weight) => `system:${weight}`

// One invisible line of text that reports its own metrics. Same trick the clock
// uses to fit its digits: an absolutely positioned, fully transparent Text still
// lays out, and onTextLayout carries the answer.
function FontProbe({ probeKey, spec, onMeasured }) {
  const report = ({ nativeEvent }) => {
    const [line] = nativeEvent.lines
    // A zero-sized line is a layout pass with nothing drawn yet, not a measurement.
    // Two of those would compare as "the same face" and quietly hide a good font, so
    // wait for a real report — the digit probe in the clock screen guards the same way.
    if (!line || !(line.width > 0) || !(line.height > 0)) {
      return
    }
    if (!Number.isFinite(line.width) || !Number.isFinite(line.height)) {
      return
    }
    onMeasured(probeKey, line)
  }

  return (
    <Text
      numberOfLines={1}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{
        ...spec,
        fontSize: MEASURE_SIZE,
        opacity: 0,
        position: 'absolute',
        left: 0,
        top: 0,
      }}
      onTextLayout={report}
    >
      {FONT_PROBE_TEXT}
    </Text>
  )
}

function App() {
  useKeepAwake()
  const { height, width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // The box the clock drifts in: the window minus the safe-area insets, which
  // react-native-safe-area-context tracks live on both platforms, so fitting
  // and bouncing run off what is actually drawable and a rotation updates it
  // through either dimension or insets. The provider reports zero insets until
  // it has measured, which falls back to the whole window.
  const motionBox = {
    width: Math.max(1, width - insets.left - insets.right),
    height: Math.max(1, height - insets.top - insets.bottom),
  }
  // The size drawn before the digit probe first reports a measurement — a
  // conservative guess that the fitted size replaces on the next layout pass.
  const guessFontSize = width / 3
  const fitWidth = Math.max(
    1,
    motionBox.width - 2 * travelMargin(motionBox.width),
  )
  const fitHeight = Math.max(
    1,
    motionBox.height - 2 * travelMargin(motionBox.height),
  )

  const [firstScreen, setFirstScreen] = useState(true)

  const [currentTime, setCurrentTime] = useState(dayjs())

  const [currentMinute, setCurrentMinute] = useState()

  const [currentText, setCurrentText] = useState('')

  const [xStep, setXStep] = useState(1)
  const [yStep, setYStep] = useState(1)

  const [xShift, setXShift] = useState(0)
  const [yShift, setYShift] = useState(0)

  const [hoursSounds, setHoursSounds] = useState()
  const [minutesSounds, setMinutesSounds] = useState()
  const [tickSound, setTickSound] = useState()

  // Which quarter hour was last chimed, as an index into QUARTER_MS; null until the
  // first tick records the current one, so launching mid-quarter stays silent. A
  // ref, not state: it must never re-render or batch with the clock itself.
  const lastChimedQuarter = useRef(null)

  const CHIMING_TIME_RANGE = 'chimingTimeRange'
  const [chimingTimeRange, setChimingTimeRange] = useState(null)

  // null means "not loaded from SecureStore yet"; renders fall back to default.
  const [digitFont, setDigitFont] = useState(null)
  const [randomDaily, setRandomDaily] = useState(null)
  // Until the prefs load finishes, the font controls are shown but inert, so a
  // early tap can't be clobbered by (or clobber) the values init is reading.
  const [fontPrefsLoaded, setFontPrefsLoaded] = useState(false)

  // What this device can actually draw, measured by hidden probes on the settings
  // screen. null while any probe is still outstanding: nothing is ruled out until
  // then, so the picker cannot start empty or lose a button while it is open.
  const [fontProbeMetrics, setFontProbeMetrics] = useState({})

  const recordFontProbe = (probeKey, line) =>
    setFontProbeMetrics((measured) => {
      // Layout can report the same line more than once; storing identical numbers
      // again would re-render, and a re-render can re-layout — stop the first time.
      const previous = measured[probeKey]
      if (previous && !fontMetricsDiffer(previous, line)) return measured
      return { ...measured, [probeKey]: line }
    })

  // One probe per font that asks for a family, plus one twin per weight those
  // candidates ask for: a missing family is answered by the system font *at the
  // requested weight*, so that is the only fair thing to measure it against.
  const fontProbes = useMemo(() => {
    const candidates = MEASURED_FONT_IDS
    const weights = [...new Set(candidates.map((id) => FONTS[id].weight))]
    return [
      ...candidates.map((id) => ({
        probeKey: fontProbeKey(id),
        spec: { fontWeight: FONTS[id].weight, ...FONTS[id].style },
      })),
      ...weights.map((weight) => ({
        probeKey: systemProbeKey(weight),
        spec: { fontWeight: weight },
      })),
    ]
  }, [])

  const availableFontIds = useMemo(() => {
    const outstanding = MEASURED_FONT_IDS.some(
      (id) =>
        !fontProbeMetrics[fontProbeKey(id)] ||
        !fontProbeMetrics[systemProbeKey(FONTS[id].weight)],
    )
    if (outstanding) return null
    return [
      // The default asks for no family, so it is the system font by definition and
      // always available.
      DEFAULT_FONT,
      ...DECLARED_FONT_IDS,
      ...MEASURED_FONT_IDS.filter((id) =>
        fontMetricsDiffer(
          fontProbeMetrics[fontProbeKey(id)],
          fontProbeMetrics[systemProbeKey(FONTS[id].weight)],
        ),
      ),
    ]
  }, [fontProbeMetrics])

  const offeredFontIds = availableFontIds
    ? Object.keys(FONTS).filter((id) => availableFontIds.includes(id))
    : Object.keys(FONTS)

  // Recomputed on each render (the clock ticks every second), so a new local
  // date picks up the new daily font without extra state or timers.
  const currentFontId = activeFontId(
    randomDaily,
    digitFont,
    currentTime,
    availableFontIds,
  )

  // The font family and weight only; each user sets its own size.
  const fontSpecs = {
    fontWeight: FONTS[currentFontId].weight,
    ...FONTS[currentFontId].style,
  }

  // The digits' natural box at MEASURE_SIZE, as the probe below reports it; null
  // until the first measurement arrives. Only the font and the time string affect
  // it, never the window size: the fitting size is derived from these numbers on
  // every render, so a resize needs no new measurement — and it could not wait for
  // one, because identical line metrics are deduplicated before reaching JS.
  const [digitMetrics, setDigitMetrics] = useState(null)
  const metricsKey = `${currentFontId}|${currentText}`

  const onMeasureDigits = ({ nativeEvent }) => {
    const [line] = nativeEvent.lines
    if (!line || !line.width || !line.height) return
    if (!Number.isFinite(line.width) || !Number.isFinite(line.height)) return
    if (digitMetrics && digitMetrics.key === metricsKey) return
    setDigitMetrics({ key: metricsKey, width: line.width, height: line.height })
  }

  // Line width and height both scale linearly with font size, so the measurement
  // gives the largest size whose digits still fit the box along each axis — that
  // is the whole ceiling: the digits scale up until only the travel margin is
  // left between them and the nearest edge. While a new font or time string is
  // being measured the previous metrics keep drawing — closer than flashing back
  // to the guess.
  const fittedFontSize = digitMetrics
    ? Math.min(
        (fitWidth * MEASURE_SIZE) / digitMetrics.width,
        (fitHeight * MEASURE_SIZE) / digitMetrics.height,
      )
    : guessFontSize
  const digitFontSize =
    Number.isFinite(fittedFontSize) && fittedFontSize > 0
      ? fittedFontSize
      : guessFontSize
  const digitScale = digitFontSize / MEASURE_SIZE
  // Centring uses the measured box, so the clock stays in the middle of the
  // motion box on both platforms — textAlignVertical would only do it on Android.
  const digitWidth = digitMetrics ? digitMetrics.width * digitScale : fitWidth
  const digitHeight = digitMetrics
    ? digitMetrics.height * digitScale
    : fitHeight

  // How far from centre each axis may drift before its wall: half the free
  // space in the motion box, less the ink slack. Computed on every render and
  // shared by the bounce in the clock effect and the placement in the clock
  // screen, so a digit box that grew since the last tick — a longer time
  // string, the daily font swap — can never leave a stale shift drawn past an
  // edge while waiting for that tick.
  const xRange = Math.max(0, (motionBox.width - digitWidth) / 2 - INK_SLACK)
  const yRange = Math.max(0, (motionBox.height - digitHeight) / 2 - INK_SLACK)
  const clampedXShift = Math.max(-xRange, Math.min(xRange, xShift))
  const clampedYShift = Math.max(-yRange, Math.min(yRange, yShift))

  const initChimingTime = async () => {
    setChimingTimeRange(
      JSON.parse(await SecureStore.getItemAsync(CHIMING_TIME_RANGE)) || {
        min: 0,
        max: 24,
      },
    )
  }

  const initDigitFontPrefs = async () => {
    // Only successful reads write state. A corrupt or unreadable stored value
    // leaves prefs null (renders as default) and is never written back over,
    // so a transient SecureStore failure can't destroy intact prefs.
    try {
      const storedFont = JSON.parse(
        await SecureStore.getItemAsync(DIGIT_FONT_KEY),
      )
      setDigitFont(normalizeFontId(storedFont))

      const storedRandomDaily =
        JSON.parse(await SecureStore.getItemAsync(RANDOM_DAILY_KEY)) === true
      setRandomDaily(storedRandomDaily)
    } catch {
      // treat as unset; save-effect guards skip persisting while null
    } finally {
      setFontPrefsLoaded(true)
    }
  }

  const initSounds = () => {
    const hours = new Map()
    hours.set(0, createAudioPlayer(require('./assets/hour0.mp3')))
    hours.set(1, createAudioPlayer(require('./assets/hour1.mp3')))
    hours.set(2, createAudioPlayer(require('./assets/hour2.mp3')))
    hours.set(3, createAudioPlayer(require('./assets/hour3.mp3')))
    hours.set(4, createAudioPlayer(require('./assets/hour4.mp3')))
    hours.set(5, createAudioPlayer(require('./assets/hour5.mp3')))
    hours.set(6, createAudioPlayer(require('./assets/hour6.mp3')))
    hours.set(7, createAudioPlayer(require('./assets/hour7.mp3')))
    hours.set(8, createAudioPlayer(require('./assets/hour8.mp3')))
    hours.set(9, createAudioPlayer(require('./assets/hour9.mp3')))
    hours.set(10, createAudioPlayer(require('./assets/hour10.mp3')))
    hours.set(11, createAudioPlayer(require('./assets/hour11.mp3')))

    const minutes = new Map()
    minutes.set(15, createAudioPlayer(require('./assets/minute15.mp3')))
    minutes.set(30, createAudioPlayer(require('./assets/minute30.mp3')))
    minutes.set(45, createAudioPlayer(require('./assets/minute45.mp3')))

    setHoursSounds(hours)
    setMinutesSounds(minutes)

    const tick = createAudioPlayer(require('./assets/ticktack.mp3'))
    setTickSound(tick)
    tick.loop = true
    tick.play()
  }

  useEffect(() => {
    ;(async () => {
      await setAudioModeAsync({ playsInSilentMode: true })
      await initChimingTime()
      await initDigitFontPrefs()
      initSounds()
    })()

    const interval = setInterval(() => {
      setCurrentTime(dayjs())
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const minute = dayjs(currentTime).minute()

    // Bounce off the walls: step first, then clamp at the wall and reverse.
    // Clamping makes overshoot impossible, so a shift is never stored past
    // its wall, and one left outside a range that shrank mid-flight (a new
    // font or time string) is pulled back inside here. The axes share one
    // speed, so the drift stays diagonal and sweeps the corners between its
    // wall hits. xRange/yRange come from the render scope, where they clamp
    // placement too — the walls and the drawing cannot disagree.
    const nextShift = (shift, step, range) => {
      if (shift + step >= range) return [-1, range]
      if (shift + step <= -range) return [1, -range]
      return [step, shift + step]
    }
    const [nextXStep, nextXShift] = nextShift(xShift, xStep, xRange)
    const [nextYStep, nextYShift] = nextShift(yShift, yStep, yRange)
    setXStep(nextXStep)
    setYStep(nextYStep)
    setXShift(nextXShift)
    setYShift(nextYShift)

    if (currentMinute !== minute) {
      setCurrentMinute(minute)
      const text = dayjs(currentTime).format('h:mm')
      setCurrentText(text)
    }
  }, [currentTime])

  const isSoundEnabled = () => {
    const currentHour = dayjs(currentTime).hour()

    if (
      currentHour >= chimingTimeRange?.min &&
      currentHour < chimingTimeRange?.max
    ) {
      return true
    }
    return false
  }

  const resetTicking = () => {
    if (tickSound) tickSound.volume = isSoundEnabled() ? 1 : 0
  }

  useEffect(() => {
    resetTicking()
    if (chimingTimeRange) {
      SecureStore.setItemAsync(
        CHIMING_TIME_RANGE,
        JSON.stringify(chimingTimeRange),
      )
    }
    // console.log({ chimingTimeRange: JSON.stringify(chimingTimeRange) })
  }, [chimingTimeRange])

  useEffect(() => {
    if (digitFont) {
      SecureStore.setItemAsync(DIGIT_FONT_KEY, JSON.stringify(digitFont)).catch(
        () => {
          // best-effort persist: keep the choice for this session on failure
        },
      )
    }
  }, [digitFont])

  useEffect(() => {
    if (randomDaily !== null) {
      SecureStore.setItemAsync(
        RANDOM_DAILY_KEY,
        JSON.stringify(randomDaily),
      ).catch(() => {
        // best-effort persist: keep the choice for this session on failure
      })
    }
  }, [randomDaily])

  // The hour and minute are the quarter's own, so a chime that lands late still
  // sounds the bell for the hour it is announcing.
  const play = async (hour, minute) => {
    const player =
      minute === 0 ? hoursSounds.get(hour % 12) : minutesSounds.get(minute)
    if (!player) return

    player.seekTo(0)
    player.volume = isSoundEnabled() ? 1 : 0
    player.play()
  }

  // One chime per quarter hour, whatever the ticks looked like in between. Runs on
  // every tick so a delayed or skipped tick cannot hide a boundary; at most one
  // chime follows a long gap (the newest quarter), never a burst of missed ones.
  useEffect(() => {
    const nowMs = dayjs(currentTime).valueOf()
    const quarter = Math.floor(nowMs / QUARTER_MS)

    if (lastChimedQuarter.current === null) {
      lastChimedQuarter.current = quarter
      return
    }
    if (quarter === lastChimedQuarter.current) return
    lastChimedQuarter.current = quarter

    const boundaryMs = quarter * QUARTER_MS
    if (!minutesSounds || nowMs - boundaryMs > LATE_CHIME_GRACE_MS) return

    const boundary = dayjs(boundaryMs)
    play(boundary.hour(), boundary.minute())
  }, [currentTime])

  // The tick volume follows the active time range as hours pass by it.
  useEffect(() => {
    resetTicking()
  }, [currentMinute])

  // Settings scrollbar geometry, measured from the scroll view itself so rotation
  // and font changes need nothing extra: `viewport` is what the screen shows,
  // `content` is all of it. The thumb claims the same share of the track as the
  // viewport claims of the content, so a screen that fits everything shows a full
  // thumb instead of no bar at all.
  const [settingsSize, setSettingsSize] = useState({ viewport: 0, content: 0 })
  const settingsScrollY = useRef(new Animated.Value(0)).current

  const onSettingsScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: settingsScrollY } } }],
        { useNativeDriver: true },
      ),
    [settingsScrollY],
  )

  const onSettingsLayout = ({ nativeEvent }) =>
    setSettingsSize((size) =>
      size.viewport === nativeEvent.layout.height
        ? size
        : { ...size, viewport: nativeEvent.layout.height },
    )

  const onSettingsContentSizeChange = (_width, contentHeight) =>
    setSettingsSize((size) =>
      size.content === contentHeight
        ? size
        : { ...size, content: contentHeight },
    )

  const trackHeight = Math.max(0, settingsSize.viewport - 2 * SCROLLBAR_INSET)
  const hiddenHeight = Math.max(0, settingsSize.content - settingsSize.viewport)
  const visibleShare = settingsSize.content
    ? Math.min(1, settingsSize.viewport / settingsSize.content)
    : 1
  const thumbHeight = Math.max(
    Math.min(SCROLLBAR_MIN_THUMB, trackHeight),
    trackHeight * visibleShare,
  )
  // Built from the real ranges, so the thumb sits at the top of the track with the
  // content at the top and reaches the end of it exactly when the content ends.
  const thumbTranslateY = useMemo(
    () =>
      settingsScrollY.interpolate({
        inputRange: [0, Math.max(1, hiddenHeight)],
        outputRange: [0, Math.max(0, trackHeight - thumbHeight)],
      }),
    [settingsScrollY, hiddenHeight, trackHeight, thumbHeight],
  )

  const styles = StyleSheet.create({
    firstScreen: {
      backgroundColor: 'white',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%', // Change width to '100%'
      height: '100%', // Change height to '100%'
      // paddingHorizontal: 36,
      // paddingVertical: 36,
    },
    title: { paddingTop: 30, fontSize: 20 },
    // flexGrow keeps the content centred exactly as before when it fits the
    // screen; when it doesn't (small phones) the container grows to the
    // content and the ScrollView takes over, with no clipped top.
    // width keeps the ScrollView full-width despite the parent's
    // alignItems: 'center', which would otherwise shrink-wrap it to content.
    settingsScroll: { flex: 1, width: '100%' },
    settingsContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 24,
    },
    // Absolutely positioned inside the settings SafeAreaView, so it takes part in
    // the centring of the column and steals no space from it.
    settingsScrollbarTrack: {
      position: 'absolute',
      right: SCROLLBAR_INSET,
      top: SCROLLBAR_INSET,
      bottom: SCROLLBAR_INSET,
      width: SCROLLBAR_WIDTH,
      borderRadius: SCROLLBAR_WIDTH / 2,
      backgroundColor: 'rgba(0, 0, 0, 0.08)',
    },
    settingsScrollbarThumb: {
      width: '100%',
      borderRadius: SCROLLBAR_WIDTH / 2,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
  })

  if (firstScreen)
    return (
      <SafeAreaView style={styles.firstScreen}>
        {/* Animated.ScrollView, not ScrollView: with useNativeDriver an
            Animated.event is an object rather than a callable handler, and only
            an animated component knows how to attach it (it hands the inner view
            a real function). Passing it to a plain ScrollView crashes on the
            first scroll with "Object is not a function". */}
        <Animated.ScrollView
          style={styles.settingsScroll}
          contentContainerStyle={styles.settingsContent}
          showsVerticalScrollIndicator={false}
          onLayout={onSettingsLayout}
          onContentSizeChange={onSettingsContentSizeChange}
          onScroll={onSettingsScroll}
          scrollEventThrottle={16}
        >
          <Text style={styles.title}>
            chimingClock will play chimes every 15 minutes. Sometimes it may get
            too loud for you. The clock will chime only during the time range
            specified below:
          </Text>

          <View
            style={{
              flexDirection: 'column',
              width: '90%', // Change width to '100%'
              // paddingVertical: 20,
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: 30,
            }}
          >
            <Text
              style={{
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 20,
                fontWeight: '600',
              }}
            >{`chimes active from ${dayjs(
              `2020-01-01 ${chimingTimeRange?.min}:00`,
            ).format('ha')} to ${dayjs(
              `2020-01-01 ${chimingTimeRange?.max}:00`,
            ).format('ha')}`}</Text>
            <MultiSlider
              isMarkersSeparated={true}
              min={0}
              max={24}
              showSteps={true}
              values={[chimingTimeRange?.min, chimingTimeRange?.max]}
              onValuesChange={(value) =>
                setChimingTimeRange({
                  ...chimingTimeRange,
                  min: value[0],
                  max: value[1],
                })
              }
            />
          </View>

          {/* First of the two settings groups on purpose: this is how the user
              leaves the screen, and it must not sit behind everything they may
              have to scroll past. */}
          <Pressable
            onPress={() => setFirstScreen(false)}
            style={{
              alignSelf: 'center',
              // width: '90%', // Change width to '100%'

              alignItems: 'center',
              // justifyContent: 'center',
              paddingVertical: 20,
              paddingHorizontal: 32,
              borderRadius: 10,
              elevation: 5,
              backgroundColor: 'black',
            }}
          >
            <Text style={{ fontWeight: '600', fontSize: 20, color: 'white' }}>
              {`Show the clock`}
            </Text>
          </Pressable>

          <View
            pointerEvents={fontPrefsLoaded ? 'auto' : 'none'}
            style={{
              flexDirection: 'column',
              width: '90%',
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: 20,
              opacity: fontPrefsLoaded ? 1 : 0.5,
            }}
          >
            <Text
              style={{
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 20,
                fontWeight: '600',
              }}
            >
              Digit font
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {offeredFontIds.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => {
                    setDigitFont(id)
                    setRandomDaily(false)
                  }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    margin: 4,
                    borderRadius: 10,
                    elevation: 5,
                    borderWidth: 1,
                    borderColor: 'black',
                    backgroundColor: id === currentFontId ? 'black' : 'white',
                  }}
                >
                  <Text
                    style={{
                      fontWeight: FONTS[id].weight,
                      ...FONTS[id].style,
                      fontSize: 16,
                      color: id === currentFontId ? 'white' : 'black',
                    }}
                  >
                    {FONTS[id].label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setRandomDaily(randomDaily !== true)}
              style={{
                marginTop: 12,
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: 10,
                elevation: 5,
                borderWidth: 1,
                borderColor: 'black',
                backgroundColor: randomDaily === true ? 'black' : 'white',
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  fontSize: 16,
                  color: randomDaily === true ? 'white' : 'black',
                }}
              >
                {`Surprise me daily: ${randomDaily === true ? 'On' : 'Off'}`}
              </Text>
            </Pressable>
          </View>
        </Animated.ScrollView>
        {/* Always-visible scrollbar. pointerEvents="none" keeps it clear of the
            slider and buttons, so it can never capture a drag. */}
        <View pointerEvents="none" style={styles.settingsScrollbarTrack}>
          <Animated.View
            style={[
              styles.settingsScrollbarThumb,
              {
                height: thumbHeight,
                transform: [{ translateY: thumbTranslateY }],
              },
            ]}
          />
        </View>
        {/* Availability probes, outside the ScrollView so they cannot change its
            content height (and with it the thumb geometry above). Each one is a
            transparent absolutely positioned line of text that reports what the
            device really rendered for that family; see FontProbe. */}
        {fontProbes.map(({ probeKey, spec }) => (
          <FontProbe
            key={probeKey}
            probeKey={probeKey}
            spec={spec}
            onMeasured={recordFontProbe}
          />
        ))}
      </SafeAreaView>
    )
  // console.log({ width })
  return (
    // The Pressable covers the whole window, so a tap anywhere opens settings
    // as it always did. The digits are placed inside its safe-area box — the
    // window inset by the live insets — so on a notched phone the drift stays
    // clear of the notch and home indicator, on Android of the gesture nav
    // too, and they are fully visible at every extreme.
    <Pressable
      style={{ flex: 1, backgroundColor: 'black' }}
      onPress={() => setFirstScreen(true)}
    >
      {/* Hidden probe. It reports the digits' natural width and line height at
            a known small size, which is what makes the size below exact rather
            than guessed. Native auto-fit can't do this instead: iOS caps it at
            96pt and minimumFontScale is ignored on Fabric. The probe is left
            unconstrained (no width style) so the line box it reports is the
            glyphs' natural width and not the container's. */}
      <Text
        numberOfLines={1}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{
          ...fontSpecs,
          fontSize: MEASURE_SIZE,
          opacity: 0,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
        onTextLayout={onMeasureDigits}
      >
        {currentText}
      </Text>
      {/* numberOfLines is the backstop: the measured size already keeps the
            digits inside the fitting box, so they never wrap. */}
      <Text
        numberOfLines={1}
        style={{
          ...fontSpecs,
          fontSize: digitFontSize,
          color: '#d0fcc5',
          position: 'absolute',
          left:
            insets.left + (motionBox.width - digitWidth) / 2 + clampedXShift,
          top:
            insets.top + (motionBox.height - digitHeight) / 2 + clampedYShift,
        }}
      >
        {currentText}
      </Text>
      <StatusBar hidden={true} />
    </Pressable>
  )
}

// The library SafeAreaProvider tracks the insets live at the root, which is
// what the settings SafeAreaView and the clock's inset maths below read.
export default function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  )
}
