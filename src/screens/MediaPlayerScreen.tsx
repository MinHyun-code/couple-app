import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, Dimensions, ViewToken
} from 'react-native'
import YoutubeIframe from 'react-native-youtube-iframe'
import { useLocalSearchParams } from 'expo-router'
import { mediaApi, calendarApi } from '../lib/api'
import { useAuthStore } from '../store'
import type { EventMedia, CalendarEvent } from '../types'
import { FONT_HEADING } from '../theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function MediaPlayerScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const user = useAuthStore(s => s.user)
  const [event, setEvent] = useState<CalendarEvent | null>(null)
  const [mediaList, setMediaList] = useState<EventMedia[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [titleInput, setTitleInput] = useState('')

  useEffect(() => {
    if (eventId) loadData()
  }, [eventId])

  const loadData = async () => {
    const [ev, media] = await Promise.all([
      calendarApi.getById(eventId!),
      mediaApi.getByEvent(eventId!)
    ])
    setEvent(ev)
    setMediaList(media)
  }

  // 스크롤 시 현재 인덱스 업데이트
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index ?? 0
      setCurrentIndex(newIndex)
      setPlaying(true)
    }
  })

  const handleAddMedia = async () => {
    if (!urlInput.trim() || !user) return

    let platform: EventMedia['platform'] = 'other'
    let thumbnailUrl: string | null = null
    let finalTitle = titleInput

    if (urlInput.includes('youtube') || urlInput.includes('youtu.be')) {
      platform = 'youtube'
      const { thumbnailUrl: thumb } = mediaApi.parseYoutubeUrl(urlInput)
      thumbnailUrl = thumb
    } else if (urlInput.includes('instagram')) {
      platform = 'instagram'
    }

    try {
      await mediaApi.add({
        event_id: eventId!,
        added_by: user.id,
        media_type: 'video',
        url: urlInput,
        thumbnail_url: thumbnailUrl,
        title: finalTitle || null,
        platform,
        sort_order: mediaList.length,
      })
      setUrlInput('')
      setTitleInput('')
      setShowAddModal(false)
      loadData()
    } catch (e: any) {
      Alert.alert('오류', e.message)
    }
  }

  const getYoutubeId = (url: string) => {
    const { videoId } = mediaApi.parseYoutubeUrl(url)
    return videoId
  }

  return (
    <View style={styles.container}>
      {/* 상단 이벤트 정보 */}
      {event && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{event.title}</Text>
          <Text style={styles.headerDate}>{event.event_date}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ 영상 추가</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 인디케이터 */}
      {mediaList.length > 0 && (
        <View style={styles.indicator}>
          {mediaList.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* 영상 목록 (세로 스크롤) */}
      {mediaList.length === 0
        ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎬</Text>
            <Text style={styles.emptyText}>아직 영상이 없어요</Text>
            <Text style={styles.emptySub}>유튜브/인스타 링크를 추가해봐요</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyBtnText}>+ 영상 추가하기</Text>
            </TouchableOpacity>
          </View>
        )
        : (
          <FlatList
            data={mediaList}
            keyExtractor={item => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={SCREEN_HEIGHT - 120}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            renderItem={({ item, index }) => {
              const youtubeId = item.platform === 'youtube' ? getYoutubeId(item.url) : null

              return (
                <View style={[styles.videoSlide, { height: SCREEN_HEIGHT - 120 }]}>
                  {youtubeId ? (
                    <YoutubeIframe
                      height={280}
                      videoId={youtubeId}
                      play={index === currentIndex && playing}
                      onChangeState={(state) => {
                        if (state === 'ended') setPlaying(false)
                      }}
                    />
                  ) : (
                    <View style={styles.unsupportedVideo}>
                      <Text style={styles.unsupportedEmoji}>📱</Text>
                      <Text style={styles.unsupportedText}>Instagram 영상</Text>
                      <Text style={styles.unsupportedUrl} numberOfLines={1}>{item.url}</Text>
                    </View>
                  )}

                  {/* 영상 정보 */}
                  <View style={styles.videoInfo}>
                    {item.title && <Text style={styles.videoTitle}>{item.title}</Text>}
                    <Text style={styles.videoPlatform}>
                      {item.platform === 'youtube' ? '▶ YouTube' : '📸 Instagram'}
                    </Text>
                    <Text style={styles.videoCount}>{index + 1} / {mediaList.length}</Text>
                  </View>
                </View>
              )
            }}
          />
        )
      }

      {/* 영상 추가 모달 */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🎬 영상 추가</Text>
            <Text style={styles.modalSub}>유튜브 또는 인스타그램 링크를 붙여넣어요</Text>
            <TextInput
              style={styles.input}
              placeholder="https://youtube.com/... 또는 https://instagram.com/..."
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#aaa"
            />
            <TextInput
              style={styles.input}
              placeholder="제목 (선택)"
              value={titleInput}
              onChangeText={setTitleInput}
              placeholderTextColor="#aaa"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAddMedia}>
                <Text style={styles.confirmText}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const PINK = '#FF6B9D'
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { backgroundColor: '#111', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  headerTitle: { fontFamily: FONT_HEADING, flex: 1, color: '#fff', fontSize: 18 },
  headerDate: { fontFamily: FONT_HEADING, color: '#888', fontSize: 15 },
  addBtn: { backgroundColor: PINK, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addBtnText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 15 },
  indicator: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: '#111' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#444' },
  dotActive: { backgroundColor: PINK, width: 16 },
  videoSlide: { justifyContent: 'center', backgroundColor: '#000' },
  videoInfo: { padding: 20, gap: 4 },
  videoTitle: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 17 },
  videoPlatform: { fontFamily: FONT_HEADING, color: '#aaa', fontSize: 15 },
  videoCount: { fontFamily: FONT_HEADING, color: '#666', fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#111' },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 20 },
  emptySub: { fontFamily: FONT_HEADING, color: '#888', fontSize: 16 },
  emptyBtn: { backgroundColor: PINK, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  emptyBtnText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 16 },
  unsupportedVideo: { height: 280, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', gap: 8 },
  unsupportedEmoji: { fontSize: 40 },
  unsupportedText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 17 },
  unsupportedUrl: { fontFamily: FONT_HEADING, color: '#888', fontSize: 15, paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, gap: 12 },
  modalTitle: { fontFamily: FONT_HEADING, fontSize: 20, color: '#333' },
  modalSub: { fontFamily: FONT_HEADING, fontSize: 15, color: '#888', marginBottom: 4 },
  input: { fontFamily: FONT_HEADING, borderWidth: 1.5, borderColor: '#ececec', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#333' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center' },
  cancelText: { fontFamily: FONT_HEADING, color: '#666', fontSize: 16 },
  confirmBtn: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: PINK, alignItems: 'center' },
  confirmText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 16 },
})
