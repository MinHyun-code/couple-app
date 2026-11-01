import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Share
} from 'react-native'
import { useRouter } from 'expo-router'
import { coupleApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuthStore, useCoupleStore } from '../store'
import { FONT_HEADING } from '../theme'

export default function CoupleConnectScreen() {
  const router = useRouter()
  const user = useAuthStore(s => s.user)
  const { loadCouple } = useCoupleStore()
  const [inviteCode, setInviteCode] = useState('')
  const [myCode, setMyCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'invite' | 'join'>('invite')

  useEffect(() => {
    createMyInviteCode()
  }, [])

  const createMyInviteCode = async () => {
    if (!user) return
    try {
      const { data: existing } = await supabase
        .from('couples')
        .select('invite_code')
        .eq('user1_id', user.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()
      if (existing) {
        setMyCode(existing.invite_code)
        return
      }
      const couple = await coupleApi.create(user.id)
      setMyCode(couple.invite_code)
    } catch (e: any) {
      // 무시
    }
  }

  const handleShare = async () => {
    if (!myCode) return
    await Share.share({
      message: `💑 우리의 날 앱에서 커플 연동해요!\n초대 코드: ${myCode}\n앱을 설치하고 코드를 입력해주세요 💕`,
    })
  }

  const handleJoin = async () => {
    if (!inviteCode.trim() || !user) return
    setLoading(true)
    try {
      await coupleApi.joinByCode(inviteCode.trim().toLowerCase(), user.id)
      await loadCouple(user.id)
      Alert.alert('🎉 연동 완료!', '파트너와 연결됐어요!', [
        { text: '시작하기', onPress: () => router.replace('/(tabs)') }
      ])
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTestMode = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: existing } = await supabase
        .from('couples')
        .select('id')
        .eq('user1_id', user.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()
      const coupleId = existing?.id ?? (await coupleApi.create(user.id)).id
      await coupleApi.update(coupleId, { user2_id: user.id, status: 'active' })
      await loadCouple(user.id)
      router.replace('/(tabs)')
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💑 파트너 연동</Text>
      <Text style={styles.sub}>초대 코드로 연인과 연결해요</Text>

      {/* 탭 */}
      <View style={styles.tabRow}>
        {(['invite', 'join'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'invite' ? '초대하기' : '코드 입력'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'invite' ? (
        <View style={styles.section}>
          <Text style={styles.label}>내 초대 코드</Text>
          <View style={styles.codeBox}>
            <Text style={styles.code}>{myCode ?? '...'}</Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleShare}>
            <Text style={styles.buttonText}>📤 파트너에게 공유하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.label}>파트너의 초대 코드 입력</Text>
          <TextInput
            style={styles.input}
            placeholder="초대 코드 8자리"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            maxLength={8}
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>💕 연동하기</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* 테스트 모드 */}
      <TouchableOpacity style={styles.testBtn} onPress={handleTestMode} disabled={loading}>
        <Text style={styles.testBtnText}>🧪 혼자 테스트하기 (연동 건너뛰기)</Text>
      </TouchableOpacity>
    </View>
  )
}

const PINK = '#FF6B9D'
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 32, justifyContent: 'center' },
  title: { fontFamily: FONT_HEADING, fontSize: 26, color: '#333', textAlign: 'center', marginBottom: 8 },
  sub: { fontFamily: FONT_HEADING, fontSize: 17, color: '#aaa', textAlign: 'center', marginBottom: 32 },
  tabRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 12, marginBottom: 28, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontFamily: FONT_HEADING, fontSize: 17, color: '#999', fontWeight: '500' },
  tabTextActive: { fontFamily: FONT_HEADING, color: PINK, fontWeight: '700' },
  section: { gap: 16 },
  label: { fontFamily: FONT_HEADING, fontSize: 17, color: '#666', fontWeight: '600' },
  codeBox: {
    backgroundColor: '#fff5f9', borderWidth: 2, borderColor: PINK,
    borderRadius: 16, paddingVertical: 24, alignItems: 'center'
  },
  code: { fontFamily: FONT_HEADING, fontSize: 32, color: PINK, letterSpacing: 6 },
  input: {
    fontFamily: FONT_HEADING, borderWidth: 1.5, borderColor: '#ececec', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, color: '#333', textAlign: 'center', letterSpacing: 4
  },
  button: {
    backgroundColor: PINK, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center'
  },
  buttonText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 17, fontWeight: '700' },
  testBtn: {
    marginTop: 32, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center'
  },
  testBtnText: { fontFamily: FONT_HEADING, color: '#aaa', fontSize: 14 },
})
