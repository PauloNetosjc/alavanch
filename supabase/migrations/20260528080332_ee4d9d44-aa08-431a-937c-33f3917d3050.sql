
ALTER TABLE public.pedido_documentos
  DROP CONSTRAINT IF EXISTS pedido_documentos_categoria_projeto_check;

ALTER TABLE public.pedido_documentos
  ADD CONSTRAINT pedido_documentos_categoria_projeto_check
  CHECK (categoria_projeto = ANY (ARRAY[
    'projeto_vendido'::text,
    'projeto_para_revisao'::text,
    'projeto_revisado'::text,
    'medicao_tecnica'::text
  ]));
