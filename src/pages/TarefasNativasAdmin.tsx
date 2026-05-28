import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Copy, Power, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

/* ============================================================
 * Fase 2 — Administração de Modelos de Tarefas Nativas
 * Tabela: public.tarefas_nativas_modelos
 * Permissão: tarefas_pedido_admin.administrar (ou admin/diretor/gerente)
 * ============================================================ */

const GATILHOS: { value: string; label: string }[] = [
  { value: "pedido_criado", label: "Pedido criado" },
  { value: "contrato_criado", label: "Contrato criado" },
  { value: "pedido_assinado", label: "Pedido assinado" },
  { value: "tarefa_anterior_concluida", label: "Tarefa anterior concluída" },
  { value: "pdf_projeto_final_assinado", label: "PDF do projeto final assinado" },
  { value: "revisao_projeto_concluida", label: "Revisão do projeto concluída" },
  { value: "implantacao_fabrica_concluida", label: "Implantação na fábrica concluída" },
  { value: "projeto_final_concluido", label: "Projeto final concluído" },
  { value: "medicao_tecnica_agendada", label: "Medição técnica agendada" },
  { value: "medicao_tecnica_concluida", label: "Medição técnica concluída" },
  { value: "revisao_final_agendada", label: "Revisão final agendada" },
  { value: "revisao_final_concluida", label: "Revisão final concluída" },
  { value: "antes_medicao_tecnica", label: "Antes da medição técnica" },
  { value: "depois_medicao_tecnica", label: "Depois da medição técnica" },
  { value: "antes_revisao_final", label: "Antes da revisão final" },
  { value: "depois_revisao_final", label: "Depois da revisão final" },
  { value: "entrega_agendada", label: "Entrega agendada" },
  { value: "montagem_agendada", label: "Montagem agendada" },
  { value: "vistoria_agendada", label: "Vistoria agendada" },
  { value: "vistoria_concluida", label: "Vistoria concluída" },
  { value: "assistencia_pedido_peca", label: "Assistência — pedido de peça" },
  { value: "assistencia_agendada", label: "Assistência agendada" },
];
const GATILHO_LABEL = Object.fromEntries(GATILHOS.map((g) => [g.value, g.label]));

const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;
type Prioridade = (typeof PRIORIDADES)[number];

const SETORES_SUG = ["Comercial", "Conferência", "Conferência/Fábrica", "Fábrica", "Logística", "Montagem", "Pós-venda", "Assistência", "Financeiro"];

type Modelo = {
  id: string;
  nome: string;
  descricao: string | null;
  setor: string | null;
  cargo_id: string | null;
  responsavel_padrao_id: string | null;
  loja_id: string | null;
  gatilho: string;
  gatilho_offset_dias: number;
  gatilho_offset_direcao: "antes" | "depois" | "no_dia";
  gatilho_referencia: string | null;
  prazo_qtd: number;
  prazo_unidade: "dias" | "horas";
  prazo_tipo: "corrido" | "util";
  pre_alerta_dias: number;
  prioridade: Prioridade;
  ordem: number;
  depende_de: string | null;
  bloquear_proxima: boolean;
  exige_anexo: boolean;
  exige_aprovacao: boolean;
  exibir_meus_chamados: boolean;
  exibir_controle_prazos: boolean;
  exibir_kanban: boolean;
  pipeline: string | null;
  ativo: boolean;
};

const EMPTY: Omit<Modelo, "id"> = {
  nome: "",
  descricao: "",
  setor: "",
  cargo_id: null,
  responsavel_padrao_id: null,
  loja_id: null,
  gatilho: "pedido_assinado",
  gatilho_offset_dias: 0,
  gatilho_offset_direcao: "no_dia",
  gatilho_referencia: null,
  prazo_qtd: 1,
  prazo_unidade: "dias",
  prazo_tipo: "corrido",
  pre_alerta_dias: 1,
  prioridade: "media",
  ordem: 0,
  depende_de: null,
  bloquear_proxima: false,
  exige_anexo: false,
  exige_aprovacao: false,
  exibir_meus_chamados: true,
  exibir_controle_prazos: true,
  exibir_kanban: false,
  pipeline: null,
  ativo: true,
};

const PRIO_COLOR: Record<Prioridade, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-amber-100 text-amber-700",
  critica: "bg-red-100 text-red-700",
};

export default function TarefasNativasAdmin() {
  const { can, isAdmin, role, loading: permLoading } = usePermissions();
  const podeAdministrar =
    isAdmin || role === "diretor" || role === "gerente" || can("tarefas_pedido_admin", "administrar" as any);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Modelo[]>([]);
  const [cargos, setCargos] = useState<{ id: string; nome: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; nome_completo: string | null }[]>([]);
  const [lojas, setLojas] = useState<{ id: string; nome: string }[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; nome: string }[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // filtros
  const [fAtivo, setFAtivo] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [fSetor, setFSetor] = useState<string>("");
  const [fGatilho, setFGatilho] = useState<string>("");
  const [fCargo, setFCargo] = useState<string>("");
  const [fPrio, setFPrio] = useState<string>("");
  const [busca, setBusca] = useState("");

  // dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Modelo | null>(null);
  const [form, setForm] = useState<Omit<Modelo, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [m, c, p, l, pl] = await Promise.all([
      (supabase as any).from("tarefas_nativas_modelos").select("*").order("ordem", { ascending: true }).order("nome"),
      supabase.from("rh_cargos").select("id,nome").order("nome"),
      supabase.from("profiles").select("id,nome_completo").eq("ativo", true).order("nome_completo"),
      supabase.from("lojas").select("id,nome").order("nome"),
      (supabase as any).from("kanbans").select("id,nome").order("nome"),
    ]);
    if (m.error) toast.error("Erro ao carregar modelos: " + m.error.message);
    const modelos = (m.data || []) as Modelo[];
    setRows(modelos);
    setCargos((c.data as any) || []);
    setProfiles((p.data as any) || []);
    setLojas((l.data as any) || []);
    setPipelines(((pl as any).data as any) || []);

    // count tarefas por modelo
    if (modelos.length) {
      const { data: tp } = await (supabase as any)
        .from("tarefas_pedido")
        .select("modelo_id")
        .in("modelo_id", modelos.map((x) => x.id));
      const map: Record<string, number> = {};
      (tp || []).forEach((r: any) => { if (r.modelo_id) map[r.modelo_id] = (map[r.modelo_id] || 0) + 1; });
      setCounts(map);
    } else setCounts({});
    setLoading(false);
  }

  useEffect(() => { if (podeAdministrar) load(); /* eslint-disable-next-line */ }, [podeAdministrar]);

  const filtrados = useMemo(() => {
    return rows.filter((r) => {
      if (fAtivo === "ativos" && !r.ativo) return false;
      if (fAtivo === "inativos" && r.ativo) return false;
      if (fSetor && (r.setor || "") !== fSetor) return false;
      if (fGatilho && r.gatilho !== fGatilho) return false;
      if (fCargo && r.cargo_id !== fCargo) return false;
      if (fPrio && r.prioridade !== fPrio) return false;
      if (busca && !r.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [rows, fAtivo, fSetor, fGatilho, fCargo, fPrio, busca]);

  function openNovo() {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  }
  function openEdit(m: Modelo) {
    setEditing(m);
    const { id, ...rest } = m;
    setForm({ ...rest, descricao: rest.descricao ?? "" });
    setOpen(true);
  }
  function duplicar(m: Modelo) {
    setEditing(null);
    const { id, ...rest } = m;
    setForm({ ...rest, nome: `${m.nome} (cópia)`, ativo: false, descricao: rest.descricao ?? "" });
    setOpen(true);
    toast.info("Duplicando modelo — será salvo como inativo por padrão.");
  }
  async function toggleAtivo(m: Modelo) {
    const { error } = await (supabase as any)
      .from("tarefas_nativas_modelos").update({ ativo: !m.ativo }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(m.ativo ? "Modelo desativado." : "Modelo ativado.");
    load();
  }
  async function excluir(m: Modelo) {
    const usos = counts[m.id] || 0;
    if (usos > 0) {
      if (!confirm(`Este modelo já gerou ${usos} tarefa(s) em pedidos. Por segurança, ele será apenas desativado em vez de excluído. Continuar?`)) return;
      const { error } = await (supabase as any).from("tarefas_nativas_modelos").update({ ativo: false }).eq("id", m.id);
      if (error) return toast.error(error.message);
      toast.success("Modelo arquivado (desativado).");
      return load();
    }
    if (!confirm(`Excluir definitivamente o modelo "${m.nome}"?`)) return;
    const { error } = await (supabase as any).from("tarefas_nativas_modelos").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Modelo excluído.");
    load();
  }

  function validar(): string | null {
    if (!form.nome.trim()) return "Informe o nome.";
    if (!form.gatilho) return "Selecione o gatilho.";
    if (!form.prazo_qtd || form.prazo_qtd < 1) return "Prazo deve ser ≥ 1.";
    if (!form.prazo_unidade) return "Informe a unidade de prazo.";
    if (!form.prioridade) return "Informe a prioridade.";
    if (form.exibir_kanban && !form.pipeline) return "Quando 'Exibir no Kanban' está ativo, o pipeline é obrigatório.";
    if (form.gatilho_offset_direcao !== "no_dia" && (form.gatilho_offset_dias ?? 0) < 1) {
      return "Quando o gatilho é 'antes' ou 'depois', o offset em dias deve ser ≥ 1.";
    }
    return null;
  }

  async function salvar() {
    const erro = validar();
    if (erro) return toast.error(erro);
    setSaving(true);
    const payload: any = {
      ...form,
      descricao: form.descricao || null,
      setor: form.setor || null,
      pipeline: form.exibir_kanban ? form.pipeline : null,
      gatilho_referencia: form.gatilho_referencia || null,
    };
    let err;
    if (editing) {
      ({ error: err } = await (supabase as any).from("tarefas_nativas_modelos").update(payload).eq("id", editing.id) as any);
    } else {
      ({ error: err } = await (supabase as any).from("tarefas_nativas_modelos").insert(payload) as any);
    }
    setSaving(false);
    if (err) return toast.error(err.message);
    toast.success(editing ? "Modelo atualizado." : "Modelo criado.");
    setOpen(false);
    load();
  }

  if (permLoading) {
    return <div className="text-center py-20 text-muted-foreground text-[13px]">Verificando permissões…</div>;
  }
  if (!podeAdministrar) {
    return (
      <div className="max-w-xl mx-auto mt-24 text-center space-y-2">
        <ListChecks className="mx-auto h-10 w-10 text-muted-foreground" />
        <div className="text-[15px] font-medium">Acesso restrito</div>
        <div className="text-[12px] text-muted-foreground">
          Você não possui a permissão <code>tarefas_pedido_admin.administrar</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tarefas Nativas do Pedido"
        subtitle="Configure tarefas que serão criadas automaticamente nos pedidos a partir de eventos operacionais — assinatura, medição técnica, revisão final, entrega, montagem e assistência."
        action={
          <Button size="sm" onClick={openNovo}>
            <Plus className="h-4 w-4 mr-1" /> Novo modelo de tarefa
          </Button>
        }
      />

      <div className="rounded-lg border bg-card p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <Input placeholder="Buscar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} className="md:col-span-2 h-9 text-[12px]" />
        <Select value={fAtivo} onValueChange={(v: any) => setFAtivo(v)}>
          <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fSetor || "_"} onValueChange={(v) => setFSetor(v === "_" ? "" : v)}>
          <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_">Todos os setores</SelectItem>
            {Array.from(new Set(rows.map((r) => r.setor).filter(Boolean) as string[])).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fGatilho || "_"} onValueChange={(v) => setFGatilho(v === "_" ? "" : v)}>
          <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Gatilho" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="_">Todos os gatilhos</SelectItem>
            {GATILHOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPrio || "_"} onValueChange={(v) => setFPrio(v === "_" ? "" : v)}>
          <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_">Todas</SelectItem>
            {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-[11px]">
              <TableHead>Nome</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Gatilho</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead className="text-center">Chamados</TableHead>
              <TableHead className="text-center">Prazos</TableHead>
              <TableHead className="text-center">Kanban</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={12} className="text-center text-[12px] text-muted-foreground py-10">Carregando…</TableCell></TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center text-[12px] text-muted-foreground py-10">Nenhum modelo encontrado.</TableCell></TableRow>
            ) : filtrados.map((r) => {
              const cargo = cargos.find((c) => c.id === r.cargo_id)?.nome || "—";
              const resp = profiles.find((p) => p.id === r.responsavel_padrao_id)?.nome_completo || "—";
              return (
                <TableRow key={r.id} className="text-[12px]">
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.setor || "—"}</TableCell>
                  <TableCell>{cargo}</TableCell>
                  <TableCell>{resp}</TableCell>
                  <TableCell>
                    <div className="text-[11px]">{GATILHO_LABEL[r.gatilho] || r.gatilho}</div>
                    {r.gatilho_offset_direcao !== "no_dia" && (
                      <div className="text-[10px] text-muted-foreground">{r.gatilho_offset_direcao} {r.gatilho_offset_dias}d</div>
                    )}
                  </TableCell>
                  <TableCell>{r.prazo_qtd} {r.prazo_unidade} {r.prazo_tipo === "util" ? "úteis" : "corridos"}</TableCell>
                  <TableCell><Badge className={PRIO_COLOR[r.prioridade]} variant="secondary">{r.prioridade}</Badge></TableCell>
                  <TableCell className="text-center">{r.exibir_meus_chamados ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{r.exibir_controle_prazos ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{r.exibir_kanban ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Duplicar" onClick={() => duplicar(r)}><Copy className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title={r.ativo ? "Desativar" : "Ativar"} onClick={() => toggleAtivo(r)}><Power className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title={counts[r.id] ? "Arquivar (já tem tarefas)" : "Excluir"} onClick={() => excluir(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar modelo" : "Novo modelo de tarefa"}</DialogTitle>
            <DialogDescription>
              Modelos definem tarefas criadas automaticamente nos pedidos quando o gatilho é disparado.
            </DialogDescription>
          </DialogHeader>

          {/* DADOS BÁSICOS */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Dados básicos</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-[11px]">Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-[11px]">Descrição</Label>
                <Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">Setor</Label>
                <Select value={form.setor || "_"} onValueChange={(v) => setForm({ ...form, setor: v === "_" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {SETORES_SUG.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Cargo responsável</Label>
                <Select value={form.cargo_id || "_"} onValueChange={(v) => setForm({ ...form, cargo_id: v === "_" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {cargos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Responsável padrão (opcional)</Label>
                <Select value={form.responsavel_padrao_id || "_"} onValueChange={(v) => setForm({ ...form, responsavel_padrao_id: v === "_" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="_">—</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_completo || p.id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Loja/Unidade (opcional)</Label>
                <Select value={form.loja_id || "_"} onValueChange={(v) => setForm({ ...form, loja_id: v === "_" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Todas</SelectItem>
                    {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label className="text-[12px]">Ativo</Label>
              </div>
            </div>
          </section>

          {/* GATILHO */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Gatilho</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-[11px]">Gatilho *</Label>
                <Select value={form.gatilho} onValueChange={(v) => setForm({ ...form, gatilho: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {GATILHOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Referência (opcional)</Label>
                <Input
                  placeholder="ex.: data_medicao, data_revisao_final"
                  value={form.gatilho_referencia ?? ""}
                  onChange={(e) => setForm({ ...form, gatilho_referencia: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[11px]">Direção do offset</Label>
                <Select value={form.gatilho_offset_direcao} onValueChange={(v: any) => setForm({ ...form, gatilho_offset_direcao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_dia">No dia</SelectItem>
                    <SelectItem value="antes">Antes</SelectItem>
                    <SelectItem value="depois">Depois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Offset (dias)</Label>
                <Input type="number" min={0} value={form.gatilho_offset_dias}
                  onChange={(e) => setForm({ ...form, gatilho_offset_dias: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
            </div>
          </section>

          {/* PRAZO */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Prazo & Prioridade</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-[11px]">Quantidade *</Label>
                <Input type="number" min={1} value={form.prazo_qtd}
                  onChange={(e) => setForm({ ...form, prazo_qtd: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div>
                <Label className="text-[11px]">Unidade *</Label>
                <Select value={form.prazo_unidade} onValueChange={(v: any) => setForm({ ...form, prazo_unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dias">Dias</SelectItem>
                    <SelectItem value="horas">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Tipo</Label>
                <Select value={form.prazo_tipo} onValueChange={(v: any) => setForm({ ...form, prazo_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrido">Corridos</SelectItem>
                    <SelectItem value="util">Úteis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Pré-alerta (dias)</Label>
                <Input type="number" min={0} value={form.pre_alerta_dias}
                  onChange={(e) => setForm({ ...form, pre_alerta_dias: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
              <div>
                <Label className="text-[11px]">Prioridade *</Label>
                <Select value={form.prioridade} onValueChange={(v: any) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Ordem</Label>
                <Input type="number" value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </section>

          {/* DEPENDÊNCIA */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Dependência</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Depende de</Label>
                <Select value={form.depende_de || "_"} onValueChange={(v) => setForm({ ...form, depende_de: v === "_" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="_">—</SelectItem>
                    {rows.filter((r) => r.id !== editing?.id).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={form.bloquear_proxima} onCheckedChange={(v) => setForm({ ...form, bloquear_proxima: v })} />
                <Label className="text-[12px]">Bloquear próxima tarefa até concluir</Label>
              </div>
            </div>
          </section>

          {/* REGRAS */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Regras</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.exige_anexo} onCheckedChange={(v) => setForm({ ...form, exige_anexo: v })} />
                <Label className="text-[12px]">Exige anexo para concluir</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.exige_aprovacao} onCheckedChange={(v) => setForm({ ...form, exige_aprovacao: v })} />
                <Label className="text-[12px]">Exige aprovação</Label>
              </div>
            </div>
          </section>

          {/* EXIBIÇÃO */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Exibição</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.exibir_meus_chamados} onCheckedChange={(v) => setForm({ ...form, exibir_meus_chamados: v })} />
                <Label className="text-[12px]">Meus Chamados</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.exibir_controle_prazos} onCheckedChange={(v) => setForm({ ...form, exibir_controle_prazos: v })} />
                <Label className="text-[12px]">Controle de Prazos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.exibir_kanban} onCheckedChange={(v) => setForm({ ...form, exibir_kanban: v })} />
                <Label className="text-[12px]">Kanban</Label>
              </div>
              {form.exibir_kanban && (
                <div className="md:col-span-3">
                  <Label className="text-[11px]">Pipeline (obrigatório quando exibe no Kanban)</Label>
                  <Select value={form.pipeline || "_"} onValueChange={(v) => setForm({ ...form, pipeline: v === "_" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um pipeline" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : (editing ? "Salvar alterações" : "Criar modelo")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
