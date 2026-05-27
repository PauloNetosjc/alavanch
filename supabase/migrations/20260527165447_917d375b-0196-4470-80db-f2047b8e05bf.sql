CREATE OR REPLACE FUNCTION public.sincronizar_contrato_assinado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    UPDATE public.pedidos
       SET status = 'assinado', updated_at = now()
     WHERE id = NEW.pedido_id
       AND status <> 'cancelado';
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
$function$;