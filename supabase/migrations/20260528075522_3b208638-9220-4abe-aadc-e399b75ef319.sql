
-- Vincular o modelo "Fazer medição técnica" à conclusão por upload na categoria
-- "medicao_tecnica" da Central de Documentos, e marcar como exige_anexo.
UPDATE public.tarefas_nativas_modelos
   SET exige_anexo = true,
       conclui_por_upload_categoria = 'medicao_tecnica'
 WHERE gatilho = 'medicao_tecnica_agendada'
   AND (conclui_por_upload_categoria IS DISTINCT FROM 'medicao_tecnica'
        OR exige_anexo IS DISTINCT FROM true);
