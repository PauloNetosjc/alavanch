/**
 * Parser robusto para arquivos TXT exportados do Promob.
 * Tolerante a campos vazios e espaçamento variável.
 * Formato: colunas separadas por 2+ espaços, ambiente embutido
 * na linha do item como "Projeto - AMBIENTE - CLIENTE".
 */

export interface PromobHeader {
  projectId: string;
  promobVersion: string;
  system: string;
  storeName: string;
  clientName: string;
  address: string;
  neighborhood: string;
  phone: string;
  cpf: string;
  deliveryAddress: string;
}

export interface PromobItem {
  index: number;
  quantity: number;
  description: string;
  width: number | null;
  height: number | null;
  depth: number | null;
  cost: number;
  costB: number;
  costC: number;
  /** Preço final (vai para o orçamento) - 4ª coluna numérica */
  finalPrice: number;
  /** Preço de fábrica (custo gerencial) - 5ª coluna numérica */
  factoryPrice: number;
  /** Custo extra (ex.: montagem/material) - 6ª coluna numérica, quando presente */
  extraCost: number;
  category: string;
  finish: string;
  projectRef: string;
  rawLine: string;
}

export interface PromobEnvironment {
  name: string;
  clientName: string;
  items: PromobItem[];
  total: number;
}

export interface PromobParseResult {
  header: PromobHeader;
  environments: PromobEnvironment[];
  rawContent: string;
  fileTotal: number;
  calculatedTotal: number;
  hasDivergence: boolean;
  divergenceAmount: number;
  warnings: string[];
}

function extractHeaderField(lines: string[], field: string): string {
  for (const line of lines) {
    const regex = new RegExp(`^\\s*${field}\\s*=\\s*(.*)$`, 'i');
    const match = line.match(regex);
    if (match) return match[1].trim();
  }
  return '';
}

function parseNum(str: string): number {
  if (!str || !str.trim()) return 0;
  const n = parseFloat(str.trim());
  return isNaN(n) ? 0 : n;
}

function parseDim(str: string): number | null {
  const n = parseNum(str);
  return n === 0 ? null : n;
}

function isNumeric(s: string): boolean {
  return /^\d+(\.\d+)?$/.test(s.trim());
}

/**
 * Parse a single item line.
 * Strategy: split by 2+ spaces, find "Projeto -" anchor,
 * then map surrounding parts.
 */
function parseItemLine(line: string): { item: PromobItem; envName: string; envClient: string } | null {
  if (!line.trim()) return null;

  const parts = line.split(/\t+|\s{2,}/).filter(p => p.trim());
  if (parts.length < 5) return null;

  const indexNum = parseInt(parts[0]);
  if (isNaN(indexNum)) return null;

  const quantity = parseInt(parts[1]) || 1;

  // Find the part containing "Projeto -"
  let projetoIdx = -1;
  for (let i = 3; i < parts.length; i++) {
    if (/Projeto\s*[-–]/i.test(parts[i])) {
      projetoIdx = i;
      break;
    }
  }

  let envName = 'Ambiente Geral';
  let envClient = '';
  let projectRef = '';
  let category = '';
  let finish = '';

  // Slice between description area and Projeto anchor.
  // Some Promob exports separate columns by single spaces inside a "part",
  // so we re-tokenize the middle slice by ANY whitespace and split numeric
  // from non-numeric tokens.
  const numEnd = projetoIdx > 0 ? projetoIdx : parts.length;
  const middleRaw = parts.slice(2, numEnd).join(' ');
  const tokens = middleRaw.split(/\s+/).filter(Boolean);

  // Layout Promob: <descrição com palavras>  L  A  P  PREÇO_FINAL  PREÇO_FÁBRICA  [CUSTO_EXTRA]
  // Estratégia: pegar os ÚLTIMOS 5 ou 6 tokens numéricos como dimensões+preços,
  // e tudo antes vira descrição.
  let lastNumericIdx = tokens.length - 1;
  while (lastNumericIdx >= 0 && !isNumeric(tokens[lastNumericIdx])) lastNumericIdx--;

  // Conta quantos números consecutivos no fim
  let firstNumericIdx = lastNumericIdx;
  while (firstNumericIdx > 0 && isNumeric(tokens[firstNumericIdx - 1])) firstNumericIdx--;

  const numericTail = tokens.slice(firstNumericIdx, lastNumericIdx + 1);
  const description = tokens.slice(0, firstNumericIdx).join(' ').trim();

  // Esperamos 5 (L,A,P,Final,Fábrica) ou 6 (+Extra) números no fim
  let width: number | null = null;
  let height: number | null = null;
  let depth: number | null = null;
  let finalPrice = 0;
  let factoryPrice = 0;
  let extraCost = 0;

  if (numericTail.length >= 5) {
    width = parseDim(numericTail[0]);
    height = parseDim(numericTail[1]);
    depth = parseDim(numericTail[2]);
    finalPrice = parseNum(numericTail[3]);
    factoryPrice = parseNum(numericTail[4]);
    extraCost = parseNum(numericTail[5] || '0');
  } else {
    // fallback: usa o que tiver
    width = parseDim(numericTail[0] || '');
    height = parseDim(numericTail[1] || '');
    depth = parseDim(numericTail[2] || '');
    finalPrice = parseNum(numericTail[3] || '0');
    factoryPrice = parseNum(numericTail[4] || '0');
  }

  if (projetoIdx >= 0) {
    const projPart = parts[projetoIdx];
    const envMatch = projPart.match(/Projeto\s*[-–]\s*(.+?)\s*[-–]\s*(.+)/i);
    if (envMatch) {
      envName = envMatch[1].trim();
      const clientRaw = envMatch[2].trim();
      const refMatch = clientRaw.match(/^(.+?)(\d{4,})$/);
      if (refMatch) {
        envClient = refMatch[1].trim();
        projectRef = refMatch[2];
      } else {
        envClient = clientRaw;
      }
    }

    // Parts after Projeto are category and finish
    const afterProjeto = parts.slice(projetoIdx + 1);
    if (afterProjeto.length >= 1) category = afterProjeto[0].trim();
    if (afterProjeto.length >= 2) finish = afterProjeto[1].trim();
  }

  return {
    item: {
      index: indexNum,
      quantity,
      description,
      width,
      height,
      depth,
      // cost = preço final (vai para o orçamento do cliente)
      cost: finalPrice,
      // mantém campos legados para compatibilidade com código existente
      costB: factoryPrice,
      costC: extraCost,
      finalPrice,
      factoryPrice,
      extraCost,
      category,
      finish,
      projectRef,
      rawLine: line,
    },
    envName,
    envClient,
  };
}

function extractTotal(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/total\s*=?\s*(?:R\$)?\s*([\d.,]+)/i);
    if (match) return parseNum(match[1]);
  }
  return 0;
}

export function parsePromobTxt(content: string): PromobParseResult {
  const rawContent = content;
  const lines = content.split(/\r?\n/);
  const warnings: string[] = [];

  const headerLines = lines.slice(0, 20);
  const header: PromobHeader = {
    projectId: extractHeaderField(headerLines, 'ID do Projeto'),
    promobVersion: extractHeaderField(headerLines, 'Promob'),
    system: extractHeaderField(headerLines, 'System'),
    storeName: extractHeaderField(headerLines, 'Loja'),
    clientName: extractHeaderField(headerLines, 'Cliente'),
    address: extractHeaderField(headerLines, 'Endere[cç]o') || extractHeaderField(headerLines, 'Endereco'),
    neighborhood: extractHeaderField(headerLines, 'Bairro'),
    phone: extractHeaderField(headerLines, 'Fone'),
    cpf: extractHeaderField(headerLines, 'CPF'),
    deliveryAddress: extractHeaderField(headerLines, 'EEntrega'),
  };

  const envMap = new Map<string, PromobEnvironment>();

  for (const line of lines) {
    if (line.match(/^\s*(ID do Projeto|Promob|System|Loja|Cliente|Endere|Bairro|Fone|CPF|EEntrega|Total)\s*=/i)) continue;

    const result = parseItemLine(line);
    if (!result) continue;

    const key = result.envName;
    if (!envMap.has(key)) {
      envMap.set(key, {
        name: result.envName,
        clientName: result.envClient || header.clientName,
        items: [],
        total: 0,
      });
    }
    envMap.get(key)!.items.push(result.item);
  }

  const environments = Array.from(envMap.values());
  for (const env of environments) {
    // Total do ambiente usa o PREÇO DE FÁBRICA, que é o que o "Total =" do TXT do Promob soma
    env.total = env.items.reduce((s, it) => s + it.factoryPrice * it.quantity, 0);
  }

  const fileTotal = extractTotal(lines);
  const calculatedTotal = environments.reduce((s, env) => s + env.total, 0);
  const hasDivergence = fileTotal > 0 && Math.abs(fileTotal - calculatedTotal) > 0.01;
  const divergenceAmount = fileTotal > 0 ? fileTotal - calculatedTotal : 0;

  if (hasDivergence) {
    warnings.push(`Divergência de R$ ${Math.abs(divergenceAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} entre o total do arquivo (R$ ${fileTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) e a soma dos itens (R$ ${calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
  }

  if (!header.clientName) warnings.push('Nome do cliente não identificado no cabeçalho.');
  if (environments.length === 0 || environments.every(e => e.items.length === 0)) {
    warnings.push('Nenhum item foi extraído do arquivo.');
  }

  return { header, environments, rawContent, fileTotal, calculatedTotal, hasDivergence, divergenceAmount, warnings };
}
