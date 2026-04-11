import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { maskPhone, maskCpf } from '@/lib/masks';
import {
  Calculator,
  Pencil,
  ArrowRightCircle,
  Calendar,
  User,
  Store,
  MapPin,
  FileText,
  Loader2,
  CreditCard,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const statusLabels: Record<string, string> = {
  novo_lead: 'Novo Lead',
  em_atendimento: 'Em Atendimento',
  em_elaboracao: 'Em Elaboração',
  enviado: 'Enviado',
  em_negociacao: 'Em Negociação',
  acomp_7d: 'Acomp. 7d',
  acomp_15d: 'Acomp. 15d',
  acomp_30d: 'Acomp. 30d',
  '30d_plus': '30d+',
  fechado: 'Fechado',
  declinado: 'Declinado',
  arquivado: 'Arquivado',
};

const urgencyLabels: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

interface QuoteDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  onEdit: (q: Tables<'quotes'>) => void;
  onOpenCalc: (q: Tables<'quotes'>) => void;
  onRefresh: () => void;
}

interface QuoteDetail extends Tables<'quotes'> {
  clients: {
    name: string;
    phone: string | null;
    email: string | null;
    cpf: string | null;
    delivery_address: string | null;
  } | null;
  stores: { name: string } | null;
}

interface Installment {
  id: string;
  number: number;
  value: number;
  due_date: string | null;
  payment_method: string | null;
}

const paymentLabels: Record<string, string> = {
  boleto: 'Boleto',
  pix: 'Pix',
  cartao_credito: 'Cartão crédito',
  cartao_debito: 'Cartão débito',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
};

export function QuoteDetailSheet({
  open,
  onOpenChange,
  quoteId,
  onEdit,
  onOpenCalc,
  onRefresh,
}: QuoteDetailSheetProps) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [converting, setConverting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && quoteId) {
      loadQuote(quoteId);
    } else {
      setQuote(null);
      setInstallments([]);
    }
  }, [open, quoteId]);

  const loadQuote = async (id: string) => {
    setLoading(true);
    const [qRes, iRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('*, clients(name, phone, email, cpf, delivery_address), stores(name)')
        .eq('id', id)
        .single(),
      supabase
        .from('quote_installments')
        .select('*')
        .eq('quote_id', id)
        .order('number'),
    ]);
    setQuote((qRes.data as QuoteDetail) ?? null);
    setInstallments((iRes.data as Installment[]) ?? []);
    setLoading(false);
  };

  const fmt = (v: number | null | undefined) =>
    v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  const handleConvertToOrder = async () => {
    if (!quote) return;
    if (!quote.final_value || quote.final_value <= 0) {
      toast.error('Defina valores na calculadora antes de converter');
      return;
    }

    setConverting(true);
    try {
      // Generate order code
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .ilike('code', `PED-${year}%`);
      const num = (count ?? 0) + 1;
      const orderCode = `PED-${year}-${String(num).padStart(4, '0')}`;

      // Build snapshot
      const snapshot = {
        quote_code: quote.code,
        quote_id: quote.id,
        client: quote.clients,
        store: quote.stores,
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
          number: i.number,
          value: i.value,
          due_date: i.due_date,
          payment_method: i.payment_method,
        })),
        converted_at: new Date().toISOString(),
      };

      // Fetch initial stages for all pipelines
      const { data: initialStages } = await supabase
        .from('pipeline_stages')
        .select('pipeline_type, name')
        .eq('is_initial', true)
        .eq('active', true);
      
      const getInitial = (pt: string) => initialStages?.find(s => s.pipeline_type === pt)?.name ?? 'pendente';

      const { error } = await supabase.from('orders').insert({
        code: orderCode,
        client_id: quote.client_id!,
        quote_id: quote.id,
        store_id: quote.store_id,
        seller_id: quote.seller_id,
        total_value: quote.total_value,
        discount_percent: quote.discount_percent,
        discount_value: quote.discount_value,
        final_value: quote.final_value,
        snapshot,
        contract_status: getInitial('contrato'),
        revision_status: getInitial('revisao'),
        assembly_status: getInitial('montagem'),
        financial_status: getInitial('financeiro'),
        post_assembly_status: getInitial('pos_montagem'),
      });
      if (error) throw error;

      // Update quote status to "fechado"
      await supabase.from('quotes').update({ status: 'fechado' }).eq('id', quote.id);

      toast.success(`Pedido ${orderCode} criado com sucesso!`);
      onOpenChange(false);
      onRefresh();
      navigate('/pedidos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao converter');
    } finally {
      setConverting(false);
    }
  };

  if (!quote && !loading) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            {loading ? 'Carregando...' : quote?.code}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : quote ? (
          <div className="space-y-6 mt-4">
            {/* Status & Urgency */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{statusLabels[quote.status] ?? quote.status}</Badge>
              {quote.urgency && quote.urgency !== 'normal' && (
                <Badge
                  variant="outline"
                  className={
                    quote.urgency === 'urgente'
                      ? 'border-destructive text-destructive'
                      : quote.urgency === 'alta'
                      ? 'border-amber-500 text-amber-700'
                      : ''
                  }
                >
                  {urgencyLabels[quote.urgency] ?? quote.urgency}
                </Badge>
              )}
            </div>

            {/* Client */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Cliente
              </h3>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
                <p className="font-medium">{quote.clients?.name ?? '—'}</p>
                {quote.clients?.phone && (
                  <p className="text-muted-foreground">{maskPhone(quote.clients.phone)}</p>
                )}
                {quote.clients?.email && (
                  <p className="text-muted-foreground">{quote.clients.email}</p>
                )}
                {quote.clients?.cpf && (
                  <p className="text-muted-foreground">CPF: {maskCpf(quote.clients.cpf)}</p>
                )}
                {quote.clients?.delivery_address && (
                  <p className="text-muted-foreground flex items-start gap-1">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {quote.clients.delivery_address}
                  </p>
                )}
              </div>
            </div>

            {/* Store & Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {quote.stores?.name && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Store className="h-3 w-3" /> Loja
                  </span>
                  <p className="font-medium">{quote.stores.name}</p>
                </div>
              )}
              {quote.origin && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Origem</span>
                  <p className="font-medium">{quote.origin}</p>
                </div>
              )}
              {quote.focal_point && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Focal point</span>
                  <p className="font-medium">{quote.focal_point}</p>
                </div>
              )}
              {quote.start_date && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Início
                  </span>
                  <p className="font-medium">
                    {new Date(quote.start_date + 'T00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {quote.expiry_date && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Validade
                  </span>
                  <p className="font-medium">
                    {new Date(quote.expiry_date + 'T00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Values */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Valores
              </h3>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor total</span>
                  <span>{fmt(quote.total_value)}</span>
                </div>
                {(quote.discount_percent ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Desconto ({quote.discount_percent}%)</span>
                    <span className="text-destructive">-{fmt(quote.discount_value)}</span>
                  </div>
                )}
                {(quote.interest_percent ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Juros ({quote.interest_percent}%)</span>
                    <span>+{fmt(quote.total_value! * (quote.interest_percent! / 100))}</span>
                  </div>
                )}
                {(quote.surcharge ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Acréscimo</span>
                    <span>+{fmt(quote.surcharge)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Valor final</span>
                  <span className="text-primary">{fmt(quote.final_value)}</span>
                </div>
              </div>
            </div>

            {/* Installments */}
            {installments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Parcelas ({installments.length}x)
                </h3>
                <div className="space-y-1.5">
                  {installments.map(inst => (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between bg-muted/20 rounded px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{inst.number}x</span>
                        <span className="font-medium">{fmt(inst.value)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {inst.due_date && (
                          <span>{new Date(inst.due_date + 'T00:00').toLocaleDateString('pt-BR')}</span>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {paymentLabels[inst.payment_method ?? ''] ?? inst.payment_method ?? '—'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {quote.notes && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Observações
                </h3>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
                  {quote.notes}
                </p>
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(quote);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenCalc(quote);
                  }}
                >
                  <Calculator className="h-4 w-4 mr-2" /> Calculadora
                </Button>
              </div>
              {quote.status !== 'fechado' && quote.status !== 'declinado' && quote.status !== 'arquivado' && (
                <Button onClick={handleConvertToOrder} disabled={converting}>
                  {converting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRightCircle className="h-4 w-4 mr-2" />
                  )}
                  Converter em Pedido
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
