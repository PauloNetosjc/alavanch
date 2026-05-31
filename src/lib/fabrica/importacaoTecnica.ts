import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "fabrica-pacotes-tecnicos";

export type OrigemPasta = "AutoLabel" | "NC" | "Parts" | "Profile" | "xml" | "raiz" | "outro";
export type TipoArquivo =
  | "etiqueta_individual"
  | "labels_pdf"
  | "small_preview_cutting_plan"
  | "large_preview_cutting_plan"
  | "nc_chapa"
  | "nc_peca"
  | "cyc_chapa"
  | "arquivo_configuracao_peca"
  | "lista_corte_pdf"
  | "preview_corte_pdf"
  | "relatorio_almoxarifado_pdf"
  | "list"
  | "promob"
  | "outro";

export interface ResultadoImportacao {
  importacaoId: string;
  totalArquivos: number;
  totalChapas: number;
  totalEtiquetas: number;
  totalArquivosTecnicos: number;
  alertas: string[];
  status: "processado" | "processado_com_alertas" | "erro";
  mensagem?: string;
}

interface ParseEtiqueta {
  codigo_etiqueta_completo: string;
  referencia_peca: string | null;
  codigo_peca: string | null;
  sufixo: string | null;
  indice_duplicidade: number | null;
}

/** Parses names like GAV8252A(1) or BAS7080A(1).bmp */
export function parseNomeEtiqueta(nomeOriginal: string): ParseEtiqueta {
  const semExt = nomeOriginal.replace(/\.[a-z0-9]+$/i, "");
  const m = semExt.match(/^([A-Za-z]+)(\d+)([A-Za-z]*)(?:\((\d+)\))?$/);
  if (!m) return { codigo_etiqueta_completo: semExt, referencia_peca: null, codigo_peca: null, sufixo: null, indice_duplicidade: null };
  return {
    codigo_etiqueta_completo: semExt,
    referencia_peca: m[1] || null,
    codigo_peca: m[2] || null,
    sufixo: m[3] || null,
    indice_duplicidade: m[4] ? parseInt(m[4], 10) : null,
  };
}

/** Parses chapa filename like 13_MDP_Cerrado_Bold_25.cyc */
export function parseNomeChapaCyc(nome: string) {
  const semExt = nome.replace(/\.[a-z0-9]+$/i, "");
  const partes = semExt.split("_").filter(Boolean);
  if (partes.length < 3) return null;
  const numero = partes[0];
  const espessuraStr = partes[partes.length - 1];
  const espessura = parseFloat(espessuraStr.replace(",", "."));
  const material = partes[1];
  const cor = partes.slice(2, -1).join(" ");
  return {
    numero_chapa: numero,
    ordem_chapa: /^\d+$/.test(numero) ? parseInt(numero, 10) : null,
    material,
    cor_linha: cor || null,
    espessura: isNaN(espessura) ? null : espessura,
  };
}

function detectarOrigem(caminho: string): OrigemPasta {
  const partes = caminho.split("/").filter(Boolean);
  if (partes.length <= 1) return "raiz";
  const dir = partes[partes.length - 2];
  const lower = dir.toLowerCase();
  if (lower === "autolabel") return "AutoLabel";
  if (lower === "nc") return "NC";
  if (lower === "parts") return "Parts";
  if (lower === "profile") return "Profile";
  if (lower === "xml") return "xml";
  return "outro";
}

function detectarTipo(nome: string, origem: OrigemPasta): TipoArquivo {
  const lower = nome.toLowerCase();
  const ext = (lower.match(/\.([a-z0-9]+)$/)?.[1] || "").toLowerCase();
  const semExt = lower.replace(/\.[a-z0-9]+$/, "");

  if (origem === "raiz") {
    if (semExt === "list") return "list";
    if (lower.includes("listacorte") && ext === "pdf") return "lista_corte_pdf";
    if (lower.includes("previewcorte") && ext === "pdf") return "preview_corte_pdf";
    if ((lower.includes("relat") && lower.includes("almoxarifado")) && ext === "pdf") return "relatorio_almoxarifado_pdf";
  }
  if (origem === "AutoLabel") {
    if (lower.includes("smallpreviewcuttingplan") && (ext === "bmp" || ext === "png" || ext === "jpg")) return "small_preview_cutting_plan";
    if (lower.includes("largepreviewcuttingplan") && (ext === "bmp" || ext === "png" || ext === "jpg")) return "large_preview_cutting_plan";
    if (ext === "pdf" && lower.includes("label")) return "labels_pdf";
    if (ext === "bmp" || ext === "pdf") return "etiqueta_individual";
  }
  if (origem === "NC") {
    if (ext === "bmp") return "etiqueta_individual";
    if (ext === "nc") return "nc_chapa";
    if (ext === "cyc") return "cyc_chapa";
  }
  if (origem === "Parts") {
    if (ext === "nc") return "nc_peca";
    if (!ext) return "arquivo_configuracao_peca";
  }
  if (origem === "Profile") {
    if (ext === "nc") return "nc_peca";
    if (!ext) return "arquivo_configuracao_peca";
  }
  if (origem === "xml") {
    if (ext === "cyc") return "cyc_chapa";
  }
  return "outro";
}

function parseListXml(content: string): Array<Record<string, string>> {
  // Best-effort parse of <Cycle Name="Cycle_List"> ... <Field Value="..." Name="..."/>
  const cycles: Array<Record<string, string>> = [];
  const cycleRegex = /<Cycle\b[^>]*>([\s\S]*?)<\/Cycle>/gi;
  let m: RegExpExecArray | null;
  while ((m = cycleRegex.exec(content)) !== null) {
    const inner = m[1];
    const fields: Record<string, string> = {};
    const fieldRegex = /<Field\b([^/>]*)\/?>(?:<\/Field>)?/gi;
    let f: RegExpExecArray | null;
    let idx = 0;
    while ((f = fieldRegex.exec(inner)) !== null) {
      const attrs = f[1];
      const nameMatch = attrs.match(/Name\s*=\s*"([^"]+)"/i);
      const valueMatch = attrs.match(/Value\s*=\s*"([^"]+)"/i);
      const value = valueMatch?.[1] || "";
      const key = nameMatch?.[1] || `__pos_${idx}`;
      if (value) fields[key] = value;
      idx++;
    }
    if (Object.keys(fields).length) cycles.push(fields);
  }
  return cycles;
}

export interface ImportarParams {
  pedidoId?: string | null;
  loteId?: string | null;
  pedidosIds?: string[];
  lojaId?: string | null;
  tipoImportacao: "individual" | "lote_multi_cliente";
  arquivoZip: File;
  clienteNome?: string | null;
  projetoNome?: string | null;
  ambiente?: string | null;
}

export async function importarPacoteTecnico(params: ImportarParams): Promise<ResultadoImportacao> {
  const { pedidoId, loteId, lojaId, tipoImportacao, arquivoZip } = params;
  const alertas: string[] = [];
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  // 1) cria importação
  const { data: impData, error: impErr } = await (supabase as any)
    .from("fabrica_importacoes_tecnicas")
    .insert({
      pedido_id: pedidoId || null,
      lote_id: loteId || null,
      loja_id: lojaId || null,
      cliente_nome: params.clienteNome || null,
      projeto_nome: params.projetoNome || null,
      ambiente: params.ambiente || null,
      tipo_importacao: tipoImportacao,
      arquivo_original_nome: arquivoZip.name,
      status_importacao: "recebido",
      usuario_importacao: userId,
    })
    .select()
    .single();
  if (impErr || !impData) throw new Error(impErr?.message || "Falha ao criar importação");
  const importacaoId = impData.id as string;
  const basePath = `fabrica/${lojaId || "sem-loja"}/${pedidoId || loteId || "geral"}/${importacaoId}`;

  try {
    // 2) upload do ZIP original
    const zipPath = `${basePath}/original/${arquivoZip.name}`;
    const upZip = await supabase.storage.from(BUCKET).upload(zipPath, arquivoZip, { upsert: true });
    if (upZip.error) alertas.push(`Falha ao salvar ZIP original: ${upZip.error.message}`);
    await (supabase as any).from("fabrica_importacoes_tecnicas")
      .update({ status_importacao: "processando", arquivo_original_url: zipPath })
      .eq("id", importacaoId);

    // 3) extrair zip
    const zip = await JSZip.loadAsync(arquivoZip);
    const entries = Object.values(zip.files).filter((f) => !f.dir);

    const arquivosCriados: Record<string, string> = {}; // caminho -> arquivo_tecnico_id
    let listContent: string | null = null;
    let totalArquivos = 0;
    let totalArquivosTecnicos = 0;

    // First pass: upload + cadastrar arquivos
    for (const entry of entries) {
      const caminho = entry.name.replace(/\\/g, "/");
      const nome = caminho.split("/").pop() || caminho;
      const ext = (nome.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
      const origem = detectarOrigem(caminho);
      const tipo = detectarTipo(nome, origem);
      totalArquivos++;

      const blob = await entry.async("blob");
      const storagePath = `${basePath}/extracted/${caminho}`;
      const up = await supabase.storage.from(BUCKET).upload(storagePath, blob, { upsert: true });
      if (up.error) {
        alertas.push(`Falha upload ${caminho}: ${up.error.message}`);
      }

      const { data: arqIns, error: arqErr } = await (supabase as any)
        .from("fabrica_arquivos_tecnicos")
        .insert({
          importacao_id: importacaoId,
          pedido_id: pedidoId || null,
          lote_id: loteId || null,
          loja_id: lojaId || null,
          origem_pasta: origem,
          tipo_arquivo: tipo,
          nome_arquivo: nome,
          extensao: ext || null,
          caminho_relativo: caminho,
          url_arquivo: storagePath,
          tamanho_bytes: blob.size,
          criado_por: userId,
        })
        .select("id")
        .single();
      if (arqErr) {
        alertas.push(`Falha cadastro ${caminho}: ${arqErr.message}`);
        continue;
      }
      arquivosCriados[caminho] = arqIns.id;
      totalArquivosTecnicos++;

      if (tipo === "list") {
        try { listContent = await entry.async("string"); } catch { /* ignore */ }
      }
    }

    // 4) chapas a partir do List
    const chapasCriadas: Record<string, string> = {}; // numero -> chapa_id
    if (listContent) {
      const cycles = parseListXml(listContent);
      let ordemAuto = 0;
      for (const c of cycles) {
        ordemAuto++;
        const plateId = c["PlateID"] || c["__pos_0"] || "";
        const labelName = c["LabelName"] || c["__pos_1"] || "";
        const color = c["Color"] || null;
        const thickness = c["Thickness"] ? parseFloat(c["Thickness"]) : null;
        const semExt = (plateId || labelName).replace(/\.[a-z0-9]+$/i, "");
        const partes = semExt.split("_").filter(Boolean);
        const numero = partes[0] || String(ordemAuto);
        const material = partes[1] || null;

        const ncEntry = Object.keys(arquivosCriados).find((k) => k.toLowerCase().endsWith("/" + plateId.toLowerCase()) || k.toLowerCase().endsWith(plateId.toLowerCase()));
        const cycEntry = Object.keys(arquivosCriados).find((k) => k.toLowerCase().endsWith("/" + labelName.toLowerCase()) || k.toLowerCase().endsWith(labelName.toLowerCase()));
        const largeEntry = Object.keys(arquivosCriados).find((k) => /large.*preview.*cutting/i.test(k) && k.includes(numero));
        const smallEntry = Object.keys(arquivosCriados).find((k) => /small.*preview.*cutting/i.test(k) && k.includes(numero));

        const { data: chapaIns } = await (supabase as any)
          .from("fabrica_chapas_lote")
          .insert({
            importacao_id: importacaoId,
            pedido_id: pedidoId || null,
            lote_id: loteId || null,
            loja_id: lojaId || null,
            numero_chapa: numero,
            ordem_chapa: /^\d+$/.test(numero) ? parseInt(numero, 10) : ordemAuto,
            material,
            cor_linha: color,
            espessura: thickness,
            arquivo_nc_id: ncEntry ? arquivosCriados[ncEntry] : null,
            arquivo_cyc_id: cycEntry ? arquivosCriados[cycEntry] : null,
            preview_large_id: largeEntry ? arquivosCriados[largeEntry] : null,
            preview_small_id: smallEntry ? arquivosCriados[smallEntry] : null,
          })
          .select("id")
          .single();
        if (chapaIns) chapasCriadas[numero] = chapaIns.id;
      }
    }

    // 5) Complementar com .cyc do xml/ (caso não tenha List)
    for (const [caminho, arqId] of Object.entries(arquivosCriados)) {
      if (!/\.cyc$/i.test(caminho)) continue;
      const origem = detectarOrigem(caminho);
      if (origem !== "xml" && origem !== "NC") continue;
      const nome = caminho.split("/").pop()!;
      const parsed = parseNomeChapaCyc(nome);
      if (!parsed) continue;
      if (chapasCriadas[parsed.numero_chapa]) continue;
      const { data: chapaIns } = await (supabase as any)
        .from("fabrica_chapas_lote")
        .insert({
          importacao_id: importacaoId,
          pedido_id: pedidoId || null,
          lote_id: loteId || null,
          loja_id: lojaId || null,
          numero_chapa: parsed.numero_chapa,
          ordem_chapa: parsed.ordem_chapa,
          material: parsed.material,
          cor_linha: parsed.cor_linha,
          espessura: parsed.espessura,
          arquivo_cyc_id: arqId,
        })
        .select("id")
        .single();
      if (chapaIns) chapasCriadas[parsed.numero_chapa] = chapaIns.id;
    }

    // 6) Etiquetas
    const etiquetasCriadas = new Set<string>();
    let totalEtiq = 0;
    for (const [caminho, arqId] of Object.entries(arquivosCriados)) {
      const origem = detectarOrigem(caminho);
      const nome = caminho.split("/").pop()!;
      const ext = (nome.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
      const isEtiq = (origem === "AutoLabel") || (origem === "NC" && ext === "bmp");
      if (!isEtiq) continue;
      const parsed = parseNomeEtiqueta(nome);
      if (!parsed.referencia_peca || !parsed.codigo_peca) continue;
      const key = `${parsed.codigo_etiqueta_completo}|${ext}`;
      if (etiquetasCriadas.has(key)) continue;
      etiquetasCriadas.add(key);
      const { error: eErr } = await (supabase as any)
        .from("fabrica_etiquetas")
        .insert({
          importacao_id: importacaoId,
          pedido_id: pedidoId || null,
          lote_id: loteId || null,
          loja_id: lojaId || null,
          codigo_etiqueta_completo: parsed.codigo_etiqueta_completo,
          referencia_peca: parsed.referencia_peca,
          codigo_peca: parsed.codigo_peca,
          sufixo: parsed.sufixo,
          indice_duplicidade: parsed.indice_duplicidade,
          arquivo_etiqueta_id: arqId,
          arquivo_bmp_id: ext === "bmp" ? arqId : null,
          arquivo_pdf_id: ext === "pdf" ? arqId : null,
        });
      if (eErr) alertas.push(`Etiqueta ${nome}: ${eErr.message}`);
      else totalEtiq++;
    }

    // 7) totais
    const status: ResultadoImportacao["status"] = alertas.length ? "processado_com_alertas" : "processado";
    const mensagem = alertas.length ? alertas.slice(0, 5).join(" | ") : null;
    await (supabase as any).from("fabrica_importacoes_tecnicas")
      .update({
        status_importacao: status,
        total_arquivos: totalArquivos,
        total_chapas: Object.keys(chapasCriadas).length,
        total_etiquetas: totalEtiq,
        total_arquivos_tecnicos: totalArquivosTecnicos,
        mensagem_processamento: mensagem,
      })
      .eq("id", importacaoId);

    // 8) Atualiza status fábrica do pedido (sem quebrar legados)
    if (pedidoId && tipoImportacao === "individual") {
      await (supabase as any).from("pedidos")
        .update({ status_fabrica: "arquivos_importados" })
        .eq("id", pedidoId)
        .in("status_fabrica", ["liberado_para_lote", "aguardando_arquivos"]);
    }

    return {
      importacaoId,
      totalArquivos,
      totalChapas: Object.keys(chapasCriadas).length,
      totalEtiquetas: totalEtiq,
      totalArquivosTecnicos,
      alertas,
      status,
      mensagem: mensagem || undefined,
    };
  } catch (err: any) {
    await (supabase as any).from("fabrica_importacoes_tecnicas")
      .update({ status_importacao: "erro", mensagem_processamento: err?.message || String(err) })
      .eq("id", importacaoId);
    throw err;
  }
}

export async function getSignedUrlPacoteTecnico(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl || null;
}
