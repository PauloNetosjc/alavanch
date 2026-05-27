// PDF final consolidado: documento original + páginas de evidências
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: m[1] };
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

async function fetchStorageBytes(sb: any, bucket: string, path: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await sb.storage.from(bucket).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function embedImage(pdf: PDFDocument, src: string) {
  let bytes: Uint8Array | null = null;
  let mime = "";
  if (src.startsWith("data:")) {
    const r = dataUrlToBytes(src);
    if (!r) return null;
    bytes = r.bytes;
    mime = r.mime;
  } else {
    bytes = await fetchBytes(src);
    mime = src.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
  }
  if (!bytes) return null;
  try {
    return mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    try {
      return await pdf.embedJpg(bytes);
    } catch {
      try {
        return await pdf.embedPng(bytes);
      } catch {
        return null;
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { solicitacao_id } = await req.json();
    if (!solicitacao_id) throw new Error("solicitacao_id obrigatório");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: s, error: errS } = await sb
      .from("solicitacoes_assinatura")
      .select("*, tipos_documento(nome), pedidos(codigo), pedido_documentos(nome,storage_path,bucket_name,mime_type)")
      .eq("id", solicitacao_id)
      .single();
    if (errS || !s) throw new Error("Solicitação não encontrada");

    const { data: parts } = await sb
      .from("assinatura_participantes")
      .select("*")
      .eq("solicitacao_id", solicitacao_id);
    const { data: evids } = await sb
      .from("assinatura_evidencias")
      .select("*")
      .eq("solicitacao_id", solicitacao_id);
    const { data: eventos } = await sb
      .from("assinatura_eventos")
      .select("*")
      .eq("solicitacao_id", solicitacao_id)
      .order("created_at", { ascending: true });

    // PDF base
    let pdf: PDFDocument;
    const doc = (s as any).pedido_documentos;
    const originalBucket = doc?.bucket_name || (s.contrato_id ? "contratos-assinatura" : "pedido-docs");
    const originalPath = doc?.storage_path || s.storage_path;
    const originalMime = String(doc?.mime_type || "").toLowerCase();
    const originalLooksPdf = originalMime.includes("pdf") || String(originalPath || s.file_url || "").toLowerCase().endsWith(".pdf");
    const orig = originalPath
      ? await fetchStorageBytes(sb, originalBucket, originalPath)
      : (s.file_url ? await fetchBytes(s.file_url) : null);

    if (orig && originalLooksPdf) {
      try {
        pdf = await PDFDocument.load(orig, { ignoreEncryption: true });
      } catch {
        pdf = await PDFDocument.create();
      }
    } else if (orig && !originalLooksPdf) {
      pdf = await PDFDocument.create();
      const p = pdf.addPage([595, 842]);
      const f = await pdf.embedFont(StandardFonts.Helvetica);
      const fB = await pdf.embedFont(StandardFonts.HelveticaBold);
      p.drawText("Documento original enviado", { x: 40, y: 800, size: 14, font: fB });
      p.drawText(`Arquivo: ${doc?.nome ?? s.file_name ?? originalPath ?? "documento"}`, { x: 40, y: 774, size: 10, font: f });
      p.drawText("O conteúdo original em formato não-PDF é incluído no download gerado pela tela do pedido.", { x: 40, y: 756, size: 10, font: f });
    } else if (s.file_url) {
      const origUrl = await fetchBytes(s.file_url);
      if (origUrl && originalLooksPdf) {
        try {
          pdf = await PDFDocument.load(origUrl, { ignoreEncryption: true });
        } catch {
          pdf = await PDFDocument.create();
        }
      } else {
        pdf = await PDFDocument.create();
      }
    } else {
      pdf = await PDFDocument.create();
    }

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Página de auditoria
    const audit = pdf.addPage([595, 842]); // A4
    let y = 800;
    const draw = (text: string, opts: { size?: number; bold?: boolean; color?: any } = {}) => {
      const size = opts.size ?? 10;
      const f = opts.bold ? fontB : font;
      audit.drawText(text, { x: 40, y, size, font: f, color: opts.color ?? rgb(0.1, 0.1, 0.1) });
      y -= size + 4;
    };
    draw("CERTIFICADO DE ASSINATURA DIGITAL", { size: 14, bold: true });
    y -= 6;
    draw(`Pedido: ${(s as any).pedidos?.codigo ?? s.pedido_id}`);
    draw(`Documento: ${(s as any).tipos_documento?.nome ?? ""} ${s.file_name ? "— " + s.file_name : ""}`);
    draw(`Status: ${s.status}`);
    draw(`Criado em: ${new Date(s.created_at).toLocaleString("pt-BR")}`);
    if (s.cliente_assinado_em) draw(`Cliente assinou em: ${new Date(s.cliente_assinado_em).toLocaleString("pt-BR")}`);
    if (s.loja_assinado_em) draw(`Loja assinou em: ${new Date(s.loja_assinado_em).toLocaleString("pt-BR")}`);
    if (s.concluido_em) draw(`Concluído em: ${new Date(s.concluido_em).toLocaleString("pt-BR")}`);
    if (s.recusado_em) draw(`Recusado em: ${new Date(s.recusado_em).toLocaleString("pt-BR")} — ${s.motivo_recusa ?? ""}`);
    y -= 6;

    draw("PARTICIPANTES", { size: 12, bold: true });
    for (const p of parts ?? []) {
      draw(`• ${p.tipo.toUpperCase()}: ${p.nome ?? "—"}  ${p.documento ? "(" + p.documento + ")" : ""}`);
      draw(`   E-mail: ${p.email ?? "—"}   Tel: ${p.telefone ?? "—"}   Status: ${p.status}`);
      if (p.assinado_em) draw(`   Assinado em: ${new Date(p.assinado_em).toLocaleString("pt-BR")}`);
    }
    y -= 6;

    draw("LINHA DO TEMPO", { size: 12, bold: true });
    for (const ev of eventos ?? []) {
      const t = new Date(ev.created_at).toLocaleString("pt-BR");
      draw(`• [${t}] ${ev.tipo_evento} — ${ev.descricao ?? ""}`);
    }
    y -= 6;

    draw(`Token: ${s.token}`, { size: 8, color: rgb(0.45, 0.45, 0.45) });
    draw(`ID: ${s.id}`, { size: 8, color: rgb(0.45, 0.45, 0.45) });

    // Páginas de evidências (imagens)
    for (const ev of evids ?? []) {
      const items: { label: string; src: string | null }[] = [
        { label: "Documento de identificação", src: ev.documento_foto_url },
        { label: "Selfie com documento", src: ev.selfie_url },
        { label: "Assinatura desenhada", src: ev.assinatura_url },
      ];
      for (const it of items) {
        if (!it.src) continue;
        const img = await embedImage(pdf, it.src);
        if (!img) continue;
        const pg = pdf.addPage([595, 842]);
        pg.drawText(it.label, { x: 40, y: 800, size: 14, font: fontB });
        pg.drawText(`Solicitação ${s.id}`, { x: 40, y: 782, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
        const maxW = 515, maxH = 700;
        const dim = img.scale(1);
        const ratio = Math.min(maxW / dim.width, maxH / dim.height, 1);
        const w = dim.width * ratio, h = dim.height * ratio;
        pg.drawImage(img, { x: (595 - w) / 2, y: 760 - h, width: w, height: h });
      }
    }

    const finalBytes = await pdf.save();
    const path = `${s.pedido_id}/${s.id}.pdf`;
    const { error: errUp } = await sb.storage
      .from("assinaturas-finais")
      .upload(path, finalBytes, { contentType: "application/pdf", upsert: true });
    if (errUp) throw errUp;

    const { data: pub } = sb.storage.from("assinaturas-finais").getPublicUrl(path);
    const url = pub.publicUrl;

    await sb.from("documentos_assinados").delete().eq("solicitacao_id", s.id);
    const codigo = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
    await sb.from("documentos_assinados").insert({
      solicitacao_id: s.id,
      storage_path: path,
      final_file_url: url,
      codigo_validacao: codigo,
    });

    await sb.from("solicitacoes_assinatura").update({
      final_pdf_storage_path: path,
      final_pdf_url: url,
    }).eq("id", s.id);

    if (s.contrato_id) {
      await sb.from("contratos").update({
        pdf_assinado_url: url,
        metodo_assinatura: "digital",
      }).eq("id", s.contrato_id);
    }

    const { data: pastaDocs } = await sb
      .from("pedido_pastas")
      .select("id")
      .eq("pedido_id", s.pedido_id)
      .ilike("nome", "Documentos")
      .maybeSingle();

    const nomeArquivo = `Assinatura final - ${(s as any).pedidos?.codigo ?? "pedido"} - ${s.file_name ?? (s as any).tipos_documento?.nome ?? "documento"}.pdf`;
    await sb.from("pedido_documentos").insert({
      pedido_id: s.pedido_id,
      pasta_id: pastaDocs?.id ?? null,
      nome: nomeArquivo,
      storage_path: path,
      bucket_name: "assinaturas-finais",
      tamanho: finalBytes.length,
      mime_type: "application/pdf",
      assinado_em: s.cliente_assinado_em ?? s.concluido_em ?? new Date().toISOString(),
      assinatura_nome: (parts ?? []).find((p) => p.tipo === "cliente" && p.status === "assinado")?.nome ?? null,
      assinatura_cpf: (parts ?? []).find((p) => p.tipo === "cliente" && p.status === "assinado")?.documento ?? null,
    });

    return new Response(JSON.stringify({ url, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
