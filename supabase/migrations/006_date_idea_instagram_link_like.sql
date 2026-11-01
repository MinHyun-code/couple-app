-- ============================================================
-- 버킷리스트(date_ideas) 인스타그램 링크에 하트(좋아요) 상태 추가
-- 기존 instagram_urls(TEXT[])를 instagram_links(JSONB, [{url, liked}])로 교체
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- ============================================================

ALTER TABLE public.date_ideas
  ADD COLUMN IF NOT EXISTS instagram_links JSONB NOT NULL DEFAULT '[]';

UPDATE public.date_ideas
SET instagram_links = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('url', u, 'liked', false)), '[]'::jsonb)
  FROM unnest(instagram_urls) AS u
)
WHERE instagram_urls IS NOT NULL
  AND array_length(instagram_urls, 1) > 0
  AND instagram_links = '[]'::jsonb;

ALTER TABLE public.date_ideas DROP COLUMN IF EXISTS instagram_urls;
