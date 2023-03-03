import { useEffect, useState, useContext } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useKeepAwake } from "expo-keep-awake"

import dayjs from "dayjs"

export default function App() {
  useKeepAwake()
  const { height, width, scale, fontScale } = useWindowDimensions()

  const [currentTime, setCurrentTime] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    // console.log({ currentTime })
  }, [currentTime])

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
