import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, StatusBar } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore, useCoupleStore, useThemeStore } from '../src/store'
import { FONT_HEADING, THEMES } from '../src/theme'

const TOP_PAD = Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12

export default function NicknameSettingsScreen() {
  const router = useRouter()
  const primary = THEMES[useThemeStore(s => s.themeKey)].color
  const { user } = useAuthStore()
  const { couple, partner, updatePartnerNickname } = useCoupleStore()
  const isUser1 = couple?.user1_id === user?.id

  const myNickname = couple ? (isUser1 ? couple.nickname_for_user1 : couple.nickname_for_user2) : null
  const partnerNicknameSaved = couple ? (isUser1 ? couple.nickname_for_user2 : couple.nickname_for_user1) : null
  const partnerName = partner?.display_name ?? partner?.email?.split('@')[0] ?? '상대방'
  const myDisplayed = myNickname ?? user?.display_name ?? user?.email?.split('@')[0] ?? '나'

  const [nickname, setNickname] = useState(partnerNicknameSaved ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!user || !couple) return
    setSaving(true)
    try {
      await updatePartnerNickname(user.id, nickname)
      router.back()
    } catch (e: any) {
      Alert.alert('저장 실패', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: TOP_PAD }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>별칭 설정</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || !couple} style={styles.saveBtn}>
          {saving
            ? <ActivityIndicator color={primary} size="small" />
            : <Text style={[styles.saveText, { color: primary }]}>저장</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* 상대방 별칭 (설정 가능) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{partnerName}의 별칭</Text>
          <Text style={styles.fieldDesc}>내가 상대방을 부르는 이름이에요.</Text>
          <TextInput
            style={[styles.input, { borderColor: primary }]}
            value={nickname}
            onChangeText={setNickname}
            placeholder={`${partnerName}(을)를 뭐라고 부를까요?`}
            placeholderTextColor="#bbb"
            maxLength={20}
            returnKeyType="done"
            editable={!!couple}
          />
        </View>

        {/* 내 별칭 (읽기전용, 상대방만 설정 가능) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>내 별칭</Text>
          <Text style={styles.fieldDesc}>상대방이 정해준 이름이에요. 본인은 바꿀 수 없어요.</Text>
          <View style={styles.readonlyRow}>
            <Text style={styles.readonlyText}>{myDisplayed}</Text>
          </View>
        </View>
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

  body: { padding: 24, gap: 28 },

  field: { gap: 8 },
  fieldLabel: { fontFamily: FONT_HEADING, fontSize: 17, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldDesc: { fontFamily: FONT_HEADING, fontSize: 13, color: '#bbb', marginTop: -4 },
  input: { fontFamily: FONT_HEADING, fontSize: 16, color: '#222', borderBottomWidth: 2, paddingVertical: 10, paddingHorizontal: 2 },

  readonlyRow: { paddingVertical: 10, paddingHorizontal: 2 },
  readonlyText: { fontFamily: FONT_HEADING, fontSize: 17, color: '#aaa' },
})
