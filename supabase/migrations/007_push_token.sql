-- ============================================================
-- 푸시 알림용 Expo 푸시 토큰 저장 컬럼 추가
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token TEXT;
