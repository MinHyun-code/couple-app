import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore, useCoupleStore, useThemeStore } from '../../src/store'
import { FONT_HEADING, THEMES } from '../../src/theme'
import type { ThemeKey } from '../../src/theme'

export default function ProfileScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { couple, partner } = useCoupleStore()
  const { themeKey, setTheme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const theme = THEMES[themeKey]
  const { color: primary, soft, deep, bg } = theme
  const [copied, setCopied] = useState(false)

  const daysTogether = couple?.anniversary
    ? Math.floor((new Date().getTime() - new Date(couple.anniversary).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : null

  const isUser1 = couple?.user1_id === user?.id
  const myNickname = couple ? (isUser1 ? couple.nickname_for_user1 : couple.nickname_for_user2) : null
  const partnerNickname = couple ? (isUser1 ? couple.nickname_for_user2 : couple.nickname_for_user1) : null

  const myName = myNickname ?? user?.display_name ?? user?.email?.split('@')[0] ?? '나'
  const partnerName = partnerNickname ?? partner?.display_name ?? partner?.email?.split('@')[0] ?? '상대방'

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: bg }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      {/* 커플 카드 */}
      {couple && (
        <View style={[styles.coupleCard, { backgroundColor: soft, borderColor: primary + '30' }]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCol}>
              <View style={[styles.avatar, { borderColor: primary, backgroundColor: primary + '18' }]}>
                {user?.avatar_url
                  ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} contentFit="cover" cachePolicy="memory-disk" />
                  : <Text style={[styles.avatarText, { color: primary }]}>{myName[0]}</Text>}
              </View>
              <Text style={styles.personName} numberOfLines={1}>{myName}</Text>
            </View>
            <View style={styles.heartWrap}>
              <Ionicons name="heart" size={26} color={primary} style={styles.heartIcon} />
            </View>
            <View style={styles.avatarCol}>
              <View style={[styles.avatar, { borderColor: primary, backgroundColor: primary + '18' }]}>
                {partner?.avatar_url
                  ? <Image source={{ uri: partner.avatar_url }} style={styles.avatarImg} contentFit="cover" cachePolicy="memory-disk" />
                  : <Text style={[styles.avatarText, { color: primary }]}>{partnerName[0]}</Text>}
              </View>
              <Text style={styles.personName} numberOfLines={1}>{partnerName}</Text>
            </View>
          </View>
          {couple.couple_name && (
            <Text style={styles.coupleName}>{couple.couple_name}</Text>
          )}
          {daysTogether !== null && (
            <Text style={styles.daysText}>
              함께한 지 <Text style={[styles.daysNum, { color: primary }]}>{daysTogether}</Text>일째 💌
            </Text>
          )}
        </View>
      )}

      {/* 초대 코드 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>초대 코드</Text>
        <View style={[styles.codeRow, { borderColor: primary + '55' }]}>
          <Text style={[styles.code, { color: deep }]}>{couple?.invite_code ?? '-'}</Text>
          <TouchableOpacity
            style={[styles.copyBtn, { backgroundColor: soft }]}
            onPress={async () => {
              await Clipboard.setStringAsync(couple?.invite_code ?? '')
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
          >
            <Text style={[styles.copyBtnText, { color: deep }]}>{copied ? '복사됨 ✓' : '복사'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 테마 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>테마</Text>
        <View style={styles.themeRow}>
          {(Object.keys(THEMES) as ThemeKey[]).map(key => {
            const t = THEMES[key]
            const active = themeKey === key
            return (
              <TouchableOpacity
                key={key}
                style={[styles.themeChip, active && { borderColor: t.color, backgroundColor: t.soft }]}
                onPress={() => setTheme(key)}
              >
                <View style={[styles.themeCircle, { backgroundColor: t.color }]} />
                <Text style={[styles.themeLabel, active && { color: t.deep, fontWeight: '700' }]}>{t.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* 내 정보 */}
      <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/profile-edit' as any)}>
        <Text style={styles.menuBtnText}>내 정보</Text>
        <Text style={styles.menuChevron}>›</Text>
      </TouchableOpacity>

      {/* 커플 설정 (커플 연동됐을 때만) */}
      {couple && (
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/couple-settings' as any)}>
          <Text style={styles.menuBtnText}>커플 설정</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, gap: 14, paddingBottom: 48 },

  // 커플 카드
  coupleCard: {
    borderRadius: 22, padding: 26, alignItems: 'center', gap: 10,
    borderWidth: 1,
    shadowColor: '#3D2C3B', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatarCol: { alignItems: 'center', gap: 6, maxWidth: 88 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { fontFamily: FONT_HEADING, fontSize: 28 },
  personName: { fontFamily: FONT_HEADING, fontSize: 14, color: '#5B4A54', maxWidth: 88 },
  heartWrap: { height: 64, justifyContent: 'center' },
  heartIcon: {
    textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  coupleName: { fontFamily: FONT_HEADING, fontSize: 22, color: '#3D2C3B' },
  daysText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#8A7A84' },
  daysNum: { fontFamily: FONT_HEADING, fontWeight: '800', fontSize: 17 },

  // 섹션 공통
  section: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 10,
    shadowColor: '#3D2C3B', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionLabel: { fontFamily: FONT_HEADING, fontSize: 14, fontWeight: '700', color: '#B6A8A2', textTransform: 'uppercase', letterSpacing: 0.8 },

  // 초대 코드
  codeRow: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  code: { fontFamily: FONT_HEADING, fontSize: 22, letterSpacing: 4 },
  copyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  copyBtnText: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '700' },

  // 테마
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#F1E7E2', backgroundColor: '#FAFAFA',
  },
  themeCircle: { width: 14, height: 14, borderRadius: 7 },
  themeLabel: { fontFamily: FONT_HEADING, fontSize: 15, color: '#5B4A54' },

  // 내 정보 버튼
  menuBtn: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#3D2C3B', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  menuBtnText: { fontFamily: FONT_HEADING, fontSize: 15, fontWeight: '600', color: '#3D2C3B' },
  menuChevron: { fontFamily: FONT_HEADING, fontSize: 22, color: '#C9BDB8' },
})
