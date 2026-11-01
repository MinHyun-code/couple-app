-- ============================================================
-- 대화 기능 (실시간 채팅 + 읽음 확인)
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE public.messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id   UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) > 0),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX messages_couple_created ON public.messages (couple_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (couple_id IN (
    SELECT id FROM public.couples
    WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));

CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND couple_id IN (
      SELECT id FROM public.couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

-- 받은 메시지에 한해 read_at만 업데이트 가능
CREATE POLICY "messages_update_read" ON public.messages FOR UPDATE
  USING (
    sender_id != auth.uid()
    AND couple_id IN (
      SELECT id FROM public.couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  USING (sender_id = auth.uid());

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
