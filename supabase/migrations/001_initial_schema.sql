-- ============================================================
-- 커플 앱 초기 스키마
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS (프로필)
-- ============================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  provider      TEXT DEFAULT 'email',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. COUPLES (커플 연동)
-- ============================================================
CREATE TABLE public.couples (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  couple_name   TEXT,
  anniversary   DATE,
  invite_code   TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'separated')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CALENDAR_EVENTS (공유 캘린더)
-- ============================================================
CREATE TABLE public.calendar_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES public.users(id),
  title         TEXT NOT NULL,
  description   TEXT,
  event_date    DATE NOT NULL,
  category      TEXT DEFAULT 'date' CHECK (category IN ('date', 'anniversary', 'travel', 'daily', 'special')),
  is_completed  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. DATE_IDEAS (데이트 목록)
-- ============================================================
CREATE TABLE public.date_ideas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES public.users(id),
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT DEFAULT 'wishlist' CHECK (status IN ('wishlist', 'planned', 'completed')),
  category      TEXT DEFAULT 'restaurant' CHECK (category IN ('restaurant', 'travel', 'activity', 'movie', 'home', 'other')),
  location      TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. CHARACTERS (캐릭터 꾸미기)
-- ============================================================
CREATE TABLE public.character_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('hair', 'top', 'bottom', 'accessory', 'background', 'face')),
  image_url     TEXT NOT NULL,
  is_default    BOOLEAN DEFAULT FALSE,
  unlock_level  INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.characters (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT,
  equipped_items JSONB DEFAULT '{}'::jsonb,
  level         INT DEFAULT 1,
  exp           INT DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(couple_id, user_id)
);

-- ============================================================
-- 6. EVENT_MEDIA (영상 공유)
-- ============================================================
CREATE TABLE public.event_media (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  added_by      UUID NOT NULL REFERENCES public.users(id),
  media_type    TEXT DEFAULT 'video' CHECK (media_type IN ('video', 'image')),
  url           TEXT NOT NULL,
  thumbnail_url TEXT,
  title         TEXT,
  platform      TEXT CHECK (platform IN ('youtube', 'instagram', 'other')),
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS) 설정
-- ============================================================

ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_ideas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media     ENABLE ROW LEVEL SECURITY;

-- users: 본인 또는 커플 파트너 조회 가능
CREATE POLICY "users_select_own" ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (
      SELECT CASE WHEN user1_id = auth.uid() THEN user2_id ELSE user1_id END
      FROM public.couples
      WHERE (user1_id = auth.uid() OR user2_id = auth.uid())
        AND status = 'active'
    )
  );
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- couples: 내가 속한 커플 or pending 상태 (초대 코드 조회용)
CREATE POLICY "couples_select" ON public.couples FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id OR status = 'pending');
CREATE POLICY "couples_insert" ON public.couples FOR INSERT
  WITH CHECK (auth.uid() = user1_id);
CREATE POLICY "couples_update" ON public.couples FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id OR status = 'pending');

-- calendar_events: 같은 커플만
CREATE POLICY "events_select" ON public.calendar_events FOR SELECT
  USING (couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));
CREATE POLICY "events_insert" ON public.calendar_events FOR INSERT
  WITH CHECK (couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));
CREATE POLICY "events_update" ON public.calendar_events FOR UPDATE
  USING (couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));
CREATE POLICY "events_delete" ON public.calendar_events FOR DELETE
  USING (created_by = auth.uid());

-- date_ideas: 같은 커플만
CREATE POLICY "ideas_select" ON public.date_ideas FOR SELECT
  USING (couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));
CREATE POLICY "ideas_insert" ON public.date_ideas FOR INSERT
  WITH CHECK (couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));
CREATE POLICY "ideas_update" ON public.date_ideas FOR UPDATE
  USING (couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));
CREATE POLICY "ideas_delete" ON public.date_ideas FOR DELETE
  USING (created_by = auth.uid());

-- characters: 같은 커플만
CREATE POLICY "chars_select" ON public.characters FOR SELECT
  USING (couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));
CREATE POLICY "chars_insert" ON public.characters FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "chars_update" ON public.characters FOR UPDATE
  USING (user_id = auth.uid());

-- character_items: 전체 공개
CREATE POLICY "items_select_all" ON public.character_items FOR SELECT USING (true);

-- event_media: 같은 커플만
CREATE POLICY "media_select" ON public.event_media FOR SELECT
  USING (event_id IN (
    SELECT id FROM public.calendar_events WHERE couple_id IN (
      SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  ));
CREATE POLICY "media_insert" ON public.event_media FOR INSERT
  WITH CHECK (added_by = auth.uid());
CREATE POLICY "media_delete" ON public.event_media FOR DELETE
  USING (added_by = auth.uid());

-- ============================================================
-- 트리거: 신규 유저 가입 시 users 테이블 자동 생성
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 기본 캐릭터 아이템 데이터
-- ============================================================
INSERT INTO public.character_items (name, category, image_url, is_default, unlock_level) VALUES
  ('기본 헤어', 'hair', 'items/hair_default.png', true, 1),
  ('기본 상의', 'top', 'items/top_default.png', true, 1),
  ('기본 하의', 'bottom', 'items/bottom_default.png', true, 1),
  ('기본 배경', 'background', 'items/bg_default.png', true, 1);
