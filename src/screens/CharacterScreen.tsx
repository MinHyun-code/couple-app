import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Alert, ActivityIndicator
} from 'react-native'
import { characterApi } from '../lib/api'
import { useAuthStore, useCoupleStore } from '../store'
import type { CharacterItem, ItemCategory, EquippedItems } from '../types'
import { FONT_HEADING } from '../theme'

const CATEGORIES: { key: ItemCategory; label: string; emoji: string }[] = [
  { key: 'background', label: '배경', emoji: '🖼️' },
  { key: 'face', label: '얼굴', emoji: '😊' },
  { key: 'hair', label: '헤어', emoji: '💇' },
  { key: 'top', label: '상의', emoji: '👕' },
  { key: 'bottom', label: '하의', emoji: '👖' },
  { key: 'accessory', label: '액세서리', emoji: '💍' },
]

export default function CharacterScreen() {
  const user = useAuthStore(s => s.user)
  const { couple, myCharacter, loadCharacters } = useCoupleStore()
  const [allItems, setAllItems] = useState<CharacterItem[]>([])
  const [selectedCat, setSelectedCat] = useState<ItemCategory>('hair')
  const [equipped, setEquipped] = useState<EquippedItems>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadItems()
  }, [])

  useEffect(() => {
    if (myCharacter) {
      setEquipped(myCharacter.equipped_items ?? {})
    }
  }, [myCharacter])

  const loadItems = async () => {
    setLoading(true)
    try {
      const items = await characterApi.getAllItems()
      setAllItems(items)
    } finally {
      setLoading(false)
    }
  }

  const handleEquip = (item: CharacterItem) => {
    setEquipped(prev => {
      const isAlreadyEquipped = prev[item.category] === item.id
      return {
        ...prev,
        [item.category]: isAlreadyEquipped ? undefined : item.id
      }
    })
  }

  const handleSave = async () => {
    if (!myCharacter) {
      // 캐릭터 없으면 생성
      if (!couple || !user) return
      setSaving(true)
      try {
        await characterApi.create(couple.id, user.id, user.display_name ?? '나')
        await loadCharacters(couple.id, user.id)
      } catch (e: any) {
        Alert.alert('오류', e.message)
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    try {
      await characterApi.updateEquipped(myCharacter.id, equipped)
      if (couple && user) await loadCharacters(couple.id, user.id)
      Alert.alert('✨ 저장됐어요!')
    } catch (e: any) {
      Alert.alert('오류', e.message)
    } finally {
      setSaving(false)
    }
  }

  const catItems = allItems.filter(i => i.category === selectedCat)

  return (
    <View style={styles.container}>
      {/* 캐릭터 미리보기 */}
      <View style={styles.preview}>
        <Text style={styles.previewEmoji}>🧑‍🦱</Text>
        <View style={styles.previewInfo}>
          <Text style={styles.previewName}>{myCharacter?.name ?? user?.display_name ?? '나'}</Text>
          <Text style={styles.previewLevel}>Lv.{myCharacter?.level ?? 1} · {myCharacter?.exp ?? 0} / 100 EXP</Text>
          <View style={styles.expBar}>
            <View style={[styles.expFill, { width: `${myCharacter?.exp ?? 0}%` }]} />
          </View>
        </View>
      </View>

      {/* 장착 중인 아이템 요약 */}
      <View style={styles.equippedRow}>
        {CATEGORIES.map(cat => (
          <View key={cat.key} style={styles.equippedSlot}>
            <Text style={styles.slotEmoji}>{cat.emoji}</Text>
            <Text style={styles.slotLabel}>{equipped[cat.key] ? '✓' : '-'}</Text>
          </View>
        ))}
      </View>

      {/* 카테고리 탭 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => setSelectedCat(cat.key)}
            style={[styles.catTab, selectedCat === cat.key && styles.catTabActive]}
          >
            <Text style={styles.catTabEmoji}>{cat.emoji}</Text>
            <Text style={[styles.catTabText, selectedCat === cat.key && styles.catTabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 아이템 목록 */}
      {loading
        ? <ActivityIndicator color="#FF6B9D" style={{ flex: 1 }} />
        : (
          <FlatList
            data={catItems}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.itemGrid}
            ListEmptyComponent={<Text style={styles.empty}>아직 아이템이 없어요</Text>}
            renderItem={({ item }) => {
              const isEquipped = equipped[item.category] === item.id
              return (
                <TouchableOpacity
                  style={[styles.itemCard, isEquipped && styles.itemCardEquipped]}
                  onPress={() => handleEquip(item)}
                >
                  <Text style={styles.itemEmoji}>🎨</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  {isEquipped && <Text style={styles.equippedBadge}>착용 중</Text>}
                  {item.is_default && !isEquipped && <Text style={styles.defaultBadge}>기본</Text>}
                </TouchableOpacity>
              )
            }}
          />
        )
      }

      {/* 저장 버튼 */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>✨ 저장하기</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

const PINK = '#FF6B9D'
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  preview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, gap: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  previewEmoji: { fontSize: 64 },
  previewInfo: { flex: 1 },
  previewName: { fontFamily: FONT_HEADING, fontSize: 20, color: '#333' },
  previewLevel: { fontFamily: FONT_HEADING, fontSize: 15, color: '#888', marginTop: 2, marginBottom: 6 },
  expBar: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  expFill: { height: '100%', backgroundColor: PINK, borderRadius: 3 },
  equippedRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f0f0f0', justifyContent: 'space-around' },
  equippedSlot: { alignItems: 'center', gap: 2 },
  slotEmoji: { fontSize: 18 },
  slotLabel: { fontFamily: FONT_HEADING, fontSize: 15, color: '#aaa' },
  catScroll: { maxHeight: 64, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f0f0f0' },
  catContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  catTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f5f5f5', gap: 4 },
  catTabActive: { backgroundColor: '#fff0f5', borderWidth: 1.5, borderColor: PINK },
  catTabEmoji: { fontSize: 14 },
  catTabText: { fontFamily: FONT_HEADING, fontSize: 15, color: '#888' },
  catTabTextActive: { fontFamily: FONT_HEADING, color: PINK },
  itemGrid: { padding: 12, gap: 10 },
  empty: { fontFamily: FONT_HEADING, textAlign: 'center', color: '#bbb', marginTop: 40 },
  itemCard: { flex: 1, margin: 4, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#f0f0f0', minHeight: 100 },
  itemCardEquipped: { borderColor: PINK, backgroundColor: '#fff5f9' },
  itemEmoji: { fontSize: 32 },
  itemName: { fontFamily: FONT_HEADING, fontSize: 14, color: '#555', textAlign: 'center' },
  equippedBadge: { fontFamily: FONT_HEADING, fontSize: 15, color: PINK },
  defaultBadge: { fontFamily: FONT_HEADING, fontSize: 15, color: '#aaa' },
  saveBtn: { margin: 16, backgroundColor: PINK, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: FONT_HEADING, color: '#fff', fontSize: 16 },
})
