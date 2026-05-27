import { supabase } from "@/integrations/supabase/client";
import { renderContratoHtml, type ContratoTemplate } from "@/lib/contratoTemplate";
import { buildLojaSignatureDataUrl } from "@/lib/lojaSignature";
import { getPublicSignatureUrl } from "@/lib/publicLinks";

const safeName = (value: string) => value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

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

export async function prepararContratoParaAssinatura(solicitacaoId: string) {
  const { data: solic } = await supabase
    .from("solicitacoes_assinatura")
    .select("*")
    .eq("id", solicitacaoId)
    .maybeSingle();
  if (!solic?.pedido_id || !solic?.contrato_id) return;

  const [{ data: contrato }, { data: pedido }, { data: participantes }] = await Promise.all([
    supabase.from("contratos").select("*").eq("id", solic.contrato_id).maybeSingle(),
    supabase.from("pedidos").select("id,codigo,cliente_id,loja_id").eq("id", solic.pedido_id).maybeSingle(),
    supabase.from("assinatura_participantes").select("id,tipo,status").eq("solicitacao_id", solicitacaoId),
  ]);
  if (!contrato || !pedido) return;

  const [{ data: loja }, { data: configEmpresa }, { data: cliente }, { data: tpl }, auth] = await Promise.all([
    pedido.loja_id ? supabase.from("lojas").select("nome,cnpj,endereco,cidade,uf").eq("id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.loja_id ? supabase.from("configuracoes_empresa").select("nome_empresa,nome_fantasia,cnpj,endereco,telefone").eq("loja_id", pedido.loja_id).maybeSingle() : Promise.resolve({ data: null } as any),
    pedido.cliente_id ? supabase.from("clientes").select("*").eq("id", pedido.cliente_id).maybeSingle() : Promise.resolve({ data: null } as any),
    contrato.template_id ? supabase.from("contratos_template").select("*").eq("id", contrato.template_id).maybeSingle() : Promise.resolve({ data: null } as any),
    supabase.auth.getUser(),
  ]);

  const currentUser = (auth as any)?.data?.user;
  const { data: profile } = currentUser?.id
    ? await supabase.from("profiles").select("nome_completo,cargo").eq("user_id", currentUser.id).maybeSingle()
    : ({ data: null } as any);

  const snapshot = ((contrato.conteudo_snapshot as any) || {});
  const empresaSnapshot = snapshot.empresa || {};
  const razaoSocial = configEmpresa?.nome_empresa || loja?.nome || empresaSnapshot.razao_social || empresaSnapshot.nome || "Loja";
  const nomeFantasia = configEmpresa?.nome_fantasia || loja?.nome || empresaSnapshot.nome_fantasia || empresaSnapshot.nome || razaoSocial;
  const lojaNome = nomeFantasia || razaoSocial;
  const responsavel = profile?.nome_completo || currentUser?.email || lojaNome;
  const assinaturaLojaUrl = solic.assinatura_loja_url || buildLojaSignatureDataUrl({
    nome: lojaNome,
    razao_social: razaoSocial,
    nome_fantasia: nomeFantasia,
    cnpj: loja?.cnpj || configEmpresa?.cnpj || empresaSnapshot.cnpj,
    endereco: loja?.endereco || configEmpresa?.endereco || empresaSnapshot.endereco,
    cidade: loja?.cidade,
    uf: loja?.uf,
    responsavel,
  });
  const lojaAssinadoEm = solic.loja_assinado_em || new Date().toISOString();

  if (!solic.loja_assinado_em) {
    const jaTemLoja = (participantes || []).some((p: any) => p.tipo === "loja" && p.status === "assinado");
    let participanteId: string | null = null;
    if (!jaTemLoja) {
      const { data: part } = await supabase
        .from("assinatura_participantes")
        .insert({
          solicitacao_id: solicitacaoId,
          tipo: "loja",
          nome: responsavel,
          user_id: currentUser?.id || null,
          cargo: profile?.cargo || null,
          status: "assinado",
          assinado_em: lojaAssinadoEm,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        })
        .select("id")
        .single();
      participanteId = part?.id || null;
    }

    await supabase.from("assinatura_evidencias").insert({
      solicitacao_id: solicitacaoId,
      participante_id: participanteId,
      assinatura_url: assinaturaLojaUrl,
      aceite: true,
      aceite_texto: "Pré-assinatura digital da loja (carimbo eletrônico)",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    await supabase.from("assinatura_eventos").insert({
      solicitacao_id: solicitacaoId,
      tipo_evento: "loja_assinou",
      status_anterior: solic.status,
      status_novo: solic.status,
      descricao: `Loja pré-assinou automaticamente (${responsavel})`,
      user_id: currentUser?.id || null,
    });
  }

  const pastaId = await ensurePastaDocumentos(solic.pedido_id);

  if (solic.pedido_documento_id) {
    await supabase
      .from("pedido_documentos")
      .update({ pasta_id: pastaId, enviado_para_assinatura: true } as any)
      .eq("id", solic.pedido_documento_id);
  } else if (tpl) {
    const ctx = {
      ...((contrato.conteudo_snapshot as any) || {}),
      cliente: ((contrato.conteudo_snapshot as any)?.cliente || cliente || null),
      signing_url: getPublicSignatureUrl(solic.token),
      assinatura_loja_url: assinaturaLojaUrl,
      loja_assinado_em: lojaAssinadoEm,
      loja_assinatura_nome: responsavel,
    };
    const html = renderContratoHtml(tpl as ContratoTemplate, ctx as any);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const path = `${solic.pedido_id}/contrato-${safeName(contrato.numero || solic.id)}-${solic.id}.html`;
    const { error: upErr } = await supabase.storage.from("contratos-assinatura").upload(path, blob, {
      upsert: true,
      contentType: "text/html;charset=utf-8",
    });
    if (upErr) throw upErr;
    const publicUrl = supabase.storage.from("contratos-assinatura").getPublicUrl(path).data.publicUrl;
    const { data: doc } = await supabase
      .from("pedido_documentos")
      .insert({
        pedido_id: solic.pedido_id,
        pasta_id: pastaId,
        nome: `Contrato ${contrato.numero} - pré-assinado pela loja`,
        storage_path: path,
        bucket_name: "contratos-assinatura",
        tamanho: blob.size,
        mime_type: "text/html",
        enviado_para_assinatura: true,
      } as any)
      .select("id")
      .single();

    await supabase
      .from("solicitacoes_assinatura")
      .update({
        pedido_documento_id: doc?.id || null,
        file_name: `Contrato ${contrato.numero}`,
        file_url: publicUrl,
        storage_path: path,
        assinatura_loja_url: assinaturaLojaUrl,
        loja_assinado_em: lojaAssinadoEm,
      } as any)
      .eq("id", solicitacaoId);
    return;
  }

  await supabase
    .from("solicitacoes_assinatura")
    .update({ assinatura_loja_url: assinaturaLojaUrl, loja_assinado_em: lojaAssinadoEm } as any)
    .eq("id", solicitacaoId);
}