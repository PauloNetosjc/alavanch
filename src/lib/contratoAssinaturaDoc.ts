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

async function htmlToPdfBlob(html: string, filename: string) {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#111;z-index:-1;";
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map((s) => s[1]).join("\n");
  container.innerHTML = `${styles ? `<style>${styles}</style>` : ""}${body}`;
  document.body.appendChild(container);
  await waitForImages(container);
  const html2pdf = (await import("html2pdf.js")).default;
  const blob = await html2pdf().set({
    margin: 0,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  } as any).from(container).outputPdf("blob");
  container.remove();
  return blob as Blob;
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
    supabase.from("pedidos").select("id,codigo,cliente_id,loja_id").eq("id", solic.pedido_id).maybeSingle(),
  ]);
  if (!contrato || !pedido) return;

  const [{ data: loja }, { data: configEmpresa }, { data: cliente }, { data: tplLoja }, { data: tplContrato }] = await Promise.all([
    pedido.loja_id ? supabase.from("lojas").select("nome,cnpj,endereco,cidade,uf").eq("id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.loja_id ? supabase.from("configuracoes_empresa").select("nome_empresa,nome_fantasia,cnpj,endereco,telefone").eq("loja_id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.cliente_id ? supabase.from("clientes").select("*").eq("id", pedido.cliente_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.loja_id ? supabase.from("contratos_template").select("*").eq("loja_id", pedido.loja_id).eq("ativo", true).order("updated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null } as any),
    contrato.template_id ? supabase.from("contratos_template").select("*").eq("id", contrato.template_id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  const tpl = tplLoja || tplContrato;

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

  if (tpl) {
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
    const path = `${solic.pedido_id}/contrato-${safeName(contrato.numero || solic.id)}-${solic.id}.pdf`;
    const { error: upErr } = await supabase.storage.from("contratos-assinatura").upload(path, blob, {
      upsert: true,
      contentType: "application/pdf",
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
}