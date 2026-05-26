import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Settings, Percent, ShieldCheck, Save, Building2, Users, Banknote,
  CreditCard, Handshake, Tags, MessageSquare, FileText, Plus, Pencil, Trash2, KanbanSquare, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { maskPhone } from "@/lib/masks";
import { PermissoesAdmin } from "@/components/PermissoesAdmin";
import { CrmEstagiosAdmin } from "@/components/CrmEstagiosAdmin";

import { AgendaAdmin } from "@/components/AgendaAdmin";
import { PoliticaJurosAdmin } from "@/components/PoliticaJurosAdmin";
import { EtiquetasAdmin } from "@/components/EtiquetasAdmin";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  diretor: "Diretor",
  gerente: "Gerente de Loja",
  vendedor: "Vendedor / Consultor",
  projetista: "Projetista",
  financeiro: "Financeiro",
  tecnico: "Técnico",
  montador: "Montador",
  assistencia: "Assistência / Pós-venda",
};
const ROLES = ["admin","diretor","gerente","vendedor","projetista","financeiro","tecnico","montador","assistencia"];

export default function Administracao() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "usuarios";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles")
        .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user]);

  if (isAdmin === false) return <Navigate to="/dashboard" replace />;
  if (isAdmin === null) return <div className="text-center py-20 text-muted-foreground text-[13px]">Verificando permissões…</div>;

  return (
    <div>
      <PageHeader
        icon={Settings} iconVariant="purple"
        title="Administração"
        subtitle="Controles do sistema, usuários, cadastros e regras"
      />

      <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="usuarios"><Users className="w-3.5 h-3.5 mr-1.5" />Usuários</TabsTrigger>
          <TabsTrigger value="permissoes"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Permissões</TabsTrigger>
          <TabsTrigger value="lojas"><Building2 className="w-3.5 h-3.5 mr-1.5" />Lojas</TabsTrigger>
          <TabsTrigger value="parceiros"><Handshake className="w-3.5 h-3.5 mr-1.5" />Parceiros</TabsTrigger>
          <TabsTrigger value="origens"><Tags className="w-3.5 h-3.5 mr-1.5" />Origens</TabsTrigger>
          <TabsTrigger value="etiquetas"><Tags className="w-3.5 h-3.5 mr-1.5" />Etiquetas</TabsTrigger>
          <TabsTrigger value="mensagens"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Mensagens</TabsTrigger>
          <TabsTrigger value="contrato"><FileText className="w-3.5 h-3.5 mr-1.5" />Contrato</TabsTrigger>
          <TabsTrigger value="crm"><KanbanSquare className="w-3.5 h-3.5 mr-1.5" />CRM</TabsTrigger>
          <TabsTrigger value="agenda"><CalendarDays className="w-3.5 h-3.5 mr-1.5" />Agenda</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4"><Usuarios /></TabsContent>
        <TabsContent value="permissoes" className="mt-4"><PermissoesAdmin /></TabsContent>
        <TabsContent value="lojas" className="mt-4"><Lojas /></TabsContent>
        <TabsContent value="parceiros" className="mt-4"><Parceiros /></TabsContent>
        <TabsContent value="origens" className="mt-4"><OrigensLead /></TabsContent>
        <TabsContent value="etiquetas" className="mt-4"><EtiquetasAdmin /></TabsContent>
        <TabsContent value="mensagens" className="mt-4"><TemplatesMensagem /></TabsContent>
        <TabsContent value="contrato" className="mt-4"><TemplateContrato /></TabsContent>
        <TabsContent value="crm" className="mt-4"><CrmEstagiosAdmin /></TabsContent>
        <TabsContent value="agenda" className="mt-4"><AgendaAdmin /></TabsContent>

        {/* Conteúdo acessível apenas via sidebar (submenu Financeiro) */}
        <TabsContent value="descontos" className="mt-4"><RegrasDesconto /></TabsContent>
        <TabsContent value="juros" className="mt-4"><PoliticaJurosAdmin /></TabsContent>
        <TabsContent value="bancos" className="mt-4"><Bancos /></TabsContent>
        <TabsContent value="pagamentos" className="mt-4"><MetodosPagamento /></TabsContent>
        <TabsContent value="categorias" className="mt-4"><CategoriasFinanceiras /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== REGRAS DE DESCONTO ============================== */
type Regra = { id: string; role: string; desconto_max_perc: number; ativo: boolean };

function RegrasDesconto() {
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("regras_aprovacao").select("*").order("role");
    if (error) toast.error(error.message);
    setRegras((data ?? []) as Regra[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<Regra>) =>
    setRegras((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));

  const salvar = async () => {
    setSaving(true);
    for (const r of regras) {
      const { error } = await supabase.from("regras_aprovacao")
        .update({ desconto_max_perc: r.desconto_max_perc, ativo: r.ativo })
        .eq("id", r.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success("Regras de desconto atualizadas");
  };

  const adicionarRole = async (role: string) => {
    if (regras.some((r) => r.role === role)) return toast.info("Cargo já cadastrado");
    const { error } = await supabase.from("regras_aprovacao").insert({ role: role as any, desconto_max_perc: 0, ativo: true });
    if (error) return toast.error(error.message);
    load();
  };

  const cargosFaltantes = ROLES.filter((r) => !regras.some((x) => x.role === r));

  return (
    <div className="surface-card p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Percent className="w-5 h-5 text-[#2D6BE5]" />
        <h2 className="text-[18px] font-semibold">Regras de Desconto por Cargo</h2>
      </div>
      <p className="text-[13px] text-muted-foreground mb-5">
        Defina o limite de desconto que cada cargo pode conceder sem precisar da senha do gestor.
      </p>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-[13px]">Carregando…</div>
      ) : (
        <div className="space-y-3">
          {regras.map((r) => (
            <div key={r.id} className="flex items-center gap-4 border border-border rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold">{ROLE_LABEL[r.role] || r.role}</div>
                <div className="text-[12px] text-muted-foreground">
                  {r.role === "admin" ? "Pode autorizar descontos sem limite" : "Limite máximo sem senha do gestor"}
                </div>
              </div>
              <div className="relative">
                <Input type="number" min={0} max={100} step={0.01}
                  value={r.desconto_max_perc}
                  onChange={(e) => update(r.id, { desconto_max_perc: Number(e.target.value) || 0 })}
                  className="w-28 pr-8 text-right" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
              </div>
              <Switch checked={r.ativo} onCheckedChange={(v) => update(r.id, { ativo: v })} />
            </div>
          ))}
        </div>
      )}

      {cargosFaltantes.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">Adicionar cargo:</span>
          {cargosFaltantes.map((r) => (
            <Button key={r} size="sm" variant="outline" onClick={() => adicionarRole(r)}>
              <Plus className="w-3 h-3 mr-1" />{ROLE_LABEL[r] || r}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={salvar} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" /> {saving ? "Salvando…" : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}

/* ============================== USUÁRIOS ============================== */
type Profile = { id: string; user_id: string; nome_completo: string | null; loja_id: string | null; ativo: boolean; telefone: string | null };
type Loja = { id: string; nome: string };
type UserRole = { user_id: string; role: string };

function Usuarios() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ email: "", password: "", nome_completo: "", role: "vendedor", loja_id: "", telefone: "" });

  const load = async () => {
    const [p, r, l] = await Promise.all([
      supabase.from("profiles").select("*").order("nome_completo"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("lojas").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setRoles((r.data ?? []) as UserRole[]);
    setLojas((l.data ?? []) as Loja[]);
  };
  useEffect(() => { load(); }, []);

  const roleOf = (uid: string) => roles.find((x) => x.user_id === uid)?.role || "—";
  const lojaNome = (id: string | null) => lojas.find((l) => l.id === id)?.nome || "—";

  const onCreate = () => {
    setEditing(null);
    setForm({ email: "", password: "", nome_completo: "", role: "vendedor", loja_id: "", telefone: "" });
    setOpen(true);
  };
  const onEdit = (p: Profile) => {
    setEditing(p);
    setForm({ email: "", password: "", nome_completo: p.nome_completo || "", role: roleOf(p.user_id), loja_id: p.loja_id || "", telefone: p.telefone || "" });
    setOpen(true);
  };

  const salvar = async () => {
    try {
      if (editing) {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ user_id: editing.user_id, nome_completo: form.nome_completo, role: form.role, loja_id: form.loja_id || null, telefone: form.telefone || null }),
        });
        if (!r.ok) throw new Error((await r.json()).error || "Erro ao atualizar");
        toast.success("Usuário atualizado");
      } else {
        if (!form.email || !form.password) return toast.error("Email e senha obrigatórios");
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ email: form.email, password: form.password, full_name: form.nome_completo, role: form.role, store_id: form.loja_id || null, telefone: form.telefone || null }),
        });
        if (!r.ok) throw new Error((await r.json()).error || "Erro ao criar");
        toast.success("Usuário criado");
      }
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2"><Users className="w-5 h-5 text-[#2D6BE5]" /><h2 className="text-[18px] font-semibold">Usuários</h2></div>
          <p className="text-[13px] text-muted-foreground">Cadastre e gerencie acessos do sistema.</p>
        </div>
        <Button onClick={onCreate} size="sm"><Plus className="w-4 h-4 mr-1" />Novo Usuário</Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">Nome</th><th className="px-3 py-2">Cargo</th>
              <th className="px-3 py-2">Loja</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{p.nome_completo || "—"}</td>
                <td className="px-3 py-2">{ROLE_LABEL[roleOf(p.user_id)] || roleOf(p.user_id)}</td>
                <td className="px-3 py-2">{lojaNome(p.loja_id)}</td>
                <td className="px-3 py-2">{p.ativo ? "Ativo" : "Inativo"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum usuário</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Senha</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              </>
            )}
            <div><Label>Nome completo</Label><Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
            <div><Label>Telefone (WhatsApp)</Label><Input placeholder="(11) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} /></div>
            <div>
              <Label>Cargo</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Loja</Label>
              <Select value={form.loja_id || undefined} onValueChange={(v) => setForm({ ...form, loja_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================== CRUD GENÉRICO ============================== */
type SimpleField = { name: string; label: string; type?: "text" | "number" | "switch" | "textarea"; placeholder?: string };

function SimpleCrud({
  title, subtitle, icon: Icon, table, fields, defaultRow, orderBy = "nome",
}: {
  title: string; subtitle: string; icon: any; table: string;
  fields: SimpleField[]; defaultRow: any; orderBy?: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(defaultRow);

  const load = async () => {
    const { data, error } = await (supabase as any).from(table).select("*").order(orderBy);
    if (error) return toast.error(error.message);
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [table]);

  const onNew = () => { setEditing(null); setForm(defaultRow); setOpen(true); };
  const onEdit = (r: any) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const salvar = async () => {
    const payload: any = {};
    for (const f of fields) payload[f.name] = form[f.name] ?? null;
    if ("ativo" in defaultRow && form.ativo === undefined) payload.ativo = true;
    if ("ativo" in defaultRow) payload.ativo = !!form.ativo;
    const op = editing
      ? (supabase as any).from(table).update(payload).eq("id", editing.id)
      : (supabase as any).from(table).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Atualizado" : "Cadastrado");
    setOpen(false); load();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído"); load();
  };

  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-[#2D6BE5]" /><h2 className="text-[18px] font-semibold">{title}</h2></div>
          <p className="text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
        <Button onClick={onNew} size="sm"><Plus className="w-4 h-4 mr-1" />Novo</Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50">
            <tr className="text-left">
              {fields.filter((f) => f.type !== "textarea").map((f) => <th key={f.name} className="px-3 py-2">{f.label}</th>)}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                {fields.filter((f) => f.type !== "textarea").map((f) => (
                  <td key={f.name} className="px-3 py-2">
                    {f.type === "switch" ? (r[f.name] ? "Sim" : "Não") : (r[f.name] ?? "—")}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => excluir(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={fields.length + 1} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.name}>
                <Label>{f.label}</Label>
                {f.type === "switch" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Switch checked={!!form[f.name]} onCheckedChange={(v) => setForm({ ...form, [f.name]: v })} />
                    <span className="text-[12px] text-muted-foreground">{form[f.name] ? "Ativo" : "Inativo"}</span>
                  </div>
                ) : f.type === "textarea" ? (
                  <Textarea value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} rows={4} />
                ) : (
                  <Input type={f.type === "number" ? "number" : "text"} placeholder={f.placeholder}
                    value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================== INSTÂNCIAS ============================== */
function Lojas() {
  return <SimpleCrud title="Lojas" subtitle="Filiais e unidades de negócio" icon={Building2} table="lojas"
    fields={[
      { name: "nome", label: "Nome" },
      { name: "cnpj", label: "CNPJ" },
      { name: "telefone", label: "Telefone" },
      { name: "email", label: "Email" },
      { name: "endereco", label: "Endereço", type: "textarea" },
      { name: "ativo", label: "Ativo", type: "switch" },
    ]}
    defaultRow={{ nome: "", cnpj: "", telefone: "", email: "", endereco: "", ativo: true }} />;
}

function Bancos() {
  return <SimpleCrud title="Contas Bancárias" subtitle="Bancos e contas para conciliação financeira" icon={Banknote} table="contas_bancarias"
    fields={[
      { name: "nome", label: "Nome" },
      { name: "banco", label: "Banco" },
      { name: "agencia", label: "Agência" },
      { name: "conta", label: "Conta" },
      { name: "saldo_inicial", label: "Saldo inicial", type: "number" },
      { name: "ativo", label: "Ativo", type: "switch" },
    ]}
    defaultRow={{ nome: "", banco: "", agencia: "", conta: "", saldo_inicial: 0, ativo: true }} />;
}

function MetodosPagamento() {
  return <SimpleCrud title="Métodos de Pagamento" subtitle="Formas de pagamento, taxas e parcelamento máximo" icon={CreditCard} table="metodos_pagamento"
    fields={[
      { name: "nome", label: "Nome" },
      { name: "taxa_perc_parcela", label: "Taxa por parcela (% a.m.)", type: "number", placeholder: "Ex.: 1.5" },
      { name: "max_parcelas", label: "Máximo de parcelas", type: "number", placeholder: "Ex.: 12" },
      { name: "ativo", label: "Ativo", type: "switch" },
    ]}
    defaultRow={{ nome: "", taxa_perc_parcela: 0, max_parcelas: 12, ativo: true }} />;
}

function Parceiros() {
  return <SimpleCrud title="Parceiros / Indicadores" subtitle="Arquitetos e parceiros com comissão" icon={Handshake} table="parceiros"
    fields={[
      { name: "nome", label: "Nome" },
      { name: "percentual_padrao", label: "% Comissão padrão", type: "number" },
      { name: "ativo", label: "Ativo", type: "switch" },
    ]}
    defaultRow={{ nome: "", percentual_padrao: 10, ativo: true }} />;
}

function CategoriasFinanceiras() {
  return <SimpleCrud title="Categorias Financeiras" subtitle="Categorias para receitas e despesas" icon={Tags} table="categorias_financeiras" orderBy="ordem"
    fields={[
      { name: "nome", label: "Nome" },
      { name: "tipo", label: "Tipo (receita/despesa)" },
      { name: "ordem", label: "Ordem", type: "number" },
    ]}
    defaultRow={{ nome: "", tipo: "despesa", ordem: 0 }} />;
}

function OrigensLead() {
  return <SimpleCrud title="Origens de Lead" subtitle="Canais de captação de clientes" icon={Tags} table="origens_lead"
    fields={[
      { name: "nome", label: "Nome" },
      { name: "ativo", label: "Ativo", type: "switch" },
    ]}
    defaultRow={{ nome: "", ativo: true }} />;
}

function TemplatesMensagem() {
  return <SimpleCrud title="Templates de Mensagem" subtitle="Modelos de WhatsApp e email" icon={MessageSquare} table="templates_mensagem"
    fields={[
      { name: "nome", label: "Nome" },
      { name: "canal", label: "Canal (whatsapp/email)" },
      { name: "conteudo", label: "Conteúdo", type: "textarea" },
      { name: "ativo", label: "Ativo", type: "switch" },
    ]}
    defaultRow={{ nome: "", canal: "whatsapp", conteudo: "", ativo: true }} />;
}

/* ============================== TEMPLATE DE CONTRATO ============================== */
function TemplateContrato() {
  const [lojas, setLojas] = useState<{ id: string; nome: string }[]>([]);
  const [lojaAtiva, setLojaAtiva] = useState<string>("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tpl, setTpl] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const novoTemplate = (loja_id: string) => ({
    loja_id,
    nome: "Novo template",
    titulo: "CONTRATO DE COMPRA E VENDA",
    subtitulo: "CONTRATO DE COMPRA E VENDA DE PRODUTOS E DE PRESTAÇÃO DE SERVIÇOS",
    clausulas: "",
    observacoes_padrao: "",
    rodape: "",
    ativo: true,
  });

  useEffect(() => {
    (async () => {
      const { data: ls } = await supabase.from("lojas").select("id,nome").eq("ativo", true).order("nome");
      const list = (ls || []) as any[];
      setLojas(list);
      if (list.length && !lojaAtiva) setLojaAtiva(list[0].id);
      setLoading(false);
    })();
  }, []);

  const carregar = async (loja_id: string) => {
    const { data } = await supabase.from("contratos_template").select("*").eq("loja_id", loja_id).order("created_at");
    const arr = (data || []) as any[];
    setTemplates(arr);
    if (arr.length) {
      setSelectedId(arr[0].id);
      setTpl(arr[0]);
    } else {
      setSelectedId(null);
      setTpl(novoTemplate(loja_id));
    }
  };

  useEffect(() => { if (lojaAtiva) carregar(lojaAtiva); }, [lojaAtiva]);

  const selecionar = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t) { setSelectedId(id); setTpl(t); }
  };

  const novo = () => {
    setSelectedId(null);
    setTpl(novoTemplate(lojaAtiva));
  };

  const salvar = async () => {
    if (!tpl || !lojaAtiva) return;
    setSaving(true);
    const payload = {
      loja_id: lojaAtiva,
      nome: tpl.nome, titulo: tpl.titulo, subtitulo: tpl.subtitulo,
      clausulas: tpl.clausulas, observacoes_padrao: tpl.observacoes_padrao,
      rodape: tpl.rodape, ativo: tpl.ativo,
    };
    const op = tpl.id
      ? supabase.from("contratos_template").update(payload).eq("id", tpl.id).select().maybeSingle()
      : supabase.from("contratos_template").insert(payload).select().maybeSingle();
    const { data, error } = await op as any;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Template salvo");
    await carregar(lojaAtiva);
    if (data?.id) { setSelectedId(data.id); setTpl(data); }
  };

  const excluir = async () => {
    if (!tpl?.id) return;
    if (!confirm("Excluir este template?")) return;
    const { error } = await supabase.from("contratos_template").delete().eq("id", tpl.id);
    if (error) return toast.error(error.message);
    toast.success("Template excluído");
    await carregar(lojaAtiva);
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground text-[13px]">Carregando…</div>;
  if (!lojas.length) return <div className="text-center py-10 text-muted-foreground text-[13px]">Nenhuma loja cadastrada.</div>;

  return (
    <div className="space-y-4">
      <Tabs value={lojaAtiva} onValueChange={setLojaAtiva}>
        <TabsList className="flex flex-wrap h-auto">
          {lojas.map((l) => (
            <TabsTrigger key={l.id} value={l.id} className="gap-1.5">
              <Building2 className="w-3.5 h-3.5" />{l.nome}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="surface-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2D6BE5]" />
            <h2 className="text-[18px] font-semibold">Templates de Contrato — {lojas.find((l) => l.id === lojaAtiva)?.nome}</h2>
          </div>
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <Select value={selectedId ?? ""} onValueChange={selecionar}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="Selecionar template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}{!t.ativo ? " (inativo)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={novo} className="gap-1.5"><Plus className="w-3.5 h-3.5" />Novo</Button>
            {tpl?.id && <Button variant="outline" size="sm" onClick={excluir} className="gap-1.5 text-destructive"><Trash2 className="w-3.5 h-3.5" />Excluir</Button>}
          </div>
        </div>

        <p className="text-[13px] text-muted-foreground">
          Variáveis disponíveis: <code className="bg-muted px-1 rounded">{`{{cliente_nome}}`}</code>, <code className="bg-muted px-1 rounded">{`{{cliente_cpf}}`}</code>, <code className="bg-muted px-1 rounded">{`{{empresa_nome}}`}</code>, <code className="bg-muted px-1 rounded">{`{{numero}}`}</code>, <code className="bg-muted px-1 rounded">{`{{valor_total}}`}</code>, <code className="bg-muted px-1 rounded">{`{{ambientes}}`}</code>, <code className="bg-muted px-1 rounded">{`{{pagamentos}}`}</code>, <code className="bg-muted px-1 rounded">{`{{data}}`}</code>.
        </p>

        {tpl && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome do template</Label><Input value={tpl.nome || ""} onChange={(e) => setTpl({ ...tpl, nome: e.target.value })} /></div>
              <div className="flex items-end gap-2"><Switch checked={!!tpl.ativo} onCheckedChange={(v) => setTpl({ ...tpl, ativo: v })} /><span className="text-[12px] text-muted-foreground pb-2">{tpl.ativo ? "Ativo" : "Inativo"}</span></div>
            </div>
            <div><Label>Título</Label><Input value={tpl.titulo || ""} onChange={(e) => setTpl({ ...tpl, titulo: e.target.value })} /></div>
            <div><Label>Subtítulo</Label><Input value={tpl.subtitulo ?? ""} onChange={(e) => setTpl({ ...tpl, subtitulo: e.target.value })} /></div>
            <div>
              <Label>Cláusulas</Label>
              <div className="bg-white rounded-md border border-input mt-1">
                <ContratoRichEditor value={tpl.clausulas || ""} onChange={(v) => setTpl({ ...tpl, clausulas: v })} />
              </div>
            </div>
            <div><Label>Observações padrão</Label><Textarea rows={4} value={tpl.observacoes_padrao ?? ""} onChange={(e) => setTpl({ ...tpl, observacoes_padrao: e.target.value })} /></div>
            <div><Label>Rodapé</Label><Textarea rows={3} value={tpl.rodape ?? ""} onChange={(e) => setTpl({ ...tpl, rodape: e.target.value })} /></div>

            <div className="flex justify-end">
              <Button onClick={salvar} disabled={saving} className="gap-1.5">
                <Save className="w-4 h-4" />{saving ? "Salvando…" : "Salvar Template"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ContratoRichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [Quill, setQuill] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    Promise.all([
      import("react-quill-new"),
      import("react-quill-new/dist/quill.snow.css"),
    ]).then(([m]) => { if (mounted) setQuill(() => m.default); });
    return () => { mounted = false; };
  }, []);
  if (!Quill) return <div className="p-4 text-[13px] text-muted-foreground">Carregando editor…</div>;
  return (
    <Quill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={{
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ indent: "-1" }, { indent: "+1" }],
          [{ align: [] }],
          ["blockquote", "code-block"],
          ["link"],
          ["clean"],
        ],
      }}
      style={{ minHeight: 360 }}
    />
  );
}
