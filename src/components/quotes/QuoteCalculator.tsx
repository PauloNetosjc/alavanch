import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator, Plus, Trash2, Loader2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle } from 'lucide-react';

interface ApprovalRule {
  id: string;
  rule_type: string;
  max_percent: number | null;
  approver_role: string;
  description: string | null;
  active: boolean | null;
}

interface QuoteCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Tables<'quotes'> | null;
  onSuccess: () => void;
}

interface Installment {
  id?: string;
  number: number;
  value: number;
  due_date: string;
  payment_method: string;
}

export function QuoteCalculator({ open, onOpenChange, quote, onSuccess }: QuoteCalculatorProps) {
  const { user } = useAuth();
  const [totalValue, setTotalValue] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountValue, setDiscountValue] = useState(0);
  const [interestPercent, setInterestPercent] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [finalValue, setFinalValue] = useState(0);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [saving, setSaving] = useState(false);
  const [numInstallments, setNumInstallments] = useState(1);
  const [baseDate, setBaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [discountBlocked, setDiscountBlocked] = useState(false);
  const [discountWarning, setDiscountWarning] = useState<string | null>(null);
  const [lastDiscountEdit, setLastDiscountEdit] = useState<'percent' | 'value'>('percent');

  // Load approval rules and user role
  useEffect(() => {
    const loadRulesAndRole = async () => {
      const [rulesRes, roleRes] = await Promise.all([
        supabase.from('approval_rules').select('*').eq('active', true).eq('rule_type', 'desconto'),
        user ? supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setApprovalRules((rulesRes.data as ApprovalRule[]) ?? []);
      setUserRole(roleRes.data?.role ?? null);
    };
    if (open) loadRulesAndRole();
  }, [open, user]);

  // Check discount against approval rules
  useEffect(() => {
    if (!approvalRules.length || !userRole) {
      setDiscountBlocked(false);
      setDiscountWarning(null);
      return;
    }
    const effectivePct = lastDiscountEdit === 'percent' ? discountPercent : (totalValue > 0 ? (discountValue / totalValue) * 100 : 0);
    const violatedRule = approvalRules.find(r => r.max_percent != null && effectivePct > r.max_percent);
    if (violatedRule) {
      const isApprover = userRole === violatedRule.approver_role || userRole === 'admin';
      if (!isApprover) {
        setDiscountBlocked(true);
        setDiscountWarning(`Desconto de ${effectivePct.toFixed(1)}% excede o limite de ${violatedRule.max_percent}%. Apenas ${violatedRule.approver_role === 'admin' ? 'Administradores' : 'o cargo ' + violatedRule.approver_role} pode aprovar.`);
      } else {
        setDiscountBlocked(false);
        setDiscountWarning(`Desconto de ${effectivePct.toFixed(1)}% excede o limite de ${violatedRule.max_percent}%, mas seu cargo permite aprovar.`);
      }
    } else {
      setDiscountBlocked(false);
      setDiscountWarning(null);
    }
  }, [discountPercent, discountValue, totalValue, lastDiscountEdit, approvalRules, userRole]);

  useEffect(() => {
    if (open && quote) {
      setTotalValue(quote.total_value ?? 0);
      setDiscountPercent(quote.discount_percent ?? 0);
      setDiscountValue(quote.discount_value ?? 0);
      setInterestPercent(quote.interest_percent ?? 0);
      setSurcharge(quote.surcharge ?? 0);
      setBaseDate(new Date().toISOString().split('T')[0]);
      loadInstallments(quote.id);
    }
  }, [open, quote]);

  // (lastDiscountEdit already declared above)

  // Recalculate final value whenever inputs change
  useEffect(() => {
    const disc = lastDiscountEdit === 'percent'
      ? totalValue * (discountPercent / 100)
      : discountValue;
    const afterDiscount = totalValue - disc;
    const interest = afterDiscount * (interestPercent / 100);
    const computed = afterDiscount + interest + surcharge;
    setFinalValue(Math.max(0, computed));
  }, [totalValue, discountPercent, discountValue, interestPercent, surcharge, lastDiscountEdit]);

  const handleDiscountPercentChange = (pct: number) => {
    setLastDiscountEdit('percent');
    setDiscountPercent(pct);
    setDiscountValue(Math.round(totalValue * (pct / 100) * 100) / 100);
  };

  const handleDiscountValueChange = (val: number) => {
    setLastDiscountEdit('value');
    setDiscountValue(val);
    setDiscountPercent(totalValue > 0 ? Math.round((val / totalValue) * 100 * 100) / 100 : 0);
  };

  const loadInstallments = async (quoteId: string) => {
    const { data } = await supabase
      .from('quote_installments')
      .select('*')
      .eq('quote_id', quoteId)
      .order('number');
    if (data && data.length > 0) {
      setInstallments(data.map(i => ({
        id: i.id,
        number: i.number,
        value: i.value,
        due_date: i.due_date ?? '',
        payment_method: i.payment_method ?? 'boleto',
      })));
      setNumInstallments(data.length);
    } else {
      generateInstallments(1);
    }
  };

  const generateInstallments = useCallback((count: number) => {
    if (count < 1) count = 1;
    const perInstallment = finalValue / count;
    const base = new Date(baseDate || Date.now());
    const newInstallments: Installment[] = [];
    for (let i = 0; i < count; i++) {
      const due = new Date(base);
      due.setMonth(due.getMonth() + i);
      newInstallments.push({
        number: i + 1,
        value: Math.round(perInstallment * 100) / 100,
        due_date: due.toISOString().split('T')[0],
        payment_method: 'boleto',
      });
    }
    // Fix rounding
    if (newInstallments.length > 0) {
      const sum = newInstallments.reduce((s, inst) => s + inst.value, 0);
      const diff = Math.round((finalValue - sum) * 100) / 100;
      newInstallments[newInstallments.length - 1].value += diff;
    }
    setInstallments(newInstallments);
  }, [finalValue, baseDate]);

  const handleNumInstallmentsChange = (value: number) => {
    setNumInstallments(value);
    generateInstallments(value);
  };

  const handleInstallmentValueChange = (index: number, newValue: number) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], value: newValue };

    // Redistribute remaining across other installments
    const usedSum = updated.reduce((s, inst) => s + inst.value, 0);
    const diff = finalValue - usedSum;
    if (Math.abs(diff) > 0.01 && updated.length > 1) {
      // Spread difference to the last installment
      const lastIdx = updated.length - 1;
      if (lastIdx !== index) {
        updated[lastIdx] = { ...updated[lastIdx], value: Math.round((updated[lastIdx].value + diff) * 100) / 100 };
      }
    }
    setInstallments(updated);
  };

  const handleInstallmentFieldChange = (index: number, field: keyof Installment, value: string) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  const addInstallment = () => {
    const n = installments.length + 1;
    const base = new Date(baseDate || Date.now());
    base.setMonth(base.getMonth() + n - 1);
    setInstallments([...installments, {
      number: n,
      value: 0,
      due_date: base.toISOString().split('T')[0],
      payment_method: 'boleto',
    }]);
    setNumInstallments(n);
  };

  const removeInstallment = (index: number) => {
    if (installments.length <= 1) return;
    const updated = installments.filter((_, i) => i !== index).map((inst, i) => ({ ...inst, number: i + 1 }));
    setNumInstallments(updated.length);
    setInstallments(updated);
  };

  const handleSave = async () => {
    if (!quote) return;
    if (discountBlocked) {
      toast.error('Desconto excede o limite permitido para seu cargo');
      return;
    }
    setSaving(true);
    try {
      // Update quote values
      const { error: qError } = await supabase
        .from('quotes')
        .update({
          total_value: totalValue,
          discount_percent: discountPercent,
          discount_value: discountValue,
          interest_percent: interestPercent,
          surcharge,
          final_value: finalValue,
        })
        .eq('id', quote.id);
      if (qError) throw qError;

      // Delete old installments and insert new
      await supabase.from('quote_installments').delete().eq('quote_id', quote.id);

      if (installments.length > 0) {
        const { error: iError } = await supabase
          .from('quote_installments')
          .insert(installments.map(inst => ({
            quote_id: quote.id,
            number: inst.number,
            value: inst.value,
            due_date: inst.due_date || null,
            payment_method: inst.payment_method || null,
          })));
        if (iError) throw iError;
      }

      toast.success('Valores salvos com sucesso');
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora Comercial — {quote.code}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Values section */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor total</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={totalValue || ''}
                onChange={(e) => setTotalValue(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Desconto (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountPercent || ''}
                onChange={(e) => handleDiscountPercentChange(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Desconto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={discountValue || ''}
                onChange={(e) => handleDiscountValueChange(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Juros (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={interestPercent || ''}
                onChange={(e) => setInterestPercent(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Acréscimo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={surcharge || ''}
                onChange={(e) => setSurcharge(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Valor final</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-primary/10 text-primary font-bold text-lg">
                {fmt(finalValue)}
              </div>
            </div>
          </div>

          <Separator />

          {/* Installments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Parcelamento
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Data base</Label>
                  <Input
                    type="date"
                    className="w-36 h-8 text-xs"
                    value={baseDate}
                    onChange={(e) => setBaseDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    className="w-16 h-8 text-xs"
                    value={numInstallments}
                    onChange={(e) => handleNumInstallmentsChange(Number(e.target.value))}
                  />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => generateInstallments(numInstallments)}>
                  Gerar
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {installments.map((inst, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr_32px] gap-2 items-center">
                  <span className="text-xs text-muted-foreground text-center font-mono">
                    {inst.number}x
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-8 text-sm"
                    value={inst.value || ''}
                    onChange={(e) => handleInstallmentValueChange(i, Number(e.target.value))}
                  />
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={inst.due_date}
                    onChange={(e) => handleInstallmentFieldChange(i, 'due_date', e.target.value)}
                  />
                  <Select
                    value={inst.payment_method}
                    onValueChange={(v) => handleInstallmentFieldChange(i, 'payment_method', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeInstallment(i)}
                    disabled={installments.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm">
              <Button type="button" size="sm" variant="ghost" onClick={addInstallment}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar parcela
              </Button>
              <div className="text-xs text-muted-foreground">
                Total parcelas: <strong>{fmt(installments.reduce((s, inst) => s + inst.value, 0))}</strong>
                {Math.abs(installments.reduce((s, inst) => s + inst.value, 0) - finalValue) > 0.01 && (
                  <span className="text-destructive ml-2">
                    (diferença: {fmt(finalValue - installments.reduce((s, inst) => s + inst.value, 0))})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar valores
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
