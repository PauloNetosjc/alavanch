-- Adiciona campo "data de pagamento fábrica" no pedido (fica em aberto até o usuário definir)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS data_pagamento_fabrica date;

-- Atualiza trigger de geração do custo de fábrica:
--  - dispara quando workflow_estagio vira 'fabrica' OU quando data_envio_fabrica é preenchida
--  - usa data_pagamento_fabrica como vencimento (fallback para data_envio_fabrica, depois CURRENT_DATE)
--  - cria um lançamento por ambiente com custo_fabrica > 0
CREATE OR REPLACE FUNCTION public.gerar_custo_fabrica_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_amb record;
  v_cat_id uuid;
  v_disparou boolean := false;
  v_venc date;
BEGIN
  -- Dispara ao mudar workflow para 'fabrica' OU ao preencher data_envio_fabrica
  IF NEW.workflow_estagio IS DISTINCT FROM OLD.workflow_estagio
     AND NEW.workflow_estagio = 'fabrica' THEN
    v_disparou := true;
  END IF;

  IF (OLD.data_envio_fabrica IS NULL AND NEW.data_envio_fabrica IS NOT NULL) THEN
    v_disparou := true;
  END IF;

  IF NOT v_disparou OR NEW.orcamento_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Evita duplicar
  IF EXISTS (
    SELECT 1 FROM public.lancamentos_financeiros
    WHERE pedido_id = NEW.id AND tipo = 'saida'
      AND descricao ILIKE 'Custo fábrica%'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo = 'saida' AND (nome ILIKE '%custo%fábrica%' OR nome ILIKE '%custo%fabrica%')
   LIMIT 1;

  v_venc := COALESCE(NEW.data_pagamento_fabrica, NEW.data_envio_fabrica, CURRENT_DATE);

  FOR v_amb IN
    SELECT nome, COALESCE(custo_fabrica, 0) AS custo
    FROM public.ambientes
    WHERE orcamento_id = NEW.orcamento_id
      AND COALESCE(custo_fabrica, 0) > 0
  LOOP
    INSERT INTO public.lancamentos_financeiros (
      tipo, descricao, valor, data_vencimento, status,
      pedido_id, categoria_id, loja_id
    ) VALUES (
      'saida',
      'Custo fábrica - ' || NEW.codigo || ' / ' || v_amb.nome,
      v_amb.custo,
      v_venc,
      'pendente',
      NEW.id, v_cat_id, NEW.loja_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;