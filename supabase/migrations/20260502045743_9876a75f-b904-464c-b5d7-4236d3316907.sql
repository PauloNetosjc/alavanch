-- 1) Garantir categorias necessárias
INSERT INTO public.categorias_financeiras (tipo, nome, ordem)
SELECT 'entrada', 'Recebimento de Contrato', 10
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiras WHERE tipo='entrada' AND nome ILIKE '%recebimento%contrato%');

INSERT INTO public.categorias_financeiras (tipo, nome, ordem)
SELECT 'saida', 'Custo de Fábrica', 10
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_financeiras WHERE tipo='saida' AND nome ILIKE '%custo%fábrica%' OR nome ILIKE '%custo%fabrica%');

-- 2) Substituir trigger gerar_lancamentos_pedido para gerar PARCELAS reais respeitando datas
CREATE OR REPLACE FUNCTION public.gerar_lancamentos_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pag record;
  v_cat_id uuid;
  v_n int;
  v_valor_parcela numeric;
  v_data date;
  i int;
BEGIN
  IF NEW.orcamento_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = NEW.id AND tipo = 'entrada') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo = 'entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;

  FOR v_pag IN
    SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = NEW.orcamento_id
  LOOP
    v_n := GREATEST(COALESCE(v_pag.parcelas, 1), 1);
    v_valor_parcela := ROUND((v_pag.valor / v_n)::numeric, 2);
    v_data := COALESCE(v_pag.data_vencimento, CURRENT_DATE);

    FOR i IN 1..v_n LOOP
      INSERT INTO public.lancamentos_financeiros (
        tipo, descricao, valor, data_vencimento, status,
        pedido_id, categoria_id, loja_id
      ) VALUES (
        'entrada',
        v_pag.metodo || ' - ' || NEW.codigo ||
          CASE WHEN v_n > 1 THEN ' (' || i || '/' || v_n || ')' ELSE '' END,
        CASE
          WHEN i = v_n THEN v_pag.valor - (v_valor_parcela * (v_n - 1)) -- ajusta arredondamento na última
          ELSE v_valor_parcela
        END,
        (v_data + ((i - 1) || ' months')::interval)::date,
        'pendente',
        NEW.id, v_cat_id, NEW.loja_id
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_gerar_lancamentos_pedido ON public.pedidos;
CREATE TRIGGER trg_gerar_lancamentos_pedido
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.gerar_lancamentos_pedido();

-- 3) Trigger para gerar custo de fábrica quando o pedido entra na fase 'fabrica'
CREATE OR REPLACE FUNCTION public.gerar_custo_fabrica_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_amb record;
  v_cat_id uuid;
BEGIN
  -- Apenas quando muda PARA 'fabrica'
  IF NEW.workflow_estagio IS DISTINCT FROM OLD.workflow_estagio
     AND NEW.workflow_estagio = 'fabrica'
     AND NEW.orcamento_id IS NOT NULL THEN

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
        COALESCE(NEW.data_envio_fabrica, CURRENT_DATE),
        'pendente',
        NEW.id, v_cat_id, NEW.loja_id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_gerar_custo_fabrica ON public.pedidos;
CREATE TRIGGER trg_gerar_custo_fabrica
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.gerar_custo_fabrica_pedido();