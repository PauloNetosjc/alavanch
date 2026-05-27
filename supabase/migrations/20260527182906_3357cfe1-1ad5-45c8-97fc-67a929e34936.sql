
-- ============================================================================
-- 1) Coluna token + datas em assinatura_participantes
-- ============================================================================
ALTER TABLE public.assinatura_participantes
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS visualizado_em timestamptz;

-- Backfill: gera token para todos participantes sem token
UPDATE public.assinatura_participantes
   SET token = encode(extensions.gen_random_bytes(32), 'hex')
 WHERE token IS NULL;

ALTER TABLE public.assinatura_participantes
  ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  ALTER COLUMN token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ap_token_unique
  ON public.assinatura_participantes(token);

-- ============================================================================
-- 2) Backfill: criar participantes para solicitações que ainda não têm
-- ============================================================================
INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, nome, email, telefone, documento, status, assinado_em, ip, user_agent)
SELECT s.id, 'cliente'::assinatura_participante_tipo,
       COALESCE(s.cliente_nome, c.nome),
       COALESCE(c.email, s.cliente_email),
       COALESCE(c.telefone, s.cliente_telefone),
       COALESCE(s.cliente_documento, c.cpf_cnpj),
       CASE WHEN s.cliente_assinado_em IS NOT NULL THEN 'assinado' ELSE 'pendente' END,
       s.cliente_assinado_em,
       s.cliente_ip, s.cliente_user_agent
  FROM public.solicitacoes_assinatura s
  LEFT JOIN public.clientes c ON c.id = s.cliente_id
 WHERE NOT EXISTS (
   SELECT 1 FROM public.assinatura_participantes p
    WHERE p.solicitacao_id = s.id AND p.tipo = 'cliente'
 );

INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, nome, email, status, assinado_em, ip, user_agent)
SELECT s.id, 'loja'::assinatura_participante_tipo,
       s.loja_assinatura_nome,
       s.loja_assinatura_email,
       CASE WHEN s.loja_assinado_em IS NOT NULL THEN 'assinado' ELSE 'pendente' END,
       s.loja_assinado_em,
       s.loja_ip, s.loja_user_agent
  FROM public.solicitacoes_assinatura s
  JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
 WHERE COALESCE(td.requer_assinatura_loja, false) = true
   AND NOT EXISTS (
     SELECT 1 FROM public.assinatura_participantes p
      WHERE p.solicitacao_id = s.id AND p.tipo = 'loja'
   );

-- ============================================================================
-- 3) Função: recalcular status da solicitação baseado nos participantes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalcular_status_solicitacao(p_solic uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_solic record;
  v_requer_loja boolean;
  v_cliente_assinado timestamptz;
  v_loja_assinado timestamptz;
  v_qtd_recusado int;
  v_novo public.assinatura_status;
BEGIN
  SELECT s.*, COALESCE(td.requer_assinatura_loja,false) AS requer_loja
    INTO v_solic
  FROM public.solicitacoes_assinatura s
  LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
  WHERE s.id = p_solic;

  IF v_solic.id IS NULL THEN RETURN; END IF;
  IF v_solic.status IN ('cancelado','recusado','expirado') THEN RETURN; END IF;

  v_requer_loja := v_solic.requer_loja;

  SELECT max(assinado_em) INTO v_cliente_assinado
    FROM public.assinatura_participantes
   WHERE solicitacao_id = p_solic AND tipo = 'cliente' AND status = 'assinado';

  SELECT max(assinado_em) INTO v_loja_assinado
    FROM public.assinatura_participantes
   WHERE solicitacao_id = p_solic AND tipo = 'loja' AND status = 'assinado';

  SELECT count(*) INTO v_qtd_recusado
    FROM public.assinatura_participantes
   WHERE solicitacao_id = p_solic AND status = 'recusado';

  IF v_qtd_recusado > 0 THEN
    v_novo := 'recusado';
  ELSIF v_solic.expira_em < now()
        AND (v_cliente_assinado IS NULL OR (v_requer_loja AND v_loja_assinado IS NULL)) THEN
    v_novo := 'expirado';
  ELSIF v_requer_loja THEN
    IF v_cliente_assinado IS NOT NULL AND v_loja_assinado IS NOT NULL THEN
      v_novo := 'concluido';
    ELSIF v_loja_assinado IS NOT NULL THEN
      v_novo := 'assinado_loja';        -- loja ok, aguardando cliente
    ELSIF v_cliente_assinado IS NOT NULL THEN
      v_novo := 'aguardando_loja';      -- cliente ok, aguardando loja
    ELSE
      v_novo := 'aguardando_loja';      -- ninguém assinou; loja vai primeiro
    END IF;
  ELSE
    v_novo := CASE WHEN v_cliente_assinado IS NOT NULL THEN 'concluido' ELSE 'aguardando_cliente' END;
  END IF;

  UPDATE public.solicitacoes_assinatura
     SET status = v_novo,
         cliente_assinado_em = COALESCE(cliente_assinado_em, v_cliente_assinado),
         loja_assinado_em    = COALESCE(loja_assinado_em, v_loja_assinado),
         concluido_em        = CASE WHEN v_novo = 'concluido' THEN COALESCE(concluido_em, now()) ELSE concluido_em END,
         updated_at          = now()
   WHERE id = p_solic
     AND status NOT IN ('cancelado','recusado','expirado');
END $$;

-- ============================================================================
-- 4) Trigger: recalcula sempre que participante mudar
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_ap_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalcular_status_solicitacao(COALESCE(NEW.solicitacao_id, OLD.solicitacao_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_recalcular_status_ap ON public.assinatura_participantes;
CREATE TRIGGER trg_recalcular_status_ap
AFTER INSERT OR UPDATE OF status, assinado_em ON public.assinatura_participantes
FOR EACH ROW EXECUTE FUNCTION public.trg_ap_recalc();

-- ============================================================================
-- 5) RPC: garantir participante (cria se não existir) — para uso pelo painel
-- ============================================================================
CREATE OR REPLACE FUNCTION public.garantir_participante(p_solic uuid, p_tipo public.assinatura_participante_tipo)
RETURNS public.assinatura_participantes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_part public.assinatura_participantes;
  v_solic record;
  v_cli record;
BEGIN
  SELECT * INTO v_part
    FROM public.assinatura_participantes
   WHERE solicitacao_id = p_solic AND tipo = p_tipo
   ORDER BY created_at ASC LIMIT 1;
  IF v_part.id IS NOT NULL THEN RETURN v_part; END IF;

  SELECT * INTO v_solic FROM public.solicitacoes_assinatura WHERE id = p_solic;
  IF v_solic.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;

  IF p_tipo = 'cliente' THEN
    SELECT nome, email, telefone, cpf_cnpj INTO v_cli FROM public.clientes WHERE id = v_solic.cliente_id;
    INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, nome, email, telefone, documento, status)
    VALUES (p_solic, 'cliente',
            COALESCE(v_solic.cliente_nome, v_cli.nome),
            COALESCE(v_cli.email, v_solic.cliente_email),
            COALESCE(v_cli.telefone, v_solic.cliente_telefone),
            COALESCE(v_solic.cliente_documento, v_cli.cpf_cnpj),
            'pendente')
    RETURNING * INTO v_part;
  ELSE
    INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, nome, email, status)
    VALUES (p_solic, 'loja', v_solic.loja_assinatura_nome, v_solic.loja_assinatura_email, 'pendente')
    RETURNING * INTO v_part;
  END IF;

  RETURN v_part;
END $$;

GRANT EXECUTE ON FUNCTION public.garantir_participante(uuid, public.assinatura_participante_tipo) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_status_solicitacao(uuid) TO authenticated;

-- ============================================================================
-- 6) RLS: permitir SELECT anônimo de participante pelo token (e UPDATE da própria linha)
-- ============================================================================
DROP POLICY IF EXISTS "ap_select_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_select_anon" ON public.assinatura_participantes
FOR SELECT TO anon
USING (
  token IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.solicitacoes_assinatura s
     WHERE s.id = assinatura_participantes.solicitacao_id
       AND s.status NOT IN ('cancelado','expirado')
  )
);

DROP POLICY IF EXISTS "ap_update_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_update_anon" ON public.assinatura_participantes
FOR UPDATE TO anon
USING (
  token IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.solicitacoes_assinatura s
     WHERE s.id = assinatura_participantes.solicitacao_id
       AND s.expira_em > now()
       AND s.status NOT IN ('cancelado','expirado','recusado')
  )
)
WITH CHECK (token IS NOT NULL);

-- ============================================================================
-- 7) Backfill final: recalcular todas as solicitações não terminais
-- ============================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.solicitacoes_assinatura
            WHERE status NOT IN ('cancelado','recusado','expirado','concluido')
  LOOP
    PERFORM public.recalcular_status_solicitacao(r.id);
  END LOOP;
END $$;
