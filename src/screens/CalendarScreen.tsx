import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet,
  FlatList, Animated, Easing, LayoutChangeEvent,
  PanResponder, Dimensions, ActivityIndicator, Modal
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { calendarApi } from '../lib/api'
import { useCoupleStore, useThemeStore } from '../store'
import type { CalendarEvent, EventCategory } from '../types'
import { FONT_HEADING, THEMES } from '../theme'

const PANEL_HEIGHT = 340
const PINK = '#FF6B9D'  // StyleSheet 기본값용
const SCREEN_W = Dimensions.get('window').width
const SLIDE_W = SCREEN_W - 16  // calWrap paddingHorizontal: 8 per side
const CAL_HEADER_H = 56
const CAL_WEEKDAY_H = 34
const CAL_RIBBON_H = 36

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  date: '💕', anniversary: '🎂', travel: '✈️', daily: '📅', special: '⭐'
}
const CATEGORY_LABEL: Record<EventCategory, string> = {
  date: '데이트', anniversary: '기념일', travel: '여행', daily: '일상', special: '특별'
}

type DayItem = { dateString: string; day: number; otherMonth: boolean }

function buildDays(year: number, month: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const prevMonthTotal = new Date(year, month - 1, 0).getDate()

  const days: DayItem[] = []

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevMonthTotal - i
    const y = month === 1 ? year - 1 : year
    const m = month === 1 ? 12 : month - 1
    days.push({ dateString: `${y}-${pad(m)}-${pad(d)}`, day: d, otherMonth: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ dateString: `${year}-${pad(month)}-${pad(d)}`, day: d, otherMonth: false })
  }
  const numWeeks = Math.ceil(days.length / 7)
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  let nd = 1
  while (days.length < numWeeks * 7) {
    days.push({ dateString: `${ny}-${pad(nm)}-${pad(nd)}`, day: nd++, otherMonth: true })
  }

  return { days, numWeeks }
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function CalendarScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const couple = useCoupleStore(s => s.couple)
  const themeKey = useThemeStore(s => s.themeKey)
  const { color: primary, soft, deep, bg } = THEMES[themeKey]

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }))
  const [frozenPrevMonth, setFrozenPrevMonth] = useState(() => {
    const m = new Date().getMonth() + 1
    const y = new Date().getFullYear()
    return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
  })
  const [frozenNextMonth, setFrozenNextMonth] = useState(() => {
    const m = new Date().getMonth() + 1
    const y = new Date().getFullYear()
    return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
  })
  const [showPanel, setShowPanel] = useState(false)
  const [catPickerVisible, setCatPickerVisible] = useState(false)
  const [monthPickerVisible, setMonthPickerVisible] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentMonth.year)
  const [calHeight, setCalHeight] = useState(0)
  const [loading, setLoading] = useState(false)

  const panelAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current
  const panelOverlay = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const isAnimating = useRef(false)
  const goingToEvent = useRef(false)
  const pendingSlideReset = useRef<number>(0)
  const selectedRef = useRef(selected)
  const showPanelRef = useRef(showPanel)
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { showPanelRef.current = showPanel }, [showPanel])


  const { days, numWeeks } = useMemo(() => buildDays(currentMonth.year, currentMonth.month), [currentMonth])

  const { days: prevDays, numWeeks: prevNumWeeks } = useMemo(
    () => buildDays(frozenPrevMonth.year, frozenPrevMonth.month),
    [frozenPrevMonth]
  )

  const { days: nextDays, numWeeks: nextNumWeeks } = useMemo(
    () => buildDays(frozenNextMonth.year, frozenNextMonth.month),
    [frozenNextMonth]
  )

  const ribbonH = couple?.anniversary ? CAL_RIBBON_H : 0

  const dayH = useMemo(() => {
    if (calHeight === 0) return 60
    return Math.floor((calHeight - CAL_HEADER_H - CAL_WEEKDAY_H - ribbonH) / 6)
  }, [calHeight, ribbonH])

  const circleSize = Math.min(44, dayH - 14)

  // currentMonth가 바뀐 후: 위치 리셋 + frozen 인접 달 동기화
  useEffect(() => {
    if (pendingSlideReset.current) {
      pendingSlideReset.current = 0
      slideAnim.setValue(0)
    }
    setFrozenPrevMonth(
      currentMonth.month === 1
        ? { year: currentMonth.year - 1, month: 12 }
        : { year: currentMonth.year, month: currentMonth.month - 1 }
    )
    setFrozenNextMonth(
      currentMonth.month === 12
        ? { year: currentMonth.year + 1, month: 1 }
        : { year: currentMonth.year, month: currentMonth.month + 1 }
    )
  }, [currentMonth])

  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {}
    events.forEach(e => { map[e.event_date] = (map[e.event_date] ?? 0) + 1 })
    return map
  }, [events])

  const daysTogether = couple?.anniversary
    ? Math.floor((new Date().getTime() - new Date(couple.anniversary).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : null

  const getCategoryTint = (cat: EventCategory) => {
    switch (cat) {
      case 'date': return { accent: primary, badge: soft }
      case 'anniversary': return { accent: deep, badge: soft }
      case 'travel': return { accent: '#6FBBA3', badge: '#DDEFEA' }
      case 'daily': return { accent: '#E3A857', badge: '#FBEDD9' }
      case 'special': return { accent: '#8B7FD1', badge: '#EAE6FA' }
    }
  }

  const iconsByDate = useMemo(() => {
    const map: Record<string, string> = {}
    events.forEach(e => {
      if (e.category === 'anniversary' && e.icon) map[e.event_date] = e.icon
    })
    return map
  }, [events])

  // 날짜별 첫 번째 이미지 URL
  const imagesByDate = useMemo(() => {
    const map: Record<string, string> = {}
    events.forEach(e => {
      if (map[e.event_date]) return // 이미 있으면 건너뜀
      const firstImg = e.media?.find(m => m.media_type === 'image')
      if (firstImg) map[e.event_date] = firstImg.thumbnail_url ?? firstImg.url
    })
    return map
  }, [events])

  const loadEvents = useCallback(async () => {
    if (!couple) return
    setLoading(true)
    try {
      const data = await calendarApi.getByMonth(couple.id, currentMonth.year, currentMonth.month)
      setEvents(data)
      const urls = data.flatMap(e => e.media?.filter(m => m.media_type === 'image').map(m => m.url) ?? [])
      if (urls.length > 0) Image.prefetch(urls)
    } catch {} finally {
      setLoading(false)
    }
  }, [couple, currentMonth])

  useEffect(() => { loadEvents() }, [loadEvents])

  const loadEventsRef = useRef(loadEvents)
  useEffect(() => { loadEventsRef.current = loadEvents }, [loadEvents])

  useFocusEffect(useCallback(() => {
    if (goingToEvent.current) {
      goingToEvent.current = false
      loadEventsRef.current()
      return
    }
    const now = new Date()
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() + 1 })
  }, []))

  const selectedEvents = useMemo(() => events.filter(e => e.event_date === selected), [events, selected])

  const openPanel = useCallback(() => {
    setShowPanel(true)
    Animated.parallel([
      Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }),
      Animated.timing(panelOverlay, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [panelAnim, panelOverlay])

  const closePanel = useCallback(() => {
    Animated.parallel([
      Animated.timing(panelAnim, { toValue: PANEL_HEIGHT, duration: 240, useNativeDriver: true }),
      Animated.timing(panelOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setShowPanel(false); setSelected(null) })
  }, [panelAnim, panelOverlay])

  // 패널 상단 손잡이(가로 막대) 영역을 아래로 드래그해서 닫을 수 있도록
  const panelDragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) panelAnim.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 1.2) {
          closePanel()
        } else {
          Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start()
      },
    })
  ).current

  const handleDayPress = useCallback((dateString: string) => {
    if (showPanelRef.current) {
      closePanel()
      return
    }
    setSelected(dateString)
    openPanel()
  }, [openPanel, closePanel])

  const changeMonthWithAnim = useCallback((direction: 'prev' | 'next') => {
    if (isAnimating.current) return
    isAnimating.current = true
    const outX = direction === 'prev' ? SLIDE_W : -SLIDE_W
    Animated.timing(slideAnim, { toValue: outX, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      pendingSlideReset.current = 1
      setCurrentMonth(p =>
        direction === 'prev'
          ? (p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 })
          : (p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 })
      )
      isAnimating.current = false
    })
  }, [slideAnim])

  const prevMonth = useCallback(() => changeMonthWithAnim('prev'), [changeMonthWithAnim])
  const nextMonth = useCallback(() => changeMonthWithAnim('next'), [changeMonthWithAnim])

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 10,
    onPanResponderGrant: () => {
      slideAnim.stopAnimation()
    },
    onPanResponderMove: (_, gs) => {
      slideAnim.setValue(gs.dx)
    },
    onPanResponderRelease: (_, gs) => {
      const { dx, vx } = gs
      const flick = Math.abs(vx) > 0.4
      const dragged = Math.abs(dx) > SCREEN_W * 0.25

      if ((flick || dragged) && dx > 0) {
        const duration = Math.min(220, Math.max(120, (SLIDE_W - dx) / Math.max(Math.abs(vx), 0.5) * 0.4))
        Animated.timing(slideAnim, { toValue: SLIDE_W, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
          pendingSlideReset.current = 1
          setCurrentMonth(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 })
        })
      } else if ((flick || dragged) && dx < 0) {
        const duration = Math.min(220, Math.max(120, (SLIDE_W + dx) / Math.max(Math.abs(vx), 0.5) * 0.4))
        Animated.timing(slideAnim, { toValue: -SLIDE_W, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
          pendingSlideReset.current = 1
          setCurrentMonth(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 })
        })
      } else {
        Animated.timing(slideAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
      }
    },
    onPanResponderTerminate: () => {
      Animated.timing(slideAnim, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
    },
  })).current

  const goToCreate = () => setCatPickerVisible(true)
  const goToCreateWithCat = (cat: EventCategory) => {
    setCatPickerVisible(false)
    goingToEvent.current = true
    router.push(`/event/new?date=${selected ?? format(new Date(), 'yyyy-MM-dd')}&category=${cat}` as any)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      {/* ── 커스텀 캘린더 ── */}
      <View
        style={styles.calWrap}
        onLayout={(e: LayoutChangeEvent) => {
          const h = e.nativeEvent.layout.height
          if (h > 0) setCalHeight(h)
        }}
        {...panResponder.panHandlers}
      >
        {/* 월 헤더 - 애니메이션 밖에 고정 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Text style={[styles.navArrow, { color: primary }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPickerYear(currentMonth.year); setMonthPickerVisible(true) }}>
            <Text style={[styles.monthText, { fontFamily: FONT_HEADING }]}>{currentMonth.year}년 {currentMonth.month}월 ▾</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Text style={[styles.navArrow, { color: primary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 함께한 지 며칠째 리본 */}
        {daysTogether !== null && (
          <View style={[styles.ddayRibbon, { backgroundColor: soft, borderColor: primary + '30' }]}>
            <Text style={[styles.ddayRibbonText, { color: deep }]}>💌 함께한 지 {daysTogether}일째</Text>
          </View>
        )}

        {/* 요일 헤더 - 고정 (슬라이드 밖) */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={d} style={[styles.weekdayText, i === 0 && { color: deep }, i === 6 && { color: primary }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* 날짜 그리드만 슬라이드 - 이전/현재/다음 달을 나란히 */}
        <Animated.View
          style={[styles.slideWrap, { transform: [{ translateX: slideAnim }] }]}
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
        >

          {calHeight > 0 && (
            <React.Fragment>
              {/* 이전 달 그리드 */}
              <View style={[styles.adjGridPrev, { height: prevNumWeeks * dayH }]} shouldRasterizeIOS renderToHardwareTextureAndroid>
                {Array.from({ length: prevNumWeeks }, (_, wi) => (
                  <View key={wi} style={[styles.weekRow, { height: dayH }]}>
                    {prevDays.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                      const isToday = !day.otherMonth && day.dateString === today
                      const nc = isToday ? primary : di === 0 && !day.otherMonth ? deep : di === 6 && !day.otherMonth ? primary : day.otherMonth ? '#ddd' : '#111'
                      return (
                        <View key={di} style={styles.dayCell}>
                          <View style={[styles.dayCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }, isToday && { borderWidth: 1.5, borderColor: primary }]}>
                            <Text style={[styles.dayNum, { color: nc }]}>{day.day}</Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                ))}
              </View>

              {/* 현재 달 그리드 */}
              <View style={styles.gridWrap}>
                {Array.from({ length: numWeeks }, (_, wi) => (
                  <View key={wi} style={[styles.weekRow, { height: dayH }]}>
                    {days.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                      const isSelected = !day.otherMonth && day.dateString === selected
                      const isToday = !day.otherMonth && day.dateString === today
                      const isSelectedToday = isSelected && isToday
                      const eventCount = !day.otherMonth ? (eventCountByDate[day.dateString] ?? 0) : 0
                      const hasEvent = eventCount > 0
                      const imgUrl = !day.otherMonth ? imagesByDate[day.dateString] : undefined
                      const hasImg = !!imgUrl
                      const dayIcon = !day.otherMonth ? iconsByDate[day.dateString] : undefined
                      const numColor = isSelected ? '#fff' : isToday ? primary
                        : di === 0 && !day.otherMonth ? deep : di === 6 && !day.otherMonth ? primary
                        : day.otherMonth ? '#ddd' : '#3D2C3B'
                      return (
                        <TouchableOpacity
                          key={di}
                          style={styles.dayCell}
                          onPress={() => !day.otherMonth && handleDayPress(day.dateString)}
                          disabled={day.otherMonth}
                          activeOpacity={0.75}
                        >
                          {isSelectedToday ? (
                            <View style={[styles.todayHalo, { width: circleSize + 6, height: circleSize + 6, borderRadius: (circleSize + 6) / 2, backgroundColor: soft }]}>
                              <View style={[styles.dayCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: primary }]}>
                                <Text style={[styles.dayNum, { color: '#fff' }]}>{day.day}</Text>
                              </View>
                              <View style={[styles.todayBadge, { borderColor: bg }]}>
                                <Text style={[styles.todayBadgeText, { color: primary }]}>♥</Text>
                              </View>
                            </View>
                          ) : (
                            <View style={[styles.dayCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
                              isSelected && { backgroundColor: primary },
                              isToday && !isSelected && { borderWidth: 1.5, borderColor: primary },
                            ]}>
                              <Text style={[styles.dayNum, { color: numColor }]}>{day.day}</Text>
                            </View>
                          )}
                          {hasImg && (
                            <Image source={{ uri: imgUrl }} style={styles.dayThumb} contentFit="cover" cachePolicy="memory-disk" />
                          )}
                          {dayIcon && !hasImg && <Text style={styles.dayIcon}>{dayIcon}</Text>}
                          {hasEvent && !hasImg && !dayIcon && (
                            <View style={styles.dotCluster}>
                              {Array.from({ length: Math.min(eventCount, 3) }).map((_, ci) => (
                                <View key={ci} style={[styles.clusterDot, { backgroundColor: isSelected ? '#fff' : primary }]} />
                              ))}
                            </View>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                ))}
              </View>

              {/* 다음 달 그리드 */}
              <View style={[styles.adjGridNext, { height: nextNumWeeks * dayH }]} shouldRasterizeIOS renderToHardwareTextureAndroid>
                {Array.from({ length: nextNumWeeks }, (_, wi) => (
                  <View key={wi} style={[styles.weekRow, { height: dayH }]}>
                    {nextDays.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                      const isToday = !day.otherMonth && day.dateString === today
                      const nc = isToday ? primary : di === 0 && !day.otherMonth ? deep : di === 6 && !day.otherMonth ? primary : day.otherMonth ? '#ddd' : '#111'
                      return (
                        <View key={di} style={styles.dayCell}>
                          <View style={[styles.dayCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }, isToday && { borderWidth: 1.5, borderColor: primary }]}>
                            <Text style={[styles.dayNum, { color: nc }]}>{day.day}</Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                ))}
              </View>
            </React.Fragment>
          )}

        </Animated.View>

        {/* 로딩 스피너 - 주 수(4/5/6주)와 무관하게 항상 그리드 전체 영역 정중앙에 표시 */}
        {loading && (
          <View style={[styles.loadingSpinnerWrap, { top: CAL_HEADER_H + ribbonH + CAL_WEEKDAY_H, height: 6 * dayH }]}>
            <ActivityIndicator color={primary} size="small" />
          </View>
        )}
      </View>


      {/* ── 년/월 선택 모달 ── */}
      <Modal visible={monthPickerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setMonthPickerVisible(false)}>
        <Pressable style={styles.monthPickerOverlay} onPress={() => setMonthPickerVisible(false)}>
          <Pressable style={styles.monthPickerSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.monthPickerYearRow}>
              <TouchableOpacity style={styles.navBtn} onPress={() => setPickerYear(y => y - 1)}>
                <Text style={[styles.navArrow, { color: primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthPickerYear}>{pickerYear}년</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => setPickerYear(y => y + 1)}>
                <Text style={[styles.navArrow, { color: primary }]}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthGrid}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const isSelected = pickerYear === currentMonth.year && m === currentMonth.month
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthChip, isSelected && { backgroundColor: primary }]}
                    onPress={() => {
                      setCurrentMonth({ year: pickerYear, month: m })
                      setMonthPickerVisible(false)
                    }}
                  >
                    <Text style={[styles.monthChipText, isSelected && { color: '#fff', fontWeight: '700' }]}>{m}월</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 카테고리 선택 모달 ── */}
      <Modal visible={catPickerVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCatPickerVisible(false)}>
        <Pressable style={styles.catPickerOverlay} onPress={() => setCatPickerVisible(false)}>
          <Pressable style={styles.catPickerSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.catPickerHandle} />
            <Text style={styles.catPickerTitle}>어떤 일정인가요?</Text>
            {(['date', 'anniversary'] as EventCategory[]).map(cat => (
              <TouchableOpacity key={cat} style={styles.catPickerRow} onPress={() => goToCreateWithCat(cat)}>
                <Text style={styles.catPickerEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                <Text style={styles.catPickerLabel}>{CATEGORY_LABEL[cat]}</Text>
                <Text style={styles.catPickerChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 슬라이드업 패널 ── */}
      {showPanel && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePanel}>
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.overlay, { opacity: panelOverlay }]}
              pointerEvents="none"
            />
          </Pressable>
          <Animated.View style={[styles.panel, { transform: [{ translateY: panelAnim }] }]}>
            <View style={styles.handleArea} {...panelDragResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
            <View style={styles.panelHeader}>
              <Text style={styles.panelDate}>
                {selected ? format(new Date(selected), 'M월 d일 (E)', { locale: ko }) : ''}
              </Text>
              <View style={styles.panelActions}>
                <TouchableOpacity style={[styles.panelAddBtn, { backgroundColor: primary }]} onPress={goToCreate}>
                  <Text style={styles.panelAddText}>+ 추가</Text>
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={selectedEvents}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.eventList}
              ItemSeparatorComponent={() => <View style={styles.eventDivider} />}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  이 날의 일정이 없어요 💫{'\n'}+ 추가 버튼으로 등록해보세요
                </Text>
              }
              renderItem={({ item }) => {
                const tint = getCategoryTint(item.category)
                return (
                  <TouchableOpacity
                    style={[styles.eventRow, item.is_completed && styles.eventDone]}
                    onPress={() => { goingToEvent.current = true; router.push(`/event/${item.id}` as any) }}
                  >
                    <View style={[styles.eventAccent, { backgroundColor: tint?.accent }]} />
                    <View style={[styles.eventEmojiBadge, { backgroundColor: tint?.badge }]}>
                      <Text style={styles.eventEmoji}>{CATEGORY_EMOJI[item.category]}</Text>
                    </View>
                    <View style={styles.eventBody}>
                      <Text style={[styles.eventTitle, item.is_completed && styles.strike]}>
                        {item.title}
                      </Text>
                      {item.description
                        ? <Text style={styles.eventDesc} numberOfLines={1}>{item.description}</Text>
                        : null}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                )
              }}
            />
          </Animated.View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // ── Calendar ──
  calWrap: { flex: 1, paddingHorizontal: 8, overflow: 'hidden' },
  slideWrap: {},
  gridWrap: {},
  adjGridPrev: { position: 'absolute', top: 0, right: '100%', width: '100%' },
  adjGridNext: { position: 'absolute', top: 0, left: '100%', width: '100%' },
  loadingSpinnerWrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    height: CAL_HEADER_H,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontFamily: FONT_HEADING, fontSize: 28, color: PINK },
  monthText: { fontFamily: FONT_HEADING, fontSize: 18, fontWeight: '700', color: '#111' },
  ddayRibbon: {
    height: CAL_RIBBON_H - 6, marginHorizontal: 8, marginBottom: 6, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },
  ddayRibbonText: { fontFamily: FONT_HEADING, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  weekdayRow: {
    height: CAL_WEEKDAY_H,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderColor: '#f3f3f3',
    marginBottom: 4,
  },
  weekdayText: { fontFamily: FONT_HEADING, flex: 1, textAlign: 'center', fontSize: 15, color: '#bbb' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6, overflow: 'hidden' },
  dayCellImg: { borderRadius: 8, margin: 2 },
  imgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  imgSelectOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,107,157,0.45)', borderRadius: 8 },
  imgTodayBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  dayCircle: { alignItems: 'center', justifyContent: 'center' },
  circleSelected: { backgroundColor: PINK },
  circleToday: { borderWidth: 1.5, borderColor: PINK },
  dayNum: { fontFamily: FONT_HEADING, fontSize: 16, color: '#111' },
  todayHalo: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  todayBadge: {
    position: 'absolute', top: -2, right: -1,
    width: 13, height: 13, borderRadius: 7, borderWidth: 1.5,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  todayBadgeText: { fontSize: 7, lineHeight: 8 },
  dotCluster: { flexDirection: 'row', gap: 2.5, marginTop: 3 },
  clusterDot: { width: 3.5, height: 3.5, borderRadius: 2 },
  dayIcon: { fontSize: 17, marginTop: 1, lineHeight: 19 },
  dayThumb: {
    marginTop: 6, width: 26, height: 26, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(61,44,59,0.05)',
    shadowColor: '#3D2C3B', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  // ── FAB ──
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: PINK, alignItems: 'center', justifyContent: 'center',
    shadowColor: PINK, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 30, lineHeight: 34 },

  // ── Panel ──
  overlay: { backgroundColor: 'rgba(0,0,0,0.28)' },
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: PANEL_HEIGHT,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 4,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 20,
  },
  handleArea: { paddingVertical: 10, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0' },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  panelDate: { fontFamily: FONT_HEADING, fontSize: 19, color: '#111' },
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelAddBtn: { backgroundColor: PINK, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  panelAddText: { fontFamily: FONT_HEADING, color: '#fff', fontWeight: '700', fontSize: 13 },
  eventList: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyText: { fontFamily: FONT_HEADING, textAlign: 'center', color: '#ccc', marginTop: 28, fontSize: 14, lineHeight: 22 },
  eventDivider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#F3E4EA' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  eventDone: { opacity: 0.55 },
  eventAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  eventEmojiBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 15 },
  eventBody: { flex: 1 },
  eventTitle: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600', color: '#222' },
  strike: { fontFamily: FONT_HEADING, textDecorationLine: 'line-through', color: '#bbb' },
  eventDesc: { fontFamily: FONT_HEADING, fontSize: 15, color: '#aaa', marginTop: 2 },
  chevron: { fontFamily: FONT_HEADING, fontSize: 22, color: '#ccc' },

  // ── 년/월 선택 모달 ──
  monthPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  monthPickerSheet: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: SCREEN_W - 48 },
  monthPickerYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthPickerYear: { fontFamily: FONT_HEADING, fontSize: 20, color: '#111' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip: { width: '22%', paddingVertical: 12, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center' },
  monthChipText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#333' },

  // ── 카테고리 선택 모달 ──
  catPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  catPickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  catPickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  catPickerTitle: { fontFamily: FONT_HEADING, fontSize: 16, fontWeight: '700', color: '#222', paddingHorizontal: 24, marginBottom: 8 },
  catPickerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 14 },
  catPickerEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  catPickerLabel: { fontFamily: FONT_HEADING, fontSize: 16, color: '#333', flex: 1 },
  catPickerChevron: { fontFamily: FONT_HEADING, fontSize: 22, color: '#ccc' },
})
