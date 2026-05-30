import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Building2, Plus, Search, Loader2, History, Package, Users, Store, CreditCard } from "lucide-react";
import { AssinaturaCobrancaTab } from "@/components/saas/AssinaturaCobrancaTab";
import { maskCnpj, maskPhone } from "@/lib/masks";

type Base = {
  id: string;
  nome: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  email_responsavel: string | null;
  telefone_responsavel: string | null;
  responsavel_nome: string | null;
  status: string;
  plano: string;
  observacoes: string | null;
  data_inicio: string | null;
  data_cancelamento: string | null;
  created_at: string;
};

type Loja = { id: string; nome: string; ativo: boolean | null; base_cliente_id: string | null };
type Modulo = { chave: string; nome: string; categoria: string | null; essencial: boolean };
type ModuloLoja = { loja_id: string; modulo_chave: string; ativo: boolean; contratado: boolean };

const STATUS = [
  { value: "ativo", label: "Ativo", color: "bg-emerald-100 text-emerald-800" },
  { value: "teste", label: "Teste", color: "bg-blue-100 text-blue-800" },
  { value: "suspenso", label: "Suspenso", color: "bg-amber-100 text-amber-800" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800" },
];
const PLANOS = [
  { value: "basico", label: "Básico" },
  { value: "profissional", label: "Profissional" },
  { value: "completo", label: "Completo" },
  { value: "personalizado", label: "Personalizado" },
];

const PLANO_MODULOS: Record<string, string[]> = {
  basico: ["crm_comercial", "contratos", "agenda", "autorizacoes", "workflow_operacional"],
  profissional: ["crm_comercial", "contratos", "agenda", "autorizacoes", "workflow_operacional", "financeiro"],
  completo: ["crm_comercial", "contratos", "agenda", "autorizacoes", "workflow_operacional", "financeiro", "fabrica", "rh", "bater_ponto", "notas_fiscais"],
  personalizado: [],
};

const emptyForm = (): Partial<Base> => ({
  nome: "",
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  email_responsavel: "",
  telefone_responsavel: "",
  responsavel_nome: "",
  status: "ativo",
  plano: "personalizado",
  observacoes: "",
  data_inicio: new Date().toISOString().slice(0, 10),
});

function statusBadge(s: string) {
  const st = STATUS.find((x) => x.value === s) || STATUS[0];
  return <Badge className={`${st.color} border-0`}>{st.label}</Badge>;
}

export default function GestaoBases() {
  const { user } = useAuth();
  const [bases, setBases] = useState<Base[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroPlano, setFiltroPlano] = useState<string>("todos");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Base | null>(null);
  const [form, setForm] = useState<Partial<Base>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [detalheBase, setDetalheBase] = useState<Base | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from("bases_clientes" as any).select("*").order("nome"),
      supabase.from("lojas").select("id,nome,ativo,base_cliente_id").order("nome"),
    ]);
    setBases((b || []) as any);
    setLojas((l || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const lojasPorBase = useMemo(() => {
    const map: Record<string, Loja[]> = {};
    lojas.forEach((lj) => {
      if (!lj.base_cliente_id) return;
      (map[lj.base_cliente_id] ||= []).push(lj);
    });
    return map;
  }, [lojas]);

  const filtradas = useMemo(() => {
    return bases.filter((b) => {
      if (filtroStatus !== "todos" && b.status !== filtroStatus) return false;
      if (filtroPlano !== "todos" && b.plano !== filtroPlano) return false;
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return (
        b.nome.toLowerCase().includes(q) ||
        (b.cnpj || "").toLowerCase().includes(q) ||
        (b.responsavel_nome || "").toLowerCase().includes(q) ||
        (b.email_responsavel || "").toLowerCase().includes(q)
      );
    });
  }, [bases, busca, filtroStatus, filtroPlano]);

  const kpi = useMemo(() => ({
    total: bases.length,
    ativo: bases.filter((b) => b.status === "ativo").length,
    teste: bases.filter((b) => b.status === "teste").length,
    suspenso: bases.filter((b) => b.status === "suspenso").length,
    cancelado: bases.filter((b) => b.status === "cancelado").length,
  }), [bases]);

  const abrirNova = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const abrirEdicao = (b: Base) => {
    setEditing(b);
    setForm({ ...b, data_inicio: b.data_inicio?.slice(0, 10) ?? "" });
    setOpen(true);
  };

  const registrarHistorico = async (base_id: string, evento: string, descricao: string, detalhes?: any) => {
    await supabase.from("bases_clientes_historico" as any).insert({
      base_id, evento, descricao, detalhes: detalhes ?? null, usuario_id: user?.id ?? null,
    } as any);
  };

  const salvar = async () => {
    if (!form.nome?.trim()) { toast.error("Nome da base é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome,
        razao_social: form.razao_social || null,
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj || null,
        email_responsavel: form.email_responsavel || null,
        telefone_responsavel: form.telefone_responsavel || null,
        responsavel_nome: form.responsavel_nome || null,
        status: form.status || "ativo",
        plano: form.plano || "personalizado",
        observacoes: form.observacoes || null,
        data_inicio: form.data_inicio || null,
        atualizado_por: user?.id ?? null,
      };
      if (editing) {
        const { error } = await supabase.from("bases_clientes" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        await registrarHistorico(editing.id, "edicao", "Dados da base atualizados");
        if (editing.status !== payload.status) {
          await registrarHistorico(editing.id, "status_alterado", `Status: ${editing.status} → ${payload.status}`);
        }
        if (editing.plano !== payload.plano) {
          await registrarHistorico(editing.id, "plano_alterado", `Plano: ${editing.plano} → ${payload.plano}`);
        }
        toast.success("Base atualizada");
      } else {
        payload.criado_por = user?.id ?? null;
        const { data, error } = await supabase.from("bases_clientes" as any).insert(payload).select("id").single();
        if (error) throw error;
        await registrarHistorico((data as any).id, "criacao", `Base "${payload.nome}" criada`);
        toast.success("Base criada");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const mudarStatus = async (b: Base, novo: string) => {
    if (b.status === novo) return;
    const payload: any = { status: novo, atualizado_por: user?.id ?? null };
    if (novo === "cancelado") payload.data_cancelamento = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("bases_clientes" as any).update(payload).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico(b.id, "status_alterado", `Status: ${b.status} → ${novo}`);
    toast.success(`Base ${novo}`);
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Gestão de Bases
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administre os clientes/bases do SaaS, lojas vinculadas, planos e módulos.
          </p>
        </div>
        <Button onClick={abrirNova} className="gap-2"><Plus className="w-4 h-4" /> Nova base</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Total</div><div className="text-2xl font-display mt-1">{kpi.total}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Ativas</div><div className="text-2xl font-display mt-1 text-emerald-700">{kpi.ativo}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Teste</div><div className="text-2xl font-display mt-1 text-blue-700">{kpi.teste}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Suspensas</div><div className="text-2xl font-display mt-1 text-amber-700">{kpi.suspenso}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground">Canceladas</div><div className="text-2xl font-display mt-1 text-red-700">{kpi.cancelado}</div></Card>
      </div>

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-7" placeholder="Nome, CNPJ, responsável, e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="min-w-[160px]">
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Label className="text-xs">Plano</Label>
          <Select value={filtroPlano} onValueChange={setFiltroPlano}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {PLANOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtradas.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma base encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Base</th>
                  <th className="text-left p-3">CNPJ</th>
                  <th className="text-left p-3">Responsável</th>
                  <th className="text-left p-3">Plano</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Lojas</th>
                  <th className="text-left p-3">Início</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium">{b.nome}</div>
                      {b.razao_social && <div className="text-xs text-muted-foreground">{b.razao_social}</div>}
                    </td>
                    <td className="p-3 text-xs">{b.cnpj ? maskCnpj(b.cnpj) : "—"}</td>
                    <td className="p-3 text-xs">
                      <div>{b.responsavel_nome || "—"}</div>
                      {b.email_responsavel && <div className="text-muted-foreground">{b.email_responsavel}</div>}
                    </td>
                    <td className="p-3"><Badge variant="outline" className="capitalize">{b.plano}</Badge></td>
                    <td className="p-3">{statusBadge(b.status)}</td>
                    <td className="p-3 text-xs">{(lojasPorBase[b.id] || []).length}</td>
                    <td className="p-3 text-xs">{b.data_inicio ? new Date(b.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetalheBase(b)}>Detalhes</Button>
                        <Button size="sm" variant="ghost" onClick={() => abrirEdicao(b)}>Editar</Button>
                        {b.status !== "ativo" && <Button size="sm" variant="ghost" onClick={() => mudarStatus(b, "ativo")}>Ativar</Button>}
                        {b.status === "ativo" && <Button size="sm" variant="ghost" onClick={() => mudarStatus(b, "suspenso")}>Suspender</Button>}
                        {b.status !== "cancelado" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => mudarStatus(b, "cancelado")}>Cancelar</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Dialog Cadastro/Edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar base" : "Nova base"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome da base *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Razão social</Label>
              <Input value={form.razao_social || ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
            </div>
            <div>
              <Label>Nome fantasia</Label>
              <Input value={form.nome_fantasia || ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })} />
            </div>
            <div>
              <Label>Telefone do responsável</Label>
              <Input value={form.telefone_responsavel || ""} onChange={(e) => setForm({ ...form, telefone_responsavel: maskPhone(e.target.value) })} />
            </div>
            <div>
              <Label>Nome do responsável</Label>
              <Input value={form.responsavel_nome || ""} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} />
            </div>
            <div>
              <Label>E-mail do responsável</Label>
              <Input type="email" value={form.email_responsavel || ""} onChange={(e) => setForm({ ...form, email_responsavel: e.target.value })} />
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={form.plano || "personalizado"} onValueChange={(v) => setForm({ ...form, plano: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLANOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || "ativo"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={form.data_inicio || ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Detalhes */}
      {detalheBase && (
        <DetalheBaseSheet
          base={detalheBase}
          lojas={lojasPorBase[detalheBase.id] || []}
          onClose={() => setDetalheBase(null)}
          onChanged={load}
          userId={user?.id ?? null}
        />
      )}
    </div>
  );
}

// ============================================================
// Sheet de detalhes da base
// ============================================================

function DetalheBaseSheet({
  base, lojas, onClose, onChanged, userId,
}: {
  base: Base; lojas: Loja[]; onClose: () => void; onChanged: () => void; userId: string | null;
}) {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [ativacoes, setAtivacoes] = useState<ModuloLoja[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [lojaSelecionada, setLojaSelecionada] = useState<string>(lojas[0]?.id || "todas");
  const [loadingMod, setLoadingMod] = useState(false);

  const carregarTudo = async () => {
    setLoadingMod(true);
    const lojaIds = lojas.map((l) => l.id);
    const [{ data: mods }, { data: acts }, { data: hist }, { data: profs }] = await Promise.all([
      supabase.from("modulos_sistema" as any).select("chave,nome,categoria,essencial,ordem").order("ordem"),
      lojaIds.length
        ? supabase.from("modulos_loja" as any).select("loja_id,modulo_chave,ativo,contratado").in("loja_id", lojaIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("bases_clientes_historico" as any).select("*").eq("base_id", base.id).order("created_at", { ascending: false }).limit(50),
      lojaIds.length
        ? supabase.from("profiles" as any).select("id,nome,email,cargo,loja_id,ativo").in("loja_id", lojaIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setModulos((mods || []) as any);
    setAtivacoes((acts || []) as any);
    setHistorico((hist || []) as any);
    setUsuarios((profs || []) as any);
    setLoadingMod(false);
  };

  useEffect(() => { carregarTudo(); /* eslint-disable-next-line */ }, [base.id]);

  const isAtivo = (lojaId: string, m: Modulo) => {
    const row = ativacoes.find((a) => a.loja_id === lojaId && a.modulo_chave === m.chave);
    if (row) return row.ativo;
    return m.essencial;
  };

  const toggleModuloLoja = async (lojaId: string, m: Modulo, novo: boolean) => {
    const existing = ativacoes.find((a) => a.loja_id === lojaId && a.modulo_chave === m.chave);
    const payload: any = {
      loja_id: lojaId,
      modulo_chave: m.chave,
      ativo: novo,
      contratado: existing?.contratado ?? true,
      data_ativacao: novo ? new Date().toISOString() : null,
      data_desativacao: novo ? null : new Date().toISOString(),
      atualizado_por: userId,
    };
    const { error } = await supabase.from("modulos_loja" as any).upsert(payload, { onConflict: "loja_id,modulo_chave" });
    if (error) { toast.error(error.message); return; }
    await supabase.from("bases_clientes_historico" as any).insert({
      base_id: base.id, evento: "modulo_alterado",
      descricao: `Módulo ${m.nome} ${novo ? "ativado" : "desativado"} para loja ${lojas.find((l) => l.id === lojaId)?.nome}`,
      detalhes: { loja_id: lojaId, modulo: m.chave, ativo: novo }, usuario_id: userId,
    } as any);
    toast.success("Módulo atualizado");
    carregarTudo();
  };

  const aplicarParaTodas = async (m: Modulo, novo: boolean) => {
    for (const lj of lojas) await toggleModuloLoja(lj.id, m, novo);
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" /> {base.nome} {statusBadge(base.status)}
          </SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="grid grid-cols-6">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="lojas"><Store className="w-3.5 h-3.5 mr-1" />Lojas</TabsTrigger>
            <TabsTrigger value="usuarios"><Users className="w-3.5 h-3.5 mr-1" />Usuários</TabsTrigger>
            <TabsTrigger value="modulos"><Package className="w-3.5 h-3.5 mr-1" />Módulos</TabsTrigger>
            <TabsTrigger value="cobranca"><CreditCard className="w-3.5 h-3.5 mr-1" />Cobrança</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-3.5 h-3.5 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-2 mt-4 text-sm">
            <Linha label="Razão social" value={base.razao_social} />
            <Linha label="Nome fantasia" value={base.nome_fantasia} />
            <Linha label="CNPJ" value={base.cnpj ? maskCnpj(base.cnpj) : null} />
            <Linha label="Responsável" value={base.responsavel_nome} />
            <Linha label="E-mail" value={base.email_responsavel} />
            <Linha label="Telefone" value={base.telefone_responsavel} />
            <Linha label="Plano" value={base.plano} />
            <Linha label="Status" value={base.status} />
            <Linha label="Início" value={base.data_inicio ? new Date(base.data_inicio).toLocaleDateString("pt-BR") : null} />
            {base.observacoes && (
              <div><div className="text-xs text-muted-foreground">Observações</div><div className="whitespace-pre-wrap">{base.observacoes}</div></div>
            )}
          </TabsContent>

          <TabsContent value="lojas" className="mt-4">
            {lojas.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma loja vinculada a esta base.</div>
            ) : (
              <div className="space-y-2">
                {lojas.map((lj) => (
                  <Card key={lj.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{lj.nome}</div>
                      <div className="text-xs text-muted-foreground">{lj.ativo ? "Ativa" : "Inativa"}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{usuarios.filter((u) => u.loja_id === lj.id).length} usuários</Badge>
                  </Card>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Para cadastrar novas lojas, use Administração → Lojas e vincule a esta base.
            </p>
          </TabsContent>

          <TabsContent value="usuarios" className="mt-4">
            {usuarios.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum usuário vinculado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase">
                    <tr>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">E-mail</th>
                      <th className="text-left p-2">Cargo</th>
                      <th className="text-left p-2">Loja</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-2">{u.nome || "—"}</td>
                        <td className="p-2">{u.email || "—"}</td>
                        <td className="p-2">{u.cargo || "—"}</td>
                        <td className="p-2">{lojas.find((l) => l.id === u.loja_id)?.nome || "—"}</td>
                        <td className="p-2">{u.ativo ? "Ativo" : "Inativo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="modulos" className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Loja:</Label>
              <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Aplicar para todas as lojas</SelectItem>
                  {lojas.map((lj) => <SelectItem key={lj.id} value={lj.id}>{lj.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {loadingMod ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1">
                {modulos.map((m) => {
                  const sugerido = PLANO_MODULOS[base.plano]?.includes(m.chave);
                  const ativo = lojaSelecionada === "todas"
                    ? lojas.every((l) => isAtivo(l.id, m))
                    : isAtivo(lojaSelecionada, m);
                  return (
                    <Card key={m.chave} className="p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{m.nome}</span>
                          {m.essencial && <Badge variant="secondary" className="text-[10px]">Essencial</Badge>}
                          {!m.essencial && <Badge variant="outline" className="text-[10px]">Opcional</Badge>}
                          {sugerido && <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-0">Plano {base.plano}</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{m.categoria}</div>
                      </div>
                      <Switch
                        checked={ativo}
                        onCheckedChange={(v) => {
                          if (lojaSelecionada === "todas") aplicarParaTodas(m, v);
                          else toggleModuloLoja(lojaSelecionada, m, v);
                        }}
                      />
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {historico.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum evento registrado.</div>
            ) : (
              <ul className="space-y-2">
                {historico.map((h) => (
                  <li key={h.id} className="border-l-2 border-primary/30 pl-3 py-1">
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")} · {h.evento}
                    </div>
                    <div className="text-sm">{h.descricao}</div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Linha({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 border-b last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="col-span-2">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
