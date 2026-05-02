INSERT INTO public.agenda_config (loja_id, tipo, prazo_minimo_dias_uteis, dias_semana, hora_inicio, hora_fim, duracao_padrao_min)
VALUES (NULL, 'apresentacao_comercial'::public.agenda_tipo, 0, ARRAY[1,2,3,4,5,6], '08:00'::time, '20:00'::time, 60)
ON CONFLICT (loja_id, tipo) DO NOTHING;
