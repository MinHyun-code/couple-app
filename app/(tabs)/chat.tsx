import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ImageBackground,
} from 'react-native'
import { useFocusEffect, useNavigation } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore, useCoupleStore, useThemeStore } from '../../src/store'
import { messageApi } from '../../src/lib/api'
import { sendPushNotification } from '../../src/lib/notifications'
import { FONT_HEADING, THEMES } from '../../src/theme'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Message } from '../../src/types'

const PAGE_SIZE = 50

function DateSeparator({ date, hasBg }: { date: string; hasBg: boolean }) {
  const d = new Date(date)
  let label = format(d, 'yyyy년 M월 d일 (E)', { locale: ko })
  if (isToday(d)) label = '오늘'
  else if (isYesterday(d)) label = '어제'
  return (
    <View style={sep.wrap}>
      <View style={[sep.line, hasBg && { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
      <Text style={[sep.text, hasBg && { color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]}>{label}</Text>
      <View style={[sep.line, hasBg && { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
    </View>
  )
}

const sep = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#F0E8E4' },
  text: { fontFamily: FONT_HEADING, fontSize: 12, color: '#C9BDB8', marginHorizontal: 10 },
})

export default function ChatScreen() {
  const navigation = useNavigation()
  const headerHeight = useHeaderHeight()
  const { user } = useAuthStore()
  const { couple, partner } = useCoupleStore()
  const themeKey = useThemeStore(s => s.themeKey)
  const { color: primary, soft, bg } = THEMES[themeKey]

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [bgUri, setBgUri] = useState<string | null>(null)
  const listRef = useRef<FlatList>(null)

  const bgKey = user ? `chat_bg_${user.id}` : null

  // 배경 불러오기
  useEffect(() => {
    if (!bgKey) return
    AsyncStorage.getItem(bgKey).then(v => { if (v) setBgUri(v) }).catch(() => {})
  }, [bgKey])

  // 헤더 오른쪽 버튼
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleBgMenu} style={{ marginRight: 16 }}>
          <Ionicons name="image-outline" size={22} color="#B6A8A2" />
        </TouchableOpacity>
      ),
    })
  }, [bgUri, bgKey])

  const handleBgMenu = () => {
    Alert.alert('채팅 배경', '배경 이미지를 설정하세요', [
      { text: '앨범에서 선택', onPress: pickBg },
      ...(bgUri ? [{ text: '배경 제거', style: 'destructive' as const, onPress: removeBg }] : []),
      { text: '취소', style: 'cancel' },
    ])
  }

  const pickBg = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 접근 권한이 필요해요.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    const uri = result.assets[0].uri
    setBgUri(uri)
    if (bgKey) AsyncStorage.setItem(bgKey, uri).catch(() => {})
  }

  const removeBg = () => {
    setBgUri(null)
    if (bgKey) AsyncStorage.removeItem(bgKey).catch(() => {})
  }

  // 마운트 직후엔 스크롤이 아직 맨 아래로 내려가기 전이라 리스트가 "시작 지점"에 있는 것처럼
  // 보일 수 있고, 그 상태에서 onStartReached가 잘못 발동해 여분의 페이지를 미리 당겨오는 걸 막는다
  const readyForPaginationRef = useRef(false)

  const load = useCallback(async () => {
    if (!couple) return
    readyForPaginationRef.current = false
    try {
      const data = await messageApi.getRecent(couple.id, PAGE_SIZE)
      setMessages(data)
      setHasMore(data.length === PAGE_SIZE)
    } catch {}
    finally { setLoading(false) }
  }, [couple])

  useEffect(() => { load() }, [load])

  // 초기 로딩이 막 끝나 메시지가 전부 채워진 시점 — 최신 메시지가 보이도록 맨 아래로 내린다
  useEffect(() => {
    if (loading) return
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false })
      readyForPaginationRef.current = true
    })
  }, [loading])

  // 스크롤을 위로 올려 리스트 시작에 닿으면 이전 대화를 더 불러온다 (화면 위치는 그대로 유지됨)
  const loadOlder = useCallback(async () => {
    if (!readyForPaginationRef.current || !couple || loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]
      const older = await messageApi.getOlderThan(couple.id, oldest.created_at, PAGE_SIZE)
      setMessages(prev => [...older, ...prev])
      setHasMore(older.length === PAGE_SIZE)
    } catch {}
    finally { setLoadingMore(false) }
  }, [couple, loadingMore, hasMore, messages])

  useFocusEffect(useCallback(() => {
    if (!couple || !user) return
    messageApi.markAsRead(couple.id, user.id).catch(() => {})
    listRef.current?.scrollToEnd({ animated: false })
  }, [couple, user]))

  useEffect(() => {
    if (!couple) return
    const channel = messageApi.subscribe(
      couple.id,
      (msg) => {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
        if (msg.sender_id !== user?.id) {
          messageApi.markAsRead(couple.id, user!.id).catch(() => {})
        }
      },
      (messageId, readAt) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read_at: readAt } : m))
      }
    )
    return () => { channel.unsubscribe() }
  }, [couple, user])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !couple || !user || sending) return
    setInput('')
    setSending(true)
    try {
      const msg = await messageApi.send(couple.id, user.id, text)
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
      if (partner?.push_token) {
        const myNickname = couple ? (couple.user1_id === user.id ? couple.nickname_for_user1 : couple.nickname_for_user2) : null
        sendPushNotification(partner.push_token, myNickname ?? '메시지가 도착했어요', text, { type: 'chat' })
      }
    } catch (e: any) {
      Alert.alert('전송 실패', e.message)
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const handleLongPress = (msg: Message) => {
    if (msg.sender_id !== user?.id) return
    Alert.alert('메시지 삭제', '이 메시지를 삭제할까요?', [
      { text: '취소' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await messageApi.delete(msg.id)
          setMessages(prev => prev.filter(m => m.id !== msg.id))
        }
      },
    ])
  }

  const lastReadIdx = messages.reduce((acc, m, i) => m.sender_id === user?.id && m.read_at ? i : acc, -1)

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_id === user?.id
    const prev = messages[index - 1]
    const showDate = !prev || !isSameDay(new Date(prev.created_at), new Date(item.created_at))
    const prevSame = prev && prev.sender_id === item.sender_id && !showDate
    const partnerNickname = couple ? (couple.user1_id === user?.id ? couple.nickname_for_user2 : couple.nickname_for_user1) : null
    const senderName = isMine ? (user?.display_name ?? '나') : (partnerNickname ?? partner?.display_name ?? '상대방')
    const avatarUrl = isMine ? user?.avatar_url : partner?.avatar_url
    const showAvatar = !isMine && !prevSame
    const showRead = isMine && index === lastReadIdx

    return (
      <>
        {showDate && <DateSeparator date={item.created_at} hasBg={!!bgUri} />}
        <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
          {!isMine && (
            <View style={styles.avatarSlot}>
              {showAvatar ? (
                avatarUrl
                  ? <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                  : <View style={[styles.avatar, { backgroundColor: primary + '30', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontFamily: FONT_HEADING, fontSize: 14, color: primary }}>{senderName[0]}</Text>
                    </View>
              ) : <View style={styles.avatarSlot} />}
            </View>
          )}

          <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
            {!isMine && showAvatar && <Text style={styles.senderName}>{senderName}</Text>}
            <View style={styles.bubbleRow}>
              {isMine && (
                <View style={styles.myMeta}>
                  {showRead && <Text style={styles.readText}>읽음</Text>}
                  <Text style={styles.time}>{format(new Date(item.created_at), 'HH:mm')}</Text>
                </View>
              )}
              <TouchableOpacity
                onLongPress={() => handleLongPress(item)}
                activeOpacity={0.85}
                style={[
                  styles.bubble,
                  isMine
                    ? [styles.bubbleMine, { backgroundColor: primary }]
                    : [styles.bubbleTheirs, bgUri && styles.bubbleTheirsBg],
                ]}
              >
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                  {item.content}
                </Text>
              </TouchableOpacity>
              {!isMine && <Text style={styles.time}>{format(new Date(item.created_at), 'HH:mm')}</Text>}
            </View>
          </View>
        </View>
      </>
    )
  }

  const listContent = loading ? (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={primary} />
    </View>
  ) : (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
      initialNumToRender={messages.length}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      onStartReached={loadOlder}
      onStartReachedThreshold={0.5}
      ListHeaderComponent={
        loadingMore ? (
          <View style={styles.loadingMoreWrap}>
            <ActivityIndicator color={primary} size="small" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={[styles.emptyText, { color: bgUri ? '#fff' : primary }]}>첫 메시지를 보내보세요</Text>
          <Text style={[styles.emptySub, bgUri && { color: 'rgba(255,255,255,0.8)' }]}>소소한 일상부터 나눠봐요 ☺️</Text>
        </View>
      }
      keyboardShouldPersistTaps="handled"
    />
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      {bgUri ? (
        <ImageBackground source={{ uri: bgUri }} style={styles.bg} resizeMode="cover">
          <View style={styles.bgOverlay} />
          {listContent}
        </ImageBackground>
      ) : (
        <View style={[styles.bg, { backgroundColor: bg }]}>
          {listContent}
        </View>
      )}

      {/* 입력창 */}
      <View style={[styles.inputBar, { borderTopColor: '#F1E7E2', backgroundColor: '#fff' }]}>
        <TextInput
          style={[styles.input, { borderColor: soft }]}
          value={input}
          onChangeText={setInput}
          placeholder="메시지 입력..."
          placeholderTextColor="#C9BDB8"
          multiline
          maxLength={500}
          returnKeyType="default"
          includeFontPadding={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: input.trim() ? primary : '#EEE6E2' }]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendIcon}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.08)' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingMoreWrap: { paddingVertical: 12, alignItems: 'center' },
  list: { paddingTop: 8, paddingHorizontal: 12 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyText: { fontFamily: FONT_HEADING, fontSize: 18 },
  emptySub: { fontFamily: FONT_HEADING, fontSize: 14, color: '#C9BDB8' },

  row: { flexDirection: 'row', marginVertical: 2, alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },

  avatarSlot: { width: 34, marginRight: 6, alignItems: 'center', justifyContent: 'flex-end' },
  avatar: { width: 34, height: 34, borderRadius: 17 },

  bubbleWrap: { maxWidth: '75%' },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignItems: 'flex-start' },

  senderName: { fontFamily: FONT_HEADING, fontSize: 12, color: '#B6A8A2', marginBottom: 3, marginLeft: 4 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },

  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, maxWidth: '100%' },
  bubbleMine: {},
  bubbleTheirs: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0E8E4' },
  bubbleTheirsBg: { backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 0 },

  bubbleText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#333', lineHeight: 22 },
  bubbleTextMine: { color: '#fff' },

  myMeta: { alignItems: 'flex-end', justifyContent: 'flex-end', gap: 1 },
  readText: { fontFamily: FONT_HEADING, fontSize: 11, color: '#A8C5DA' },
  time: { fontFamily: FONT_HEADING, fontSize: 11, color: '#C9BDB8' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1, fontFamily: FONT_HEADING, fontSize: 15, color: '#333',
    backgroundColor: '#fff', borderWidth: 1.5,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11,
    minHeight: 44, maxHeight: 110, lineHeight: 22, textAlignVertical: 'center',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { fontFamily: FONT_HEADING, fontSize: 20, color: '#fff', lineHeight: 24 },
})
