-- ============================================================
-- 서로 부르는 별칭 (본인 별칭은 상대방만 설정 가능)
-- nickname_for_user1: user2가 user1에게 붙인 별칭
-- nickname_for_user2: user1이 user2에게 붙인 별칭
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================

ALTER TABLE public.couples
  ADD COLUMN nickname_for_user1 TEXT,
  ADD COLUMN nickname_for_user2 TEXT;
