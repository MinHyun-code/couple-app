// ============================================================
// 전체 앱 타입 정의
// ============================================================

export type User = {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  provider: string
  push_token?: string | null
  created_at: string
}

export type CoupleStatus = 'pending' | 'active' | 'separated'

export type MenuSettings = {
  showBucketList: boolean
  showChat: boolean
  showMap: boolean
}

export type Couple = {
  id: string
  user1_id: string
  user2_id: string | null
  couple_name: string | null
  anniversary: string | null
  invite_code: string
  status: CoupleStatus
  menu_settings: MenuSettings
  nickname_for_user1: string | null
  nickname_for_user2: string | null
  created_at: string
  // joined
  user1?: User
  user2?: User
}

export type EventCategory = 'date' | 'anniversary' | 'travel' | 'daily' | 'special'

export type CalendarEvent = {
  id: string
  couple_id: string
  created_by: string
  title: string
  description: string | null
  event_date: string
  category: EventCategory
  is_completed: boolean
  is_recurring?: boolean
  icon?: string | null
  date_idea_id?: string | null
  region_code?: string | null
  created_at: string
  // joined
  media?: EventMedia[]
  date_idea?: DateIdea
}

export type DateStatus = 'wishlist' | 'planned' | 'completed'
export type DateCategory = 'restaurant' | 'travel' | 'activity' | 'movie' | 'home' | 'other'

export type InstagramLink = { url: string; liked: boolean; memo?: string | null }

export type DateIdea = {
  id: string
  couple_id: string
  created_by: string
  title: string
  description: string | null
  status: DateStatus
  category: DateCategory
  location: string | null
  instagram_links: InstagramLink[]
  completed_at: string | null
  created_at: string
}

export type ItemCategory = 'hair' | 'top' | 'bottom' | 'accessory' | 'background' | 'face'

export type CharacterItem = {
  id: string
  name: string
  category: ItemCategory
  image_url: string
  is_default: boolean
  unlock_level: number
}

export type EquippedItems = {
  hair?: string
  top?: string
  bottom?: string
  accessory?: string
  background?: string
  face?: string
}

export type Character = {
  id: string
  couple_id: string
  user_id: string
  name: string | null
  equipped_items: EquippedItems
  level: number
  exp: number
  updated_at: string
}

export type Message = {
  id: string
  couple_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
  // joined
  sender?: User
}

export type Platform = 'youtube' | 'instagram' | 'other'

export type EventMedia = {
  id: string
  event_id: string
  added_by: string
  media_type: 'video' | 'image'
  url: string
  thumbnail_url: string | null
  title: string | null
  platform: Platform | null
  sort_order: number
  created_at: string
}
