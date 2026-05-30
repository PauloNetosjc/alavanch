import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

/** Lê um arquivo XLSX/CSV e devolve linhas como objetos com chaves normalizadas (lowercase / sem espaço) */
export async function lerPlanilha(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sh = wb.Sheets[wb.SheetNames[0]];
  if (!sh) return [];
  const raw = XLSX.utils.sheet_to_json<any>(sh, { defval: "" });
  return raw.map((row) => {
    const out: Record<string, any> = {};
    for (const k of Object.keys(row)) {
      const nk = String(k).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
      out[nk] = row[k];
    }
    return out;
  });
}

function gerarCodigoBarras(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

export interface ResultadoImport {
  modulosCriados: number;
  pecasCriadas: number;
  itensAlmoxarifado: number;
  erros: string[];
}

/** Importa planilha de fabricação por módulo (cria fabrica_modulos + fabrica_pecas) */
export async function importarPlanilhaFabricacao(
  pedidoId: string,
  rows: Record<string, any>[],
): Promise<ResultadoImport> {
  const erros: string[] = [];
  let modulosCriados = 0;
  let pecasCriadas = 0;
  const mapaModulos = new Map<string, string>();

  for (const row of rows) {
    const codigo_modulo = String(row.codigo_modulo || row.codigo || "").trim();
    const codigo_peca = String(row.codigo_peca || row.peca || "").trim();
    if (!codigo_modulo || !codigo_peca) {
      erros.push(`Linha ignorada (sem codigo_modulo/codigo_peca): ${JSON.stringify(row)}`);
      continue;
    }

    let moduloId = mapaModulos.get(codigo_modulo);
    if (!moduloId) {
      // tenta achar existente
      const { data: ex } = await (supabase as any)
        .from("fabrica_modulos")
        .select("id")
        .eq("pedido_id", pedidoId)
        .eq("codigo_modulo", codigo_modulo)
        .maybeSingle();
      if (ex?.id) {
        moduloId = ex.id;
      } else {
        const { data: ins, error } = await (supabase as any)
          .from("fabrica_modulos")
          .insert({
            pedido_id: pedidoId,
            codigo_modulo,
            nome_modulo: row.nome_modulo || row.nome || codigo_modulo,
            ambiente: row.ambiente || null,
            descricao: row.descricao || null,
            status: "pendente",
          })
          .select("id")
          .single();
        if (error) {
          erros.push(`Erro ao criar módulo ${codigo_modulo}: ${error.message}`);
          continue;
        }
        moduloId = ins.id;
        modulosCriados++;
      }
      mapaModulos.set(codigo_modulo, moduloId!);
    }

    const qtd = Number(row.quantidade || row.qtd || 1) || 1;
    const { error: errPeca } = await (supabase as any).from("fabrica_pecas").insert({
      pedido_id: pedidoId,
      modulo_id: moduloId,
      codigo_peca,
      referencia: row.referencia || null,
      descricao: row.descricao || null,
      medida_largura: Number(row.medida_largura || row.largura) || null,
      medida_altura: Number(row.medida_altura || row.altura) || null,
      medida_profundidade: Number(row.medida_profundidade || row.profundidade) || null,
      medida_texto: row.medida_texto || row.medida || null,
      quantidade: qtd,
      unidade: row.unidade || "UN",
      codigo_barras: row.codigo_barras || gerarCodigoBarras("PC"),
      status: "aguardando_producao",
    });
    if (errPeca) {
      if (String(errPeca.message).toLowerCase().includes("duplicate")) {
        erros.push(`Peça duplicada ignorada: ${codigo_peca}`);
      } else {
        erros.push(`Erro peça ${codigo_peca}: ${errPeca.message}`);
      }
      continue;
    }
    pecasCriadas++;
  }

  return { modulosCriados, pecasCriadas, itensAlmoxarifado: 0, erros };
}

/** Importa planilha de almoxarifado */
export async function importarPlanilhaAlmoxarifado(
  pedidoId: string,
  rows: Record<string, any>[],
): Promise<ResultadoImport> {
  const erros: string[] = [];
  let itensAlmoxarifado = 0;

  for (const row of rows) {
    const referencia = String(row.referencia || row.ref || "").trim();
    if (!referencia) {
      erros.push(`Linha sem referência: ${JSON.stringify(row)}`);
      continue;
    }
    const qtd = Number(row.quantidade_necessaria || row.quantidade || row.qtd || 0) || 0;
    const { error } = await (supabase as any).from("fabrica_almoxarifado_itens").insert({
      pedido_id: pedidoId,
      referencia,
      descricao: row.descricao || null,
      quantidade_necessaria: qtd,
      unidade: row.unidade || "UN",
      codigo_barras: row.codigo_barras || gerarCodigoBarras("AL"),
      status: "pendente",
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("duplicate")) {
        erros.push(`Item já existe: ${referencia}`);
      } else {
        erros.push(`Erro item ${referencia}: ${error.message}`);
      }
      continue;
    }
    itensAlmoxarifado++;
  }

  return { modulosCriados: 0, pecasCriadas: 0, itensAlmoxarifado, erros };
}
