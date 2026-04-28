import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface QuoteLite {
  id: string;
  code: string;
  client_id: string | null;
  store_id?: string | null;
  seller_id?: string | null;
  total_value?: number | null;
  discount_percent?: number | null;
  discount_value?: number | null;
  interest_percent?: number | null;
  surcharge?: number | null;
  final_value?: number | null;
  urgency?: string | null;
  origin?: string | null;
  focal_point?: string | null;
  notes?: string | null;
  npv_value?: number | null;
  total_cost?: number | null;
  discount_rate_monthly?: number | null;
}

interface InstallmentLite {
  number: number;
  value: number;
  due_date: string | null;
  payment_method: string | null;
}

export interface ApprovalCheckResult {
  requiresApproval: boolean;
  ruleMaxPct?: number;
  appliedPct?: number;
  approverRole?: string;
}

/**
 * Checks whether the current user's discount on the quote requires approval.
 * Admin and diretoria bypass approval.
 */
export async function checkDiscountApproval(quote: QuoteLite, userId: string): Promise<ApprovalCheckResult> {
  const effectiveDiscount = Number(quote.discount_percent ?? 0);
  if (effectiveDiscount <= 0) return { requiresApproval: false };

  const { data: rules } = await supabase
    .from('approval_rules')
    .select('*')
    .eq('active', true)
    .eq('rule_type', 'desconto');

  if (!rules || rules.length === 0) return { requiresApproval: false };

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  const roles = (userRoles ?? []).map(r => r.role as string);
  if (roles.includes('admin') || roles.includes('diretoria')) {
    return { requiresApproval: false };
  }

  for (const rule of rules) {
    const maxPct = Number(rule.max_percent ?? 0);
    const affectedRoles: string[] = (rule as { affected_roles?: string[] }).affected_roles ?? [];
    const ruleApplies = affectedRoles.length === 0 || affectedRoles.some(r => roles.includes(r));
    if (!ruleApplies) continue;
    if (effectiveDiscount > maxPct) {
      return {
        requiresApproval: true,
        ruleMaxPct: maxPct,
        appliedPct: effectiveDiscount,
        approverRole: rule.approver_role,
      };
    }
  }
  return { requiresApproval: false };
}

/**
 * Marks a quote as awaiting approval (does NOT create the order).
 */
export async function requestQuoteApproval(quoteId: string, reason: string): Promise<void> {
  await supabase
    .from('quotes')
    .update({
      approval_status: 'aguardando',
      approval_reason: reason,
      approval_requested_at: new Date().toISOString(),
    })
    .eq('id', quoteId);
}

/**
 * Generates a unique order code in the form PED-YYYY-NNNN.
 */
async function generateOrderCode(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .ilike('code', `PED-${year}%`);
  const num = (count ?? 0) + 1;
  return `PED-${year}-${String(num).padStart(4, '0')}`;
}

/**
 * Generates Contas a Receber entries from quote installments after order creation.
 */
export async function generateReceivablesFromInstallments(
  orderId: string,
  installments: InstallmentLite[],
  description: string,
): Promise<void> {
  if (!installments.length) return;

  const entries = installments.map(inst => ({
    type: 'receita',
    description: `${description} (${inst.number}/${installments.length})`,
    value: Number(inst.value),
    due_date: inst.due_date ?? format(new Date(), 'yyyy-MM-dd'),
    payment_method: inst.payment_method ?? null,
    installment_number: inst.number,
    status: 'pendente',
    order_id: orderId,
    source: 'quote_installment',
  }));

  await supabase.from('financial_entries').insert(entries);
  await supabase.from('orders').update({ installments_generated: true }).eq('id', orderId);
}

/**
 * Converts a quote into an order, generates receivables, and updates the quote status.
 * Throws on validation errors. Returns the new order code.
 */
export async function convertQuoteToOrder(quote: QuoteLite, installments: InstallmentLite[]): Promise<string> {
  if (!quote.final_value || quote.final_value <= 0) {
    throw new Error('Defina valores na calculadora antes de converter para pedido');
  }
  if (!quote.client_id) {
    throw new Error('Orçamento sem cliente vinculado');
  }

  const orderCode = await generateOrderCode();

  const snapshot = {
    quote_code: quote.code,
    quote_id: quote.id,
    total_value: quote.total_value,
    discount_percent: quote.discount_percent,
    discount_value: quote.discount_value,
    interest_percent: quote.interest_percent,
    surcharge: quote.surcharge,
    final_value: quote.final_value,
    urgency: quote.urgency,
    origin: quote.origin,
    focal_point: quote.focal_point,
    notes: quote.notes,
    installments: installments.map(i => ({
      number: i.number, value: i.value, due_date: i.due_date, payment_method: i.payment_method,
    })),
    converted_at: new Date().toISOString(),
  };

  const { data: initialStages } = await supabase
    .from('pipeline_stages')
    .select('pipeline_type, name')
    .eq('is_initial', true)
    .eq('active', true);
  const getInitial = (pt: string) => initialStages?.find(s => s.pipeline_type === pt)?.name ?? 'pendente';

  const { data: orderRow, error } = await supabase
    .from('orders')
    .insert({
      code: orderCode,
      client_id: quote.client_id,
      quote_id: quote.id,
      store_id: quote.store_id ?? null,
      seller_id: quote.seller_id ?? null,
      total_value: quote.total_value ?? 0,
      discount_percent: quote.discount_percent ?? 0,
      discount_value: quote.discount_value ?? 0,
      final_value: quote.final_value ?? 0,
      npv_value: quote.npv_value ?? 0,
      total_cost: quote.total_cost ?? 0,
      discount_rate_monthly: quote.discount_rate_monthly ?? 1.5,
      snapshot,
      contract_status: getInitial('contrato'),
      revision_status: getInitial('revisao'),
      assembly_status: getInitial('montagem'),
      financial_status: getInitial('financeiro'),
      post_assembly_status: getInitial('pos_montagem'),
    })
    .select('id')
    .single();

  if (error || !orderRow) {
    throw new Error(error?.message ?? 'Erro ao criar pedido');
  }

  // Auto-generate Contas a Receber from quote installments
  if (installments.length > 0) {
    await generateReceivablesFromInstallments(
      orderRow.id,
      installments,
      `${orderCode} — ${quote.code}`,
    );
  }

  await supabase.from('quotes').update({ status: 'fechado' }).eq('id', quote.id);

  // Audit
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('timeline_events').insert({
    entity_type: 'order',
    entity_id: orderRow.id,
    event_type: 'order_created',
    description: `Pedido ${orderCode} criado a partir do orçamento ${quote.code}`,
    user_id: user?.id ?? null,
    metadata: { quote_id: quote.id, installments_count: installments.length },
  });

  return orderCode;
}