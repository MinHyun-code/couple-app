import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, TextInput,
  Alert, ActivityIndicator, ScrollView, FlatList,
  Platform, StatusBar, Dimensions, Modal
} from 'react-native'
import { Gallery, useImageResolution, fitContainer } from 'react-native-zoom-toolkit'
import { runOnJS } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { calendarApi, mediaApi, dateApi } from '../../src/lib/api'
import { sendPushNotification } from '../../src/lib/notifications'
import { useAuthStore, useCoupleStore, useThemeStore, useFavoriteRegionsStore } from '../../src/store'
import { FONT_HEADING, THEMES } from '../../src/theme'
import type { CalendarEvent, EventCategory, EventMedia, DateIdea, DateCategory } from '../../src/types'
import { PROVINCES, getRegionsByProvince, getRegionByCode, REGIONS } from '../../src/data/regions'
import type { Region } from '../../src/data/regions'

const PINK = '#FF6B9D'  // StyleSheet 기본값용
const { width: SCREEN_W } = Dimensions.get('window')
const CAROUSEL_H = 280
const CONTENT_PAD = 22

const ANNIVERSARY_ICONS = ['🎂', '💑', '💍', '🌹', '🎉', '❤️', '🥂', '🎁', '💝', '🫶', '🌸', '🎊', '✨', '🥰', '💕', '🌺', '🍾', '🕯️']

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  date: '💕', anniversary: '🎂', travel: '✈️', daily: '📅', special: '⭐'
}
const CATEGORY_LABEL: Record<EventCategory, string> = {
  date: '데이트', anniversary: '기념일', travel: '여행', daily: '일상', special: '특별'
}
const DATE_CAT_EMOJI: Record<DateCategory, string> = {
  restaurant: '🍽️', travel: '✈️', activity: '🎯', movie: '🎬', home: '🏠', other: '💫'
}

const TOP_PAD = Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12

function GalleryImageItem({ uri }: { uri: string }) {
  const { width, height } = Dimensions.get('window')
  const { resolution } = useImageResolution({ uri })
  const size = resolution
    ? fitContainer(resolution.width / resolution.height, { width, height })
    : { width, height: 1 }
  return (
    <Image source={{ uri }} style={size} contentFit="contain" cachePolicy="memory-disk" />
  )
}

function ImageSlide({ uri, primaryColor, onPress, onLongPress, onError, onReady }: { uri: string; primaryColor: string; onPress: () => void; onLongPress: () => void; onError: () => void; onReady?: () => void }) {
  const [imgLoading, setImgLoading] = useState(true)
  return (
    <TouchableOpacity style={slideStyles.slide} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.95}>
      <Image
        source={{ uri }}
        style={slideStyles.image}
        contentFit="cover"
        cachePolicy="memory-disk"
        onLoadEnd={() => { setImgLoading(false); onReady?.() }}
        onError={() => { setImgLoading(false); onError(); onReady?.() }}
      />
      {imgLoading && (
        <View style={slideStyles.loader}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      )}
    </TouchableOpacity>
  )
}

const slideStyles = StyleSheet.create({
  slide: { width: SCREEN_W, height: CAROUSEL_H },
  image: { width: '100%', height: '100%' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
  },
})

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
  while (days.length % 7 !== 0) days.push({ day: 0, dateStr: '', empty: true })
  return days
}

function DatePickerModal({ visible, value, primary, onClose, onSelect }: {
  visible: boolean; value: string; primary: string; onClose: () => void; onSelect: (d: string) => void
}) {
  const [year, setYear] = useState(() => parseInt(value.slice(0, 4)))
  const [month, setMonth] = useState(() => parseInt(value.slice(5, 7)))
  useEffect(() => {
    if (visible) {
      setYear(parseInt(value.slice(0, 4)))
      setMonth(parseInt(value.slice(5, 7)))
    }
  }, [visible, value])

  const days = buildMonthDays(year, month)
  const numWeeks = Math.ceil(days.length / 7)

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

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
              <Text key={d} style={[dpStyles.weekday, i === 0 && { color: '#FF6B6B' }, i === 6 && { color: '#74B9FF' }]}>{d}</Text>
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
                  {!day.empty && (
                    <View style={[dpStyles.dayCircle, day.dateStr === value && { backgroundColor: primary }]}>
                      <Text style={[dpStyles.dayNum,
                        di === 0 && { color: '#FF6B6B' }, di === 6 && { color: '#74B9FF' },
                        day.dateStr === value && { color: '#fff' },
                      ]}>{day.day}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
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
})

function RegionRow({ label, selected, primary, favorite, onPress, onToggleFavorite }: {
  label: string; selected: boolean; primary: string; favorite: boolean
  onPress: () => void; onToggleFavorite: () => void
}) {
  return (
    <TouchableOpacity style={[rpStyles.row, selected && { backgroundColor: primary + '18' }]} onPress={onPress}>
      <Text style={[rpStyles.rowText, selected && { color: primary, fontWeight: '700' }]} numberOfLines={1}>{label}</Text>
      <View style={rpStyles.rowRight}>
        {selected && <Text style={[rpStyles.check, { color: primary }]}>✓</Text>}
        <TouchableOpacity hitSlop={10} onPress={onToggleFavorite} style={rpStyles.starBtn}>
          <Ionicons name={favorite ? 'star' : 'star-outline'} size={19} color={favorite ? '#FFC94D' : '#ccc'} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

function RegionPickerModal({ visible, value, primary, onClose, onSelect }: {
  visible: boolean; value: string | null; primary: string
  onClose: () => void; onSelect: (code: string | null) => void
}) {
  const [step, setStep] = useState<'province' | 'city'>('province')
  const [province, setProvince] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const favoriteCodes = useFavoriteRegionsStore(s => s.codes)
  const toggleFavorite = useFavoriteRegionsStore(s => s.toggleFavorite)

  useEffect(() => {
    if (!visible) return
    setSearch('')
    const current = getRegionByCode(value)
    if (current) {
      setProvince(current.province)
      setStep('city')
    } else {
      setProvince(null)
      setStep('province')
    }
  }, [visible, value])

  const cities = province ? getRegionsByProvince(province) : []
  const searchTrimmed = search.trim()
  const searchResults = searchTrimmed
    ? REGIONS.filter(r => r.name.includes(searchTrimmed) || r.fullName.includes(searchTrimmed))
    : []
  const favoriteRegions = favoriteCodes
    .map(code => getRegionByCode(code))
    .filter((r): r is Region => !!r)

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[rpStyles.wrap, { paddingTop: TOP_PAD }]}>
        <View style={rpStyles.header}>
          {step === 'city' && !searchTrimmed ? (
            <TouchableOpacity onPress={() => setStep('province')} style={rpStyles.headerBtn}>
              <Text style={rpStyles.headerBtnText}>‹ 뒤로</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={rpStyles.headerBtn}>
              <Text style={rpStyles.headerBtnText}>취소</Text>
            </TouchableOpacity>
          )}
          <Text style={rpStyles.title}>{step === 'province' ? '시/도 선택' : province}</Text>
          <TouchableOpacity onPress={() => onSelect(null)} style={rpStyles.headerBtn}>
            <Text style={[rpStyles.headerBtnText, { textAlign: 'right' }]}>선택 안함</Text>
          </TouchableOpacity>
        </View>

        <View style={rpStyles.searchWrap}>
          <TextInput
            style={rpStyles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="지역 검색 (예: 강남구)"
            placeholderTextColor="#bbb"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {searchTrimmed ? (
          <FlatList
            data={searchResults}
            keyExtractor={r => r.code}
            contentContainerStyle={rpStyles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={rpStyles.emptyText}>검색 결과가 없어요</Text>}
            renderItem={({ item }) => (
              <RegionRow
                label={item.fullName}
                selected={item.code === value}
                primary={primary}
                favorite={favoriteCodes.includes(item.code)}
                onPress={() => onSelect(item.code)}
                onToggleFavorite={() => toggleFavorite(item.code)}
              />
            )}
          />
        ) : step === 'province' ? (
          <FlatList
            data={PROVINCES}
            keyExtractor={p => p}
            contentContainerStyle={rpStyles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={favoriteRegions.length > 0 ? (
              <View style={rpStyles.favSection}>
                <Text style={rpStyles.sectionLabel}>즐겨찾기</Text>
                {favoriteRegions.map(item => (
                  <RegionRow
                    key={item.code}
                    label={item.fullName}
                    selected={item.code === value}
                    primary={primary}
                    favorite
                    onPress={() => onSelect(item.code)}
                    onToggleFavorite={() => toggleFavorite(item.code)}
                  />
                ))}
                <Text style={[rpStyles.sectionLabel, { marginTop: 14 }]}>시/도</Text>
              </View>
            ) : null}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={rpStyles.row}
                onPress={() => { setProvince(item); setStep('city') }}
              >
                <Text style={rpStyles.rowText}>{item}</Text>
                <Text style={rpStyles.chevron}>›</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <FlatList
            data={cities}
            keyExtractor={r => r.code}
            contentContainerStyle={rpStyles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <RegionRow
                label={item.name}
                selected={item.code === value}
                primary={primary}
                favorite={favoriteCodes.includes(item.code)}
                onPress={() => onSelect(item.code)}
                onToggleFavorite={() => toggleFavorite(item.code)}
              />
            )}
          />
        )}
      </View>
    </Modal>
  )
}

const rpStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderColor: '#f0f0f0',
  },
  headerBtn: { minWidth: 64, paddingHorizontal: 4, paddingVertical: 4 },
  headerBtnText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#888' },
  title: { fontFamily: FONT_HEADING, fontSize: 16, fontWeight: '700', color: '#222' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: {
    fontFamily: FONT_HEADING, fontSize: 15, color: '#222',
    backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
  },
  emptyText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#bbb', textAlign: 'center', marginTop: 24 },
  list: { padding: 16, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fafafa', borderRadius: 14, padding: 16,
  },
  rowText: { flex: 1, fontFamily: FONT_HEADING, fontSize: 15, color: '#333', marginRight: 8 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevron: { fontFamily: FONT_HEADING, fontSize: 20, color: '#ccc' },
  check: { fontFamily: FONT_HEADING, fontSize: 16, fontWeight: '700' },
  starBtn: { padding: 2 },
  favSection: { gap: 8, marginBottom: 14 },
  sectionLabel: { fontFamily: FONT_HEADING, fontSize: 13, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
})

export default function EventDetailScreen() {
  const { id, date, category } = useLocalSearchParams<{ id: string; date?: string; category?: string }>()
  const router = useRouter()
  const user = useAuthStore(s => s.user)
  const couple = useCoupleStore(s => s.couple)
  const partner = useCoupleStore(s => s.partner)
  const primary = THEMES[useThemeStore(s => s.themeKey)].color
  const isNew = id === 'new'

  const insets = useSafeAreaInsets()
  const [event, setEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [editing, setEditing] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [newMediaUrls, setNewMediaUrls] = useState<Set<string>>(new Set())
  const [viewingImageIdx, setViewingImageIdx] = useState<number | null>(null)
  const [viewerIdx, setViewerIdx] = useState(0)
  // 확대된 사진을 아래로 드래그하면 닫기 - 닫힐 때 상세화면 캐러셀도 보고 있던 사진으로 맞춤
  const closeViewer = () => {
    setViewingImageIdx(null)
    setPhotoIndex(viewerIdx)
    carouselRef.current?.scrollTo({ x: viewerIdx * SCREEN_W, animated: false })
  }
  const handleVerticalPull = (e: { translateY: number; released: boolean; velocityY: number }) => {
    'worklet'
    if (e.released) {
      const shouldClose = Math.abs(e.translateY) > 100 || Math.abs(e.velocityY) > 800
      if (shouldClose) runOnJS(closeViewer)()
    }
  }
  const [uploading, setUploading] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const carouselRef = useRef<ScrollView>(null)
  const [form, setForm] = useState({ title: '', description: '', category: (category as EventCategory | undefined) ?? 'date', isRecurring: false, icon: '' })
  const [linkedIdea, setLinkedIdea] = useState<DateIdea | null>(null)
  const [ideaPickerVisible, setIdeaPickerVisible] = useState(false)
  const [allIdeas, setAllIdeas] = useState<DateIdea[]>([])
  const [ideaSearch, setIdeaSearch] = useState('')
  const [eventDate, setEventDate] = useState(date ?? format(new Date(), 'yyyy-MM-dd'))
  const [datePickerVisible, setDatePickerVisible] = useState(false)
  const [newPhotos, setNewPhotos] = useState<string[]>([])
  const [regionCode, setRegionCode] = useState<string | null>(null)
  const [regionPickerVisible, setRegionPickerVisible] = useState(false)

  const loadEvent = useCallback(async () => {
    if (!id || isNew) return
    setLoading(true)
    try {
      const data = await calendarApi.getById(id)
      setEvent(data)
      setForm({ title: data.title, description: data.description ?? '', category: data.category, isRecurring: data.is_recurring ?? false, icon: data.icon ?? '' })
      setEventDate(data.event_date)
      setRegionCode(data.region_code ?? null)
      const imageUrls = (data.media ?? []).filter(m => m.media_type === 'image').map(m => m.url)
      if (imageUrls.length > 0) Image.prefetch(imageUrls)
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => { loadEvent() }, [loadEvent])

  useEffect(() => {
    if ((isNew || editing) && couple) {
      dateApi.getAll(couple.id).then(setAllIdeas).catch(() => {})
    }
  }, [isNew, editing, couple])

  useEffect(() => {
    if (editing && !isNew) {
      setLinkedIdea((event?.date_idea as DateIdea | undefined) ?? null)
    } else if (!editing && !isNew) {
      setLinkedIdea(null)
    }
  }, [editing])

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (isNew) {
        if (!couple || !user) return
        const created = await calendarApi.create({
          couple_id: couple.id,
          created_by: user.id,
          title: form.title,
          description: form.description || null,
          event_date: eventDate,
          category: form.category,
          is_completed: false,
          is_recurring: form.isRecurring,
          icon: form.icon || null,
          date_idea_id: form.category === 'anniversary' ? null : (linkedIdea?.id ?? null),
          region_code: regionCode,
        })
        if (newPhotos.length > 0) {
          setUploading(true)
          try {
            await Promise.all(newPhotos.map(uri => mediaApi.uploadImage(created.id, user.id, uri)))
          } finally {
            setUploading(false)
          }
        }
        if (partner?.push_token) {
          sendPushNotification(partner.push_token, '새 일정이 등록됐어요 💕', `"${form.title}" 일정이 추가됐어요`, { type: 'event', id: created.id })
        }
        router.back()
      } else {
        if (!event) return
        await calendarApi.update(event.id, {
          title: form.title,
          description: form.description,
          event_date: eventDate,
          category: form.category,
          is_recurring: form.isRecurring,
          icon: form.icon || null,
          date_idea_id: form.category === 'anniversary' ? null : (linkedIdea?.id ?? null),
          region_code: regionCode,
        })
        await loadEvent()
        setEditing(false)
      }
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!event) return
    Alert.alert('일정 삭제', `"${event.title}"을 삭제할까요?`, [
      { text: '취소' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await calendarApi.delete(event.id)
          router.back()
        }
      }
    ])
  }

  const handleAddImage = async () => {
    if (!event || !user) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요해요.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled || result.assets.length === 0) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        result.assets.map(async asset => {
          const compressed = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          )
          return mediaApi.uploadImage(event.id, user.id, compressed.uri)
        })
      )
      setEvent(prev => prev ? { ...prev, media: [...(prev.media ?? []), ...uploaded] } : prev)
      setNewMediaUrls(new Set(uploaded.map(m => m.url)))
    } catch (e: any) {
      Alert.alert('업로드 오류', e.message)
      setUploading(false)
    }
  }

  const handlePickNewPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요해요.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled || result.assets.length === 0) return
    setUploading(true)
    try {
      const compressed = await Promise.all(
        result.assets.map(async asset => {
          const c = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          )
          return c.uri
        })
      )
      setNewPhotos(prev => [...prev, ...compressed])
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteMedia = (media: EventMedia) => {
    Alert.alert('사진 삭제', '이 사진을 삭제할까요?', [
      { text: '취소' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await mediaApi.delete(media.id)
          setPhotoIndex(0)
          await loadEvent()
        }
      }
    ])
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={primary} size="large" />
      </View>
    )
  }

  if (!isNew && !event) return null

  const images = isNew ? [] : (event?.media ?? []).filter(m => m.media_type === 'image')

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: TOP_PAD }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        {editing ? (
          <TouchableOpacity onPress={() => setDatePickerVisible(true)}>
            <Text style={[styles.headerDate, { color: primary }]}>
              {format(new Date(eventDate), 'M월 d일 (E)', { locale: ko })} ✎
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.headerDate}>
            {isNew ? '일정 등록' : format(new Date(event!.event_date), 'M월 d일 (E)', { locale: ko })}
          </Text>
        )}
        {editing ? (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.actionText, { color: primary }]}>{saving ? '저장중...' : '저장'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={[styles.actionText, { color: primary }]}>수정</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 제목 */}
        {editing ? (
          <TextInput
            style={[styles.titleInput, { borderColor: primary }]}
            value={form.title}
            onChangeText={t => setForm(f => ({ ...f, title: t }))}
            placeholder="제목"
            placeholderTextColor="#aaa"
          />
        ) : (
          <Text style={styles.title}>{event!.title}</Text>
        )}

        {/* 카테고리 - 기념일이면 칩 숨김, 일정이면 기념일 제외 */}
        {editing && form.category !== 'anniversary' ? (
          <View style={styles.catRow}>
            {(Object.keys(CATEGORY_EMOJI) as EventCategory[])
              .filter(cat => cat !== 'anniversary')
              .map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, form.category === cat && { borderColor: primary, backgroundColor: primary + '18' }]}
                  onPress={() => setForm(f => ({ ...f, category: cat }))}
                >
                  <Text style={styles.catChipText}>{CATEGORY_EMOJI[cat]} {CATEGORY_LABEL[cat]}</Text>
                </TouchableOpacity>
              ))}
          </View>
        ) : !editing ? (
          <View style={[styles.badge, { borderColor: primary, backgroundColor: primary + '18' }]}>
            <Text style={[styles.badgeText, { color: primary }]}>{CATEGORY_EMOJI[event!.category]} {CATEGORY_LABEL[event!.category]}</Text>
          </View>
        ) : null}

        {/* 매년 반복 - 기념일일 때만 */}
        {(isNew || editing) && form.category === 'anniversary' && (
          <TouchableOpacity
            style={styles.recurringRow}
            onPress={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
            activeOpacity={0.7}
          >
            <View style={styles.recurringInfo}>
              <Text style={styles.recurringLabel}>매년 반복</Text>
              <Text style={styles.recurringDesc}>매년 같은 날에 기념일로 표시돼요</Text>
            </View>
            <View style={[styles.toggle, form.isRecurring && { backgroundColor: primary }]}>
              <View style={[styles.toggleThumb, form.isRecurring && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
        )}

        {/* 아이콘 선택 - 기념일일 때만 */}
        {(isNew || editing) && form.category === 'anniversary' && (
          <View style={styles.iconSection}>
            <Text style={styles.sectionLabel}>아이콘</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
              <View style={styles.iconRow}>
                {ANNIVERSARY_ICONS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.iconChip, form.icon === emoji && { borderColor: primary, backgroundColor: primary + '18' }]}
                    onPress={() => setForm(f => ({ ...f, icon: f.icon === emoji ? '' : emoji }))}
                  >
                    <Text style={styles.iconEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* 아이콘 표시 - 조회 모드 기념일 */}
        {!editing && !isNew && event?.category === 'anniversary' && event.icon && (
          <View style={styles.iconSection}>
            <Text style={styles.sectionLabel}>아이콘</Text>
            <Text style={styles.iconDisplay}>{event.icon}</Text>
          </View>
        )}

        {/* 버킷리스트 연결 - 편집/등록 모드, 기념일 제외 */}
        {(isNew || editing) && form.category !== 'anniversary' && (
          <View style={styles.bucketSection}>
            <Text style={styles.sectionLabel}>버킷리스트 연결</Text>
            {linkedIdea ? (
              <View style={[styles.linkedRow, { borderColor: primary, backgroundColor: primary + '18' }]}>
                <Text style={styles.linkedEmoji}>{DATE_CAT_EMOJI[linkedIdea.category]}</Text>
                <View style={styles.pickerItemBody}>
                  <Text style={styles.linkedTitle} numberOfLines={1}>{linkedIdea.title}</Text>
                  {linkedIdea.location ? (
                    <Text style={styles.pickerItemSub}>📍 {linkedIdea.location}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => setLinkedIdea(null)} style={styles.unlinkBtn}>
                  <Text style={styles.unlinkText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.pickIdeaBtn} onPress={() => setIdeaPickerVisible(true)}>
                <Text style={styles.pickIdeaText}>💭  버킷리스트에서 가져오기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 연결된 버킷리스트 - 조회 모드에서만, 기념일 제외 */}
        {!editing && !isNew && event?.category !== 'anniversary' && event?.date_idea && (
          <View style={styles.bucketSection}>
            <Text style={styles.sectionLabel}>연결된 버킷리스트</Text>
            <View style={[styles.linkedRow, { borderColor: primary, backgroundColor: primary + '18' }]}>
              <Text style={styles.linkedEmoji}>{DATE_CAT_EMOJI[event.date_idea.category]}</Text>
              <View style={styles.pickerItemBody}>
                <Text style={styles.linkedTitle}>{event.date_idea.title}</Text>
                {event.date_idea.location ? (
                  <Text style={styles.pickerItemSub}>📍 {event.date_idea.location}</Text>
                ) : null}
              </View>
              <Text style={{ fontFamily: FONT_HEADING, fontSize: 20, color: '#ccc' }}>›</Text>
            </View>
          </View>
        )}

        {/* 지역 - 편집/등록 모드 */}
        {(isNew || editing) && (
          <View style={styles.bucketSection}>
            <Text style={styles.sectionLabel}>지역</Text>
            {regionCode ? (
              <View style={[styles.linkedRow, { borderColor: primary, backgroundColor: primary + '18' }]}>
                <TouchableOpacity style={styles.regionRowBody} onPress={() => setRegionPickerVisible(true)}>
                  <Text style={styles.linkedEmoji}>📍</Text>
                  <View style={styles.pickerItemBody}>
                    <Text style={styles.linkedTitle}>{getRegionByCode(regionCode)?.fullName}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRegionCode(null)} style={styles.unlinkBtn}>
                  <Text style={styles.unlinkText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.pickIdeaBtn} onPress={() => setRegionPickerVisible(true)}>
                <Text style={styles.pickIdeaText}>📍  지역 선택하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 지역 표시 - 조회 모드 */}
        {!editing && !isNew && event?.region_code && (
          <View style={styles.bucketSection}>
            <Text style={styles.sectionLabel}>지역</Text>
            <View style={[styles.linkedRow, { borderColor: primary, backgroundColor: primary + '18' }]}>
              <Text style={styles.linkedEmoji}>📍</Text>
              <View style={styles.pickerItemBody}>
                <Text style={styles.linkedTitle}>{getRegionByCode(event.region_code)?.fullName}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 매년 반복 표시 - 조회 모드 기념일 */}
        {!editing && !isNew && event?.category === 'anniversary' && (
          <View style={styles.recurringRow}>
            <View style={styles.recurringInfo}>
              <Text style={styles.recurringLabel}>매년 반복</Text>
              <Text style={styles.recurringDesc}>매년 같은 날에 기념일로 표시돼요</Text>
            </View>
            <View style={[styles.toggle, event.is_recurring && { backgroundColor: primary }]}>
              <View style={[styles.toggleThumb, event.is_recurring && styles.toggleThumbOn]} />
            </View>
          </View>
        )}

        {/* 메모 */}
        <Text style={styles.sectionLabel}>메모</Text>
        {editing ? (
          <TextInput
            style={styles.descInput}
            value={form.description}
            onChangeText={t => setForm(f => ({ ...f, description: t }))}
            placeholder="메모를 입력하세요"
            placeholderTextColor="#aaa"
            multiline
          />
        ) : (
          <Text style={styles.desc}>{event!.description || '메모가 없어요'}</Text>
        )}

        {/* 사진 섹션 - 조회 모드에서 사진이 없으면 섹션 자체를 숨김 */}
        {(isNew || editing || images.length > 0) && (
          <View style={styles.photoHeader}>
            <Text style={styles.sectionLabel}>사진</Text>
            {!isNew && editing && (
              <TouchableOpacity
                style={[styles.addPhotoBtn, { backgroundColor: primary }]}
                onPress={handleAddImage}
                disabled={uploading}
              >
                <Text style={styles.addPhotoText}>+ 사진 추가</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isNew ? (
          newPhotos.length === 0 ? (
            <TouchableOpacity style={styles.emptyPhoto} onPress={handlePickNewPhotos} disabled={uploading}>
              <Text style={styles.emptyPhotoIcon}>📷</Text>
              <Text style={styles.emptyPhotoLabel}>사진을 추가해보세요</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.newPhotoScroll}>
              <View style={styles.newPhotoRow}>
                {newPhotos.map((uri, idx) => (
                  <View key={uri} style={styles.newPhotoThumbWrap}>
                    <Image source={{ uri }} style={styles.newPhotoThumb} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.newPhotoRemove}
                      onPress={() => setNewPhotos(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Text style={styles.newPhotoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.newPhotoAddTile, { borderColor: primary }]}
                  onPress={handlePickNewPhotos}
                  disabled={uploading}
                >
                  <Text style={[styles.newPhotoAddText, { color: primary }]}>+</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )
        ) : images.length === 0 ? (
          editing ? (
            <TouchableOpacity style={styles.emptyPhoto} onPress={handleAddImage} disabled={uploading}>
              <Text style={styles.emptyPhotoIcon}>📷</Text>
              <Text style={styles.emptyPhotoLabel}>사진을 추가해보세요</Text>
            </TouchableOpacity>
          ) : null
        ) : (
          <View>
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
                setPhotoIndex(idx)
              }}
            >
              {images.map((m, idx) => (
                <ImageSlide
                  key={m.id}
                  uri={m.url}
                  primaryColor={primary}
                  onPress={() => { setViewingImageIdx(idx); setViewerIdx(idx) }}
                  onLongPress={() => { if (editing) handleDeleteMedia(m) }}
                  onError={() => Alert.alert('이미지 로드 오류', `URL: ${m.url}\n\nSupabase Storage 버킷(event-images)이 public으로 설정됐는지 확인해주세요.`)}
                  onReady={newMediaUrls.has(m.url) ? () => {
                    setNewMediaUrls(prev => {
                      const next = new Set(prev)
                      next.delete(m.url)
                      if (next.size === 0) setUploading(false)
                      return next
                    })
                  } : undefined}
                />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === photoIndex && { backgroundColor: primary, width: 18, borderRadius: 3 }]} />
                ))}
              </View>
            )}
            {editing && (
              <Text style={styles.hintText}>길게 눌러서 사진 삭제</Text>
            )}
          </View>
        )}

        {/* 일정 삭제 */}
        {!isNew && (
          <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: primary + '18' }]} onPress={handleDelete}>
            <Text style={[styles.deleteText, { color: primary }]}>일정 삭제</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 버킷리스트 피커 */}
      <Modal visible={ideaPickerVisible} animationType="slide" statusBarTranslucent onRequestClose={() => { setIdeaPickerVisible(false); setIdeaSearch('') }}>
        <View style={[styles.pickerWrap, { paddingTop: insets.top }]}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => { setIdeaPickerVisible(false); setIdeaSearch('') }}>
              <Text style={styles.pickerCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>버킷리스트</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.pickerSearchWrap}>
            <TextInput
              style={styles.pickerSearch}
              placeholder="검색..."
              placeholderTextColor="#bbb"
              value={ideaSearch}
              onChangeText={setIdeaSearch}
              clearButtonMode="while-editing"
            />
          </View>
          <FlatList
            data={allIdeas.filter(i => i.title.includes(ideaSearch) || (i.location ?? '').includes(ideaSearch))}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.pickerList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.pickerEmpty}>버킷리스트가 없어요{'\n'}먼저 버킷리스트 탭에서 추가해보세요 💭</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => {
                  setLinkedIdea(item)
                  setForm(f => ({ ...f, title: item.title }))
                  setIdeaPickerVisible(false)
                  setIdeaSearch('')
                }}
              >
                <Text style={styles.pickerItemEmoji}>{DATE_CAT_EMOJI[item.category]}</Text>
                <View style={styles.pickerItemBody}>
                  <Text style={styles.pickerItemTitle}>{item.title}</Text>
                  {item.location ? <Text style={styles.pickerItemSub}>📍 {item.location}</Text> : null}
                </View>
                {item.status === 'completed'
                  ? <Text style={styles.pickerDoneBadge}>완료</Text>
                  : <Text style={styles.pickerChevron}>›</Text>
                }
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      <DatePickerModal
        visible={datePickerVisible}
        value={eventDate}
        primary={primary}
        onClose={() => setDatePickerVisible(false)}
        onSelect={d => { setEventDate(d); setDatePickerVisible(false) }}
      />

      <RegionPickerModal
        visible={regionPickerVisible}
        value={regionCode}
        primary={primary}
        onClose={() => setRegionPickerVisible(false)}
        onSelect={code => { setRegionCode(code); setRegionPickerVisible(false) }}
      />

      <Modal visible={viewingImageIdx !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={closeViewer}>
        {viewingImageIdx !== null && (
          <View style={styles.imageViewerBg}>
            <Gallery
              data={images}
              keyExtractor={m => m.id}
              initialIndex={viewingImageIdx}
              onIndexChange={setViewerIdx}
              onVerticalPull={handleVerticalPull}
              renderItem={m => <GalleryImageItem uri={m.url} />}
            />
            {images.length > 1 && (
              <View style={styles.viewerDotsRow}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.viewerDot, i === viewerIdx && styles.viewerDotActive]} />
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.imageViewerClose} onPress={closeViewer}>
              <Text style={styles.imageViewerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {uploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadBox}>
            <ActivityIndicator color={primary} size="large" />
            <Text style={styles.uploadText}>사진 처리 중...</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  imageViewerBg: { flex: 1, backgroundColor: '#000' },
  imageViewerImg: { width: SCREEN_W, height: '100%' },
  imageViewerClose: { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  imageViewerCloseText: { color: '#fff', fontSize: 16 },
  viewerDotsRow: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  viewerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  viewerDotActive: { backgroundColor: '#fff', width: 18, borderRadius: 3 },
  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  uploadBox: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 28, paddingHorizontal: 40, alignItems: 'center', gap: 14 },
  uploadText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#333' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4, minWidth: 40 },
  backIcon: { fontSize: 32, color: '#333', lineHeight: 36 },
  headerDate: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600', color: '#555' },
  actionText: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '700', color: PINK, minWidth: 40, textAlign: 'right' },
  scroll: { flex: 1 },
  scrollContent: { padding: CONTENT_PAD, gap: 16, paddingBottom: 48 },
  title: { fontFamily: FONT_HEADING, fontSize: 28, color: '#222' },
  titleInput: {
    fontFamily: FONT_HEADING, fontSize: 26, color: '#222',
    borderBottomWidth: 2, borderColor: PINK,
    paddingVertical: 8, paddingHorizontal: 0,
    lineHeight: 34,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: 'transparent' },
  catChipActive: { borderColor: PINK, backgroundColor: '#fff5f9' },
  catChipText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#555' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#fff5f9', borderWidth: 1.5, borderColor: PINK },
  badgeText: { fontFamily: FONT_HEADING, fontSize: 15, color: PINK, fontWeight: '600' },
  sectionLabel: { fontFamily: FONT_HEADING, fontSize: 14, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5 },
  desc: { fontFamily: FONT_HEADING, fontSize: 15, color: '#555', lineHeight: 24, marginTop: -8 },
  descInput: {
    fontFamily: FONT_HEADING, fontSize: 15, color: '#333', lineHeight: 22,
    borderWidth: 1.5, borderColor: '#ececec', borderRadius: 12,
    padding: 14, minHeight: 100, marginTop: -8,
  },
  photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addPhotoBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: PINK, minWidth: 80, alignItems: 'center' },
  addPhotoText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyPhoto: {
    height: 140, borderRadius: 16, backgroundColor: '#f9f9f9',
    borderWidth: 1.5, borderColor: '#e8e8e8', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: -8,
  },
  emptyPhotoIcon: { fontSize: 40 },
  emptyPhotoLabel: { fontFamily: FONT_HEADING, fontSize: 15, color: '#bbb' },
  // 캐러셀 - 좌우 패딩 상쇄해서 전체 너비 사용
  carousel: {
    marginHorizontal: -CONTENT_PAD,
    height: CAROUSEL_H,
  },
  slide: {
    width: SCREEN_W,
    height: CAROUSEL_H,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  // 등록 모드 - 로컬 사진 미리보기
  newPhotoScroll: { marginHorizontal: -CONTENT_PAD },
  newPhotoRow: { flexDirection: 'row', gap: 10, paddingHorizontal: CONTENT_PAD, paddingVertical: 4 },
  newPhotoThumbWrap: { width: 90, height: 90, borderRadius: 14, overflow: 'visible' },
  newPhotoThumb: { width: '100%', height: '100%', borderRadius: 14 },
  newPhotoRemove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  newPhotoRemoveText: { color: '#fff', fontSize: 11 },
  newPhotoAddTile: {
    width: 90, height: 90, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: '#fafafa',
    alignItems: 'center', justifyContent: 'center',
  },
  newPhotoAddText: { fontSize: 28, fontWeight: '300' },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ddd' },
  dotActive: { backgroundColor: PINK, width: 18, borderRadius: 3 },
  hintText: { fontFamily: FONT_HEADING, textAlign: 'center', fontSize: 14, color: '#ccc', marginTop: 6 },
  deleteBtn: { marginTop: 8, padding: 16, borderRadius: 14, backgroundColor: '#fff0f0', alignItems: 'center' },
  deleteText: { fontFamily: FONT_HEADING, color: '#ff4757', fontWeight: '600', fontSize: 15 },

  // 아이콘 선택
  iconSection: { gap: 8 },
  iconScroll: { marginHorizontal: -CONTENT_PAD },
  iconRow: { flexDirection: 'row', gap: 8, paddingHorizontal: CONTENT_PAD, paddingVertical: 4 },
  iconChip: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: '#ececec', backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 24 },
  iconDisplay: { fontSize: 40 },

  // 매년 반복 토글
  recurringRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, gap: 12 },
  recurringInfo: { flex: 1 },
  recurringLabel: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600', color: '#333' },
  recurringDesc: { fontFamily: FONT_HEADING, fontSize: 15, color: '#aaa', marginTop: 2 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#ddd', justifyContent: 'center', paddingHorizontal: 3 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // 버킷리스트 연결
  bucketSection: { gap: 8 },
  linkedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff5f9', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: PINK, gap: 10 },
  regionRowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkedEmoji: { fontSize: 20 },
  linkedTitle: { fontFamily: FONT_HEADING, fontSize: 14, fontWeight: '600', color: '#333' },
  unlinkBtn: { padding: 4 },
  unlinkText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#aaa' },
  pickIdeaBtn: { padding: 14, borderRadius: 12, backgroundColor: '#f9f9f9', borderWidth: 1.5, borderColor: '#ececec', alignItems: 'center' },
  pickIdeaText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#888' },

  // 피커 모달
  pickerWrap: { flex: 1, backgroundColor: '#fff' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  pickerSearchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f5f5f5' },
  pickerSearch: { fontFamily: FONT_HEADING, fontSize: 15, backgroundColor: '#f7f7f7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#333' },
  pickerCancel: { fontFamily: FONT_HEADING, fontSize: 16, color: '#888', minWidth: 40 },
  pickerTitle: { fontFamily: FONT_HEADING, fontSize: 17, fontWeight: '700', color: '#222' },
  pickerList: { padding: 16, gap: 10 },
  pickerEmpty: { fontFamily: FONT_HEADING, textAlign: 'center', color: '#bbb', marginTop: 60, fontSize: 14, lineHeight: 22 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12, borderWidth: 1.5, borderColor: '#f0f0f0' },
  pickerItemEmoji: { fontSize: 24 },
  pickerItemBody: { flex: 1 },
  pickerItemTitle: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600', color: '#333' },
  pickerItemSub: { fontFamily: FONT_HEADING, fontSize: 15, color: '#888', marginTop: 2 },
  pickerChevron: { fontFamily: FONT_HEADING, fontSize: 22, color: '#ccc' },
  pickerDoneBadge: { fontFamily: FONT_HEADING, fontSize: 12, color: '#52c41a', backgroundColor: '#f0fff4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
})
