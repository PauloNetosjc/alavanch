/**
 * Parser robusto para arquivos TXT exportados do Promob.
 * Tolerante a campos vazios e espaçamento variável.
 * Formato real: colunas de largura fixa, sem cabeçalho de colunas,
 * ambiente embutido na linha do item ("Projeto - AMBIENTE - CLIENTE").
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

/**
 * Parse a single item line using multi-space splitting.
 * Format observed:
 * INDEX  QTY  CODE+DESCRIPTION  WIDTH  HEIGHT  DEPTH  COST_A  COST_B  COST_C  "Projeto - ENV - CLIENT" + REF  CATEGORY  FINISH
 */
function parseItemLine(line: string): { item: PromobItem; envName: string; envClient: string } | null {
  if (!line.trim()) return null;

  // Split by 2+ spaces or tabs
  const parts = line.split(/\t+|\s{2,}/).filter(p => p.trim());
  if (parts.length < 6) return null;

  const indexNum = parseInt(parts[0]);
  if (isNaN(indexNum)) return null;

  const quantity = parseInt(parts[1]) || 1;
  const description = parts[2] || '';

  // Find the "Projeto - " part to locate environment info
  // It could be in any part after the numeric columns
  let envName = '';
  let envClient = '';
  let projectRef = '';
  let category = '';
  let finish = '';

  // Numeric columns: width, height, depth, cost_a, cost_b, cost_c
  // They follow the description
  let numericStart = 3;
  const width = parseDim(parts[numericStart] || '');
  const height = parseDim(parts[numericStart + 1] || '');
  const depth = parseDim(parts[numericStart + 2] || '');
  const costA = parseNum(parts[numericStart + 3] || '0');
  const costB = parseNum(parts[numericStart + 4] || '0');
  const costC = parseNum(parts[numericStart + 5] || '0');

  // Remaining parts after numeric columns contain env info, category, finish
  const remaining = parts.slice(numericStart + 6);

  for (const part of remaining) {
    const envMatch = part.match(/Projeto\s*[-–]\s*(.+?)\s*[-–]\s*(.+)/i);
    if (envMatch) {
      envName = envMatch[1].trim();
      // Client name might be truncated and have a ref number appended
      const clientRaw = envMatch[2].trim();
      // Remove trailing numbers that are project refs
      const refMatch = clientRaw.match(/^(.+?)(\d{4,})$/);
      if (refMatch) {
        envClient = refMatch[1].trim();
        projectRef = refMatch[2];
      } else {
        envClient = clientRaw;
      }
    } else if (!category) {
      category = part.trim();
    } else {
      finish = part.trim();
    }
  }

  return {
    item: {
      index: indexNum,
      quantity,
      description,
      width,
      height,
      depth,
      cost: costA,
      costB,
      costC,
      category,
      finish,
      projectRef,
      rawLine: line,
    },
    envName: envName || 'Ambiente Geral',
    envClient,
  };
}

function extractTotal(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(/total\s*=?\s*(?:R\$)?\s*([\d.,]+)/i);
    if (match) {
      // In this format numbers use dot as decimal
      return parseNum(match[1]);
    }
  }
  return 0;
}

export function parsePromobTxt(content: string): PromobParseResult {
  const rawContent = content;
  const lines = content.split(/\r?\n/);
  const warnings: string[] = [];

  // Parse header (first ~15 lines before blank line)
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

  // Parse items - environment is embedded in each item line
  const envMap = new Map<string, PromobEnvironment>();

  for (const line of lines) {
    // Skip header lines and total
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

  // Calculate totals per environment
  for (const env of environments) {
    env.total = env.items.reduce((s, it) => s + it.cost * it.quantity, 0);
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

  return {
    header,
    environments,
    rawContent,
    fileTotal,
    calculatedTotal,
    hasDivergence,
    divergenceAmount,
    warnings,
  };
}
