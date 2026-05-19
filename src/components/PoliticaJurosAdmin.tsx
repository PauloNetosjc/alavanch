import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Percent } from "lucide-react";
import { toast } from "sonner";

type Loja = { id: string; nome: string };
type Politica = {
  id: string;
  loja_id: string | null;
  responsavel: "cliente" | "loja";
  faixa_min: number;
  faixa_max: number;
  perc_mes: number;
  ativo: boolean;
};

const ALL = "__all__";

export function PoliticaJurosAdmin() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [rows, setRows] = useState<Politica[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from("lojas").select("id,nome").eq("ativo", true).order("nome"),
      (supabase as any).from("politica_juros").select("*").order("loja_id").order("faixa_min"),
    ]);
    setLojas((l ?? []) as Loja[]);
    setRows((p ?? []) as Politica[]);
    setRemoved([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addRow = () => {
    setRows((r) => [
      ...r,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        loja_id: null,
        responsavel: "cliente",
        faixa_min: 1,
        faixa_max: 12,
        perc_mes: 0,
        ativo: true,
      },
    ]);
  };

  const update = (id: string, patch: Partial<Politica>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: string) => {
    if (!id.startsWith("new-")) setRemoved((a) => [...a, id]);
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const salvar = async () => {
    // validação
    for (const r of rows) {
      if (r.faixa_min < 1 || r.faixa_max < r.faixa_min) {
        return toast.error(`Faixa inválida (${r.faixa_min}–${r.faixa_max}).`);
      }
      if (r.perc_mes < 0) return toast.error("Percentual não pode ser negativo.");
    }
    setSaving(true);
    try {
      if (removed.length) {
        const { error } = await (supabase as any).from("politica_juros").delete().in("id", removed);
        if (error) throw error;
      }
      for (const r of rows) {
        const payload = {
          loja_id: r.loja_id,
          responsavel: r.responsavel,
          faixa_min: r.faixa_min,
          faixa_max: r.faixa_max,
          perc_mes: r.perc_mes,
          ativo: r.ativo,
        };
        if (r.id.startsWith("new-")) {
          const { error } = await (supabase as any).from("politica_juros").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("politica_juros").update(payload).eq("id", r.id);
          if (error) throw error;
        }
      }
      toast.success("Política de juros salva");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-[#2D6BE5]" />
          <h2 className="text-[18px] font-semibold">Política de Juros</h2>
        </div>
        <Button size="sm" onClick={addRow}><Plus className="w-4 h-4 mr-1" /> Nova faixa</Button>
      </div>
      <p className="text-[13px] text-muted-foreground mb-5">
        Defina por loja e faixa de parcelas a taxa mensal de juros e quem assume (loja ou cliente). Faixas
        com "Todas as lojas" valem como padrão.
      </p>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-[13px]">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-[13px]">
          Nenhuma política cadastrada. Clique em "Nova faixa" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wider text-muted-foreground px-2">
            <div className="col-span-3">Loja</div>
            <div className="col-span-2">Responsável</div>
            <div className="col-span-2">Parcelas (de)</div>
            <div className="col-span-2">Parcelas (até)</div>
            <div className="col-span-1">% / mês</div>
            <div className="col-span-1">Ativo</div>
            <div className="col-span-1"></div>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center border border-border rounded-lg p-2">
              <Select
                value={r.loja_id ?? ALL}
                onValueChange={(v) => update(r.id, { loja_id: v === ALL ? null : v })}
              >
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as lojas (padrão)</SelectItem>
                  {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={r.responsavel} onValueChange={(v) => update(r.id, { responsavel: v as any })}>
                <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente paga</SelectItem>
                  <SelectItem value="loja">Loja assume</SelectItem>
                </SelectContent>
              </Select>
              <Input className="col-span-2" type="number" min={1}
                value={r.faixa_min}
                onChange={(e) => update(r.id, { faixa_min: Math.max(1, Number(e.target.value) || 1) })} />
              <Input className="col-span-2" type="number" min={1}
                value={r.faixa_max}
                onChange={(e) => update(r.id, { faixa_max: Math.max(1, Number(e.target.value) || 1) })} />
              <Input className="col-span-1" type="number" min={0} step="0.01"
                value={r.perc_mes}
                onChange={(e) => update(r.id, { perc_mes: Number(e.target.value) || 0 })} />
              <div className="col-span-1 flex justify-center">
                <Switch checked={r.ativo} onCheckedChange={(v) => update(r.id, { ativo: v })} />
              </div>
              <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => remove(r.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={salvar} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" /> {saving ? "Salvando…" : "Salvar política"}
        </Button>
      </div>

      <div className="mt-6 text-[12px] text-muted-foreground bg-muted/40 rounded p-3 space-y-1">
        <div><b>Cliente paga:</b> os juros são embutidos na proposta e cobrados do cliente (parcelas maiores).</div>
        <div><b>Loja assume:</b> os juros são absorvidos pela loja e reduzem o valor líquido da venda (Bruto − Juros − RT).</div>
      </div>
    </div>
  );
}
