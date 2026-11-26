/* eslint-disable global-require */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
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

import { isHourInActiveRange, isTickingAudible } from './soundGating'

import {
  drawDailyFont,
  isTodayPick,
  nextSelection,
  resolveSelectedFonts,
  rotationPool,
  todayKey,
} from './fontSelection'

// Preferences. `digitFonts` is the set the clock rotates through and
// `dailyFontPick` is today's draw from it, `{ id, date }`, kept so a relaunch
// later the same day shows the face the user already saw. The two legacy keys are
// read once for migration and then deleted.
const DIGIT_FONTS_KEY = 'digitFonts'
const DAILY_PICK_KEY = 'dailyFontPick'
const SHOW_SECONDS_KEY = 'showSeconds'
const PULSE_SEPARATOR_KEY = 'pulseSeparator'
// Absent in storage means On: the tick has played since the first build, and neither a
// fresh install nor an upgrade should lose it.
const TICKING_SOUND_KEY = 'tickingSound'
const LEGACY_DIGIT_FONT_KEY = 'digitFont'
const LEGACY_RANDOM_DAILY_KEY = 'randomDaily'

// Display options. The seconds are a tenth of the digit height: deliberately small,
// a detail rather than a competing readout, so the corner they occupy stays theirs
// alone. The separator breathes between full opacity and a fifth of it, half a cycle
// each way, so one breath reads as ~3s.
const SECONDS_SCALE = 0.1
// Only used when a platform reports no ascender metric: the share of a line box that
// typically sits below the baseline, so the seconds still hug the text there.
const DESCENT_FALLBACK_SHARE = 0.2
// The corner is drawn over the digits' own box, so it can land on a minute digit —
// and green on green simply vanishes. It carries a panel of its own instead, kept
// half-transparent so the glyph underneath still reads through it. The alpha lives in
// the fill, not the box's opacity, which would fade the seconds along with it.
const SECONDS_CHIP_FILL = 'rgba(0, 0, 0, 0.5)'
// Padding and radius are shares of the seconds' own size, so the chip keeps its shape
// whatever size the clock is fitted to.
const SECONDS_PAD_SHARE = 0.18
const SECONDS_RADIUS_SHARE = 0.35
// Only used before the seconds' probe has reported (or if a platform reports nothing):
// roughly two digits and a line box, in shares of the seconds' font size.
const SECONDS_FALLBACK_WIDTH_SHARE = 1.3
const SECONDS_FALLBACK_HEIGHT_SHARE = 1.2
const PULSE_MIN_OPACITY = 0.2
const PULSE_HALF_PERIOD_MS = 1500

// Best-effort persist: a SecureStore failure keeps the choice for this session
// rather than throwing inside an effect.
const persistPref = (key, value) =>
  SecureStore.setItemAsync(key, JSON.stringify(value)).catch(() => {})

// Each digit font carries the weight it wants. iOS answers a `fontFamily` request
// with the face in that family whose weight is closest to the one asked for
// (RCTFontUtils.mm), so asking a family for a weight it does not have gets the next
// lightest face instead: Avenir's faces are Book/Medium/DemiBold/Heavy/Black and
// Snell Roundhand's are Regular/Bold/Black, which is why one shared semibold made
// both of them look thin. Families without an iOS face fall back to the Android
// family named beside them.
const FONTS = {
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

// Every face the app ships. Device availability is measured separately; this is the
// universe a stored selection is validated against.
const ALL_FONT_IDS = Object.keys(FONTS)

// Clock-face layout. The fitting box is the motion box (the clock screen as
// laid out, safe-area insets included) inset by a travel margin on each side,
// and that margin is nothing but a drift budget: the bounce runs off the
// measured digit box, so a drift extreme lands the digits' layout box flush
// on the edge of the motion box — every edge is reachable, whatever font is
// active and however long the string, and nothing is ever drawn past one.
// INK_SLACK keeps glyph ink — which in script faces can spill slightly past
// the advance box — inside the screen at that flush position. What the margin
// really decides is how big the text may get (the digits are never larger
// than the fitting box) and how far it drifts before bouncing, so it is kept
// deliberately small: legibility from a distance wins, travel just has to
// read as alive. Each axis takes TRAVEL_MARGIN_SHARE of itself, floored at
// TRAVEL_MARGIN_FLOOR so even the smallest window still visibly moves; the
// half-inch ceiling (80dp at the nominal 160dp per inch) only binds past
// ~1300dp, well beyond any phone. On the axis that caps the font the drift
// range is the margin itself, so a wall arrives every two-odd minutes at
// DRIFT_STEP per second; the roomier axis sweeps far longer — its range comes from
// the digit box, not the margin. Calm either way, and every edge is hit.
const EDGE_TRAVEL_MARGIN = 80
const TRAVEL_MARGIN_SHARE = 0.06
const TRAVEL_MARGIN_FLOOR = 24
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

// How far the clock moves per tick (one tick per second). A third of a dp keeps the
// drift below the threshold where the eye tracks it as movement — the digits read as
// resting in place while the composition slowly rearranges itself. Both axes use it,
// so the path stays diagonal however long each leg takes.
const DRIFT_STEP = 1 / 3

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
const MEASURED_FONT_IDS = ALL_FONT_IDS.filter((id) => !isDefaultFamilyFont(id))
const DECLARED_FONT_IDS = ALL_FONT_IDS.filter(isDefaultFamilyFont)

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

  const [xStep, setXStep] = useState(DRIFT_STEP)
  const [yStep, setYStep] = useState(DRIFT_STEP)

  const [xShift, setXShift] = useState(0)
  const [yShift, setYShift] = useState(0)

  const [hoursSounds, setHoursSounds] = useState()
  const [minutesSounds, setMinutesSounds] = useState()
  const [tickSound, setTickSound] = useState()

  // Which quarter hour was last chimed, as an index into QUARTER_MS; null until the
  // first tick records the current one, so launching mid-quarter stays silent. A
  // ref, not state: it must never re-render or batch with the clock itself.
  const lastChimedQuarter = useRef(null)

  // Whether the looping tick player is currently meant to be running. A ref because
  // it only exists to make the start/stop below edge-triggered: without it every
  // minute tick would pause, rewind and seek a player that is already stopped.
  const tickingRunning = useRef(false)

  const CHIMING_TIME_RANGE = 'chimingTimeRange'
  const [chimingTimeRange, setChimingTimeRange] = useState(null)

  // null means "not loaded from SecureStore yet"; renders fall back to the pool of
  // every font this device offers.
  const [digitFonts, setDigitFonts] = useState(null)
  // Today's draw as `{ id, date }`; null until loaded or drawn.
  const [dailyPick, setDailyPick] = useState(null)
  const [showSeconds, setShowSeconds] = useState(null)
  const [pulseSeparator, setPulseSeparator] = useState(null)
  // null until loaded, and treated as On while unloaded — the same default storage
  // gives a missing key — so the pill never shows Off for a value nobody chose.
  const [tickingSound, setTickingSound] = useState(null)
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
    ? ALL_FONT_IDS.filter((id) => availableFontIds.includes(id))
    : ALL_FONT_IDS

  // What the clock may draw, and what the picker shows as selected: the saved set
  // narrowed to this device, or every offered face when nothing valid is saved. A
  // single entry means that font always; several rotate at local midnight.
  const activePool = rotationPool(digitFonts, offeredFontIds)

  // Tapping off the last remaining face is refused rather than emptying the pool —
  // an empty selection has no honest rendering. Adding a face keeps `FONTS` order,
  // because `rotationPool` intersects over the offered list.
  const toggleFont = (id) => setDigitFonts(nextSelection(activePool, id))

  // Today's face, taken from the stored pick so a relaunch inside the same day
  // redraws what the user already saw. Until today's draw lands — first render, or
  // a selection that just changed — the pool's first entry draws, which keeps every
  // `FONTS` lookup honest without a second source of truth.
  let currentFontId = activePool.length > 0 ? activePool[0] : ALL_FONT_IDS[0]
  if (isTodayPick(dailyPick, currentTime) && activePool.includes(dailyPick.id))
    currentFontId = dailyPick.id

  // The font family and weight only; each user sets its own size.
  const fontSpecs = {
    fontWeight: FONTS[currentFontId].weight,
    ...FONTS[currentFontId].style,
  }

  // The separator needs its own element to breathe on its own, because nested Text
  // children cannot carry an Animated style. It stays at full opacity unless the
  // loop below is running.
  const separatorPulse = useRef(new Animated.Value(1)).current

  // Split out of the very string the hidden probe measures, so the fitted size and
  // the travel walls stay derived from the whole `h:mm`.
  const [hoursText, minutesText] = currentText.split(':')
  const secondsText = currentTime.format('ss')

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
    // `ascender` is the distance from the top of the line box down to the baseline,
    // which is what puts the seconds on the baseline rather than on the box floor.
    // A font that reports it outside its own line box is treated as not reporting
    // it at all, so the seconds fall back to the usual share instead of flying to
    // the top of the digits.
    setDigitMetrics({
      key: metricsKey,
      width: line.width,
      height: line.height,
      ascender:
        Number.isFinite(line.ascender) &&
        line.ascender > 0 &&
        line.ascender < line.height
          ? line.ascender
          : null,
    })
  }

  // The widest pair the seconds can ever show, measured once per font. The chip is a
  // fixed box on purpose: most of these faces have proportional digits, so a box that
  // hugs "07" and then "48" visibly twitches on every tick. Measuring "88" instead of
  // the current second fits any face and never moves while the clock runs.
  const [secondsMetrics, setSecondsMetrics] = useState(null)

  const onMeasureSeconds = ({ nativeEvent }) => {
    const [line] = nativeEvent.lines
    if (!line || !Number.isFinite(line.width) || !Number.isFinite(line.height))
      return
    if (secondsMetrics && secondsMetrics.key === currentFontId) return
    setSecondsMetrics({
      key: currentFontId,
      width: line.width,
      height: line.height,
    })
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

  // Shared by the three pieces of the clock row and the seconds overlay, so every
  // glyph on screen carries one colour and one font spec.
  const digitTextStyle = {
    ...fontSpecs,
    fontSize: digitFontSize,
    color: '#d0fcc5',
  }

  // How far the seconds sit up from the bottom of the box. The box is a whole line
  // box, and its floor is below the baseline by the font's descent — a fifth of a
  // 190dp face or more, which reads as the seconds floating away under the text.
  // Lifting them by that descent puts their floor on the baseline, hard against the
  // text (which is why they need the chip below), and the probe gives the real
  // ascender for the font actually drawing rather than a guess.
  const secondsBottomInset =
    digitMetrics && Number.isFinite(digitMetrics.ascender)
      ? Math.max(0, (digitMetrics.height - digitMetrics.ascender) * digitScale)
      : digitHeight * DESCENT_FALLBACK_SHARE

  // The chip the seconds are drawn in: a fixed box, so it never resizes with the
  // second being shown. Their corner of the digits' box can land on a minute glyph,
  // and the black fill is what keeps them readable there. Because the glyphs sit
  // centred in a box padded equally top and bottom, their line-box floor lands on the
  // digits' baseline when the chip's own bottom sits one pad below it.
  const secondsFontSize = digitFontSize * SECONDS_SCALE
  const secondsScale = secondsFontSize / MEASURE_SIZE
  const secondsPad = secondsFontSize * SECONDS_PAD_SHARE
  const secondsChipStyle = {
    position: 'absolute',
    right: 0,
    bottom: Math.max(0, secondsBottomInset - secondsPad * 0.5),
    width: secondsMetrics
      ? secondsMetrics.width * secondsScale + secondsPad * 2
      : secondsFontSize * SECONDS_FALLBACK_WIDTH_SHARE + secondsPad * 2,
    height: secondsMetrics
      ? secondsMetrics.height * secondsScale + secondsPad
      : secondsFontSize * SECONDS_FALLBACK_HEIGHT_SHARE + secondsPad,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SECONDS_CHIP_FILL,
    borderRadius: secondsFontSize * SECONDS_RADIUS_SHARE,
  }

  const secondsTextStyle = {
    ...digitTextStyle,
    fontSize: secondsFontSize,
    // The box is sized from the widest pair, so this row never needs to give any of
    // its width away; shrinking it would ellipsize a second instead of overflowing.
    flexShrink: 0,
  }

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

  const initTickingPref = async () => {
    try {
      const saved = await SecureStore.getItemAsync(TICKING_SOUND_KEY)
      const stored = saved === null ? null : JSON.parse(saved)
      // Anything other than an explicit `false` — a key never written, or a value this
      // version does not recognise — means On.
      setTickingSound(stored !== false)
    } catch {
      // Unreadable: leave it unloaded, which renders and sounds as On, and the save
      // effect below skips it so a bad read cannot overwrite an intact value.
    }
  }

  const initDigitFontPrefs = async () => {
    // Only successful reads write state. A corrupt or unreadable stored value
    // leaves prefs null (renders as every offered font) and is never written back
    // over, so a transient SecureStore failure can't destroy intact prefs.
    try {
      // The saved set wins; a single legacy face becomes a one-element set; a value
      // the app no longer ships — the old "default" included — is dropped, and an
      // install with nothing usable starts on every font it offers.
      setDigitFonts(
        resolveSelectedFonts({
          saved: JSON.parse(await SecureStore.getItemAsync(DIGIT_FONTS_KEY)),
          legacyFontId: JSON.parse(
            await SecureStore.getItemAsync(LEGACY_DIGIT_FONT_KEY),
          ),
          allIds: ALL_FONT_IDS,
        }),
      )

      const savedPick = JSON.parse(
        await SecureStore.getItemAsync(DAILY_PICK_KEY),
      )
      // Whether that pick is still today's, and still selectable, belongs to the
      // effect that owns drawing; here it only has to be well-formed.
      if (
        savedPick &&
        typeof savedPick.date === 'string' &&
        FONTS[savedPick.id]
      )
        setDailyPick(savedPick)

      setShowSeconds(
        JSON.parse(await SecureStore.getItemAsync(SHOW_SECONDS_KEY)) === true,
      )
      setPulseSeparator(
        JSON.parse(await SecureStore.getItemAsync(PULSE_SEPARATOR_KEY)) ===
          true,
      )

      // Both legacy keys are gone from the app: drop them so an upgrade leaves no
      // dead values behind.
      SecureStore.deleteItemAsync(LEGACY_DIGIT_FONT_KEY).catch(() => {})
      SecureStore.deleteItemAsync(LEGACY_RANDOM_DAILY_KEY).catch(() => {})
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
    // Looping, but deliberately not started here: the gate below owns the first start,
    // so nothing sounds before the preference and the time range are known.
    tick.loop = true
  }

  useEffect(() => {
    ;(async () => {
      await setAudioModeAsync({ playsInSilentMode: true })
      await initChimingTime()
      await initTickingPref()
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
      if (shift + step >= range) return [-DRIFT_STEP, range]
      if (shift + step <= -range) return [DRIFT_STEP, -range]
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

  // One face per local day, never the one the day before showed. Runs on every tick
  // so midnight is caught while the app stays open, and whenever the selection or
  // the device's font list settles; the guard makes all other ticks a no-op. A
  // selection that no longer contains today's face redraws at once, so the drawn
  // font is always one the picker offers as selected.
  useEffect(() => {
    if (!digitFonts) return
    const pool = rotationPool(digitFonts, offeredFontIds)
    if (pool.length === 0) return
    if (isTodayPick(dailyPick, currentTime) && pool.includes(dailyPick.id))
      return
    setDailyPick({
      id: drawDailyFont(pool, dailyPick ? dailyPick.id : null),
      date: todayKey(currentTime),
    })
  }, [currentTime, digitFonts, offeredFontIds, dailyPick])

  // The separator's breath: half a cycle down to PULSE_MIN_OPACITY, half back up,
  // entirely on the native thread so the fade costs no re-render. It runs only while
  // the clock is actually showing and the option is on — otherwise the value is put
  // back at full opacity, so switching it off leaves a steady colon rather than
  // freezing mid-breath or animating an unmounted view.
  useEffect(() => {
    if (pulseSeparator !== true || firstScreen) {
      separatorPulse.setValue(1)
      return undefined
    }
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(separatorPulse, {
          toValue: PULSE_MIN_OPACITY,
          duration: PULSE_HALF_PERIOD_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(separatorPulse, {
          toValue: 1,
          duration: PULSE_HALF_PERIOD_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    breath.start()
    return () => breath.stop()
  }, [pulseSeparator, firstScreen, separatorPulse])

  // The bells' quiet-hours rule, delegated to the shared module so the ticking cannot
  // drift into disagreeing with it about which hours are active.
  const isSoundEnabled = () =>
    isHourInActiveRange(dayjs(currentTime).hour(), chimingTimeRange)

  // The tick's own switch sits on top of that window: preference first, then hours.
  // Off stops the looping player instead of muting it — a muted loop keeps decoding
  // all day — and rewinding on the way out means the next start begins at the top of
  // the clip rather than half-way through a "tick". The ref makes this edge-triggered,
  // so the minute tick that calls it as hours pass by costs nothing when nothing
  // changed.
  const resetTicking = () => {
    if (!tickSound) return
    const audible = isTickingAudible({
      enabled: tickingSound,
      hour: dayjs(currentTime).hour(),
      range: chimingTimeRange,
    })
    if (audible === tickingRunning.current) return
    tickingRunning.current = audible
    if (audible) {
      tickSound.play()
    } else {
      tickSound.pause()
      tickSound.seekTo(0).catch(() => {})
    }
  }

  useEffect(() => {
    if (chimingTimeRange) {
      SecureStore.setItemAsync(
        CHIMING_TIME_RANGE,
        JSON.stringify(chimingTimeRange),
      )
    }
  }, [chimingTimeRange])

  // The tick follows its switch, the active range and the player arriving. A tap on
  // the pill gets through here; hour boundaries get through on the minute tick below.
  useEffect(() => {
    resetTicking()
  }, [tickSound, tickingSound, chimingTimeRange])

  useEffect(() => {
    if (digitFonts) persistPref(DIGIT_FONTS_KEY, digitFonts)
  }, [digitFonts])

  useEffect(() => {
    if (dailyPick) persistPref(DAILY_PICK_KEY, dailyPick)
  }, [dailyPick])

  useEffect(() => {
    if (showSeconds !== null) persistPref(SHOW_SECONDS_KEY, showSeconds)
  }, [showSeconds])

  useEffect(() => {
    if (pulseSeparator !== null)
      persistPref(PULSE_SEPARATOR_KEY, pulseSeparator)
  }, [pulseSeparator])

  // Guarded on the loaded state like its siblings: while the read is outstanding — or
  // if it failed — nothing is written, so a default can never overwrite a stored one.
  useEffect(() => {
    if (tickingSound !== null) persistPref(TICKING_SOUND_KEY, tickingSound)
  }, [tickingSound])

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

  // The minute tick is what notices an hour crossing the edge of the active range while
  // the app sits open; the gate itself no-ops unless something actually changed.
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
          {/* The one action on this screen, so it is the only thing wearing the
              clock's own colour: everything else is black-on-white, and this is
              white-on-clock-green, larger than any other control, and lifted. The
              hairline keeps the green defined against a white background instead of
              glowing into it. */}
          <Pressable
            onPress={() => setFirstScreen(false)}
            style={{
              alignSelf: 'center',
              alignItems: 'center',
              marginVertical: 16,
              paddingVertical: 26,
              paddingHorizontal: 52,
              borderRadius: 16,
              elevation: 12,
              borderWidth: 1,
              borderColor: '#080E1D',
              backgroundColor: '#d0fcc5',
            }}
          >
            <Text
              style={{ fontWeight: '800', fontSize: 26, color: '#080E1D' }}
            >{`Show the clock`}</Text>
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
              Digit fonts
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
                  onPress={() => toggleFont(id)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    margin: 4,
                    borderRadius: 10,
                    elevation: 5,
                    borderWidth: 1,
                    borderColor: 'black',
                    backgroundColor: activePool.includes(id)
                      ? 'black'
                      : 'white',
                  }}
                >
                  <Text
                    style={{
                      fontWeight: FONTS[id].weight,
                      ...FONTS[id].style,
                      fontSize: 16,
                      color: activePool.includes(id) ? 'white' : 'black',
                    }}
                  >
                    {FONTS[id].label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {/* Says what the selection actually does, so the rotation is never a
                surprise and tapping the last face off (which does nothing) has an
                explanation next to it. */}
            <Text
              style={{
                paddingTop: 4,
                fontSize: 14,
                textAlign: 'center',
                color: '#444444',
              }}
            >
              {activePool.length > 1
                ? `rotates daily through ${activePool.length} selected`
                : 'always this font'}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: 12,
              }}
            >
              {[
                {
                  label: 'Show seconds',
                  value: showSeconds === true,
                  onToggle: () => setShowSeconds(showSeconds !== true),
                },
                {
                  label: 'Pulsing separator',
                  value: pulseSeparator === true,
                  onToggle: () => setPulseSeparator(pulseSeparator !== true),
                },
                // The one sound control in this row. It reads On while its value is
                // still loading, matching the default and the gate that drives the
                // player, and tapping it then turns the tick off rather than on.
                {
                  label: 'Ticking sound',
                  value: tickingSound !== false,
                  onToggle: () => setTickingSound(tickingSound === false),
                },
              ].map(({ label, value, onToggle }) => (
                <Pressable
                  key={label}
                  onPress={onToggle}
                  style={{
                    margin: 4,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    elevation: 5,
                    borderWidth: 1,
                    borderColor: 'black',
                    backgroundColor: value ? 'black' : 'white',
                  }}
                >
                  <Text
                    style={{
                      fontWeight: '600',
                      fontSize: 16,
                      color: value ? 'white' : 'black',
                    }}
                  >
                    {`${label}: ${value ? 'On' : 'Off'}`}
                  </Text>
                </Pressable>
              ))}
            </View>
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
      {/* Second hidden probe: the widest pair the seconds can show. It is reported once
          per font rather than per second, which is what lets their chip be a fixed box
          that fits any face without twitching on every tick. Mounted whether or not the
          seconds are on, so switching them on never starts from a guess. */}
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
        onTextLayout={onMeasureSeconds}
      >
        {'88'}
      </Text>
      {/* The digits live in one box placed exactly where the single Text used to
          go and sized from the measured line, so the centring and the travel walls
          are unchanged. Inside it the separator is its own Animated.Text — nested
          Text children cannot carry an animated opacity — and the optional seconds
          sit at the bottom-right in a fixed-size chip with a half-transparent fill,
          lifted up onto the digits' baseline so they hug the text and stay readable
          where they overlap a digit. This lets them drift with the digits for free
          and keeps them out of the measurement that sets the size.
          flexShrink 0 stops Yoga from shaving a piece off the row if splitting it
          renders a hair wider than the measured advance; numberOfLines stays the
          wrap backstop, and justifyContent keeps the row centred on the same point
          whether it comes out a pixel narrower or wider. */}
      <View
        style={{
          position: 'absolute',
          left:
            insets.left + (motionBox.width - digitWidth) / 2 + clampedXShift,
          top:
            insets.top + (motionBox.height - digitHeight) / 2 + clampedYShift,
          width: digitWidth,
          height: digitHeight,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'baseline',
          }}
        >
          <Text numberOfLines={1} style={[digitTextStyle, { flexShrink: 0 }]}>
            {hoursText}
          </Text>
          <Animated.Text
            numberOfLines={1}
            style={[digitTextStyle, { flexShrink: 0, opacity: separatorPulse }]}
          >
            {':'}
          </Animated.Text>
          <Text numberOfLines={1} style={[digitTextStyle, { flexShrink: 0 }]}>
            {minutesText}
          </Text>
        </View>
        {showSeconds === true && (
          <View style={secondsChipStyle}>
            <Text numberOfLines={1} style={secondsTextStyle}>
              {secondsText}
            </Text>
          </View>
        )}
      </View>
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
