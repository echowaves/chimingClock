/* eslint-disable global-require */
import { useEffect, useState } from 'react'
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import 'react-native-gesture-handler'

import { useKeepAwake } from 'expo-keep-awake'
import { StatusBar } from 'expo-status-bar'

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'

import dayjs from 'dayjs'

import * as SecureStore from 'expo-secure-store'

import MultiSlider from '@ptomasroos/react-native-multi-slider'

const DIGIT_FONT_KEY = 'digitFont'
const RANDOM_DAILY_KEY = 'randomDaily'
const DEFAULT_FONT = 'default'

const FONTS = {
  default: { label: 'Default', style: {} },
  serif: {
    label: 'Serif',
    style: Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      default: { fontFamily: 'Georgia' },
    }),
  },
  mono: {
    label: 'Mono',
    style: Platform.select({
      ios: { fontFamily: 'Menlo' },
      android: { fontFamily: 'monospace' },
      default: { fontFamily: 'Menlo' },
    }),
  },
  rounded: {
    label: 'Rounded',
    style: Platform.select({
      ios: { fontFamily: 'Avenir' },
      android: { fontFamily: 'sans-serif' },
      default: { fontFamily: 'Avenir' },
    }),
  },
  script: {
    label: 'Script',
    style: Platform.select({
      ios: { fontFamily: 'Snell Roundhand' },
      android: { fontFamily: 'cursive' },
      default: { fontFamily: 'Snell Roundhand' },
    }),
  },
}

// Daily mode picks among these only, so "surprise me" never shows the default
// look. Derived from FONTS so a font can never be in one list but not the other.
const DAILY_FONT_POOL = Object.keys(FONTS).filter((id) => id !== DEFAULT_FONT)

// Pure helpers (no state): the same local date always derives the same font id.
const dayOfYear = (now) => now.startOf('day').diff(now.startOf('year'), 'day')

const dailyFontId = (now) =>
  DAILY_FONT_POOL[dayOfYear(now) % DAILY_FONT_POOL.length]

const normalizeFontId = (id) => (FONTS[id] ? id : DEFAULT_FONT)

const activeFontId = (randomDaily, digitFont, now) =>
  normalizeFontId(randomDaily === true ? dailyFontId(now) : digitFont)

// Clock-face layout. The digits wander by roughly DRIFT_RANGE on each axis (the
// stepper overshoots by two pixels before it reverses), and the fitting box is
// the window inset by that range plus FIT_PADDING, which absorbs the overshoot.
// Nothing is drawn outside the box, so the clock stays inside the window at
// every point of the drift, whatever font is active and however long the string.
const DRIFT_RANGE = 55
const FIT_PADDING = 8

// The digits are measured once per font + time string at this small size. Text
// metrics scale linearly with font size, so one measurement gives exactly the
// largest size that fits the box. A five-glyph time is ~120px wide here, far
// inside even a narrow window, so the probe never wraps and can be trusted.
const MEASURE_SIZE = 40

export default function App() {
  useKeepAwake()
  const { height, width } = useWindowDimensions()
  // Ceiling for the digits. The size actually used is the smaller of this and
  // what the fitting box allows, so a clock that already fits keeps today's look.
  const maxFontSize = width / 3
  const fitWidth = Math.max(1, width - 2 * (DRIFT_RANGE + FIT_PADDING))
  const fitHeight = Math.max(1, height - 2 * (DRIFT_RANGE + FIT_PADDING))

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

  const CHIMING_TIME_RANGE = 'chimingTimeRange'
  const [chimingTimeRange, setChimingTimeRange] = useState(null)

  // null means "not loaded from SecureStore yet"; renders fall back to default.
  const [digitFont, setDigitFont] = useState(null)
  const [randomDaily, setRandomDaily] = useState(null)
  // Until the prefs load finishes, the font controls are shown but inert, so a
  // early tap can't be clobbered by (or clobber) the values init is reading.
  const [fontPrefsLoaded, setFontPrefsLoaded] = useState(false)

  // Recomputed on each render (the clock ticks every second), so a new local
  // date picks up the new daily font without extra state or timers.
  const currentFontId = activeFontId(randomDaily, digitFont, currentTime)

  const fontSpecs = {
    // fontFamily: 'undefined',
    // fontStyle: 'italic',
    fontSize: maxFontSize,
    fontWeight: '600',
    // width,
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
  // gives the largest size whose digits still fit the box along each axis. While a
  // new font or time string is being measured the previous metrics keep drawing —
  // closer than flashing back to the ceiling. Before anything is measured, assume
  // the digits fill the fitting box.
  const fittedFontSize = digitMetrics
    ? Math.min(
        maxFontSize,
        (fitWidth * MEASURE_SIZE) / digitMetrics.width,
        (fitHeight * MEASURE_SIZE) / digitMetrics.height,
      )
    : maxFontSize
  const digitFontSize =
    Number.isFinite(fittedFontSize) && fittedFontSize > 0
      ? fittedFontSize
      : maxFontSize
  const digitScale = digitFontSize / MEASURE_SIZE
  // Centring uses the measured box, so the clock stays in the middle of the
  // window on both platforms — textAlignVertical would only do it on Android.
  const digitWidth = digitMetrics ? digitMetrics.width * digitScale : fitWidth
  const digitHeight = digitMetrics
    ? digitMetrics.height * digitScale
    : fitHeight

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

    // essential, this will shift direction eventually
    if (xShift >= DRIFT_RANGE) setXStep(-1)
    if (xShift < -DRIFT_RANGE) setXStep(1)
    if (yShift > DRIFT_RANGE) setYStep(-1)
    if (yShift < -DRIFT_RANGE) setYStep(1)

    setXShift(xShift + xStep)
    setYShift(yShift + yStep)

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

  const play = async (minute) => {
    // console.log({ minute })
    const player =
      minute === 0
        ? hoursSounds.get(dayjs(currentTime).hour() % 12)
        : minutesSounds.get(minute)

    player.seekTo(0)
    player.volume = isSoundEnabled() ? 1 : 0
    player.play()
  }

  useEffect(() => {
    resetTicking()
    if (
      (currentMinute === 0 ||
        currentMinute === 15 ||
        currentMinute === 30 ||
        currentMinute === 45) &&
      minutesSounds
    ) {
      play(currentMinute)
    }
  }, [currentMinute])

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
  })

  if (firstScreen)
    return (
      <SafeAreaView style={styles.firstScreen}>
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
            {Object.keys(FONTS).map((id) => (
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
                    ...FONTS[id].style,
                    fontWeight: '600',
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
      </SafeAreaView>
    )
  // console.log({ width })
  return (
    <SafeAreaView style={{ backgroundColor: 'black' }}>
      <Pressable
        style={{
          backgroundColor: 'black',
          alignItems: 'center',
          justifyContent: 'center',
          width, // Change width to '100%'
          height, // Change height to '100%'
        }}
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
            left: (width - digitWidth) / 2 + xShift,
            top: (height - digitHeight) / 2 + yShift,
          }}
        >
          {currentText}
        </Text>
        <StatusBar hidden={true} />
      </Pressable>
    </SafeAreaView>
  )
}
