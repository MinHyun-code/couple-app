import React from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ExtensionStorage } from '@bacons/apple-targets'
import { requestWidgetUpdate } from 'react-native-android-widget'
import { DdayWidget } from '../../widgets/DdayWidget'
import type { Couple } from '../types'

export const WIDGET_STORAGE_KEY = 'widget_dday_data'
const APP_GROUP = 'group.com.together.ourdays.widget'

export type WidgetData = { anniversary: string | null; coupleName: string | null }

export function computeDays(anniversary: string | null): number {
  if (!anniversary) return 0
  return Math.floor((Date.now() - new Date(anniversary).getTime()) / (1000 * 60 * 60 * 24)) + 1
}

// 커플 데이터가 바뀔 때마다 위젯이 읽을 원본 데이터(anniversary)를 동기화한다.
// D-day 숫자 자체는 위젯 쪽(Swift/Android headless task)에서 매번 다시 계산하므로,
// 여기서는 날짜 원본만 저장하고 OS의 주기적 갱신에 맡긴다.
export async function syncWidgetData(couple: Couple | null) {
  const data: WidgetData = {
    anniversary: couple?.anniversary ?? null,
    coupleName: couple?.couple_name ?? null,
  }

  await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(data))

  if (Platform.OS === 'android') {
    const days = computeDays(data.anniversary)
    await requestWidgetUpdate({
      widgetName: 'DdayWidget',
      renderWidget: () => <DdayWidget days={days} coupleName={data.coupleName ?? undefined} />,
      widgetNotFound: () => {},
    })
  }

  if (Platform.OS === 'ios') {
    const storage = new ExtensionStorage(APP_GROUP)
    storage.set('anniversary', data.anniversary ?? '')
    storage.set('coupleName', data.coupleName ?? '')
    ExtensionStorage.reloadWidget()
  }
}
