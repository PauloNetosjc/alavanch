
-- Insere estágio "Concluídos" no final de cada pipeline (exceto leads), se não existir
INSERT INTO public.pipeline_estagios (pipeline, nome, ordem, cor, ativo)
SELECT p.pipeline, 'Concluídos', COALESCE(MAX(pe.ordem), 0) + 1, '#10b981', true
FROM (VALUES ('operacional'), ('pos_venda'), ('revisao'), ('montagem'), ('fabrica')) AS p(pipeline)
LEFT JOIN public.pipeline_estagios pe ON pe.pipeline = p.pipeline AND pe.ativo = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_estagios x
  WHERE x.pipeline = p.pipeline AND lower(x.nome) = 'concluídos'
)
GROUP BY p.pipeline;

-- Atualiza a função para mover o card para "Concluídos" em vez de excluir
CREATE OR REPLACE FUNCTION public.concluir_kanban_card(_card_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pipeline text;
  _concluidos_id uuid;
BEGIN
  SELECT pipeline INTO _pipeline FROM public.kanban_cards WHERE id = _card_id;
  IF _pipeline IS NULL THEN RETURN; END IF;

  SELECT id INTO _concluidos_id
  FROM public.pipeline_estagios
  WHERE pipeline = _pipeline AND lower(nome) = 'concluídos' AND ativo = true
  ORDER BY ordem DESC LIMIT 1;

  IF _concluidos_id IS NULL THEN
    DELETE FROM public.kanban_cards WHERE id = _card_id;
  ELSE
    UPDATE public.kanban_cards
       SET estagio_id = _concluidos_id,
           iniciado_em = now(),
           notificacao_atraso_em = NULL,
           updated_at = now()
     WHERE id = _card_id;
  END IF;
END $function$;
