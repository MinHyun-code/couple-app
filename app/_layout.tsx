import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts } from 'expo-font'
import * as Notifications from 'expo-notifications'
import { supabase } from '../src/lib/supabase'
import { useAuthStore, useCoupleStore } from '../src/store'
import { userApi } from '../src/lib/api'
import { registerForPushNotificationsAsync, resolveNotificationRoute } from '../src/lib/notifications'

// 로그인한 유저의 Expo 푸시 토큰을 발급받아 DB에 최신 상태로 저장 (기기/앱 재설치 시 토큰이 바뀔 수 있음)
async function syncPushToken(userId: string, currentToken?: string | null) {
  const token = await registerForPushNotificationsAsync()
  if (token && token !== currentToken) {
    try { await userApi.updateProfile(userId, { push_token: token }) } catch {}
  }
}

export default function RootLayout() {
  const { setUser } = useAuthStore()
  const { loadCouple } = useCoupleStore()
  const router = useRouter()

  useFonts({
    PretendardVariable: require('../assets/fonts/PretendardVariable.ttf'),
    Jalnan2: require('../assets/fonts/Jalnan2TTF.ttf'),
  })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          let profile = await userApi.getProfile(session.user.id)
          if (!profile) {
            const name = (session.user.user_metadata?.full_name as string | undefined) ?? null
            profile = await userApi.createProfile(session.user.id, session.user.email!, name)
          }
          setUser(profile)
          await loadCouple(session.user.id)
          syncPushToken(profile.id, profile.push_token)
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        useCoupleStore.getState().reset()
      }
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          let profile = await userApi.getProfile(session.user.id)
          if (!profile) {
            const name = (session.user.user_metadata?.full_name as string | undefined) ?? null
            profile = await userApi.createProfile(session.user.id, session.user.email!, name)
          }
          setUser(profile)
          await loadCouple(session.user.id)
          syncPushToken(profile.id, profile.push_token)
        } catch {
          setUser(null)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 알림을 탭해서 앱을 열었을 때 해당 화면으로 이동
  useEffect(() => {
    const goToNotification = (data: unknown) => {
      const route = resolveNotificationRoute(data)
      if (route) setTimeout(() => router.push(route as any), 300)
    }

    // 앱이 완전히 종료된 상태에서 알림을 탭해 콜드 스타트로 열린 경우
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) goToNotification(response.notification.request.content.data)
    })

    // 앱이 백그라운드/포그라운드에 떠 있는 상태에서 알림을 탭한 경우
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      goToNotification(response.notification.request.content.data)
    })

    return () => subscription.remove()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="couple-connect" />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="media/[eventId]" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </GestureHandlerRootView>
  )
}
