// fiscal-nfe-emitir — orquestra a emissão de NF-e em HOMOLOGAÇÃO.
// PRODUÇÃO É EXPLICITAMENTE BLOQUEADA.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { carregarCertificadoAtivo, CertificadoError } from "../_shared/fiscal/certificadoService.ts";
import { buildNfeXml, type BuildNfeInput } from "../_shared/fiscal/nfeXmlBuilder.ts";
import { assinarNfe } from "../_shared/fiscal/nfeSigner.ts";
import { validarCamposMinimos, validarXmlAssinado } from "../_shared/fiscal/nfeValidator.ts";
import { enviarLoteNfe } from "../_shared/fiscal/sefazClient.ts";
import { gerarDanfeHomologacao } from "../_shared/fiscal/danfeService.ts";
import { registrarEvento, registrarLogTecnico } from "../_shared/fiscal/fiscalLogService.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

interface ReqBody { nota_fiscal_id: string }

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);

  // 1) Valida JWT
  const supaUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return jsonResp({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  // 2) Cliente service para queries + storage
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: ReqBody;
  try { body = await req.json(); } catch { return jsonResp({ error: "JSON inválido" }, 400); }
  if (!body?.nota_fiscal_id) return jsonResp({ error: "nota_fiscal_id obrigatório" }, 400);

  const nota_fiscal_id = body.nota_fiscal_id;

  // 3) Carrega nota + itens + emit + dest
  const { data: nota, error: nfErr } = await supa
    .from("notas_fiscais").select("*").eq("id", nota_fiscal_id).maybeSingle();
  if (nfErr || !nota) return jsonResp({ error: "Nota não encontrada" }, 404);

  // BLOQUEIO PRODUÇÃO
  const ambiente = nota.ambiente || "homologacao";
  if (ambiente !== "homologacao") return jsonResp({ error: "Emissão em produção está bloqueada nesta fase" }, 403);
  if ((nota.tipo || "").toLowerCase() !== "nfe") return jsonResp({ error: "Apenas NF-e é suportada nesta fase" }, 400);
  if (!["rascunho", "pronta_para_emitir"].includes(nota.status)) {
    return jsonResp({ error: `Nota com status '${nota.status}' não pode ser emitida` }, 400);
  }

  // 4) Verifica permissão do usuário sobre esta loja
  const { data: vinculo } = await supa
    .from("user_lojas").select("loja_id").eq("user_id", userId).eq("loja_id", nota.loja_id).maybeSingle();
  const { data: rolesRows } = await supa.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (rolesRows ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin && !vinculo) return jsonResp({ error: "Sem acesso à loja" }, 403);

  // 5) Permissão notas_fiscais
  if (!isAdmin) {
    const { data: perms } = await supa.from("v_my_permissions").select("modulo,acao");
    const ok = (perms ?? []).some((p: any) => p.modulo === "notas_fiscais" && ["create", "edit", "view"].includes(p.acao));
    if (!ok) return jsonResp({ error: "Sem permissão notas_fiscais" }, 403);
  }

  await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "emissao_iniciada", user_id: userId });

  try {
    // 6) Config fiscal, itens, cliente, operação fiscal, configuração tributária
    const [{ data: cfg }, { data: itens }, { data: cliente }, { data: operacao }, { data: cfgTrib }] = await Promise.all([
      supa.from("configuracoes_fiscais").select("*").eq("loja_id", nota.loja_id).maybeSingle(),
      supa.from("notas_fiscais_itens").select("*").eq("nota_fiscal_id", nota_fiscal_id).order("numero_item", { ascending: true }),
      nota.cliente_id ? supa.from("clientes").select("*").eq("id", nota.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
      nota.operacao_fiscal_id ? supa.from("fiscal_operacoes").select("*").eq("id", nota.operacao_fiscal_id).maybeSingle() : Promise.resolve({ data: null }),
      nota.configuracao_tributaria_id ? supa.from("fiscal_configuracoes_tributarias").select("*").eq("id", nota.configuracao_tributaria_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!cfg) throw new Error("Configuração fiscal da loja não encontrada");
    if (!itens?.length) throw new Error("Nota sem itens");
    if (!cliente) throw new Error("Cliente não encontrado");
    if (!operacao) {
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "rejeitada",
        descricao: "Configuração tributária incompleta para a operação fiscal selecionada.", user_id: userId });
      await supa.from("notas_fiscais").update({ status: "rejeitada", mensagem_retorno: "Operação fiscal não definida na nota." }).eq("id", nota_fiscal_id);
      return jsonResp({ ok: false, status: "rejeitada", erro: "Operação fiscal não definida na nota." }, 400);
    }

    // 7) Numeração
    let numero_nf: number = nota.numero_nf;
    if (!numero_nf) {
      numero_nf = cfg.proximo_numero_nfe ?? 1;
      await supa.from("configuracoes_fiscais").update({ proximo_numero_nfe: numero_nf + 1 }).eq("id", cfg.id);
    }

    const finalidadeMap: Record<string, number> = { normal: 1, complementar: 2, ajuste: 3, devolucao: 4 };
    const finNFe = finalidadeMap[operacao.finalidade_nfe || "normal"] ?? 1;
    const tpNF = (operacao.tipo_nota === "entrada") ? 0 : 1;
    const cfopOp = operacao.codigo_cfop || cfgTrib?.codigo_cfop || null;

    // 8) Monta input do builder
    const buildInput: BuildNfeInput = {
      nota: {
        id: nota.id,
        numero_nf,
        serie: Number(cfg.serie_nfe ?? nota.serie ?? 1),
        natureza_operacao: operacao.nome ?? nota.natureza_operacao ?? "Venda de mercadoria",
        data_emissao: nota.data_emissao ?? new Date().toISOString(),
        valor_total: Number(nota.valor_total ?? 0),
        valor_produtos: Number(nota.valor_produtos ?? nota.valor_total ?? 0),
        finalidade_nfe: finNFe,
        tpNF,
      },
      emit: {
        cnpj: cfg.cnpj,
        razao_social: cfg.razao_social,
        nome_fantasia: cfg.nome_fantasia,
        ie: cfg.inscricao_estadual,
        crt: Number(cfg.crt ?? 3),
        uf: cfg.uf,
        municipio: cfg.municipio,
        codigo_municipio: String(cfg.codigo_municipio_ibge ?? ""),
        cnae: cfg.cnae_principal,
        endereco: { logradouro: "Endereco da loja", numero: "S/N", bairro: "Centro", cep: "" },
      },
      dest: {
        nome: cliente.nome ?? "Consumidor",
        documento: cliente.cpf || cliente.cnpj || cliente.documento || "00000000000",
        ie: cliente.inscricao_estadual,
        indIEDest: cliente.inscricao_estadual ? 1 : 9,
        email: cliente.email,
        endereco: cliente.endereco ? {
          logradouro: cliente.endereco, numero: cliente.numero ?? "S/N", bairro: cliente.bairro ?? "Centro",
          cep: cliente.cep ?? "", municipio: cliente.cidade ?? cfg.municipio,
          uf: cliente.uf ?? cfg.uf, codigo_municipio: String(cliente.codigo_municipio_ibge ?? cfg.codigo_municipio_ibge ?? ""),
        } : undefined,
      },
      itens: itens.map((it: any, idx: number) => ({
        nItem: idx + 1,
        cProd: it.codigo ?? String(it.id).slice(0, 12),
        cEAN: it.ean,
        xProd: it.descricao ?? "Produto",
        NCM: it.ncm ?? "00000000",
        CFOP: String(it.cfop ?? cfopOp ?? "5102"),
        uCom: it.unidade ?? "UN",
        qCom: Number(it.quantidade ?? 1),
        vUnCom: Number(it.valor_unitario ?? 0),
        vProd: Number(it.valor_total ?? 0),
        CST: it.cst ?? cfgTrib?.icms_cst ?? undefined,
        CSOSN: cfgTrib?.icms_csosn ?? undefined,
        origem: it.origem ?? Number(cfgTrib?.icms_origem ?? 0),
        icms_aliquota: Number(cfgTrib?.icms_interno_aliquota ?? cfgTrib?.icms_aliquota ?? 0),
        pis_cst: cfgTrib?.pis_cst ?? undefined,
        pis_aliquota: Number(cfgTrib?.pis_aliquota ?? 0),
        cofins_cst: cfgTrib?.cofins_cst ?? undefined,
        cofins_aliquota: Number(cfgTrib?.cofins_aliquota ?? 0),
        ipi_cst: cfgTrib?.ipi_cst ?? undefined,
        ipi_aliquota: Number(cfgTrib?.ipi_aliquota ?? 0),
        ipi_enquadramento: cfgTrib?.ipi_enquadramento ?? undefined,
      })),
    };

    // 9) Validação mínima
    const valMin = validarCamposMinimos(buildInput);
    if (!valMin.ok) {
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "rejeitada",
        descricao: "Validação mínima falhou", payload: { erros: valMin.erros }, user_id: userId });
      await supa.from("notas_fiscais").update({ status: "rejeitada", mensagem_retorno: valMin.erros.join("; ") }).eq("id", nota_fiscal_id);
      return jsonResp({ ok: false, status: "rejeitada", erros: valMin.erros }, 400);
    }

    // 10) Carrega certificado A1 do backend
    let cert;
    try {
      cert = await carregarCertificadoAtivo(supa, nota.loja_id);
    } catch (e) {
      const ce = e as CertificadoError;
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "erro_transmissao",
        descricao: `Certificado: ${ce.code}`, payload: { code: ce.code, msg: ce.message }, user_id: userId });
      await supa.from("notas_fiscais").update({ status: "erro_transmissao", mensagem_retorno: ce.message }).eq("id", nota_fiscal_id);
      return jsonResp({ ok: false, status: "erro_transmissao", erro: ce.message }, 400);
    }

    // 11) Monta XML
    const t1 = Date.now();
    const montada = buildNfeXml(buildInput);
    await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "xml_gerado",
      payload: { chave: montada.chaveAcesso }, user_id: userId });
    await registrarLogTecnico(supa, { nota_fiscal_id, loja_id: nota.loja_id, etapa: "xml_gerado",
      payload: { chave: montada.chaveAcesso }, duracao_ms: Date.now() - t1 });

    // 12) Assina
    const t2 = Date.now();
    const assinada = assinarNfe({ xmlNFe: montada.xml, infNFeId: montada.infNFeId, pfx: cert.pfx, senha: cert.senha });
    await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "xml_assinado",
      payload: { digest: assinada.digestValue }, user_id: userId });
    await registrarLogTecnico(supa, { nota_fiscal_id, loja_id: nota.loja_id, etapa: "xml_assinado",
      payload: { digest: assinada.digestValue }, duracao_ms: Date.now() - t2 });

    // 13) Validação pós-assinatura
    const valAss = validarXmlAssinado(assinada.xmlAssinado);
    if (!valAss.ok) {
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "rejeitada",
        descricao: "XML assinado inválido", payload: { erros: valAss.erros }, user_id: userId });
      await supa.from("notas_fiscais").update({ status: "rejeitada", mensagem_retorno: valAss.erros.join("; ") }).eq("id", nota_fiscal_id);
      return jsonResp({ ok: false, status: "rejeitada", erros: valAss.erros }, 400);
    }
    await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "xml_validado", user_id: userId });

    // 14) Caminho base no storage
    const dt = new Date();
    const baseDir = `${nota.loja_id}/${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${nota_fiscal_id}`;

    // Salva XML assinado
    await supa.storage.from("notas-fiscais").upload(`${baseDir}/nfe-assinada.xml`,
      new Blob([assinada.xmlAssinado], { type: "application/xml" }), { upsert: true });

    // 15) Envia para SEFAZ (via Gateway Fiscal mTLS)
    const t3 = Date.now();
    const idLote = String(Date.now()).slice(-15);

    await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "gateway_mtls_chamado",
      payload: { idLote, uf: cfg.uf }, user_id: userId });

    const ret = await enviarLoteNfe({
      uf: cfg.uf, xmlNFeAssinada: assinada.xmlAssinado, idLote, pfx: cert.pfx, senha: cert.senha,
    });

    if (ret.gatewayChamado && ret.gatewayRespondeu) {
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "gateway_mtls_respondeu",
        payload: { status: ret.status, cStat: ret.cStat }, user_id: userId });
    } else if (ret.gatewayChamado && !ret.gatewayRespondeu) {
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "gateway_mtls_erro",
        descricao: ret.gatewayErro ?? ret.erro, user_id: userId });
    }

    if (ret.xmlRetornoBruto) {
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "sefaz_retorno_recebido",
        payload: { cStat: ret.cStat, xMotivo: ret.xMotivo }, user_id: userId });
    }

    await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "lote_enviado",
      payload: { idLote, status: ret.status, cStat: ret.cStat, xMotivo: ret.xMotivo }, user_id: userId });
    await registrarLogTecnico(supa, { nota_fiscal_id, loja_id: nota.loja_id, etapa: "lote_enviado",
      payload: { idLote, gateway: { chamado: ret.gatewayChamado, respondeu: ret.gatewayRespondeu } },
      retorno: { status: ret.status, cStat: ret.cStat, xMotivo: ret.xMotivo },
      erro: ret.erro, duracao_ms: Date.now() - t3 });

    // Salva retorno bruto
    if (ret.xmlRetornoBruto) {
      await supa.storage.from("notas-fiscais").upload(`${baseDir}/retorno-sefaz.xml`,
        new Blob([ret.xmlRetornoBruto], { type: "application/xml" }), { upsert: true });
    }

    if (ret.status === "autorizada" && ret.xmlAutorizado) {
      await supa.storage.from("notas-fiscais").upload(`${baseDir}/nfe-autorizada.xml`,
        new Blob([ret.xmlAutorizado], { type: "application/xml" }), { upsert: true });

      // Gera DANFE
      const danfe = await gerarDanfeHomologacao({
        chaveAcesso: montada.chaveAcesso, numero: numero_nf, serie: buildInput.nota.serie,
        protocolo: ret.protocolo,
        emit: { razao: cfg.razao_social, cnpj: cfg.cnpj, uf: cfg.uf, municipio: cfg.municipio },
        dest: { nome: buildInput.dest.nome, documento: buildInput.dest.documento },
        itens: buildInput.itens.map(i => ({ cProd: i.cProd, xProd: i.xProd, qCom: i.qCom, vUnCom: i.vUnCom, vProd: i.vProd })),
        valorTotal: buildInput.nota.valor_total,
        dataEmissao: buildInput.nota.data_emissao,
      });
      await supa.storage.from("notas-fiscais").upload(`${baseDir}/danfe.pdf`,
        new Blob([danfe], { type: "application/pdf" }), { upsert: true });

      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "autorizada",
        descricao: ret.xMotivo, payload: { protocolo: ret.protocolo, cStat: ret.cStat }, user_id: userId });

      await supa.from("notas_fiscais").update({
        status: "autorizada",
        chave_acesso: montada.chaveAcesso,
        chave: montada.chaveAcesso,
        protocolo_autorizacao: ret.protocolo,
        protocolo: ret.protocolo,
        data_autorizacao: ret.dhRecbto ?? new Date().toISOString(),
        mensagem_retorno: ret.xMotivo,
        numero_lote: idLote,
        numero_recibo: ret.numeroRecibo,
        numero_nf,
        numero: String(numero_nf),
        serie: String(buildInput.nota.serie),
        digest_value: assinada.digestValue,
        xml_url: `${baseDir}/nfe-assinada.xml`,
        xml_autorizado_url: `${baseDir}/nfe-autorizada.xml`,
        retorno_sefaz_url: `${baseDir}/retorno-sefaz.xml`,
        danfe_url: `${baseDir}/danfe.pdf`,
        xml_storage_path: `${baseDir}/nfe-autorizada.xml`,
        pdf_storage_path: `${baseDir}/danfe.pdf`,
        provider: "alavanch-backend-fiscal",
      }).eq("id", nota_fiscal_id);

      return jsonResp({ ok: true, status: "autorizada", chave: montada.chaveAcesso,
        protocolo: ret.protocolo, mensagem: ret.xMotivo, baseDir });
    }

    if (ret.status === "aguardando_consulta") {
      await supa.from("notas_fiscais").update({
        status: "enviada", numero_lote: idLote, numero_recibo: ret.numeroRecibo,
        mensagem_retorno: ret.xMotivo, numero_nf,
      }).eq("id", nota_fiscal_id);
      await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: "recibo_recebido",
        payload: { numeroRecibo: ret.numeroRecibo }, user_id: userId });
      return jsonResp({ ok: true, status: "enviada", numeroRecibo: ret.numeroRecibo, mensagem: ret.xMotivo });
    }

    // rejeitada ou erro_transmissao
    const finalStatus = ret.status === "rejeitada" ? "rejeitada" : "erro_transmissao";
    await registrarEvento(supa, { nota_fiscal_id, loja_id: nota.loja_id, tipo: finalStatus,
      descricao: ret.xMotivo ?? ret.erro, payload: { cStat: ret.cStat, erro: ret.erro }, user_id: userId });
    await supa.from("notas_fiscais").update({
      status: finalStatus, mensagem_retorno: ret.xMotivo ?? ret.erro,
      retorno_sefaz_url: ret.xmlRetornoBruto ? `${baseDir}/retorno-sefaz.xml` : null,
    }).eq("id", nota_fiscal_id);

    return jsonResp({ ok: false, status: finalStatus, cStat: ret.cStat, mensagem: ret.xMotivo ?? ret.erro }, 200);
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[fiscal-nfe-emitir] erro:", msg);
    await registrarEvento(supa, { nota_fiscal_id, loja_id: null, tipo: "erro_transmissao",
      descricao: msg, user_id: userId });
    await supa.from("notas_fiscais").update({ status: "erro_transmissao", mensagem_retorno: msg }).eq("id", nota_fiscal_id);
    return jsonResp({ ok: false, status: "erro_transmissao", erro: msg }, 500);
  }
});
