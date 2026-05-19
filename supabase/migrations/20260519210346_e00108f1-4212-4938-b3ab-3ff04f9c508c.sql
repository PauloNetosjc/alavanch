-- Auto-mover orcamento para o estágio "Concluído" do CRM quando um pedido é criado
CREATE OR REPLACE FUNCTION public.fn_orcamento_concluir_no_crm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  est_ganho_id uuid;
BEGIN
  IF NEW.orcamento_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO est_ganho_id
  FROM public.crm_estagios
  WHERE ativo = true AND is_ganho = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF est_ganho_id IS NOT NULL THEN
    UPDATE public.orcamentos
    SET estagio_id = est_ganho_id
    WHERE id = NEW.orcamento_id
      AND (estagio_id IS DISTINCT FROM est_ganho_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_concluir_orcamento_crm ON public.pedidos;
CREATE TRIGGER trg_pedido_concluir_orcamento_crm
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_orcamento_concluir_no_crm();

-- Backfill: orçamentos que já viraram pedido devem estar no estágio Concluído
UPDATE public.orcamentos o
SET estagio_id = (
  SELECT id FROM public.crm_estagios
  WHERE ativo = true AND is_ganho = true
  ORDER BY ordem ASC LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM public.pedidos p WHERE p.orcamento_id = o.id)
  AND o.estagio_id IS DISTINCT FROM (
    SELECT id FROM public.crm_estagios WHERE ativo = true AND is_ganho = true ORDER BY ordem ASC LIMIT 1
  );