import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";

type Profile = { user_id: string; nome_completo: string | null };
type Aprov = { user_id: string; aprova_pagar: boolean; aprova_receber: boolean; loja_id: string | null };

export default function AprovadorConfig() {
  const { lojas, selectedLojaId } = useLoja();
  const [lojaId, setLojaId] = useState<string>(selectedLojaId || lojas[0]?.id || "");
  const [profs, setProfs] = useState<Profile[]>([]);
  const [map, setMap] = useState<Map<string, { pagar: boolean; receber: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!lojaId && lojas[0]) setLojaId(lojas[0].id); }, [lojas, lojaId]);

  useEffect(() => {
    if (!lojaId) return;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
        supabase.from("aprovadores_financeiros" as any).select("user_id, aprova_pagar, aprova_receber, loja_id").eq("loja_id", lojaId),
      ]);
      setProfs((p as Profile[]) || []);
      const m = new Map<string, { pagar: boolean; receber: boolean }>();
      ((a as unknown as Aprov[]) || []).forEach((x) => m.set(x.user_id, { pagar: x.aprova_pagar, receber: x.aprova_receber }));
      setMap(m);
      setLoading(false);
    })();
  }, [lojaId]);

  function toggle(userId: string, key: "pagar" | "receber", v: boolean) {
    const next = new Map(map);
    const cur = next.get(userId) || { pagar: false, receber: false };
    next.set(userId, { ...cur, [key]: v });
    setMap(next);
  }

  async function salvar() {
    if (!lojaId) return;
    await supabase.from("aprovadores_financeiros" as any).delete().eq("loja_id", lojaId);
    const rows = Array.from(map.entries())
      .filter(([, v]) => v.pagar || v.receber)
      .map(([user_id, v]) => ({ user_id, loja_id: lojaId, aprova_pagar: v.pagar, aprova_receber: v.receber }));
    if (rows.length) {
      const { error } = await supabase.from("aprovadores_financeiros" as any).insert(rows);
      if (error) return toast.error(error.message);
    }
    toast.success("Aprovadores salvos");
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded bg-amber-500/15 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-[15px] font-medium">Aprovador de Contas</div>
            <div className="text-[11px] text-muted-foreground">
              Defina quais usuários podem aprovar lançamentos de contas a pagar e/ou a receber. Lançamentos novos ficam pendentes até a aprovação.
            </div>
          </div>
        </div>

        <div className="max-w-xs mb-4">
          <Select value={lojaId} onValueChange={setLojaId}>
            <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
            <SelectContent>
              {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : profs.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Nenhum usuário disponível.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium">Usuário</th>
                  <th className="text-center py-2 px-3 font-medium w-40">Aprova A Pagar</th>
                  <th className="text-center py-2 px-3 font-medium w-40">Aprova A Receber</th>
                </tr>
              </thead>
              <tbody>
                {profs.map((p) => {
                  const v = map.get(p.user_id) || { pagar: false, receber: false };
                  return (
                    <tr key={p.user_id} className="border-b hover:bg-muted/20">
                      <td className="py-2 px-3">{p.nome_completo || p.user_id.slice(0, 8)}</td>
                      <td className="text-center">
                        <Checkbox checked={v.pagar} onCheckedChange={(c) => toggle(p.user_id, "pagar", !!c)} />
                      </td>
                      <td className="text-center">
                        <Checkbox checked={v.receber} onCheckedChange={(c) => toggle(p.user_id, "receber", !!c)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} className="gap-2"><Save className="w-3.5 h-3.5" />Salvar</Button>
      </div>
    </div>
  );
}
