import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { toast } from "sonner";

// ============= Bancos =============
type Conta = { id: string; nome: string; banco?: string; agencia?: string; conta?: string; tipo_conta?: string; chave_pix?: string; saldo_inicial: number; ativo: boolean; observacoes?: string };

export function SaaSBancosTab() {
  const { user } = useAuth();
  const [contas, setContas] = useState<Conta[]>([]);
  const [editing, setEditing] = useState<Partial<Conta> | null>(null);

  const carregar = async () => {
    const { data } = await supabase.from("saas_contas_bancarias" as any).select("*").order("nome");
    setContas((data || []) as any);
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!editing?.nome) { toast.error("Nome obrigatório"); return; }
    const payload: any = {
      nome: editing.nome, banco: editing.banco || null, agencia: editing.agencia || null,
      conta: editing.conta || null, tipo_conta: editing.tipo_conta || null,
      chave_pix: editing.chave_pix || null, saldo_inicial: Number(editing.saldo_inicial || 0),
      ativo: editing.ativo ?? true, observacoes: editing.observacoes || null,
    };
    const err = editing.id
      ? (await supabase.from("saas_contas_bancarias" as any).update({ ...payload, atualizado_por: user?.id ?? null }).eq("id", editing.id)).error
      : (await supabase.from("saas_contas_bancarias" as any).insert({ ...payload, criado_por: user?.id ?? null })).error;
    if (err) toast.error(err.message); else { toast.success("Salvo"); setEditing(null); carregar(); }
  };

  const toggleAtivo = async (c: Conta) => {
    await supabase.from("saas_contas_bancarias" as any).update({ ativo: !c.ativo }).eq("id", c.id);
    carregar();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEditing({ ativo: true, saldo_inicial: 0 })} className="gap-1"><Plus className="w-4 h-4" /> Nova conta</Button></div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase"><tr>
            <th className="text-left p-2">Nome</th><th className="text-left p-2">Banco</th>
            <th className="text-left p-2">Agência/Conta</th><th className="text-left p-2">Tipo</th>
            <th className="text-right p-2">Saldo inicial</th><th className="text-left p-2">Status</th>
            <th className="text-right p-2">Ações</th>
          </tr></thead>
          <tbody>
            {contas.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma conta cadastrada</td></tr>}
            {contas.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/20">
                <td className="p-2 font-medium">{c.nome}</td>
                <td className="p-2">{c.banco || "—"}</td>
                <td className="p-2">{c.agencia || "—"} / {c.conta || "—"}</td>
                <td className="p-2">{c.tipo_conta || "—"}</td>
                <td className="p-2 text-right">{Number(c.saldo_inicial || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td className="p-2"><Badge className={c.ativo ? "bg-emerald-100 text-emerald-800 border-0" : "bg-zinc-200 text-zinc-700 border-0"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleAtivo(c)}>{c.ativo ? "Inativar" : "Ativar"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editing.id ? "Editar conta" : "Nova conta bancária SaaS"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><Label className="text-xs">Nome</Label><Input value={editing.nome || ""} onChange={(e)=>setEditing({...editing, nome: e.target.value})} /></div>
              <div><Label className="text-xs">Banco</Label><Input value={editing.banco || ""} onChange={(e)=>setEditing({...editing, banco: e.target.value})} /></div>
              <div><Label className="text-xs">Tipo</Label><Input value={editing.tipo_conta || ""} onChange={(e)=>setEditing({...editing, tipo_conta: e.target.value})} placeholder="corrente / poupança" /></div>
              <div><Label className="text-xs">Agência</Label><Input value={editing.agencia || ""} onChange={(e)=>setEditing({...editing, agencia: e.target.value})} /></div>
              <div><Label className="text-xs">Conta</Label><Input value={editing.conta || ""} onChange={(e)=>setEditing({...editing, conta: e.target.value})} /></div>
              <div><Label className="text-xs">Chave Pix</Label><Input value={editing.chave_pix || ""} onChange={(e)=>setEditing({...editing, chave_pix: e.target.value})} /></div>
              <div><Label className="text-xs">Saldo inicial</Label><Input type="number" step="0.01" value={editing.saldo_inicial ?? 0} onChange={(e)=>setEditing({...editing, saldo_inicial: Number(e.target.value)})} /></div>
              <div className="col-span-2 flex items-center gap-2"><Switch checked={editing.ativo ?? true} onCheckedChange={(v)=>setEditing({...editing, ativo: v})} /><Label className="text-xs">Ativa</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============= Categorias =============
type Cat = { id: string; nome: string; tipo: "receita" | "despesa"; parent_id: string | null; ordem: number; contabilizar_dre: boolean; ativo: boolean };

export function SaaSCategoriasTab() {
  const { user } = useAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [tipoTab, setTipoTab] = useState<"receita" | "despesa">("receita");

  const carregar = async () => {
    const { data } = await supabase.from("saas_categorias_financeiras" as any).select("*").order("ordem");
    setCats((data || []) as any);
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!editing?.nome || !editing.tipo) { toast.error("Nome e tipo obrigatórios"); return; }
    const payload: any = {
      nome: editing.nome, tipo: editing.tipo, parent_id: editing.parent_id || null,
      ordem: editing.ordem ?? 0, contabilizar_dre: editing.contabilizar_dre ?? true, ativo: editing.ativo ?? true,
    };
    const err = editing.id
      ? (await supabase.from("saas_categorias_financeiras" as any).update({ ...payload, atualizado_por: user?.id ?? null }).eq("id", editing.id)).error
      : (await supabase.from("saas_categorias_financeiras" as any).insert({ ...payload, criado_por: user?.id ?? null })).error;
    if (err) toast.error(err.message); else { toast.success("Salvo"); setEditing(null); carregar(); }
  };
  const toggle = async (c: Cat) => {
    await supabase.from("saas_categorias_financeiras" as any).update({ ativo: !c.ativo }).eq("id", c.id);
    carregar();
  };

  const lista = cats.filter((c) => c.tipo === tipoTab);
  const candidatosParent = lista.filter((c) => !c.parent_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Tabs value={tipoTab} onValueChange={(v)=>setTipoTab(v as any)}>
          <TabsList><TabsTrigger value="receita">Receitas</TabsTrigger><TabsTrigger value="despesa">Despesas</TabsTrigger></TabsList>
        </Tabs>
        <Button size="sm" onClick={() => setEditing({ tipo: tipoTab, ativo: true, contabilizar_dre: true, ordem: 0 })} className="gap-1"><Plus className="w-4 h-4" /> Nova categoria</Button>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase"><tr>
            <th className="text-left p-2">Nome</th><th className="text-left p-2">Pai</th>
            <th className="text-center p-2">DRE</th><th className="text-left p-2">Status</th>
            <th className="text-right p-2">Ações</th>
          </tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/20">
                <td className="p-2 font-medium">{c.parent_id ? "↳ " : ""}{c.nome}</td>
                <td className="p-2">{c.parent_id ? cats.find(x=>x.id===c.parent_id)?.nome : "—"}</td>
                <td className="p-2 text-center">{c.contabilizar_dre ? "Sim" : "Não"}</td>
                <td className="p-2"><Badge className={c.ativo ? "bg-emerald-100 text-emerald-800 border-0" : "bg-zinc-200 text-zinc-700 border-0"}>{c.ativo ? "Ativa" : "Inativa"}</Badge></td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(c)}>{c.ativo ? "Inativar" : "Ativar"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Nova"} categoria SaaS</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><Label className="text-xs">Nome</Label><Input value={editing.nome || ""} onChange={(e)=>setEditing({...editing, nome: e.target.value})} /></div>
              <div><Label className="text-xs">Tipo</Label>
                <Select value={editing.tipo || tipoTab} onValueChange={(v)=>setEditing({...editing, tipo: v as any, parent_id: null})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Categoria pai (opcional)</Label>
                <Select value={editing.parent_id || ""} onValueChange={(v)=>setEditing({...editing, parent_id: v || null})}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    {candidatosParent.filter(c => c.id !== editing.id).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Ordem</Label><Input type="number" value={editing.ordem ?? 0} onChange={(e)=>setEditing({...editing, ordem: Number(e.target.value)})} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.contabilizar_dre ?? true} onCheckedChange={(v)=>setEditing({...editing, contabilizar_dre: v})} /><Label className="text-xs">Contabilizar no DRE</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editing.ativo ?? true} onCheckedChange={(v)=>setEditing({...editing, ativo: v})} /><Label className="text-xs">Ativa</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============= Centros de Custo =============
type Centro = { id: string; nome: string; descricao?: string; ordem: number; ativo: boolean };

export function SaaSCentrosCustoTab() {
  const { user } = useAuth();
  const [centros, setCentros] = useState<Centro[]>([]);
  const [editing, setEditing] = useState<Partial<Centro> | null>(null);

  const carregar = async () => {
    const { data } = await supabase.from("saas_centros_custo" as any).select("*").order("ordem");
    setCentros((data || []) as any);
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!editing?.nome) { toast.error("Nome obrigatório"); return; }
    const payload: any = { nome: editing.nome, descricao: editing.descricao || null, ordem: editing.ordem ?? 0, ativo: editing.ativo ?? true };
    const err = editing.id
      ? (await supabase.from("saas_centros_custo" as any).update({ ...payload, atualizado_por: user?.id ?? null }).eq("id", editing.id)).error
      : (await supabase.from("saas_centros_custo" as any).insert({ ...payload, criado_por: user?.id ?? null })).error;
    if (err) toast.error(err.message); else { toast.success("Salvo"); setEditing(null); carregar(); }
  };
  const toggle = async (c: Centro) => {
    await supabase.from("saas_centros_custo" as any).update({ ativo: !c.ativo }).eq("id", c.id);
    carregar();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEditing({ ativo: true, ordem: 0 })} className="gap-1"><Plus className="w-4 h-4" /> Novo centro</Button></div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase"><tr>
            <th className="text-left p-2">Nome</th><th className="text-left p-2">Descrição</th>
            <th className="text-left p-2">Status</th><th className="text-right p-2">Ações</th>
          </tr></thead>
          <tbody>
            {centros.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/20">
                <td className="p-2 font-medium">{c.nome}</td>
                <td className="p-2">{c.descricao || "—"}</td>
                <td className="p-2"><Badge className={c.ativo ? "bg-emerald-100 text-emerald-800 border-0" : "bg-zinc-200 text-zinc-700 border-0"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(c)}>{c.ativo ? "Inativar" : "Ativar"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Novo"} centro de custo SaaS</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div><Label className="text-xs">Nome</Label><Input value={editing.nome || ""} onChange={(e)=>setEditing({...editing, nome: e.target.value})} /></div>
              <div><Label className="text-xs">Descrição</Label><Input value={editing.descricao || ""} onChange={(e)=>setEditing({...editing, descricao: e.target.value})} /></div>
              <div><Label className="text-xs">Ordem</Label><Input type="number" value={editing.ordem ?? 0} onChange={(e)=>setEditing({...editing, ordem: Number(e.target.value)})} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.ativo ?? true} onCheckedChange={(v)=>setEditing({...editing, ativo: v})} /><Label className="text-xs">Ativo</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
