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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users, UserPlus, Search, Loader2, Shield, History, Lock,
  Unlock, Mail, Building2, Store, MoreHorizontal, AlertTriangle, Link2, Package,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Profile = {
  user_id: string;
  nome_completo: string | null;
  telefone: string | null;
  loja_id: string | null;
  ativo: boolean | null;
  tipo_usuario: "interno_saas" | "usuario_base";
  base_cliente_id: string | null;
  usuario_saas_ativo: boolean;
  cargo_saas: string | null;
  status_saas: "ativo" | "inativo" | "convite_pendente" | "bloqueado";
  bloqueado_em: string | null;
  ultimo_acesso: string | null;
  convite_enviado_em: string | null;
  observacoes_saas: string | null;
  created_at: string;
};

type Base = { id: string; nome: string; sistema_saas_id: string | null };
type Loja = { id: string; nome: string; base_cliente_id: string | null };
type Sistema = { id: string; nome: string };
type RoleRow = { user_id: string; role: string };
type UserLoja = { user_id: string; loja_id: string };
type HistoricoItem = {
  id: string; user_id: string; evento: string; descricao: string | null;
  dados: any; criado_por: string | null; created_at: string;
};

const CARGOS_SAAS = [
  { value: "admin_master", label: "Administrador Master" },
  { value: "comercial", label: "Comercial SaaS" },
  { value: "suporte", label: "Suporte" },
  { value: "implantacao", label: "Implantação" },
  { value: "financeiro", label: "Financeiro SaaS" },
  { value: "fiscal", label: "Fiscal" },
  { value: "gestor", label: "Gestor" },
];

const ROLES_BASE = [
  { value: "admin", label: "Administrador da base" },
  { value: "diretor", label: "Diretor" },
  { value: "gerente", label: "Gerente" },
  { value: "vendedor", label: "Vendedor" },
  { value: "financeiro", label: "Financeiro" },
  { value: "projetista", label: "Projetista" },
  { value: "tecnico", label: "Técnico" },
  { value: "montador", label: "Montador" },
  { value: "assistencia", label: "Assistência" },
];

const ROLES_ADMIN_BASE = new Set(["admin", "diretor"]);

const STATUS_OPTS = [
  { value: "ativo", label: "Ativo", color: "bg-emerald-100 text-emerald-800" },
  { value: "inativo", label: "Inativo", color: "bg-zinc-200 text-zinc-700" },
  { value: "convite_pendente", label: "Convite pendente", color: "bg-amber-100 text-amber-800" },
  { value: "bloqueado", label: "Bloqueado", color: "bg-red-100 text-red-800" },
];

function statusBadge(s: string) {
  const st = STATUS_OPTS.find((x) => x.value === s) || STATUS_OPTS[0];
  return <Badge className={`${st.color} border-0`}>{st.label}</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return "—"; }
}

type ViewTab = "todos" | "internos" | "bases" | "convites" | "bloqueados";

export default function UsuariosSistema() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [userLojas, setUserLojas] = useState<UserLoja[]>([]);

  // tabs e filtros rápidos
  const [viewTab, setViewTab] = useState<ViewTab>("todos");
  const [quickSemBase, setQuickSemBase] = useState(false);
  const [quickSemLoja, setQuickSemLoja] = useState(false);

  // filters
  const [busca, setBusca] = useState("");
  const [fBase, setFBase] = useState<string>("todas");
  const [fLoja, setFLoja] = useState<string>("todas");
  const [fCargo, setFCargo] = useState<string>("todos");
  const [fSistema, setFSistema] = useState<string>("todos");

  // dialogs
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheUser, setDetalheUser] = useState<Profile | null>(null);
  const [vincularBaseUser, setVincularBaseUser] = useState<Profile | null>(null);
  const [vincularLojaUser, setVincularLojaUser] = useState<Profile | null>(null);

  async function loadAll() {
    setLoading(true);
    const [p, b, l, s, r, ul] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("bases_clientes").select("id,nome,sistema_saas_id").order("nome"),
      supabase.from("lojas").select("id,nome,base_cliente_id").order("nome"),
      supabase.from("sistemas_saas").select("id,nome").order("nome"),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("user_lojas").select("user_id,loja_id"),
    ]);
    setProfiles((p.data as any[]) || []);
    setBases((b.data as any[]) || []);
    setLojas((l.data as any[]) || []);
    setSistemas((s.data as any[]) || []);
    setRoles((r.data as any[]) || []);
    setUserLojas((ul.data as any[]) || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    roles.forEach((r) => {
      if (!m.has(r.user_id)) m.set(r.user_id, []);
      m.get(r.user_id)!.push(r.role);
    });
    return m;
  }, [roles]);

  const lojasByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    userLojas.forEach((r) => {
      if (!m.has(r.user_id)) m.set(r.user_id, []);
      m.get(r.user_id)!.push(r.loja_id);
    });
    return m;
  }, [userLojas]);

  const baseById = useMemo(() => new Map(bases.map((b) => [b.id, b])), [bases]);
  const lojaById = useMemo(() => new Map(lojas.map((l) => [l.id, l])), [lojas]);
  const sistemaById = useMemo(() => new Map(sistemas.map((s) => [s.id, s])), [sistemas]);

  function getLojasDoUser(p: Profile): string[] {
    const ls = lojasByUser.get(p.user_id) || [];
    if (ls.length) return ls;
    return p.loja_id ? [p.loja_id] : [];
  }
  function isAdminDaBase(p: Profile): boolean {
    const rs = rolesByUser.get(p.user_id) || [];
    return rs.some((r) => ROLES_ADMIN_BASE.has(r));
  }
  /** Bases distintas inferidas pelas lojas vinculadas do usuário. */
  function basesDasLojas(p: Profile): string[] {
    const set = new Set<string>();
    getLojasDoUser(p).forEach((id) => {
      const l = lojaById.get(id);
      if (l?.base_cliente_id) set.add(l.base_cliente_id);
    });
    return Array.from(set);
  }
  /** Base efetiva: a do profile, ou a inferida se houver exatamente uma. */
  function baseEfetiva(p: Profile): { id: string | null; inferida: boolean; multiplas: boolean } {
    if (p.base_cliente_id) return { id: p.base_cliente_id, inferida: false, multiplas: false };
    const inf = basesDasLojas(p);
    if (inf.length === 1) return { id: inf[0], inferida: true, multiplas: false };
    if (inf.length > 1) return { id: null, inferida: false, multiplas: true };
    return { id: null, inferida: false, multiplas: false };
  }
  function flagSemBase(p: Profile): boolean {
    if (p.tipo_usuario !== "usuario_base") return false;
    const be = baseEfetiva(p);
    return !be.id && !be.multiplas;
  }
  function flagMultiplasBases(p: Profile): boolean {
    return p.tipo_usuario === "usuario_base" && baseEfetiva(p).multiplas;
  }
  function flagSemLoja(p: Profile): boolean {
    return p.tipo_usuario === "usuario_base" && getLojasDoUser(p).length === 0 && !isAdminDaBase(p);
  }
  /** Admin/Diretor da base sem base vinculada — pendência crítica. */
  function flagAdminSemBase(p: Profile): boolean {
    return p.tipo_usuario === "usuario_base" && isAdminDaBase(p) && !baseEfetiva(p).id && !baseEfetiva(p).multiplas;
  }


  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return profiles.filter((p) => {
      // tab
      if (viewTab === "internos" && p.tipo_usuario !== "interno_saas") return false;
      if (viewTab === "bases" && p.tipo_usuario !== "usuario_base") return false;
      if (viewTab === "convites" && p.status_saas !== "convite_pendente") return false;
      if (viewTab === "bloqueados" && p.status_saas !== "bloqueado") return false;

      // quick
      if (quickSemBase && !flagSemBase(p)) return false;
      if (quickSemLoja && !flagSemLoja(p)) return false;

      if (q) {
        const hay = `${p.nome_completo || ""} ${p.telefone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const be = baseEfetiva(p);
      if (fBase !== "todas" && be.id !== fBase) return false;
      if (fLoja !== "todas") {
        const ls = getLojasDoUser(p);
        if (!ls.includes(fLoja)) return false;
      }
      if (fCargo !== "todos") {
        const rs = rolesByUser.get(p.user_id) || [];
        if (!rs.includes(fCargo) && p.cargo_saas !== fCargo) return false;
      }
      if (fSistema !== "todos") {
        const base = be.id ? baseById.get(be.id) : null;
        if (!base || base.sistema_saas_id !== fSistema) return false;
      }
      return true;
    });
  }, [profiles, busca, fBase, fLoja, fCargo, fSistema, lojasByUser, rolesByUser, baseById, lojaById, viewTab, quickSemBase, quickSemLoja]);

  const kpis = useMemo(() => {
    const internos = profiles.filter((p) => p.tipo_usuario === "interno_saas").length;
    const bases_ = profiles.filter((p) => p.tipo_usuario === "usuario_base").length;
    const conv = profiles.filter((p) => p.status_saas === "convite_pendente").length;
    const bloq = profiles.filter((p) => p.status_saas === "bloqueado").length;
    const ativos = profiles.filter((p) => p.status_saas === "ativo").length;
    const semBase = profiles.filter(flagSemBase).length;
    const semLoja = profiles.filter(flagSemLoja).length;
    const adminSemBase = profiles.filter(flagAdminSemBase).length;
    const multiBase = profiles.filter(flagMultiplasBases).length;
    return { internos, bases: bases_, conv, bloq, ativos, semBase, semLoja, adminSemBase, multiBase, total: profiles.length };
  }, [profiles, lojasByUser, rolesByUser, lojaById]);


  async function registrarHistorico(user_id: string, evento: string, descricao: string, dados?: any) {
    await supabase.from("saas_usuarios_historico").insert({
      user_id, evento, descricao, dados: dados || null, criado_por: user?.id || null,
    });
  }

  async function alterarStatus(p: Profile, status: Profile["status_saas"]) {
    const patch: any = { status_saas: status };
    if (status === "bloqueado") patch.bloqueado_em = new Date().toISOString();
    if (status === "ativo") patch.bloqueado_em = null;
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", p.user_id);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico(p.user_id, "alteracao_status", `Status alterado para ${status}`, { de: p.status_saas, para: status });
    toast.success("Status atualizado");
    loadAll();
    if (detalheUser?.user_id === p.user_id) setDetalheUser({ ...p, ...patch });
  }

  async function reenviarConvite(p: Profile) {
    const patch = { convite_enviado_em: new Date().toISOString(), status_saas: "convite_pendente" as const };
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", p.user_id);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico(p.user_id, "convite_reenviado", "Convite reenviado");
    toast.success("Convite registrado");
    loadAll();
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Central master: gerencie usuários internos do SaaS e usuários das bases/clientes.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Novo usuário
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", val: kpis.total, icon: Users, tone: "" },
          { label: "Internos SaaS", val: kpis.internos, icon: Shield, tone: "" },
          { label: "De bases", val: kpis.bases, icon: Building2, tone: "" },
          { label: "Ativos", val: kpis.ativos, icon: Unlock, tone: "" },
          { label: "Convites", val: kpis.conv, icon: Mail, tone: kpis.conv ? "text-amber-700" : "" },
          { label: "Bloqueados", val: kpis.bloq, icon: Lock, tone: kpis.bloq ? "text-red-700" : "" },
          { label: "Sem base/loja", val: kpis.semBase + kpis.semLoja, icon: AlertTriangle, tone: (kpis.semBase + kpis.semLoja) ? "text-red-700" : "" },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className={cn("text-2xl font-semibold mt-1", k.tone)}>{k.val}</div>
          </Card>
        ))}
      </div>

      {/* Alerta administrativo */}
      {(kpis.semBase > 0 || kpis.semLoja > 0) && (
        <Card className="p-3 border-amber-300 bg-amber-50/50 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="font-medium text-amber-900">Atenção: usuários sem vínculo</div>
            <div className="text-amber-800/90">
              {kpis.semBase > 0 && <>{kpis.semBase} usuário(s) de base sem base vinculada. </>}
              {kpis.semLoja > 0 && <>{kpis.semLoja} usuário(s) operacional(is) sem loja.</>}
            </div>
          </div>
          <div className="flex gap-2">
            {kpis.semBase > 0 && (
              <Button size="sm" variant="outline"
                onClick={() => { setQuickSemBase(true); setQuickSemLoja(false); setViewTab("bases"); }}>
                Ver sem base
              </Button>
            )}
            {kpis.semLoja > 0 && (
              <Button size="sm" variant="outline"
                onClick={() => { setQuickSemLoja(true); setQuickSemBase(false); setViewTab("bases"); }}>
                Ver sem loja
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="todos">Todos ({kpis.total})</TabsTrigger>
          <TabsTrigger value="internos">Internos SaaS ({kpis.internos})</TabsTrigger>
          <TabsTrigger value="bases">Usuários das Bases ({kpis.bases})</TabsTrigger>
          <TabsTrigger value="convites">Convites ({kpis.conv})</TabsTrigger>
          <TabsTrigger value="bloqueados">Bloqueados ({kpis.bloq})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtros */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar nome ou telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={fBase} onValueChange={setFBase}>
            <SelectTrigger><SelectValue placeholder="Base" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as bases</SelectItem>
              {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fSistema} onValueChange={setFSistema}>
            <SelectTrigger><SelectValue placeholder="Sistema" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os sistemas</SelectItem>
              {sistemas.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fLoja} onValueChange={setFLoja}>
            <SelectTrigger><SelectValue placeholder="Loja" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCargo} onValueChange={setFCargo}>
            <SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cargos</SelectItem>
              {[...CARGOS_SAAS, ...ROLES_BASE].map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-muted-foreground mr-1 self-center">Filtros rápidos:</span>
          <Badge
            variant={quickSemBase ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setQuickSemBase(!quickSemBase)}
          >Sem base ({kpis.semBase})</Badge>
          <Badge
            variant={quickSemLoja ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setQuickSemLoja(!quickSemLoja)}
          >Sem loja ({kpis.semLoja})</Badge>
          {(quickSemBase || quickSemLoja || fBase !== "todas" || fLoja !== "todas" || fCargo !== "todos" || fSistema !== "todos" || busca) && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
              onClick={() => {
                setQuickSemBase(false); setQuickSemLoja(false);
                setFBase("todas"); setFLoja("todas"); setFCargo("todos"); setFSistema("todos"); setBusca("");
              }}>Limpar</Button>
          )}
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome / contato</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Base</th>
                <th className="text-left px-3 py-2">Sistema</th>
                <th className="text-left px-3 py-2">Loja(s)</th>
                <th className="text-left px-3 py-2">Perfil</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</td></tr>
              ) : filtered.map((p) => {
                const rs = rolesByUser.get(p.user_id) || [];
                const ls = getLojasDoUser(p);
                const be = baseEfetiva(p);
                const base = be.id ? baseById.get(be.id) : null;
                const sistema = base?.sistema_saas_id ? sistemaById.get(base.sistema_saas_id) : null;
                const cargo = p.tipo_usuario === "interno_saas"
                  ? CARGOS_SAAS.find((c) => c.value === p.cargo_saas)?.label || p.cargo_saas || "—"
                  : rs.map((r) => ROLES_BASE.find((x) => x.value === r)?.label || r).join(", ") || "—";
                const semBase = flagSemBase(p);
                const semLoja = flagSemLoja(p);
                const multiBases = flagMultiplasBases(p);
                const adminBase = isAdminDaBase(p);
                const lojasLabel = ls.map((id) => lojaById.get(id)?.nome).filter(Boolean).join(", ");
                return (
                  <tr key={p.user_id} className="border-t hover:bg-muted/30 align-top">
                    <td className="px-3 py-2 min-w-[200px]">
                      <button className="font-medium hover:underline text-left" onClick={() => setDetalheUser(p)}>
                        {p.nome_completo || "—"}
                      </button>
                      {p.telefone && (
                        <div className="text-xs text-muted-foreground">{p.telefone}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.tipo_usuario === "interno_saas"
                        ? <Badge className="bg-indigo-100 text-indigo-800 border-0">Interno SaaS</Badge>
                        : <Badge className="bg-sky-100 text-sky-800 border-0">Base</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {p.tipo_usuario === "interno_saas" ? (
                        <span className="text-muted-foreground text-xs">— (interno)</span>
                      ) : multiBases ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-amber-100 text-amber-800 border-0 cursor-help">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Múltiplas bases
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Usuário possui lojas de bases diferentes. Revise os vínculos.</TooltipContent>
                        </Tooltip>
                      ) : base ? (
                        <div className="flex items-center gap-1">
                          <span>{base.nome}</span>
                          {be.inferida && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[10px] py-0 px-1 cursor-help">inferida</Badge>
                              </TooltipTrigger>
                              <TooltipContent>Base identificada pela loja vinculada.</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-red-100 text-red-800 border-0 cursor-help">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Sem base
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {ls.length ? "Loja vinculada está sem base. Configure a loja." : "Usuário de base precisa ter uma base vinculada."}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {sistema ? sistema.nome : <span className="text-muted-foreground">—</span>}
                    </td>

                    <td className="px-3 py-2 max-w-[200px]">
                      {ls.length ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate">{lojasLabel}</div>
                          </TooltipTrigger>
                          <TooltipContent>{lojasLabel}</TooltipContent>
                        </Tooltip>
                      ) : p.tipo_usuario === "interno_saas" ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : semLoja ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-amber-100 text-amber-800 border-0 cursor-help">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Sem loja
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Usuário operacional precisa ao menos de uma loja.</TooltipContent>
                        </Tooltip>
                      ) : adminBase ? (
                        <Badge variant="outline" className="text-xs">Acesso à base</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{cargo}</td>
                    <td className="px-3 py-2">{statusBadge(p.status_saas)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(semBase || semLoja) && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs"
                            onClick={() => semBase ? setVincularBaseUser(p) : setVincularLojaUser(p)}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            {semBase ? "Vincular base" : "Vincular loja"}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetalheUser(p)}>Ver detalhes</DropdownMenuItem>
                            {p.tipo_usuario === "usuario_base" && (
                              <>
                                <DropdownMenuItem onClick={() => setVincularBaseUser(p)}>
                                  <Building2 className="h-3.5 w-3.5 mr-2" /> Vincular base
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setVincularLojaUser(p)}>
                                  <Store className="h-3.5 w-3.5 mr-2" /> Gerenciar lojas
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {p.status_saas !== "ativo" && (
                              <DropdownMenuItem onClick={() => alterarStatus(p, "ativo")}>
                                <Unlock className="h-3.5 w-3.5 mr-2" /> Ativar
                              </DropdownMenuItem>
                            )}
                            {p.status_saas !== "inativo" && (
                              <DropdownMenuItem onClick={() => alterarStatus(p, "inativo")}>Inativar</DropdownMenuItem>
                            )}
                            {p.status_saas !== "bloqueado" && (
                              <DropdownMenuItem onClick={() => alterarStatus(p, "bloqueado")} className="text-red-600">
                                <Lock className="h-3.5 w-3.5 mr-2" /> Bloquear
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => reenviarConvite(p)}>
                              <Mail className="h-3.5 w-3.5 mr-2" /> Reenviar convite
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <NovoUsuarioDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        bases={bases}
        lojas={lojas}
        sistemas={sistemas}
        onCreated={() => { setNovoOpen(false); loadAll(); }}
      />

      <DetalheUsuarioSheet
        user={detalheUser}
        onClose={() => setDetalheUser(null)}
        bases={bases}
        lojas={lojas}
        sistemas={sistemas}
        rolesByUser={rolesByUser}
        lojasByUser={lojasByUser}
        onChanged={loadAll}
        onAlterarStatus={alterarStatus}
        onReenviarConvite={reenviarConvite}
        onAbrirVincularLojas={(u) => setVincularLojaUser(u)}
      />

      <VincularBaseDialog
        user={vincularBaseUser}
        bases={bases}
        lojas={lojas}
        currentLojas={vincularBaseUser ? (lojasByUser.get(vincularBaseUser.user_id) || (vincularBaseUser.loja_id ? [vincularBaseUser.loja_id] : [])) : []}
        onClose={() => setVincularBaseUser(null)}
        onDone={() => { setVincularBaseUser(null); loadAll(); }}
        criadoPor={user?.id || null}
      />


      <VincularLojasDialog
        user={vincularLojaUser}
        bases={bases}
        lojas={lojas}
        currentLojas={vincularLojaUser ? (lojasByUser.get(vincularLojaUser.user_id) || []) : []}
        onClose={() => setVincularLojaUser(null)}
        onDone={() => { setVincularLojaUser(null); loadAll(); }}
        criadoPor={user?.id || null}
      />
    </div>
    </TooltipProvider>
  );
}

/* ============================== Novo usuário ============================== */
function NovoUsuarioDialog({
  open, onOpenChange, bases, lojas, sistemas, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  bases: Base[]; lojas: Loja[]; sistemas: Sistema[]; onCreated: () => void;
}) {
  const [step, setStep] = useState<"tipo" | "form">("tipo");
  const [tipo, setTipo] = useState<"interno_saas" | "usuario_base">("usuario_base");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [cargoSaas, setCargoSaas] = useState<string>("");
  const [roleBase, setRoleBase] = useState<string>("vendedor");
  const [baseId, setBaseId] = useState<string>("");
  const [lojasSel, setLojasSel] = useState<string[]>([]);
  const [statusInicial, setStatusInicial] = useState<"ativo" | "convite_pendente">("ativo");
  const [saving, setSaving] = useState(false);

  const lojasDaBase = useMemo(
    () => lojas.filter((l) => !baseId || l.base_cliente_id === baseId),
    [lojas, baseId]
  );
  const sistemaDaBase = useMemo(() => {
    if (!baseId) return null;
    const b = bases.find((x) => x.id === baseId);
    if (!b?.sistema_saas_id) return null;
    return sistemas.find((s) => s.id === b.sistema_saas_id) || null;
  }, [baseId, bases, sistemas]);

  function reset() {
    setStep("tipo");
    setTipo("usuario_base"); setNome(""); setEmail(""); setTelefone(""); setSenha("");
    setCargoSaas(""); setRoleBase("vendedor"); setBaseId(""); setLojasSel([]);
    setStatusInicial("ativo");
  }

  async function salvar() {
    if (!nome || !email) { toast.error("Nome e e-mail são obrigatórios"); return; }
    if (!senha || senha.length < 6) { toast.error("Senha mínima de 6 caracteres"); return; }
    if (tipo === "interno_saas" && !cargoSaas) { toast.error("Selecione o cargo interno"); return; }
    if (tipo === "usuario_base" && !baseId) { toast.error("Selecione a base"); return; }
    if (tipo === "usuario_base" && !ROLES_ADMIN_BASE.has(roleBase) && lojasSel.length === 0) {
      toast.error("Selecione ao menos uma loja para usuário operacional");
      return;
    }

    setSaving(true);
    try {
      const role = tipo === "interno_saas" ? "admin" : roleBase;
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email, password: senha, full_name: nome, telefone,
          role, store_id: lojasSel[0] || null, lojas_ids: lojasSel,
        },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Erro ao criar usuário");
        setSaving(false); return;
      }
      const newUserId = (data as any)?.user?.id;
      if (newUserId) {
        await supabase.from("profiles").update({
          tipo_usuario: tipo,
          base_cliente_id: tipo === "usuario_base" ? baseId : null,
          cargo_saas: tipo === "interno_saas" ? cargoSaas : null,
          status_saas: statusInicial,
          usuario_saas_ativo: statusInicial === "ativo",
          convite_enviado_em: statusInicial === "convite_pendente" ? new Date().toISOString() : null,
        }).eq("user_id", newUserId);
        await supabase.from("saas_usuarios_historico").insert({
          user_id: newUserId,
          evento: "criado",
          descricao: `Usuário ${tipo === "interno_saas" ? "interno SaaS" : "de base"} criado`,
          dados: { tipo, base_cliente_id: baseId || null, cargo_saas: cargoSaas || null, role, lojas_ids: lojasSel },
        });
      }
      toast.success("Usuário criado");
      reset();
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            {step === "tipo"
              ? "Escolha o tipo de usuário. Internos administram o SaaS; usuários de base operam o sistema contratado."
              : tipo === "interno_saas" ? "Usuário interno SaaS" : "Usuário de base/cliente"}
          </DialogDescription>
        </DialogHeader>

        {step === "tipo" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={() => { setTipo("interno_saas"); setStep("form"); }}
              className="text-left border rounded-lg p-4 hover:border-primary hover:bg-muted/40 transition"
            >
              <div className="flex items-center gap-2 mb-1"><Shield className="h-4 w-4 text-indigo-600" /><span className="font-medium">Interno SaaS</span></div>
              <p className="text-xs text-muted-foreground">
                Empresa dona do sistema. Acessa Painel Master, Bases, Financeiro SaaS, CRM SaaS etc. Não precisa de loja.
              </p>
            </button>
            <button
              type="button"
              onClick={() => { setTipo("usuario_base"); setStep("form"); }}
              className="text-left border rounded-lg p-4 hover:border-primary hover:bg-muted/40 transition"
            >
              <div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4 text-sky-600" /><span className="font-medium">Usuário de Base</span></div>
              <p className="text-xs text-muted-foreground">
                Pertence a uma base/cliente. Acessa apenas o sistema contratado da base. Precisa de base e, em geral, de loja.
              </p>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>E-mail *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
            <div><Label>Senha inicial *</Label><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>

            {tipo === "interno_saas" ? (
              <div className="md:col-span-2">
                <Label>Função interna *</Label>
                <Select value={cargoSaas} onValueChange={setCargoSaas}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {CARGOS_SAAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label>Base *</Label>
                  <Select value={baseId} onValueChange={(v) => { setBaseId(v); setLojasSel([]); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {sistemaDaBase && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Sistema contratado: <strong>{sistemaDaBase.nome}</strong>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Cargo/Perfil</Label>
                  <Select value={roleBase} onValueChange={setRoleBase}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES_BASE.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>
                    Lojas vinculadas {!ROLES_ADMIN_BASE.has(roleBase) && <span className="text-red-600">*</span>}
                  </Label>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                    {lojasDaBase.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Selecione uma base primeiro</div>
                    ) : lojasDaBase.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={lojasSel.includes(l.id)}
                          onChange={(e) => {
                            if (e.target.checked) setLojasSel([...lojasSel, l.id]);
                            else setLojasSel(lojasSel.filter((x) => x !== l.id));
                          }}
                        />
                        {l.nome}
                      </label>
                    ))}
                  </div>
                  {ROLES_ADMIN_BASE.has(roleBase) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Administrador/Diretor pode ficar sem loja específica (tem acesso à base toda).
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <Label>Status inicial</Label>
              <Select value={statusInicial} onValueChange={(v: any) => setStatusInicial(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="convite_pendente">Convite pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "form" && (
            <Button variant="ghost" onClick={() => setStep("tipo")}>Voltar</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === "form" && (
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Criar usuário
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Vincular base ============================== */
function VincularBaseDialog({
  user, bases, lojas, currentLojas, onClose, onDone, criadoPor,
}: {
  user: Profile | null; bases: Base[]; lojas: Loja[]; currentLojas: string[];
  onClose: () => void; onDone: () => void; criadoPor: string | null;
}) {
  const [baseId, setBaseId] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setBaseId(user?.base_cliente_id || ""); }, [user]);
  if (!user) return null;

  // Identifica lojas atuais que pertencem a outra base
  const lojasUsuario = lojas.filter((l) => currentLojas.includes(l.id));
  const conflitos = baseId
    ? lojasUsuario.filter((l) => l.base_cliente_id && l.base_cliente_id !== baseId)
    : [];

  async function salvar() {
    if (!baseId) { toast.error("Selecione uma base"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ base_cliente_id: baseId, tipo_usuario: "usuario_base" })
      .eq("user_id", user!.user_id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("saas_usuarios_historico").insert({
      user_id: user!.user_id, evento: "vinculo_base",
      descricao: "Base vinculada",
      dados: { base_cliente_id: baseId, conflitos: conflitos.map((l) => l.id) },
      criado_por: criadoPor,
    });
    toast.success(conflitos.length
      ? "Base vinculada. Revise as lojas vinculadas de outras bases."
      : "Base vinculada");
    setSaving(false);
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular base</DialogTitle>
          <DialogDescription>{user.nome_completo}</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <Label>Base</Label>
          <Select value={baseId} onValueChange={setBaseId}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {conflitos.length > 0 && (
            <div className="text-xs rounded-md bg-amber-50 border border-amber-300 p-2 text-amber-900 flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                Este usuário possui {conflitos.length} loja(s) de outra base:{" "}
                <strong>{conflitos.map((l) => l.nome).join(", ")}</strong>. Revise os vínculos depois de salvar.
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Vincular lojas ============================== */
function VincularLojasDialog({
  user, bases, lojas, currentLojas, onClose, onDone, criadoPor,
}: {
  user: Profile | null; bases: Base[]; lojas: Loja[]; currentLojas: string[];
  onClose: () => void; onDone: () => void; criadoPor: string | null;
}) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { setSel(currentLojas); }, [user?.user_id, currentLojas.join(",")]);
  const [saving, setSaving] = useState(false);
  if (!user) return null;
  const base = user.base_cliente_id ? bases.find((b) => b.id === user.base_cliente_id) : null;

  // Sem base: permite escolher lojas, mas só de UMA base (para inferir).
  // Com base: restringe às lojas dessa base.
  const lojasDisponiveis = base
    ? lojas.filter((l) => l.base_cliente_id === base.id)
    : lojas.filter((l) => l.base_cliente_id);

  const basesSelecionadas = useMemo(() => {
    const set = new Set<string>();
    sel.forEach((id) => {
      const l = lojas.find((x) => x.id === id);
      if (l?.base_cliente_id) set.add(l.base_cliente_id);
    });
    return Array.from(set);
  }, [sel, lojas]);

  const inferida = !base && basesSelecionadas.length === 1
    ? bases.find((b) => b.id === basesSelecionadas[0])
    : null;
  const conflito = !base && basesSelecionadas.length > 1;

  async function salvar() {
    if (conflito) { toast.error("Selecione lojas de uma única base."); return; }
    setSaving(true);
    const toAdd = sel.filter((id) => !currentLojas.includes(id));
    const toRemove = currentLojas.filter((id) => !sel.includes(id));
    if (toRemove.length) {
      const { error } = await supabase.from("user_lojas")
        .delete().eq("user_id", user!.user_id).in("loja_id", toRemove);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    if (toAdd.length) {
      const rows = toAdd.map((loja_id) => ({ user_id: user!.user_id, loja_id }));
      const { error } = await supabase.from("user_lojas").insert(rows);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    // Auto-preenche base do profile quando aplicável
    const patch: any = {};
    if (!base && inferida) patch.base_cliente_id = inferida.id;
    if (sel.length && (!user!.loja_id || !sel.includes(user!.loja_id))) patch.loja_id = sel[0];
    else if (!sel.length && user!.loja_id) patch.loja_id = null;
    if (Object.keys(patch).length) {
      await supabase.from("profiles").update(patch).eq("user_id", user!.user_id);
    }
    await supabase.from("saas_usuarios_historico").insert({
      user_id: user!.user_id, evento: "vinculo_lojas",
      descricao: inferida
        ? `Lojas vinculadas; base ${inferida.nome} herdada da loja`
        : "Lojas vinculadas atualizadas",
      dados: { lojas_ids: sel, adicionadas: toAdd, removidas: toRemove, base_inferida: inferida?.id || null },
      criado_por: criadoPor,
    });
    toast.success(inferida ? `Lojas atualizadas. Base ${inferida.nome} vinculada automaticamente.` : "Lojas atualizadas");
    setSaving(false);
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar lojas</DialogTitle>
          <DialogDescription>
            {user.nome_completo}{base ? ` — base ${base.nome}` : " — sem base vinculada"}
          </DialogDescription>
        </DialogHeader>
        {lojasDisponiveis.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3">
            {base ? "A base não possui lojas cadastradas." : "Nenhuma loja com base disponível."}
          </div>
        ) : (
          <div className="py-2 border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
            {lojasDisponiveis.map((l) => {
              const lojaBase = bases.find((b) => b.id === l.base_cliente_id);
              return (
                <label key={l.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sel.includes(l.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSel([...sel, l.id]);
                      else setSel(sel.filter((x) => x !== l.id));
                    }}
                  />
                  <span className="flex-1">{l.nome}</span>
                  {!base && lojaBase && (
                    <span className="text-[10px] text-muted-foreground">{lojaBase.nome}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        {inferida && (
          <div className="text-xs rounded-md bg-emerald-50 border border-emerald-300 p-2 text-emerald-900">
            Ao salvar, a base <strong>{inferida.nome}</strong> será vinculada automaticamente ao usuário.
          </div>
        )}
        {conflito && (
          <div className="text-xs rounded-md bg-red-50 border border-red-300 p-2 text-red-900 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>Você selecionou lojas de bases diferentes. Mantenha lojas de uma única base.</div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || conflito}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ============================== Detalhe ============================== */
function DetalheUsuarioSheet({
  user, onClose, bases, lojas, sistemas, rolesByUser, lojasByUser, onChanged,
  onAlterarStatus, onReenviarConvite, onAbrirVincularLojas,
}: {
  user: Profile | null; onClose: () => void;
  bases: Base[]; lojas: Loja[]; sistemas: Sistema[];
  rolesByUser: Map<string, string[]>; lojasByUser: Map<string, string[]>;
  onChanged: () => void;
  onAlterarStatus: (p: Profile, s: Profile["status_saas"]) => void;
  onReenviarConvite: (p: Profile) => void;
  onAbrirVincularLojas: (p: Profile) => void;
}) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [perms, setPerms] = useState<{ modulo: string; acao: string }[]>([]);
  const [edit, setEdit] = useState<Partial<Profile>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const open = !!user;

  useEffect(() => {
    if (!user) return;
    setEdit({
      nome_completo: user.nome_completo,
      telefone: user.telefone,
      tipo_usuario: user.tipo_usuario,
      base_cliente_id: user.base_cliente_id,
      cargo_saas: user.cargo_saas,
      observacoes_saas: user.observacoes_saas,
    });
    Promise.all([
      supabase.from("saas_usuarios_historico").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false }),
      supabase.from("permissoes").select("modulo,acao").eq("user_id", user.user_id),
    ]).then(([h, p]) => {
      setHistorico((h.data as any[]) || []);
      setPerms((p.data as any[]) || []);
    });
  }, [user]);

  if (!user) return null;
  const base = user.base_cliente_id ? bases.find((b) => b.id === user.base_cliente_id) : null;
  const sistema = base?.sistema_saas_id ? sistemas.find((s) => s.id === base.sistema_saas_id) : null;
  const rs = rolesByUser.get(user.user_id) || [];
  const ls = lojasByUser.get(user.user_id) || (user.loja_id ? [user.loja_id] : []);

  async function salvarEdit() {
    setSavingEdit(true);
    const { error } = await supabase.from("profiles").update(edit).eq("user_id", user!.user_id);
    setSavingEdit(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("saas_usuarios_historico").insert({
      user_id: user!.user_id, evento: "edicao_dados", descricao: "Dados atualizados", dados: edit,
    });
    toast.success("Dados atualizados");
    onChanged();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {user.nome_completo || "Usuário"}
            {statusBadge(user.status_saas)}
            {user.tipo_usuario === "interno_saas"
              ? <Badge className="bg-indigo-100 text-indigo-800 border-0">Interno SaaS</Badge>
              : <Badge className="bg-sky-100 text-sky-800 border-0">Base</Badge>}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="bases">Base/Lojas</TabsTrigger>
            <TabsTrigger value="perms">Permissões</TabsTrigger>
            <TabsTrigger value="hist">Histórico</TabsTrigger>
            <TabsTrigger value="seg">Segurança</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-3 mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={edit.nome_completo || ""} onChange={(e) => setEdit({ ...edit, nome_completo: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={edit.telefone || ""} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={edit.tipo_usuario as any} onValueChange={(v: any) => setEdit({ ...edit, tipo_usuario: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interno_saas">Interno SaaS</SelectItem>
                    <SelectItem value="usuario_base">Usuário de base</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {edit.tipo_usuario === "interno_saas" ? (
                <div>
                  <Label>Função interna</Label>
                  <Select value={edit.cargo_saas || ""} onValueChange={(v) => setEdit({ ...edit, cargo_saas: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CARGOS_SAAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Base vinculada</Label>
                  <Select value={edit.base_cliente_id || ""} onValueChange={(v) => setEdit({ ...edit, base_cliente_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={edit.observacoes_saas || ""} onChange={(e) => setEdit({ ...edit, observacoes_saas: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={salvarEdit} disabled={savingEdit}>
                {savingEdit && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="bases" className="space-y-3 mt-3 text-sm">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> Base</div>
              <div className="mt-1 font-medium">{base?.nome || <span className="text-red-700">Sem base vinculada</span>}</div>
              {sistema && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Package className="h-3 w-3" /> Sistema contratado: {sistema.nome}
                </div>
              )}
            </Card>
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Store className="h-3.5 w-3.5" /> Lojas vinculadas</div>
                {user.tipo_usuario === "usuario_base" && (
                  <Button size="sm" variant="outline" onClick={() => onAbrirVincularLojas(user)}>
                    <Link2 className="h-3 w-3 mr-1" /> Gerenciar
                  </Button>
                )}
              </div>
              {ls.length === 0 ? <div className="text-muted-foreground mt-2">Nenhuma loja vinculada</div> : (
                <ul className="mt-2 space-y-1">
                  {ls.map((id) => <li key={id}>• {lojas.find((l) => l.id === id)?.nome || id}</li>)}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="perms" className="space-y-3 mt-3 text-sm">
            <Card className="p-3">
              <div className="text-xs uppercase text-muted-foreground mb-2">Cargos (roles)</div>
              <div className="flex flex-wrap gap-1.5">
                {rs.length === 0 ? <span className="text-muted-foreground">Nenhum</span>
                  : rs.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs uppercase text-muted-foreground mb-2">Permissões individuais</div>
              {perms.length === 0 ? <span className="text-muted-foreground">Nenhuma permissão individual</span> : (
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((p, i) => <Badge key={i} variant="outline">{p.modulo}:{p.acao}</Badge>)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                A edição granular de permissões é feita em <a className="underline" href="/sistema/cargos">Cargos & Autorizações</a>.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="hist" className="mt-3">
            <Card className="p-3 max-h-[500px] overflow-y-auto">
              {historico.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem eventos registrados</div>
              ) : (
                <ul className="space-y-2">
                  {historico.map((h) => (
                    <li key={h.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                      <div className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{h.evento}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{fmtDate(h.created_at)}</span>
                      </div>
                      {h.descricao && <div className="text-xs text-muted-foreground mt-0.5">{h.descricao}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="seg" className="space-y-3 mt-3 text-sm">
            <Card className="p-3 space-y-2">
              <div>Status: {statusBadge(user.status_saas)}</div>
              <div className="text-xs text-muted-foreground">Último acesso: {fmtDate(user.ultimo_acesso)}</div>
              <div className="text-xs text-muted-foreground">Convite enviado em: {fmtDate(user.convite_enviado_em)}</div>
              {user.bloqueado_em && <div className="text-xs text-red-600">Bloqueado em: {fmtDate(user.bloqueado_em)}</div>}
            </Card>
            <div className="flex flex-wrap gap-2">
              {user.status_saas !== "bloqueado" ? (
                <Button variant="destructive" size="sm" onClick={() => onAlterarStatus(user, "bloqueado")}>
                  <Lock className="h-3.5 w-3.5 mr-1.5" /> Bloquear
                </Button>
              ) : (
                <Button size="sm" onClick={() => onAlterarStatus(user, "ativo")}>
                  <Unlock className="h-3.5 w-3.5 mr-1.5" /> Desbloquear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onReenviarConvite(user)}>
                <Mail className="h-3.5 w-3.5 mr-1.5" /> Reenviar convite
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
