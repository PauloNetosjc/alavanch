import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Copy, Star, Power, Search } from "lucide-react";
import { toast } from "sonner";

type Op = any;
type Cfop = { id: string; codigo: string; descricao: string };

export function OperacoesFiscaisPanel() {
  const { selectedLojaId } = useLoja();
  const [list, setList] = useState<Op[]>([]);
  const [cfops, setCfops] = useState<Cfop[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Op> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("fiscal_operacoes" as any)
      .select("*, fiscal_cfops:cfop_id(codigo,descricao)")
      .order("nome");
    setList((data as any) || []);
    const { data: cf } = await supabase.from("fiscal_cfops" as any).select("id,codigo,descricao").eq("ativo", true).order("codigo");
    setCfops((cf as any) || []);
  };
  useEffect(() => { load(); }, [selectedLojaId]);

  const filtered = list.filter((o) =>
    !q || (o.nome || "").toLowerCase().includes(q.toLowerCase()) || (o.codigo_cfop || "").includes(q)
  );

  const salvar = async () => {
    if (!edit?.nome) { toast.error("Nome obrigatório"); return; }
    if (!edit?.cfop_id) { toast.error("Selecione um CFOP"); return; }
    setSaving(true);
    try {
      const cfop = cfops.find((c) => c.id === edit.cfop_id);
      const payload: any = {
        loja_id: edit.loja_id ?? selectedLojaId ?? null,
        nome: edit.nome, descricao: edit.descricao || null,
        cfop_id: edit.cfop_id, codigo_cfop: cfop?.codigo || edit.codigo_cfop || null,
        finalidade_nfe: edit.finalidade_nfe || "normal",
        tipo_nota: edit.tipo_nota || "saida",
        padrao: !!edit.padrao,
        remessa_industrializacao: !!edit.remessa_industrializacao,
        movimenta_estoque: edit.movimenta_estoque ?? true,
        movimenta_financeiro: edit.movimenta_financeiro ?? true,
        exige_pedido: !!edit.exige_pedido,
        ativo: edit.ativo ?? true,
        observacoes: edit.observacoes || null,
      };
      if (edit.id) {
        const { error } = await supabase.from("fiscal_operacoes" as any).update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fiscal_operacoes" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Operação fiscal salva");
      setEdit(null); load();
    } catch (e: any) { toast.error(e?.message); } finally { setSaving(false); }
  };

  const duplicar = (o: Op) => setEdit({ ...o, id: undefined, nome: `${o.nome} (cópia)`, padrao: false });
  const togglePadrao = async (o: Op) => {
    if (o.loja_id && !o.padrao) {
      await supabase.from("fiscal_operacoes" as any).update({ padrao: false })
        .eq("loja_id", o.loja_id).eq("tipo_nota", o.tipo_nota);
    }
    await supabase.from("fiscal_operacoes" as any).update({ padrao: !o.padrao }).eq("id", o.id);
    load();
  };
  const toggleAtivo = async (o: Op) => {
    await supabase.from("fiscal_operacoes" as any).update({ ativo: !o.ativo }).eq("id", o.id);
    load();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-medium">Operações Fiscais</h3>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground"/>
            <Input className="pl-7 h-9 w-64" placeholder="Buscar por nome ou CFOP" value={q} onChange={(e) => setQ(e.target.value)}/>
          </div>
          <Button size="sm" onClick={() => setEdit({ tipo_nota: "saida", finalidade_nfe: "normal", ativo: true, movimenta_estoque: true, movimenta_financeiro: true, loja_id: selectedLojaId })} className="gap-1">
            <Plus className="w-3.5 h-3.5"/> Nova operação
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">CFOP</th>
              <th className="text-left p-2">Finalidade</th>
              <th className="text-left p-2">Tipo nota</th>
              <th className="text-left p-2">Padrão</th>
              <th className="text-left p-2">Remessa Ind.</th>
              <th className="text-left p-2">Escopo</th>
              <th className="text-left p-2">Ativo</th>
              <th className="text-right p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t hover:bg-muted/30">
                <td className="p-2">{o.nome}</td>
                <td className="p-2 font-mono">{o.codigo_cfop || o.fiscal_cfops?.codigo}</td>
                <td className="p-2 capitalize">{o.finalidade_nfe}</td>
                <td className="p-2 capitalize">{o.tipo_nota}</td>
                <td className="p-2">{o.padrao ? <Badge>Padrão</Badge> : "—"}</td>
                <td className="p-2">{o.remessa_industrializacao ? "Sim" : "Não"}</td>
                <td className="p-2">{o.loja_id ? <Badge variant="outline">Loja</Badge> : <Badge variant="secondary">Global</Badge>}</td>
                <td className="p-2">{o.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(o)}><Pencil className="w-3.5 h-3.5"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicar(o)}><Copy className="w-3.5 h-3.5"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => togglePadrao(o)} title="Marcar como padrão"><Star className={`w-3.5 h-3.5 ${o.padrao ? "fill-current" : ""}`}/></Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleAtivo(o)}><Power className="w-3.5 h-3.5"/></Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground text-xs">Nenhuma operação fiscal cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Nova"} operação fiscal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={edit?.nome || ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })}/></div>
              <div>
                <Label>CFOP *</Label>
                <Select value={edit?.cfop_id || ""} onValueChange={(v) => setEdit({ ...edit, cfop_id: v, codigo_cfop: cfops.find((c) => c.id === v)?.codigo })}>
                  <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                  <SelectContent>{cfops.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo nota</Label>
                <Select value={edit?.tipo_nota || "saida"} onValueChange={(v: any) => setEdit({ ...edit, tipo_nota: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Finalidade NF-e</Label>
                <Select value={edit?.finalidade_nfe || "normal"} onValueChange={(v) => setEdit({ ...edit, finalidade_nfe: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="complementar">Complementar</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="devolucao">Devolução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Escopo</Label>
                <Select value={edit?.loja_id ? "loja" : "global"} onValueChange={(v) => setEdit({ ...edit, loja_id: v === "loja" ? selectedLojaId : null })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loja">Loja atual</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SwitchRow label="Padrão" value={!!edit?.padrao} onChange={(v) => setEdit({ ...edit, padrao: v })}/>
              <SwitchRow label="Remessa para industrialização" value={!!edit?.remessa_industrializacao} onChange={(v) => setEdit({ ...edit, remessa_industrializacao: v })}/>
              <SwitchRow label="Movimenta estoque" value={edit?.movimenta_estoque ?? true} onChange={(v) => setEdit({ ...edit, movimenta_estoque: v })}/>
              <SwitchRow label="Movimenta financeiro" value={edit?.movimenta_financeiro ?? true} onChange={(v) => setEdit({ ...edit, movimenta_financeiro: v })}/>
              <SwitchRow label="Exige pedido" value={!!edit?.exige_pedido} onChange={(v) => setEdit({ ...edit, exige_pedido: v })}/>
              <SwitchRow label="Ativo" value={edit?.ativo ?? true} onChange={(v) => setEdit({ ...edit, ativo: v })}/>
            </div>
            <div><Label>Descrição</Label><Textarea value={edit?.descricao || ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between border rounded-md px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange}/>
    </div>
  );
}
