import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Pencil, Trash2, Phone, FileText } from "lucide-react";
import { toast } from "sonner";
import { HistoricoParceiroDialog } from "@/components/parceiros/HistoricoParceiroDialog";

type Parceiro = {
  id: string; nome: string; tipo: string; email: string | null; telefone: string | null;
  cpf_cnpj: string | null; endereco: string | null; observacoes: string | null;
  percentual_padrao: number | null; ativo: boolean | null; data_nascimento: string | null;
};

type Tab = "fornecedor" | "indicador" | "prestador";

const tabLabels: Record<Tab, string> = {
  fornecedor: "Fornecedores",
  indicador: "Indicadores",
  prestador: "Prestadores",
};

export default function Parceiros() {
  const [tab, setTab] = useState<Tab>("fornecedor");
  const [busca, setBusca] = useState("");
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Partial<Parceiro> | null>(null);
  const [historicoFor, setHistoricoFor] = useState<Parceiro | null>(null);

  async function load() {
    const { data } = await supabase.from("parceiros").select("*").order("nome");
    setParceiros((data as Parceiro[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function salvar() {
    if (!edit?.nome) return toast.error("Nome obrigatório");
    const payload: any = {
      nome: edit.nome, tipo: edit.tipo || tab,
      email: edit.email, telefone: edit.telefone, cpf_cnpj: edit.cpf_cnpj,
      endereco: edit.endereco, observacoes: edit.observacoes,
      percentual_padrao: Number(edit.percentual_padrao) || 0,
      data_nascimento: edit.data_nascimento || null,
      ativo: edit.ativo ?? true,
    };
    const q = edit.id
      ? supabase.from("parceiros").update(payload).eq("id", edit.id)
      : supabase.from("parceiros").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setDialog(false); setEdit(null); load();
  }

  async function remover(id: string) {
    if (!confirm("Excluir parceiro?")) return;
    const { error } = await supabase.from("parceiros").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const lista = parceiros
    .filter((p) => p.tipo === tab)
    .filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="p-8 space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Parceiros</h2>
              <p className="text-sm text-muted-foreground">Fornecedores, parceiros e prestadores de serviço</p>
            </div>
          </div>
          <Button onClick={() => { setEdit({ tipo: tab }); setDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Registro
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <Input placeholder="Pesquisar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            {(Object.keys(tabLabels) as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-md text-xs uppercase tracking-wider font-medium ${tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                {tabLabels[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-3 sm:p-6">
        {/* Mobile cards */}
        <ul className="md:hidden divide-y -mx-3">
          {lista.map((p) => (
            <li key={p.id} className="px-3 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[14px] truncate">{p.nome}</div>
                  <div className="text-[11px] text-muted-foreground italic truncate">{p.email || "sem email cadastrado…"}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="uppercase text-[10px]">{p.tipo}</Badge>
                    {p.telefone && (
                      <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.telefone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">RT</div>
                  <div className="font-semibold text-purple-600 text-[14px]">
                    {p.percentual_padrao != null ? `${Number(p.percentual_padrao).toFixed(2)}%` : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setHistoricoFor(p)}><FileText className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { setEdit(p); setDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remover(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </li>
          ))}
          {!lista.length && <li className="py-12 text-center text-muted-foreground text-[12px]">Nenhum {tabLabels[tab].toLowerCase()} cadastrado</li>}
        </ul>

        {/* Desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <th className="text-left py-3">Nome / E-mail</th>
              <th className="text-left py-3">Tipo</th>
              <th className="text-left py-3">Telefone</th>
              <th className="text-right py-3">RT Padrão</th>
              <th className="text-right py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30">
                <td className="py-4">
                  <div className="font-medium">{p.nome}</div>
                  <div className="text-xs text-muted-foreground italic">{p.email || "sem email cadastrado…"}</div>
                </td>
                <td><Badge variant="secondary" className="uppercase text-[10px]">{p.tipo}</Badge></td>
                <td className="text-muted-foreground"><Phone className="w-3 h-3 inline mr-1" /> {p.telefone || "—"}</td>
                <td className="text-right font-semibold text-purple-600">{p.percentual_padrao != null ? `${Number(p.percentual_padrao).toFixed(2)}%` : "—"}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setHistoricoFor(p)}><FileText className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(p); setDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remover(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum {tabLabels[tab].toLowerCase()} cadastrado</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar parceiro" : "Novo parceiro"} — {tabLabels[(edit?.tipo as Tab) || tab]}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={edit?.nome || ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
              <div><Label>CPF / CNPJ</Label><Input value={edit?.cpf_cnpj || ""} onChange={(e) => setEdit({ ...edit, cpf_cnpj: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input type="email" value={edit?.email || ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={edit?.telefone || ""} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de nascimento</Label><Input type="date" value={edit?.data_nascimento || ""} onChange={(e) => setEdit({ ...edit, data_nascimento: e.target.value })} /></div>
              <div><Label>Endereço</Label><Input value={edit?.endereco || ""} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select className="w-full border rounded-md h-9 px-2 bg-background" value={edit?.tipo || tab} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="indicador">Indicador</option>
                  <option value="prestador">Prestador</option>
                </select>
              </div>
              <div><Label>RT Padrão (%)</Label><Input type="number" step="0.01" value={edit?.percentual_padrao ?? ""} onChange={(e) => setEdit({ ...edit, percentual_padrao: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Observações</Label>
              <textarea className="w-full border rounded-md p-2 min-h-[80px] bg-background text-sm"
                value={edit?.observacoes || ""} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <HistoricoParceiroDialog open={!!historicoFor} onClose={() => setHistoricoFor(null)} parceiro={historicoFor} />
    </div>
  );
}
