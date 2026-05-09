import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, GripVertical, ArrowUp, ArrowDown, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Estagio = {
  id: string;
  pipeline: string;
  nome: string;
  ordem: number;
  cor: string | null;
  ativo: boolean;
  checklist_template_id: string | null;
  sla_dias_uteis: number | null;
  concluir_acao: string | null;
  concluir_pipeline_destino: string | null;
  concluir_estagio_destino_id: string | null;
};
type Template = { id: string; nome: string; tipo_servico: string };

type Automacao = {
  id: string;
  pipeline: string;
  estagio_origem_id: string;
  estagio_destino_id: string;
  pipeline_destino: string | null;
  evento: string;
  condicao_tipo: string;
  condicao_valor: string | null;
  ajustar_prazo_dias: number | null;
  ativo: boolean;
  ordem: number;
  acao: string;
  acao_config: Record<string, any>;
};
type Profile = { user_id: string; nome_completo: string | null };

const PIPELINE_LABELS: Record<string, string> = {
  leads: "Leads",
  operacional: "Operacional",
  revisao: "Revisão",
  fabrica: "Fábrica",
  montagem: "Montagem",
  pos_venda: "Pós-venda",
};

const EVENTOS = [
  { value: "card_chegou", label: "Quando criado/movido para este estágio" },
  { value: "agenda_criada", label: "Agenda criada" },
  { value: "medicao_agendada", label: "Medição técnica agendada" },
  { value: "revisao_agendada", label: "Revisão final agendada" },
  { value: "checklist_concluido", label: "Checklist concluído" },
  { value: "assinatura_concluida", label: "Assinatura concluída" },
  { value: "manual", label: "Disparo manual" },
];

const ACOES = [
  { value: "mover", label: "Mover para" },
  { value: "duplicar", label: "Duplicar em" },
  { value: "checar_dados", label: "Checar dados do pedido" },
  { value: "comunicado", label: "Disparar comunicado interno" },
  { value: "notificar", label: "Notificar responsável" },
];

const CHECAR_CAMPOS = [
  { value: "contrato_assinado", label: "Contrato assinado" },
  { value: "cliente_cpf", label: "Cliente — CPF/CNPJ preenchido" },
  { value: "cliente_email", label: "Cliente — e-mail preenchido" },
  { value: "cliente_telefone", label: "Cliente — telefone preenchido" },
  { value: "pedido_status", label: "Status do pedido (igual a...)" },
  { value: "pagamentos_completos", label: "Pagamentos todos quitados" },
];

const ROLES_COMUNICADO = ["admin","financeiro","diretor","vendedor","conferente","montador","tecnico"];

const TIPOS_AGENDA = [
  "medicao_tecnica","revisao_final","entrega","montagem","vistoria","reuniao","outro",
];

export function EstagiosEditDialog({
  open, onOpenChange, pipeline, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipeline: string;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Estagio[]>([]);
  const [todosEstagios, setTodosEstagios] = useState<Estagio[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [autos, setAutos] = useState<Automacao[]>([]);
  const [autosRemovidas, setAutosRemovidas] = useState<string[]>([]);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: ests }, { data: todos }, { data: tpls }, { data: as }] = await Promise.all([
      (supabase as any).from("pipeline_estagios").select("*").eq("pipeline", pipeline).order("ordem"),
      (supabase as any).from("pipeline_estagios").select("*").eq("ativo", true).order("pipeline").order("ordem"),
      supabase.from("checklist_templates").select("id,nome,tipo_servico").eq("ativo", true).order("nome"),
      (supabase as any).from("pipeline_automacoes").select("*").eq("pipeline", pipeline).order("ordem"),
    ]);
    setRows((ests ?? []) as Estagio[]);
    setTodosEstagios((todos ?? []) as Estagio[]);
    setTemplates((tpls ?? []) as Template[]);
    setAutos((as ?? []) as Automacao[]);
    setAutosRemovidas([]);
    setExpandido({});
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, pipeline]);

  const update = (i: number, patch: Partial<Estagio>) => {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  const move = (i: number, dir: -1 | 1) => {
    setRows((r) => {
      const arr = [...r];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr.map((x, idx) => ({ ...x, ordem: idx + 1 }));
    });
  };

  const remove = async (i: number) => {
    const row = rows[i];
    if (!row.id.startsWith("new-")) {
      if (!confirm(`Excluir estágio "${row.nome}"? Cards podem ser afetados.`)) return;
      const { error } = await (supabase as any).from("pipeline_estagios").delete().eq("id", row.id);
      if (error) return toast.error(error.message);
    }
    setRows((r) => r.filter((_, idx) => idx !== i));
  };

  const addNew = () => {
    setRows((r) => [
      ...r,
      { id: `new-${Date.now()}`, pipeline, nome: "Novo estágio", ordem: r.length + 1, cor: "#6b7280", ativo: true, checklist_template_id: null, sla_dias_uteis: null, concluir_acao: "proxima", concluir_pipeline_destino: null, concluir_estagio_destino_id: null },
    ]);
  };

  const automacoesDoEstagio = (estagioId: string) => autos.filter((a) => a.estagio_origem_id === estagioId);

  const addAutomacao = (estagioId: string) => {
    const destino = rows.find((r) => r.id !== estagioId)?.id ?? estagioId;
    setAutos((a) => [
      ...a,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        pipeline,
        estagio_origem_id: estagioId,
        estagio_destino_id: destino,
        pipeline_destino: null,
        evento: "card_chegou",
        condicao_tipo: "nenhuma",
        condicao_valor: null,
        ajustar_prazo_dias: null,
        ativo: true,
        ordem: 0,
        acao: "mover",
        acao_config: {},
      },
    ]);
  };

  const updateAuto = (id: string, patch: Partial<Automacao>) => {
    setAutos((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeAuto = (id: string) => {
    setAutos((a) => a.filter((x) => x.id !== id));
    if (!id.startsWith("new-")) setAutosRemovidas((arr) => [...arr, id]);
  };

  const validar = (): string | null => {
    for (const r of rows) {
      if (r.sla_dias_uteis != null && r.sla_dias_uteis < 0) return `SLA do estágio "${r.nome}" não pode ser negativo.`;
    }
    const seen = new Map<string, Automacao>();
    for (const a of autos) {
      const sameP = !a.pipeline_destino || a.pipeline_destino === pipeline;
      if (sameP && a.estagio_origem_id === a.estagio_destino_id) {
        return `Regra inválida: estágio de origem e destino são iguais.`;
      }
      const key = `${a.estagio_origem_id}|${a.evento}|${a.condicao_tipo}|${a.condicao_valor ?? ""}`;
      if (seen.has(key) && a.ativo && seen.get(key)!.ativo) {
        const origem = rows.find((r) => r.id === a.estagio_origem_id)?.nome;
        return `Conflito: existem 2 regras ativas no estágio "${origem}" para o mesmo evento/condição. Desative uma ou diferencie a condição.`;
      }
      seen.set(key, a);
      const dest = todosEstagios.find((r) => r.id === a.estagio_destino_id);
      if (a.ajustar_prazo_dias != null && dest?.sla_dias_uteis != null) {
        console.warn(`Regra para "${dest.nome}" tem ajuste explícito (${a.ajustar_prazo_dias}du) e o destino também tem SLA (${dest.sla_dias_uteis}du). O ajuste prevalece.`);
      }
    }
    return null;
  };

  const save = async () => {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    setSaving(true);
    try {
      // Estágios
      const idMap: Record<string, string> = {};
      for (const [i, row] of rows.entries()) {
        const payload: any = {
          nome: row.nome, ordem: i + 1, cor: row.cor, ativo: row.ativo,
          checklist_template_id: row.checklist_template_id,
          sla_dias_uteis: row.sla_dias_uteis,
          concluir_acao: row.concluir_acao ?? "proxima",
          concluir_pipeline_destino: row.concluir_acao === "outro_kanban" ? row.concluir_pipeline_destino : null,
          concluir_estagio_destino_id: row.concluir_acao === "outro_kanban" ? row.concluir_estagio_destino_id : null,
        };
        if (row.id.startsWith("new-")) {
          const { data, error } = await (supabase as any).from("pipeline_estagios").insert({ pipeline, ...payload }).select("id").single();
          if (error) throw error;
          idMap[row.id] = data.id;
        } else {
          const { error } = await (supabase as any).from("pipeline_estagios").update(payload).eq("id", row.id);
          if (error) throw error;
        }
      }

      // Automações removidas
      if (autosRemovidas.length) {
        const { error } = await (supabase as any).from("pipeline_automacoes").delete().in("id", autosRemovidas);
        if (error) throw error;
      }

      // Automações
      for (const a of autos) {
        const origemId = idMap[a.estagio_origem_id] ?? a.estagio_origem_id;
        const destinoId = idMap[a.estagio_destino_id] ?? a.estagio_destino_id;
        if (origemId.startsWith("new-") || destinoId.startsWith("new-")) continue;
        const payload: any = {
          pipeline,
          estagio_origem_id: origemId,
          estagio_destino_id: destinoId,
          pipeline_destino: a.pipeline_destino && a.pipeline_destino !== pipeline ? a.pipeline_destino : null,
          evento: a.evento,
          condicao_tipo: a.condicao_tipo,
          condicao_valor: a.condicao_valor || null,
          ajustar_prazo_dias: a.ajustar_prazo_dias,
          ativo: a.ativo,
          ordem: a.ordem,
        };
        if (a.id.startsWith("new-")) {
          const { error } = await (supabase as any).from("pipeline_automacoes").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("pipeline_automacoes").update(payload).eq("id", a.id);
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
        <DialogHeader><DialogTitle>Editar estágios — {pipeline}</DialogTitle></DialogHeader>
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
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="col-span-1"
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
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Botão "Concluir card" — quando clicado neste estágio:
                        </div>
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
                                  const first = todosEstagios.find((s) => s.pipeline === v);
                                  update(i, { concluir_pipeline_destino: v, concluir_estagio_destino_id: first?.id ?? null });
                                }}
                              >
                                <SelectTrigger className="col-span-4"><SelectValue placeholder="Kanban destino" /></SelectTrigger>
                                <SelectContent>
                                  {Array.from(new Set(todosEstagios.map((s) => s.pipeline)))
                                    .filter((p) => p !== pipeline)
                                    .map((p) => (
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
                                  {todosEstagios
                                    .filter((s) => s.pipeline === r.concluir_pipeline_destino)
                                    .map((s) => (
                                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-medium text-muted-foreground pt-2 border-t">
                        Automações — quando o card está em "{r.nome}":
                      </div>
                      {regras.map((a) => (
                        <div key={a.id} className="grid grid-cols-12 gap-2 items-center">
                          <Select value={a.evento} onValueChange={(v) => updateAuto(a.id, { evento: v, condicao_tipo: "nenhuma", condicao_valor: null })}>
                            <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {EVENTOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                            </SelectContent>
                          </Select>

                          {(a.evento === "medicao_agendada" || a.evento === "revisao_agendada" || a.evento === "agenda_criada") && (
                            <Select
                              value={a.condicao_tipo === "tipo_evento_agenda" ? (a.condicao_valor ?? "any") : "any"}
                              onValueChange={(v) => updateAuto(a.id, {
                                condicao_tipo: v === "any" ? "nenhuma" : "tipo_evento_agenda",
                                condicao_valor: v === "any" ? null : v,
                              })}
                            >
                              <SelectTrigger className="col-span-2"><SelectValue placeholder="Tipo" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Qualquer tipo</SelectItem>
                                {TIPOS_AGENDA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          {a.evento === "checklist_concluido" && (
                            <Select
                              value={a.condicao_tipo === "template_checklist" ? (a.condicao_valor ?? "any") : "any"}
                              onValueChange={(v) => updateAuto(a.id, {
                                condicao_tipo: v === "any" ? "nenhuma" : "template_checklist",
                                condicao_valor: v === "any" ? null : v,
                              })}
                            >
                              <SelectTrigger className="col-span-2"><SelectValue placeholder="Template" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Qualquer</SelectItem>
                                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          {!["medicao_agendada","revisao_agendada","agenda_criada","checklist_concluido"].includes(a.evento) && (
                            <div className="col-span-2 text-xs text-muted-foreground">sem condição</div>
                          )}

                          <span className="col-span-1 text-xs text-center">→</span>

                          <Select
                            value={a.pipeline_destino ?? pipeline}
                            onValueChange={(v) => {
                              const firstStage = todosEstagios.find((s) => s.pipeline === v);
                              updateAuto(a.id, {
                                pipeline_destino: v === pipeline ? null : v,
                                estagio_destino_id: firstStage?.id ?? a.estagio_destino_id,
                              });
                            }}
                          >
                            <SelectTrigger className="col-span-2" title="Kanban destino"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from(new Set(todosEstagios.map((s) => s.pipeline))).map((p) => (
                                <SelectItem key={p} value={p}>{PIPELINE_LABELS[p] ?? p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={a.estagio_destino_id} onValueChange={(v) => updateAuto(a.id, { estagio_destino_id: v })}>
                            <SelectTrigger className="col-span-2"><SelectValue placeholder="Destino" /></SelectTrigger>
                            <SelectContent>
                              {todosEstagios
                                .filter((x) => x.pipeline === (a.pipeline_destino ?? pipeline))
                                .filter((x) => !(x.pipeline === pipeline && x.id === r.id))
                                .map((x) => (
                                  <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <Input
                            className="col-span-1"
                            type="number"
                            placeholder="±dias"
                            value={a.ajustar_prazo_dias ?? ""}
                            onChange={(e) => updateAuto(a.id, { ajustar_prazo_dias: e.target.value === "" ? null : Number(e.target.value) })}
                            title="Ajuste de prazo em dias úteis (negativo = antes da data de referência)"
                          />

                          <div className="col-span-1 flex items-center justify-center">
                            <Switch checked={a.ativo} onCheckedChange={(v) => updateAuto(a.id, { ativo: v })} />
                          </div>
                          <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => removeAuto(a.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
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
