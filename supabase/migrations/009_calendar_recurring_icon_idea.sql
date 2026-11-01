-- ============================================================
-- 일정(calendar_events)에 매년 반복 / 기념일 아이콘 / 버킷리스트 연결 필드 추가
-- 코드에서는 이미 사용 중이던 컬럼으로, 마이그레이션 파일만 누락돼 있었음
-- 이미 컬럼이 있는 DB에서 실행해도 안전합니다 (기존 컬럼은 건드리지 않음)
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS date_idea_id UUID REFERENCES public.date_ideas(id) ON DELETE SET NULL;
