
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS previsao_medicao date;

COMMENT ON COLUMN public.pedidos.previsao_medicao IS
  'Previsão estimada da medição informada na venda. NÃO é o agendamento real (que vive em agenda_eventos tipo=medicao_tecnica e em pedidos.data_medicao_tecnica).';
