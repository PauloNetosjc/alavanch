/**
 * Parser robusto para arquivos TXT exportados do Promob.
 * Tolerante a campos vazios e espaçamento variável.
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
  category: string;
  finish: string;
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
    // Match "Field:" or "Field :" patterns
    const regex = new RegExp(`^\\s*${field}\\s*[:\\-]\\s*(.*)$`, 'i');
    const match = line.match(regex);
    if (match) return match[1].trim();
  }
  return '';
}

function parseNumber(str: string): number {
  if (!str || !str.trim()) return 0;
  // Handle Brazilian number format: 1.234,56
  const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDimension(str: string): number | null {
  if (!str || !str.trim()) return null;
  const n = parseNumber(str);
  return n === 0 ? null : n;
}

/**
 * Detects column boundaries using the header row positions.
 * Promob TXT uses fixed-width columns with variable spacing.
 */
function detectColumns(headerLine: string): { name: string; start: number; end: number }[] {
  const knownHeaders = [
    'Ind', 'Índice', 'Index',
    'Qtd', 'Qtde', 'Quantidade',
    'Descrição', 'Descricao', 'Description',
    'Largura', 'Larg', 'Width',
    'Altura', 'Alt', 'Height',
    'Profundidade', 'Prof', 'Depth',
    'Custo', 'Valor', 'Cost', 'Preço', 'Preco',
    'Grupo', 'Group', 'Categoria',
    'Acabamento', 'Finish', 'Acab',
  ];

  const cols: { name: string; start: number; end: number }[] = [];
  const upper = headerLine.toUpperCase();

  for (const h of knownHeaders) {
    const idx = upper.indexOf(h.toUpperCase());
    if (idx !== -1) {
      cols.push({ name: h.toLowerCase(), start: idx, end: idx + h.length });
    }
  }

  // Sort by position
  cols.sort((a, b) => a.start - b.start);

  // Set end to next column start
  for (let i = 0; i < cols.length - 1; i++) {
    cols[i].end = cols[i + 1].start;
  }
  if (cols.length > 0) {
    cols[cols.length - 1].end = 9999;
  }

  return cols;
}

function normalizeColName(name: string): string {
  const n = name.toLowerCase();
  if (['ind', 'índice', 'index'].includes(n)) return 'index';
  if (['qtd', 'qtde', 'quantidade'].includes(n)) return 'quantity';
  if (['descrição', 'descricao', 'description'].includes(n)) return 'description';
  if (['largura', 'larg', 'width'].includes(n)) return 'width';
  if (['altura', 'alt', 'height'].includes(n)) return 'height';
  if (['profundidade', 'prof', 'depth'].includes(n)) return 'depth';
  if (['custo', 'valor', 'cost', 'preço', 'preco'].includes(n)) return 'cost';
  if (['grupo', 'group', 'categoria'].includes(n)) return 'category';
  if (['acabamento', 'finish', 'acab'].includes(n)) return 'finish';
  return n;
}

function parseItemLine(line: string, cols: { name: string; start: number; end: number }[]): PromobItem | null {
  if (!line.trim() || line.trim().startsWith('-') || line.trim().startsWith('=')) return null;

  const values: Record<string, string> = {};
  for (const col of cols) {
    const val = line.substring(col.start, Math.min(col.end, line.length));
    values[normalizeColName(col.name)] = val.trim();
  }

  // If no description found, try tab/multi-space splitting as fallback
  if (!values.description && !cols.length) {
    const parts = line.split(/\t+|\s{2,}/).filter(p => p.trim());
    if (parts.length >= 3) {
      values.index = parts[0];
      values.quantity = parts[1];
      values.description = parts[2];
      if (parts[3]) values.width = parts[3];
      if (parts[4]) values.height = parts[4];
      if (parts[5]) values.depth = parts[5];
      if (parts[6]) values.cost = parts[6];
      if (parts[7]) values.category = parts[7];
      if (parts[8]) values.finish = parts[8];
    }
  }

  const index = parseInt(values.index || '0');
  const quantity = parseInt(values.quantity || '1');
  const description = values.description || '';

  if (!description && !index) return null;

  return {
    index: isNaN(index) ? 0 : index,
    quantity: isNaN(quantity) ? 1 : quantity,
    description,
    width: parseDimension(values.width || ''),
    height: parseDimension(values.height || ''),
    depth: parseDimension(values.depth || ''),
    cost: parseNumber(values.cost || '0'),
    category: values.category || '',
    finish: values.finish || '',
    rawLine: line,
  };
}

function extractTotal(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // Match "Total", "TOTAL", "Total Geral", etc followed by a number
    const match = line.match(/total\s*(?:geral)?\s*[:\s]*(?:R\$)?\s*([\d.,]+)/i);
    if (match) return parseNumber(match[1]);
  }
  return 0;
}

export function parsePromobTxt(content: string): PromobParseResult {
  const rawContent = content;
  const lines = content.split(/\r?\n/);
  const warnings: string[] = [];

  // Parse header (typically first ~15 lines)
  const headerLines = lines.slice(0, 30);
  const header: PromobHeader = {
    projectId: extractHeaderField(headerLines, 'ID do Projeto') || extractHeaderField(headerLines, 'Projeto') || extractHeaderField(headerLines, 'Project'),
    promobVersion: extractHeaderField(headerLines, 'Promob') || extractHeaderField(headerLines, 'Versão'),
    system: extractHeaderField(headerLines, 'System') || extractHeaderField(headerLines, 'Sistema'),
    storeName: extractHeaderField(headerLines, 'Loja') || extractHeaderField(headerLines, 'Store'),
    clientName: extractHeaderField(headerLines, 'Cliente') || extractHeaderField(headerLines, 'Client'),
    address: extractHeaderField(headerLines, 'Endere[cç]o') || extractHeaderField(headerLines, 'Endereco'),
    neighborhood: extractHeaderField(headerLines, 'Bairro'),
    phone: extractHeaderField(headerLines, 'Fone') || extractHeaderField(headerLines, 'Telefone') || extractHeaderField(headerLines, 'Phone'),
    cpf: extractHeaderField(headerLines, 'CPF'),
    deliveryAddress: extractHeaderField(headerLines, 'EEntrega') || extractHeaderField(headerLines, 'Entrega') || extractHeaderField(headerLines, 'End\\.?\\s*Entrega'),
  };

  // Parse environments: look for "Projeto - AMBIENTE - CLIENTE" pattern
  const environments: PromobEnvironment[] = [];
  let currentEnv: PromobEnvironment | null = null;
  let currentCols: { name: string; start: number; end: number }[] = [];
  let inItemSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect environment header
    const envMatch = line.match(/Projeto\s*[-–]\s*(.+?)\s*[-–]\s*(.+)/i);
    if (envMatch) {
      if (currentEnv) environments.push(currentEnv);
      currentEnv = {
        name: envMatch[1].trim(),
        clientName: envMatch[2].trim(),
        items: [],
        total: 0,
      };
      inItemSection = false;
      currentCols = [];
      continue;
    }

    // Detect column headers
    if (line.match(/\b(Ind|Índice|Qtd|Qtde|Descrição|Descricao)\b/i)) {
      currentCols = detectColumns(line);
      inItemSection = true;
      continue;
    }

    // Separator lines
    if (/^[\s\-=]+$/.test(line)) continue;

    // Total line for current environment
    const envTotal = line.match(/(?:sub\s*)?total\s*(?:do\s*ambiente)?\s*[:\s]*(?:R\$)?\s*([\d.,]+)/i);
    if (envTotal && currentEnv) {
      currentEnv.total = parseNumber(envTotal[1]);
      inItemSection = false;
      continue;
    }

    // Parse item lines
    if (inItemSection && currentEnv && line.trim()) {
      const item = parseItemLine(line, currentCols);
      if (item && item.description) {
        currentEnv.items.push(item);
      }
    }
  }

  if (currentEnv) environments.push(currentEnv);

  // If no environments found, create a default one with all items
  if (environments.length === 0 && lines.length > 0) {
    warnings.push('Nenhum ambiente identificado automaticamente. Todos os itens foram agrupados em "Ambiente Geral".');
    const defaultEnv: PromobEnvironment = { name: 'Ambiente Geral', clientName: header.clientName, items: [], total: 0 };

    let cols: { name: string; start: number; end: number }[] = [];
    let parsing = false;
    for (const line of lines) {
      if (line.match(/\b(Ind|Índice|Qtd|Qtde|Descrição|Descricao)\b/i)) {
        cols = detectColumns(line);
        parsing = true;
        continue;
      }
      if (parsing && line.trim() && !/^[\s\-=]+$/.test(line)) {
        const item = parseItemLine(line, cols);
        if (item && item.description) defaultEnv.items.push(item);
      }
    }

    if (defaultEnv.items.length > 0) {
      defaultEnv.total = defaultEnv.items.reduce((s, it) => s + it.cost * it.quantity, 0);
      environments.push(defaultEnv);
    }
  }

  const fileTotal = extractTotal(lines);
  const calculatedTotal = environments.reduce((s, env) =>
    s + env.items.reduce((si, it) => si + it.cost * it.quantity, 0), 0);

  const hasDivergence = fileTotal > 0 && Math.abs(fileTotal - calculatedTotal) > 0.01;
  const divergenceAmount = fileTotal > 0 ? fileTotal - calculatedTotal : 0;

  if (hasDivergence) {
    warnings.push(`Divergência de R$ ${Math.abs(divergenceAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} entre o total do arquivo (R$ ${fileTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) e a soma dos itens (R$ ${calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
  }

  if (!header.clientName) warnings.push('Nome do cliente não identificado no cabeçalho.');
  if (environments.every(e => e.items.length === 0)) warnings.push('Nenhum item foi extraído do arquivo.');

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
