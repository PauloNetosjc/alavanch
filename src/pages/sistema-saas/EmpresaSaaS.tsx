import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Building, Package, Plus, Loader2, Save } from "lucide-react";
import { maskCnpj, maskPhone, maskCep, maskCpf } from "@/lib/masks";

// ============================================================
// Tipos
// ============================================================
type EmpresaConfig = {
  id?: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  responsavel_legal: string | null;
  responsavel_cpf: string | null;
  observacoes: string | null;
};

type Sistema = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  status: string;
  ativo: boolean;
  ordem: number;
};

const STATUS_SISTEMA = [
  { value: "ativo", label: "Ativo", className: "bg-emerald-100 text-emerald-800" },
  { value: "em_desenvolvimento", label: "Em desenvolvimento", className: "bg-blue-100 text-blue-800" },
  { value: "inativo", label: "Inativo", className: "bg-zinc-200 text-zinc-700" },
  { value: "descontinuado", label: "Descontinuado", className: "bg-red-100 text-red-800" },
];

const emptyEmpresa = (): EmpresaConfig => ({
  razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", inscricao_municipal: "",
  endereco: "", cidade: "", estado: "", cep: "", telefone: "", email: "", site: "",
  responsavel_legal: "", responsavel_cpf: "", observacoes: "",
});

// ============================================================
// Página principal
// ============================================================
export default function EmpresaSaaS() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display flex items-center gap-2">
          <Building className="w-5 h-5" /> Empresa SaaS
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados da empresa que comercializa os sistemas e catálogo de sistemas vendidos às bases.
        </p>
      </div>

      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="dados"><Building className="w-3.5 h-3.5 mr-1" /> Dados da Empresa</TabsTrigger>
          <TabsTrigger value="sistemas"><Package className="w-3.5 h-3.5 mr-1" /> Sistemas Vendidos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <DadosEmpresaTab />
        </TabsContent>
        <TabsContent value="sistemas" className="mt-4">
          <SistemasVendidosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Aba: Dados da Empresa
// ============================================================
function DadosEmpresaTab() {
  const { user } = useAuth();
  const [form, setForm] = useState<EmpresaConfig>(emptyEmpresa());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("empresa_saas_config" as any) as any)
      .select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) setForm(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = <K extends keyof EmpresaConfig>(k: K, v: EmpresaConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form, atualizado_por: user?.id ?? null };
      if (form.id) {
        const { error } = await (supabase.from("empresa_saas_config" as any) as any)
          .update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        delete payload.id;
        const { data, error } = await (supabase.from("empresa_saas_config" as any) as any)
          .insert(payload).select("id").single();
        if (error) throw error;
        setForm((f) => ({ ...f, id: (data as any).id }));
      }
      toast.success("Dados da empresa salvos");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="p-6 space-y-6">
      <Section title="Identificação">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Razão social">
            <Input value={form.razao_social || ""} onChange={(e) => set("razao_social", e.target.value)} />
          </Field>
          <Field label="Nome fantasia">
            <Input value={form.nome_fantasia || ""} onChange={(e) => set("nome_fantasia", e.target.value)} />
          </Field>
          <Field label="CNPJ">
            <Input value={form.cnpj || ""} onChange={(e) => set("cnpj", maskCnpj(e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inscrição estadual">
              <Input value={form.inscricao_estadual || ""} onChange={(e) => set("inscricao_estadual", e.target.value)} />
            </Field>
            <Field label="Inscrição municipal">
              <Input value={form.inscricao_municipal || ""} onChange={(e) => set("inscricao_municipal", e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-3"><Field label="Endereço">
            <Input value={form.endereco || ""} onChange={(e) => set("endereco", e.target.value)} />
          </Field></div>
          <Field label="CEP">
            <Input value={form.cep || ""} onChange={(e) => set("cep", maskCep ? maskCep(e.target.value) : e.target.value)} />
          </Field>
          <div className="md:col-span-2"><Field label="Cidade">
            <Input value={form.cidade || ""} onChange={(e) => set("cidade", e.target.value)} />
          </Field></div>
          <Field label="Estado (UF)">
            <Input maxLength={2} value={form.estado || ""} onChange={(e) => set("estado", e.target.value.toUpperCase())} />
          </Field>
        </div>
      </Section>

      <Section title="Contato">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Telefone">
            <Input value={form.telefone || ""} onChange={(e) => set("telefone", maskPhone(e.target.value))} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Site">
            <Input value={form.site || ""} onChange={(e) => set("site", e.target.value)} placeholder="https://" />
          </Field>
        </div>
      </Section>

      <Section title="Responsável legal">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Nome">
            <Input value={form.responsavel_legal || ""} onChange={(e) => set("responsavel_legal", e.target.value)} />
          </Field>
          <Field label="CPF">
            <Input value={form.responsavel_cpf || ""} onChange={(e) => set("responsavel_cpf", maskCpf ? maskCpf(e.target.value) : e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Observações">
        <Textarea rows={3} value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} />
      </Section>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar dados
        </Button>
      </div>
    </Card>
  );
}

// ============================================================
// Aba: Sistemas Vendidos
// ============================================================
function SistemasVendidosTab() {
  const { user } = useAuth();
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sistema | null>(null);
  const [form, setForm] = useState<Partial<Sistema>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("sistemas_saas" as any) as any)
      .select("*").order("ordem").order("nome");
    setSistemas((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const abrirNovo = () => { setEditing(null); setForm({ status: "ativo", ativo: true, ordem: sistemas.length + 1 }); setOpen(true); };
  const abrirEdit = (s: Sistema) => { setEditing(s); setForm({ ...s }); setOpen(true); };

  const slugify = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const salvar = async () => {
    if (!form.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome,
        slug: form.slug?.trim() || slugify(form.nome),
        descricao: form.descricao || null,
        status: form.status || "ativo",
        ativo: form.ativo ?? true,
        ordem: form.ordem ?? 0,
        atualizado_por: user?.id ?? null,
      };
      if (editing) {
        const { error } = await (supabase.from("sistemas_saas" as any) as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Sistema atualizado");
      } else {
        payload.criado_por = user?.id ?? null;
        const { error } = await (supabase.from("sistemas_saas" as any) as any).insert(payload);
        if (error) throw error;
        toast.success("Sistema criado");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Catálogo de sistemas/produtos que a empresa SaaS oferece às bases.
        </div>
        <Button onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4" /> Novo sistema</Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : sistemas.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum sistema cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Slug</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Ativo</th>
                <th className="text-left p-3">Ordem</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sistemas.map((s) => {
                const st = STATUS_SISTEMA.find((x) => x.value === s.status) || STATUS_SISTEMA[0];
                return (
                  <tr key={s.id} className="border-t hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium">{s.nome}</div>
                      {s.descricao && <div className="text-xs text-muted-foreground line-clamp-1">{s.descricao}</div>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{s.slug}</td>
                    <td className="p-3"><Badge className={`${st.className} border-0`}>{st.label}</Badge></td>
                    <td className="p-3 text-xs">{s.ativo ? "Sim" : "Não"}</td>
                    <td className="p-3 text-xs">{s.ordem}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdit(s)}>Editar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar sistema" : "Novo sistema"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="col-span-2"><Label>Slug (opcional)</Label>
              <Input value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="gerado automaticamente" />
            </div>
            <div className="col-span-2"><Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div><Label>Status</Label>
              <Select value={form.status || "ativo"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_SISTEMA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ordem</Label>
              <Input type="number" value={form.ordem ?? 0} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="ativo" checked={form.ativo ?? true} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              <Label htmlFor="ativo">Disponível para contratação</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Helpers UI
// ============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
