import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Platform, StatusBar
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore, useThemeStore } from '../src/store'
import { userApi } from '../src/lib/api'
import { FONT_HEADING, THEMES } from '../src/theme'

const TOP_PAD = Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12

export default function ProfileEditScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user, setUser, signOut } = useAuthStore()
  const primary = THEMES[useThemeStore(s => s.themeKey)].color

  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요해요.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return

    setUploadingPhoto(true)
    try {
      const url = await userApi.uploadAvatar(user!.id, result.assets[0].uri)
      setAvatarUri(url)
    } catch (e: any) {
      Alert.alert('업로드 실패', e.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const updated = await userApi.updateProfile(user.id, {
        avatar_url: avatarUri,
      })
      setUser(updated)
      router.back()
    } catch (e: any) {
      Alert.alert('저장 실패', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃 할까요?', [
      { text: '취소' },
      { text: '로그아웃', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login') } }
    ])
  }

  const initials = (user?.display_name?.trim() || user?.email || '?')[0].toUpperCase()

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: TOP_PAD }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필 편집</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving
            ? <ActivityIndicator color={primary} size="small" />
            : <Text style={[styles.saveText, { color: primary }]}>저장</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* 아바타 */}
        <TouchableOpacity style={styles.avatarWrap} onPress={handlePickPhoto} disabled={uploadingPhoto} activeOpacity={0.8}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={[styles.avatarImg, { borderColor: primary }]} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { borderColor: primary, backgroundColor: primary + '18' }]}>
              <Text style={[styles.avatarInitials, { color: primary }]}>{initials}</Text>
            </View>
          )}
          {uploadingPhoto
            ? <View style={styles.avatarOverlay}><ActivityIndicator color="#fff" /></View>
            : <View style={[styles.editBadge, { backgroundColor: primary }]}><Text style={styles.editBadgeText}>✎</Text></View>
          }
        </TouchableOpacity>
        <Text style={styles.photoHint}>사진을 눌러 변경하세요</Text>

        {/* 이름 (읽기전용) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>이름</Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailText}>{user?.display_name}</Text>
          </View>
        </View>

        {/* 이메일 (읽기전용) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>이메일</Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* 로그아웃 */}
      <View style={styles.signOutSection}>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderColor: '#f0f0f0',
  },
  backBtn: { padding: 4, minWidth: 40 },
  backIcon: { fontSize: 32, color: '#333', lineHeight: 36 },
  headerTitle: { fontFamily: FONT_HEADING, fontSize: 16, fontWeight: '700', color: '#222' },
  saveBtn: { minWidth: 40, alignItems: 'flex-end', justifyContent: 'center', height: 36 },
  saveText: { fontFamily: FONT_HEADING, fontSize: 17, fontWeight: '700' },

  body: { flex: 1, padding: 24, gap: 28, alignItems: 'center' },

  avatarWrap: { marginTop: 16, position: 'relative', width: 110, height: 110 },
  avatarImg: { width: 110, height: 110, borderRadius: 55, borderWidth: 3 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: FONT_HEADING, fontSize: 44, fontWeight: '700' },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 55, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  editBadgeText: { color: '#fff', fontSize: 13 },
  photoHint: { fontFamily: FONT_HEADING, fontSize: 17, color: '#bbb', marginTop: -20 },

  field: { width: '100%', gap: 8 },
  fieldLabel: { fontFamily: FONT_HEADING, fontSize: 17, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  emailRow: { paddingVertical: 10, paddingHorizontal: 2 },
  emailText: { fontFamily: FONT_HEADING, fontSize: 17, color: '#aaa' },

  // 로그아웃
  signOutSection: { paddingHorizontal: 24, paddingBottom: 24 },
  signOutBtn: {
    padding: 15, borderRadius: 16, backgroundColor: '#FFF0EE', alignItems: 'center',
  },
  signOutText: { fontFamily: FONT_HEADING, color: '#E0637A', fontWeight: '700', fontSize: 14 },
})
