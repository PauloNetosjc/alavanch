/**
 * Parsers genéricos para importar ambientes/itens de XML ou Excel.
 * Estrutura de saída comum (compatível com a UI):
 *
 *   { environments: [{ name, items: [{ description, quantity, cost, clientPrice }] }] }
 *
 * - XML: aceita raízes "ambientes>ambiente>itens>item" OU "rooms>room>items>item".
 *   Atributos/tags reconhecidos por item: descricao|description|nome|name,
 *   quantidade|qty|quantity, custo|cost, valor|preco|price|client_price.
 *   O ambiente identifica-se por nome ou attr name/nome.
 *
 * - Excel: planilha com colunas (cabeçalho na 1ª linha):
 *   ambiente | item/descricao | quantidade | custo | valor
 *   Linhas com mesmo "ambiente" agrupam-se. Aceita também variações em inglês.
 */

import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";

export interface ParsedItem {
  description: string;
  quantity: number;
  cost: number;
  clientPrice: number;
}
export interface ParsedEnvironment {
  name: string;
  items: ParsedItem[];
  total: number;
}
export interface ParseResult {
  environments: ParsedEnvironment[];
  total: number;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

const pickFirst = <T,>(o: any, keys: string[]): T | undefined => {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
    const lk = k.toLowerCase();
    for (const ok of Object.keys(o ?? {})) {
      if (ok.toLowerCase() === lk && o[ok] !== "" && o[ok] !== null) return o[ok];
    }
  }
  return undefined;
};

function buildResult(envs: ParsedEnvironment[]): ParseResult {
  for (const e of envs) {
    e.total = e.items.reduce((s, i) => s + i.quantity * i.clientPrice, 0);
  }
  return { environments: envs, total: envs.reduce((s, e) => s + e.total, 0) };
}

export function parseProjetoXml(xml: string): ParseResult {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
  const json = parser.parse(xml);

  // Procura nós de ambiente recursivamente
  const envs: ParsedEnvironment[] = [];

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    for (const key of Object.keys(node)) {
      const lk = key.toLowerCase();
      const val = node[key];
      if (lk === "ambiente" || lk === "ambientes" || lk === "room" || lk === "rooms" || lk === "environment" || lk === "environments") {
        const arr = Array.isArray(val) ? val : [val];
        for (const a of arr) {
          if (!a || typeof a !== "object") continue;
          // recursar mais um nível se for "ambientes" agrupador
          if (lk === "ambientes" || lk === "rooms" || lk === "environments") {
            visit(a);
            continue;
          }
          const name = str(pickFirst(a, ["@_name", "@_nome", "nome", "name", "descricao", "description"])) || "Ambiente";
          const itemsContainer = pickFirst<any>(a, ["itens", "items"]) ?? a;
          const itensRaw = pickFirst<any>(itemsContainer, ["item"]) ?? [];
          const itensArr = Array.isArray(itensRaw) ? itensRaw : [itensRaw];
          const items: ParsedItem[] = itensArr
            .filter((i: any) => i && typeof i === "object")
            .map((i: any) => ({
              description: str(pickFirst(i, ["descricao", "description", "nome", "name", "@_descricao", "@_name"])) || "Item",
              quantity: num(pickFirst(i, ["quantidade", "qty", "quantity", "@_qty"])) || 1,
              cost: num(pickFirst(i, ["custo", "cost", "@_custo"])),
              clientPrice: num(pickFirst(i, ["valor", "preco", "price", "client_price", "@_valor"])),
            }));
          envs.push({ name, items, total: 0 });
        }
      } else if (val && typeof val === "object") {
        visit(val);
      }
    }
  };
  visit(json);

  if (envs.length === 0) throw new Error("XML não contém ambientes reconhecíveis");
  return buildResult(envs);
}

export async function parseProjetoExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Planilha vazia");
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

  if (rows.length === 0) throw new Error("Nenhuma linha encontrada");

  const map = new Map<string, ParsedEnvironment>();
  for (const r of rows) {
    const env = str(pickFirst(r, ["ambiente", "Ambiente", "AMBIENTE", "room", "Room", "environment"])) || "Ambiente";
    const desc = str(pickFirst(r, ["item", "Item", "descricao", "Descrição", "description", "nome", "Nome"]));
    if (!desc) continue;
    const it: ParsedItem = {
      description: desc,
      quantity: num(pickFirst(r, ["quantidade", "Quantidade", "qty", "Qty", "quantity"])) || 1,
      cost: num(pickFirst(r, ["custo", "Custo", "cost", "Cost"])),
      clientPrice: num(pickFirst(r, ["valor", "Valor", "preco", "Preço", "price", "Price"])),
    };
    if (!map.has(env)) map.set(env, { name: env, items: [], total: 0 });
    map.get(env)!.items.push(it);
  }

  const envs = Array.from(map.values());
  if (envs.length === 0) throw new Error("Nenhum item válido encontrado na planilha");
  return buildResult(envs);
}
