import { supabase } from "@/integrations/supabase/client";

const BUCKET = "fabrica-pacotes-tecnicos";

export type TipoItem = "peca_real" | "sobra" | "retalho" | "desconhecido";
export type StatusItem = "importado" | "vinculado" | "divergente" | "ignorado";

export interface PecaPlanoCorte {
  indice_peca: number | null;
  codigo_peca: string | null;
  referencia_peca: string | null;
  descricao: string | null;
  largura: number | null;
  altura: number | null;
  espessura: number | null;
  posicao_x: number | null;
  posicao_y: number | null;
  rotacao: number | null;
  tipo_item: TipoItem;
  material: string | null;
  cor_linha: string | null;
  modulo_pai: string | null;
  ambiente: string | null;
  dados_origem: any;
}

export interface ResultadoPlanoCorte {
  importacaoId: string;
  totalChapasProcessadas: number;
  totalPecasCriadas: number;
  totalVinculadas: number;
  totalSemPosicao: number;
  totalSobras: number;
  totalDivergentes: number;
  alertas: string[];
}

/** Parses an index value like "12", "(3)" or "L08". */
export function parseIndicePeca(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : n;
}

/** Parses dimensions like "450,5", "450.5", "450 mm". */
export function parseMedidaPeca(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/mm/gi, "").trim();
  s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Normalizes plate dimensions, defaulting to 2750 x 1850. */
export function normalizarMedidasChapa(largura: any, altura: any) {
  const w = parseMedidaPeca(largura) ?? 2750;
  const h = parseMedidaPeca(altura) ?? 1850;
  return { largura: w, altura: h };
}

/**
 * Conservative extractor that tries to find <Piece> / <Part> XML-like nodes
 * and key=value attributes inside a .cyc / config text file.
 * Returns an empty array if nothing recognizable was found.
 */
export function tentarExtrairPlanoDeCorteDeArquivo(
  texto: string,
  contexto: { material?: string | null; cor_linha?: string | null; espessura?: number | null }
): PecaPlanoCorte[] {
  const pecas: PecaPlanoCorte[] = [];
  if (!texto || typeof texto !== "string") return pecas;

  // Pattern 1: XML <Piece ... /> or <Part .../>
  const re = /<\s*(Piece|Part)\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = re.exec(texto)) !== null) {
    idx++;
    const attrs = parseAttrs(match[2]);
    const x = parseMedidaPeca(attrs.X ?? attrs.x ?? attrs.PosX ?? attrs.posx ?? attrs.PositionX);
    const y = parseMedidaPeca(attrs.Y ?? attrs.y ?? attrs.PosY ?? attrs.posy ?? attrs.PositionY);
    const w = parseMedidaPeca(attrs.L ?? attrs.W ?? attrs.Width ?? attrs.Largura ?? attrs.Length);
    const h = parseMedidaPeca(attrs.H ?? attrs.Height ?? attrs.Altura);
    const rot = parseMedidaPeca(attrs.Rotation ?? attrs.Angle ?? attrs.Rotacao);
    const codigo = (attrs.Code ?? attrs.Codigo ?? attrs.Id ?? attrs.PieceID ?? attrs.Reference ?? null) as string | null;
    const desc = (attrs.Description ?? attrs.Descricao ?? attrs.Name ?? null) as string | null;
    const referencia = (attrs.Reference ?? attrs.Ref ?? null) as string | null;
    if (!x && !y && !w && !h && !codigo) continue;
    pecas.push({
      indice_peca: parseIndicePeca(attrs.Index ?? attrs.Indice ?? idx),
      codigo_peca: codigo ? String(codigo) : null,
      referencia_peca: referencia ? String(referencia) : null,
      descricao: desc ? String(desc) : null,
      largura: w,
      altura: h,
      espessura: contexto.espessura ?? null,
      posicao_x: x,
      posicao_y: y,
      rotacao: rot ?? 0,
      tipo_item: "peca_real",
      material: contexto.material ?? null,
      cor_linha: contexto.cor_linha ?? null,
      modulo_pai: null,
      ambiente: null,
      dados_origem: { fonte: "cyc_xml", attrs },
    });
  }

  return pecas;
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out[m[1]] = m[2];
  return out;
}

interface ChapaCtx {
  id: string;
  material: string | null;
  cor_linha: string | null;
  espessura: number | null;
  arquivo_cyc_id: string | null;
}

interface ArqCtx {
  id: string;
  url_arquivo: string | null;
  caminho_relativo: string | null;
  tipo_arquivo: string;
  chapa_id: string | null;
  dados_extraidos: any;
}

interface EtiquetaCtx {
  id: string;
  codigo_etiqueta_completo: string | null;
  referencia_peca: string | null;
  codigo_peca: string | null;
  chapa_id: string | null;
}

/** Links a piece with an etiqueta based on codes / reference. */
export function vincularPlanoComEtiquetas(
  peca: PecaPlanoCorte,
  etiquetas: EtiquetaCtx[],
  chapaId: string
): { etiqueta_id: string | null; status_item: StatusItem } {
  if (!peca.codigo_peca && !peca.referencia_peca) {
    return { etiqueta_id: null, status_item: "importado" };
  }
  const candidatas = etiquetas.filter((e) => {
    if (e.chapa_id && e.chapa_id !== chapaId) return false;
    const matchCodigo = peca.codigo_peca && e.codigo_peca && peca.codigo_peca === e.codigo_peca;
    const matchRef = peca.referencia_peca && e.referencia_peca && peca.referencia_peca === e.referencia_peca;
    const matchFull = peca.codigo_peca && e.codigo_etiqueta_completo && e.codigo_etiqueta_completo.includes(peca.codigo_peca);
    return matchCodigo || matchRef || matchFull;
  });
  if (candidatas.length === 0) return { etiqueta_id: null, status_item: "importado" };
  if (candidatas.length === 1) return { etiqueta_id: candidatas[0].id, status_item: "vinculado" };
  // Multiple matches → divergente, mas usa o primeiro como referência
  return { etiqueta_id: candidatas[0].id, status_item: "divergente" };
}

async function lerArquivoTexto(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
    if (error || !data) return null;
    return await data.text();
  } catch {
    return null;
  }
}

/** Processes an importacao_tecnica: extracts vector data and writes fabrica_plano_corte_pecas. */
export async function processarPlanoCorteVetorial(importacaoId: string): Promise<ResultadoPlanoCorte> {
  const resultado: ResultadoPlanoCorte = {
    importacaoId,
    totalChapasProcessadas: 0,
    totalPecasCriadas: 0,
    totalVinculadas: 0,
    totalSemPosicao: 0,
    totalSobras: 0,
    totalDivergentes: 0,
    alertas: [],
  };

  const [{ data: imp }, { data: chapas }, { data: arquivos }, { data: etiquetas }] = await Promise.all([
    (supabase as any).from("fabrica_importacoes_tecnicas").select("*").eq("id", importacaoId).maybeSingle(),
    (supabase as any).from("fabrica_chapas_lote").select("*").eq("importacao_id", importacaoId),
    (supabase as any).from("fabrica_arquivos_tecnicos").select("id, url_arquivo, caminho_relativo, tipo_arquivo, chapa_id, dados_extraidos").eq("importacao_id", importacaoId),
    (supabase as any).from("fabrica_etiquetas").select("id, codigo_etiqueta_completo, referencia_peca, codigo_peca, chapa_id").eq("importacao_id", importacaoId),
  ]);

  if (!imp) {
    resultado.alertas.push("Importação não encontrada");
    return resultado;
  }
  const pedidoId = imp.pedido_id || null;
  const loteId = imp.lote_id || null;
  const lojaId = imp.loja_id || null;

  const chapasArr: ChapaCtx[] = (chapas as any[]) || [];
  const arquivosArr: ArqCtx[] = (arquivos as any[]) || [];
  const etiqArr: EtiquetaCtx[] = (etiquetas as any[]) || [];

  // Limpa registros anteriores desta importacao (re-processamento idempotente)
  await (supabase as any).from("fabrica_plano_corte_pecas").delete().eq("importacao_id", importacaoId);

  for (const chapa of chapasArr) {
    resultado.totalChapasProcessadas++;

    // Coleta arquivos relevantes da chapa
    const cycArq = chapa.arquivo_cyc_id
      ? arquivosArr.find((a) => a.id === chapa.arquivo_cyc_id) || null
      : arquivosArr.find((a) => a.chapa_id === chapa.id && a.tipo_arquivo === "cyc_chapa") || null;

    let pecasExtraidas: PecaPlanoCorte[] = [];
    let fonte = "indisponivel";

    if (cycArq?.url_arquivo) {
      const texto = await lerArquivoTexto(cycArq.url_arquivo);
      if (texto) {
        pecasExtraidas = tentarExtrairPlanoDeCorteDeArquivo(texto, {
          material: chapa.material,
          cor_linha: chapa.cor_linha,
          espessura: chapa.espessura,
        });
        if (pecasExtraidas.length > 0) fonte = "cyc";
      }
    }

    // Fallback: usa dados_extraidos do arquivo NC se existir array de pecas
    if (pecasExtraidas.length === 0 && cycArq?.dados_extraidos?.pecas && Array.isArray(cycArq.dados_extraidos.pecas)) {
      pecasExtraidas = cycArq.dados_extraidos.pecas.map((p: any, i: number) => ({
        indice_peca: parseIndicePeca(p.indice ?? i + 1),
        codigo_peca: p.codigo ?? null,
        referencia_peca: p.referencia ?? null,
        descricao: p.descricao ?? null,
        largura: parseMedidaPeca(p.largura),
        altura: parseMedidaPeca(p.altura),
        espessura: chapa.espessura,
        posicao_x: parseMedidaPeca(p.x),
        posicao_y: parseMedidaPeca(p.y),
        rotacao: parseMedidaPeca(p.rotacao) ?? 0,
        tipo_item: "peca_real",
        material: chapa.material,
        cor_linha: chapa.cor_linha,
        modulo_pai: p.modulo ?? null,
        ambiente: p.ambiente ?? null,
        dados_origem: { fonte: "dados_extraidos", raw: p },
      }));
      fonte = "dados_extraidos";
    }

    // Fallback final: a partir das etiquetas vinculadas à chapa
    if (pecasExtraidas.length === 0) {
      const etiqsDaChapa = etiqArr.filter((e) => e.chapa_id === chapa.id);
      if (etiqsDaChapa.length > 0) {
        pecasExtraidas = etiqsDaChapa.map((e, i) => ({
          indice_peca: i + 1,
          codigo_peca: e.codigo_peca,
          referencia_peca: e.referencia_peca,
          descricao: e.codigo_etiqueta_completo,
          largura: null,
          altura: null,
          espessura: chapa.espessura,
          posicao_x: null,
          posicao_y: null,
          rotacao: 0,
          tipo_item: "peca_real",
          material: chapa.material,
          cor_linha: chapa.cor_linha,
          modulo_pai: null,
          ambiente: null,
          dados_origem: { fonte: "etiqueta", etiqueta_id: e.id },
        }));
        fonte = "etiquetas";
      }
    }

    if (pecasExtraidas.length === 0) {
      resultado.alertas.push(`Chapa ${chapa.numero_chapa || chapa.id.slice(0, 6)}: sem dados vetoriais extraíveis (${fonte}).`);
      continue;
    }

    // Insere em batch
    const rows = pecasExtraidas.map((p) => {
      const link = vincularPlanoComEtiquetas(p, etiqArr, chapa.id);
      if (link.status_item === "vinculado") resultado.totalVinculadas++;
      if (link.status_item === "divergente") resultado.totalDivergentes++;
      if (p.posicao_x == null || p.posicao_y == null) resultado.totalSemPosicao++;
      if (p.tipo_item === "sobra" || p.tipo_item === "retalho") resultado.totalSobras++;
      return {
        importacao_id: importacaoId,
        pedido_id: pedidoId,
        lote_id: loteId,
        loja_id: lojaId,
        chapa_id: chapa.id,
        etiqueta_id: link.etiqueta_id,
        indice_peca: p.indice_peca,
        codigo_peca: p.codigo_peca,
        referencia_peca: p.referencia_peca,
        descricao: p.descricao,
        largura: p.largura,
        altura: p.altura,
        espessura: p.espessura,
        posicao_x: p.posicao_x,
        posicao_y: p.posicao_y,
        rotacao: p.rotacao ?? 0,
        tipo_item: p.tipo_item,
        material: p.material,
        cor_linha: p.cor_linha,
        modulo_pai: p.modulo_pai,
        ambiente: p.ambiente,
        status_item: link.status_item,
        dados_origem: p.dados_origem,
      };
    });

    const { error: insErr } = await (supabase as any).from("fabrica_plano_corte_pecas").insert(rows);
    if (insErr) {
      resultado.alertas.push(`Chapa ${chapa.numero_chapa}: ${insErr.message}`);
      continue;
    }
    resultado.totalPecasCriadas += rows.length;
  }

  return resultado;
}
