import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Switch, Platform, StatusBar, Alert, Modal, Pressable, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useCoupleStore, useThemeStore } from '../src/store'
import { coupleApi } from '../src/lib/api'
import { FONT_HEADING, THEMES } from '../src/theme'

const TOP_PAD = Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12
const SCREEN_W = Dimensions.get('window').width
const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토']

function buildMonthDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1).getDay()
  const total = new Date(year, month, 0).getDate()
  const days: { day: number; dateStr: string; empty: boolean }[] = []
  for (let i = 0; i < first; i++) days.push({ day: 0, dateStr: '', empty: true })
  for (let d = 1; d <= total; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    days.push({ day: d, dateStr: `${year}-${mm}-${dd}`, empty: false })
  }
  // 항상 6주(42칸)로 맞춰서 달마다 그리드 높이가 바뀌지 않게 한다
  while (days.length < 42) days.push({ day: 0, dateStr: '', empty: true })
  return days
}

function AnniversaryPickerModal({ visible, value, primary, deep, onClose, onSelect }: {
  visible: boolean; value: string | null; primary: string; deep: string
  onClose: () => void; onSelect: (d: string | null) => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [year, setYear] = useState(() => parseInt((value ?? today).slice(0, 4)))
  const [month, setMonth] = useState(() => parseInt((value ?? today).slice(5, 7)))

  useEffect(() => {
    if (!visible) return
    const base = value ?? today
    setYear(parseInt(base.slice(0, 4)))
    setMonth(parseInt(base.slice(5, 7)))
  }, [visible, value])

  const days = buildMonthDays(year, month)
  const numWeeks = Math.ceil(days.length / 7)

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={dpStyles.overlay} onPress={onClose}>
        <Pressable style={dpStyles.sheet} onPress={e => e.stopPropagation()}>
          <View style={dpStyles.header}>
            <TouchableOpacity style={dpStyles.navBtn} onPress={prevMonth}>
              <Text style={[dpStyles.navArrow, { color: primary }]}>‹</Text>
            </TouchableOpacity>
            <Text style={dpStyles.monthLabel}>{year}년 {month}월</Text>
            <TouchableOpacity style={dpStyles.navBtn} onPress={nextMonth}>
              <Text style={[dpStyles.navArrow, { color: primary }]}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={dpStyles.weekRow}>
            {WEEKDAYS_SHORT.map((d, i) => (
              <Text key={d} style={[dpStyles.weekday, i === 0 && { color: deep }, i === 6 && { color: primary }]}>{d}</Text>
            ))}
          </View>
          {Array.from({ length: numWeeks }, (_, wi) => (
            <View key={wi} style={dpStyles.weekRow}>
              {days.slice(wi * 7, wi * 7 + 7).map((day, di) => (
                <TouchableOpacity
                  key={di}
                  style={dpStyles.dayCell}
                  onPress={() => !day.empty && onSelect(day.dateStr)}
                  disabled={day.empty}
                >
                  <View style={[dpStyles.dayCircle, !day.empty && day.dateStr === value && { backgroundColor: primary }]}>
                    {!day.empty && (
                      <Text style={[dpStyles.dayNum,
                        di === 0 && { color: deep }, di === 6 && { color: primary },
                        day.dateStr === value && { color: '#fff' },
                      ]}>{day.day}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {value && (
            <TouchableOpacity style={dpStyles.clearBtn} onPress={() => onSelect(null)}>
              <Text style={dpStyles.clearBtnText}>날짜 지우기</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 12, width: SCREEN_W - 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontFamily: FONT_HEADING, fontSize: 26 },
  monthLabel: { fontFamily: FONT_HEADING, fontSize: 16, fontWeight: '700', color: '#111' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '700', color: '#bbb', paddingBottom: 6 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontFamily: FONT_HEADING, fontSize: 14, color: '#222' },
  clearBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  clearBtnText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#B6A8A2', fontWeight: '600' },
})

export default function CoupleSettingsScreen() {
  const router = useRouter()
  const { color: primary, deep } = THEMES[useThemeStore(s => s.themeKey)]
  const { couple, updateMenuSettings } = useCoupleStore()
  const [saving, setSaving] = useState<'bucket' | 'chat' | 'map' | null>(null)
  const [anniversaryPickerVisible, setAnniversaryPickerVisible] = useState(false)
  const [savingAnniversary, setSavingAnniversary] = useState(false)

  const showBucketList = couple?.menu_settings?.showBucketList ?? true
  const showChat = couple?.menu_settings?.showChat ?? true
  const showMap = couple?.menu_settings?.showMap ?? true

  const handleToggle = async (key: 'showBucketList' | 'showChat' | 'showMap', value: boolean) => {
    setSaving(key === 'showBucketList' ? 'bucket' : key === 'showChat' ? 'chat' : 'map')
    try {
      await updateMenuSettings({ [key]: value })
    } catch (e: any) {
      Alert.alert('저장 실패', e.message)
    } finally {
      setSaving(null)
    }
  }

  const handleSetAnniversary = async (dateStr: string | null) => {
    if (!couple) return
    setSavingAnniversary(true)
    try {
      const updated = await coupleApi.update(couple.id, { anniversary: dateStr })
      useCoupleStore.getState().setCouple({ ...couple, ...updated })
    } catch (e: any) {
      Alert.alert('저장 실패', e.message)
    } finally {
      setSavingAnniversary(false)
      setAnniversaryPickerVisible(false)
    }
  }

  const handleDisconnect = () => {
    if (!couple) return
    Alert.alert(
      '커플 연동 끊기',
      '정말 커플 연동을 끊을까요?\n연동을 끊으면 함께한 기록을 더 이상 함께 볼 수 없어요.',
      [
        { text: '취소' },
        {
          text: '연동 끊기', style: 'destructive',
          onPress: async () => {
            try {
              await coupleApi.update(couple.id, { status: 'separated' })
              useCoupleStore.getState().reset()
              router.replace('/couple-connect')
            } catch (e: any) {
              Alert.alert('오류', e.message)
            }
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: TOP_PAD }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>커플 설정</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>메뉴 표시</Text>
        <Text style={styles.sectionDesc}>꺼두면 하단 네비게이션에서 숨겨지고, 상대방 화면에도 함께 반영돼요.</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>💗</Text>
            <Text style={styles.rowLabel}>버킷리스트</Text>
          </View>
          <Switch
            value={showBucketList}
            onValueChange={(v) => handleToggle('showBucketList', v)}
            disabled={!couple || saving === 'bucket'}
            trackColor={{ false: '#E7DFDC', true: primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>💬</Text>
            <Text style={styles.rowLabel}>대화</Text>
          </View>
          <Switch
            value={showChat}
            onValueChange={(v) => handleToggle('showChat', v)}
            disabled={!couple || saving === 'chat'}
            trackColor={{ false: '#E7DFDC', true: primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🗺️</Text>
            <Text style={styles.rowLabel}>지도</Text>
          </View>
          <Switch
            value={showMap}
            onValueChange={(v) => handleToggle('showMap', v)}
            disabled={!couple || saving === 'map'}
            trackColor={{ false: '#E7DFDC', true: primary }}
            thumbColor="#fff"
          />
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>별칭</Text>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/nickname-settings' as any)} disabled={!couple}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>💌</Text>
            <Text style={styles.rowLabel}>서로 부르는 이름 설정</Text>
          </View>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>기념일</Text>
        <TouchableOpacity style={styles.row} onPress={() => setAnniversaryPickerVisible(true)} disabled={!couple || savingAnniversary}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🎂</Text>
            <Text style={styles.rowLabel}>사귄 날짜</Text>
          </View>
          <Text style={styles.rowValue}>
            {couple?.anniversary ? format(new Date(couple.anniversary), 'yyyy.MM.dd') : '설정 안 함'}  ›
          </Text>
        </TouchableOpacity>
      </View>

      {/* 커플 연동 끊기 */}
      {couple && (
        <View style={styles.disconnectSection}>
          <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>커플 연동 끊기</Text>
          </TouchableOpacity>
        </View>
      )}

      <AnniversaryPickerModal
        visible={anniversaryPickerVisible}
        value={couple?.anniversary ?? null}
        primary={primary}
        deep={deep}
        onClose={() => setAnniversaryPickerVisible(false)}
        onSelect={handleSetAnniversary}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderColor: '#f0f0f0',
  },
  backBtn: { padding: 4, minWidth: 40 },
  backIcon: { fontSize: 32, color: '#333', lineHeight: 36 },
  headerTitle: { fontFamily: FONT_HEADING, fontSize: 16, fontWeight: '700', color: '#222' },

  body: { padding: 24, gap: 4 },
  sectionLabel: { fontFamily: FONT_HEADING, fontSize: 17, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionDesc: { fontFamily: FONT_HEADING, fontSize: 14, color: '#bbb', marginBottom: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderColor: '#f5f5f5',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 20 },
  rowLabel: { fontFamily: FONT_HEADING, fontSize: 16, color: '#222' },
  rowChevron: { fontFamily: FONT_HEADING, fontSize: 22, color: '#C9BDB8' },
  rowValue: { fontFamily: FONT_HEADING, fontSize: 15, color: '#B6A8A2' },

  // 커플 연동 끊기
  disconnectSection: { paddingHorizontal: 24, marginTop: 8 },
  disconnectBtn: {
    padding: 15, borderRadius: 16, backgroundColor: '#FFF0EE', alignItems: 'center',
  },
  disconnectText: { fontFamily: FONT_HEADING, color: '#E0637A', fontWeight: '700', fontSize: 14 },
})
