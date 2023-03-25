/* eslint-disable global-require */
import { useEffect, useState, useCallback } from 'react'
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
} from 'react-native'

import { useKeepAwake } from 'expo-keep-awake'
import { StatusBar } from 'expo-status-bar'

import { Audio } from 'expo-av'

import dayjs from 'dayjs'

import * as SecureStore from 'expo-secure-store'

import MultiSlider from '@ptomasroos/react-native-multi-slider'

export default function App() {
  useKeepAwake()
  const { height, width } = useWindowDimensions()
  const fontSize = width / 3

  const fontSpecs = {
    // fontFamily: 'undefined',
    // fontStyle: 'italic',
    fontSize,
    // fontWeight: '600',
    // width,
  }

  const [firstScreen, setFirstScreen] = useState(true)

  const [currentTime, setCurrentTime] = useState(dayjs())

  const [currentMinute, setCurrentMinute] = useState()

  const [currentText, setCurrentText] = useState('')
  const [topShift, setTopShift] = useState(0)
  const [leftShift, setLeftShift] = useState(0)
  const [textWidth, setTextWidth] = useState(0)
  const [textHeight, setTextHeight] = useState(0)

  const [hoursSounds, setHoursSounds] = useState()
  const [minutesSounds, setMinutesSounds] = useState()
  const [tickSound, setTickSound] = useState()

  const CHIMING_TIME_RANGE = 'chimingTimeRange'
  const [chimingTimeRange, setChimingTimeRange] = useState(null)

  const initChimingTime = async () => {
    setChimingTimeRange(
      JSON.parse(await SecureStore.getItemAsync(CHIMING_TIME_RANGE)) || {
        min: 0,
        max: 24,
      },
    )
  }

  const initSounds = async () => {
    const hours = new Map()
    hours.set(0, await Audio.Sound.createAsync(require('./assets/hour0.mp3')))
    hours.set(1, await Audio.Sound.createAsync(require('./assets/hour1.mp3')))
    hours.set(2, await Audio.Sound.createAsync(require('./assets/hour2.mp3')))
    hours.set(3, await Audio.Sound.createAsync(require('./assets/hour3.mp3')))
    hours.set(4, await Audio.Sound.createAsync(require('./assets/hour4.mp3')))
    hours.set(5, await Audio.Sound.createAsync(require('./assets/hour5.mp3')))
    hours.set(6, await Audio.Sound.createAsync(require('./assets/hour6.mp3')))
    hours.set(7, await Audio.Sound.createAsync(require('./assets/hour7.mp3')))
    hours.set(8, await Audio.Sound.createAsync(require('./assets/hour8.mp3')))
    hours.set(9, await Audio.Sound.createAsync(require('./assets/hour9.mp3')))
    hours.set(10, await Audio.Sound.createAsync(require('./assets/hour10.mp3')))
    hours.set(11, await Audio.Sound.createAsync(require('./assets/hour11.mp3')))

    const minutes = new Map()
    minutes.set(
      15,
      await Audio.Sound.createAsync(require('./assets/minute15.mp3')),
    )
    minutes.set(
      30,
      await Audio.Sound.createAsync(require('./assets/minute30.mp3')),
    )
    minutes.set(
      45,
      await Audio.Sound.createAsync(require('./assets/minute45.mp3')),
    )

    setHoursSounds(hours)
    setMinutesSounds(minutes)

    const { sound } = await Audio.Sound.createAsync(
      require('./assets/ticktack.mp3'),
    )
    setTickSound(sound)
    //  await sound.setIsLooping(true)
    await sound.playAsync()
    await sound.setIsLoopingAsync(true)
    // await sound.unloadAsync()
  }

  useEffect(() => {
    ;(async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      await initChimingTime()
      await initSounds()
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

    if (currentMinute !== minute) {
      setCurrentMinute(minute)
      const text = dayjs(currentTime).format('hh:mm')
      setCurrentText(text)
      if (textHeight)
        setTopShift(
          height / 2 -
            textHeight / 2 +
            Math.floor(Math.random() * (textHeight / 2)) -
            textHeight / 4,
        )
      if (textWidth)
        setLeftShift(
          width / 2 -
            textWidth / 2 +
            Math.floor(Math.random() * (textWidth / 4)) -
            textWidth / 8,
        )
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

  const resetTicking = async () => {
    await tickSound?.setVolumeAsync(isSoundEnabled() ? 1 : 0)
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

  const play = async (minute) => {
    // console.log({ minute })
    const { sound } =
      minute === 0
        ? hoursSounds.get(dayjs(currentTime).hour() % 12)
        : minutesSounds.get(minute)

    await sound.setPositionAsync(0)
    await sound.setVolumeAsync(isSoundEnabled() ? 1 : 0)
    await sound.playAsync()
    // await sound.unloadAsync()
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

  // const renderThumb = useCallback((name) => <Thumb name={name} />, [])

  const onLayout = (event) => {
    // const { x, y } = event.nativeEvent.layout
    // setCurrentTextSize({
    setTextWidth(event.nativeEvent.layout.width)
    setTextHeight(event.nativeEvent.layout.height)
  }

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
        <Text
          style={{
            ...fontSpecs,
            color: '#d0fcc5',
            position: 'absolute',
            top: topShift,
            left: leftShift,
          }}
          onLayout={onLayout}
        >
          {currentText}
        </Text>
        <StatusBar hidden={true} />
      </Pressable>
    </SafeAreaView>
  )
}
