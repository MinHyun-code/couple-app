import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import { authApi, userApi } from '../lib/api'
import { useAuthStore } from '../store'
import { FONT_HEADING } from '../theme'

type Mode = 'login' | 'signup'

export default function LoginScreen() {
  const router = useRouter()
  const setUser = useAuthStore(s => s.setUser)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) return Alert.alert('이메일과 비밀번호를 입력해주세요.')
    if (mode === 'signup' && !displayName) return Alert.alert('이름을 입력해주세요.')

    setLoading(true)
    try {
      if (mode === 'signup') {
        const authData = await authApi.signUp(email, password, displayName)
        // 이메일 확인 불필요 설정이면 session이 즉시 발급됨 → 바로 프로필 생성
        if (authData.user && authData.session) {
          await userApi.createProfile(authData.user.id, authData.user.email!, displayName)
        }
        Alert.alert('가입 완료!', '이메일을 확인해 인증을 완료해주세요.')
        setMode('login')
      } else {
        const { user } = await authApi.signIn(email, password)
        if (user) {
          let profile = await userApi.getProfile(user.id)
          if (!profile) {
            const name = ((user.user_metadata?.full_name as string | undefined) ?? displayName) || null
            profile = await userApi.createProfile(user.id, user.email!, name)
          }
          setUser(profile)
          router.replace('/')
        }
      }
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* 로고 */}
        <View style={styles.logoArea}>
          <Text style={styles.logoEmoji}>💑</Text>
          <Text style={styles.logoTitle}>우리의 날</Text>
          <Text style={styles.logoSub}>우리만의 특별한 공간</Text>
        </View>

        {/* 탭 */}
        <View style={styles.tabRow}>
          {(['login', 'signup'] as Mode[]).map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.tab, mode === m && styles.tabActive]}>
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === 'login' ? '로그인' : '회원가입'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 입력 폼 */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="이름"
              value={displayName}
              onChangeText={setDisplayName}
              placeholderTextColor="#aaa"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#aaa"
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{mode === 'login' ? '로그인' : '회원가입'}</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const PINK = '#FF6B9D'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 64, marginBottom: 8 },
  logoTitle: { fontFamily: FONT_HEADING, fontSize: 28, color: PINK, marginBottom: 4 },
  logoSub: { fontFamily: FONT_HEADING, fontSize: 16, color: '#aaa' },
  tabRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 12, marginBottom: 24, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontFamily: FONT_HEADING, fontSize: 17, color: '#999', fontWeight: '500' },
  tabTextActive: { fontFamily: FONT_HEADING, color: PINK, fontWeight: '700' },
  form: { gap: 12 },
  input: {
    fontFamily: FONT_HEADING, borderWidth: 1.5, borderColor: '#ececec', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 17, color: '#333', backgroundColor: '#fafafa'
  },
  button: {
    backgroundColor: PINK, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8
  },
  buttonText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 16, fontWeight: '700' },
})
