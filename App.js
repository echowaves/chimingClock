import { useEffect, useState, useContext } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useKeepAwake } from "expo-keep-awake"
import { Audio } from "expo-av"

import dayjs from "dayjs"

export default function App() {
  useKeepAwake()
  const { height, width, scale, fontScale } = useWindowDimensions()

  const [currentTime, setCurrentTime] = useState(dayjs())
  const [currentMinute, setCurrentMinute] = useState()

  const [hoursSounds, setHoursSounds] = useState()
  const [minutesSounds, setMinutesSounds] = useState()

  const init = async () => {
    const hours = new Map()
    hours.set(0, await Audio.Sound.createAsync(require("./assets/hour0.mp3")))
    hours.set(1, await Audio.Sound.createAsync(require("./assets/hour1.mp3")))
    hours.set(2, await Audio.Sound.createAsync(require("./assets/hour2.mp3")))
    hours.set(3, await Audio.Sound.createAsync(require("./assets/hour3.mp3")))
    hours.set(4, await Audio.Sound.createAsync(require("./assets/hour4.mp3")))
    hours.set(5, await Audio.Sound.createAsync(require("./assets/hour5.mp3")))
    hours.set(6, await Audio.Sound.createAsync(require("./assets/hour6.mp3")))
    hours.set(7, await Audio.Sound.createAsync(require("./assets/hour7.mp3")))
    hours.set(8, await Audio.Sound.createAsync(require("./assets/hour8.mp3")))
    hours.set(9, await Audio.Sound.createAsync(require("./assets/hour9.mp3")))
    hours.set(10, await Audio.Sound.createAsync(require("./assets/hour10.mp3")))
    hours.set(11, await Audio.Sound.createAsync(require("./assets/hour11.mp3")))

    const minutes = new Map()
    minutes.set(
      15,
      await Audio.Sound.createAsync(require("./assets/minute15.mp3")),
    )
    minutes.set(
      30,
      await Audio.Sound.createAsync(require("./assets/minute30.mp3")),
    )
    minutes.set(
      45,
      await Audio.Sound.createAsync(require("./assets/minute45.mp3")),
    )

    setHoursSounds(hours)
    setMinutesSounds(minutes)

    const { sound } = await Audio.Sound.createAsync(
      require("./assets/ticktack.mp3"),
    )
    //  await sound.setIsLooping(true)
    await sound.playAsync()
    await sound.setIsLoopingAsync(true)
    // await sound.unloadAsync()
  }

  useEffect(() => {
    ;(async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      await init()
    })()

    const interval = setInterval(() => setCurrentTime(dayjs()), 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const minute = dayjs(currentTime).minute()

    if (currentMinute !== minute) {
      setCurrentMinute(minute)
    }
  }, [currentTime])

  useEffect(() => {
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

  const play = async (minute) => {
    // console.log({ minute })
    const { sound } =
      minute === 0
        ? hoursSounds.get(dayjs(currentTime).hour() % 12)
        : minutesSounds.get(minute)

    await sound.setPositionAsync(0)
    await sound.playAsync()
    // await sound.unloadAsync()
  }

  const styles = StyleSheet.create({
    container: {
      backgroundColor: "black",
      alignItems: "center",
      justifyContent: "center",
      width: "100%", // Change width to '100%'
      height: "100%", // Change height to '100%'
      // paddingHorizontal: 36,
      // paddingVertical: 36,
    },
    time: {
      color: "#d0fcc5",
      fontSize: width / 3 / fontScale, // divide the font size by the font scale
      fontWeight: "600",
    },
  })

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{dayjs(currentTime).format("hh:mm")}</Text>
    </View>
  )
}
