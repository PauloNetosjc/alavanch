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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
import {
  Users, UserPlus, Search, Loader2, Shield, History, Lock,
  Unlock, Mail, Building2, Store, MoreHorizontal, KeyRound,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
type Role = { user_id: string; role: string };
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

export default function UsuariosSistema() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userLojas, setUserLojas] = useState<UserLoja[]>([]);

  // filters
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState<string>("todos");
  const [fBase, setFBase] = useState<string>("todas");
  const [fLoja, setFLoja] = useState<string>("todas");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fCargo, setFCargo] = useState<string>("todos");
  const [fSistema, setFSistema] = useState<string>("todos");

  // dialogs
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheUser, setDetalheUser] = useState<Profile | null>(null);

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

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return profiles.filter((p) => {
      if (q) {
        const hay = `${p.nome_completo || ""} ${p.telefone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fTipo !== "todos" && p.tipo_usuario !== fTipo) return false;
      if (fBase !== "todas" && p.base_cliente_id !== fBase) return false;
      if (fStatus !== "todos" && p.status_saas !== fStatus) return false;
      if (fLoja !== "todas") {
        const ls = lojasByUser.get(p.user_id) || (p.loja_id ? [p.loja_id] : []);
        if (!ls.includes(fLoja)) return false;
      }
      if (fCargo !== "todos") {
        const rs = rolesByUser.get(p.user_id) || [];
        if (!rs.includes(fCargo) && p.cargo_saas !== fCargo) return false;
      }
      if (fSistema !== "todos") {
        const base = p.base_cliente_id ? baseById.get(p.base_cliente_id) : null;
        if (!base || base.sistema_saas_id !== fSistema) return false;
      }
      return true;
    });
  }, [profiles, busca, fTipo, fBase, fLoja, fStatus, fCargo, fSistema, lojasByUser, rolesByUser, baseById]);

  const kpis = useMemo(() => {
    const total = profiles.length;
    const internos = profiles.filter((p) => p.tipo_usuario === "interno_saas").length;
    const bases_ = profiles.filter((p) => p.tipo_usuario === "usuario_base").length;
    const conv = profiles.filter((p) => p.status_saas === "convite_pendente").length;
    const bloq = profiles.filter((p) => p.status_saas === "bloqueado").length;
    const ativos = profiles.filter((p) => p.status_saas === "ativo").length;
    return { total, internos, bases: bases_, conv, bloq, ativos };
  }, [profiles]);

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
    if (!p.nome_completo) { toast.error("Sem e-mail vinculado"); return; }
    // sinaliza convite enviado; envio real via auth/admin pode ser plugado depois
    const patch = { convite_enviado_em: new Date().toISOString(), status_saas: "convite_pendente" as const };
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", p.user_id);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico(p.user_id, "convite_reenviado", "Convite reenviado");
    toast.success("Convite registrado");
    loadAll();
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários do Sistema</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários internos do SaaS e usuários das bases.</p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Novo usuário
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", val: kpis.total, icon: Users },
          { label: "Internos SaaS", val: kpis.internos, icon: Shield },
          { label: "De bases", val: kpis.bases, icon: Building2 },
          { label: "Convites pendentes", val: kpis.conv, icon: Mail },
          { label: "Bloqueados", val: kpis.bloq, icon: Lock },
          { label: "Ativos", val: kpis.ativos, icon: Unlock },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="text-2xl font-semibold mt-1">{k.val}</div>
          </Card>
        ))}
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="interno_saas">Interno SaaS</SelectItem>
              <SelectItem value="usuario_base">Usuário de base</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fBase} onValueChange={setFBase}>
            <SelectTrigger><SelectValue placeholder="Base" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as bases</SelectItem>
              {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fLoja} onValueChange={setFLoja}>
            <SelectTrigger><SelectValue placeholder="Loja" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCargo} onValueChange={setFCargo}>
            <SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cargos</SelectItem>
              {[...CARGOS_SAAS, ...ROLES_BASE].map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fSistema} onValueChange={setFSistema}>
            <SelectTrigger><SelectValue placeholder="Sistema" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os sistemas</SelectItem>
              {sistemas.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Base</th>
                <th className="text-left px-3 py-2">Loja(s)</th>
                <th className="text-left px-3 py-2">Cargo/Perfil</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Último acesso</th>
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
                const ls = lojasByUser.get(p.user_id) || (p.loja_id ? [p.loja_id] : []);
                const base = p.base_cliente_id ? baseById.get(p.base_cliente_id) : null;
                const cargo = p.tipo_usuario === "interno_saas"
                  ? CARGOS_SAAS.find((c) => c.value === p.cargo_saas)?.label || p.cargo_saas || "—"
                  : rs.map((r) => ROLES_BASE.find((x) => x.value === r)?.label || r).join(", ") || "—";
                return (
                  <tr key={p.user_id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.nome_completo || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.telefone || ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      {p.tipo_usuario === "interno_saas"
                        ? <Badge variant="secondary">Interno SaaS</Badge>
                        : <Badge variant="outline">Base</Badge>}
                    </td>
                    <td className="px-3 py-2">{base?.nome || "—"}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate">
                      {ls.length ? ls.map((id) => lojaById.get(id)?.nome).filter(Boolean).join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">{cargo}</td>
                    <td className="px-3 py-2">{statusBadge(p.status_saas)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.ultimo_acesso)}</td>
                    <td className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetalheUser(p)}>Ver detalhes</DropdownMenuItem>
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
      />
    </div>
  );
}

/* ============================== Novo usuário ============================== */
function NovoUsuarioDialog({
  open, onOpenChange, bases, lojas, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  bases: Base[]; lojas: Loja[]; onCreated: () => void;
}) {
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

  function reset() {
    setTipo("usuario_base"); setNome(""); setEmail(""); setTelefone(""); setSenha("");
    setCargoSaas(""); setRoleBase("vendedor"); setBaseId(""); setLojasSel([]);
    setStatusInicial("ativo");
  }

  async function salvar() {
    if (!nome || !email) { toast.error("Nome e e-mail são obrigatórios"); return; }
    if (!senha || senha.length < 6) { toast.error("Senha mínima de 6 caracteres"); return; }
    if (tipo === "interno_saas" && !cargoSaas) { toast.error("Selecione o cargo interno"); return; }
    if (tipo === "usuario_base" && !baseId) { toast.error("Selecione a base"); return; }

    setSaving(true);
    try {
      const role = tipo === "interno_saas" ? "admin" : roleBase;
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          password: senha,
          full_name: nome,
          telefone,
          role,
          store_id: lojasSel[0] || null,
          lojas_ids: lojasSel,
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
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
          <div className="md:col-span-2">
            <Label>Tipo de usuário</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interno_saas">Usuário interno SaaS</SelectItem>
                <SelectItem value="usuario_base">Usuário de base</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                <Label>Lojas vinculadas</Label>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Criar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Detalhe ============================== */
function DetalheUsuarioSheet({
  user, onClose, bases, lojas, sistemas, rolesByUser, lojasByUser, onChanged,
  onAlterarStatus, onReenviarConvite,
}: {
  user: Profile | null; onClose: () => void;
  bases: Base[]; lojas: Loja[]; sistemas: Sistema[];
  rolesByUser: Map<string, string[]>; lojasByUser: Map<string, string[]>;
  onChanged: () => void;
  onAlterarStatus: (p: Profile, s: Profile["status_saas"]) => void;
  onReenviarConvite: (p: Profile) => void;
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
          <SheetTitle className="flex items-center gap-2">
            {user.nome_completo || "Usuário"}
            {statusBadge(user.status_saas)}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="bases">Bases/Lojas</TabsTrigger>
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
              <div className="mt-1 font-medium">{base?.nome || "—"}</div>
              {sistema && <div className="text-xs text-muted-foreground mt-1">Sistema contratado: {sistema.nome}</div>}
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Store className="h-3.5 w-3.5" /> Lojas vinculadas</div>
              {ls.length === 0 ? <div className="text-muted-foreground mt-1">Nenhuma</div> : (
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
