
ALTER TABLE public.tarefas_nativas_modelos
  DROP CONSTRAINT IF EXISTS tarefas_nativas_modelos_conclui_por_upload_categoria_check;

ALTER TABLE public.tarefas_nativas_modelos
  ADD CONSTRAINT tarefas_nativas_modelos_conclui_por_upload_categoria_check
  CHECK (
    conclui_por_upload_categoria IS NULL
    OR conclui_por_upload_categoria = ANY (ARRAY[
      'projeto_vendido',
      'projeto_para_revisao',
      'projeto_revisado',
      'projeto_inicial',
      'projeto_final',
      'medicao_tecnica',
      'vistoria_tecnico',
      'vistoria_cliente',
      'checkin_obra'
    ])
  );
