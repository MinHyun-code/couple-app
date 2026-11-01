-- ============================================================
-- 지도 기능: 일정에 지역(시/군/구) 필드 추가 + 지도 메뉴 노출 설정
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================

ALTER TABLE public.calendar_events
  ADD COLUMN region_code TEXT;

-- 기존 커플들의 menu_settings에도 showMap 기본값(true) 채우기
UPDATE public.couples
  SET menu_settings = menu_settings || '{"showMap": true}'::jsonb
  WHERE NOT (menu_settings ? 'showMap');

ALTER TABLE public.couples
  ALTER COLUMN menu_settings SET DEFAULT '{"showBucketList": true, "showChat": true, "showMap": true}'::jsonb;
