import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  Activity, Building2, Layers, Loader2, Search, TrendingUp, AlertTriangle, Sparkles, Users, Store,
} from "lucide-react";
import { maskCnpj } from "@/lib/masks";

const OPCIONAIS = ["fabrica", "rh", "bater_ponto", "notas_fiscais"];
const STATUS_COLORS: Record<string, string> = {
  ativo: "#16a34a", teste: "#3b82f6", suspenso: "#f59e0b", cancelado: "#dc2626",
};
const PLANO_COLORS = ["#0f5132", "#15803d", "#65a30d", "#ca8a04", "#a16207"];

type Base = {
  id: string; nome: string; cnpj: string | null; responsavel_nome: string | null;
  email_responsavel: string | null; status: string; plano: string;
  data_inicio: string | null; created_at: string;
};
type Loja = { id: string; nome: string; ativo: boolean | null; base_cliente_id: string | null };
type Modulo = { chave: string; nome: string; categoria: string | null; essencial: boolean };
type ModuloLoja = { loja_id: string; modulo_chave: string; ativo: boolean; contratado: boolean };
type Profile = { id: string; loja_id: string | null; ativo: boolean | null };

export default function PainelMaster() {
  const [bases, setBases] = useState<Base[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [ativacoes, setAtivacoes] = useState<ModuloLoja[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assinaturas, setAssinaturas] = useState<any[]>([]);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPlano, setFiltroPlano] = useState("todos");
  const [filtroModulo, setFiltroModulo] = useState("todos");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [b, l, m, a, p, sub, cob] = await Promise.all([
        supabase.from("bases_clientes" as any).select("*").order("nome"),
        supabase.from("lojas").select("id,nome,ativo,base_cliente_id"),
        supabase.from("modulos_sistema" as any).select("chave,nome,categoria,essencial").order("ordem"),
        supabase.from("modulos_loja" as any).select("loja_id,modulo_chave,ativo,contratado"),
        supabase.from("profiles").select("id,loja_id,ativo"),
        supabase.from("base_assinaturas" as any).select("*"),
        supabase.from("base_cobrancas" as any).select("*"),
      ]);
      setBases((b.data || []) as any);
      setLojas((l.data || []) as any);
      setModulos((m.data || []) as any);
      setAtivacoes((a.data || []) as any);
      setProfiles((p.data || []) as any);
      setAssinaturas((sub.data || []) as any);
      setCobrancas((cob.data || []) as any);
      setLoading(false);
    })();
  }, []);

  // Indexações
  const lojasPorBase = useMemo(() => {
    const map: Record<string, Loja[]> = {};
    lojas.forEach((l) => { if (l.base_cliente_id) (map[l.base_cliente_id] ||= []).push(l); });
    return map;
  }, [lojas]);

  const usuariosPorLoja = useMemo(() => {
    const map: Record<string, number> = {};
    profiles.forEach((p) => { if (p.loja_id) map[p.loja_id] = (map[p.loja_id] || 0) + 1; });
    return map;
  }, [profiles]);

  const ativPorLoja = useMemo(() => {
    const map: Record<string, ModuloLoja[]> = {};
    ativacoes.forEach((a) => { (map[a.loja_id] ||= []).push(a); });
    return map;
  }, [ativacoes]);

  // moduloAtivo(loja, chave): linha existir → ativo; senão → essencial=true, opcional=false
  const moduloAtivo = (lojaId: string, chave: string) => {
    const r = ativPorLoja[lojaId]?.find((x) => x.modulo_chave === chave);
    if (r) return r.ativo;
    return modulos.find((m) => m.chave === chave)?.essencial ?? false;
  };

  // Base agregada
  const basesAgg = useMemo(() => bases.map((b) => {
    const lj = lojasPorBase[b.id] || [];
    const userQt = lj.reduce((acc, x) => acc + (usuariosPorLoja[x.id] || 0), 0);
    const modAtivos = new Set<string>();
    const modInativos = new Set<string>();
    modulos.forEach((m) => {
      const algumaAtivo = lj.some((x) => moduloAtivo(x.id, m.chave));
      if (algumaAtivo) modAtivos.add(m.chave); else modInativos.add(m.chave);
    });
    return { ...b, lojas: lj, qtdLojas: lj.length, qtdUsuarios: userQt, modulosAtivos: modAtivos, modulosInativos: modInativos };
  }), [bases, lojasPorBase, usuariosPorLoja, modulos, ativPorLoja]);

  // Filtros
  const filtradas = useMemo(() => basesAgg.filter((b) => {
    if (filtroStatus !== "todos" && b.status !== filtroStatus) return false;
    if (filtroPlano !== "todos" && b.plano !== filtroPlano) return false;
    if (filtroModulo !== "todos" && !b.modulosAtivos.has(filtroModulo)) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const hit = b.nome.toLowerCase().includes(q) ||
        (b.cnpj || "").toLowerCase().includes(q) ||
        (b.responsavel_nome || "").toLowerCase().includes(q) ||
        (b.email_responsavel || "").toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  }), [basesAgg, busca, filtroStatus, filtroPlano, filtroModulo]);

  // KPIs
  const kpi = useMemo(() => {
    const modulosVendidos = ativacoes.filter((a) => a.ativo).length;
    return {
      total: bases.length,
      ativas: bases.filter((b) => b.status === "ativo").length,
      teste: bases.filter((b) => b.status === "teste").length,
      suspensas: bases.filter((b) => b.status === "suspenso").length,
      canceladas: bases.filter((b) => b.status === "cancelado").length,
      lojas: lojas.length,
      usuarios: profiles.filter((p) => p.ativo !== false).length,
      modulosVendidos,
    };
  }, [bases, lojas, profiles, ativacoes]);

  // KPIs SaaS (cobrança / armazenamento)
  const saasKpi = useMemo(() => {
    const ativas = assinaturas.filter((s) => s.status_assinatura === "ativa");
    const mrr = ativas.reduce((sum, s) => {
      const lj = lojasPorBase[s.base_cliente_id]?.length || 0;
      const us = (lojasPorBase[s.base_cliente_id] || []).reduce((acc, x) => acc + (usuariosPorLoja[x.id] || 0), 0);
      const adicLojas = Math.max(0, lj - (s.lojas_incluidas || 0)) * Number(s.valor_loja_adicional || 0);
      const adicUsuarios = Math.max(0, us - (s.usuarios_incluidos || 0)) * Number(s.valor_usuario_adicional || 0);
      return sum + Number(s.valor_mensal || 0) + adicLojas + adicUsuarios;
    }, 0);
    const implantacaoAberta = assinaturas
      .filter((s) => !s.implantacao_paga)
      .reduce((sum, s) => sum + Number(s.valor_implantacao || 0), 0);
    const hoje = new Date().toISOString().slice(0, 10);
    const pendentes = cobrancas.filter((c) => c.status === "pendente");
    const vencidas = pendentes.filter((c) => c.data_vencimento && c.data_vencimento < hoje);
    const basesInadimplentes = new Set(vencidas.map((c) => c.base_cliente_id)).size;

    // Armazenamento
    let armTotalContratado = 0, armTotalUsado = 0;
    const acimaDe70: string[] = [];
    const acimaDe90: string[] = [];
    assinaturas.forEach((s) => {
      const tot = Number(s.armazenamento_incluido_mb || 0) + Number(s.armazenamento_adicional_mb || 0);
      const usado = Number(s.armazenamento_usado_mb || 0);
      armTotalContratado += tot;
      armTotalUsado += usado;
      if (tot > 0) {
        const perc = (usado / tot) * 100;
        const baseNome = bases.find((b) => b.id === s.base_cliente_id)?.nome || "—";
        if (perc >= 90) acimaDe90.push(baseNome);
        else if (perc >= 70) acimaDe70.push(baseNome);
      }
    });

    return {
      mrr, implantacaoAberta,
      pendentes: pendentes.length,
      vencidas: vencidas.length,
      basesInadimplentes,
      armTotalGB: armTotalContratado / 1024,
      armUsadoGB: armTotalUsado / 1024,
      acimaDe70, acimaDe90,
    };
  }, [assinaturas, cobrancas, lojasPorBase, usuariosPorLoja, bases]);

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Gráfico: bases por status
  const dataStatus = useMemo(() =>
    ["ativo","teste","suspenso","cancelado"].map((s) => ({
      name: s, value: bases.filter((b) => b.status === s).length,
    })).filter((x) => x.value > 0),
  [bases]);

  // Gráfico: bases por plano
  const dataPlano = useMemo(() => {
    const m: Record<string, number> = {};
    bases.forEach((b) => { m[b.plano] = (m[b.plano] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [bases]);

  // Gráfico: módulos mais ativos
  const dataModulos = useMemo(() => {
    const counts: Record<string, number> = {};
    ativacoes.filter((a) => a.ativo).forEach((a) => {
      counts[a.modulo_chave] = (counts[a.modulo_chave] || 0) + 1;
    });
    return modulos.map((m) => ({
      name: m.nome, value: counts[m.chave] || 0,
    })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [ativacoes, modulos]);

  // Gráfico: lojas por base
  const dataLojasBase = useMemo(() =>
    basesAgg.map((b) => ({ name: b.nome, lojas: b.qtdLojas, usuarios: b.qtdUsuarios })),
  [basesAgg]);

  // Upsell
  const upsell = useMemo(() => {
    const out: { base: string; modulo: string; baseId: string }[] = [];
    basesAgg.forEach((b) => {
      OPCIONAIS.forEach((chave) => {
        if (!b.modulosAtivos.has(chave)) {
          const nome = modulos.find((m) => m.chave === chave)?.nome || chave;
          out.push({ base: b.nome, modulo: nome, baseId: b.id });
        }
      });
    });
    return out;
  }, [basesAgg, modulos]);

  // Alertas
  const alertas = useMemo(() => {
    const a: { tipo: string; mensagem: string; severidade: "warn" | "info" | "danger" }[] = [];
    bases.forEach((b) => {
      if (b.status === "suspenso") a.push({ tipo: "Suspensa", mensagem: `Base "${b.nome}" está suspensa`, severidade: "warn" });
      if (b.status === "teste" && b.data_inicio) {
        const dias = Math.floor((Date.now() - new Date(b.data_inicio).getTime()) / 86400000);
        if (dias > 30) a.push({ tipo: "Teste expirado", mensagem: `Base "${b.nome}" em teste há ${dias} dias`, severidade: "warn" });
      }
      if (!b.plano || b.plano === "personalizado") {
        // ok, personalizado é válido — mas avisar se nem isso definiu
      }
      if (!(lojasPorBase[b.id]?.length)) {
        a.push({ tipo: "Sem loja", mensagem: `Base "${b.nome}" não possui loja vinculada`, severidade: "info" });
      }
    });
    ativacoes.forEach((row) => {
      if (row.ativo && !row.contratado) {
        const loja = lojas.find((l) => l.id === row.loja_id);
        const base = bases.find((b) => b.id === loja?.base_cliente_id);
        const mod = modulos.find((m) => m.chave === row.modulo_chave);
        if (base && mod) a.push({
          tipo: "Não contratado",
          mensagem: `${mod.nome} ativo na loja ${loja?.nome} (base "${base.nome}") sem contratação registrada`,
          severidade: "danger",
        });
      }
    });
    return a;
  }, [bases, ativacoes, lojas, modulos, lojasPorBase]);

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Painel Master SaaS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão executiva da operação Alavanch: bases, lojas, usuários e módulos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/sistema/gestao-bases">Gestão de Bases</Link></Button>
          <Button variant="outline" asChild><Link to="/sistema/gestao-modulos">Gestão de Módulos</Link></Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiBox label="Bases" value={kpi.total} icon={Building2} />
        <KpiBox label="Ativas" value={kpi.ativas} tone="emerald" />
        <KpiBox label="Teste" value={kpi.teste} tone="blue" />
        <KpiBox label="Suspensas" value={kpi.suspensas} tone="amber" />
        <KpiBox label="Canceladas" value={kpi.canceladas} tone="red" />
        <KpiBox label="Lojas" value={kpi.lojas} icon={Store} />
        <KpiBox label="Usuários" value={kpi.usuarios} icon={Users} />
        <KpiBox label="Módulos ativos" value={kpi.modulosVendidos} icon={Layers} />
      </div>

      {/* KPIs SaaS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiBox label="MRR estimado" value={brl(saasKpi.mrr)} tone="emerald" />
        <KpiBox label="Implantação aberta" value={brl(saasKpi.implantacaoAberta)} tone="amber" />
        <KpiBox label="Cobr. pendentes" value={saasKpi.pendentes} />
        <KpiBox label="Cobr. vencidas" value={saasKpi.vencidas} tone="red" />
        <KpiBox label="Inadimplentes" value={saasKpi.basesInadimplentes} tone="red" />
        <KpiBox label="Armaz. contratado" value={`${saasKpi.armTotalGB.toFixed(1)} GB`} />
        <KpiBox label="Armaz. usado" value={`${saasKpi.armUsadoGB.toFixed(1)} GB`} />
        <KpiBox label="Bases >70% arm." value={saasKpi.acimaDe70.length + saasKpi.acimaDe90.length} tone="amber" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Chart title="Bases por status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dataStatus} dataKey="value" nameKey="name" outerRadius={80} label>
                {dataStatus.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.name] || "#888"} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Bases por plano">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dataPlano} dataKey="value" nameKey="name" outerRadius={80} label>
                {dataPlano.map((_, i) => <Cell key={i} fill={PLANO_COLORS[i % PLANO_COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Módulos mais ativos (lojas)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dataModulos} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#15803d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Lojas e usuários por base">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dataLojasBase}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip /><Legend />
              <Bar dataKey="lojas" fill="#15803d" />
              <Bar dataKey="usuarios" fill="#ca8a04" />
            </BarChart>
          </ResponsiveContainer>
        </Chart>
      </div>

      {/* Filtros + Tabela */}
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-7" placeholder="Nome, CNPJ, responsável, e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="teste">Teste</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <Label className="text-xs">Plano</Label>
          <Select value={filtroPlano} onValueChange={setFiltroPlano}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="basico">Básico</SelectItem>
              <SelectItem value="profissional">Profissional</SelectItem>
              <SelectItem value="completo">Completo</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-xs">Módulo ativo</Label>
          <Select value={filtroModulo} onValueChange={setFiltroModulo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {modulos.map((m) => <SelectItem key={m.chave} value={m.chave}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" /> Resumo das Bases
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Base</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Plano</th>
                <th className="text-left p-3">Lojas</th>
                <th className="text-left p-3">Usuários</th>
                <th className="text-left p-3">Mód. ativos</th>
                <th className="text-left p-3">Mód. inativos</th>
                <th className="text-left p-3">Início</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/20">
                  <td className="p-3">
                    <div className="font-medium">{b.nome}</div>
                    {b.cnpj && <div className="text-xs text-muted-foreground">{maskCnpj(b.cnpj)}</div>}
                  </td>
                  <td className="p-3"><StatusBadge status={b.status} /></td>
                  <td className="p-3"><Badge variant="outline" className="capitalize">{b.plano}</Badge></td>
                  <td className="p-3">{b.qtdLojas}</td>
                  <td className="p-3">{b.qtdUsuarios}</td>
                  <td className="p-3 text-emerald-700 font-medium">{b.modulosAtivos.size}</td>
                  <td className="p-3 text-muted-foreground">{b.modulosInativos.size}</td>
                  <td className="p-3 text-xs">{b.data_inicio ? new Date(b.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/sistema/gestao-bases">Gerenciar</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">Nenhuma base encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upsell + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 font-medium">
            <Sparkles className="w-4 h-4 text-emerald-700" /> Oportunidades de upsell
          </div>
          {upsell.length === 0 ? (
            <div className="text-sm text-muted-foreground">Todas as bases já têm os módulos opcionais ativos.</div>
          ) : (
            <ul className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {upsell.map((u, i) => (
                <li key={i} className="text-sm flex items-center justify-between border-b last:border-0 py-1.5">
                  <span><strong>{u.base}</strong> ainda não possui <em>{u.modulo}</em></span>
                  <Button size="sm" variant="ghost" asChild><Link to="/sistema/gestao-bases">Ativar</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-700" /> Alertas administrativos
          </div>
          {alertas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem alertas no momento.</div>
          ) : (
            <ul className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {alertas.map((a, i) => (
                <li key={i} className="text-sm flex items-start gap-2 border-b last:border-0 py-1.5">
                  <Badge className={
                    a.severidade === "danger" ? "bg-red-100 text-red-800 border-0"
                    : a.severidade === "warn" ? "bg-amber-100 text-amber-800 border-0"
                    : "bg-blue-100 text-blue-800 border-0"
                  }>{a.tipo}</Badge>
                  <span className="flex-1">{a.mensagem}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================

function KpiBox({ label, value, icon: Icon, tone }: {
  label: string; value: number; icon?: any; tone?: "emerald" | "blue" | "amber" | "red";
}) {
  const toneClass = tone === "emerald" ? "text-emerald-700"
    : tone === "blue" ? "text-blue-700"
    : tone === "amber" ? "text-amber-700"
    : tone === "red" ? "text-red-700"
    : "";
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
      <div className={`text-2xl font-display mt-1 ${toneClass}`}>{value}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ativo: "bg-emerald-100 text-emerald-800",
    teste: "bg-blue-100 text-blue-800",
    suspenso: "bg-amber-100 text-amber-800",
    cancelado: "bg-red-100 text-red-800",
  };
  return <Badge className={`${colors[status] || "bg-muted"} border-0 capitalize`}>{status}</Badge>;
}

function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-medium mb-2">{title}</div>
      {children}
    </Card>
  );
}
