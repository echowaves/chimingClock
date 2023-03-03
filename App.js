import { useEffect, useState, useContext } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useKeepAwake } from "expo-keep-awake"

import dayjs from "dayjs"

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

  const play = (minute) => {
    
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
