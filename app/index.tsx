import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Image, StyleSheet } from 'react-native'
import { useAuthStore, useCoupleStore } from '../src/store'

export default function Index() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const { couple, loadCouple } = useCoupleStore()
  const [coupleChecked, setCoupleChecked] = useState(false)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return
    loadCouple(user.id).finally(() => setCoupleChecked(true))
  }, [isAuthenticated, isLoading, user])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (!coupleChecked) return
    if (!couple) {
      router.replace('/couple-connect')
    } else {
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, isLoading, coupleChecked, couple])

  return (
    <View style={styles.container}>
      <Image source={require('../src/assets/splash.png')} style={styles.image} resizeMode="cover" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  image: { flex: 1, width: '100%', height: '100%' },
})
