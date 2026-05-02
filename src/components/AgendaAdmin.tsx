import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CalendarDays, Plus, Trash2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const TIPOS = [
  { v: "apresentacao_comercial", l: "Apresentação Comercial" },
  { v: "medicao_tecnica",        l: "Medição Técnica" },
  { v: "revisao_final",          l: "Revisão Final" },
  { v: "entrega",                l: "Entrega" },
  { v: "montagem",               l: "Montagem" },
  { v: "assistencia_tecnica",    l: "Assistência Técnica" },
  { v: "tarefa_interna",         l: "Tarefa Interna" },
];
const DIAS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

interface Loja { id: string; nome: string }

export function AgendaAdmin() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("lojas").select("id,nome").eq("ativo", true).order("nome");
    setLojas((data as any) || []);
  })(); }, []);

  return (
    <div className="surface-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-5 h-5 text-[#2D6BE5]" />
        <h2 className="text-[18px] font-semibold">Agenda</h2>
      </div>
      <p className="text-[13px] text-muted-foreground mb-4">
        Configure regras por tipo de evento, feriados e autorizadores de exceção. Itens com loja em branco aplicam a todas as lojas.
      </p>

      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">Regras por tipo</TabsTrigger>
          <TabsTrigger value="feriados">Feriados</TabsTrigger>
          <TabsTrigger value="autorizadores">Autorizadores de exceção</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4"><ConfigTab lojas={lojas} /></TabsContent>
        <TabsContent value="feriados" className="mt-4"><FeriadosTab lojas={lojas} /></TabsContent>
        <TabsContent value="autorizadores" className="mt-4"><AutorizadoresTab lojas={lojas} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================== CONFIG =========================== */
interface Cfg {
  id?: string; loja_id: string | null; tipo: string;
  prazo_minimo_dias_uteis: number; dias_semana: number[];
  hora_inicio: string; hora_fim: string; duracao_padrao_min: number; ativo: boolean;
}
function ConfigTab({ lojas }: { lojas: Loja[] }) {
  const [rows, setRows] = useState<Cfg[]>([]);
  const [editing, setEditing] = useState<Cfg | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("agenda_config" as any).select("*").order("loja_id").order("tipo");
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const lojaNome = (id: string | null) => id ? (lojas.find(l => l.id === id)?.nome || "—") : "Todas";

  const onNovo = () => {
    setEditing({
      loja_id: null, tipo: "tarefa_interna", prazo_minimo_dias_uteis: 0,
      dias_semana: [1,2,3,4,5,6], hora_inicio: "08:00", hora_fim: "18:00",
      duracao_padrao_min: 60, ativo: true,
    });
    setOpen(true);
  };
  const onEdit = (r: Cfg) => { setEditing({ ...r }); setOpen(true); };
  const onDel = async (id: string) => {
    if (!confirm("Excluir esta regra?")) return;
    const { error } = await supabase.from("agenda_config" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const salvar = async () => {
    if (!editing) return;
    const payload: any = {
      loja_id: editing.loja_id || null, tipo: editing.tipo,
      prazo_minimo_dias_uteis: Number(editing.prazo_minimo_dias_uteis) || 0,
      dias_semana: editing.dias_semana.sort(),
      hora_inicio: editing.hora_inicio, hora_fim: editing.hora_fim,
      duracao_padrao_min: Number(editing.duracao_padrao_min) || 60,
      ativo: !!editing.ativo,
    };
    const op = editing.id
      ? supabase.from("agenda_config" as any).update(payload).eq("id", editing.id)
      : supabase.from("agenda_config" as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Regra salva"); setOpen(false); load();
  };

  const toggleDia = (d: number) => {
    if (!editing) return;
    const has = editing.dias_semana.includes(d);
    setEditing({ ...editing, dias_semana: has ? editing.dias_semana.filter(x => x !== d) : [...editing.dias_semana, d] });
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={onNovo}><Plus className="w-4 h-4 mr-1" />Nova regra</Button>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">Loja</th><th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Dias</th><th className="px-3 py-2">Horário</th>
              <th className="px-3 py-2">Prazo (dias úteis)</th><th className="px-3 py-2">Ativo</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{lojaNome(r.loja_id)}</td>
                <td className="px-3 py-2">{TIPOS.find(t => t.v === r.tipo)?.l || r.tipo}</td>
                <td className="px-3 py-2">{(r.dias_semana || []).map(d => DIAS[d]?.l).join(", ")}</td>
                <td className="px-3 py-2">{r.hora_inicio?.slice(0,5)}–{r.hora_fim?.slice(0,5)}</td>
                <td className="px-3 py-2">{r.prazo_minimo_dias_uteis}</td>
                <td className="px-3 py-2">{r.ativo ? "Sim" : "Não"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(r)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDel(r.id!)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhuma regra cadastrada</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Loja</Label>
                <Select value={editing.loja_id ?? "__all__"} onValueChange={(v) => setEditing({ ...editing, loja_id: v === "__all__" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as lojas</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={editing.tipo} onValueChange={(v) => setEditing({ ...editing, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dias permitidos</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {DIAS.map(d => (
                    <button
                      key={d.v} type="button"
                      onClick={() => toggleDia(d.v)}
                      className={`px-3 py-1 rounded border text-[12px] ${editing.dias_semana.includes(d.v) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                    >{d.l}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Hora início</Label><Input type="time" value={editing.hora_inicio} onChange={(e) => setEditing({ ...editing, hora_inicio: e.target.value })} /></div>
                <div><Label>Hora fim</Label><Input type="time" value={editing.hora_fim} onChange={(e) => setEditing({ ...editing, hora_fim: e.target.value })} /></div>
                <div><Label>Duração padrão (min)</Label><Input type="number" value={editing.duracao_padrao_min} onChange={(e) => setEditing({ ...editing, duracao_padrao_min: Number(e.target.value) })} /></div>
              </div>
              <div>
                <Label>Prazo mínimo (dias úteis após base, ex: venda)</Label>
                <Input type="number" min={0} value={editing.prazo_minimo_dias_uteis} onChange={(e) => setEditing({ ...editing, prazo_minimo_dias_uteis: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} /><Label>Ativo</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}><Save className="w-4 h-4 mr-1" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================== FERIADOS =========================== */
interface Feriado { id?: string; loja_id: string | null; data: string; descricao: string }
function FeriadosTab({ lojas }: { lojas: Loja[] }) {
  const [rows, setRows] = useState<Feriado[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Feriado | null>(null);

  const load = async () => {
    const { data } = await supabase.from("agenda_feriados" as any).select("*").order("data");
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const lojaNome = (id: string | null) => id ? (lojas.find(l => l.id === id)?.nome || "—") : "Todas";

  const onNovo = () => {
    setEditing({ loja_id: null, data: new Date().toISOString().slice(0,10), descricao: "" });
    setOpen(true);
  };
  const onDel = async (id: string) => {
    if (!confirm("Excluir feriado?")) return;
    const { error } = await supabase.from("agenda_feriados" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const salvar = async () => {
    if (!editing) return;
    if (!editing.descricao.trim()) return toast.error("Informe a descrição");
    const payload = { loja_id: editing.loja_id, data: editing.data, descricao: editing.descricao };
    const op = editing.id
      ? supabase.from("agenda_feriados" as any).update(payload).eq("id", editing.id)
      : supabase.from("agenda_feriados" as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Feriado salvo"); setOpen(false); load();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={onNovo}><Plus className="w-4 h-4 mr-1" />Novo feriado</Button>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50"><tr className="text-left">
            <th className="px-3 py-2">Data</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Loja</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                <td className="px-3 py-2">{r.descricao}</td>
                <td className="px-3 py-2">{lojaNome(r.loja_id)}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => onDel(r.id!)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Nenhum feriado</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo feriado</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Data</Label><Input type="date" value={editing.data} onChange={(e) => setEditing({ ...editing, data: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={editing.descricao} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} placeholder="Ex.: Natal, Feriado da Cidade" /></div>
              <div>
                <Label>Loja</Label>
                <Select value={editing.loja_id ?? "__all__"} onValueChange={(v) => setEditing({ ...editing, loja_id: v === "__all__" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as lojas</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}><Save className="w-4 h-4 mr-1" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================== AUTORIZADORES =========================== */
interface Auth { id?: string; loja_id: string | null; user_id: string; ativo: boolean }
function AutorizadoresTab({ lojas }: { lojas: Loja[] }) {
  const [rows, setRows] = useState<Auth[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; nome_completo: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Auth | null>(null);

  const load = async () => {
    const [r, p] = await Promise.all([
      supabase.from("agenda_excecao_autorizadores" as any).select("*").order("loja_id"),
      supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
    ]);
    setRows((r.data as any) || []);
    setProfiles((p.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const nomeUsuario = (uid: string) => profiles.find(p => p.user_id === uid)?.nome_completo || uid;
  const lojaNome = (id: string | null) => id ? (lojas.find(l => l.id === id)?.nome || "—") : "Todas";

  const onNovo = () => { setEditing({ loja_id: null, user_id: "", ativo: true }); setOpen(true); };
  const onDel = async (id: string) => {
    if (!confirm("Remover autorizador?")) return;
    const { error } = await supabase.from("agenda_excecao_autorizadores" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const toggleAtivo = async (r: Auth) => {
    const { error } = await supabase.from("agenda_excecao_autorizadores" as any).update({ ativo: !r.ativo }).eq("id", r.id!);
    if (error) return toast.error(error.message);
    load();
  };
  const salvar = async () => {
    if (!editing) return;
    if (!editing.user_id) return toast.error("Escolha o usuário");
    const { error } = await supabase.from("agenda_excecao_autorizadores" as any).insert({
      loja_id: editing.loja_id, user_id: editing.user_id, ativo: editing.ativo,
    });
    if (error) return toast.error(error.message);
    toast.success("Autorizador adicionado"); setOpen(false); load();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={onNovo}><Plus className="w-4 h-4 mr-1" />Novo autorizador</Button>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50"><tr className="text-left">
            <th className="px-3 py-2">Usuário</th><th className="px-3 py-2">Loja</th><th className="px-3 py-2">Ativo</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary" />{nomeUsuario(r.user_id)}</td>
                <td className="px-3 py-2">{lojaNome(r.loja_id)}</td>
                <td className="px-3 py-2"><Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} /></td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => onDel(r.id!)}><Trash2 className="w-3.5 h-3.5" /></Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Nenhum autorizador cadastrado</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo autorizador de exceção</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Usuário</Label>
                <Select value={editing.user_id} onValueChange={(v) => setEditing({ ...editing, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo || p.user_id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loja (em branco = autoriza para todas)</Label>
                <Select value={editing.loja_id ?? "__all__"} onValueChange={(v) => setEditing({ ...editing, loja_id: v === "__all__" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as lojas</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} /><Label>Ativo</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}><Save className="w-4 h-4 mr-1" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
