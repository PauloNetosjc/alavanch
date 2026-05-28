// Lógica compartilhada de pré-visualização da Receita # (antes da integração com A Receber).
// Mantém paridade 1:1 com a função SQL `gerar_receber_de_pedido_assinado`.

export type MetodoPagamento = {
  id?: string;
  nome: string;
  agrupado?: boolean | null;
  juros_modo?: string | null;
  prazo_recebimento_dias?: number | null;
  parcelas_config?: any;
};

export type PagamentoOrcamento = {
  id?: string;
  metodo: string;
  parcelas?: number | null;
  valor?: number | null;
  data_vencimento?: string | null;
  parcelas_detalhe?: any;
  parcelas_vencimentos?: any;
  parcelas_formas?: any;
  forma_pagamento?: string | null;
  created_at?: string | null;
};

export type ParcelaPreview = {
  numero: number;
  total: number;
  valor: number;
  juros: number;
  taxa_perc: number;
  recebido: number;
  saldo: number;
  vencimento: string | null;
  forma: string;
  agrupado: boolean;
  status: string;
  origemReal: false;
};

const num = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const asArr = (v: any): any[] => (Array.isArray(v) ? v : []);
const dateStr = (v: any): string | null => {
  if (!v) return null;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : null;
};

function formaOficialDoMetodo(m?: MetodoPagamento | null, fallback?: string): string | undefined {
  const cfg = asArr(m?.parcelas_config);
  if (cfg.length > 0) {
    const fp = cfg[0]?.forma_pagamento;
    if (typeof fp === "string" && fp.trim()) return fp.trim();
    if (Array.isArray(fp) && fp[0]) return String(fp[0]);
  }
  return fallback;
}

function jurosPercParaQtd(m: MetodoPagamento | null | undefined, qtd: number): number {
  if (!m) return 0;
  if ((m.juros_modo || "repassar") !== "absorver") return 0;
  const cfg = asArr(m.parcelas_config);
  const item = cfg.find((c) => num(c?.numero) === qtd);
  return item ? num(item.juros_perc) : 0;
}

/**
 * Gera a prévia (modo simulação) a partir de pagamentos_orcamento + metodos_pagamento.
 * Espelha a SQL `gerar_receber_de_pedido_assinado`.
 */
export function gerarPreviewReceita(
  pagamentos: PagamentoOrcamento[],
  metodos: MetodoPagamento[],
  dataBaseISO: string
): ParcelaPreview[] {
  const out: ParcelaPreview[] = [];
  const dataBase = dataBaseISO || new Date().toISOString().slice(0, 10);

  // total global p/ X/Y
  let totalGlobal = 0;
  for (const p of pagamentos) {
    const det = asArr(p.parcelas_detalhe);
    totalGlobal += det.length > 0 ? det.length : Math.max(num(p.parcelas, 1), 1);
  }
  if (totalGlobal === 0) return out;

  let idxGlobal = 1;

  const pags = [...pagamentos].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

  for (const pag of pags) {
    const metodo = metodos.find((m) => m.nome === pag.metodo) || null;
    const prazo = num(metodo?.prazo_recebimento_dias, 0);
    const formaMetodo = formaOficialDoMetodo(metodo, pag.metodo) || pag.metodo;

    const det = asArr(pag.parcelas_detalhe);
    const vencs = asArr(pag.parcelas_vencimentos);
    const formas = asArr(pag.parcelas_formas);

    const qtd = det.length > 0 ? det.length : Math.max(num(pag.parcelas, 1), 1);
    const valorTotal = num(pag.valor);

    let grupoValor = 0;
    let grupoQtd = 0;
    let grupoVenc: string | null = null;

    for (let k = 0; k < qtd; k++) {
      const el = det[k];
      const isObj = el && typeof el === "object" && !Array.isArray(el);

      const valor = det.length > 0
        ? (isObj ? num(el.valor) : num(el))
        : Math.round((valorTotal / Math.max(qtd, 1)) * 100) / 100;

      // vencimento
      let venc: string | null = null;
      if (isObj) venc = dateStr(el.data_vencimento || el.data);
      if (!venc && vencs[k]) venc = dateStr(vencs[k]);
      if (!venc) {
        if (pag.data_vencimento) venc = dateStr(pag.data_vencimento);
        else {
          const d = new Date(dataBase + "T00:00");
          d.setMonth(d.getMonth() + k);
          venc = d.toISOString().slice(0, 10);
        }
      }

      // forma
      let forma: string | null = null;
      if (isObj) forma = (el.forma_pagamento || el.forma) || null;
      if (!forma && formas[k]) forma = String(formas[k]);
      if (!forma) forma = formaMetodo;

      const pertenceAgrupado =
        !!metodo?.agrupado &&
        !!formaMetodo &&
        String(forma).toLowerCase() === String(formaMetodo).toLowerCase();

      if (pertenceAgrupado) {
        grupoValor += valor;
        grupoQtd += 1;
        if (!grupoVenc || (venc && venc < grupoVenc)) grupoVenc = venc;
      } else {
        out.push({
          numero: idxGlobal++,
          total: 0,
          valor,
          juros: 0,
          taxa_perc: 0,
          recebido: 0,
          saldo: valor,
          vencimento: venc,
          forma: forma || "—",
          agrupado: false,
          status: "pendente",
          origemReal: false,
        });
      }
    }

    if (grupoQtd > 0) {
      const jurosPerc = jurosPercParaQtd(metodo, grupoQtd);
      const juros = Math.round(grupoValor * jurosPerc) / 100;
      // Data base do agrupado: vencimento negociado primeiro; assinatura/dataBase só como fallback.
      // O prazo de recebimento agrupado é SEMPRE somado sobre essa data base.
      let venc = grupoVenc
        || (vencs[0] ? dateStr(vencs[0]) : null)
        || (pag.data_vencimento ? dateStr(pag.data_vencimento) : null)
        || dataBase;
      if (prazo > 0 && venc) {
        const d = new Date(venc + "T00:00");
        d.setDate(d.getDate() + prazo);
        venc = d.toISOString().slice(0, 10);
      }
      out.push({
        numero: idxGlobal++,
        total: 0,
        valor: grupoValor,
        juros,
        taxa_perc: jurosPerc,
        recebido: 0,
        saldo: grupoValor - juros,
        vencimento: venc,
        forma: formaMetodo || pag.metodo,
        agrupado: true,
        status: "pendente",
        origemReal: false,
      });
    }
  }

  return out.map((p) => ({ ...p, total: out.length }));
}
