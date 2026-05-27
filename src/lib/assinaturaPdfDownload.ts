import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "—");

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] as string));

const safeFileName = (value: string) =>
  value.replace(/\.(html?|txt|pdf)$/i, "").replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim() || "documento-assinado";

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }));
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function baixarUrlComoArquivo(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) {
    window.open(url, "_blank");
    return;
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

async function gerarPdfServidor(solicitacaoId: string, filename: string) {
  const { data, error } = await supabase.functions.invoke("assinatura-pdf-final", {
    body: { solicitacao_id: solicitacaoId },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Falha ao gerar PDF final.");
  await baixarUrlComoArquivo(data.url, filename);
}

function extractHtmlBody(html: string) {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map((s) => s[1]).join("\n");
  return { body, styles };
}

function evidenceImage(label: string, src?: string | null) {
  if (!src) return "";
  return `
    <div class="evidence-image">
      <div class="evidence-label">${escapeHtml(label)}</div>
      <img crossorigin="anonymous" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" />
    </div>`;
}

export async function baixarPdfFinalAssinatura(solicitacaoId: string, nomeArquivo?: string) {
  const toastId = toast.loading("Gerando PDF completo…");
  try {
    const { data: solic, error: solicError } = await supabase
      .from("solicitacoes_assinatura")
      .select("*, tipos_documento(nome,slug,requer_assinatura_loja), pedidos(codigo)")
      .eq("id", solicitacaoId)
      .maybeSingle();
    if (solicError || !solic) throw solicError || new Error("Solicitação não encontrada.");

    const [{ data: doc }, { data: evidencias }, { data: participantes }, { data: eventos }] = await Promise.all([
      (solic as any).pedido_documento_id
        ? supabase.from("pedido_documentos").select("id,nome,storage_path,bucket_name,mime_type").eq("id", (solic as any).pedido_documento_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("assinatura_evidencias").select("*").eq("solicitacao_id", solicitacaoId).order("created_at"),
      supabase.from("assinatura_participantes").select("*").eq("solicitacao_id", solicitacaoId).order("created_at"),
      supabase.from("assinatura_eventos").select("*").eq("solicitacao_id", solicitacaoId).order("created_at"),
    ]);

    const filename = `${safeFileName(nomeArquivo || (solic as any).file_name || doc?.nome || "contrato-assinado")}.pdf`;
    const bucket = doc?.bucket_name || ((solic as any).contrato_id ? "contratos-assinatura" : "pedido-docs");
    const path = doc?.storage_path || (solic as any).storage_path;
    const { data: originalBlob } = path
      ? await supabase.storage.from(bucket).download(path)
      : ({ data: null } as any);

    const originalType = `${originalBlob?.type || doc?.mime_type || ""}`.toLowerCase();
    const originalPath = `${path || ""}`.toLowerCase();
    const isPdf = originalType.includes("pdf") || originalPath.endsWith(".pdf");
    if (isPdf) {
      await gerarPdfServidor(solicitacaoId, filename);
      toast.success("PDF completo baixado", { id: toastId });
      return;
    }

    let documentoHtml = "";
    if (originalBlob && (originalType.includes("html") || originalType.includes("text") || /\.html?$|\.txt$/i.test(originalPath))) {
      const { body, styles } = extractHtmlBody(await originalBlob.text());
      documentoHtml = `<section class="original-doc">${styles ? `<style>${styles}</style>` : ""}${body}</section>`;
    } else if (originalBlob && originalType.startsWith("image/")) {
      documentoHtml = `<section class="original-doc image-doc"><img crossorigin="anonymous" src="${await blobToDataUrl(originalBlob)}" alt="Documento enviado" /></section>`;
    } else {
      documentoHtml = `<section class="original-doc missing-doc"><h1>Documento enviado</h1><p>Arquivo original registrado: ${escapeHtml((solic as any).file_name || doc?.nome || path || "—")}</p></section>`;
    }

    const participantesHtml = (participantes || []).map((p: any) => `
      <tr>
        <td>${escapeHtml(p.tipo === "cliente" ? "Cliente" : "Loja")}</td>
        <td>${escapeHtml(p.nome || "—")}</td>
        <td>${escapeHtml(p.documento || "—")}</td>
        <td>${escapeHtml(p.status || "—")}</td>
        <td>${escapeHtml(fmt(p.assinado_em))}</td>
      </tr>`).join("");

    const eventosHtml = (eventos || []).map((ev: any) => `
      <li><b>${escapeHtml(fmt(ev.created_at))}</b> — ${escapeHtml(ev.tipo_evento)} ${ev.descricao ? `· ${escapeHtml(ev.descricao)}` : ""}</li>`).join("");

    const evidenciasHtml = (evidencias || []).map((ev: any, idx: number) => `
      <section class="pdf-page evidence-page">
        <h1>Evidências da assinatura ${idx + 1}</h1>
        <p class="muted">Registrado em ${escapeHtml(fmt(ev.assinado_em || ev.created_at))}</p>
        <p><b>Aceite:</b> ${ev.aceite ? "Sim" : "Não"}${ev.aceite_texto ? ` — ${escapeHtml(ev.aceite_texto)}` : ""}</p>
        <div class="evidence-grid">
          ${evidenceImage("Documento enviado pelo assinante", ev.documento_foto_url)}
          ${evidenceImage("Selfie segurando documento", ev.selfie_url)}
          ${evidenceImage("Assinatura", ev.assinatura_url)}
        </div>
        <p class="muted">IP: ${escapeHtml(ev.ip || (solic as any).cliente_ip || "—")} · Navegador: ${escapeHtml(ev.user_agent || "—")}</p>
      </section>`).join("");

    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#111;z-index:-1;";
    container.innerHTML = `
      <style>
        .pdf-page { width: 794px; min-height: 1122px; box-sizing: border-box; padding: 44px; background: #fff; color: #111; font-family: Arial, sans-serif; page-break-before: always; }
        .original-doc { width: 794px; box-sizing: border-box; background: #fff; page-break-after: always; }
        .original-doc.image-doc { min-height: 1122px; padding: 44px; display: flex; align-items: flex-start; justify-content: center; }
        .original-doc.image-doc img { max-width: 706px; max-height: 1034px; object-fit: contain; }
        .missing-doc { min-height: 1122px; padding: 44px; font-family: Arial, sans-serif; }
        .pdf-page h1 { margin: 0 0 12px; font-size: 22px; color: #123524; }
        .pdf-page h2 { margin: 22px 0 8px; font-size: 15px; color: #123524; background: transparent; padding: 0; }
        .muted { color: #666; font-size: 11px; }
        .audit-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        .audit-table th, .audit-table td { border: 1px solid #ddd; padding: 7px; text-align: left; vertical-align: top; }
        .audit-table th { background: #f3f6f1; }
        .timeline { padding-left: 18px; font-size: 11px; line-height: 1.55; }
        .evidence-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin: 18px 0; }
        .evidence-image { border: 1px solid #ddd; padding: 10px; page-break-inside: avoid; }
        .evidence-label { font-weight: 700; font-size: 12px; margin-bottom: 8px; color: #123524; }
        .evidence-image img { max-width: 100%; max-height: 640px; object-fit: contain; display: block; margin: 0 auto; background: #fff; }
      </style>
      ${documentoHtml}
      <section class="pdf-page">
        <h1>Certificado de assinatura digital</h1>
        <p><b>Pedido:</b> ${escapeHtml((solic as any).pedidos?.codigo || (solic as any).pedido_id)}</p>
        <p><b>Documento:</b> ${escapeHtml((solic as any).file_name || (solic as any).tipos_documento?.nome || doc?.nome || "Documento")}</p>
        <p><b>Status:</b> ${escapeHtml((solic as any).status)}</p>
        <p><b>Cliente assinou:</b> ${escapeHtml(fmt((solic as any).cliente_assinado_em))}</p>
        <p><b>Loja assinou:</b> ${escapeHtml(fmt((solic as any).loja_assinado_em))}</p>
        <p><b>Concluído:</b> ${escapeHtml(fmt((solic as any).concluido_em))}</p>
        <h2>Participantes</h2>
        <table class="audit-table">
          <thead><tr><th>Tipo</th><th>Nome</th><th>Documento</th><th>Status</th><th>Assinado em</th></tr></thead>
          <tbody>${participantesHtml || `<tr><td colspan="5">Nenhum participante registrado.</td></tr>`}</tbody>
        </table>
        <h2>Linha do tempo</h2>
        <ol class="timeline">${eventosHtml || "<li>Nenhum evento registrado.</li>"}</ol>
        <p class="muted">Token: ${escapeHtml((solic as any).token)} · ID: ${escapeHtml((solic as any).id)}</p>
      </section>
      ${evidenciasHtml}
    `;
    document.body.appendChild(container);
    await waitForImages(container);
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf().set({
      margin: 0,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    } as any).from(container).save();
    container.remove();
    toast.success("PDF completo baixado", { id: toastId });
  } catch (error: any) {
    toast.error(`Erro ao baixar PDF: ${error?.message || "desconhecido"}`, { id: toastId });
  }
}