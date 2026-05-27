import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, GripVertical, ArrowUp, ArrowDown, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { KANBAN_TRIGGERS } from "@/lib/kanbanTriggers";

const CRM_PIPELINE = "comercial";

type Estagio = {
  id: string;
  pipeline: string; // virtual = "comercial" for CRM rows; real for pipeline_estagios rows
  nome: string;
  ordem: number;
  cor: string | null;
  ativo: boolean;
  is_ganho: boolean;
  is_perdido: boolean;
  checklist_template_id: string | null;
  sla_dias_uteis: number | null;
  concluir_acao: string | null;
  concluir_pipeline_destino: string | null;
  concluir_estagio_destino_id: string | null;
  criar_card_em: string[];
};
type Template = { id: string; nome: string; tipo_servico: string };

type Automacao = {
  id: string;
  estagio_origem_id: string;
  estagio_destino_id: string;
  pipeline_destino: string | null; // null = mesmo CRM
  evento: string;
  condicao_tipo: string;
  condicao_valor: string | null;
  ajustar_prazo_dias: number | null;
  dias: number | null;
  ativo: boolean;
  ordem: number;
  acao: string;
  acao_config: Record<string, any>;
};
type Profile = { user_id: string; nome_completo: string | null };

const PIPELINE_LABELS: Record<string, string> = {
  comercial: "CRM Comercial",
  leads: "Leads",
  operacional: "Operacional",
  revisao: "Revisão",
  fabrica: "Fábrica",
  montagem: "Montagem",
  pos_venda: "Pós-venda",
};

const EVENTOS = [
  { value: "card_chegou", label: "Quando criado/movido para este estágio" },
  { value: "apos_x_dias", label: "Após X dias neste estágio" },
  { value: "agenda_criada", label: "Agenda criada" },
  { value: "checklist_item_marcado", label: "Item de checklist marcado" },
  { value: "checklist_concluido", label: "Checklist concluído (todos itens)" },
  { value: "manual", label: "Disparo manual" },
];

const ACOES = [
  { value: "mover", label: "Mover para" },
  { value: "duplicar", label: "Duplicar em" },
  { value: "checar_dados", label: "Checar dados do orçamento" },
  { value: "comunicado", label: "Disparar comunicado interno" },
  { value: "notificar", label: "Notificar responsável" },
];

const CHECAR_CAMPOS = [
  { value: "cliente_cpf", label: "Cliente — CPF/CNPJ preenchido" },
  { value: "cliente_email", label: "Cliente — e-mail preenchido" },
  { value: "cliente_telefone", label: "Cliente — telefone preenchido" },
];

const ROLES_COMUNICADO = ["admin", "financeiro", "diretor", "vendedor", "conferente", "montador", "tecnico"];
const TIPOS_AGENDA = ["medicao_tecnica", "revisao_final", "entrega", "montagem", "vistoria", "reuniao", "outro"];

export function CrmEstagiosEditDialog({
  open, onOpenChange, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Estagio[]>([]);
  const [outrosPipelinesEstagios, setOutrosPipelinesEstagios] = useState<Estagio[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateItens, setTemplateItens] = useState<Record<string, { descricao: string }[]>>({});
  const [autos, setAutos] = useState<Automacao[]>([]);
  const [autosRemovidas, setAutosRemovidas] = useState<string[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: ests }, { data: outros }, { data: tpls }, { data: as }, { data: profs }, { data: itens }] = await Promise.all([
      supabase.from("crm_estagios").select("*").order("ordem"),
      (supabase as any).from("pipeline_estagios").select("*").eq("ativo", true).order("pipeline").order("ordem"),
      supabase.from("checklist_templates").select("id,nome,tipo_servico").eq("ativo", true).order("nome"),
      (supabase as any).from("crm_automacoes").select("*").order("ordem"),
      supabase.from("profiles").select("user_id,nome_completo").order("nome_completo"),
      supabase.from("checklist_template_itens").select("template_id,descricao,ordem").order("ordem"),
    ]);
    const mapped: Estagio[] = ((ests ?? []) as any[]).map((e) => ({
      id: e.id, pipeline: CRM_PIPELINE, nome: e.nome, ordem: e.ordem, cor: e.cor, ativo: e.ativo,
      is_ganho: e.is_ganho, is_perdido: e.is_perdido,
      checklist_template_id: e.checklist_template_id ?? null,
      sla_dias_uteis: e.sla_dias_uteis ?? null,
      concluir_acao: e.concluir_acao ?? "proxima",
      concluir_pipeline_destino: e.concluir_pipeline_destino ?? null,
      concluir_estagio_destino_id: e.concluir_estagio_destino_id ?? null,
    }));
    setRows(mapped);
    setOutrosPipelinesEstagios(((outros ?? []) as any[]).map((e) => ({
      id: e.id, pipeline: e.pipeline, nome: e.nome, ordem: e.ordem, cor: e.cor, ativo: e.ativo,
      is_ganho: false, is_perdido: false,
      checklist_template_id: e.checklist_template_id ?? null,
      sla_dias_uteis: e.sla_dias_uteis ?? null,
      concluir_acao: e.concluir_acao ?? "proxima",
      concluir_pipeline_destino: e.concluir_pipeline_destino ?? null,
      concluir_estagio_destino_id: e.concluir_estagio_destino_id ?? null,
    })));
    setTemplates((tpls ?? []) as Template[]);
    const itensMap: Record<string, { descricao: string }[]> = {};
    ((itens ?? []) as any[]).forEach((it) => { (itensMap[it.template_id] ||= []).push({ descricao: it.descricao }); });
    setTemplateItens(itensMap);
    setAutos(((as ?? []) as any[]).map((a) => ({
      ...a,
      pipeline_destino: a.pipeline_destino ?? null,
      ajustar_prazo_dias: a.ajustar_prazo_dias ?? null,
      acao: a.acao ?? "mover",
      acao_config: a.acao_config ?? {},
      dias: a.dias ?? null,
    })) as Automacao[]);
    setProfiles((profs ?? []) as Profile[]);
    setAutosRemovidas([]);
    setRemovidos([]);
    setExpandido({});
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const update = (i: number, patch: Partial<Estagio>) =>
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const move = (i: number, dir: -1 | 1) => {
    setRows((r) => {
      const arr = [...r];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr.map((x, idx) => ({ ...x, ordem: idx + 1 }));
    });
  };

  const remove = (i: number) => {
    const row = rows[i];
    if (!row.id.startsWith("new-")) {
      if (!confirm(`Excluir estágio "${row.nome}"? Cards podem ser afetados.`)) return;
      setRemovidos((arr) => [...arr, row.id]);
    }
    setRows((r) => r.filter((_, idx) => idx !== i));
  };

  const addNew = () => {
    setRows((r) => [
      ...r,
      {
        id: `new-${Date.now()}`,
        pipeline: CRM_PIPELINE,
        nome: "Novo estágio",
        ordem: r.length + 1,
        cor: "#6b7280",
        ativo: true,
        is_ganho: false,
        is_perdido: false,
        checklist_template_id: null,
        sla_dias_uteis: null,
        concluir_acao: "proxima",
        concluir_pipeline_destino: null,
        concluir_estagio_destino_id: null,
      },
    ]);
  };

  const automacoesDoEstagio = (estagioId: string) => autos.filter((a) => a.estagio_origem_id === estagioId);

  // All stages selectable as destinos (CRM + outros pipelines)
  const estagiosDisponiveis: Estagio[] = [
    ...rows,
    ...outrosPipelinesEstagios.filter((e) => !rows.some((r) => r.id === e.id)),
  ];
  const pipelinesDisponiveis = Array.from(new Set(estagiosDisponiveis.map((s) => s.pipeline)));

  const addAutomacao = (estagioId: string) => {
    const destino = rows.find((r) => r.id !== estagioId)?.id ?? estagioId;
    setAutos((a) => [
      ...a,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        estagio_origem_id: estagioId,
        estagio_destino_id: destino,
        pipeline_destino: null,
        evento: "card_chegou",
        condicao_tipo: "nenhuma",
        condicao_valor: null,
        ajustar_prazo_dias: null,
        dias: null,
        ativo: true,
        ordem: 0,
        acao: "mover",
        acao_config: {},
      },
    ]);
  };

  const updateAuto = (id: string, patch: Partial<Automacao>) =>
    setAutos((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const removeAuto = (id: string) => {
    setAutos((a) => a.filter((x) => x.id !== id));
    if (!id.startsWith("new-")) setAutosRemovidas((arr) => [...arr, id]);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (removidos.length) {
        const { error } = await supabase.from("crm_estagios").delete().in("id", removidos);
        if (error) throw error;
      }

      const idMap: Record<string, string> = {};
      for (const [i, row] of rows.entries()) {
        const payload: any = {
          nome: row.nome,
          ordem: i + 1,
          cor: row.cor,
          ativo: row.ativo,
          is_ganho: row.is_ganho,
          is_perdido: row.is_perdido,
          checklist_template_id: row.checklist_template_id,
          sla_dias_uteis: row.sla_dias_uteis,
          concluir_acao: row.concluir_acao ?? "proxima",
          concluir_pipeline_destino: row.concluir_acao === "outro_kanban" ? row.concluir_pipeline_destino : null,
          concluir_estagio_destino_id: row.concluir_acao === "outro_kanban" ? row.concluir_estagio_destino_id : null,
        };
        if (row.id.startsWith("new-")) {
          const { data, error } = await supabase.from("crm_estagios").insert(payload).select("id").single();
          if (error) throw error;
          idMap[row.id] = (data as any).id;
        } else {
          const { error } = await supabase.from("crm_estagios").update(payload).eq("id", row.id);
          if (error) throw error;
        }
      }

      if (autosRemovidas.length) {
        const { error } = await (supabase as any).from("crm_automacoes").delete().in("id", autosRemovidas);
        if (error) throw error;
      }

      for (const a of autos) {
        const origemId = idMap[a.estagio_origem_id] ?? a.estagio_origem_id;
        const destinoId = idMap[a.estagio_destino_id] ?? a.estagio_destino_id;
        if (origemId.startsWith("new-") || destinoId.startsWith("new-")) continue;
        const acaoConfig = { ...(a.acao_config ?? {}) };
        if (acaoConfig.estagio_se_nao) {
          acaoConfig.estagio_se_nao = idMap[acaoConfig.estagio_se_nao] ?? acaoConfig.estagio_se_nao;
        }
        const payload: any = {
          estagio_origem_id: origemId,
          estagio_destino_id: destinoId,
          pipeline_destino: a.pipeline_destino && a.pipeline_destino !== CRM_PIPELINE ? a.pipeline_destino : null,
          evento: a.evento,
          condicao_tipo: a.condicao_tipo,
          condicao_valor: a.condicao_valor || null,
          ajustar_prazo_dias: a.ajustar_prazo_dias,
          dias: a.dias,
          ativo: a.ativo,
          ordem: a.ordem,
          acao: a.acao ?? "mover",
          acao_config: acaoConfig,
        };
        if (a.id.startsWith("new-")) {
          const { error } = await (supabase as any).from("crm_automacoes").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("crm_automacoes").update(payload).eq("id", a.id);
          if (error) throw error;
        }
      }

      toast.success("Estágios e regras salvos");
      onChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Editar estágios — CRM Comercial</DialogTitle></DialogHeader>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {rows.map((r, i) => {
              const aberto = !!expandido[r.id];
              const regras = automacoesDoEstagio(r.id);
              return (
                <div key={r.id} className="border rounded-lg p-2 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 flex flex-col items-center gap-0.5 text-muted-foreground">
                      <button onClick={() => move(i, -1)} className="hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                      <GripVertical className="w-3 h-3" />
                      <button onClick={() => move(i, 1)} className="hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                    </div>
                    <Input className="col-span-3" value={r.nome} onChange={(e) => update(i, { nome: e.target.value })} placeholder="Nome do estágio" />
                    <Input className="col-span-1" type="color" value={r.cor || "#6b7280"} onChange={(e) => update(i, { cor: e.target.value })} />
                    <Input
                      className="col-span-2"
                      type="number"
                      min={0}
                      placeholder="SLA (dias úteis)"
                      value={r.sla_dias_uteis ?? ""}
                      onChange={(e) => update(i, { sla_dias_uteis: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                    <Select value={r.checklist_template_id ?? "none"} onValueChange={(v) => update(i, { checklist_template_id: v === "none" ? null : v })}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Modelo de checklist" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sem checklist —</SelectItem>
                        {templates.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost" size="sm" className="col-span-1"
                      onClick={() => setExpandido((x) => ({ ...x, [r.id]: !aberto }))}
                      title="Automações"
                    >
                      {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Zap className="w-3 h-3 ml-0.5" />
                      {regras.length > 0 && <span className="ml-1 text-xs">{regras.length}</span>}
                    </Button>
                    <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => remove(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {aberto && (
                    <div className="ml-8 border-l-2 pl-3 space-y-3 bg-muted/20 p-2 rounded">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2 border-b">
                        <div className="flex items-center gap-2"><Switch checked={r.is_ganho} onCheckedChange={(c) => update(i, { is_ganho: c, is_perdido: c ? false : r.is_perdido })} /><Label className="text-xs">Pipe de ganho/concluído</Label></div>
                        <div className="flex items-center gap-2"><Switch checked={r.is_perdido} onCheckedChange={(c) => update(i, { is_perdido: c, is_ganho: c ? false : r.is_ganho })} /><Label className="text-xs">Pipe de perdido</Label></div>
                        <div className="flex items-center gap-2"><Switch checked={r.ativo} onCheckedChange={(c) => update(i, { ativo: c })} /><Label className="text-xs">Estágio ativo</Label></div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Botão "Concluir card" — quando clicado neste estágio:</div>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Select
                            value={r.concluir_acao ?? "proxima"}
                            onValueChange={(v) => update(i, {
                              concluir_acao: v,
                              concluir_pipeline_destino: v === "outro_kanban" ? r.concluir_pipeline_destino : null,
                              concluir_estagio_destino_id: v === "outro_kanban" ? r.concluir_estagio_destino_id : null,
                            })}
                          >
                            <SelectTrigger className="col-span-4"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="proxima">Mover para próxima etapa</SelectItem>
                              <SelectItem value="outro_kanban">Enviar para outro kanban</SelectItem>
                              <SelectItem value="remover">Remover do kanban</SelectItem>
                              <SelectItem value="desativado">Desativado</SelectItem>
                            </SelectContent>
                          </Select>
                          {r.concluir_acao === "outro_kanban" && (
                            <>
                              <Select
                                value={r.concluir_pipeline_destino ?? ""}
                                onValueChange={(v) => {
                                  const first = estagiosDisponiveis.find((s) => s.pipeline === v);
                                  update(i, { concluir_pipeline_destino: v, concluir_estagio_destino_id: first?.id ?? null });
                                }}
                              >
                                <SelectTrigger className="col-span-4"><SelectValue placeholder="Kanban destino" /></SelectTrigger>
                                <SelectContent>
                                  {pipelinesDisponiveis.filter((p) => p !== CRM_PIPELINE).map((p) => (
                                    <SelectItem key={p} value={p}>{PIPELINE_LABELS[p] ?? p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={r.concluir_estagio_destino_id ?? ""}
                                onValueChange={(v) => update(i, { concluir_estagio_destino_id: v })}
                              >
                                <SelectTrigger className="col-span-4"><SelectValue placeholder="Estágio destino" /></SelectTrigger>
                                <SelectContent>
                                  {estagiosDisponiveis.filter((s) => s.pipeline === r.concluir_pipeline_destino).map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-medium text-muted-foreground pt-2 border-t">Automações — quando o card está em "{r.nome}":</div>
                      {regras.map((a) => {
                        const usaDestino = a.acao === "mover" || a.acao === "duplicar";
                        const pipeAtual = a.pipeline_destino ?? CRM_PIPELINE;
                        return (
                          <div key={a.id} className="border rounded p-2 space-y-2 bg-background">
                            <div className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-2 text-xs text-muted-foreground">Quando</div>
                              <Select value={a.evento} onValueChange={(v) => updateAuto(a.id, { evento: v, condicao_tipo: "nenhuma", condicao_valor: null })}>
                                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {EVENTOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                                </SelectContent>
                              </Select>

                              {a.evento === "apos_x_dias" ? (
                                <Input
                                  className="col-span-3" type="number" min={1} placeholder="Quantos dias"
                                  value={a.dias ?? ""}
                                  onChange={(e) => updateAuto(a.id, { dias: e.target.value === "" ? null : Number(e.target.value) })}
                                />
                              ) : a.evento === "agenda_criada" ? (
                                <Select
                                  value={a.condicao_tipo === "tipo_evento_agenda" ? (a.condicao_valor ?? "any") : "any"}
                                  onValueChange={(v) => updateAuto(a.id, {
                                    condicao_tipo: v === "any" ? "nenhuma" : "tipo_evento_agenda",
                                    condicao_valor: v === "any" ? null : v,
                                  })}
                                >
                                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Tipo" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="any">Qualquer tipo</SelectItem>
                                    {TIPOS_AGENDA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : a.evento === "checklist_concluido" ? (
                                <Select
                                  value={a.condicao_tipo === "template_checklist" ? (a.condicao_valor ?? "any") : "any"}
                                  onValueChange={(v) => updateAuto(a.id, {
                                    condicao_tipo: v === "any" ? "nenhuma" : "template_checklist",
                                    condicao_valor: v === "any" ? null : v,
                                  })}
                                >
                                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Template" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="any">Qualquer</SelectItem>
                                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              ) : (a.evento === "checklist_item_marcado" || a.evento === "card_chegou") ? (
                                (() => {
                                  const itens = r.checklist_template_id ? (templateItens[r.checklist_template_id] ?? []) : [];
                                  if (itens.length === 0) {
                                    return (
                                      <Input
                                        className="col-span-3" placeholder="Descrição exata do item"
                                        value={a.condicao_tipo === "item_checklist" ? (a.condicao_valor ?? "") : ""}
                                        onChange={(e) => updateAuto(a.id, {
                                          condicao_tipo: e.target.value ? "item_checklist" : "nenhuma",
                                          condicao_valor: e.target.value || null,
                                        })}
                                      />
                                    );
                                  }
                                  return (
                                    <Select
                                      value={a.condicao_tipo === "item_checklist" ? (a.condicao_valor ?? "any") : "any"}
                                      onValueChange={(v) => updateAuto(a.id, {
                                        condicao_tipo: v === "any" ? "nenhuma" : "item_checklist",
                                        condicao_valor: v === "any" ? null : v,
                                      })}
                                    >
                                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Item do checklist" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="any">Qualquer item</SelectItem>
                                        {itens.map((it, idx) => (<SelectItem key={idx} value={it.descricao}>{it.descricao}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  );
                                })()
                              ) : (
                                <div className="col-span-3 text-xs text-muted-foreground">sem condição</div>
                              )}

                              <Select value={a.acao} onValueChange={(v) => updateAuto(a.id, { acao: v, acao_config: {} })}>
                                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ACOES.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                                </SelectContent>
                              </Select>

                              <div className="col-span-1 flex items-center justify-center">
                                <Switch checked={a.ativo} onCheckedChange={(v) => updateAuto(a.id, { ativo: v })} />
                              </div>
                            </div>

                            <div className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-2 text-xs text-muted-foreground">→ Configuração</div>

                              {usaDestino && (
                                <>
                                  <Select
                                    value={pipeAtual}
                                    onValueChange={(v) => {
                                      const firstStage = estagiosDisponiveis.find((s) => s.pipeline === v);
                                      updateAuto(a.id, {
                                        pipeline_destino: v === CRM_PIPELINE ? null : v,
                                        estagio_destino_id: firstStage?.id ?? a.estagio_destino_id,
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="col-span-3" title="Kanban destino"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {pipelinesDisponiveis.map((p) => (
                                        <SelectItem key={p} value={p}>{PIPELINE_LABELS[p] ?? p}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select value={a.estagio_destino_id} onValueChange={(v) => updateAuto(a.id, { estagio_destino_id: v })}>
                                    <SelectTrigger className="col-span-4"><SelectValue placeholder="Estágio destino" /></SelectTrigger>
                                    <SelectContent>
                                      {estagiosDisponiveis
                                        .filter((x) => x.pipeline === pipeAtual)
                                        .filter((x) => !(a.acao === "mover" && x.pipeline === CRM_PIPELINE && x.id === r.id))
                                        .map((x) => (<SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    className="col-span-2" type="number" placeholder="±dias úteis"
                                    value={a.ajustar_prazo_dias ?? ""}
                                    onChange={(e) => updateAuto(a.id, { ajustar_prazo_dias: e.target.value === "" ? null : Number(e.target.value) })}
                                  />
                                </>
                              )}

                              {a.acao === "checar_dados" && (
                                <Select
                                  value={a.acao_config?.campo ?? ""}
                                  onValueChange={(v) => updateAuto(a.id, { acao_config: { ...a.acao_config, campo: v } })}
                                >
                                  <SelectTrigger className="col-span-5"><SelectValue placeholder="Campo a verificar" /></SelectTrigger>
                                  <SelectContent>
                                    {CHECAR_CAMPOS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}

                              {a.acao === "comunicado" && (
                                <>
                                  <Input
                                    className="col-span-6" placeholder="Mensagem do comunicado"
                                    value={a.acao_config?.mensagem ?? ""}
                                    onChange={(e) => updateAuto(a.id, { acao_config: { ...a.acao_config, mensagem: e.target.value } })}
                                  />
                                  <Select
                                    value={a.acao_config?.role ?? "admin"}
                                    onValueChange={(v) => updateAuto(a.id, { acao_config: { ...a.acao_config, role: v } })}
                                  >
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Cargo destino" /></SelectTrigger>
                                    <SelectContent>
                                      {ROLES_COMUNICADO.map((r2) => <SelectItem key={r2} value={r2}>{r2}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </>
                              )}

                              {a.acao === "notificar" && (
                                <>
                                  <Select
                                    value={a.acao_config?.user_id ?? ""}
                                    onValueChange={(v) => updateAuto(a.id, { acao_config: { ...a.acao_config, user_id: v } })}
                                  >
                                    <SelectTrigger className="col-span-4"><SelectValue placeholder="Usuário a notificar" /></SelectTrigger>
                                    <SelectContent>
                                      {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo ?? p.user_id.slice(0, 6)}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    className="col-span-5" placeholder="Mensagem (opcional)"
                                    value={a.acao_config?.mensagem ?? ""}
                                    onChange={(e) => updateAuto(a.id, { acao_config: { ...a.acao_config, mensagem: e.target.value } })}
                                  />
                                </>
                              )}

                              <Button variant="ghost" size="icon" className="col-span-1 ml-auto text-destructive" onClick={() => removeAuto(a.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={() => addAutomacao(r.id)}>
                        <Plus className="w-3 h-3 mr-1" /> Adicionar regra
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            <Button variant="outline" onClick={addNew} className="w-full"><Plus className="w-4 h-4 mr-1" /> Novo estágio</Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
