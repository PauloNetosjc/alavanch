
-- Reverter orçamentos cujo pedido foi cancelado de volta para negociação
UPDATE public.orcamentos o
SET status = 'negociacao',
    confirmado_em = NULL,
    desconto_perc = 0,
    desconto_valor = 0
WHERE o.status IN ('convertido','aprovado')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.orcamento_id = o.id AND p.status <> 'cancelado'
  );

-- Limpa pagamentos remanescentes desses orçamentos
DELETE FROM public.pagamentos_orcamento pg
WHERE pg.orcamento_id IN (
  SELECT o.id FROM public.orcamentos o
  WHERE o.status = 'negociacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.orcamento_id = o.id AND p.status <> 'cancelado'
    )
);
