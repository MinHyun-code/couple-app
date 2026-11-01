import { supabase } from './supabase'
import * as ImageManipulator from 'expo-image-manipulator'
import type {
  User, Couple, CalendarEvent, DateIdea,
  Character, CharacterItem, EventMedia, EquippedItems, Message
} from '../types'

// ============================================================
// AUTH
// ============================================================
export const authApi = {
  signUp: async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } }
    })
    if (error) throw error
    return data
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  getSession: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  getUser: async () => {
    const { data } = await supabase.auth.getUser()
    return data.user
  },
}

// ============================================================
// USER PROFILE
// ============================================================
export const userApi = {
  getProfile: async (userId: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  createProfile: async (userId: string, email: string, displayName: string | null): Promise<User> => {
    const { data, error } = await supabase
      .from('users')
      .insert({ id: userId, email, display_name: displayName, provider: 'email' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  updateProfile: async (userId: string, updates: Partial<User>) => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  uploadAvatar: async (userId: string, uri: string): Promise<string> => {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )
    const res = await fetch(compressed.uri)
    const buf = await res.arrayBuffer()
    const path = `${userId}/avatar.jpg`
    const { error } = await supabase.storage.from('avatars').upload(path, buf, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    return `${publicUrl}?t=${Date.now()}`
  },
}

// ============================================================
// COUPLE
// ============================================================
export const coupleApi = {
  // 커플 생성 (초대 코드 자동 발급)
  create: async (userId: string): Promise<Couple> => {
    const { data, error } = await supabase
      .from('couples')
      .insert({ user1_id: userId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  // 초대 코드로 연동
  joinByCode: async (inviteCode: string, userId: string): Promise<Couple> => {
    const { data: couple, error: findError } = await supabase
      .from('couples')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle()
    if (findError || !couple) throw new Error('유효하지 않은 초대 코드예요.')
    if (couple.status === 'active') throw new Error('이미 사용된 초대 코드예요.')
    if (couple.user1_id === userId) throw new Error('본인의 초대 코드는 사용할 수 없어요.')

    const { data, error } = await supabase
      .from('couples')
      .update({ user2_id: userId, status: 'active' })
      .eq('id', couple.id)
      .select()
      .maybeSingle()
    if (error || !data) throw new Error('커플 연동에 실패했어요. 다시 시도해주세요.')
    return data
  },

  // 내 커플 조회
  getMine: async (userId: string): Promise<Couple | null> => {
    const { data, error } = await supabase
      .from('couples')
      .select(`*, user1:users!couples_user1_id_fkey(*), user2:users!couples_user2_id_fkey(*)`)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  },

  // 커플 정보 업데이트
  update: async (coupleId: string, updates: Partial<Couple>) => {
    const { data, error } = await supabase
      .from('couples')
      .update(updates)
      .eq('id', coupleId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // 커플 정보 변경 실시간 구독 (메뉴 설정 등 상대방과 공유되는 필드)
  subscribeToUpdates: (coupleId: string, onUpdate: (couple: Couple) => void) => {
    return supabase
      .channel(`couples:${coupleId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` },
        (payload) => onUpdate(payload.new as Couple)
      )
      .subscribe()
  },
}

// ============================================================
// CALENDAR
// ============================================================
export const calendarApi = {
  // 월별 일정 조회
  getByMonth: async (coupleId: string, year: number, month: number): Promise<CalendarEvent[]> => {
    const mm = String(month).padStart(2, '0')
    const start = `${year}-${mm}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

    // 현재 월 일정
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*, media:event_media(*)')
      .eq('couple_id', coupleId)
      .gte('event_date', start)
      .lte('event_date', end)
      .order('event_date', { ascending: true })
    if (error) throw error

    // 매년 반복 기념일 전체 조회 후 클라이언트에서 월 필터 (LIKE는 date 타입에 불안정)
    const { data: recurring } = await supabase
      .from('calendar_events')
      .select('*, media:event_media(*)')
      .eq('couple_id', coupleId)
      .eq('is_recurring', true)

    // 같은 월·다른 연도인 것만 현재 연도로 remapping해서 머지
    const existingDates = new Set((data ?? []).map(e => e.event_date))
    const virtualEvents = (recurring ?? [])
      .filter(e => {
        const parts = e.event_date.split('-')
        return parseInt(parts[0]) !== year && parseInt(parts[1]) === month
      })
      .map(e => {
        const remapped = `${year}${e.event_date.slice(4)}`
        const d = new Date(remapped)
        if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== remapped) return null
        if (existingDates.has(remapped)) return null
        return { ...e, event_date: remapped }
      })
      .filter((e): e is CalendarEvent => e !== null)

    return [...(data ?? []), ...virtualEvents].sort((a, b) => a.event_date.localeCompare(b.event_date))
  },

  // 단일 일정 조회 (미디어 + 연결된 버킷리스트 포함)
  getById: async (eventId: string): Promise<CalendarEvent> => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*, media:event_media(*), date_idea:date_ideas(*)')
      .eq('id', eventId)
      .single()
    if (error) throw error
    return data
  },

  // 지역이 설정된 모든 일정 조회 (지도용)
  getAllWithRegion: async (coupleId: string): Promise<CalendarEvent[]> => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('couple_id', coupleId)
      .not('region_code', 'is', null)
      .order('event_date', { ascending: false })
    if (error) throw error
    return data
  },

  // 특정 버킷리스트에 연결된 일정 목록
  getByDateIdea: async (ideaId: string): Promise<CalendarEvent[]> => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('date_idea_id', ideaId)
      .order('event_date', { ascending: false })
    if (error) throw error
    return data
  },

  // 일정 생성
  create: async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'media'>): Promise<CalendarEvent> => {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // 일정 수정
  update: async (eventId: string, updates: Partial<CalendarEvent>) => {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // 일정 삭제
  delete: async (eventId: string) => {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
    if (error) throw error
  },
}

// ============================================================
// DATE IDEAS
// ============================================================
export const dateApi = {
  getById: async (ideaId: string): Promise<DateIdea | null> => {
    const { data, error } = await supabase
      .from('date_ideas')
      .select('*')
      .eq('id', ideaId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  getAll: async (coupleId: string): Promise<DateIdea[]> => {
    const { data, error } = await supabase
      .from('date_ideas')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  getByStatus: async (coupleId: string, status: DateIdea['status']): Promise<DateIdea[]> => {
    const { data, error } = await supabase
      .from('date_ideas')
      .select('*')
      .eq('couple_id', coupleId)
      .eq('status', status)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  getUncompleted: async (coupleId: string): Promise<DateIdea[]> => {
    const { data, error } = await supabase
      .from('date_ideas')
      .select('*')
      .eq('couple_id', coupleId)
      .in('status', ['wishlist', 'planned'])
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  create: async (idea: Omit<DateIdea, 'id' | 'created_at'>): Promise<DateIdea> => {
    const { data, error } = await supabase
      .from('date_ideas')
      .insert(idea)
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (ideaId: string, updates: Partial<DateIdea>) => {
    const { data, error } = await supabase
      .from('date_ideas')
      .update(updates)
      .eq('id', ideaId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // 완료 처리
  complete: async (ideaId: string) => {
    const { data, error } = await supabase
      .from('date_ideas')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', ideaId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  delete: async (ideaId: string) => {
    const { error } = await supabase.from('date_ideas').delete().eq('id', ideaId)
    if (error) throw error
  },
}

// ============================================================
// CHARACTER
// ============================================================
export const characterApi = {
  getMine: async (coupleId: string, userId: string): Promise<Character | null> => {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('couple_id', coupleId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  getCouple: async (coupleId: string): Promise<Character[]> => {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('couple_id', coupleId)
    if (error) throw error
    return data
  },

  create: async (coupleId: string, userId: string, name: string): Promise<Character> => {
    const { data, error } = await supabase
      .from('characters')
      .insert({ couple_id: coupleId, user_id: userId, name })
      .select()
      .single()
    if (error) throw error
    return data
  },

  updateEquipped: async (characterId: string, items: EquippedItems) => {
    const { data, error } = await supabase
      .from('characters')
      .update({ equipped_items: items, updated_at: new Date().toISOString() })
      .eq('id', characterId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  getAllItems: async (): Promise<CharacterItem[]> => {
    const { data, error } = await supabase
      .from('character_items')
      .select('*')
      .order('unlock_level', { ascending: true })
    if (error) throw error
    return data
  },

  addExp: async (characterId: string, currentExp: number, currentLevel: number, addExp: number) => {
    const EXP_PER_LEVEL = 100
    let newExp = currentExp + addExp
    let newLevel = currentLevel
    while (newExp >= EXP_PER_LEVEL) {
      newExp -= EXP_PER_LEVEL
      newLevel++
    }
    const { data, error } = await supabase
      .from('characters')
      .update({ exp: newExp, level: newLevel })
      .eq('id', characterId)
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ============================================================
// EVENT MEDIA
// ============================================================
export const mediaApi = {
  getByEvent: async (eventId: string): Promise<EventMedia[]> => {
    const { data, error } = await supabase
      .from('event_media')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data
  },

  add: async (media: Omit<EventMedia, 'id' | 'created_at'>): Promise<EventMedia> => {
    const { data, error } = await supabase
      .from('event_media')
      .insert(media)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // 유튜브 URL에서 메타 파싱
  parseYoutubeUrl: (url: string): { videoId: string | null; thumbnailUrl: string | null } => {
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        const videoId = match[1]
        return {
          videoId,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        }
      }
    }
    return { videoId: null, thumbnailUrl: null }
  },

  delete: async (mediaId: string) => {
    const { error } = await supabase.from('event_media').delete().eq('id', mediaId)
    if (error) throw error
  },

  uploadImage: async (eventId: string, userId: string, uri: string): Promise<EventMedia> => {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const mainName = `${eventId}/${uniqueId}.jpg`
    const thumbName = `${eventId}/${uniqueId}_thumb.jpg`

    const thumb = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 200 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    )

    const [mainRes, thumbRes] = await Promise.all([
      fetch(uri),
      fetch(thumb.uri),
    ])
    const [mainBuf, thumbBuf] = await Promise.all([
      mainRes.arrayBuffer(),
      thumbRes.arrayBuffer(),
    ])

    const [mainUpload, thumbUpload] = await Promise.all([
      supabase.storage.from('event-images').upload(mainName, mainBuf, { contentType: 'image/jpeg', upsert: false }),
      supabase.storage.from('event-images').upload(thumbName, thumbBuf, { contentType: 'image/jpeg', upsert: false }),
    ])
    if (mainUpload.error) throw new Error(`이미지 업로드 실패: ${mainUpload.error.message}`)
    if (thumbUpload.error) throw new Error(`썸네일 업로드 실패: ${thumbUpload.error.message}`)

    const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(mainName)
    const { data: { publicUrl: thumbUrl } } = supabase.storage.from('event-images').getPublicUrl(thumbName)

    const { data, error } = await supabase
      .from('event_media')
      .insert({ event_id: eventId, added_by: userId, media_type: 'image', url: publicUrl, thumbnail_url: thumbUrl, title: null, platform: null, sort_order: 0 })
      .select()
      .single()
    if (error) throw new Error(`미디어 저장 실패: ${error.message}`)
    return data
  },
}

// ============================================================
// MESSAGES (실시간 채팅)
// ============================================================
export const messageApi = {
  getRecent: async (coupleId: string, limit = 50): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users(*)')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).reverse()
  },

  // 특정 시각보다 이전 메시지를 페이지 단위로 불러옴 (스크롤을 위로 올렸을 때 과거 대화 추가 로딩)
  getOlderThan: async (coupleId: string, beforeCreatedAt: string, limit = 100): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users(*)')
      .eq('couple_id', coupleId)
      .lt('created_at', beforeCreatedAt)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).reverse()
  },

  send: async (coupleId: string, senderId: string, content: string): Promise<Message> => {
    const { data, error } = await supabase
      .from('messages')
      .insert({ couple_id: coupleId, sender_id: senderId, content })
      .select('*, sender:users(*)')
      .single()
    if (error) throw error
    return data
  },

  delete: async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (error) throw error
  },

  // 상대방이 보낸 읽지 않은 메시지를 모두 읽음 처리
  markAsRead: async (coupleId: string, myUserId: string) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('couple_id', coupleId)
      .neq('sender_id', myUserId)
      .is('read_at', null)
  },

  subscribe: (
    coupleId: string,
    onInsert: (msg: Message) => void,
    onRead: (messageId: string, readAt: string) => void,
  ) => {
    return supabase
      .channel(`messages:${coupleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select('*, sender:users(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) onInsert(data)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          if (payload.new.read_at) onRead(payload.new.id, payload.new.read_at)
        }
      )
      .subscribe()
  },
}
