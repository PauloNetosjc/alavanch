import { supabase } from "@/integrations/supabase/client";
import { renderContratoHtml, type ContratoTemplate } from "@/lib/contratoTemplate";
import { getPublicSignatureUrl } from "@/lib/publicLinks";

const safeName = (value: string) => value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  })));
}

function canvasIsMostlyBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return true;
    // Amostra ~400 pontos espalhados
    const samples = 400;
    let nonWhite = 0;
    for (let i = 0; i < samples; i++) {
      const x = Math.floor((i % 20) * (w / 20));
      const y = Math.floor(Math.floor(i / 20) * (h / 20));
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[0] < 245 || d[1] < 245 || d[2] < 245) nonWhite++;
      if (nonWhite > 8) return false;
    }
    return true;
  } catch {
    return false; // se tainted, não bloqueia
  }
}

async function htmlToPdfBlob(html: string, _filename: string): Promise<Blob> {
  // Renderiza o MESMO HTML usado pelo botão Imprimir dentro de um iframe isolado.
  // Evita conflitos com CSS da SPA (Tailwind, reset, variáveis) que estavam zerando o canvas.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:794px",       // ~A4 em px @ 96dpi
    "height:1123px",     // inicial; será ajustado pelo scrollHeight
    "border:0",
    "opacity:0",         // invisível p/ o usuário mas renderizado pelo layout engine
    "pointer-events:none",
    "z-index:-1",
    "background:#ffffff",
  ].join(";");
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  const cleanup = () => { try { iframe.remove(); } catch { /* noop */ } };

  try {
    // Espera o load do iframe
    await new Promise<void>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("Timeout ao carregar iframe do contrato")), 15000);
      iframe.onload = () => { clearTimeout(to); resolve(); };
      iframe.onerror = () => { clearTimeout(to); reject(new Error("Erro ao carregar iframe do contrato")); };
    });

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win || !doc.body) throw new Error("iframe sem documento acessível");

    // Garante fundo branco no documento interno
    doc.documentElement.style.background = "#ffffff";
    doc.body.style.background = "#ffffff";

    // Aguarda fontes do iframe e da página
    try { await (doc as any).fonts?.ready; } catch { /* noop */ }
    try { await (document as any).fonts?.ready; } catch { /* noop */ }

    // Aguarda imagens do iframe
    await waitForImages(doc.body);

    // 2 RAFs + pequeno delay para garantir layout final
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 250));

    // Ajusta altura do iframe ao scrollHeight real
    const realHeight = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight,
      1123,
    );
    iframe.style.height = `${realHeight}px`;
    await new Promise((r) => setTimeout(r, 100));

    // eslint-disable-next-line no-console
    console.log("[contratoPDF] iframe body", {
      offsetWidth: doc.body.offsetWidth,
      scrollHeight: doc.body.scrollHeight,
      textLen: (doc.body.innerText || "").length,
      htmlSnippet: doc.body.innerHTML.slice(0, 300),
    });

    if ((doc.body.innerText || "").trim().length < 20 || realHeight < 50) {
      throw new Error("Conteúdo do contrato não foi renderizado dentro do iframe.");
    }

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
      windowHeight: realHeight,
      width: 794,
      height: realHeight,
      // @ts-ignore — html2canvas aceita foreignObjectRendering
      foreignObjectRendering: false,
    });

    // eslint-disable-next-line no-console
    console.log("[contratoPDF] canvas", {
      w: canvas.width,
      h: canvas.height,
      dataPrefix: canvas.toDataURL("image/png").slice(0, 80),
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("Canvas do contrato com dimensão zero.");
    }
    if (canvasIsMostlyBlank(canvas)) {
      throw new Error("Canvas do contrato ficou em branco. Verifique estilos do template.");
    }

    // PDF A4 portrait em pt: 595.28 x 841.89
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgW, imgH);
    } else {
      const pageHeightInCanvasPx = Math.floor((pageH * canvas.width) / imgW);
      let renderedPx = 0;
      let first = true;
      while (renderedPx < canvas.height) {
        const sliceH = Math.min(pageHeightInCanvasPx, canvas.height - renderedPx);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const sctx = slice.getContext("2d")!;
        sctx.fillStyle = "#ffffff";
        sctx.fillRect(0, 0, slice.width, slice.height);
        sctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const data = slice.toDataURL("image/jpeg", 0.95);
        const sliceImgH = (sliceH * imgW) / canvas.width;
        if (!first) pdf.addPage();
        pdf.addImage(data, "JPEG", 0, 0, imgW, sliceImgH);
        renderedPx += sliceH;
        first = false;
      }
    }

    const blob = pdf.output("blob") as Blob;
    if (!blob || blob.size < 5000) {
      throw new Error("Falha ao gerar PDF do contrato (arquivo muito pequeno).");
    }
    // eslint-disable-next-line no-console
    console.log("[contratoPDF] blob size", blob.size);
    return blob;
  } finally {
    cleanup();
  }
}


async function ensurePastaDocumentos(pedidoId: string) {
  let { data: pasta } = await supabase
    .from("pedido_pastas")
    .select("id")
    .eq("pedido_id", pedidoId)
    .ilike("nome", "documentos")
    .maybeSingle();

  if (!pasta?.id) {
    const { data: criada } = await supabase
      .from("pedido_pastas")
      .insert({ pedido_id: pedidoId, nome: "Documentos", ordem: 99 })
      .select("id")
      .single();
    pasta = criada;
  }

  return pasta?.id || null;
}

/**
 * Gera o HTML do contrato e registra o documento na Central de Documentos do pedido.
 * NÃO assina automaticamente pela loja — a assinatura da loja é feita manualmente
 * pelo usuário logado via "Assinar pela loja" na Central de Documentos.
 */
export async function prepararContratoParaAssinatura(
  solicitacaoId: string,
  assinanteLoja?: { nome?: string | null; email?: string | null } | null,
  assinaturaCliente?: { url?: string | null; assinadoEm?: string | null; ip?: string | null } | null,
) {
  const { data: solic } = await supabase
    .from("solicitacoes_assinatura")
    .select("*")
    .eq("id", solicitacaoId)
    .maybeSingle();
  if (!solic?.pedido_id || !solic?.contrato_id) return;
  const solicCtx: any = {
    ...(solic as any),
    ...(assinaturaCliente?.url ? { assinatura_cliente_url: assinaturaCliente.url } : {}),
    ...(assinaturaCliente?.assinadoEm ? { cliente_assinado_em: assinaturaCliente.assinadoEm } : {}),
    ...(assinaturaCliente?.ip ? { cliente_ip: assinaturaCliente.ip } : {}),
  };

  const [{ data: contrato }, { data: pedido }] = await Promise.all([
    supabase.from("contratos").select("*").eq("id", solic.contrato_id).maybeSingle(),
    supabase.from("pedidos").select("id,codigo,cliente_id,loja_id,orcamento_id,data_entrega").eq("id", solic.pedido_id).maybeSingle(),
  ]);
  if (!contrato || !pedido) return;

  const [{ data: loja }, { data: configEmpresa }, { data: cliente }, { data: tplLoja }, { data: tplContrato }, { data: orcamento }] = await Promise.all([
    pedido.loja_id ? supabase.from("lojas").select("nome,cnpj,endereco,cidade,uf").eq("id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.loja_id ? supabase.from("configuracoes_empresa").select("nome_empresa,nome_fantasia,cnpj,endereco,telefone").eq("loja_id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.cliente_id ? supabase.from("clientes").select("*").eq("id", pedido.cliente_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.loja_id ? supabase.from("contratos_template").select("*").eq("loja_id", pedido.loja_id).eq("ativo", true).order("updated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null } as any),
    contrato.template_id ? supabase.from("contratos_template").select("*").eq("id", contrato.template_id).maybeSingle() : Promise.resolve({ data: null } as any),
    (pedido as any).orcamento_id ? supabase.from("orcamentos").select("vendedor_id").eq("id", (pedido as any).orcamento_id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  const tpl = tplLoja || tplContrato;
  if (!tpl) {
    throw new Error("Nenhum template de contrato ativo encontrado para esta loja. Configure um template em Administração → Contratos antes de gerar o contrato.");
  }

  let vendedor: { nome?: string | null; email?: string | null } | null = null;
  if ((orcamento as any)?.vendedor_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("nome_completo,email")
      .eq("id", (orcamento as any).vendedor_id)
      .maybeSingle();
    if (prof) vendedor = { nome: (prof as any).nome_completo, email: (prof as any).email };
  }

  const snapshot = ((contrato.conteudo_snapshot as any) || {});
  const empresaSnapshot = snapshot.empresa || {};
  const razaoSocial = configEmpresa?.nome_empresa || loja?.nome || empresaSnapshot.razao_social || empresaSnapshot.nome || "Loja";
  const nomeFantasia = configEmpresa?.nome_fantasia || loja?.nome || empresaSnapshot.nome_fantasia || empresaSnapshot.nome || razaoSocial;
  const lojaNome = nomeFantasia || razaoSocial;

  const pastaId = await ensurePastaDocumentos(solic.pedido_id);

  if (solic.pedido_documento_id) {
    await supabase
      .from("pedido_documentos")
      .update({ pasta_id: pastaId, enviado_para_assinatura: true } as any)
      .eq("id", solic.pedido_documento_id);
  }

  if (tpl.id && tpl.id !== contrato.template_id) {
    await supabase.from("contratos").update({ template_id: tpl.id }).eq("id", contrato.id);
  }
  const ctx = {
    ...snapshot,
    empresa: {
      ...(empresaSnapshot || {}),
      nome: lojaNome,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      cnpj: loja?.cnpj || configEmpresa?.cnpj || empresaSnapshot.cnpj || "",
      endereco: loja?.endereco || configEmpresa?.endereco || empresaSnapshot.endereco || "",
      telefone: configEmpresa?.telefone || empresaSnapshot.telefone || "",
    },
    cliente: (snapshot?.cliente || cliente || null),
    vendedor: vendedor || (snapshot as any)?.vendedor || null,
    prazo_entrega: (pedido as any)?.data_entrega || (snapshot as any)?.prazo_entrega || null,
    signing_url: await (async () => {
      await supabase.rpc("ensure_participants_for_solicitation" as any, { p_solic: solic.id });
      const { data: pc } = await supabase
        .from("assinatura_participantes" as any)
        .select("token")
        .eq("solicitacao_id", solic.id)
        .eq("tipo", "cliente")
        .maybeSingle();
      const tk = (pc as any)?.token;
      return tk ? getPublicSignatureUrl(tk) : "";
    })(),
    assinatura_loja_url: solicCtx.assinatura_loja_url || "",
    loja_assinado_em: solicCtx.loja_assinado_em || "",
    loja_assinatura_nome: assinanteLoja?.nome || solicCtx.loja_assinatura_nome || (snapshot as any)?.loja_assinatura_nome || null,
    loja_assinatura_email: assinanteLoja?.email || solicCtx.loja_assinatura_email || (snapshot as any)?.loja_assinatura_email || null,
    assinatura_cliente_url: solicCtx.assinatura_cliente_url || "",
    cliente_assinado_em: solicCtx.cliente_assinado_em || "",
    cliente_ip: solicCtx.cliente_ip || "",
  };
  const html = renderContratoHtml(tpl as ContratoTemplate, ctx as any);
  const fileName = `Contrato ${contrato.numero || solic.id}.pdf`;
  const blob = await htmlToPdfBlob(html, fileName);
  // Caminho versionado por timestamp para evitar cache de CDN/navegador no PDF antigo em branco.
  const version = Date.now();
  const path = `${solic.pedido_id}/contrato-${safeName(contrato.numero || solic.id)}-${solic.id}-v${version}.pdf`;
  const { error: upErr } = await supabase.storage.from("contratos-assinatura").upload(path, blob, {
    upsert: true,
    contentType: "application/pdf",
    cacheControl: "0",
  });
  if (upErr) throw upErr;
  const publicUrl = supabase.storage.from("contratos-assinatura").getPublicUrl(path).data.publicUrl;
  const docPayload = {
      pedido_id: solic.pedido_id,
      pasta_id: pastaId,
      nome: fileName,
      storage_path: path,
      bucket_name: "contratos-assinatura",
      tamanho: blob.size,
      mime_type: "application/pdf",
      enviado_para_assinatura: true,
      solicitacao_id: solic.id,
    } as any;
  let docId = solic.pedido_documento_id || null;
  if (docId) {
    await supabase.from("pedido_documentos").update(docPayload).eq("id", docId);
  } else {
    const { data: doc } = await supabase.from("pedido_documentos").insert(docPayload).select("id").single();
    docId = doc?.id || null;
  }

  await supabase
    .from("solicitacoes_assinatura")
    .update({
      pedido_documento_id: docId,
      file_name: fileName,
      file_url: publicUrl,
      storage_path: path,
    } as any)
    .eq("id", solicitacaoId);
}