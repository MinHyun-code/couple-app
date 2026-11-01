import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { User, Couple, Character, MenuSettings } from '../types'
import { authApi, coupleApi, characterApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { syncWidgetData } from '../lib/widgetSync'
import type { ThemeKey } from '../theme'

// ============================================================
// AUTH STORE
// ============================================================
type AuthState = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  signOut: async () => {
    await authApi.signOut()
    set({ user: null, isAuthenticated: false })
  },
}))

// ============================================================
// COUPLE STORE
// ============================================================
type CoupleState = {
  couple: Couple | null
  partner: User | null
  myCharacter: Character | null
  partnerCharacter: Character | null
  isLoading: boolean

  setCouple: (couple: Couple | null) => void
  loadCouple: (userId: string) => Promise<void>
  loadCharacters: (coupleId: string, userId: string) => Promise<void>
  updateMenuSettings: (settings: Partial<MenuSettings>) => Promise<void>
  updatePartnerNickname: (myUserId: string, nickname: string) => Promise<void>
  reset: () => void
}

let coupleChannel: RealtimeChannel | null = null
let subscribedCoupleId: string | null = null

export const useCoupleStore = create<CoupleState>((set, get) => ({
  couple: null,
  partner: null,
  myCharacter: null,
  partnerCharacter: null,
  isLoading: false,

  setCouple: (couple) => {
    set({ couple })
    syncWidgetData(couple).catch(() => {})
  },

  loadCouple: async (userId: string) => {
    set({ isLoading: true })
    try {
      const couple = await coupleApi.getMine(userId)
      if (couple) {
        const partner = couple.user1_id === userId ? couple.user2 : couple.user1
        set({ couple, partner: partner ?? null })
        syncWidgetData(couple).catch(() => {})
        await get().loadCharacters(couple.id, userId)

        // 같은 커플에 이미 구독 중이면 재구독하지 않음 (loadCouple이 여러 번 호출될 수 있음)
        if (subscribedCoupleId !== couple.id) {
          if (coupleChannel) supabase.removeChannel(coupleChannel)
          subscribedCoupleId = couple.id
          coupleChannel = coupleApi.subscribeToUpdates(couple.id, (updated) => {
            set(state => state.couple ? { couple: { ...state.couple, ...updated } } : state)
            syncWidgetData(get().couple).catch(() => {})
          })
        }
      }
    } finally {
      set({ isLoading: false })
    }
  },

  loadCharacters: async (coupleId: string, userId: string) => {
    const characters = await characterApi.getCouple(coupleId)
    const mine = characters.find(c => c.user_id === userId) ?? null
    const partnerChar = characters.find(c => c.user_id !== userId) ?? null
    set({ myCharacter: mine, partnerCharacter: partnerChar })
  },

  // 커플 공용 메뉴 설정 변경 (상대방 화면에도 실시간 반영됨)
  updateMenuSettings: async (settings) => {
    const couple = get().couple
    if (!couple) return
    const updated = await coupleApi.update(couple.id, {
      menu_settings: { ...couple.menu_settings, ...settings },
    })
    set({ couple: { ...couple, ...updated } })
  },

  // 상대방 별칭 설정 (본인 별칭은 상대방만 설정할 수 있음)
  updatePartnerNickname: async (myUserId, nickname) => {
    const couple = get().couple
    if (!couple) return
    const trimmed = nickname.trim() || null
    const isUser1 = couple.user1_id === myUserId
    const updates = isUser1 ? { nickname_for_user2: trimmed } : { nickname_for_user1: trimmed }
    const updated = await coupleApi.update(couple.id, updates)
    set({ couple: { ...couple, ...updated } })
  },

  reset: () => {
    if (coupleChannel) supabase.removeChannel(coupleChannel)
    coupleChannel = null
    subscribedCoupleId = null
    set({ couple: null, partner: null, myCharacter: null, partnerCharacter: null })
    syncWidgetData(null).catch(() => {})
  },
}))

// ============================================================
// THEME STORE
// ============================================================
type ThemeState = {
  themeKey: ThemeKey
  setTheme: (key: ThemeKey) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeKey: 'pink',
      setTheme: (key) => set({ themeKey: key }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

// ============================================================
// FAVORITE REGIONS (지역 선택 즐겨찾기, 기기별 개인 설정)
// ============================================================
type FavoriteRegionsState = {
  codes: string[]
  isFavorite: (code: string) => boolean
  toggleFavorite: (code: string) => void
}

export const useFavoriteRegionsStore = create<FavoriteRegionsState>()(
  persist(
    (set, get) => ({
      codes: [],
      isFavorite: (code) => get().codes.includes(code),
      toggleFavorite: (code) => set(state => ({
        codes: state.codes.includes(code)
          ? state.codes.filter(c => c !== code)
          : [...state.codes, code],
      })),
    }),
    {
      name: 'favorite-regions-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
