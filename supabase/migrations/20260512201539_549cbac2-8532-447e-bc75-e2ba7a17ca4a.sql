
BEGIN;

SET LOCAL app.kanban_origem = 'automacao';

DROP TRIGGER trg_ae_imut ON public.assinatura_evidencias;
DROP TRIGGER trg_aev_imut ON public.assinatura_eventos;

DELETE FROM public.timeline_eventos;
DELETE FROM public.notificacoes;
DELETE FROM public.agenda_eventos;

DELETE FROM public.assistencia_checklist;
DELETE FROM public.materiais_assistencia;
DELETE FROM public.fotos_assistencia;
DELETE FROM public.anexos_assistencia;
DELETE FROM public.assistencias;
DELETE FROM public.ocorrencias;

DELETE FROM public.assinatura_evidencias;
DELETE FROM public.assinatura_participantes;
DELETE FROM public.assinatura_eventos;
DELETE FROM public.solicitacoes_assinatura;
DELETE FROM public.assinaturas;
DELETE FROM public.documentos_assinados;

DELETE FROM public.parceiro_comprovantes;
DELETE FROM public.parceiro_comissoes;
DELETE FROM public.parceiro_pedidos;

DELETE FROM public.lancamentos_financeiros;
DELETE FROM public.notas_fiscais;
DELETE FROM public.aprovacoes_desconto;
DELETE FROM public.autorizacoes;
DELETE FROM public.checkins;

DELETE FROM public.kanban_cards;

DELETE FROM public.pedido_chat;
DELETE FROM public.pedido_estagio_checklist;
DELETE FROM public.pedido_estagio_historico;
DELETE FROM public.pedido_revisoes;
DELETE FROM public.pedido_itens_avulsos;
DELETE FROM public.pedido_documentos;
DELETE FROM public.pedido_pastas;
DELETE FROM public.pedidos;

DELETE FROM public.contratos;

DELETE FROM public.pagamentos_orcamento;
DELETE FROM public.sub_itens_ambiente;
DELETE FROM public.ambientes;
DELETE FROM public.orcamento_documentos;
DELETE FROM public.promob_imports;
DELETE FROM public.orcamentos;

CREATE TRIGGER trg_ae_imut
  BEFORE UPDATE OR DELETE ON public.assinatura_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.evidencia_imutavel();

CREATE TRIGGER trg_aev_imut
  BEFORE UPDATE OR DELETE ON public.assinatura_eventos
  FOR EACH ROW EXECUTE FUNCTION public.evidencia_imutavel();

COMMIT;
