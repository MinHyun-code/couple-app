import React, { useState, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Keyboard, LayoutChangeEvent, Animated, Dimensions, PanResponder
} from 'react-native'
import { ResumableZoom, fitContainer, type ResumableZoomRefType, type TapGestureEvent, type PanGestureEvent } from 'react-native-zoom-toolkit'
import type { GestureStateChangeEvent, LongPressGestureHandlerEventPayload } from 'react-native-gesture-handler'
import Svg, { Path } from 'react-native-svg'
import { useRouter, useFocusEffect } from 'expo-router'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { calendarApi } from '../lib/api'
import { useCoupleStore, useThemeStore } from '../store'
import { REGIONS, REGION_VIEWBOX, REGION_VIEWBOX_SIZE, getRegionBBox, findRegionAtPoint, type Region } from '../data/regions'
import type { CalendarEvent, EventCategory } from '../types'
import { FONT_HEADING, THEMES } from '../theme'

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  date: '💕', anniversary: '🎂', travel: '✈️', daily: '📅', special: '⭐'
}

const MAX_SCALE = 8
const SCREEN_H = Dimensions.get('window').height
// 배율에 따라 두 값 사이를 선형 보간 (최대 축소 -> 최대 확대)
const STROKE_WIDTH_AT_MIN_ZOOM = 0.3
const STROKE_WIDTH_AT_MAX_ZOOM = 0.55
const SELECTED_STROKE_WIDTH_AT_MIN_ZOOM = 1.8
const SELECTED_STROKE_WIDTH_AT_MAX_ZOOM = 0.55

export default function MapScreen() {
  const router = useRouter()
  const couple = useCoupleStore(s => s.couple)
  const coupleId = couple?.id
  const { color: primary, deep, bg } = THEMES[useThemeStore(s => s.themeKey)]
  const zoomRef = useRef<ResumableZoomRefType>(null)
  const [settledScale, setSettledScale] = useState(1)
  // 확대/축소 도중에는 굵기를 바꾸지 않고, 제스처(관성 스크롤 포함)가 완전히 멈춘 뒤 한 번만 반영
  const handleGestureEnd = () => {
    const scale = zoomRef.current?.getState().scale ?? 1
    setSettledScale(scale)
  }
  const zoomProgress = (settledScale - 1) / (MAX_SCALE - 1)
  const strokeWidth = STROKE_WIDTH_AT_MIN_ZOOM + (STROKE_WIDTH_AT_MAX_ZOOM - STROKE_WIDTH_AT_MIN_ZOOM) * zoomProgress
  const selectedStrokeWidth = SELECTED_STROKE_WIDTH_AT_MIN_ZOOM + (SELECTED_STROKE_WIDTH_AT_MAX_ZOOM - SELECTED_STROKE_WIDTH_AT_MIN_ZOOM) * zoomProgress

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const sheetAnim = useRef(new Animated.Value(SCREEN_H)).current
  const [searchText, setSearchText] = useState('')
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 })

  const loadEvents = useCallback(async () => {
    if (!coupleId) return
    setLoading(true)
    try {
      const data = await calendarApi.getAllWithRegion(coupleId)
      setEvents(data)
    } catch {} finally {
      setLoading(false)
    }
  }, [coupleId])

  useFocusEffect(useCallback(() => { loadEvents() }, [loadEvents]))

  const eventsByRegion = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach(e => {
      if (!e.region_code) return
      ;(map[e.region_code] ??= []).push(e)
    })
    return map
  }, [events])

  const searchResults = useMemo(() => {
    const q = searchText.trim()
    if (!q) return []
    return REGIONS.filter(r => r.name.includes(q) || r.fullName.includes(q)).slice(0, 20)
  }, [searchText])

  const selectedEvents = selectedRegion ? (eventsByRegion[selectedRegion.code] ?? []) : []

  const mapContainerRef = useRef<View>(null)
  const [mapOrigin, setMapOrigin] = useState({ x: 0, y: 0 })

  const handleMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setMapSize({ width, height })
    mapContainerRef.current?.measureInWindow((x, y) => setMapOrigin({ x, y }))
  }

  // Svg를 컨테이너에 맞춘 실제 렌더 크기 (ResumableZoom의 좌표계는 이 자식 크기 기준)
  const fittedSize = mapSize.width > 0
    ? fitContainer(REGION_VIEWBOX_SIZE.width / REGION_VIEWBOX_SIZE.height, mapSize)
    : { width: 0, height: 0 }

  const childToViewBox = (x: number, y: number) => ({
    x: x * (REGION_VIEWBOX_SIZE.width / fittedSize.width),
    y: y * (REGION_VIEWBOX_SIZE.height / fittedSize.height),
  })

  // 어두운 배경은 애니메이션 없이 즉시 나타나고 사라짐, 시트만 슬라이드
  const openSheet = useCallback((region: Region) => {
    setSelectedRegion(region)
    setSheetVisible(true)
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start()
  }, [sheetAnim])

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: SCREEN_H, duration: 240, useNativeDriver: true }).start(() => {
      setSheetVisible(false)
      setSelectedRegion(null)
    })
  }, [sheetAnim])

  // 시트 상단 손잡이(가로 막대) 영역을 아래로 드래그해서 닫을 수 있도록
  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetAnim.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 1.2) {
          closeSheet()
        } else {
          Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start()
      },
    })
  ).current

  // RNGH는 제스처로 인해 뷰 자체가 변형(transform)될 때는 e.x/e.y 대신 절대 좌표(absoluteX/Y)를
  // 쓰라고 명시하고 있음. 확대된 상태에서 e.x/e.y를 쓰면 좌표가 어긋나 탭이 무시되는 문제가 있어
  // 화면 절대 좌표 + 현재 변형 상태(getState)로 직접 컨텐츠 좌표를 역산한다.
  const absoluteToChild = (absoluteX: number, absoluteY: number) => {
    const state = zoomRef.current?.getState()
    if (!state) return null
    const viewportX = absoluteX - mapOrigin.x
    const viewportY = absoluteY - mapOrigin.y
    return {
      x: (viewportX - state.containerSize.width / 2 - state.translateX) / state.scale + state.childSize.width / 2,
      y: (viewportY - state.containerSize.height / 2 - state.translateY) / state.scale + state.childSize.height / 2,
    }
  }

  const selectRegionAt = useCallback((absoluteX: number, absoluteY: number) => {
    if (fittedSize.width === 0) return
    const child = absoluteToChild(absoluteX, absoluteY)
    if (!child) return
    const { x, y } = childToViewBox(child.x, child.y)
    const region = findRegionAtPoint(x, y)
    if (region) openSheet(region)
  }, [fittedSize.width, mapOrigin, openSheet])

  const handleMapTap = (e: TapGestureEvent) => selectRegionAt(e.absoluteX, e.absoluteY)

  // ResumableZoom 내부에서 팬(pan) 제스처가 탭보다 먼저 활성화되면서 탭이 씹히는 경우가 있어,
  // 이동량이 거의 없는 팬 종료도 탭으로 취급해 지역 선택을 보정한다.
  // 확대한 상태에서는 정밀하게 지역을 조준하느라 손가락이 의도치 않게 더 움직이는 경우가 많아
  // 임계값을 넉넉하게 잡는다 (너무 타이트하면 탭이 팬으로 씹혀서 아예 반응이 없는 것처럼 느껴짐).
  const handlePanEnd = (e: PanGestureEvent) => {
    const moved = Math.abs(e.translationX) + Math.abs(e.translationY)
    if (moved < 20) selectRegionAt(e.absoluteX, e.absoluteY)
  }

  // 내부 tap 제스처는 250ms 안에 손을 떼야만 인식되는데(라이브러리 고정값),
  // 확대해서 정밀하게 누를 때는 그보다 오래 눌리는 경우가 많아 tap도, (움직임이 있는) pan도
  // 아무것도 인식되지 않고 터치가 그냥 씹히는 구간이 생긴다.
  // longPressDuration을 tap의 250ms 바로 위로 낮춰서 그 사각지대를 롱프레스로 메운다.
  const handleMapLongPress = (e: GestureStateChangeEvent<LongPressGestureHandlerEventPayload>) =>
    selectRegionAt(e.absoluteX, e.absoluteY)

  const focusOnRegion = useCallback((region: Region) => {
    openSheet(region)
    const bbox = getRegionBBox(region.code)
    if (!bbox || fittedSize.width === 0) return

    const childScale = fittedSize.width / REGION_VIEWBOX_SIZE.width
    const regionSize = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * childScale
    const desiredSize = 0.22 * Math.min(mapSize.width, mapSize.height)
    const targetScale = Math.min(Math.max(desiredSize / Math.max(regionSize, 1), 1.6), 4.5)

    zoomRef.current?.zoom(targetScale, { x: bbox.cx * childScale, y: bbox.cy * childScale })
    // zoom()은 프로그래매틱 호출이라 제스처 콜백(onGestureEnd)이 발생하지 않으므로 여기서 직접 갱신
    setSettledScale(targetScale)
  }, [fittedSize.width, mapSize, openSheet])

  const handleSelectSearch = (region: Region) => {
    Keyboard.dismiss()
    setSearchText('')
    focusOnRegion(region)
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="지역 검색 (예: 강남구)"
          placeholderTextColor="#bbb"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity style={styles.searchClear} onPress={() => setSearchText('')}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={r => r.code}
              keyboardShouldPersistTaps="always"
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultRow} onPress={() => handleSelectSearch(item)}>
                  <Text style={styles.searchResultEmoji}>📍</Text>
                  <Text style={styles.searchResultText}>{item.fullName}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {loading && events.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={primary} />
        </View>
      ) : (
        <View style={styles.mapWrap}>
          <View ref={mapContainerRef} style={{ flex: 1 }} onLayout={handleMapLayout}>
            {fittedSize.width > 0 && (
              <ResumableZoom
                ref={zoomRef}
                maxScale={MAX_SCALE}
                onTap={handleMapTap}
                onPanEnd={handlePanEnd}
                onLongPress={handleMapLongPress}
                longPressDuration={260}
                onGestureEnd={handleGestureEnd}
              >
                <Svg viewBox={REGION_VIEWBOX} width={fittedSize.width} height={fittedSize.height}>
                  {REGIONS.map(r => {
                    const has = !!eventsByRegion[r.code]?.length
                    return (
                      <Path
                        key={r.code}
                        d={r.d}
                        fill={has ? primary : '#E7E1DC'}
                        stroke="#fff"
                        strokeWidth={strokeWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  })}
                  {selectedRegion && (
                    <Path
                      d={selectedRegion.d}
                      fill="none"
                      stroke={deep}
                      strokeWidth={selectedStrokeWidth}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </Svg>
              </ResumableZoom>
            )}
          </View>
        </View>
      )}

      {sheetVisible && (
        <>
          <Pressable style={styles.overlay} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.handleArea} {...sheetPan.panHandlers}>
              <View style={styles.handle} />
            </View>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedRegion?.fullName}</Text>
            </View>
            <FlatList
              data={selectedEvents}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.eventList}
              ListEmptyComponent={<Text style={styles.emptyText}>이 지역의 일정이 없어요</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.eventCard}
                  onPress={() => { closeSheet(); router.push(`/event/${item.id}` as any) }}
                >
                  <Text style={styles.eventEmoji}>{CATEGORY_EMOJI[item.category]}</Text>
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.eventDate}>{format(new Date(item.event_date), 'yyyy년 M월 d일 (E)', { locale: ko })}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              )}
            />
          </Animated.View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchWrap: { paddingHorizontal: 16, marginTop: 12, marginBottom: 10, position: 'relative', zIndex: 20 },
  searchInput: {
    fontFamily: FONT_HEADING, fontSize: 15, color: '#333',
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingRight: 40,
    height: 48, textAlignVertical: 'center',
    borderWidth: 1.5, borderColor: '#f0ebe8',
  },
  searchClear: { position: 'absolute', right: 28, top: 10, padding: 6 },
  searchClearText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#bbb' },
  searchDropdown: {
    position: 'absolute', top: 52, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#f0ebe8',
    shadowColor: '#3D2C3B', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6, overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderColor: '#f5f5f5',
  },
  searchResultEmoji: { fontSize: 13 },
  searchResultText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#333' },

  mapWrap: {
    flex: 1, marginHorizontal: 12, marginBottom: 12, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#fff', padding: 6,
    shadowColor: '#3D2C3B', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 30 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 4, maxHeight: '75%',
  },
  handleArea: { paddingVertical: 10, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0' },
  sheetHeader: {
    alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 8,
  },
  sheetTitle: { fontFamily: FONT_HEADING, fontSize: 18, color: '#111' },
  eventList: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  eventCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#f0f0f0', gap: 12,
  },
  eventEmoji: { fontSize: 22 },
  eventBody: { flex: 1 },
  eventTitle: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600', color: '#222' },
  eventDate: { fontFamily: FONT_HEADING, fontSize: 15, color: '#aaa', marginTop: 2 },
  chevron: { fontFamily: FONT_HEADING, fontSize: 22, color: '#ccc' },
  emptyText: { fontFamily: FONT_HEADING, textAlign: 'center', color: '#bbb', fontSize: 14, lineHeight: 22, marginTop: 20 },
})
