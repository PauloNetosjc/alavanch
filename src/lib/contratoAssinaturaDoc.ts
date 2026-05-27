import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { renderContratoHtml, type ContratoTemplate } from "@/lib/contratoTemplate";
import { getPublicSignatureUrl, getPublicAppOrigin } from "@/lib/publicLinks";

const safeName = (value: string) => value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

function getValidationUrl(token: string) {
  return `${getPublicAppOrigin()}/validar-contrato/${token}`;
}

async function buildQrDataUrl(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 320 });
  } catch (e) {
    console.error("[contratoPDF] QR generation failed", e);
    return "";
  }
}


const formatDateBr = (value?: string | Date | null) => {
  const fallback = new Date();
  const parsed = value instanceof Date ? value : value ? new Date(value) : fallback;
  const date = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

type DateSource = Record<string, unknown> | null | undefined;

const pickDateValue = (source: DateSource, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" || value instanceof Date) return value;
  }
  return null;
};

const getContratoDate = (contrato: DateSource, solicitacao: DateSource) =>
  pickDateValue(contrato, ["emitido_em", "gerado_em", "created_at", "criado_em"]) ||
  pickDateValue(solicitacao, ["created_at"]) ||
  new Date();

const templateHasDateVariable = (tpl: Partial<ContratoTemplate> | null | undefined) =>
  /\{\{\s*data(?:_contrato)?\s*\}\}/i.test([
    tpl?.titulo,
    tpl?.subtitulo,
    tpl?.clausulas,
    tpl?.observacoes_padrao,
    tpl?.rodape,
  ].filter(Boolean).join("\n"));

const ensureContratoDateHtml = (html: string, dateLabel: string, injectDiscreteDate: boolean) => {
  if (!dateLabel.trim()) throw new Error("Data do contrato vazia antes da geração do PDF.");
  let out = html
    .replace(/\{\{\s*data_contrato\s*\}\}/gi, dateLabel)
    .replace(/\{\{\s*data\s*\}\}/gi, dateLabel);

  if (injectDiscreteDate && !/Data do contrato\s*:/i.test(out)) {
    const dateHtml = `<div class="contract-date-auto" style="text-align:center;margin:4px 0 14px;font-size:11px;color:#6B6760">Data do contrato: ${dateLabel}</div>`;
    if (/<h2\b[^>]*>\s*DADOS DO CLIENTE\s*<\/h2>/i.test(out)) {
      out = out.replace(/(<h2\b[^>]*>\s*DADOS DO CLIENTE\s*<\/h2>)/i, `${dateHtml}\n$1`);
    } else {
      out = out.replace(/(<body[^>]*>)/i, `$1${dateHtml}`);
    }
  }

  if (/\{\{\s*data(?:_contrato)?\s*\}\}/i.test(out)) {
    throw new Error("Variável de data do contrato não foi substituída no HTML.");
  }
  return out;
};


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
  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const M_LEFT = 12, M_RIGHT = 12, M_TOP = 10, M_BOTTOM = 10;
  const CONTENT_W_MM = A4_W_MM - M_LEFT - M_RIGHT;
  const CONTENT_H_MM = A4_H_MM - M_TOP - M_BOTTOM;
  const PX_PER_MM = 3.7795;
  const CONTENT_W_PX = Math.round(CONTENT_W_MM * PX_PER_MM);
  const PAGE_W_PX = CONTENT_W_PX;
  const PAGE_H_PX = Math.round(CONTENT_H_MM * PX_PER_MM);

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
      body { font-size: 13px; line-height: 1.5; }
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
      }
      .__pdf_page {
        width: ${PAGE_W_PX}px !important;
        height: ${PAGE_H_PX}px !important;
        min-height: ${PAGE_H_PX}px !important;
        max-height: ${PAGE_H_PX}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: hidden !important;
        box-shadow: none !important;
      }
      .__pdf_page table { page-break-inside: auto !important; }
      .__pdf_page thead { display: table-header-group !important; }
      .__pdf_page tfoot { display: table-footer-group !important; }
      .pdf-page-image, .anexo-imagem, img[data-pdf-page="true"], img[data-anexo="true"] {
        display: block !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        margin: 0 auto !important;
      }
    </style>
  `;

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
    const bodyScrollWidth = doc.body.scrollWidth;
    const bodyClientWidth = doc.body.clientWidth;
    const htmlScrollWidth = doc.documentElement.scrollWidth;
    const htmlClientWidth = doc.documentElement.clientWidth;
    const wrapperScrollWidth = wrapper.scrollWidth;
    const wrapperClientWidth = wrapper.clientWidth;
    const worstScroll = Math.max(bodyScrollWidth, htmlScrollWidth, wrapperScrollWidth);
    console.log("[contratoPDF] overflow check", {
      bodyScrollWidth, bodyClientWidth, htmlScrollWidth, htmlClientWidth,
      wrapperScrollWidth, wrapperClientWidth,
    });
    console.log("[contratoPDF] scaleFixDisabledForText", true, { worstScroll, contentWidth: CONTENT_W_PX });

    iframe.style.height = `${Math.max(wrapper.scrollHeight, PAGE_H_PX, 1200)}px`;
    await new Promise((r) => setTimeout(r, 100));

    const textLen = (wrapper.innerText || "").trim().length;
    if (textLen < 20 || wrapper.scrollHeight < 50) {
      throw new Error("Conteúdo do contrato não foi renderizado dentro do iframe.");
    }

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const pagesHost = doc.createElement("div");
    pagesHost.style.cssText = "position:absolute;left:0;top:0;width:" + PAGE_W_PX + "px;background:#fff;";
    doc.body.appendChild(pagesHost);

    const measureHost = doc.createElement("div");
    measureHost.style.cssText = [
      "position:absolute",
      "left:0",
      "top:0",
      `width:${PAGE_W_PX}px`,
      "opacity:0",
      "pointer-events:none",
      "z-index:-2",
      "background:#fff",
    ].join(";");
    doc.body.appendChild(measureHost);

    const pages: HTMLDivElement[] = [];
    let current: HTMLDivElement;
    let blocksCount = 0;
    let oversizedBlockCount = 0;

    const makePage = () => {
      const p = doc.createElement("div");
      p.className = "__pdf_page";
      p.dataset.blockCount = "0";
      p.style.cssText = [
        `width:${PAGE_W_PX}px`,
        `height:${PAGE_H_PX}px`,
        `min-height:${PAGE_H_PX}px`,
        `max-height:${PAGE_H_PX}px`,
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

    const flushNewPage = () => {
      current = makePage();
      pages.push(current);
      pagesHost.appendChild(current);
    };

    flushNewPage();

    const pageOverflowed = (page: HTMLElement) => page.scrollHeight > PAGE_H_PX + 2;
    const incrementPageBlocks = () => {
      current.dataset.blockCount = String(Number(current.dataset.blockCount || "0") + 1);
      blocksCount++;
    };

    const measureElementHeight = (el: HTMLElement) => {
      const probe = el.cloneNode(true) as HTMLElement;
      probe.style.maxWidth = "100%";
      probe.style.width = probe.style.width || "100%";
      measureHost.replaceChildren(probe);
      const rect = probe.getBoundingClientRect();
      return Math.ceil(Math.max(probe.scrollHeight, rect.height, 0));
    };

    const isAttachmentImage = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.matches("img.pdf-page-image, img.anexo-imagem, img[data-pdf-page='true'], img[data-anexo='true'], .pdf-page-image, .anexo-imagem, [data-pdf-page='true'], [data-anexo='true']")) return true;
      if (el.closest(".header, .logo-box, .qr, .sigs, .loja-signature, .auth-block")) return false;
      const images = Array.from(el.matches("img") ? [el] : el.querySelectorAll("img"));
      return images.length === 1 && (el.innerText || "").trim().length === 0;
    };

    const makeShellWithChild = (parent: HTMLElement, child: HTMLElement) => {
      const shell = parent.cloneNode(false) as HTMLElement;
      shell.appendChild(child.cloneNode(true));
      return shell;
    };

    const splitTextBlock = (el: HTMLElement): HTMLElement[] => {
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return [];
      const sentences = text.match(/[^.!?;:]+[.!?;:]?|\S+/g) || [text];
      const chunks: string[] = [];
      let currentText = "";
      for (const sentence of sentences) {
        const next = `${currentText}${currentText ? " " : ""}${sentence.trim()}`.trim();
        if (next.length > 650 && currentText) {
          chunks.push(currentText);
          currentText = sentence.trim();
        } else {
          currentText = next;
        }
      }
      if (currentText) chunks.push(currentText);
      return chunks.map((chunk) => {
        const clone = el.cloneNode(false) as HTMLElement;
        clone.textContent = chunk;
        return clone;
      });
    };

    const splitTable = (table: HTMLElement): HTMLElement[] => {
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      if (!rows.length) return [];
      return rows.map((row) => {
        const tableClone = table.cloneNode(false) as HTMLElement;
        Array.from(table.children).forEach((child) => {
          if (child.tagName.toLowerCase() === "tbody") return;
          tableClone.appendChild(child.cloneNode(true));
        });
        const tbody = doc.createElement("tbody");
        tbody.appendChild(row.cloneNode(true));
        tableClone.appendChild(tbody);
        return tableClone;
      });
    };

    const splitBlock = (el: HTMLElement): HTMLElement[] => {
      if (el.tagName.toLowerCase() === "table") {
        const rows = splitTable(el);
        if (rows.length > 1) return rows;
      }

      const children = Array.from(el.children).filter((child) => {
        const tag = child.tagName.toLowerCase();
        return tag !== "script" && tag !== "style";
      }) as HTMLElement[];

      if (children.length > 0) {
        return children.map((child) => makeShellWithChild(el, child));
      }

      return splitTextBlock(el);
    };

    const appendAttachmentPage = (node: HTMLElement) => {
      if (current.children.length > 0) flushNewPage();
      const sourceImg = (node.matches("img") ? node : node.querySelector("img")) as HTMLImageElement | null;
      const clone = (sourceImg ? sourceImg.cloneNode(true) : node.cloneNode(true)) as HTMLElement;
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
      incrementPageBlocks();
      console.log("[contratoPDF] imagem anexa página exclusiva");
      flushNewPage();
    };

    const appendBlock = (node: HTMLElement, depth = 0) => {
      if (isAttachmentImage(node)) {
        appendAttachmentPage(node);
        return;
      }

      const clone = node.cloneNode(true) as HTMLElement;
      current.appendChild(clone);
      if (!pageOverflowed(current)) {
        incrementPageBlocks();
        return;
      }

      current.removeChild(clone);
      if (current.children.length > 0) flushNewPage();

      const isolatedHeight = measureElementHeight(node);
      if (isolatedHeight <= PAGE_H_PX || depth >= 8) {
        if (isolatedHeight > PAGE_H_PX) {
          oversizedBlockCount++;
          console.log("[contratoPDF] oversizedBlockDetected", { height: isolatedHeight, pageHeight: PAGE_H_PX, tag: node.tagName, className: node.className });
          if (node.querySelector("img") && (node.innerText || "").trim().length === 0) {
            appendAttachmentPage(node);
            return;
          }
        }
        const finalClone = node.cloneNode(true) as HTMLElement;
        current.appendChild(finalClone);
        incrementPageBlocks();
        return;
      }

      const pieces = splitBlock(node);
      if (pieces.length <= 1) {
        const textPieces = splitTextBlock(node);
        if (textPieces.length > 1) {
          textPieces.forEach((piece) => appendBlock(piece, depth + 1));
          return;
        }
        oversizedBlockCount++;
        console.log("[contratoPDF] oversizedBlockDetected", { height: isolatedHeight, pageHeight: PAGE_H_PX, tag: node.tagName, className: node.className });
        const finalClone = node.cloneNode(true) as HTMLElement;
        current.appendChild(finalClone);
        incrementPageBlocks();
        return;
      }

      pieces.forEach((piece) => appendBlock(piece, depth + 1));
    };

    const collectTopBlocks = (root: HTMLElement): HTMLElement[] => {
      let nodes = Array.from(root.children).filter((child) => {
        const tag = child.tagName.toLowerCase();
        return tag !== "script" && tag !== "style";
      }) as HTMLElement[];
      while (nodes.length === 1 && nodes[0].children.length > 1 && !isAttachmentImage(nodes[0])) {
        nodes = Array.from(nodes[0].children).filter((child) => {
          const tag = child.tagName.toLowerCase();
          return tag !== "script" && tag !== "style";
        }) as HTMLElement[];
      }
      return nodes.length ? nodes : [root];
    };

    const topBlocks = collectTopBlocks(wrapper);
    topBlocks.forEach((node) => appendBlock(node));

    while (pages.length > 1 && pages[pages.length - 1].children.length === 0) {
      const p = pages.pop()!;
      p.remove();
    }

    const pageBlockCounts = pages.map((p) => Number(p.dataset.blockCount || "0"));
    const pageHeights = pages.map((p) => Math.min(p.scrollHeight, PAGE_H_PX));
    console.log("[contratoPDF] totalPages", pages.length);
    console.log("[contratoPDF] blocksCount", blocksCount);
    console.log("[contratoPDF] pageBlockCounts", pageBlockCounts);
    console.log("[contratoPDF] pageHeights", pageHeights);
    console.log("[contratoPDF] oversizedBlockDetected", oversizedBlockCount);

    await waitForImages(pagesHost);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 100));

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
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
        height: PAGE_H_PX,
      });
      if (!pageCanvas.width || !pageCanvas.height) continue;
      const data = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (i > 0) pdf.addPage();
      pdf.addImage(data, "JPEG", M_LEFT, M_TOP, CONTENT_W_MM, CONTENT_H_MM);
    }

    measureHost.remove();
    pagesHost.remove();

    const blob = pdf.output("blob") as Blob;
    if (!blob || blob.size < 5000) throw new Error("Falha ao gerar PDF do contrato (arquivo muito pequeno).");
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
  // Fallback: lê o participante cliente atualizado para alimentar o carimbo do contrato
  const { data: partsAtuais } = await supabase
    .from("assinatura_participantes" as any)
    .select("tipo,status,nome,documento,assinado_em,ip,email")
    .eq("solicitacao_id", solicitacaoId);
  const partCli = (partsAtuais as any[] | null)?.find((p) => p.tipo === "cliente" && p.status === "assinado") || null;
  const partLoja = (partsAtuais as any[] | null)?.find((p) => p.tipo === "loja" && p.status === "assinado") || null;

  const solicCtx: any = {
    ...(solic as any),
    ...(assinaturaCliente?.url ? { assinatura_cliente_url: assinaturaCliente.url } : {}),
    ...(assinaturaCliente?.assinadoEm ? { cliente_assinado_em: assinaturaCliente.assinadoEm } : {}),
    ...(assinaturaCliente?.ip ? { cliente_ip: assinaturaCliente.ip } : {}),
  };
  // Reforço: garantir que cliente_assinado_em do espelho seja preenchido mesmo sem param,
  // se houver participante cliente já assinado.
  if (!solicCtx.cliente_assinado_em && partCli?.assinado_em) solicCtx.cliente_assinado_em = partCli.assinado_em;
  if (!solicCtx.cliente_nome && partCli?.nome) solicCtx.cliente_nome = partCli.nome;
  if (!solicCtx.cliente_documento && partCli?.documento) solicCtx.cliente_documento = partCli.documento;
  if (!solicCtx.cliente_ip && partCli?.ip) solicCtx.cliente_ip = partCli.ip;
  if (!solicCtx.loja_assinado_em && partLoja?.assinado_em) solicCtx.loja_assinado_em = partLoja.assinado_em;
  if (!solicCtx.loja_assinatura_nome && partLoja?.nome) solicCtx.loja_assinatura_nome = partLoja.nome;
  if (!solicCtx.loja_assinatura_email && partLoja?.email) solicCtx.loja_assinatura_email = partLoja.email;

  const [{ data: contrato }, { data: pedido }] = await Promise.all([
    supabase.from("contratos").select("*").eq("id", solic.contrato_id).maybeSingle(),
    supabase.from("pedidos").select("id,codigo,cliente_id,loja_id,orcamento_id,data_entrega").eq("id", solic.pedido_id).maybeSingle(),
  ]);
  if (!contrato || !pedido) return;

  const [{ data: loja }, { data: configEmpresa }, { data: cliente }, { data: tplLoja }, { data: tplContrato }, { data: orcamento }] = await Promise.all([
    pedido.loja_id ? supabase.from("lojas").select("nome,cnpj,endereco,cidade,uf").eq("id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.loja_id ? supabase.from("configuracoes_empresa").select("nome_empresa,nome_fantasia,cnpj,endereco,telefone,assinar_loja_automaticamente" as any).eq("loja_id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.cliente_id ? supabase.from("clientes").select("*").eq("id", pedido.cliente_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.loja_id ? supabase.from("contratos_template").select("*").eq("loja_id", pedido.loja_id).eq("ativo", true).order("updated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null } as any),
    contrato.template_id ? supabase.from("contratos_template").select("*").eq("id", contrato.template_id).maybeSingle() : Promise.resolve({ data: null } as any),
    (pedido as any).orcamento_id ? supabase.from("orcamentos").select("vendedor_id").eq("id", (pedido as any).orcamento_id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);

  // --- Garante validation_token único no contrato (independente do token de assinatura)
  let validationToken: string | null = (contrato as any).validation_token || null;
  if (!validationToken) {
    const newTok = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
      ? (crypto as any).randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    await supabase.from("contratos").update({ validation_token: newTok } as any).eq("id", contrato.id);
    validationToken = newTok;
  }
  const validationUrl = validationToken ? getValidationUrl(validationToken) : "";
  const qrDataUrl = validationUrl ? await buildQrDataUrl(validationUrl) : "";


  // --- Assinatura automática da loja (se config ativa) ---
  const autoSign = !!(configEmpresa as any)?.assinar_loja_automaticamente;
  if (autoSign && !solicCtx.loja_assinado_em) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const u = sess?.session?.user;
      if (u?.id) {
        const [{ data: prof }, { data: roleRow }] = await Promise.all([
          supabase.from("profiles").select("nome_completo,email").eq("user_id", u.id).maybeSingle(),
          supabase.from("user_roles" as any).select("role").eq("user_id", u.id).limit(1).maybeSingle(),
        ]);
        const nomeRep = (prof as any)?.nome_completo || u.email || "Representante";
        const emailRep = u.email || (prof as any)?.email || "";
        const cargoRep = (roleRow as any)?.role || null;
        const agora = new Date().toISOString();
        let ip: string | null = null;
        try { const r = await fetch("https://api.ipify.org?format=json"); ip = (await r.json())?.ip || null; } catch { /* noop */ }
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

        const { data: ensured } = await supabase.rpc("garantir_participante" as any, { p_solic: solic.id, p_tipo: "loja" });
        const partId = (ensured as any)?.id;
        if (partId) {
          await supabase.from("assinatura_participantes" as any).update({
            nome: nomeRep, email: emailRep, user_id: u.id, cargo: cargoRep,
            status: "assinado", assinado_em: agora, ip, user_agent: ua,
          }).eq("id", partId);
          await supabase.from("assinatura_evidencias").insert({
            solicitacao_id: solic.id, participante_id: partId,
            assinatura_url: null,
            aceite: true,
            aceite_texto: `Assinado eletronicamente pela loja por ${nomeRep}${emailRep ? ` <${emailRep}>` : ""}${cargoRep ? ` (${cargoRep})` : ""}`,
            ip, user_agent: ua,
          } as any);
          await supabase.from("assinatura_eventos").insert({
            solicitacao_id: solic.id, tipo_evento: "loja_assinou",
            status_anterior: solic.status, status_novo: "assinado_loja",
            descricao: `Loja assinou automaticamente (${nomeRep})`,
            user_id: u.id, participante_id: partId,
          } as any);
        }
        await supabase.from("solicitacoes_assinatura").update({
          loja_assinado_em: agora,
          loja_assinatura_nome: nomeRep,
          loja_assinatura_email: emailRep,
          loja_assinatura_cargo: cargoRep,
          loja_ip: ip, loja_user_agent: ua,
        } as any).eq("id", solic.id);

        solicCtx.loja_assinado_em = agora;
        solicCtx.loja_assinatura_nome = nomeRep;
        solicCtx.loja_assinatura_email = emailRep;
        solicCtx.loja_assinatura_cargo = cargoRep;
        console.log("[contratoPDF] loja assinada automaticamente", { nomeRep, emailRep, cargoRep });
      } else {
        console.log("[contratoPDF] auto-sign loja: sem sessão de usuário, ignorando");
      }
    } catch (e) {
      console.error("[contratoPDF] auto-sign loja falhou", e);
    }
  }


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
  const contratoDate = getContratoDate(contrato, solic);
  const contratoDateLabel = formatDateBr(contratoDate);
  const ctx = {
    ...snapshot,
    numero: (snapshot as any)?.numero || contrato.numero || pedido.codigo || solic.id,
    emitido_em: contratoDate,
    data: contratoDateLabel,
    data_contrato: contratoDateLabel,
    empresa: {
      ...(empresaSnapshot || {}),
      nome: lojaNome,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      cnpj: loja?.cnpj || configEmpresa?.cnpj || empresaSnapshot.cnpj || "",
      endereco: loja?.endereco || configEmpresa?.endereco || empresaSnapshot.endereco || "",
      telefone: configEmpresa?.telefone || empresaSnapshot.telefone || "",
    },
    cliente: {
      ...((snapshot?.cliente || cliente || {}) as any),
      nome: (snapshot?.cliente?.nome) || (cliente as any)?.nome || solicCtx.cliente_nome || partCli?.nome || null,
      cpf_cnpj: (snapshot?.cliente?.cpf_cnpj) || (cliente as any)?.cpf_cnpj || solicCtx.cliente_documento || partCli?.documento || null,
    },
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
    loja_assinatura_cargo: solicCtx.loja_assinatura_cargo || (snapshot as any)?.loja_assinatura_cargo || null,
    assinatura_cliente_url: solicCtx.assinatura_cliente_url || "",
    cliente_assinado_em: solicCtx.cliente_assinado_em || "",
    cliente_ip: solicCtx.cliente_ip || "",
    validation_url: validationUrl,
    qr_data_url: qrDataUrl,
  };

  const rawHtml = renderContratoHtml(tpl as ContratoTemplate, ctx as any);
  const html = ensureContratoDateHtml(rawHtml, contratoDateLabel, !templateHasDateVariable(tpl as ContratoTemplate));
  const fileName = `Contrato ${contrato.numero || solic.id}.pdf`;
  const blob = await htmlToPdfBlob(html, fileName);
  // Hash SHA-256 real do PDF final (hex)
  const pdfBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBuffer);
  const documentHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Caminho versionado por timestamp para evitar cache de CDN/navegador no PDF antigo em branco.
  const version = Date.now();
  const path = `${solic.pedido_id}/contrato-${safeName(contrato.numero || solic.id)}-${solic.id}-v${version}.pdf`;
  const { error: upErr } = await supabase.storage.from("contratos-assinatura").upload(path, blob, {
    upsert: true,
    contentType: "application/pdf",
    cacheControl: "0",
  });
  if (upErr) throw upErr;
  await supabase.from("contratos").update({ document_hash: documentHash } as any).eq("id", contrato.id);
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