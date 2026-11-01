import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, ViewToken, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { InstagramLink } from '../types'
import { FONT_HEADING, PINK } from '../theme'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')

// /embed/ 위젯은 원래 다른 웹사이트에 박아넣는 카드형 디자인이라 계속 PC스럽게 보였음.
// 대신 게시물 원본 링크를 모바일 UA로 그대로 열면, 폰 브라우저로 열었을 때와 동일한
// 실제 모바일 인스타그램 화면(영상 플레이어 + 좋아요/댓글 UI)이 보인다.
const toCleanUrl = (url: string) => url.trim().split('?')[0].replace(/\/+$/, '') + '/'

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'

// 로딩 중 흰 화면이 번쩍이지 않도록 배경만 검게 맞춘다 (레이아웃은 건드리지 않음)
const BACKGROUND_JS = `
document.documentElement.style.background = '#000';
document.body.style.background = '#000';
true;
`

// iOS/Android 모두 사용자 터치 없는 자동재생 영상은 무조건 음소거로 강제된다.
// 영상을 탭하는 순간 음소거를 풀어주는데, RN 브릿지로 한 번 메시지를 보내는 과정 자체가
// 필요했던 것으로 보여 (경고창이 아니라) postMessage 호출만 조용히 유지한다.
const UNMUTE_ON_TAP_JS = `
(function() {
  function unmute() {
    document.querySelectorAll('video').forEach(function(v) {
      try { v.muted = false; v.volume = 1; } catch (e) {}
    });
    try { window.ReactNativeWebView.postMessage('unmute'); } catch (e) {}
  }
  window.addEventListener('touchend', unmute, { capture: true });
  window.addEventListener('click', unmute, { capture: true });
})();
true;
`

type Props = {
  title: string
  links: InstagramLink[]
  initialIndex: number
  onClose: () => void
  onToggleLike: (url: string) => void
  onAddLink: (url: string, memo: string | null) => void
  onDeleteLink: (url: string) => void
}

// 좌우로 스와이프하면 닫히도록 (세로 스와이프는 릴스 넘기기용이라 건드리지 않음)
const HORIZONTAL_CLOSE_THRESHOLD = 80

export default function ReelViewerScreen({ title, links, initialIndex, onClose, onToggleLike, onAddLink, onDeleteLink }: Props) {
  const insets = useSafeAreaInsets()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  // 등록된 릴스가 하나도 없으면 빈 화면 대신 바로 링크 추가 시트를 띄워준다
  const [showAddModal, setShowAddModal] = useState(links.length === 0)
  const [urlInput, setUrlInput] = useState('')
  const [memoInput, setMemoInput] = useState('')

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0)
    }
  })

  const translateX = useSharedValue(0)

  // 가로로 15px 이상 움직여야 반응하고, 그 전에 세로로 10px 이상 움직이면
  // 이 제스처는 실패 처리되어 FlatList(세로 릴스 넘기기)로 그대로 넘어간다.
  // → 네이티브 스레드에서 방향을 먼저 판정하므로 PanResponder(JS 스레드)처럼 서로 씹히지 않음
  const closeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate(e => {
      translateX.value = e.translationX
    })
    .onEnd(e => {
      if (Math.abs(e.translationX) > HORIZONTAL_CLOSE_THRESHOLD) {
        const direction = e.translationX > 0 ? 1 : -1
        translateX.value = withTiming(direction * SCREEN_WIDTH, { duration: 200 }, finished => {
          if (finished) runOnJS(onClose)()
        })
      } else {
        translateX.value = withSpring(0)
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const handleAdd = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    onAddLink(trimmed, memoInput.trim() || null)
    setUrlInput('')
    setMemoInput('')
    setShowAddModal(false)
  }

  const handleDelete = (url: string) => {
    Alert.alert('삭제', '이 릴스를 삭제할까요?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: () => onDeleteLink(url) },
    ])
  }

  return (
    <GestureDetector gesture={closeGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
      <FlatList
        data={links}
        keyExtractor={item => item.url}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListEmptyComponent={
          <View style={[styles.empty, { paddingTop: insets.top + 68 }]}>
            <Text style={styles.emptyText}>아직 담아둔 릴스가 없어요</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyBtnText}>+ 링크 담기</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item, index }) => {
          const isNearby = Math.abs(index - currentIndex) <= 1
          return (
            <View style={[styles.slide, { height: SCREEN_HEIGHT, paddingTop: insets.top + 68 }]}>
              {/* 영상 카드 */}
              <View style={styles.card}>
                {isNearby ? (
                  <WebView
                    source={{ uri: toCleanUrl(item.url) }}
                    style={styles.webview}
                    userAgent={MOBILE_USER_AGENT}
                    startInLoadingState
                    renderLoading={() => (
                      <View style={styles.webviewLoading}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    )}
                    injectedJavaScript={BACKGROUND_JS + UNMUTE_ON_TAP_JS}
                    onMessage={() => {}}
                    scrollEnabled={false}
                    bounces={false}
                    overScrollMode="never"
                    allowsFullscreenVideo
                  />
                ) : (
                  <View style={styles.webviewLoading} />
                )}

                {/* 우측 세로 진행 표시 (여러 릴스가 있음을 알려줌) */}
                {links.length > 1 && (
                  <View style={styles.progressCol}>
                    {links.map((l, i) => (
                      <View
                        key={l.url}
                        style={[styles.progressBar, i === index && styles.progressBarActive]}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* 카드 아래 정보 영역 */}
              <View style={[styles.infoBlock, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.metaRow}>
                  <TouchableOpacity onPress={() => onToggleLike(item.url)} hitSlop={8}>
                    <Text style={styles.heart}>{item.liked ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.memo} numberOfLines={2}>{item.memo || title}</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.url)} hitSlop={8}>
                    <Text style={styles.trash}>🗑</Text>
                  </TouchableOpacity>
                </View>
                {index < links.length - 1 && (
                  <Text style={styles.hint}>︿ 위로 넘기면 다음 영상</Text>
                )}
              </View>
            </View>
          )
        }}
      />

      {/* 떠 있는 상단 필 버튼 */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.pill} onPress={onClose}>
          <Text style={styles.pillText}>담아둔 영상 {links.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pill} onPress={() => setShowAddModal(true)}>
          <Text style={styles.pillText}>+ 링크 담기</Text>
        </TouchableOpacity>
      </View>

      {/* 링크 추가 */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalBox, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.modalTitle}>같이 볼 영상 담기</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="instagram.com/reel/..."
              placeholderTextColor="#777"
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="메모 (선택) — 여기 가보자!"
              placeholderTextColor="#777"
              value={memoInput}
              onChangeText={setMemoInput}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => { setShowAddModal(false); setUrlInput(''); setMemoInput('') }}
              >
                <Text style={styles.modalCancel}>닫기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !urlInput.trim() && { opacity: 0.4 }]}
                onPress={handleAdd}
                disabled={!urlInput.trim()}
              >
                <Text style={styles.modalConfirmText}>담기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0d' },

  empty: { height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { fontFamily: FONT_HEADING, color: '#999', fontSize: 15 },
  emptyBtn: { backgroundColor: PINK, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24 },
  emptyBtnText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 15, fontWeight: '700' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  pillText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#fff', fontWeight: '600' },

  slide: { paddingHorizontal: 20, backgroundColor: '#0b0b0d' },

  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: { flex: 1, backgroundColor: '#000' },
  webviewLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },

  progressCol: {
    position: 'absolute', top: 16, right: 12,
    gap: 5,
  },
  progressBar: {
    width: 3, height: 22, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBarActive: { backgroundColor: '#fff' },

  infoBlock: { paddingTop: 16, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heart: { fontSize: 18 },
  memo: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  trash: { fontSize: 17, opacity: 0.7 },
  hint: { fontFamily: FONT_HEADING, color: '#777', fontSize: 12 },

  // 링크 추가 모달 (다크 테마)
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  modalTitle: { fontFamily: FONT_HEADING, fontSize: 18, fontWeight: '700', color: PINK, marginBottom: 4 },
  modalInput: {
    fontFamily: FONT_HEADING, fontSize: 15, color: '#fff',
    backgroundColor: '#26262a', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 4 },
  modalCancel: { fontFamily: FONT_HEADING, fontSize: 15, color: '#999' },
  modalConfirm: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 },
  modalConfirmText: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '700', color: '#111' },
})
