import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

// 앱이 포그라운드에 떠 있을 때도 알림 배너를 보여준다
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// 알림을 탭했을 때 어디로 이동할지 구분하기 위한 타입
export type NotificationData =
  | { type: 'event'; id: string }
  | { type: 'date_idea'; id: string }
  | { type: 'reel'; id: string }
  | { type: 'chat' }

// 권한 요청 + Expo 푸시 토큰 발급 (시뮬레이터/거부 시 null)
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return null

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    return token
  } catch {
    return null
  }
}

// 상대방에게 푸시 알림 전송 (Expo 푸시 API 직접 호출 — 실패해도 앱 동작에 영향 없도록 무시)
export async function sendPushNotification(pushToken: string, title: string, body: string, data: NotificationData) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: pushToken, sound: 'default', title, body, data }),
    })
  } catch {
    // no-op
  }
}

// 알림 데이터로 이동할 라우트 경로 계산
export function resolveNotificationRoute(data: any): string | null {
  if (!data?.type) return null
  switch (data.type) {
    case 'event': return `/event/${data.id}`
    case 'date_idea': return `/dates?openId=${data.id}`
    case 'reel': return `/dates?openId=${data.id}&openReel=1`
    case 'chat': return `/chat`
    default: return null
  }
}
