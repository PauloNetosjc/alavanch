import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FinancialSettings {
  id: string;
  default_discount_rate_monthly: number;
  vpl_alert_threshold: number;
}

export function VplSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FinancialSettings | null>(null);
  const [rate, setRate] = useState<number>(1.5);
  const [threshold, setThreshold] = useState<number>(15);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('financial_settings').select('*').limit(1).maybeSingle();
      if (data) {
        const s = data as unknown as FinancialSettings;
        setSettings(s);
        setRate(Number(s.default_discount_rate_monthly));
        setThreshold(Number(s.vpl_alert_threshold));
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from('financial_settings')
      .update({ default_discount_rate_monthly: rate, vpl_alert_threshold: threshold })
      .eq('id', settings.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success('Configurações de VPL atualizadas');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <TrendingUp className="h-4 w-4 text-primary" />
            Configurações de VPL e Rentabilidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p>
              O <strong>VPL (Valor Presente Líquido)</strong> mostra quanto sua loja realmente recebe de uma venda parcelada,
              descontando o custo do dinheiro no tempo. Use a taxa abaixo como sua estimativa do custo de oportunidade
              do capital (ex.: taxa de capital de giro ou rentabilidade alternativa).
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa de desconto mensal padrão (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={rate || ''}
                onChange={(e) => setRate(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Sugestão: 1,5% a.m. (≈ 19,6% a.a.) — média de capital de giro.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Margem real mínima (%) — alerta</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={threshold || ''}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Orçamentos abaixo deste percentual serão sinalizados em vermelho.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}