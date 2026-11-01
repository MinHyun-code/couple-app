-- ============================================================
-- 커플 공용 메뉴 설정 (버킷리스트 / 대화 탭 노출 여부)
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================

ALTER TABLE public.couples
  ADD COLUMN menu_settings JSONB NOT NULL DEFAULT '{"showBucketList": true, "showChat": true}'::jsonb;
