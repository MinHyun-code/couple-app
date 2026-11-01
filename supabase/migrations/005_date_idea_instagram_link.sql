-- ============================================================
-- 버킷리스트(date_ideas)에 인스타그램 릴스/게시물 링크 필드 추가 (여러 개 저장 가능)
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- 이전에 이 마이그레이션의 단일 컬럼(instagram_url) 버전을 이미 실행했어도 안전합니다.
-- ============================================================

ALTER TABLE public.date_ideas DROP COLUMN IF EXISTS instagram_url;

ALTER TABLE public.date_ideas
  ADD COLUMN IF NOT EXISTS instagram_urls TEXT[] NOT NULL DEFAULT '{}';
