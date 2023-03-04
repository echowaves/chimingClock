import { useEffect, useState, useContext } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useKeepAwake } from "expo-keep-awake"
import { Audio } from "expo-av"

import dayjs from "dayjs"

const hoursSounds = new Map([
  [0, require("./assets/hour0.mp3")],
  [1, require("./assets/hour1.mp3")],
  [2, require("./assets/hour2.mp3")],
  [3, require("./assets/hour3.mp3")],
  [4, require("./assets/hour4.mp3")],
  [5, require("./assets/hour5.mp3")],
  [6, require("./assets/hour6.mp3")],
  [7, require("./assets/hour7.mp3")],
  [8, require("./assets/hour8.mp3")],
  [9, require("./assets/hour9.mp3")],
  [10, require("./assets/hour10.mp3")],
  [11, require("./assets/hour11.mp3")],
])

const minutesSounds = new Map([
  [15, require("./assets/minute15.mp3")],
  [30, require("./assets/minute30.mp3")],
  [45, require("./assets/minute45.mp3")],
])

export default function App() {
  useKeepAwake()
  const { height, width, scale, fontScale } = useWindowDimensions()

  const [currentTime, setCurrentTime] = useState(dayjs())
  const [currentMinute, setCurrentMinute] = useState()

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(dayjs()), 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    console.log({ currentTime })

    const minute = dayjs(currentTime).minute()

    if (currentMinute !== minute) {
      setCurrentMinute(minute)
    }
  }, [currentTime])

  useEffect(() => {
    // console.log({ currentMinute })
    if (
      currentMinute === 0 ||
      currentMinute === 15 ||
      currentMinute === 30 ||
      currentMinute === 45
    ) {
      play(currentMinute)
    }
  }, [currentMinute])

  const play = async (minute) => {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })

    if (minute === 0) {
      const hour = dayjs(currentTime).hour() % 12
      console.log({ hour, sound: hoursSounds.get(hour) })
      const { sound } = await Audio.Sound.createAsync(hoursSounds.get(hour))
      await sound.playAsync()
      // await sound.unloadAsync()
    } else {
      console.log({ minute, sound: minutesSounds.get(minute) })
      const { sound } = await Audio.Sound.createAsync(minutesSounds.get(minute))
      await sound.playAsync()
      // await sound.unloadAsync()
    }
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
      // paddingHorizontal: 36,
      // paddingVertical: 36,
      // alignItems: "center",

      // width: "100%", // Change width to '100%'
      // height: "100%", // Change height to '100%'
    },
  })

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{dayjs(currentTime).format("hh:mm")}</Text>
    </View>
  )
}
