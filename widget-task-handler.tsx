import React from 'react'
import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DdayWidget } from './widgets/DdayWidget'
import { WIDGET_STORAGE_KEY, computeDays, type WidgetData } from './src/lib/widgetSync'

const nameToWidget = { DdayWidget }

// Android가 위젯을 추가/갱신/리사이즈할 때(앱이 꺼져 있어도) 호출되는 headless task.
// 같은 앱 프로세스에서 돌기 때문에 foreground 앱이 쓴 AsyncStorage를 그대로 읽을 수 있다.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const Widget = nameToWidget[props.widgetInfo.widgetName as keyof typeof nameToWidget]
  if (!Widget) return

  let data: WidgetData | null = null
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY)
    data = raw ? (JSON.parse(raw) as WidgetData) : null
  } catch {
    data = null
  }

  const days = computeDays(data?.anniversary ?? null)

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<Widget days={days} coupleName={data?.coupleName ?? undefined} />)
      break
  }
}
