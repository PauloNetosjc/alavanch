
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS estagio_pos_venda_id uuid REFERENCES public.pipeline_estagios(id),
  ADD COLUMN IF NOT EXISTS estagio_revisao_id uuid REFERENCES public.pipeline_estagios(id),
  ADD COLUMN IF NOT EXISTS estagio_montagem_id uuid REFERENCES public.pipeline_estagios(id),
  ADD COLUMN IF NOT EXISTS estagio_fabrica_id uuid REFERENCES public.pipeline_estagios(id),
  ADD COLUMN IF NOT EXISTS estrelas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arquivado boolean DEFAULT false;

DELETE FROM public.pipeline_estagios WHERE pipeline IN ('fabrica','montagem','medicao','entrega');

INSERT INTO public.pipeline_estagios (pipeline, nome, ordem, cor) VALUES
('pos_venda', '1 - Contrato Aguardando', 1, '#2563eb'),
('pos_venda', '2 - Emissão de Boletos', 2, '#0891b2'),
('pos_venda', '3 - Aguardando Aprovação', 3, '#ca8a04'),
('pos_venda', '4 - Envio: PJ Inicial+Cesta+Video', 4, '#16a34a'),

('revisao', 'Análise Revisão (Conferência)', 1, '#6366f1'),
('revisao', 'Venda Entrega Futura', 2, '#3b82f6'),
('revisao', '1 - Preparo PJ Final (Conferente)', 3, '#0ea5e9'),
('revisao', '2 - Revisão Loja (Comercial)', 4, '#14b8a6'),
('revisao', '3 - Preparo PDF Final (Conf.)', 5, '#10b981'),
('revisao', '4 - Assinatura PDF Final (Conf.)', 6, '#22c55e'),
('revisao', '5 - Envio Fábrica (Conferência)', 7, '#84cc16'),

('montagem', '1 - Produzindo Novo - Fábrica', 1, '#6366f1'),
('montagem', '2 - Agendamento Entrega-Depósito', 2, '#3b82f6'),
('montagem', '3 - Entregue', 3, '#0ea5e9'),
('montagem', '4 - Montagem Agendada', 4, '#14b8a6'),
('montagem', '5 - Em Montagem', 5, '#10b981'),
('montagem', '6 - Vistoria Pendente', 6, '#f59e0b'),
('montagem', '7 - Vistoria Agendada', 7, '#22c55e'),

('fabrica', '1 - Aguardando Lotes', 1, '#6366f1'),
('fabrica', '2 - Aguardando Produção F', 2, '#3b82f6'),
('fabrica', '3 - Em Produção', 3, '#0ea5e9'),
('fabrica', '4 - Falta Itens (Perfis, Ripado, Provenç.)', 4, '#dc2626'),
('fabrica', '5 - Pronto Expedição', 5, '#22c55e');
