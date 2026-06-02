
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_jid text,
  ADD COLUMN IF NOT EXISTS contact_lid text,
  ADD COLUMN IF NOT EXISTS contact_name text;

ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_jid text,
  ADD COLUMN IF NOT EXISTS contact_lid text;

-- Backfill a partir de wa_chat_id
UPDATE public.whatsapp_conversas
SET
  contact_jid = COALESCE(contact_jid, wa_chat_id),
  contact_phone = COALESCE(
    contact_phone,
    CASE WHEN wa_chat_id LIKE '%@s.whatsapp.net' THEN split_part(wa_chat_id, '@', 1) END
  ),
  contact_lid = COALESCE(
    contact_lid,
    CASE WHEN wa_chat_id LIKE '%@lid' THEN split_part(wa_chat_id, '@', 1) END
  ),
  contact_name = COALESCE(contact_name, titulo)
WHERE contact_jid IS NULL OR contact_phone IS NULL OR contact_lid IS NULL OR contact_name IS NULL;

UPDATE public.whatsapp_mensagens
SET
  contact_jid = COALESCE(contact_jid, wa_chat_id),
  contact_phone = COALESCE(
    contact_phone,
    CASE WHEN wa_chat_id LIKE '%@s.whatsapp.net' THEN split_part(wa_chat_id, '@', 1) END
  ),
  contact_lid = COALESCE(
    contact_lid,
    CASE WHEN wa_chat_id LIKE '%@lid' THEN split_part(wa_chat_id, '@', 1) END
  )
WHERE contact_jid IS NULL OR contact_phone IS NULL OR contact_lid IS NULL;

CREATE INDEX IF NOT EXISTS idx_wa_conv_contact_phone ON public.whatsapp_conversas(conta_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_wa_conv_contact_lid ON public.whatsapp_conversas(conta_id, contact_lid);

-- Realtime
ALTER TABLE public.whatsapp_conversas REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_mensagens REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_conversas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_mensagens'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens';
  END IF;
END $$;
