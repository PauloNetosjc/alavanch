import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { CalendarClock, ShieldAlert } from "lucide-react";

/**
 * Toggle "Obrigar informar vencimento" salvo em configuracoes_empresa
 * por loja. Quando ativo, a tela de Negociação bloqueia impressão de
 * orçamento, conversão em pedido e geração de contrato até que todas as
 * datas de vencimento das parcelas tenham sido clicadas/alteradas pelo
 * vendedor.
 */
export function ConfiguracaoVencimentoToggle() {
  const { selectedLojaId, lojas } = useLoja();
  const [value, setValue] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!selectedLojaId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("configuracoes_empresa" as any)
        .select("obrigar_informar_vencimento")
        .eq("loja_id", selectedLojaId)
        .maybeSingle();
      if (cancel) return;
      if (error && error.code !== "PGRST116") {
        toast.error(error.message);
      } else {
        setValue(Boolean((data as any)?.obrigar_informar_vencimento));
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [selectedLojaId]);

  const onToggle = async (next: boolean) => {
    if (!selectedLojaId) {
      toast.error("Selecione uma loja primeiro.");
      return;
    }
    setSaving(true);
    setValue(next);
    // Tenta UPDATE; se não existir linha ainda, cria.
    const { data: existing } = await supabase
      .from("configuracoes_empresa" as any)
      .select("id")
      .eq("loja_id", selectedLojaId)
      .maybeSingle();
    let error;
    if ((existing as any)?.id) {
      ({ error } = await supabase
        .from("configuracoes_empresa" as any)
        .update({ obrigar_informar_vencimento: next })
        .eq("id", (existing as any).id));
    } else {
      ({ error } = await supabase
        .from("configuracoes_empresa" as any)
        .insert({ loja_id: selectedLojaId, obrigar_informar_vencimento: next }));
    }
    setSaving(false);
    if (error) {
      setValue(!next);
      toast.error(error.message);
    } else {
      toast.success(next ? "Vencimento obrigatório ativado" : "Vencimento obrigatório desativado");
    }
  };

  const lojaNome = lojas.find((l) => l.id === selectedLojaId)?.nome;

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 rounded-lg bg-emerald-50 text-emerald-700 p-2 border border-emerald-100">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Label htmlFor="obrigar-venc" className="text-[14px] font-semibold text-foreground">
                Obrigar informar vencimento
              </Label>
              {value && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">
                  <ShieldAlert className="w-3 h-3" /> Controle obrigatório
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
              Exige confirmação manual das datas de vencimento antes de imprimir orçamento,
              converter em pedido ou gerar contrato.
              {lojaNome && (
                <span className="block text-[11px] mt-1">
                  Configuração aplicada à loja: <strong>{lojaNome}</strong>
                </span>
              )}
            </p>
          </div>
        </div>
        <Switch
          id="obrigar-venc"
          checked={value}
          onCheckedChange={onToggle}
          disabled={loading || saving || !selectedLojaId}
        />
      </div>
    </div>
  );
}
