import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "fabrica-pacotes-tecnicos";
const MAX_FILE_MB = 200; // limite máximo do ZIP
const UPLOAD_CONCURRENCY = 6;
const INSERT_BATCH = 100;

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

export interface ProgressoEvento {
  etapa: string;
  detalhe?: string;
  atual?: number;
  total?: number;
}

interface ParseEtiqueta {
  codigo_etiqueta_completo: string;
  referencia_peca: string | null;
  codigo_peca: string | null;
  sufixo: string | null;
  indice_duplicidade: number | null;
}

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
  /** "rapida" (padrão) sobe apenas essenciais; "completa" sobe tudo */
  modoImportacao?: "rapida" | "completa";
  onProgress?: (ev: ProgressoEvento) => void;
}


function ehArquivoIgnorado(caminho: string): boolean {
  const lower = caminho.toLowerCase();
  if (lower.includes("__macosx")) return true;
  if (lower.endsWith("/.ds_store") || lower.endsWith(".ds_store")) return true;
  if (lower.endsWith("/thumbs.db") || lower.endsWith("thumbs.db")) return true;
  if (lower.endsWith("/desktop.ini")) return true;
  if (caminho.split("/").pop()?.startsWith(".")) return true;
  return false;
}

/** Decide se o arquivo é essencial para a primeira importação rápida. */
function ehArquivoEssencial(origem: OrigemPasta, tipo: TipoArquivo, ext: string): boolean {
  // Raiz: List + PDFs principais
  if (tipo === "list" || tipo === "lista_corte_pdf" || tipo === "preview_corte_pdf" || tipo === "relatorio_almoxarifado_pdf") return true;
  // AutoLabel: previews grandes/pequenos + Labels PDF (não os BMPs individuais)
  if (tipo === "large_preview_cutting_plan" || tipo === "small_preview_cutting_plan" || tipo === "labels_pdf") return true;
  // .cyc em xml/ ou NC/ são essenciais (poucos e leves)
  if (tipo === "cyc_chapa") return true;
  // NC de chapa: subir (uma por chapa, leve)
  if (origem === "NC" && ext === "nc") return true;
  // Tudo o mais (etiquetas individuais BMP, Parts, Profile, nc_peca, etc.) fica catalogado
  return false;
}

function tamanhoEntrada(entry: any): number | null {
  try {
    return entry?._data?.uncompressedSize ?? null;
  } catch { return null; }
}


/** Processa entradas em paralelo controlado. */
async function processarEmLotes<T, R>(items: T[], concurrency: number, fn: (it: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = e as any;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export async function importarPacoteTecnico(params: ImportarParams): Promise<ResultadoImportacao> {
  const { pedidoId, loteId, lojaId, tipoImportacao, arquivoZip, onProgress } = params;
  const alertas: string[] = [];
  const log = (etapa: string, detalhe?: string, atual?: number, total?: number) => {
    console.log(`[importacaoTecnica] ${etapa}${detalhe ? ` - ${detalhe}` : ""}${atual != null && total != null ? ` (${atual}/${total})` : ""}`);
    try { onProgress?.({ etapa, detalhe, atual, total }); } catch { /* ignore */ }
  };

  // Validação básica
  if (!arquivoZip) throw new Error("Nenhum arquivo selecionado");
  if (!/\.zip$/i.test(arquivoZip.name)) throw new Error("Arquivo deve ser .zip");
  const tamMb = arquivoZip.size / 1024 / 1024;
  if (tamMb > MAX_FILE_MB) {
    throw new Error(`Arquivo muito grande (${tamMb.toFixed(1)}MB). Limite: ${MAX_FILE_MB}MB.`);
  }

  log("validacao", `${arquivoZip.name} - ${tamMb.toFixed(2)}MB`);

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  // 1) cria importação
  log("criando_importacao");
  const modoImportacao: "rapida" | "completa" = params.modoImportacao || "rapida";
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
      modo_importacao: modoImportacao,
      usuario_importacao: userId,
    })
    .select()
    .maybeSingle();
  if (impErr || !impData) throw new Error(impErr?.message || "Falha ao criar registro de importação. Verifique permissões.");
  const importacaoId = impData.id as string;
  const basePath = `fabrica/${lojaId || "sem-loja"}/${pedidoId || loteId || "geral"}/${importacaoId}`;

  // dali pra frente, qualquer erro vai marcar a importacao como erro
  async function marcarErro(msg: string) {
    try {
      await (supabase as any).from("fabrica_importacoes_tecnicas")
        .update({ status_importacao: "erro", mensagem_processamento: msg })
        .eq("id", importacaoId);
    } catch { /* ignore */ }
  }


  try {
    // 2) upload do ZIP original
    log("enviando_zip_original");
    const zipPath = `${basePath}/original/${arquivoZip.name}`;
    const upZip = await supabase.storage.from(BUCKET).upload(zipPath, arquivoZip, { upsert: true, contentType: "application/zip" });
    if (upZip.error) {
      alertas.push(`Falha ao salvar ZIP original: ${upZip.error.message}`);
      log("zip_original_falhou", upZip.error.message);
    } else {
      log("zip_original_enviado");
    }
    await (supabase as any).from("fabrica_importacoes_tecnicas")
      .update({ status_importacao: "processando", arquivo_original_url: upZip.error ? null : zipPath })
      .eq("id", importacaoId);

    // 3) extrair zip
    log("extraindo_zip");
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(arquivoZip);
    } catch (e: any) {
      throw new Error(`Não foi possível ler o arquivo ZIP: ${e?.message || e}`);
    }
    const allEntries = Object.values(zip.files).filter((f) => !f.dir && !ehArquivoIgnorado(f.name));
    log("zip_extraido", `${allEntries.length} arquivo(s)`);

    const totalArquivos = allEntries.length;
    if (totalArquivos === 0) {
      alertas.push("ZIP não contém arquivos processáveis.");
    }

    // 4) Classifica essenciais vs secundários
    type Classificado = {
      entry: any;
      caminho: string;
      nome: string;
      ext: string;
      origem: OrigemPasta;
      tipo: TipoArquivo;
      essencial: boolean;
    };
    const classificados: Classificado[] = allEntries.map((entry) => {
      const caminho = entry.name.replace(/\\/g, "/");
      const nome = caminho.split("/").pop() || caminho;
      const ext = (nome.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
      const origem = detectarOrigem(caminho);
      const tipo = detectarTipo(nome, origem);
      const forcarTudo = modoImportacao === "completa";
      const essencial = forcarTudo ? true : ehArquivoEssencial(origem, tipo, ext);
      return { entry, caminho, nome, ext, origem, tipo, essencial };
    });

    const essenciais = classificados.filter((c) => c.essencial);
    const secundarios = classificados.filter((c) => !c.essencial);

    log("classificacao", `${essenciais.length} essenciais / ${secundarios.length} catalogados`, essenciais.length, totalArquivos);

    // 4a) Upload paralelo dos ESSENCIAIS
    let listContent: string | null = null;
    let uploadsConcluidos = 0;
    const essenciaisParaInserir: any[] = [];
    log("enviando_arquivos", "essenciais", 0, essenciais.length);

    await processarEmLotes(essenciais, UPLOAD_CONCURRENCY, async (c) => {
      try {
        const blob = await c.entry.async("blob");
        const storagePath = `${basePath}/extracted/${c.caminho}`;
        const up = await supabase.storage.from(BUCKET).upload(storagePath, blob, { upsert: true });
        if (up.error) {
          alertas.push(`Falha upload ${c.caminho}: ${up.error.message}`);
          essenciaisParaInserir.push({
            importacao_id: importacaoId,
            pedido_id: pedidoId || null,
            lote_id: loteId || null,
            loja_id: lojaId || null,
            origem_pasta: c.origem,
            tipo_arquivo: c.tipo,
            nome_arquivo: c.nome,
            extensao: c.ext || null,
            caminho_relativo: c.caminho,
            url_arquivo: null,
            tamanho_bytes: blob.size,
            status_arquivo: "erro_upload",
            criado_por: userId,
            _caminho_key: c.caminho,
          });
          return;
        }
        essenciaisParaInserir.push({
          importacao_id: importacaoId,
          pedido_id: pedidoId || null,
          lote_id: loteId || null,
          loja_id: lojaId || null,
          origem_pasta: c.origem,
          tipo_arquivo: c.tipo,
          nome_arquivo: c.nome,
          extensao: c.ext || null,
          caminho_relativo: c.caminho,
          url_arquivo: storagePath,
          tamanho_bytes: blob.size,
          status_arquivo: "enviado",
          criado_por: userId,
          _caminho_key: c.caminho,
        });
        if (c.tipo === "list") {
          try { listContent = await c.entry.async("string"); } catch { /* ignore */ }
        }
      } catch (e: any) {
        alertas.push(`Erro ao processar ${c.caminho}: ${e?.message || e}`);
      } finally {
        uploadsConcluidos++;
        if (uploadsConcluidos % 5 === 0 || uploadsConcluidos === essenciais.length) {
          log("enviando_arquivos", "essenciais", uploadsConcluidos, essenciais.length);
        }
      }
    });

    // 4b) Catalogar SECUNDÁRIOS (sem blob, sem upload)
    const secundariosParaInserir = secundarios.map((c) => ({
      importacao_id: importacaoId,
      pedido_id: pedidoId || null,
      lote_id: loteId || null,
      loja_id: lojaId || null,
      origem_pasta: c.origem,
      tipo_arquivo: c.tipo,
      nome_arquivo: c.nome,
      extensao: c.ext || null,
      caminho_relativo: c.caminho,
      url_arquivo: null,
      tamanho_bytes: tamanhoEntrada(c.entry),
      status_arquivo: "catalogado_nao_enviado" as const,
      criado_por: userId,
      _caminho_key: c.caminho,
    }));
    if (secundariosParaInserir.length) {
      log("catalogando_secundarios", undefined, 0, secundariosParaInserir.length);
    }

    // 5) Inserir arquivos em batch (essenciais + secundários)
    const arquivosParaInserir = [...essenciaisParaInserir, ...secundariosParaInserir];
    log("catalogando_arquivos", undefined, 0, arquivosParaInserir.length);
    const arquivosCriados: Record<string, string> = {};
    let totalArquivosTecnicos = 0;
    for (let i = 0; i < arquivosParaInserir.length; i += INSERT_BATCH) {
      const slice = arquivosParaInserir.slice(i, i + INSERT_BATCH);
      const payload = slice.map(({ _caminho_key, ...rest }) => rest);
      const { data: ins, error: insErr } = await (supabase as any)
        .from("fabrica_arquivos_tecnicos")
        .insert(payload)
        .select("id, caminho_relativo");
      if (insErr) {
        alertas.push(`Falha ao catalogar lote (${i}-${i + slice.length}): ${insErr.message}`);
        continue;
      }
      (ins as any[] || []).forEach((row) => { arquivosCriados[row.caminho_relativo] = row.id; });
      totalArquivosTecnicos += (ins as any[] || []).length;
      log("catalogando_arquivos", undefined, Math.min(i + INSERT_BATCH, arquivosParaInserir.length), arquivosParaInserir.length);
    }


    // 6) chapas a partir do List
    log("processando_list");
    const chapasCriadas: Record<string, string> = {};
    if (listContent) {
      try {
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

          const { data: chapaIns, error: chErr } = await (supabase as any)
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
            .maybeSingle();
          if (chErr) alertas.push(`Chapa ${numero}: ${chErr.message}`);
          else if (chapaIns) chapasCriadas[numero] = chapaIns.id;
        }
      } catch (e: any) {
        alertas.push(`Erro ao processar List: ${e?.message || e}`);
      }
    } else {
      alertas.push("Arquivo List não encontrado no ZIP.");
    }

    // 7) Complementar com .cyc do xml/ (caso não tenha List ou faltem chapas)
    log("criando_chapas_complementares");
    for (const [caminho, arqId] of Object.entries(arquivosCriados)) {
      if (!/\.cyc$/i.test(caminho)) continue;
      const origem = detectarOrigem(caminho);
      if (origem !== "xml" && origem !== "NC") continue;
      const nome = caminho.split("/").pop()!;
      const parsed = parseNomeChapaCyc(nome);
      if (!parsed) continue;
      if (chapasCriadas[parsed.numero_chapa]) continue;
      const { data: chapaIns, error: chErr } = await (supabase as any)
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
        .maybeSingle();
      if (chErr) alertas.push(`Chapa ${parsed.numero_chapa}: ${chErr.message}`);
      else if (chapaIns) chapasCriadas[parsed.numero_chapa] = chapaIns.id;
    }

    // 8) Etiquetas em batch
    log("criando_etiquetas");
    const etiquetasUnicas = new Map<string, any>();
    for (const [caminho, arqId] of Object.entries(arquivosCriados)) {
      const origem = detectarOrigem(caminho);
      const nome = caminho.split("/").pop()!;
      const ext = (nome.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
      const isEtiq = (origem === "AutoLabel") || (origem === "NC" && ext === "bmp");
      if (!isEtiq) continue;
      const parsed = parseNomeEtiqueta(nome);
      if (!parsed.referencia_peca || !parsed.codigo_peca) continue;
      const key = `${parsed.codigo_etiqueta_completo}|${ext}`;
      if (etiquetasUnicas.has(key)) continue;
      etiquetasUnicas.set(key, {
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
    }
    const etiquetasArr = Array.from(etiquetasUnicas.values());
    let totalEtiq = 0;
    for (let i = 0; i < etiquetasArr.length; i += INSERT_BATCH) {
      const slice = etiquetasArr.slice(i, i + INSERT_BATCH);
      const { data: ins, error: eErr } = await (supabase as any)
        .from("fabrica_etiquetas")
        .insert(slice)
        .select("id");
      if (eErr) {
        alertas.push(`Etiquetas lote (${i}): ${eErr.message}`);
        continue;
      }
      totalEtiq += (ins as any[] || []).length;
    }

    // 9) totais finais
    const status: ResultadoImportacao["status"] = alertas.length ? "processado_com_alertas" : "processado";
    const mensagem = alertas.length ? alertas.slice(0, 5).join(" | ") : null;
    log("finalizando", `${totalArquivos} arquivos, ${Object.keys(chapasCriadas).length} chapas, ${totalEtiq} etiquetas`);

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

    if (pedidoId && tipoImportacao === "individual") {
      try {
        await (supabase as any).from("pedidos")
          .update({ status_fabrica: "arquivos_importados" })
          .eq("id", pedidoId)
          .in("status_fabrica", ["liberado_para_lote", "aguardando_arquivos"]);
      } catch { /* não bloquear conclusão */ }
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
    const msg = err?.message || String(err);
    console.error("[importacaoTecnica] ERRO:", err);
    await marcarErro(msg);
    throw new Error(msg);
  }
}

export async function getSignedUrlPacoteTecnico(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  try {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

/**
 * Processa um arquivo catalogado sob demanda:
 * Baixa o ZIP original da importação, extrai a entrada específica,
 * faz upload individual e marca status_arquivo = 'enviado'.
 * Retorna a URL (path no storage) ou null se não conseguiu.
 */
export async function processarArquivoSobDemanda(arquivoId: string): Promise<string | null> {
  const { data: arq, error: arqErr } = await (supabase as any)
    .from("fabrica_arquivos_tecnicos")
    .select("id, importacao_id, caminho_relativo, status_arquivo, url_arquivo, loja_id, pedido_id, lote_id")
    .eq("id", arquivoId)
    .maybeSingle();
  if (arqErr || !arq) throw new Error("Arquivo não encontrado");
  if (arq.status_arquivo === "enviado" && arq.url_arquivo) return arq.url_arquivo;

  const { data: imp, error: impErr } = await (supabase as any)
    .from("fabrica_importacoes_tecnicas")
    .select("id, arquivo_original_url, loja_id, pedido_id, lote_id")
    .eq("id", arq.importacao_id)
    .maybeSingle();
  if (impErr || !imp) throw new Error("Importação não encontrada");
  if (!imp.arquivo_original_url) {
    throw new Error("ZIP original não disponível para extração sob demanda");
  }

  // baixa o ZIP do storage
  const { data: zipBlob, error: dlErr } = await supabase.storage.from(BUCKET).download(imp.arquivo_original_url);
  if (dlErr || !zipBlob) throw new Error(`Falha ao baixar ZIP original: ${dlErr?.message || "sem dados"}`);

  const zip = await JSZip.loadAsync(zipBlob);
  // tenta tanto caminho exato quanto invertido
  const entry = zip.file(arq.caminho_relativo) ||
    Object.values(zip.files).find((f) => f.name.replace(/\\/g, "/") === arq.caminho_relativo);
  if (!entry || (entry as any).dir) throw new Error(`Arquivo ${arq.caminho_relativo} não encontrado no ZIP original`);

  const lojaId = imp.loja_id || arq.loja_id;
  const ref = imp.pedido_id || arq.pedido_id || imp.lote_id || arq.lote_id || "geral";
  const basePath = `fabrica/${lojaId || "sem-loja"}/${ref}/${imp.id}`;
  const storagePath = `${basePath}/extracted/${arq.caminho_relativo}`;
  const blob = await entry.async("blob");
  const up = await supabase.storage.from(BUCKET).upload(storagePath, blob, { upsert: true });
  if (up.error) {
    await (supabase as any).from("fabrica_arquivos_tecnicos")
      .update({ status_arquivo: "erro_upload" })
      .eq("id", arquivoId);
    throw new Error(`Falha upload sob demanda: ${up.error.message}`);
  }
  await (supabase as any).from("fabrica_arquivos_tecnicos")
    .update({ status_arquivo: "enviado", url_arquivo: storagePath, tamanho_bytes: blob.size })
    .eq("id", arquivoId);
  return storagePath;
}

