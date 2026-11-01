import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { dateApi, calendarApi } from '../lib/api'
import { sendPushNotification } from '../lib/notifications'
import { useAuthStore, useCoupleStore, useThemeStore } from '../store'
import type { DateIdea, DateCategory, CalendarEvent, InstagramLink } from '../types'
import { FONT_HEADING, PINK, THEMES } from '../theme'
import ReelViewerScreen from './ReelViewerScreen'

const CATEGORIES: { key: DateCategory; label: string; emoji: string }[] = [
  { key: 'restaurant', label: '맛집', emoji: '🍽️' },
  { key: 'travel', label: '여행', emoji: '✈️' },
  { key: 'activity', label: '액티비티', emoji: '🎯' },
  { key: 'movie', label: '영화', emoji: '🎬' },
  { key: 'home', label: '홈데이트', emoji: '🏠' },
  { key: 'other', label: '기타', emoji: '💫' },
]

type UITab = 'uncompleted' | 'completed'

const STATUS_TABS: { key: UITab; label: string; emoji: string }[] = [
  { key: 'uncompleted', label: '미완료', emoji: '💭' },
  { key: 'completed', label: '완료', emoji: '✅' },
]

export default function DateIdeasScreen() {
  const user = useAuthStore(s => s.user)
  const couple = useCoupleStore(s => s.couple)
  const partner = useCoupleStore(s => s.partner)
  const primary = THEMES[useThemeStore(s => s.themeKey)].color
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<UITab>('uncompleted')
  const [ideas, setIdeas] = useState<DateIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'restaurant' as DateCategory, location: '', instagramUrls: [] as string[] })
  const [selectedIdea, setSelectedIdea] = useState<DateIdea | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingOriginalLinks, setEditingOriginalLinks] = useState<InstagramLink[]>([])
  const [linkedEvents, setLinkedEvents] = useState<CalendarEvent[]>([])
  const [loadingLinked, setLoadingLinked] = useState(false)
  const [viewerIdea, setViewerIdea] = useState<DateIdea | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)

  const resetForm = () => {
    setForm({ title: '', description: '', category: 'restaurant', location: '', instagramUrls: [] })
    setEditingId(null)
    setEditingOriginalLinks([])
  }

  const load = useCallback(async () => {
    if (!couple) return
    setLoading(true)
    try {
      const data = activeTab === 'uncompleted'
        ? await dateApi.getUncompleted(couple.id)
        : await dateApi.getByStatus(couple.id, 'completed')
      setIdeas(data)
    } finally {
      setLoading(false)
    }
  }, [couple, activeTab])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load() }, [load]))

  // 상세 열릴 때 연결 일정 로드
  useEffect(() => {
    if (!selectedIdea) { setLinkedEvents([]); return }
    setLoadingLinked(true)
    calendarApi.getByDateIdea(selectedIdea.id)
      .then(setLinkedEvents)
      .catch(() => {})
      .finally(() => setLoadingLinked(false))
  }, [selectedIdea])

  const handleSave = async () => {
    if (!form.title.trim() || !couple || !user) return
    setSaving(true)
    try {
      // 기존 링크는 좋아요 상태를 유지하고, 새로 추가된 링크만 liked:false로 시작
      const instagramLinks: InstagramLink[] = form.instagramUrls.map(url => ({
        url,
        liked: editingOriginalLinks.find(l => l.url === url)?.liked ?? false,
      }))
      if (editingId) {
        await dateApi.update(editingId, {
          title: form.title,
          description: form.description || null,
          category: form.category,
          location: form.location || null,
          instagram_links: instagramLinks,
        })
      } else {
        const created = await dateApi.create({
          couple_id: couple.id,
          created_by: user.id,
          title: form.title,
          description: form.description || null,
          status: 'wishlist',
          category: form.category,
          location: form.location || null,
          instagram_links: instagramLinks,
          completed_at: null,
        })
        if (partner?.push_token) {
          sendPushNotification(partner.push_token, '새 버킷리스트가 등록됐어요 🧺', `"${created.title}"이(가) 추가됐어요`, { type: 'date_idea', id: created.id })
        }
      }
      setShowForm(false)
      resetForm()
      load()
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (idea: DateIdea) => {
    setForm({
      title: idea.title,
      description: idea.description ?? '',
      category: idea.category,
      location: idea.location ?? '',
      instagramUrls: (idea.instagram_links ?? []).map(l => l.url),
    })
    setEditingId(idea.id)
    setEditingOriginalLinks(idea.instagram_links ?? [])
    setSelectedIdea(null)
    setShowForm(true)
  }

  const handleComplete = async (idea: DateIdea) => {
    try {
      await dateApi.complete(idea.id)
      setSelectedIdea(null)
      load()
    } catch (e: any) {
      Alert.alert('오류', e.message)
    }
  }

  const handleDelete = (idea: DateIdea) => {
    Alert.alert('삭제', `"${idea.title}" 를 삭제할까요?`, [
      { text: '취소' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => { await dateApi.delete(idea.id); setSelectedIdea(null); load() },
      },
    ])
  }

  const applyLinksUpdate = (ideaId: string, updatedLinks: InstagramLink[]) => {
    setIdeas(prev => prev.map(i => (i.id === ideaId ? { ...i, instagram_links: updatedLinks } : i)))
    setSelectedIdea(prev => (prev && prev.id === ideaId ? { ...prev, instagram_links: updatedLinks } : prev))
    setViewerIdea(prev => (prev && prev.id === ideaId ? { ...prev, instagram_links: updatedLinks } : prev))
  }

  const handleToggleLike = async (ideaId: string, url: string) => {
    const idea = ideas.find(i => i.id === ideaId) ?? selectedIdea ?? viewerIdea
    if (!idea) return
    const updatedLinks = idea.instagram_links.map(l =>
      l.url === url ? { ...l, liked: !l.liked } : l
    )
    applyLinksUpdate(ideaId, updatedLinks)
    try {
      await dateApi.update(ideaId, { instagram_links: updatedLinks })
    } catch (e: any) {
      Alert.alert('오류', e.message)
    }
  }

  const handleAddLink = async (ideaId: string, url: string, memo: string | null) => {
    const idea = ideas.find(i => i.id === ideaId) ?? selectedIdea ?? viewerIdea
    if (!idea) return
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    const updatedLinks = [...idea.instagram_links, { url: normalized, liked: false, memo }]
    applyLinksUpdate(ideaId, updatedLinks)
    try {
      await dateApi.update(ideaId, { instagram_links: updatedLinks })
      if (partner?.push_token) {
        sendPushNotification(partner.push_token, '새 릴스가 등록됐어요 🎬', `"${idea.title}"에 같이 볼 영상이 추가됐어요`, { type: 'reel', id: ideaId })
      }
    } catch (e: any) {
      Alert.alert('오류', e.message)
    }
  }

  const handleDeleteLink = async (ideaId: string, url: string) => {
    const idea = ideas.find(i => i.id === ideaId) ?? selectedIdea ?? viewerIdea
    if (!idea) return
    const updatedLinks = idea.instagram_links.filter(l => l.url !== url)
    applyLinksUpdate(ideaId, updatedLinks)
    try {
      await dateApi.update(ideaId, { instagram_links: updatedLinks })
    } catch (e: any) {
      Alert.alert('오류', e.message)
    }
  }

  const openViewer = (idea: DateIdea, index = 0) => {
    setViewerIdea(idea)
    setViewerIndex(index)
  }

  const router = useRouter()
  const params = useLocalSearchParams<{ openId?: string; openReel?: string }>()

  // 알림을 탭해서 특정 버킷리스트(또는 그 릴스)로 바로 이동해야 하는 경우
  useEffect(() => {
    if (!params.openId) return
    const ideaId = params.openId
    const openReel = params.openReel === '1'
    dateApi.getById(ideaId).then(idea => {
      if (!idea) return
      if (openReel) openViewer(idea)
      else setSelectedIdea(idea)
    }).catch(() => {})
    router.setParams({ openId: undefined, openReel: undefined })
  }, [params.openId, params.openReel])

  const getCatInfo = (cat: DateCategory) =>
    CATEGORIES.find(c => c.key === cat) ?? { key: cat, label: '기타', emoji: '💫' }

  const viewerLinks = viewerIdea?.instagram_links ?? []

  return (
    <View style={styles.container}>
      {/* 탭 */}
      <View style={styles.tabRow}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && { backgroundColor: primary + '18' }]}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && { color: primary, fontWeight: '700' }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 목록 */}
      {loading
        ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={primary} />
          </View>
        )
        : (
          <FlatList
            data={ideas}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyCircle, { backgroundColor: primary + '18' }]}>
                  <Text style={styles.emptyIcon}>{activeTab === 'uncompleted' ? '🧺' : '🎉'}</Text>
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'uncompleted' ? '아직 비어있어요' : '완료한 데이트가 없어요'}
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'uncompleted'
                    ? '함께 하고 싶은 데이트 아이디어를 적어봐요'
                    : '리스트를 하나씩 완료하며 채워가요'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const cat = getCatInfo(item.category)
              return (
                <TouchableOpacity style={styles.card} onPress={() => setSelectedIdea(item)} activeOpacity={0.75}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardEmoji}>{cat.emoji}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.cardReelBtn, { backgroundColor: primary + '18' }]}
                    onPress={() => openViewer(item)}
                    hitSlop={8}
                  >
                    <Text style={[styles.cardReelBtnText, { color: primary }]}>
                      {item.instagram_links?.length > 0 ? '🎬 릴스보기' : '🎬 릴스등록'}
                    </Text>
                  </TouchableOpacity>
                  {activeTab === 'completed' && <Text style={styles.checkMark}>✅</Text>}
                </TouchableOpacity>
              )
            }}
          />
        )
      }

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: primary, shadowColor: primary }]} onPress={() => setShowForm(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── 상세 전체화면 ── */}
      <Modal visible={!!selectedIdea} animationType="slide" statusBarTranslucent>
        {selectedIdea && (
          <View style={styles.detailWrap}>
            {/* 헤더 */}
            <View style={[styles.detailHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => setSelectedIdea(null)}>
                <Text style={styles.detailClose}>닫기</Text>
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>상세보기</Text>
              <TouchableOpacity onPress={() => handleEdit(selectedIdea)}>
                <Text style={[styles.detailEditBtn, { color: primary }]}>수정</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={[styles.detailContent, { paddingBottom: insets.bottom + 32 }]}
              keyboardShouldPersistTaps="handled"
            >
              {/* 카테고리 뱃지 */}
              <View style={[styles.catBadge, { borderColor: primary, backgroundColor: primary + '18' }]}>
                <Text style={[styles.catBadgeText, { color: primary }]}>
                  {getCatInfo(selectedIdea.category).emoji}  {getCatInfo(selectedIdea.category).label}
                </Text>
              </View>

              {/* 제목 */}
              <Text style={styles.detailTitle}>{selectedIdea.title}</Text>

              {/* 장소 */}
              {selectedIdea.location ? (
                <Text style={styles.detailLocation}>📍  {selectedIdea.location}</Text>
              ) : null}

              {/* 메모 */}
              {selectedIdea.description ? (
                <Text style={styles.detailMemo}>{selectedIdea.description}</Text>
              ) : null}

              {/* 완료 버튼 / 완료 뱃지 */}
              {selectedIdea.status !== 'completed' ? (
                <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(selectedIdea)}>
                  <Text style={styles.completeBtnText}>✅  완료로 표시</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>✅  완료된 데이트예요</Text>
                </View>
              )}

              {/* 연결된 일정 */}
              <Text style={styles.sectionLabel}>연결된 일정</Text>
              {loadingLinked ? (
                <ActivityIndicator color={primary} style={{ marginTop: 12 }} />
              ) : linkedEvents.length === 0 ? (
                <Text style={styles.linkedEmpty}>연결된 일정이 없어요</Text>
              ) : (
                <View style={styles.linkedList}>
                  {linkedEvents.map(ev => (
                    <TouchableOpacity
                      key={ev.id}
                      style={styles.linkedEventCard}
                      onPress={() => { setSelectedIdea(null); router.push(`/event/${ev.id}` as any) }}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linkedEventDate} numberOfLines={1}>
                          {format(new Date(ev.event_date), 'yyyy.M.d (E)', { locale: ko })}
                        </Text>
                        <Text style={styles.linkedEventTitle} numberOfLines={1}>{ev.title}</Text>
                      </View>
                      <Text style={styles.linkedEventChevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 삭제 */}
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: primary + '18' }]} onPress={() => handleDelete(selectedIdea)}>
                <Text style={[styles.deleteBtnText, { color: primary }]}>삭제</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── 등록 폼 ── */}
      <Modal visible={showForm} animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView style={styles.fsWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.fsHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm() }}>
              <Text style={styles.fsCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.fsTitle}>{editingId ? '데이트 수정' : '데이트 추가'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || !form.title.trim()}>
              <Text style={[styles.fsSave, { color: primary }, (!form.title.trim() || saving) && { opacity: 0.35 }]}>
                {saving ? '저장 중' : '저장'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.fsScroll}
            contentContainerStyle={[styles.fsContent, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fsLabel}>카테고리</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setForm(f => ({ ...f, category: cat.key }))}
                  style={[styles.catChip, form.category === cat.key && { borderColor: primary, backgroundColor: primary + '12' }]}
                >
                  <Text style={[styles.catChipText, form.category === cat.key && { color: primary }]}>
                    {cat.emoji} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fsLabel}>제목 <Text style={{ color: primary }}>*</Text></Text>
            <TextInput
              style={styles.fsInput}
              value={form.title}
              onChangeText={t => setForm(f => ({ ...f, title: t }))}
              placeholder="무슨 데이트를 하고 싶어요?"
              placeholderTextColor="#bbb"
              autoFocus
            />
            <Text style={styles.fsLabel}>장소</Text>
            <TextInput
              style={styles.fsInput}
              value={form.location}
              onChangeText={t => setForm(f => ({ ...f, location: t }))}
              placeholder="어디서 할까요? (선택)"
              placeholderTextColor="#bbb"
            />
            <Text style={styles.fsLabel}>메모</Text>
            <TextInput
              style={[styles.fsInput, styles.fsTextArea]}
              value={form.description}
              onChangeText={t => setForm(f => ({ ...f, description: t }))}
              placeholder="메모를 남겨보세요 (선택)"
              placeholderTextColor="#bbb"
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* 릴스로 보기 */}
      <Modal
        visible={!!viewerIdea}
        animationType="slide"
        statusBarTranslucent
        transparent
        onRequestClose={() => setViewerIdea(null)}
      >
        {viewerIdea && (
          <ReelViewerScreen
            title={viewerIdea.title}
            links={viewerLinks}
            initialIndex={viewerIndex}
            onClose={() => setViewerIdea(null)}
            onToggleLike={url => handleToggleLike(viewerIdea.id, url)}
            onAddLink={(url, memo) => handleAddLink(viewerIdea.id, url, memo)}
            onDeleteLink={url => handleDeleteLink(viewerIdea.id, url)}
          />
        )}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // 탭
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 4 },
  tabActive: { backgroundColor: '#fff0f5' },
  tabEmoji: { fontSize: 14 },
  tabText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#999', fontWeight: '500' },
  tabTextActive: { fontFamily: FONT_HEADING, color: PINK, fontWeight: '700' },

  // 목록
  list: { padding: 16, gap: 10 },
  emptyWrap: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 40 },
  emptyCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyIcon: { fontSize: 38 },
  emptyTitle: { fontFamily: FONT_HEADING, fontSize: 20, color: '#5B4A54', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontFamily: FONT_HEADING, fontSize: 15, color: '#B6A8A2', textAlign: 'center', lineHeight: 20 },
  empty: { fontFamily: FONT_HEADING, textAlign: 'center', color: '#bbb', marginTop: 60, fontSize: 15, lineHeight: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardLeft: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff5f9', alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600', color: '#333' },
  checkMark: { fontSize: 20 },
  cardReelBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  cardReelBtnText: { fontFamily: FONT_HEADING, fontSize: 12, fontWeight: '700' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: PINK, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 28, includeFontPadding: false, textAlign: 'center' },

  // 상세 전체화면
  detailWrap: { flex: 1, backgroundColor: '#fff' },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  detailClose: { fontFamily: FONT_HEADING, fontSize: 16, color: '#888', minWidth: 40 },
  detailHeaderTitle: { fontFamily: FONT_HEADING, fontSize: 17, fontWeight: '700', color: '#222' },
  detailEditBtn: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600' },
  detailContent: { padding: 24, gap: 12 },
  catBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#fff5f9', borderWidth: 1.5, borderColor: PINK },
  catBadgeText: { fontFamily: FONT_HEADING, fontSize: 15, color: PINK, fontWeight: '600' },
  detailTitle: { fontFamily: FONT_HEADING, fontSize: 26, color: '#222' },
  detailLocation: { fontFamily: FONT_HEADING, fontSize: 15, color: '#777' },
  detailMemo: { fontFamily: FONT_HEADING, fontSize: 15, color: '#999', lineHeight: 24 },
  completeBtn: { marginTop: 4, backgroundColor: '#f0fff4', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#52c41a' },
  completeBtnText: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '700', color: '#52c41a' },
  completedBadge: { marginTop: 4, backgroundColor: '#f6ffed', borderRadius: 14, padding: 16, alignItems: 'center' },
  completedBadgeText: { fontFamily: FONT_HEADING, fontSize: 14, color: '#52c41a', fontWeight: '600' },
  sectionLabel: { fontFamily: FONT_HEADING, fontSize: 14, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  linkedEmpty: { fontFamily: FONT_HEADING, fontSize: 14, color: '#ccc', marginTop: 4 },
  linkedList: { gap: 10, marginTop: 4 },
  linkedEventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#f0f0f0', gap: 10 },
  linkedEventDate: { fontFamily: FONT_HEADING, fontSize: 13, color: '#aaa' },
  linkedEventTitle: { fontFamily: FONT_HEADING, fontSize: 15, color: '#333' },
  linkedEventChevron: { fontFamily: FONT_HEADING, fontSize: 22, color: '#ccc' },
  deleteBtn: { marginTop: 8, padding: 16, borderRadius: 14, backgroundColor: '#fff0f0', alignItems: 'center' },
  deleteBtnText: { fontFamily: FONT_HEADING, color: '#ff4757', fontWeight: '600', fontSize: 15 },

  // 등록 폼 (전체화면)
  fsWrap: { flex: 1, backgroundColor: '#fff' },
  fsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  fsCancel: { fontFamily: FONT_HEADING, fontSize: 16, color: '#888' },
  fsTitle: { fontFamily: FONT_HEADING, fontSize: 17, fontWeight: '700', color: '#222' },
  fsSave: { fontFamily: FONT_HEADING, fontSize: 16, fontWeight: '700', color: PINK },
  fsScroll: { flex: 1 },
  fsContent: { padding: 24, gap: 8 },
  fsLabel: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  fsInput: {
    fontFamily: FONT_HEADING, fontSize: 16, color: '#222',
    borderWidth: 1.5, borderColor: '#ececec', borderRadius: 14,
    paddingHorizontal: 16, height: 52, marginTop: 6,
    backgroundColor: '#fafafa', textAlignVertical: 'center',
  },
  fsTextArea: { height: 120, textAlignVertical: 'top', paddingTop: 14, paddingBottom: 14 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: 'transparent' },
  catChipActive: { borderColor: PINK, backgroundColor: '#fff5f9' },
  catChipText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#666' },
})
