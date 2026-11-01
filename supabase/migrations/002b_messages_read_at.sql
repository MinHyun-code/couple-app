-- ============================================================
-- messages 테이블에 read_at 컬럼 + UPDATE 정책 추가
-- (002_messages.sql 이미 실행한 경우 이것만 실행하세요)
-- ============================================================

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE POLICY "messages_update_read" ON public.messages FOR UPDATE
  USING (
    sender_id != auth.uid()
    AND couple_id IN (
      SELECT id FROM public.couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );
