// Helpers para renderizar contratos a partir do template + dados do orçamento.
import type { ClienteRow } from "@/components/clientes/ClienteFormDialog";


export type ContratoTemplate = {
  id: string;
  nome: string;
  titulo: string;
  subtitulo: string | null;
  clausulas: string;
  observacoes_padrao: string | null;
  rodape: string | null;
};

export type ContratoCtx = {
  numero: string;
  emitido_em: Date;
  empresa: { nome: string; cnpj?: string | null; endereco?: string | null; telefone?: string | null; razao_social?: string | null; nome_fantasia?: string | null };
  cliente: ClienteRow | null;
  ambientes: { nome: string; descricao: string | null; preco_base: number; preco_final: number }[];
  subtotal: number;
  desconto_perc: number;
  desconto_valor: number;
  total: number;
  pagamentos: {
    metodo: string;
    parcelas: number;
    valor: number;
    data_vencimento: string | null;
    parcelas_detalhe?: number[] | null;
    parcelas_vencimentos?: (string | null)[] | null;
    parcelas_formas?: string[] | null;
    is_entrada?: boolean;
  }[];
  observacoes_adicionais: string;
  signing_url: string;
  assinatura_loja_url?: string | null;
  loja_assinado_em?: string | null;
  loja_assinatura_nome?: string | null;
  loja_assinatura_email?: string | null;
  loja_assinatura_cargo?: string | null;
  assinatura_cliente_url?: string | null;
  cliente_assinado_em?: string | null;
  cliente_ip?: string | null;
  vendedor?: { nome?: string | null; email?: string | null } | null;
  prazo_entrega?: string | null;
  /** URL pública de validação (página /validar-contrato/:token) */
  validation_url?: string | null;
  /** Data URL (PNG) do QR Code apontando para validation_url */
  qr_data_url?: string | null;
  /** Quando false, oculta toda referência a desconto (coluna, totais, variáveis) */
  mostrar_desconto?: boolean;
};


export const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const escapeHtml = (v: string) =>
  String(v).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] as string));

export type ParcelaExpandida = {
  idx: number;
  metodo: string;
  data_vencimento: string | null;
  valor: number;
  descricao: string;
  parcela_num: number;
  parcela_total: number;
  is_entrada: boolean;
};

/** Expande os pagamentos do snapshot em parcelas individuais (mesma lógica usada em ParcelasTabela). */
export function expandirPagamentosEmParcelas(pagamentos: ContratoCtx["pagamentos"]): ParcelaExpandida[] {
  const linhas: ParcelaExpandida[] = [];
  (pagamentos || []).forEach((p) => {
    const n = Math.max(1, Number(p.parcelas) || 1);
    const det: number[] = Array.isArray(p.parcelas_detalhe) && p.parcelas_detalhe.length === n
      ? p.parcelas_detalhe.map(Number)
      : (() => {
          const base = Number((Number(p.valor) / n).toFixed(2));
          const arr = Array(n).fill(base);
          arr[n - 1] = Number((Number(p.valor) - base * (n - 1)).toFixed(2));
          return arr;
        })();
    const vencsNeg: (string | null)[] = Array.isArray(p.parcelas_vencimentos) && p.parcelas_vencimentos.length === n
      ? p.parcelas_vencimentos.map((v) => (v ? String(v).slice(0, 10) : null))
      : [];
    const formasNeg: string[] = Array.isArray(p.parcelas_formas) && p.parcelas_formas.length === n
      ? p.parcelas_formas.map((f) => String(f || ""))
      : [];
    const vencBase = p.data_vencimento ? new Date(String(p.data_vencimento).slice(0, 10) + "T00:00:00") : null;
    for (let i = 0; i < n; i++) {
      let dt: string | null = vencsNeg[i] || null;
      if (!dt && vencBase) {
        const d = new Date(vencBase);
        d.setMonth(d.getMonth() + i);
        dt = d.toISOString().slice(0, 10);
      }
      const metodoLinha = (formasNeg[i] || p.metodo || "").trim();
      const metodoLimpo = metodoLinha.replace(/\s*\d+x(\s*a\s*\d+x)?\s*$/i, "").trim() || metodoLinha;
      const isEntrada = !!p.is_entrada && i === 0;
      const desc = isEntrada
        ? `Entrada${metodoLimpo ? ` — ${metodoLimpo}` : ""}`
        : n === 1
          ? `${metodoLimpo} — à vista`
          : `${metodoLimpo} — parcela ${i + 1}/${n}`;
      linhas.push({
        idx: linhas.length + 1,
        metodo: metodoLimpo,
        data_vencimento: dt,
        valor: Number(det[i] || 0),
        descricao: desc,
        parcela_num: i + 1,
        parcela_total: n,
        is_entrada: isEntrada,
      });
    }
  });
  return linhas;
}

function renderPagamentosTableHtml(ctx: ContratoCtx): string {
  const linhas = expandirPagamentosEmParcelas(ctx.pagamentos);
  const rowsHtml = linhas.length
    ? linhas
        .map(
          (l) => `
        <tr>
          <td style="font-weight:600">${escapeHtml(l.descricao)}</td>
          <td style="text-align:center">${l.data_vencimento ? fmtDate(l.data_vencimento) : "—"}</td>
          <td style="text-align:right;font-weight:600">${fmtBrl(l.valor)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="text-align:center;color:#6B6760;padding:14px">Sem condição de pagamento informada</td></tr>`;
  const totalParcelas = linhas.reduce((s, l) => s + l.valor, 0);
  return `<table class="pags" style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="background:#1B2240;color:#fff;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:left">PARCELA / DESCRIÇÃO</th>
      <th style="background:#1B2240;color:#fff;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:center;width:160px">VENCIMENTO</th>
      <th style="background:#1B2240;color:#fff;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:right;width:160px">VALOR</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr>
      <td colspan="2" style="padding:10px 12px;border-top:1px solid #1A1A1A;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B6760">Total</td>
      <td style="padding:10px 12px;border-top:1px solid #1A1A1A;text-align:right;font-weight:700">${fmtBrl(totalParcelas || ctx.total)}</td>
    </tr></tfoot>
  </table>`;
}

export function applyVariables(text: string, ctx: ContratoCtx): string {
  const prazo = ctx.prazo_entrega ? fmtDate(ctx.prazo_entrega) : "";
  const showDisc = ctx.mostrar_desconto !== false;
  const pagamentosHtml = renderPagamentosTableHtml(ctx);
  const map: Record<string, string> = {
    "{{numero}}": ctx.numero,
    "{{data}}": fmtDate(ctx.emitido_em),
    "{{cliente.nome}}": ctx.cliente?.nome || "",
    "{{cliente.cpf_cnpj}}": ctx.cliente?.cpf_cnpj || "",
    "{{cliente.email}}": ctx.cliente?.email || "",
    "{{cliente.telefone}}": ctx.cliente?.telefone || "",
    "{{cliente.endereco}}": ctx.cliente?.endereco_cobranca || "",
    "{{empresa.nome}}": ctx.empresa.nome,
    "{{empresa.cnpj}}": ctx.empresa.cnpj || "",
    "{{empresa.endereco}}": ctx.empresa.endereco || "",
    "{{empresa.telefone}}": ctx.empresa.telefone || "",
    "{{empresa.razao_social}}": ctx.empresa.razao_social || ctx.empresa.nome,
    "{{empresa.nome_fantasia}}": ctx.empresa.nome_fantasia || ctx.empresa.nome,
    "{{loja.nome}}": ctx.empresa.nome,
    "{{loja.cnpj}}": ctx.empresa.cnpj || "",
    "{{loja.endereco}}": ctx.empresa.endereco || "",
    "{{loja.telefone}}": ctx.empresa.telefone || "",
    "{{loja.razao_social}}": ctx.empresa.razao_social || ctx.empresa.nome,
    "{{loja.nome_fantasia}}": ctx.empresa.nome_fantasia || ctx.empresa.nome,
    "{{vendedor.nome}}": ctx.vendedor?.nome || "",
    "{{vendedor.email}}": ctx.vendedor?.email || "",
    "{{prazo.entrega}}": prazo,
    "{{prazo_entrega}}": prazo,
    // Quando desconto está oculto, subtotal/desconto colapsam para o total final líquido
    "{{subtotal}}": fmtBrl(showDisc ? ctx.subtotal : ctx.total),
    "{{desconto}}": showDisc ? fmtBrl(ctx.desconto_valor) : fmtBrl(0),
    "{{desconto_perc}}": showDisc ? `${(ctx.desconto_perc || 0).toFixed(2)}%` : "0%",
    "{{total}}": fmtBrl(ctx.total),
    "{{valor_total}}": fmtBrl(ctx.total),
    "{{pagamentos}}": pagamentosHtml,
  };
  let out = text;
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  return out;
}

/** True se as cláusulas já contêm a variável {{pagamentos}} (pra evitar duplicar a tabela fixa). */
function clausulasUsamPagamentos(clausulas: string | null | undefined) {
  return !!clausulas && /\{\{\s*pagamentos\s*\}\}/.test(clausulas);
}

/** Remove do início das cláusulas a repetição literal do título e/ou subtítulo do template. */
function stripDuplicatedTitle(clausulas: string, titulo: string, subtitulo: string | null): string {
  if (!clausulas) return clausulas;
  const norm = (s: string) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const alvos = [titulo, subtitulo || ""].map(norm).filter((s) => s.length >= 4);
  if (!alvos.length) return clausulas;
  // Trabalha em blocos do topo (parágrafos, headings, divs) até encontrar algo que não seja título/subtítulo.
  let out = clausulas;
  for (let i = 0; i < 4; i++) {
    const m = out.match(/^\s*(<(p|h1|h2|h3|h4|h5|h6|div|strong|b)[^>]*>([\s\S]*?)<\/\2>|[^<]+?(?=<|$))/i);
    if (!m) break;
    const trecho = m[0];
    const conteudo = norm(trecho);
    if (!conteudo) {
      out = out.slice(trecho.length);
      continue;
    }
    if (alvos.some((alvo) => conteudo === alvo || conteudo.startsWith(alvo))) {
      out = out.slice(trecho.length);
      continue;
    }
    break;
  }
  return out.replace(/^\s+/, "");
}


export function renderContratoHtml(tpl: ContratoTemplate, ctx: ContratoCtx, opts?: {
  assinado?: { nome: string; cpf?: string; data: string; ip?: string };
}): string {
  const showDisc = ctx.mostrar_desconto !== false;
  const itensHtml = ctx.ambientes
    .map(
      (a, idx) => `
      <tr>
        <td style="text-align:center;font-weight:600">${idx + 1}</td>
        <td>
          <div style="font-weight:700">${a.nome.toUpperCase()}</div>
          ${a.descricao ? `<div style="color:#6B6760;font-size:11px;margin-top:2px">- ${a.descricao}</div>` : ""}
        </td>
        ${showDisc ? `<td style="text-align:right;color:#6B6760">${fmtBrl(a.preco_base)}</td>` : ""}
        <td style="text-align:right;color:#B83232;font-weight:700">${fmtBrl(a.preco_final)}</td>
      </tr>`,
    )
    .join("");


  const pagsHtml = ctx.pagamentos.length
    ? ctx.pagamentos
        .map(
          (p) => `
        <tr>
          <td style="font-weight:600">${p.metodo.toUpperCase()} - ${p.parcelas === 1 ? "À VISTA" : `${p.parcelas}X`}</td>
          <td style="text-align:center">${p.data_vencimento ? fmtDate(p.data_vencimento) : "—"}</td>
          <td style="text-align:right;font-weight:600">${fmtBrl(p.valor)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="text-align:center;color:#6B6760;padding:14px">Sem condição de pagamento informada</td></tr>`;

  const assinadoBlock = opts?.assinado
    ? `<div style="margin-top:6px;padding:10px 14px;background:#E8F4ED;border:1px solid #BBDEC8;border-radius:6px;font-size:12px;color:#1F5235">
         ✓ Assinado digitalmente por <b>${opts.assinado.nome}</b>${opts.assinado.cpf ? ` (CPF ${opts.assinado.cpf})` : ""} em ${fmtDate(opts.assinado.data)}${opts.assinado.ip ? ` · IP ${opts.assinado.ip}` : ""}.
       </div>`
    : "";

  const obsHtml = ctx.observacoes_adicionais
    ? `<h2>OBSERVAÇÕES E INFORMAÇÕES ADICIONAIS</h2>
       <div style="white-space:pre-wrap;border:1px solid #E5E5E5;border-radius:6px;padding:12px;background:#FAFAFA;font-size:12px;line-height:1.5">${ctx.observacoes_adicionais}</div>`
    : "";

  const fmtDateTime = (d: string | Date) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // ---- Carimbo eletrônico da loja (sem assinatura desenhada) ----
  const lojaStamp = ctx.loja_assinado_em
    ? `<div class="estamp estamp-loja">
         <div class="estamp-title">✓ Assinado eletronicamente por</div>
         <div class="estamp-name">${escapeHtml(ctx.loja_assinatura_nome || ctx.empresa.nome || "Representante da loja")}</div>
         ${ctx.loja_assinatura_email ? `<div class="estamp-row">${escapeHtml(ctx.loja_assinatura_email)}</div>` : ""}
         ${ctx.loja_assinatura_cargo ? `<div class="estamp-row">${escapeHtml(ctx.loja_assinatura_cargo)}</div>` : ""}
         <div class="estamp-row estamp-when">${fmtDateTime(ctx.loja_assinado_em)}</div>
         <div class="estamp-role">Representante da loja</div>
       </div>`
    : `<div class="estamp estamp-pending"><div class="estamp-title">Assinatura da loja pendente</div></div>`;

  // ---- Carimbo eletrônico do cliente ----
  const clienteStamp = ctx.cliente_assinado_em
    ? `<div class="estamp estamp-cliente">
         <div class="estamp-title">✓ Assinado eletronicamente por</div>
         <div class="estamp-name">${escapeHtml(ctx.cliente?.nome || "Cliente")}</div>
         ${ctx.cliente?.cpf_cnpj ? `<div class="estamp-row">${escapeHtml(ctx.cliente.cpf_cnpj)}</div>` : ""}
         <div class="estamp-row estamp-when">${fmtDateTime(ctx.cliente_assinado_em)}${ctx.cliente_ip ? ` · IP ${escapeHtml(ctx.cliente_ip)}` : ""}</div>
         <div class="estamp-role">Cliente</div>
       </div>`
    : `<div class="estamp estamp-pending"><div class="estamp-title">Assinatura do cliente pendente</div></div>`;

  const assinaturaLojaHtml = `<div class="loja-signature">${lojaStamp}</div>`;
  const assinaturaLojaMeta = `<div class="lb">Representante da loja</div>`;
  const assinaturaClienteHtml = `<div class="loja-signature">${clienteStamp}</div>`;
  const assinaturaClienteMeta = `<div class="lb">CPF ou CNPJ</div>`;

  const validationUrl = ctx.validation_url || "";
  const qrImgHtml = ctx.qr_data_url
    ? `<img src="${ctx.qr_data_url}" alt="QR Code de validação do contrato" style="width:80px;height:80px;display:block" />`
    : `<div class="qr">QR</div>`;
  const qrImgHtmlLarge = ctx.qr_data_url
    ? `<img src="${ctx.qr_data_url}" alt="QR Code de validação do contrato" style="width:96px;height:96px;display:block" />`
    : `<div class="qr">QR</div>`;


  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"/>
<title>Contrato ${ctx.numero}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color:#1A1A1A; font-size:13px; line-height:1.5; margin:0; }
  .page { max-width: 920px; margin: 0 auto; padding: 24px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:2px solid #1A1A1A; }
  .logo-box { width:120px; height:80px; background:#E8E8E8; border-radius:6px; display:flex; align-items:center;justify-content:center; color:#999; font-size:12px; }
  .empresa { text-align:center; }
  .empresa .nm { font-size:20px; font-weight:700; }
  .empresa .ds { font-size:12px; color:#6B6760; }
  .qr { width:80px; height:80px; background:#F0F0F0; display:flex; align-items:center; justify-content:center; font-size:9px; color:#999; }
  .num-bar { text-align:center; padding:18px 0 6px; }
  .num-bar .lbl { font-size:11px; color:#6B6760; letter-spacing:1px; }
  .num-bar .nm { font-size:28px; font-weight:700; color:#2D6BE5; }
  h2 { background:#1B2240; color:#fff; font-size:13px; padding:8px 14px; border-radius:4px 4px 0 0; margin: 22px 0 0; letter-spacing:.5px; }
  table.info, table.itens, table.pags { width:100%; border-collapse:collapse; }
  table.info td { border:1px solid #E5E5E5; padding:8px 12px; font-size:12px; }
  table.info td.lbl { background:#FAFAFA; font-weight:700; color:#1B2240; width:140px; text-transform:uppercase; font-size:11px; letter-spacing:.5px; }
  table.itens th, table.pags th { background:#1B2240; color:#fff; padding:8px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; text-align:left; }
  table.itens td, table.pags td { padding:10px 12px; border-bottom:1px solid #EEE; font-size:12px; vertical-align:top; }
  .totais { border-top:1px solid #1A1A1A; margin-top:0; padding:10px 12px; }
  .totais .row { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; }
  .totais .row.discount { color:#B83232; }
  .totais .grand { border-top:1px solid #1A1A1A; padding-top:8px; margin-top:6px; font-weight:700; font-size:14px; }
  .clausulas { margin-top:18px; font-size:12px; line-height:1.65; }
  .clausulas p { margin: 6px 0; }
  .data-loc { text-align:center; margin-top:30px; font-style:italic; font-size:13px; }
  .sigs { display:flex; justify-content:space-between; gap:60px; margin-top:48px; }
  .sigs .col { flex:1; text-align:center; }
  .loja-signature { min-height:128px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:4px; }
  .loja-signature img { width:320px; max-width:100%; max-height:128px; object-fit:contain; }
  .estamp { width:100%; max-width:320px; margin:0 auto; padding:10px 12px; border:1.5px solid #1B2240; border-radius:6px; background:#F5F8FF; text-align:left; font-size:11px; line-height:1.4; color:#1A1A1A; }
  .estamp-pending { border-style:dashed; background:#FAFAFA; color:#6B6760; text-align:center; }
  .estamp-title { font-size:10px; font-weight:700; color:#1B2240; text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px; }
  .estamp-name { font-size:13px; font-weight:700; color:#1A1A1A; }
  .estamp-row { font-size:11px; color:#1A1A1A; }
  .estamp-when { color:#6B6760; margin-top:2px; }
  .estamp-role { margin-top:6px; padding-top:4px; border-top:1px dashed #C2CCE6; font-size:10px; font-weight:700; color:#1B2240; text-transform:uppercase; letter-spacing:.4px; }
  .sigs .line { border-top:1px solid #1A1A1A; padding-top:6px; }
  .sigs .nm { font-weight:700; font-size:13px; }
  .sigs .lb { color:#6B6760; font-size:11px; }
  .footer { margin-top:30px; font-size:10px; color:#6B6760; text-align:center; border-top:1px solid #EEE; padding-top:8px; }
  .auth-block { margin-top:20px; display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px; background:#FAFAFA; border:1px solid #EEE; border-radius:6px; font-size:11px; color:#6B6760;}
  .auth-block img { width:96px; height:96px; }

</style></head><body>
<div class="page">

  <div class="header">
    <div class="logo-box">Logo</div>
    <div class="empresa">
      <div class="nm">${ctx.empresa.nome}</div>
      ${ctx.empresa.endereco ? `<div class="ds">${ctx.empresa.endereco}</div>` : ""}
      ${ctx.empresa.cnpj ? `<div class="ds">CNPJ: ${ctx.empresa.cnpj}</div>` : ""}
      <div class="ds">Tel: ${ctx.empresa.telefone || "---"}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;color:#6B6760;letter-spacing:1px;margin-bottom:2px">AUTENTICIDADE</div>
      ${qrImgHtml}
    </div>
  </div>


  <div class="num-bar">
    <div class="lbl">CONTRATO Nº</div>
    <div class="nm">${ctx.numero}</div>
  </div>

  <h2>DADOS DO CLIENTE</h2>
  <table class="info">
    <tr>
      <td class="lbl">CONTRATANTE</td><td>${ctx.cliente?.nome || "—"}</td>
      <td class="lbl">CPF/CNPJ</td><td>${ctx.cliente?.cpf_cnpj || "—"}</td>
    </tr>
    <tr>
      <td class="lbl">ENDEREÇO</td><td colspan="3">${ctx.cliente?.endereco_cobranca || "—"}</td>
    </tr>
    <tr>
      <td class="lbl">E-MAIL</td><td>${ctx.cliente?.email || "—"}</td>
      <td class="lbl">TELEFONE</td><td>${ctx.cliente?.telefone || "—"}</td>
    </tr>
  </table>

  <h2>ITENS DO CONTRATO</h2>
  <table class="itens">
    <thead><tr>
      <th style="width:50px;text-align:center">ITEM</th>
      <th>DESCRIÇÃO AMBIENTE/PRODUTO</th>
      ${showDisc ? `<th style="text-align:right;width:130px">VALOR</th>` : ""}
      <th style="text-align:right;width:140px">${showDisc ? "COM DESCONTO" : "VALOR"}</th>
    </tr></thead>
    <tbody>${itensHtml}</tbody>
  </table>

  <div class="totais">
    ${
      showDisc
        ? `<div class="row"><span>Valor total:</span><b>${fmtBrl(ctx.subtotal)}</b></div>
           ${
             ctx.desconto_valor > 0
               ? `<div class="row discount"><span>Total do desconto (${ctx.desconto_perc.toFixed(2)}%):</span><b>-${fmtBrl(ctx.desconto_valor)}</b></div>`
               : ""
           }
           <div class="row grand"><span>Valor com desconto:</span><span>${fmtBrl(ctx.total)}</span></div>`
        : `<div class="row grand"><span>Valor total:</span><span>${fmtBrl(ctx.total)}</span></div>`
    }
    <div style="font-size:10px;color:#6B6760;margin-top:6px">*Após assinatura do caderno técnico</div>
  </div>


  <h2>CONDIÇÃO DE PAGAMENTO</h2>
  <table class="pags">
    <thead><tr>
      <th>PARCELA</th>
      <th style="text-align:center;width:160px">VENCIMENTO</th>
      <th style="text-align:right;width:160px">VALOR</th>
    </tr></thead>
    <tbody>${pagsHtml}</tbody>
  </table>

  <h2>${tpl.titulo}</h2>
  ${tpl.subtitulo ? `<div style="background:#FAFAFA;padding:8px 14px;border:1px solid #EEE;border-top:none;font-size:12px">${tpl.subtitulo}</div>` : ""}
  <div class="clausulas">${applyVariables(tpl.clausulas || "", ctx)}</div>

  ${obsHtml}

  <div class="data-loc">${ctx.cliente?.endereco_cobranca?.split(",").slice(-2, -1)[0]?.trim() || ""}, ${fmtDate(ctx.emitido_em)}.</div>

  <div class="sigs">
    <div class="col">
      ${assinaturaLojaHtml}
      <div class="line">
        <div class="nm">${ctx.empresa.nome}</div>
        ${assinaturaLojaMeta}
      </div>
    </div>
    <div class="col">
      ${assinaturaClienteHtml}
      <div class="line">
        <div class="nm">${ctx.cliente?.nome || ""}</div>
        ${assinaturaClienteMeta}
      </div>
    </div>
  </div>

  ${assinadoBlock}

  <div class="auth-block">
    <div>
      <div style="font-weight:700;color:#1B2240;margin-bottom:2px">AUTENTICIDADE DIGITAL</div>
      <div>Valide este contrato em:</div>
      <div style="color:#2D6BE5;word-break:break-all">${validationUrl || ctx.signing_url}</div>
      <div style="margin-top:4px;color:#6B6760">ID da solicitação: ${escapeHtml(ctx.numero)}</div>
    </div>
    ${qrImgHtmlLarge}
  </div>


  ${tpl.rodape ? `<div class="footer">${tpl.rodape}</div>` : ""}
</div>
</body></html>`;
}
