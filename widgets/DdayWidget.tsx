import React from 'react'
import { FlexWidget, TextWidget } from 'react-native-android-widget'

type Props = { days: number; coupleName?: string }

export function DdayWidget({ days, coupleName }: Props) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF8FA',
        borderRadius: 20,
      }}
    >
      <TextWidget text="함께한 지" style={{ fontSize: 12, color: '#C23A6A' }} />
      <TextWidget text={`${days}일째`} style={{ fontSize: 22, fontWeight: 'bold', color: '#FF6B9D' }} />
      {coupleName ? <TextWidget text={coupleName} style={{ fontSize: 11, color: '#C23A6A', marginTop: 4 }} /> : null}
    </FlexWidget>
  )
}
