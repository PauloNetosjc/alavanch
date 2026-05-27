CREATE OR REPLACE FUNCTION public.sincronizar_status_assinatura_por_evidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solic record;
  v_requer_loja boolean := false;
  v_cliente_assinado timestamptz;
  v_loja_assinado timestamptz;
  v_novo_status public.assinatura_status;
BEGIN
  SELECT s.*, td.requer_assinatura_loja
    INTO v_solic
  FROM public.solicitacoes_assinatura s
  LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
  WHERE s.id = NEW.solicitacao_id;

  IF v_solic.id IS NULL OR v_solic.status IN ('cancelado','recusado','expirado') THEN
    RETURN NEW;
  END IF;

  v_requer_loja := COALESCE(v_solic.requer_assinatura_loja, false);

  SELECT max(p.assinado_em)
    INTO v_cliente_assinado
  FROM public.assinatura_participantes p
  WHERE p.solicitacao_id = NEW.solicitacao_id
    AND p.tipo = 'cliente'
    AND p.status = 'assinado';

  SELECT max(p.assinado_em)
    INTO v_loja_assinado
  FROM public.assinatura_participantes p
  WHERE p.solicitacao_id = NEW.solicitacao_id
    AND p.tipo = 'loja'
    AND p.status = 'assinado';

  IF v_requer_loja THEN
    IF v_cliente_assinado IS NOT NULL AND v_loja_assinado IS NOT NULL THEN
      v_novo_status := 'concluido';
    ELSIF v_loja_assinado IS NOT NULL THEN
      v_novo_status := 'assinado_loja';
    ELSIF v_cliente_assinado IS NOT NULL THEN
      v_novo_status := 'aguardando_loja';
    ELSE
      v_novo_status := 'aguardando_loja';
    END IF;
  ELSE
    v_novo_status := CASE WHEN v_cliente_assinado IS NOT NULL THEN 'concluido' ELSE 'aguardando_cliente' END;
  END IF;

  UPDATE public.solicitacoes_assinatura
     SET status = v_novo_status,
         cliente_assinado_em = CASE WHEN v_cliente_assinado IS NOT NULL THEN COALESCE(cliente_assinado_em, v_cliente_assinado) ELSE cliente_assinado_em END,
         loja_assinado_em = CASE WHEN v_loja_assinado IS NOT NULL THEN COALESCE(loja_assinado_em, v_loja_assinado) ELSE loja_assinado_em END,
         concluido_em = CASE WHEN v_novo_status = 'concluido' THEN COALESCE(concluido_em, now()) ELSE NULL END
   WHERE id = NEW.solicitacao_id
     AND status NOT IN ('cancelado','recusado','expirado');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_contrato_assinado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requer_loja boolean := false;
  v_assinatura_completa boolean := false;
BEGIN
  IF NEW.contrato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(td.requer_assinatura_loja, false)
    INTO v_requer_loja
  FROM public.tipos_documento td
  WHERE td.id = NEW.tipo_documento_id;

  v_assinatura_completa := NEW.status = 'concluido'
    AND NEW.cliente_assinado_em IS NOT NULL
    AND (NOT v_requer_loja OR NEW.loja_assinado_em IS NOT NULL);

  IF v_assinatura_completa
     AND (TG_OP = 'INSERT'
          OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.cliente_assinado_em IS DISTINCT FROM NEW.cliente_assinado_em
          OR OLD.loja_assinado_em IS DISTINCT FROM NEW.loja_assinado_em) THEN
    UPDATE public.contratos
       SET status = 'assinado',
           assinado_em = COALESCE(assinado_em, NEW.concluido_em, NEW.cliente_assinado_em, now()),
           assinatura_nome = COALESCE(assinatura_nome, (
             SELECT p.nome FROM public.assinatura_participantes p
             WHERE p.solicitacao_id = NEW.id AND p.tipo = 'cliente' AND p.status = 'assinado'
             ORDER BY p.assinado_em DESC NULLS LAST LIMIT 1
           )),
           assinatura_cpf = COALESCE(assinatura_cpf, (
             SELECT p.documento FROM public.assinatura_participantes p
             WHERE p.solicitacao_id = NEW.id AND p.tipo = 'cliente' AND p.status = 'assinado'
             ORDER BY p.assinado_em DESC NULLS LAST LIMIT 1
           )),
           metodo_assinatura = COALESCE(metodo_assinatura, 'digital')
     WHERE id = NEW.contrato_id
       AND status <> 'assinado';
  ELSIF NEW.status IN ('aguardando_cliente','assinado_loja','aguardando_loja','assinado_cliente','rascunho') THEN
    UPDATE public.contratos
       SET status = 'aguardando_assinatura',
           assinado_em = NULL,
           assinatura_nome = NULL,
           assinatura_cpf = NULL
     WHERE id = NEW.contrato_id
       AND status = 'assinado'
       AND NOT EXISTS (
         SELECT 1
         FROM public.solicitacoes_assinatura s
         LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
         WHERE s.contrato_id = NEW.contrato_id
           AND s.status = 'concluido'
           AND s.cliente_assinado_em IS NOT NULL
           AND (COALESCE(td.requer_assinatura_loja, false) = false OR s.loja_assinado_em IS NOT NULL)
       );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contrato_assinado ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_sync_contrato_assinado
AFTER INSERT OR UPDATE OF status, cliente_assinado_em, loja_assinado_em ON public.solicitacoes_assinatura
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_contrato_assinado();

DROP POLICY IF EXISTS "sa_update_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_update_anon"
ON public.solicitacoes_assinatura
FOR UPDATE
TO anon
USING (
  token IS NOT NULL
  AND status = ANY (ARRAY[
    'aguardando_cliente'::assinatura_status,
    'rascunho'::assinatura_status,
    'assinado_cliente'::assinatura_status,
    'aguardando_loja'::assinatura_status,
    'assinado_loja'::assinatura_status
  ])
  AND expira_em > now()
)
WITH CHECK (
  token IS NOT NULL
  AND expira_em > now()
  AND status = ANY (ARRAY[
    'assinado_cliente'::assinatura_status,
    'aguardando_loja'::assinatura_status,
    'assinado_loja'::assinatura_status,
    'concluido'::assinatura_status,
    'recusado'::assinatura_status
  ])
);

DROP POLICY IF EXISTS "ap_insert_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_insert_anon"
ON public.assinatura_participantes
FOR INSERT
TO anon
WITH CHECK (
  tipo = 'cliente'
  AND EXISTS (
    SELECT 1
    FROM public.solicitacoes_assinatura s
    LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
    WHERE s.id = solicitacao_id
      AND s.expira_em > now()
      AND (
        s.status IN ('aguardando_cliente','rascunho','assinado_loja')
        OR (s.status = 'aguardando_loja' AND COALESCE(td.requer_assinatura_loja, false) = false)
      )
  )
);

DROP POLICY IF EXISTS "ae_insert_anon" ON public.assinatura_evidencias;
CREATE POLICY "ae_insert_anon"
ON public.assinatura_evidencias
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_assinatura s
    LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
    LEFT JOIN public.assinatura_participantes p ON p.id = assinatura_evidencias.participante_id
    WHERE s.id = solicitacao_id
      AND s.expira_em > now()
      AND (
        s.status IN ('aguardando_cliente','rascunho','assinado_cliente','assinado_loja')
        OR (s.status = 'aguardando_loja' AND COALESCE(td.requer_assinatura_loja, false) = false)
      )
      AND p.tipo = 'cliente'
  )
);

UPDATE public.solicitacoes_assinatura s
   SET status = 'assinado_loja',
       concluido_em = NULL
  FROM public.tipos_documento td
 WHERE td.id = s.tipo_documento_id
   AND COALESCE(td.requer_assinatura_loja, false) = true
   AND s.loja_assinado_em IS NOT NULL
   AND s.cliente_assinado_em IS NULL
   AND s.status IN ('concluido','aguardando_cliente','aguardando_loja');

UPDATE public.solicitacoes_assinatura s
   SET status = 'aguardando_loja',
       concluido_em = NULL
  FROM public.tipos_documento td
 WHERE td.id = s.tipo_documento_id
   AND COALESCE(td.requer_assinatura_loja, false) = true
   AND s.loja_assinado_em IS NULL
   AND s.cliente_assinado_em IS NULL
   AND s.status IN ('aguardando_cliente','concluido','assinado_loja');

UPDATE public.solicitacoes_assinatura s
   SET status = 'aguardando_loja',
       concluido_em = NULL
  FROM public.tipos_documento td
 WHERE td.id = s.tipo_documento_id
   AND COALESCE(td.requer_assinatura_loja, false) = true
   AND s.cliente_assinado_em IS NOT NULL
   AND s.loja_assinado_em IS NULL
   AND s.status IN ('concluido','assinado_cliente');

UPDATE public.contratos c
   SET status = 'aguardando_assinatura',
       assinado_em = NULL,
       assinatura_nome = NULL,
       assinatura_cpf = NULL
 WHERE status = 'assinado'
   AND EXISTS (
     SELECT 1
     FROM public.solicitacoes_assinatura s
     LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
     WHERE s.contrato_id = c.id
       AND COALESCE(td.requer_assinatura_loja, false) = true
       AND (s.cliente_assinado_em IS NULL OR s.loja_assinado_em IS NULL)
       AND s.status NOT IN ('cancelado','recusado','expirado')
   )
   AND NOT EXISTS (
     SELECT 1
     FROM public.solicitacoes_assinatura s
     LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
     WHERE s.contrato_id = c.id
       AND s.status = 'concluido'
       AND s.cliente_assinado_em IS NOT NULL
       AND (COALESCE(td.requer_assinatura_loja, false) = false OR s.loja_assinado_em IS NOT NULL)
   );