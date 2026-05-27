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
  empresa: { nome: string; cnpj?: string | null; endereco?: string | null; telefone?: string | null };
  cliente: ClienteRow | null;
  ambientes: { nome: string; descricao: string | null; preco_base: number; preco_final: number }[];
  subtotal: number;
  desconto_perc: number;
  desconto_valor: number;
  total: number;
  pagamentos: { metodo: string; parcelas: number; valor: number; data_vencimento: string | null }[];
  observacoes_adicionais: string;
  signing_url: string;
  assinatura_loja_url?: string | null;
  loja_assinado_em?: string | null;
  loja_assinatura_nome?: string | null;
};

export const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const escapeHtml = (v: string) =>
  String(v).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] as string));

export function applyVariables(text: string, ctx: ContratoCtx): string {
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
    "{{total}}": fmtBrl(ctx.total),
  };
  let out = text;
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  return out;
}

export function renderContratoHtml(tpl: ContratoTemplate, ctx: ContratoCtx, opts?: {
  assinado?: { nome: string; cpf?: string; data: string; ip?: string };
}): string {
  const itensHtml = ctx.ambientes
    .map(
      (a, idx) => `
      <tr>
        <td style="text-align:center;font-weight:600">${idx + 1}</td>
        <td>
          <div style="font-weight:700">${a.nome.toUpperCase()}</div>
          ${a.descricao ? `<div style="color:#6B6760;font-size:11px;margin-top:2px">- ${a.descricao}</div>` : ""}
        </td>
        <td style="text-align:right;color:#6B6760">${fmtBrl(a.preco_base)}</td>
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

  const assinaturaLojaHtml = ctx.assinatura_loja_url
    ? `<div class="loja-signature"><img src="${escapeHtml(ctx.assinatura_loja_url)}" alt="Assinatura e carimbo da loja" /></div>`
    : `<div class="loja-signature empty"></div>`;
  const assinaturaLojaMeta = ctx.loja_assinado_em
    ? `<div class="lb">Pré-assinado digitalmente pela loja em ${fmtDate(ctx.loja_assinado_em)}</div>`
    : `<div class="lb">Assinatura / Responsável</div>`;

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
  .loja-signature { height:104px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:4px; }
  .loja-signature img { max-width:280px; max-height:104px; object-fit:contain; }
  .loja-signature.empty { height:0; }
  .sigs .line { border-top:1px solid #1A1A1A; padding-top:6px; }
  .sigs .nm { font-weight:700; font-size:13px; }
  .sigs .lb { color:#6B6760; font-size:11px; }
  .footer { margin-top:30px; font-size:10px; color:#6B6760; text-align:center; border-top:1px solid #EEE; padding-top:8px; }
  .auth-block { margin-top:20px; display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px; background:#FAFAFA; border:1px solid #EEE; border-radius:6px; font-size:11px; color:#6B6760;}
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
      <div class="qr">QR</div>
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
      <th style="text-align:right;width:130px">VALOR</th>
      <th style="text-align:right;width:140px">COM DESCONTO</th>
    </tr></thead>
    <tbody>${itensHtml}</tbody>
  </table>

  <div class="totais">
    <div class="row"><span>Valor total:</span><b>${fmtBrl(ctx.subtotal)}</b></div>
    ${
      ctx.desconto_valor > 0
        ? `<div class="row discount"><span>Total do desconto (${ctx.desconto_perc.toFixed(2)}%):</span><b>-${fmtBrl(ctx.desconto_valor)}</b></div>`
        : ""
    }
    <div class="row grand"><span>Valor com desconto:</span><span>${fmtBrl(ctx.total)}</span></div>
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
      <div class="line">
        <div class="nm">${ctx.cliente?.nome || ""}</div>
        <div class="lb">Assinatura / CPF ou CNPJ</div>
      </div>
    </div>
  </div>

  ${assinadoBlock}

  <div class="auth-block">
    <div>
      <div style="font-weight:700;color:#1B2240;margin-bottom:2px">AUTENTICIDADE DIGITAL</div>
      <div>Para assinar e validar este contrato acesse:</div>
      <div style="color:#2D6BE5;word-break:break-all">${ctx.signing_url}</div>
    </div>
    <div class="qr">QR</div>
  </div>

  ${tpl.rodape ? `<div class="footer">${tpl.rodape}</div>` : ""}
</div>
</body></html>`;
}
