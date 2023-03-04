import { useEffect, useState, useContext } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useKeepAwake } from "expo-keep-awake"
import { Audio } from "expo-av"

import dayjs from "dayjs"

const hoursSounds = {
  1: require("./assets/hour1.m4a"),
  2: require("./assets/hour2.m4a"),
  3: require("./assets/hour3.m4a"),
  4: require("./assets/hour4.m4a"),
  5: require("./assets/hour5.m4a"),
  6: require("./assets/hour6.m4a"),
  7: require("./assets/hour7.m4a"),
  8: require("./assets/hour8.m4a"),
  9: require("./assets/hour9.m4a"),
  10: require("./assets/hour10.m4a"),
  11: require("./assets/hour11.m4a"),
  12: require("./assets/hour12.m4a"),
}
const minutesSounds = {
  15: require("./assets/minute15.m4a"),
  30: require("./assets/minute30.m4a"),
  45: require("./assets/minute45.m4a"),
}

export default function App() {
  useKeepAwake()
  const { height, width, scale, fontScale } = useWindowDimensions()

  const [currentTime, setCurrentTime] = useState(Date.now())
  const [currentMinute, setCurrentMinute] = useState()

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
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
    // console.log({ currentMinute })
    switch (currentMinute) {
      case 0:
        play(0)
        break
      case 15:
        play(15)
        break
      case 30:
        play(30)
        break
      case 45:
        play(45)
        break
    }
  }, [currentMinute])

  const play = async (minute) => {
    if (minute === 0) {
      const hour = dayjs(currentTime).hour()
      const { sound } = await Audio.Sound.createAsync(hoursSounds[hour])
      await sound.playAsync()
      await sound.unloadAsync()
    } else {
      const { sound } = await Audio.Sound.createAsync(minutesSounds[minute])
      await sound.playAsync()
      await sound.unloadAsync()
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
