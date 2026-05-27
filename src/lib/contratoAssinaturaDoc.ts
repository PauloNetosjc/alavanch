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
  // A4 com margens — mesma área útil do window.print()
  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const M_LEFT = 12, M_RIGHT = 12, M_TOP = 10, M_BOTTOM = 10;
  const CONTENT_W_MM = A4_W_MM - M_LEFT - M_RIGHT;       // 186mm
  const CONTENT_H_MM = A4_H_MM - M_TOP - M_BOTTOM;       // 277mm
  // 96 DPI: 1mm ≈ 3.78px → 186mm ≈ 703px de largura útil
  const CONTENT_W_PX = Math.round(CONTENT_W_MM * 3.7795);

  // CSS agressivo de quebra/wrap injetado no <head> do iframe — força tudo a caber em CONTENT_W_PX.
  const safetyCss = `
    <style id="pdf-overflow-fix">
      *, *::before, *::after { box-sizing: border-box !important; max-width: 100% !important; }
      html, body {
        width: ${CONTENT_W_PX}px !important;
        max-width: ${CONTENT_W_PX}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #111111 !important;
        overflow-x: hidden !important;
      }
      p, div, span, section, article, li, td, th, h1, h2, h3, h4, h5, h6, label, dd, dt, blockquote {
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-wrap: break-word !important;
        word-break: normal !important;
        hyphens: auto !important;
        max-width: 100% !important;
      }
      table { width: 100% !important; max-width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
      td, th { max-width: 100% !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
      img, svg, canvas, video { max-width: 100% !important; height: auto !important; }
      pre, code { white-space: pre-wrap !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
      .page, .a4, .contract-page, .contrato-page, .sheet, .contract-container, .contrato-container {
        width: 100% !important; max-width: ${CONTENT_W_PX}px !important;
        margin: 0 auto !important; padding: 0 !important;
        box-shadow: none !important; overflow-x: hidden !important;
      }
      .__pdf_wrapper {
        width: ${CONTENT_W_PX}px;
        max-width: ${CONTENT_W_PX}px;
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111111;
        overflow-x: hidden;
        overflow-wrap: anywhere;
        word-break: normal;
        white-space: normal;
        transform-origin: top left;
      }
      /* page-break control */
      p, div, section, article, table, tr, li, h1, h2, h3, h4, h5, h6,
      .no-break, .clausula, .contract-section, .contrato-section, .section-title, .payment-table, .signature-block {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      table { page-break-inside: auto !important; }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      h1, h2, h3, h4 { break-after: avoid !important; page-break-after: avoid !important; }
      .pdf-page-image, .anexo-imagem, img[data-pdf-page="true"], img[data-anexo="true"] {
        display: block !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        margin: 0 auto !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    </style>
  `;
  // Move o conteúdo do <body> original para dentro de um wrapper de largura útil
  // preservando o restante (head, styles do template, etc.).
  let htmlForPdf = html;
  if (/<body[^>]*>/i.test(htmlForPdf)) {
    htmlForPdf = htmlForPdf.replace(/<body([^>]*)>([\s\S]*?)<\/body>/i,
      (_m, attrs, inner) => `<body${attrs}><div class="__pdf_wrapper">${inner}</div></body>`);
    htmlForPdf = htmlForPdf.replace(/<\/head>/i, `${safetyCss}</head>`);
  } else {
    htmlForPdf = `<!doctype html><html><head><meta charset="utf-8">${safetyCss}</head><body><div class="__pdf_wrapper">${html}</div></body></html>`;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${CONTENT_W_PX}px`,
    "height:1200px",
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
    "background:#ffffff",
  ].join(";");
  iframe.srcdoc = htmlForPdf;
  document.body.appendChild(iframe);

  const cleanup = () => { try { iframe.remove(); } catch { /* noop */ } };

  try {
    await new Promise<void>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("Timeout ao carregar iframe do contrato")), 15000);
      iframe.onload = () => { clearTimeout(to); resolve(); };
      iframe.onerror = () => { clearTimeout(to); reject(new Error("Erro ao carregar iframe do contrato")); };
    });

    const doc = iframe.contentDocument;
    if (!doc || !doc.body) throw new Error("iframe sem documento acessível");

    doc.documentElement.style.background = "#ffffff";
    doc.body.style.background = "#ffffff";

    try { await (doc as any).fonts?.ready; } catch { /* noop */ }
    try { await (document as any).fonts?.ready; } catch { /* noop */ }
    await waitForImages(doc.body);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 250));

    const wrapper = (doc.querySelector(".__pdf_wrapper") as HTMLElement) || doc.body;

    // Mede overflow horizontal ANTES do html2canvas
    const bodyScrollWidth = doc.body.scrollWidth;
    const bodyClientWidth = doc.body.clientWidth;
    const htmlScrollWidth = doc.documentElement.scrollWidth;
    const htmlClientWidth = doc.documentElement.clientWidth;
    const wrapperScrollWidth = wrapper.scrollWidth;
    const wrapperClientWidth = wrapper.clientWidth;
    // eslint-disable-next-line no-console
    console.log("[contratoPDF] overflow check", {
      bodyScrollWidth, bodyClientWidth, htmlScrollWidth, htmlClientWidth,
      wrapperScrollWidth, wrapperClientWidth,
    });

    // Se algum elemento ainda estoura, aplica scale para encolher o conteúdo até caber.
    const worstScroll = Math.max(bodyScrollWidth, htmlScrollWidth, wrapperScrollWidth);
    let scaleFix = 1;
    if (worstScroll > CONTENT_W_PX + 1) {
      scaleFix = CONTENT_W_PX / worstScroll;
      wrapper.style.transform = `scale(${scaleFix})`;
      wrapper.style.transformOrigin = "top left";
      wrapper.style.width = `${Math.ceil(worstScroll)}px`;
      // eslint-disable-next-line no-console
      console.log("[contratoPDF] scaleFix", scaleFix);
      await new Promise((r) => setTimeout(r, 80));
    }

    const realHeight = Math.max(
      Math.ceil((wrapper.scrollHeight || 0) * scaleFix),
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight,
      200,
    );
    iframe.style.height = `${realHeight}px`;
    await new Promise((r) => setTimeout(r, 100));

    // eslint-disable-next-line no-console
    console.log("[contratoPDF] wrapper", {
      clientWidth: wrapper.clientWidth,
      scrollWidth: wrapper.scrollWidth,
      scrollHeight: wrapper.scrollHeight,
      realHeight,
      textLen: (wrapper.innerText || "").length,
      hOverflow: wrapper.scrollWidth > wrapper.clientWidth,
      scaleFix,
    });

    if ((wrapper.innerText || "").trim().length < 20 || realHeight < 50) {
      throw new Error("Conteúdo do contrato não foi renderizado dentro do iframe.");
    }

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    // ============== PAGINAÇÃO POR BLOCOS ==============
    // Em vez de fatiar um canvas gigante, distribuímos os blocos de topo do wrapper em
    // páginas A4 reais dentro do iframe, depois renderizamos uma a uma. Imagens anexas
    // (.pdf-page-image, .anexo-imagem, [data-pdf-page], [data-anexo]) ganham página própria.
    const PAGE_W_PX = CONTENT_W_PX;
    const PAGE_H_PX = Math.round(CONTENT_H_MM * 3.7795); // ~1047px para 277mm

    const isAttachmentImage = (el: Element): el is HTMLElement =>
      el instanceof HTMLElement &&
      (el.matches?.("img.pdf-page-image, img.anexo-imagem, img[data-pdf-page='true'], img[data-anexo='true'], .pdf-page-image, .anexo-imagem, [data-pdf-page='true'], [data-anexo='true']") ?? false);

    // Pega blocos de topo. Se houver só 1 filho que é container, desce um nível.
    let topNodes: HTMLElement[] = Array.from(wrapper.children) as HTMLElement[];
    while (topNodes.length === 1 && topNodes[0].children.length > 1) {
      topNodes = Array.from(topNodes[0].children) as HTMLElement[];
    }
    if (topNodes.length === 0) topNodes = [wrapper];

    // Estilo base de cada página construída em memória dentro do iframe
    const makePage = (): HTMLDivElement => {
      const p = doc.createElement("div");
      p.className = "__pdf_page";
      p.style.cssText = [
        `width:${PAGE_W_PX}px`,
        `min-height:${PAGE_H_PX}px`,
        "background:#ffffff",
        "color:#111111",
        "padding:0",
        "margin:0",
        "box-sizing:border-box",
        "overflow:hidden",
        "position:relative",
      ].join(";");
      return p;
    };

    // Container offscreen no iframe para montar páginas
    const pagesHost = doc.createElement("div");
    pagesHost.style.cssText = "position:absolute;left:0;top:0;background:#fff;";
    doc.body.appendChild(pagesHost);

    const pages: HTMLDivElement[] = [];
    const attachmentPages: { node: HTMLElement; isolated: true }[] = [];
    let current = makePage();
    pages.push(current);
    pagesHost.appendChild(current);
    let blocksMoved = 0;

    const flushNewPage = () => {
      current = makePage();
      pages.push(current);
      pagesHost.appendChild(current);
    };

    for (const node of topNodes) {
      // Imagem anexa: página exclusiva
      if (isAttachmentImage(node)) {
        // fecha página atual se já tem conteúdo
        if (current.children.length > 0) flushNewPage();
        const clone = node.cloneNode(true) as HTMLElement;
        clone.style.maxWidth = "100%";
        clone.style.maxHeight = `${PAGE_H_PX}px`;
        clone.style.width = "auto";
        clone.style.height = "auto";
        clone.style.objectFit = "contain";
        clone.style.display = "block";
        clone.style.margin = "0 auto";
        const wrap = doc.createElement("div");
        wrap.style.cssText = `width:${PAGE_W_PX}px;height:${PAGE_H_PX}px;display:flex;align-items:center;justify-content:center;background:#fff;`;
        wrap.appendChild(clone);
        current.appendChild(wrap);
        (current as any).__attachment = true;
        // eslint-disable-next-line no-console
        console.log("[contratoPDF] imagem anexa página exclusiva");
        flushNewPage();
        continue;
      }

      // Bloco de texto/tabela normal
      const clone = node.cloneNode(true) as HTMLElement;
      current.appendChild(clone);
      // Se estourou a altura da página e há outros blocos antes, move para nova página
      if (current.scrollHeight > PAGE_H_PX && current.children.length > 1) {
        current.removeChild(clone);
        flushNewPage();
        current.appendChild(clone);
        blocksMoved++;
        // eslint-disable-next-line no-console
        console.log("[contratoPDF] block moved to next page");
        // Se o bloco isolado ainda for maior que uma página, deixa estourar (será fatiado dentro do bloco).
      }
    }

    // Remove páginas vazias do fim
    while (pages.length > 1 && pages[pages.length - 1].children.length === 0) {
      const p = pages.pop()!;
      p.remove();
    }

    // eslint-disable-next-line no-console
    console.log("[contratoPDF] pages generated", pages.length, "blocksMoved", blocksMoved);
    // eslint-disable-next-line no-console
    console.log("[contratoPDF] page heights", pages.map((p) => p.scrollHeight));

    // Aguarda layout
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 100));

    // PDF A4 em mm com margens
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    // eslint-disable-next-line no-console
    console.log("[contratoPDF] pdf image placement", { marginX: M_LEFT, marginY: M_TOP, contentWidth: CONTENT_W_MM, contentHeight: CONTENT_H_MM });

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      const pageCanvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: PAGE_W_PX,
        width: PAGE_W_PX,
        height: Math.max(pageEl.scrollHeight, PAGE_H_PX),
      });
      if (!pageCanvas.width || !pageCanvas.height) continue;

      const pImgW_mm = CONTENT_W_MM;
      let pImgH_mm = (pageCanvas.height * pImgW_mm) / pageCanvas.width;
      // Se uma página individual ficou maior que CONTENT_H_MM (bloco gigante), reduz proporcional
      if (pImgH_mm > CONTENT_H_MM) {
        pImgH_mm = CONTENT_H_MM;
      }
      const data = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (i > 0) pdf.addPage();
      pdf.addImage(data, "JPEG", M_LEFT, M_TOP, pImgW_mm, pImgH_mm);
    }

    pagesHost.remove();


    const blob = pdf.output("blob") as Blob;
    if (!blob || blob.size < 5000) throw new Error("Falha ao gerar PDF do contrato (arquivo muito pequeno).");
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