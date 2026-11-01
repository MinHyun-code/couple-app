export const FONT = 'PretendardVariable'
export const FONT_HEADING = 'Jalnan2'
export const PINK = '#FF6B9D'

export type ThemeKey = 'pink' | 'green' | 'blue' | 'purple' | 'coral' | 'mint'

export const THEMES: Record<ThemeKey, { label: string; color: string; soft: string; deep: string; bg: string; emoji: string }> = {
  pink:   { label: '핑크',  color: '#FF6B9D', soft: '#FFE0EB', deep: '#C23A6A', bg: '#FFF8FA', emoji: '🩷' },
  green:  { label: '그린',  color: '#03C75A', soft: '#D4F5E2', deep: '#028A3E', bg: '#F3FDF7', emoji: '💚' },
  blue:   { label: '블루',  color: '#4A90E2', soft: '#DDE9F9', deep: '#2E65B0', bg: '#F4F8FF', emoji: '💙' },
  purple: { label: '퍼플',  color: '#A29BFE', soft: '#EBE9FE', deep: '#6C5CE7', bg: '#F7F6FF', emoji: '💜' },
  coral:  { label: '코랄',  color: '#FF7675', soft: '#FFE0DF', deep: '#C23A39', bg: '#FFF7F7', emoji: '🧡' },
  mint:   { label: '민트',  color: '#00B894', soft: '#D0F5EC', deep: '#007A62', bg: '#F2FDFB', emoji: '🩵' },
}
