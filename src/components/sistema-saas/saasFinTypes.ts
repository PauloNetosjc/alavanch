export type SaasLancamento = {
  id: string;
  tipo: "receita" | "despesa";
  origem: string;
  base_cliente_id: string | null;
  sistema_saas_id: string | null;
  cobranca_id: string | null;
  compra_avulsa_id: string | null;
  contrato_id: string | null;
  fornecedor_nome: string | null;
  descricao: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
  conta_bancaria_id: string | null;
  forma_pagamento_prevista: string | null;
  forma_pagamento_real: string | null;
  valor: number;
  data_competencia: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: "pendente" | "pago" | "vencido" | "cancelado";
  observacoes: string | null;
};

export type SaasConta = { id: string; nome: string; ativo: boolean };
export type SaasCategoria = { id: string; nome: string; tipo: "receita" | "despesa"; ativo: boolean; contabilizar_dre: boolean; ordem: number; parent_id: string | null };
export type SaasCentro = { id: string; nome: string; ativo: boolean; ordem: number };
export type SaasForma = { id: string; nome: string; tipo: string | null; ativo: boolean; ordem: number };

export const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
